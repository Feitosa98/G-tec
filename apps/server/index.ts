import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';
import {
    authenticateStoreAdmin,
    authenticateStoreAdminGlobally,
    authenticateCustomer,
    createTenant,
    deleteStoreUser,
    deleteStoreRecord,
    initializeDatabases,
    listStoreRecords,
    listStoreUsers,
    listTenants,
    resolveTenant,
    registerCustomer,
    setTenantStatus,
    updateTenantBySlug,
    updateTenantRecord,
    upsertStoreUser,
    upsertStoreRecord
} from './database.js';
import { createToken, verifyToken } from './auth.js';
import { createMPPixPayment, createMPPreference, getMPPayment } from './services/mercadopago.js';

const app = express();
// A aplicação roda atrás do Traefik na VPS. Isso preserva o IP real do
// cliente para os limites de login e demais proteções do Express.
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const requiredProductionSecret = (name: string, developmentFallback: string) => {
    const value = process.env[name] || developmentFallback;
    if (isProduction && (!process.env[name] || value.length < 12)) {
        throw new Error(`${name} deve ser definido com pelo menos 12 caracteres em produção.`);
    }
    return value;
};
const masterUser = process.env.SAAS_ADMIN_USER || 'gestor';
const masterPassword = requiredProductionSecret('SAAS_ADMIN_PASSWORD', 'local-development-admin-password');
const tokenSecret = requiredProductionSecret('SAAS_TOKEN_SECRET', 'local-token-secret-development-only');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = process.env.NODE_ENV === 'production' 
    ? path.join(process.cwd(), 'apps/web/dist')
    : path.resolve(__dirname, '../web/dist');

// Security Middlewares
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false, // Vite/React compatibility for local/inline scripts
    crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '2mb' }));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per `window`
    message: { message: 'Muitas tentativas de login. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const publicLookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { message: 'Muitas consultas. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const tokenFromRequest = (req: any) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const requireMaster = (req: any, res: any, next: any) => {
    const payload = verifyToken(tokenFromRequest(req), tokenSecret);
    if (!payload || payload.role !== 'saas-admin') return res.status(401).json({ message: 'Acesso não autorizado.' });
    req.auth = payload;
    next();
};

const requireStoreUser = (req: any, res: any, next: any) => {
    const payload = verifyToken(tokenFromRequest(req), tokenSecret);
    const staffRoles = new Set(['admin', 'gerente', 'tecnico', 'vendedor']);
    if (!payload || (payload.role !== 'saas-admin' && (!staffRoles.has(payload.role) || payload.storeSlug !== cleanSlug(req.params.slug)))) {
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    }
    req.auth = payload;
    next();
};

const requireStoreAdmin = (req: any, res: any, next: any) => {
    requireStoreUser(req, res, () => {
        if (req.auth.role !== 'saas-admin' && req.auth.role !== 'admin') {
            return res.status(403).json({ message: 'Acesso restrito a administradores.' });
        }
        next();
    });
};

const cleanSlug = (value: any) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

const collectionPermissions: Record<string, Set<string>> = {
    admin: new Set(['*']),
    gerente: new Set(['products', 'sales', 'customers', 'receivables', 'services', 'service_orders', 'suppliers', 'stock_movements', 'appointments']),
    tecnico: new Set(['customers', 'services', 'service_orders', 'appointments']),
    vendedor: new Set(['products', 'sales', 'customers', 'stock_movements'])
};
const validCollections = new Set(['products', 'sales', 'expenses', 'customers', 'receivables', 'services', 'service_orders', 'subscriptions', 'integrations', 'suppliers', 'stock_movements', 'appointments', 'audit_log']);
const requireCollectionAccess = (req: any, res: any, next: any) => {
    const collection = String(req.params.collection || '');
    if (!validCollections.has(collection)) return res.status(404).json({ message: 'Recurso não encontrado.' });
    if (req.auth.role === 'saas-admin') return next();
    const allowed = collectionPermissions[req.auth.role];
    if (!allowed || (!allowed.has('*') && !allowed.has(collection))) return res.status(403).json({ message: 'Permissão insuficiente.' });
    next();
};

const writeAudit = async (slug: string, auth: any, action: string, collection: string, recordId: string) => {
    await upsertStoreRecord(slug, 'audit_log', {
        id: crypto.randomUUID(), action, collection, recordId,
        userEmail: auth?.email || auth?.name || 'sistema',
        timestamp: new Date().toISOString()
    });
};

const tenantSchema = z.object({
    businessName: z.string().min(3, "O nome da empresa deve ter no mínimo 3 caracteres."),
    storeSlug: z.string().optional(),
    email: z.string().email("E-mail inválido."),
    adminPassword: z.string().min(8, "A senha deve ter no mínimo 8 caracteres.")
}).passthrough();

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Portal do Cliente - endpoint público (sem autenticação)
app.get('/api/public/:slug/os/:search', publicLookupLimiter, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const search = String(req.params.search || '').trim().toLowerCase();
        const searchPhone = search.replace(/\D/g, '');
        if (search.length < 6) return res.status(400).json({ message: 'Informe o número completo da ordem ou telefone.' });
        const records = await listStoreRecords(slug, 'service_orders');
        if (!records) return res.status(404).json({ message: 'Loja não encontrada.' });

        const found = records.filter((r: any) => {
            const d = r.data || r;
            return (
                String(d.id || r.id || '').toLowerCase() === search ||
                (searchPhone.length >= 8 && String(d.clientPhone || '').replace(/\D/g, '') === searchPhone)
            );
        }).map((r: any) => {
            const d = r.data || r;
            return {
                id: r.id || d.id,
                clientName: String(d.clientName || '').replace(/(^\S{2})\S+/g, '$1***'),
                device: d.device,
                orderType: d.orderType,
                issueDescription: d.issueDescription,
                status: d.status,
                totalValue: d.totalValue,
                warranty: d.warranty,
                createdAt: r.createdAt || d.createdAt,
            };
        });

        return res.json(found.slice(0, 10));
    } catch (error) { return next(error); }
});

app.post('/api/saas/login', loginLimiter, (req, res) => {
    const validUser = String(req.body.username || '') === masterUser;
    const provided = Buffer.from(String(req.body.password || ''));
    const expected = Buffer.from(masterPassword);
    const validPassword = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    if (!validUser || !validPassword) return res.status(401).json({ message: 'Credenciais inválidas.' });
    return res.json({ token: createToken({ role: 'saas-admin', name: 'Gestor SaaS' }, tokenSecret) });
});

app.get('/api/saas/tenants', requireMaster, async (_req, res, next) => {
    try { res.json(await listTenants()); } catch (error) { next(error); }
});

app.post('/api/saas/tenants', requireMaster, async (req, res, next) => {
    try {
        const validation = tenantSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: validation.error.issues.map(i => i.message).join(' ') 
            });
        }
        
        const storeSlug = cleanSlug(req.body.storeSlug || req.body.businessName);
        if (!storeSlug) return res.status(400).json({ message: 'Identificador não pode ser vazio.' });

        const tenant = await createTenant({ ...req.body, storeSlug });
        return res.status(201).json(tenant);
    } catch (error: any) {
        if (error.code === '23505') return res.status(409).json({ message: 'Este identificador de loja já está em uso.' });
        return next(error);
    }
});

app.put('/api/saas/tenants/:id', requireMaster, async (req, res, next) => {
    try {
        const tenant = await updateTenantRecord(req.params.id, req.body);
        return tenant ? res.json(tenant) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

app.patch('/api/saas/tenants/:id/status', requireMaster, async (req, res, next) => {
    try {
        const tenant = await setTenantStatus(req.params.id, Boolean(req.body.active));
        return tenant ? res.json(tenant) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

app.get('/api/tenants/resolve', async (req, res, next) => {
    try {
        const tenant = await resolveTenant(cleanSlug(req.query.slug), req.hostname);
        return tenant ? res.json(tenant) : res.status(404).json({ message: 'Loja não encontrada ou inativa.' });
    } catch (error) { return next(error); }
});

app.post('/api/login', loginLimiter, async (req, res, next) => {
    try {
        const user = await authenticateStoreAdminGlobally(req.body.username, req.body.password);
        if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });
        return res.json({ user, token: createToken(user, tokenSecret) });
    } catch (error: any) {
        if (error?.code === 'AMBIGUOUS_LOGIN') return res.status(409).json({ message: error.message });
        return next(error);
    }
});

app.post('/api/store/:slug/login', loginLimiter, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const user = await authenticateStoreAdmin(slug, req.body.username, req.body.password);
        if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });
        return res.json({ user, token: createToken(user, tokenSecret) });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/customer/register', loginLimiter, async (req, res, next) => {
    try {
        const validation = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), password: z.string().min(8).max(128) }).safeParse(req.body);
        if (!validation.success) return res.status(400).json({ message: 'Informe nome, e-mail e uma senha de pelo menos 8 caracteres.' });
        const user = await registerCustomer(cleanSlug(req.params.slug), req.body.name, req.body.email, req.body.password);
        if (!user) return res.status(404).json({ message: 'Loja não encontrada.' });
        if (user.conflict) return res.status(409).json({ message: 'E-mail já cadastrado.' });
        return res.status(201).json({ user, token: createToken(user, tokenSecret) });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/customer/login', loginLimiter, async (req, res, next) => {
    try {
        const user = await authenticateCustomer(cleanSlug(req.params.slug), req.body.email, req.body.password);
        if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });
        return res.json({ user, token: createToken(user, tokenSecret) });
    } catch (error) { return next(error); }
});

app.put('/api/store/:slug/settings', requireStoreAdmin, async (req, res, next) => {
    try {
        const tenant = await updateTenantBySlug(cleanSlug(req.params.slug), req.body);
        return tenant ? res.json(tenant) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

import { initWhatsAppConnection, getWhatsAppStatus, disconnectWhatsApp } from './services/whatsapp.js';

app.get('/api/store/:slug/whatsapp/status', requireStoreAdmin, async (req, res, next) => {
    try {
        const tenantId = cleanSlug(req.params.slug);
        return res.json(getWhatsAppStatus(tenantId));
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/whatsapp/connect', requireStoreAdmin, async (req, res, next) => {
    try {
        const tenantId = cleanSlug(req.params.slug);
        await initWhatsAppConnection(tenantId);
        return res.json({ message: 'Connecting...' });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/whatsapp/disconnect', requireStoreAdmin, async (req, res, next) => {
    try {
        const tenantId = cleanSlug(req.params.slug);
        await disconnectWhatsApp(tenantId);
        return res.json({ message: 'Disconnected' });
    } catch (error) { return next(error); }
});

import { sendWhatsAppMessage } from './services/whatsapp.js';
import { sendTelegramMessage } from './services/telegram.js';
import { sendEmail } from './services/email.js';

// Unified notification endpoint
app.post('/api/store/:slug/notify', requireStoreAdmin, async (req, res, next) => {
    try {
        const { channel, to, message, subject } = req.body as {
            channel: 'whatsapp' | 'telegram' | 'email';
            to: string;
            message: string;
            subject?: string;
        };

        if (!channel || !message) {
            return res.status(400).json({ message: 'channel e message são obrigatórios.' });
        }

        const tenantId = cleanSlug(req.params.slug);

        if (channel === 'whatsapp') {
            if (!to) return res.status(400).json({ message: 'Campo "to" (telefone) é obrigatório para WhatsApp.' });
            await sendWhatsAppMessage(tenantId, to, message);
        } else if (channel === 'telegram') {
            await sendTelegramMessage(null, message, to || undefined);
        } else if (channel === 'email') {
            if (!to) return res.status(400).json({ message: 'Campo "to" (e-mail) é obrigatório para E-mail.' });
            await sendEmail(null, to, subject || 'Notificação', `<p>${message.replace(/\n/g, '<br>')}</p>`);
        } else {
            return res.status(400).json({ message: 'Canal inválido. Use: whatsapp, telegram ou email.' });
        }

        return res.json({ ok: true, message: 'Mensagem enviada com sucesso.' });
    } catch (error: any) {
        return next(error);
    }
});

app.get('/api/store/:slug/users', requireStoreAdmin, async (req, res, next) => {
    try {
        const users = await listStoreUsers(cleanSlug(req.params.slug));
        return users ? res.json(users) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/users', requireStoreAdmin, async (req, res, next) => {
    try {
        const validation = z.object({
            id: z.string().uuid().optional(),
            name: z.string().trim().min(2).max(120),
            email: z.string().email().max(254),
            password: z.string().max(128).optional(),
            role: z.enum(['admin', 'gerente', 'tecnico', 'vendedor'])
        }).safeParse(req.body);
        if (!validation.success) return res.status(400).json({ message: 'Dados de usuário inválidos.' });
        const user = await upsertStoreUser(cleanSlug(req.params.slug), validation.data);
        await writeAudit(cleanSlug(req.params.slug), (req as any).auth, 'UPDATE', 'users', user.id);
        return res.status(201).json(user);
    } catch (error: any) {
        if (error?.code === '23505') return res.status(409).json({ message: 'Este e-mail já está em uso.' });
        if (String(error?.message).includes('senha')) return res.status(400).json({ message: error.message });
        return next(error);
    }
});

app.delete('/api/store/:slug/users/:id', requireStoreAdmin, async (req, res, next) => {
    try {
        const deleted = await deleteStoreUser(cleanSlug(req.params.slug), req.params.id, (req as any).auth?.id);
        if (deleted) await writeAudit(cleanSlug(req.params.slug), (req as any).auth, 'DELETE', 'users', req.params.id);
        return res.json({ deleted });
    } catch (error: any) {
        if (String(error?.message).includes('não pode') || String(error?.message).includes('precisa manter')) {
            return res.status(400).json({ message: error.message });
        }
        return next(error);
    }
});

app.get('/api/store/:slug/:collection', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        const records = await listStoreRecords(cleanSlug(req.params.slug), req.params.collection);
        return records ? res.json(records) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/:collection', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Dados inválidos.' });
        const record = await upsertStoreRecord(cleanSlug(req.params.slug), req.params.collection, req.body);
        if (!record) return res.status(404).json({ message: 'Loja não encontrada.' });
        await writeAudit(cleanSlug(req.params.slug), (req as any).auth, 'CREATE', req.params.collection, record.id);
        return res.status(201).json(record);
    }
    catch (error) { return next(error); }
});

app.put('/api/store/:slug/:collection/:id', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Dados inválidos.' });
        const record = await upsertStoreRecord(cleanSlug(req.params.slug), req.params.collection, { ...req.body, id: req.params.id });
        if (!record) return res.status(404).json({ message: 'Loja não encontrada.' });
        await writeAudit(cleanSlug(req.params.slug), (req as any).auth, 'UPDATE', req.params.collection, record.id);
        return res.json(record);
    }
    catch (error) { return next(error); }
});

app.delete('/api/store/:slug/:collection/:id', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const deleted = await deleteStoreRecord(slug, req.params.collection, req.params.id);
        if (deleted) await writeAudit(slug, (req as any).auth, 'DELETE', req.params.collection, req.params.id);
        return res.json({ deleted });
    }
    catch (error) { return next(error); }
});

// ─── Mercado Pago ───────────────────────────────────────────────────────────

const normalizePublicBaseUrl = (value: any) => String(value || '').trim().replace(/\/+$/, '');
const validPublicBaseUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);
    } catch {
        return false;
    }
};

// Salvar configuração do Mercado Pago e webhook
app.post('/api/store/:slug/mercadopago/config', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const records = await listStoreRecords(slug, 'integrations');
        const current = (records || []).find((record: any) => record.id === 'mercadopago') || {};
        const suppliedAccessToken = String(req.body.accessToken || '');
        const suppliedWebhookSecret = String(req.body.webhookSecret || '');
        const accessToken = suppliedAccessToken.startsWith('•') ? current.accessToken : suppliedAccessToken;
        const webhookSecret = suppliedWebhookSecret.startsWith('•') ? current.webhookSecret : suppliedWebhookSecret;
        const publicBaseUrl = normalizePublicBaseUrl(req.body.publicBaseUrl);

        if (!accessToken) return res.status(400).json({ message: 'Access Token é obrigatório.' });
        if (publicBaseUrl && !validPublicBaseUrl(publicBaseUrl)) {
            return res.status(400).json({ message: 'Informe uma URL pública HTTPS válida, sem localhost.' });
        }

        const webhookUrl = publicBaseUrl ? `${publicBaseUrl}/api/public/${slug}/mercadopago/webhook` : '';
        const autoReconciliationEnabled = Boolean(webhookSecret && webhookUrl);
        await upsertStoreRecord(slug, 'integrations', {
            ...current,
            id: 'mercadopago',
            accessToken,
            webhookSecret,
            publicBaseUrl,
            webhookUrl,
            sandbox: !!req.body.sandbox,
            autoReconciliationEnabled,
            updatedAt: new Date().toISOString()
        });
        return res.json({ ok: true, webhookUrl, autoReconciliationEnabled });
    } catch (error) { return next(error); }
});

// Gerar link de pagamento
app.post('/api/store/:slug/mercadopago/preference', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const records = await listStoreRecords(slug, 'integrations');
        const mpConfig = (records || []).find((r: any) => r.id === 'mercadopago');

        if (!mpConfig?.accessToken) {
            return res.status(400).json({ message: 'Mercado Pago não configurado. Acesse Integrações → Mercado Pago e insira seu Access Token.' });
        }

        const { items, payerEmail, payerName, externalReference, referenceType, saleId } = req.body;
        if (!items || !items.length) return res.status(400).json({ message: 'Itens são obrigatórios' });

        const expectedAmount = items.reduce(
            (total: number, item: any) => total + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1),
            0
        );
        if (expectedAmount <= 0) return res.status(400).json({ message: 'O valor do pagamento deve ser maior que zero.' });

        const notificationUrl = mpConfig.autoReconciliationEnabled && mpConfig.webhookUrl
            ? mpConfig.webhookUrl
            : undefined;

        const result = await createMPPreference({
            accessToken: mpConfig.accessToken,
            items,
            payerEmail,
            payerName,
            externalReference,
            notificationUrl,
        });

        if (result.id && externalReference) {
            await upsertStoreRecord(slug, 'payment_transactions', {
                id: result.id,
                preferenceId: result.id,
                externalReference: String(externalReference),
                referenceType: ['service_order', 'installment'].includes(referenceType) ? referenceType : 'unknown',
                saleId: saleId ? String(saleId) : undefined,
                expectedAmount,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        return res.json({ ...result, autoReconciliationEnabled: Boolean(notificationUrl) });
    } catch (error: any) {
        return res.status(500).json({ message: error?.message || 'Erro ao gerar link de pagamento' });
    }
});

// Webhook do Mercado Pago (notificação de pagamento)
app.post('/api/store/:slug/mercadopago/pix', requireStoreAdmin, async (req, res) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const records = await listStoreRecords(slug, 'integrations');
        const mpConfig = (records || []).find((record: any) => record.id === 'mercadopago');
        if (!mpConfig?.accessToken) {
            return res.status(400).json({ message: 'Mercado Pago não configurado.' });
        }

        const validation = z.object({
            amount: z.coerce.number().positive(),
            description: z.string().trim().min(2).max(200),
            payerEmail: z.string().trim().email().max(254),
            payerName: z.string().trim().max(120).optional(),
            externalReference: z.string().trim().max(120).optional(),
            referenceType: z.enum(['service_order', 'installment', 'test']).optional(),
            saleId: z.string().trim().max(120).optional(),
        }).safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ message: 'Informe valor, descrição e e-mail válido do pagador.' });
        }

        const data = validation.data;
        const externalReference = data.externalReference || `pix-test-${crypto.randomUUID()}`;
        const notificationUrl = mpConfig.autoReconciliationEnabled && mpConfig.webhookUrl
            ? mpConfig.webhookUrl
            : undefined;
        const result = await createMPPixPayment({
            accessToken: mpConfig.accessToken,
            amount: data.amount,
            description: data.description,
            payerEmail: data.payerEmail,
            payerName: data.payerName,
            externalReference,
            notificationUrl,
            idempotencyKey: crypto.randomUUID(),
        });

        if (!result.id || !result.qrCode || !result.qrCodeBase64) {
            return res.status(502).json({ message: 'O Mercado Pago não retornou os dados do QR Code PIX.' });
        }

        await upsertStoreRecord(slug, 'payment_transactions', {
            id: result.id,
            paymentId: result.id,
            externalReference,
            referenceType: data.referenceType || 'test',
            saleId: data.saleId,
            expectedAmount: data.amount,
            status: result.status,
            reconciliationStatus: 'waiting',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        return res.json({ ...result, externalReference, autoReconciliationEnabled: Boolean(notificationUrl) });
    } catch (error: any) {
        const message = String(error?.message || 'Erro ao gerar PIX');
        if (message.toUpperCase().includes('UNAUTHORIZED')) {
            return res.status(401).json({ message: 'Access Token recusado pelo Mercado Pago. Atualize a credencial de produção.' });
        }
        return res.status(500).json({ message });
    }
});

app.post('/api/public/:slug/mercadopago/webhook', async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const notificationType = String(req.query.type || req.body?.type || '');
        if (notificationType && notificationType !== 'payment') return res.sendStatus(200);

        const records = await listStoreRecords(slug, 'integrations');
        const mpConfig = (records || []).find((record: any) => record.id === 'mercadopago');
        if (!mpConfig?.accessToken || !mpConfig?.webhookSecret) return res.sendStatus(503);

        const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
        if (!dataId) return res.status(400).json({ message: 'Identificador do pagamento ausente.' });

        WebhookSignatureValidator.validate({
            xSignature: req.headers['x-signature'],
            xRequestId: req.headers['x-request-id'],
            dataId,
            secret: mpConfig.webhookSecret,
            toleranceSeconds: 300
        });

        const payment = await getMPPayment(mpConfig.accessToken, dataId);
        const externalReference = String(payment.external_reference || '');
        const paymentId = String(payment.id || dataId);
        const paymentStatus = String(payment.status || 'unknown');
        const paymentMethod = String(payment.payment_method_id || '');
        const paidAt = payment.date_approved || new Date().toISOString();
        const paidAmount = Number(payment.transaction_amount) || 0;

        if (!externalReference) return res.sendStatus(200);

        const transactions = await listStoreRecords(slug, 'payment_transactions') || [];
        const transaction = transactions
            .filter((item: any) => item.externalReference === externalReference)
            .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];

        if (!transaction) return res.sendStatus(200);
        if (transaction.reconciliationStatus === 'completed' && transaction.paymentId === paymentId) {
            return res.sendStatus(200);
        }

        const expectedAmount = Number(transaction.expectedAmount) || 0;
        const commonTransactionData = {
            ...transaction,
            paymentId,
            paymentStatus,
            paymentMethod,
            paidAmount,
            updatedAt: new Date().toISOString()
        };

        if (paymentStatus !== 'approved') {
            await upsertStoreRecord(slug, 'payment_transactions', {
                ...commonTransactionData,
                status: paymentStatus,
                reconciliationStatus: 'waiting'
            });
            return res.sendStatus(200);
        }

        if (paymentMethod !== 'pix') {
            await upsertStoreRecord(slug, 'payment_transactions', {
                ...commonTransactionData,
                status: paymentStatus,
                reconciliationStatus: 'ignored_non_pix'
            });
            return res.sendStatus(200);
        }

        if (expectedAmount <= 0 || Math.abs(expectedAmount - paidAmount) > 0.01) {
            await upsertStoreRecord(slug, 'payment_transactions', {
                ...commonTransactionData,
                status: paymentStatus,
                reconciliationStatus: 'amount_mismatch'
            });
            return res.sendStatus(200);
        }

        let reconciled = false;
        if (transaction.referenceType === 'service_order') {
            const orders = await listStoreRecords(slug, 'service_orders') || [];
            const order = orders.find((item: any) => item.id === externalReference);
            if (order) {
                await upsertStoreRecord(slug, 'service_orders', {
                    ...order,
                    paymentStatus: 'Pago',
                    paid: true,
                    paidAt,
                    paidValue: paidAmount,
                    paymentMethod: 'Pix / Mercado Pago',
                    mercadoPagoPaymentId: paymentId
                });
                reconciled = true;

                const sales = await listStoreRecords(slug, 'sales') || [];
                for (const sale of sales.filter((item: any) => item.osReference === externalReference)) {
                    const installments = (sale.installments || []).map((installment: any) => installment.status === 'Pago' ? installment : ({
                        ...installment,
                        status: 'Pago',
                        paid: true,
                        paidAt,
                        paidValue: installment.value,
                        paymentMethod: 'Pix / Mercado Pago',
                        mercadoPagoPaymentId: paymentId
                    }));
                    await upsertStoreRecord(slug, 'sales', { ...sale, installments });
                }
            }
        } else if (transaction.referenceType === 'installment') {
            const sales = await listStoreRecords(slug, 'sales') || [];
            const sale = sales.find((item: any) => item.id === transaction.saleId || (item.installments || []).some((installment: any) => installment.id === externalReference));
            if (sale) {
                const installments = (sale.installments || []).map((installment: any) => installment.id !== externalReference ? installment : ({
                    ...installment,
                    status: 'Pago',
                    paid: true,
                    paidAt,
                    paidValue: paidAmount,
                    paymentMethod: 'Pix / Mercado Pago',
                    mercadoPagoPaymentId: paymentId
                }));
                await upsertStoreRecord(slug, 'sales', { ...sale, installments });
                reconciled = true;
            }
        }

        await upsertStoreRecord(slug, 'payment_transactions', {
            ...commonTransactionData,
            status: paymentStatus,
            reconciliationStatus: reconciled ? 'completed' : 'reference_not_found',
            reconciledAt: reconciled ? new Date().toISOString() : undefined
        });

        if (reconciled) await writeAudit(slug, { name: 'Mercado Pago' }, 'PAYMENT', transaction.referenceType, externalReference);
        return res.sendStatus(200);
    } catch (error) {
        if (error instanceof InvalidWebhookSignatureError) return res.sendStatus(401);
        return next(error);
    }
});

// Backup completo do tenant (download JSON)
app.get('/api/store/:slug/backup/download', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const collections = ['products', 'customers', 'sales', 'services', 'service_orders', 'suppliers', 'appointments', 'integrations'];
        const backup: Record<string, any> = { exportedAt: new Date().toISOString(), tenant: slug };
        for (const col of collections) {
            try { backup[col] = await listStoreRecords(slug, col) || []; }
            catch { backup[col] = []; }
        }
        res.setHeader('Content-Disposition', `attachment; filename="backup-${slug}-${new Date().toISOString().slice(0, 10)}.json"`);
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(backup, null, 2));
    } catch (error) { return next(error); }
});

// Log de auditoria
app.get('/api/store/:slug/audit_log', requireStoreAdmin, async (req, res, next) => {
    try {
        const records = await listStoreRecords(cleanSlug(req.params.slug), 'audit_log');
        return res.json(records || []);
    } catch (error) { return next(error); }
});


app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(distPath, { maxAge: '1h', index: false }));

app.use((error: any, _req: any, res: any, _next: any) => {
    console.error(error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(path.join(distPath, 'index.html'));
});

await initializeDatabases();
app.listen(port, '0.0.0.0', () => console.log(`GTEC SaaS disponível na porta ${port}`));
