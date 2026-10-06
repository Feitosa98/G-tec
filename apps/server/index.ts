import crypto from 'node:crypto';
import { reconcileInstallments } from '../web/src/utils/installmentPayments.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';
import {
    authenticateStoreAdmin,
    authenticateStoreAdminGlobally,
    authenticateCustomer,
    createAuthSession,
    createTenant,
    deleteAuthSession,
    deleteStoreUser,
    deleteStoreRecord,
    deleteServiceOrderWithStock,
    initializeDatabases,
    listStoreRecords,
    listStoreUsers,
    listTenants,
    resolveTenant,
    registerCustomer,
    reserveNfseDpsNumber,
    replaceStoreCollections,
    resolveAuthSession,
    setTenantStatus,
    updateTenantBySlug,
    updateTenantRecord,
    upsertStoreUser,
    upsertStoreRecord,
    upsertServiceOrderWithStock
} from './database.js';
import { BACKUP_COLLECTIONS, createBackupDocument, encryptBackupDocument, validateBackupDocument } from './backup.js';
import {
    createGoogleDriveAuthorizationUrl,
    exchangeGoogleDriveCode,
    refreshGoogleDriveAccessToken,
    uploadBackupToGoogleDrive,
} from './services/google-drive.js';
import {
    deleteGoogleCalendarEventById,
    googleCalendarEventId,
    listManagedGoogleCalendarEventIds,
    upsertGoogleCalendarEvent,
} from './services/google-calendar.js';
import { buildFinancialAgendaEvents } from './services/agenda-events.js';
import { fetchNfeXmlByAccessKey, parseNfeAccessKey, parseNfePurchaseXml } from './services/nfe-distribution.js';
import { fiscalCertificateSchema, prepareFiscalCertificate, publicFiscalCertificate } from './services/fiscal-certificate.js';
import { createMPPixPayment, createMPPreference, getMPPayment } from './services/mercadopago.js';
import { decryptStoredSecret, encryptSecret, getDataEncryptionSecret, isEncryptedValue, maskSecret } from './security.js';
import {
    buildAndSignDps,
    decryptNfseSecret,
    NFSE_HOMOLOGATION_BASE_URL,
    testNfseHomologationConnection,
    transmitDpsToHomologation
} from './services/nfse.js';

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
requiredProductionSecret('SAAS_TOKEN_SECRET', 'local-token-secret-development-only');
const dataEncryptionSecret = getDataEncryptionSecret();
const nfseSecret = process.env.NFSE_SECRET_KEY || (isProduction ? '' : 'local-nfse-secret-development-only');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = process.env.NODE_ENV === 'production' 
    ? path.join(process.cwd(), 'apps/web/dist')
    : path.resolve(__dirname, '../web/dist');

// Security Middlewares
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"],
            formAction: ["'self'"],
            scriptSrc: ["'self'"],
            workerSrc: ["'self'", 'blob:'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'"],
            ...(isProduction ? { upgradeInsecureRequests: [] } : {})
        }
    },
    crossOriginEmbedderPolicy: false
}));
app.use(compression({ threshold: 1024 }));
// O motor de OCR usa WebAssembly em um worker local. A página continua sem eval.
app.use('/ocr', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' blob:; worker-src 'self'");
    next();
});
app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=(), payment=(self), usb=()');
    next();
});
app.use(express.json({ limit: '20mb' }));

app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.includes('/public/')) return next();
    const origin = String(req.headers.origin || '');
    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    const fetchSite = String(req.headers['sec-fetch-site'] || '');
    if ((origin && origin !== expectedOrigin) || fetchSite === 'cross-site') {
        return res.status(403).json({ message: 'Origem da solicitação não autorizada.' });
    }
    next();
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Math.max(600, Number(process.env.API_RATE_LIMIT_MAX || 1800)),
    message: { message: 'Muitas solicitações. Aguarde alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

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

const storeCookieName = isProduction ? '__Host-gtec_session' : 'gtec_session';
const masterCookieName = isProduction ? '__Host-gtec_saas' : 'gtec_saas';
const sessionMaxAgeSeconds = 2 * 60 * 60;
const masterSessionMaxAgeSeconds = 60 * 60;

const cookieValue = (req: any, name: string) => String(req.headers.cookie || '')
    .split(';')
    .map((part: string) => part.trim().split('='))
    .find(([key]: string[]) => key === name)?.slice(1).join('=') || '';

const requestTokens = (req: any, cookieNames: string[]) => {
    const suppliedBearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const bearer = suppliedBearer.startsWith('cookie-session') ? '' : suppliedBearer;
    return [bearer, ...cookieNames.map(name => cookieValue(req, name))].filter(Boolean);
};

const requestSession = async (req: any, cookieNames: string[]) => {
    for (const token of requestTokens(req, cookieNames)) {
        const payload = await resolveAuthSession(token);
        if (payload) return { payload, token };
    }
    return null;
};

const setSessionCookie = (res: any, name: string, token: string, maxAgeSeconds: number) => {
    const parts = [`${name}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
    if (isProduction) parts.push('Secure');
    res.append('Set-Cookie', parts.join('; '));
};

const clearSessionCookie = (res: any, name: string) => {
    const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
    if (isProduction) parts.push('Secure');
    res.append('Set-Cookie', parts.join('; '));
};

const requireMaster = async (req: any, res: any, next: any) => {
    try {
        const session = await requestSession(req, [masterCookieName]);
        if (!session || session.payload.role !== 'saas-admin') return res.status(401).json({ message: 'Acesso não autorizado.' });
        req.auth = session.payload;
        req.authToken = session.token;
        next();
    } catch (error) { next(error); }
};

const requireStoreUser = async (req: any, res: any, next: any) => {
    try {
        const session = await requestSession(req, [storeCookieName, masterCookieName]);
        const payload = session?.payload;
        const staffRoles = new Set(['admin', 'gerente', 'tecnico', 'vendedor']);
        if (!payload || (payload.role !== 'saas-admin' && (!staffRoles.has(payload.role) || payload.storeSlug !== cleanSlug(req.params.slug)))) {
            return res.status(401).json({ message: 'Acesso não autorizado.' });
        }
        req.auth = payload;
        req.authToken = session!.token;
        next();
    } catch (error) { next(error); }
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

const integrationSecretFields: Record<string, string[]> = {
    mercadopago: ['accessToken', 'webhookSecret'],
    email: ['pass'],
    telegram: ['token'],
    googledrive: ['refreshToken'],
};

const integrationSecretContext = (slug: string, integrationId: string, field: string) =>
    `integration:${cleanSlug(slug)}:${integrationId}:${field}`;

const protectIntegrationRecord = (slug: string, input: any, current: any = {}) => {
    const record = { ...current, ...input };
    const id = String(record.id || input.id || '');
    for (const field of integrationSecretFields[id] || []) {
        const supplied = input[field];
        if (typeof supplied === 'string' && supplied.startsWith('•')) {
            record[field] = current[field] || '';
        } else if (supplied === undefined) {
            record[field] = current[field] || '';
        } else if (supplied) {
            record[field] = isEncryptedValue(supplied)
                ? supplied
                : encryptSecret(String(supplied), dataEncryptionSecret, integrationSecretContext(slug, id, field));
        } else {
            record[field] = '';
        }
    }
    return record;
};

const revealIntegrationRecord = (slug: string, record: any) => {
    const revealed = { ...record };
    const id = String(record?.id || '');
    for (const field of integrationSecretFields[id] || []) {
        if (record[field]) revealed[field] = decryptStoredSecret(record[field], dataEncryptionSecret, integrationSecretContext(slug, id, field));
    }
    return revealed;
};

const sanitizeIntegrationRecord = (record: any) => {
    if (record?.id === 'nfse') return publicNfseConfig(record);
    const sanitized = { ...record };
    for (const field of integrationSecretFields[String(record?.id || '')] || []) sanitized[field] = maskSecret(record[field]);
    return sanitized;
};

const getIntegrationConfig = async (slug: string, integrationId: string) => {
    const records = await listStoreRecords(slug, 'integrations');
    const stored = (records || []).find((record: any) => record.id === integrationId);
    if (!stored) return null;
    const protectedRecord = protectIntegrationRecord(slug, stored, stored);
    if (JSON.stringify(protectedRecord) !== JSON.stringify(stored)) await upsertStoreRecord(slug, 'integrations', protectedRecord);
    return revealIntegrationRecord(slug, protectedRecord);
};

const googleDriveClient = () => {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
    if (!clientId || !clientSecret || !publicBaseUrl) {
        throw new Error('A integração com Google Drive ainda não foi configurada no servidor.');
    }
    return { clientId, clientSecret, redirectUri: `${publicBaseUrl}/api/backup/google/callback` };
};

type GoogleReturnTarget = 'backup' | 'agenda' | 'integracoes';

const signGoogleDriveState = (slug: string, returnTo: GoogleReturnTarget = 'backup') => {
    const encoded = Buffer.from(JSON.stringify({ slug, returnTo, expiresAt: Date.now() + 10 * 60_000 })).toString('base64url');
    const signature = crypto.createHmac('sha256', dataEncryptionSecret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
};

const verifyGoogleDriveState = (state: string) => {
    const [encoded, suppliedSignature] = String(state || '').split('.');
    if (!encoded || !suppliedSignature) throw new Error('Autorização do Google inválida.');
    const expectedSignature = crypto.createHmac('sha256', dataEncryptionSecret).update(encoded).digest('base64url');
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new Error('Autorização do Google inválida.');
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.slug || Number(payload.expiresAt) < Date.now()) throw new Error('A autorização do Google expirou.');
    const returnTo: GoogleReturnTarget = ['agenda', 'integracoes'].includes(payload.returnTo) ? payload.returnTo : 'backup';
    return { slug: cleanSlug(payload.slug), returnTo };
};

const buildBackupForSlug = async (slug: string) => {
    const tenant = await resolveTenant(slug);
    if (!tenant) throw new Error('Empresa não encontrada.');
    const collections: Record<string, any[]> = {};
    for (const collection of BACKUP_COLLECTIONS) {
        const records = await listStoreRecords(slug, collection) || [];
        collections[collection] = collection === 'integrations'
            ? (records as any[]).map(sanitizeIntegrationRecord)
            : records as any[];
    }
    return createBackupDocument(slug, tenant as any, collections);
};

const prepareRestoredCollections = async (slug: string, input: Record<string, any[]>) => {
    const collections = { ...input };
    const currentIntegrations = await listStoreRecords(slug, 'integrations') || [];
    const currentById = new Map((currentIntegrations as any[]).map(record => [String(record.id), record]));
    collections.integrations = (input.integrations || []).map((record: any) => {
        const current = currentById.get(String(record?.id || '')) || {};
        if (record?.id === 'nfse') {
            const { certificateConfigured: _certificateConfigured, ...safeRecord } = record;
            return {
                ...current,
                ...safeRecord,
                certificateEncrypted: (current as any).certificateEncrypted,
                certificatePasswordEncrypted: (current as any).certificatePasswordEncrypted,
            };
        }
        return protectIntegrationRecord(slug, record, current);
    });
    // Conexões criadas depois do backup não são removidas, evitando perda de credenciais.
    for (const current of currentIntegrations as any[]) {
        if (!collections.integrations.some((record: any) => record.id === current.id)) collections.integrations.push(current);
    }
    return collections;
};

const performGoogleDriveBackup = async (slug: string) => {
    const driveConfig = await getIntegrationConfig(slug, 'googledrive');
    if (!driveConfig?.refreshToken) throw new Error('Google Drive não conectado.');
    const client = googleDriveClient();
    const accessToken = await refreshGoogleDriveAccessToken(client, driveConfig.refreshToken);
    const backup = await buildBackupForSlug(slug);
    const filename = `backup-${slug}-${new Date().toISOString().replace(/[:.]/g, '-')}.encrypted.json`;
    const encryptedBackup = encryptBackupDocument(backup, dataEncryptionSecret);
    const uploaded = await uploadBackupToGoogleDrive(accessToken, JSON.stringify(encryptedBackup), filename, driveConfig.folderId);
    const saved = protectIntegrationRecord(slug, {
        ...driveConfig,
        id: 'googledrive',
        connected: true,
        folderId: uploaded.folderId,
        lastFileId: uploaded.fileId,
        lastBackupAt: new Date().toISOString(),
        lastBackupStatus: 'success',
        lastError: '',
    }, driveConfig);
    await upsertStoreRecord(slug, 'integrations', saved);
    return { filename, ...uploaded, completedAt: saved.lastBackupAt };
};

const calendarEventsForSlug = async (slug: string) => {
    const [appointments, sales, expenses] = await Promise.all([
        listStoreRecords(slug, 'appointments'),
        listStoreRecords(slug, 'sales'),
        listStoreRecords(slug, 'expenses'),
    ]);
    return [
        ...((appointments || []) as any[]).map(item => ({ ...item, source: item.source || 'appointment', readOnly: false })),
        ...buildFinancialAgendaEvents((sales || []) as any[], (expenses || []) as any[]),
    ];
};

const syncGoogleCalendarForSlug = async (slug: string) => {
    const [driveConfig, calendarConfig] = await Promise.all([
        getIntegrationConfig(slug, 'googledrive').catch(() => null),
        getIntegrationConfig(slug, 'googlecalendar').catch(() => null),
    ]);
    if (!driveConfig?.refreshToken) throw new Error('Conecte a conta Google desta empresa primeiro.');
    if (!calendarConfig?.enabled) throw new Error('A sincronização com o Google Agenda está desativada.');
    const accessToken = await refreshGoogleDriveAccessToken(googleDriveClient(), driveConfig.refreshToken);
    const calendarId = String(calendarConfig.calendarId || 'primary');
    const timeZone = String(calendarConfig.timeZone || 'America/Manaus');
    const events = await calendarEventsForSlug(slug);
    const expectedIds = new Set(events.map(event => googleCalendarEventId(slug, String(event.id))));
    let synced = 0;
    for (const event of events) {
        await upsertGoogleCalendarEvent(accessToken, slug, event, calendarId, timeZone);
        synced += 1;
    }
    const managedIds = await listManagedGoogleCalendarEventIds(accessToken, slug, calendarId);
    let removed = 0;
    for (const eventId of managedIds) {
        if (expectedIds.has(eventId)) continue;
        if (await deleteGoogleCalendarEventById(accessToken, eventId, calendarId)) removed += 1;
    }
    const completedAt = new Date().toISOString();
    await upsertStoreRecord(slug, 'integrations', {
        ...calendarConfig,
        id: 'googlecalendar', enabled: true, calendarId, timeZone,
        lastSyncAt: completedAt, lastSyncStatus: 'success', lastSyncCount: synced, lastRemovedCount: removed, lastError: '',
    });
    return { synced, removed, completedAt };
};

const scheduleCalendarSync = (slug: string) => {
    const timer = setTimeout(() => void syncGoogleCalendarForSlug(slug).catch(() => undefined), 250);
    timer.unref?.();
};

const syncSalePaymentToServiceOrder = async (slug: string, sale: any) => {
    const orderId = String(sale?.osReference || '').trim();
    if (!orderId) return;
    const orders = await listStoreRecords(slug, 'service_orders') || [];
    const order = (orders as any[]).find(item => String(item.id) === orderId);
    if (!order) return;
    const paid = sale.paymentStatus === 'Pago' || sale.status === 'Pago';
    const paidTotal = Number(sale.paidTotal ?? order.paidTotal ?? 0) || 0;
    const total = Number(order.totalValue ?? sale.total ?? 0) || 0;
    await upsertStoreRecord(slug, 'service_orders', {
        ...order,
        installments: sale.installments || order.installments || [],
        payments: sale.payments || order.payments || [],
        paidTotal,
        balanceDue: paid ? 0 : Math.max(0, total - paidTotal),
        paymentStatus: paid ? 'Pago' : paidTotal > 0 ? 'Parcial' : (sale.paymentStatus || order.paymentStatus || 'Pendente'),
        status: paid ? 'Paga' : order.status,
        paid: paid || order.paid,
        paidAt: paid ? (sale.paidAt || order.paidAt || new Date().toISOString()) : order.paidAt,
        paymentMethod: sale.paymentMethod || order.paymentMethod,
    });
};

const collectionPermissions: Record<string, Set<string>> = {
    admin: new Set(['*']),
    gerente: new Set(['products', 'sales', 'customers', 'receivables', 'services', 'service_orders', 'suppliers', 'stock_movements', 'appointments', 'purchase_invoices']),
    tecnico: new Set(['customers', 'services', 'service_orders', 'appointments']),
    vendedor: new Set(['products', 'sales', 'customers', 'stock_movements'])
};
const validCollections = new Set(['products', 'sales', 'expenses', 'customers', 'receivables', 'services', 'service_orders', 'subscriptions', 'integrations', 'suppliers', 'stock_movements', 'appointments', 'audit_log', 'purchase_invoices']);
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
    adminPassword: z.string().min(12, "A senha deve ter no mínimo 12 caracteres.")
}).passthrough();

let initializationPromise: Promise<void> = Promise.resolve();
let databaseReady = false;
app.get('/api/health', (_req, res) => res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'starting',
    uptimeSeconds: Math.round(process.uptime()),
}));

app.use('/api', (_req, _res, next) => {
    void initializationPromise.then(() => next()).catch(next);
});

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

app.post('/api/saas/login', loginLimiter, async (req, res, next) => {
    try {
    const validUser = String(req.body.username || '') === masterUser;
    const provided = Buffer.from(String(req.body.password || ''));
    const expected = Buffer.from(masterPassword);
    const validPassword = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
    if (!validUser || !validPassword) return res.status(401).json({ message: 'Credenciais inválidas.' });
    const token = await createAuthSession({ id: 'saas-admin', role: 'saas-admin', name: 'Gestor SaaS' }, masterSessionMaxAgeSeconds);
    setSessionCookie(res, masterCookieName, token, masterSessionMaxAgeSeconds);
    return res.json({ ok: true, user: { role: 'saas-admin', name: 'Gestor SaaS' } });
    } catch (error) { return next(error); }
});

app.get('/api/saas/session', requireMaster, (req: any, res) => res.json({ authenticated: true, user: req.auth }));

app.post('/api/saas/logout', async (req, res, next) => {
    try {
        await Promise.all(requestTokens(req, [masterCookieName]).map(token => deleteAuthSession(token)));
        clearSessionCookie(res, masterCookieName);
        return res.json({ ok: true });
    } catch (error) { return next(error); }
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
        if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este identificador de loja já está em uso.' });
        const stage = error.tenantCreationStage === 'admin' ? 'ADMIN' : 'TENANT';
        const databaseCode = /^[A-Z0-9_]{1,64}$/.test(String(error.code || '')) ? String(error.code) : 'UNKNOWN';
        console.error(`Falha ao criar loja [${stage}/${databaseCode}]`, error);
        return res.status(500).json({ message: `Não foi possível criar a loja (${stage}/${databaseCode}).` });
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
        const token = await createAuthSession(user, sessionMaxAgeSeconds);
        setSessionCookie(res, storeCookieName, token, sessionMaxAgeSeconds);
        return res.json({ user });
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
        const token = await createAuthSession(user, sessionMaxAgeSeconds);
        setSessionCookie(res, storeCookieName, token, sessionMaxAgeSeconds);
        return res.json({ user });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/customer/register', loginLimiter, async (req, res, next) => {
    try {
        const validation = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), password: z.string().min(12).max(128) }).safeParse(req.body);
        if (!validation.success) return res.status(400).json({ message: 'Informe nome, e-mail e uma senha de pelo menos 12 caracteres.' });
        const user = await registerCustomer(cleanSlug(req.params.slug), req.body.name, req.body.email, req.body.password);
        if (!user) return res.status(404).json({ message: 'Loja não encontrada.' });
        if (user.conflict) return res.status(409).json({ message: 'E-mail já cadastrado.' });
        const token = await createAuthSession(user, sessionMaxAgeSeconds);
        setSessionCookie(res, storeCookieName, token, sessionMaxAgeSeconds);
        return res.status(201).json({ user });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/customer/login', loginLimiter, async (req, res, next) => {
    try {
        const user = await authenticateCustomer(cleanSlug(req.params.slug), req.body.email, req.body.password);
        if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });
        const token = await createAuthSession(user, sessionMaxAgeSeconds);
        setSessionCookie(res, storeCookieName, token, sessionMaxAgeSeconds);
        return res.json({ user });
    } catch (error) { return next(error); }
});

app.get('/api/session', async (req, res, next) => {
    try {
        const session = await requestSession(req, [storeCookieName]);
        if (!session) return res.status(401).json({ message: 'Sessão expirada.' });
        return res.json({ user: session.payload });
    } catch (error) { return next(error); }
});

app.post('/api/logout', async (req, res, next) => {
    try {
        await Promise.all(requestTokens(req, [storeCookieName]).map(token => deleteAuthSession(token)));
        clearSessionCookie(res, storeCookieName);
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
        return res.json({ ok: true });
    } catch (error) { return next(error); }
});

app.put('/api/store/:slug/settings', requireStoreAdmin, async (req, res, next) => {
    try {
        const tenant = await updateTenantBySlug(cleanSlug(req.params.slug), req.body);
        return tenant ? res.json(tenant) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

const lookupBrasilApi = async (path: string) => {
    const response = await fetch(`https://brasilapi.com.br/api/${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'FeitosaSolucoes/1.0' },
        signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`BrasilAPI respondeu com HTTP ${response.status}.`);
    return response.json() as Promise<any>;
};

app.get('/api/store/:slug/lookup/cnpj/:cnpj', requireStoreUser, publicLookupLimiter, async (req, res, next) => {
    try {
        const cnpj = String(req.params.cnpj || '').replace(/\D/g, '');
        if (cnpj.length !== 14) return res.status(400).json({ message: 'CNPJ inválido.' });
        const data = await lookupBrasilApi(`cnpj/v1/${cnpj}`);
        if (!data) return res.status(404).json({ message: 'CNPJ não encontrado.' });
        const establishment = data.estabelecimento || {};
        const phone = data.ddd_telefone_1
            || data.ddd_telefone_2
            || [establishment.ddd1, establishment.telefone1].filter(Boolean).join('')
            || [establishment.ddd2, establishment.telefone2].filter(Boolean).join('')
            || data.telefone
            || '';
        return res.json({
            document: cnpj,
            name: String(data.nome_fantasia || establishment.nome_fantasia || data.razao_social || establishment.razao_social || '').trim(),
            legalName: String(data.razao_social || establishment.razao_social || '').trim(),
            email: String(data.email || establishment.email || data.correio_eletronico || '').trim().toLowerCase(),
            phone: String(phone).trim(),
            postalCode: String(data.cep || establishment.cep || '').replace(/\D/g, ''),
            street: String(data.descricao_tipo_de_logradouro ? `${data.descricao_tipo_de_logradouro} ${data.logradouro || ''}` : data.logradouro || establishment.logradouro || '').trim(),
            addressNumber: String(data.numero || establishment.numero || '').trim(),
            complement: String(data.complemento || establishment.complemento || '').trim(),
            neighborhood: String(data.bairro || establishment.bairro || '').trim(),
            city: String(data.municipio || establishment.cidade?.nome || establishment.municipio || '').trim(),
            state: String(data.uf || establishment.estado?.sigla || establishment.uf || '').trim().toUpperCase(),
        });
    } catch (error) {
        console.error('Falha na consulta protegida de CNPJ:', error);
        return res.status(502).json({ message: 'A consulta de CNPJ está temporariamente indisponível.' });
    }
});

app.get('/api/store/:slug/lookup/cep/:cep', requireStoreUser, publicLookupLimiter, async (req, res, next) => {
    try {
        const cep = String(req.params.cep || '').replace(/\D/g, '');
        if (cep.length !== 8) return res.status(400).json({ message: 'CEP inválido.' });
        const data = await lookupBrasilApi(`cep/v1/${cep}`);
        if (!data) return res.status(404).json({ message: 'CEP não encontrado.' });
        return res.json({
            postalCode: cep,
            street: String(data.street || '').trim(),
            neighborhood: String(data.neighborhood || '').trim(),
            city: String(data.city || '').trim(),
            state: String(data.state || '').trim().toUpperCase(),
        });
    } catch (error) {
        console.error('Falha na consulta protegida de CEP:', error);
        return res.status(502).json({ message: 'A consulta de CEP está temporariamente indisponível.' });
    }
});

app.get('/api/store/:slug/purchase-invoices/lookup/:key', requireStoreAdmin, publicLookupLimiter, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const parsed = parseNfeAccessKey(req.params.key);
        const existingRecords = await listStoreRecords(slug, 'purchase_invoices') || [];
        const existing = (existingRecords as any[]).find(record => String(record.key || record.id || '').replace(/\D/g, '') === parsed.key);

        let supplierDetails: any = { name: 'Fornecedor não identificado', cnpj: parsed.issuerDocument };
        try {
            const company = await lookupBrasilApi(`cnpj/v1/${parsed.issuerDocument}`);
            const establishment = company?.estabelecimento || {};
            if (company) supplierDetails = {
                name: String(company.nome_fantasia || establishment.nome_fantasia || company.razao_social || establishment.razao_social || 'Fornecedor não identificado').trim(),
                cnpj: parsed.issuerDocument,
                email: String(company.email || establishment.email || company.correio_eletronico || '').trim().toLowerCase(),
                phone: String(company.ddd_telefone_1 || company.ddd_telefone_2 || '').trim(),
                address: [company.logradouro || establishment.logradouro, company.numero || establishment.numero,
                    company.bairro || establishment.bairro, company.municipio || establishment.cidade?.nome,
                    company.uf || establishment.estado?.sigla, company.cep || establishment.cep].filter(Boolean).join(', '),
                category: 'Fornecedor de produtos',
            };
        } catch (error) {
            console.error('Não foi possível complementar o emitente da NF-e:', error);
        }

        const base = {
            id: parsed.key,
            key: parsed.key,
            supplier: supplierDetails.name,
            supplierDetails,
            metadata: {
                stateCode: parsed.stateCode, yearMonth: parsed.yearMonth, model: parsed.model,
                series: parsed.series, number: parsed.number, emissionType: parsed.emissionType,
            },
        };
        const tenant = await resolveTenant(slug);
        const certificateConfig = await getStoredNfseConfig(slug).catch(() => null);
        if (certificateConfig?.certificateEncrypted && certificateConfig?.certificatePasswordEncrypted && tenant) {
            try {
                const certificate = getNfseCredentials(certificateConfig);
                const distribution = await fetchNfeXmlByAccessKey({
                    key: parsed.key,
                    companyDocument: String((tenant as any).document || ''),
                    companyState: String((tenant as any).state || ''),
                    pfxBase64: certificate.pfxBase64,
                    passphrase: certificate.passphrase,
                });
                if (distribution.xml) {
                    const parsedInvoice = parseNfePurchaseXml(distribution.xml);
                    return res.json({ ...base, ...parsedInvoice, source: 'sefaz', xml: distribution.xml });
                }
                if (existing?.items?.length) return res.json({
                    ...base, ...existing, source: 'local', sefazStatus: distribution.status,
                    message: 'A SEFAZ não liberou um XML mais completo; foram usados os itens já salvos nesta empresa.',
                });
                return res.json({
                    ...base, source: 'key', items: [], sefazStatus: distribution.status,
                    message: distribution.reason || 'A SEFAZ validou a consulta, mas não liberou o XML completo para este CNPJ. Preencha os itens manualmente ou importe o XML autorizado.',
                });
            } catch (error: any) {
                console.error(`Falha na distribuição da NF-e ${parsed.key}:`, error?.message || 'erro desconhecido');
                if (existing?.items?.length) return res.json({
                    ...base, ...existing, source: 'local',
                    message: 'A consulta à SEFAZ falhou; foram usados os itens já salvos nesta empresa.',
                });
                return res.json({ ...base, source: 'key', items: [], message: `${error?.message || 'A consulta automática à SEFAZ falhou.'} Você pode preencher os itens manualmente ou importar o XML.` });
            }
        }
        if (existing?.items?.length) return res.json({ ...base, ...existing, source: 'local' });
        return res.json({
            ...base, source: 'key', items: [], requiresCertificate: true,
            message: 'Chave válida. Para baixar os itens automaticamente, configure o certificado A1 da empresa. Você também pode preencher os itens manualmente.',
        });
    } catch (error: any) {
        if (/chave|dígito/i.test(String(error?.message || ''))) return res.status(400).json({ message: error.message });
        return next(error);
    }
});

import {
    initWhatsAppConnection,
    getWhatsAppStatus,
    disconnectWhatsApp,
    restoreWhatsAppSession,
    restoreWhatsAppSessions,
    sendWhatsAppCharge,
    sendWhatsAppMessage,
} from './services/whatsapp.js';

const defaultWhatsAppTemplates = {
    id: 'whatsapp_templates',
    chargeCreatedEnabled: true,
    paymentConfirmedEnabled: true,
    serviceOrderCreatedEnabled: true,
    serviceCompletedEnabled: true,
    chargeCreated: 'Olá, {cliente}!\n\n{titulo}\nValor: R$ {valor}\n\nPIX Copia e Cola:\n{pix}\n\nO QR Code e o PDF seguem anexos.',
    paymentConfirmed: 'Olá, {cliente}! Recebemos seu pagamento PIX de R$ {valor}. A venda #{numero} está paga. Muito obrigado pela preferência!',
    serviceOrderCreated: 'Olá, {cliente}! Sua ordem de serviço #{numero} foi aberta com sucesso. Status atual: {status}. Valor previsto: R$ {valor}.',
    serviceCompleted: 'Olá, {cliente}! Sua ordem de serviço #{numero} foi concluída e está pronta para retirada. Valor: R$ {valor}. Obrigado pela preferência!',
};

const applyWhatsAppTemplate = (template: string, values: Record<string, string>) => Object.entries(values)
    .reduce((message, [key, value]) => message.replaceAll(`{${key}}`, value), template);

app.get('/api/store/:slug/whatsapp/status', requireStoreAdmin, async (req, res, next) => {
    try {
        const tenantId = cleanSlug(req.params.slug);
        if (req.query.restore !== '0' && getWhatsAppStatus(tenantId).status === 'disconnected') {
            await restoreWhatsAppSession(tenantId);
        }
        return res.json(getWhatsAppStatus(tenantId));
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/whatsapp/templates', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const records = await listStoreRecords(slug, 'integrations');
        const saved = (records || []).find((record: any) => record.id === 'whatsapp_templates') || {};
        return res.json({ ...defaultWhatsAppTemplates, ...saved, id: 'whatsapp_templates' });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/whatsapp/templates', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const validation = z.object({
            chargeCreatedEnabled: z.boolean(),
            paymentConfirmedEnabled: z.boolean(),
            serviceOrderCreatedEnabled: z.boolean(),
            serviceCompletedEnabled: z.boolean(),
            chargeCreated: z.string().trim().min(10).max(2000),
            paymentConfirmed: z.string().trim().min(10).max(2000),
            serviceOrderCreated: z.string().trim().min(10).max(2000),
            serviceCompleted: z.string().trim().min(10).max(2000),
        }).safeParse(req.body);
        if (!validation.success) return res.status(400).json({ message: 'Revise os modelos de mensagens.' });
        const saved = await upsertStoreRecord(slug, 'integrations', {
            id: 'whatsapp_templates',
            ...validation.data,
            updatedAt: new Date().toISOString(),
        });
        return res.json(saved);
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

import { sendTelegramMessage } from './services/telegram.js';
import { sendEmail } from './services/email.js';

const escapeEmailHtml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dateKeyInManaus = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Manaus', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const dateKeyToDayNumber = (dateKey: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateKey || ''));
    return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000) : NaN;
};

let paymentReminderSweepRunning = false;
const processPaymentReminders = async () => {
    if (paymentReminderSweepRunning) return;
    paymentReminderSweepRunning = true;
    try {
        const todayKey = dateKeyInManaus();
        const todayNumber = dateKeyToDayNumber(todayKey);
        const tenants = (await listTenants()).filter((tenant: any) => tenant.active !== false);
        for (const tenant of tenants as any[]) {
            const slug = cleanSlug(tenant.storeSlug);
            if (!slug) continue;
            const emailConfig = await getIntegrationConfig(slug, 'email').catch(() => null);
            const sales = await listStoreRecords(slug, 'sales') || [];
            const orders = await listStoreRecords(slug, 'service_orders') || [];
            const companyEmail = String(tenant.billingEmail || tenant.email || '').trim();
            const businessName = String(tenant.businessName || tenant.shortName || 'Feitosa Soluções');

            for (const sale of sales as any[]) {
                let installments = reconcileInstallments(sale);
                const linkedOrder = sale.osReference ? (orders as any[]).find(order => order.id === sale.osReference) : null;
                const orderIsPaid = linkedOrder && (linkedOrder.paymentStatus === 'Pago' || ['Paga', 'Pago'].includes(linkedOrder.status));
                const saleIsPaid = sale.paymentStatus === 'Pago' || sale.status === 'Pago';
                if (orderIsPaid || saleIsPaid) {
                    const paidAt = linkedOrder?.paidAt || sale.paidAt || new Date().toISOString();
                    installments = installments.map(installment => ({
                        ...installment, status: 'Pago', paid: true, paidAt: installment.paidAt || paidAt,
                        paymentMethod: installment.paymentMethod || linkedOrder?.paymentMethod || sale.paymentMethod || 'Baixa pela O.S.',
                    }));
                    await upsertStoreRecord(slug, 'sales', { ...sale, installments, paymentStatus: 'Pago', status: 'Pago', paidTotal: Number(sale.total || linkedOrder?.totalValue || 0), balanceDue: 0 });
                    continue;
                }
                if (!emailConfig?.host || !emailConfig?.user || !emailConfig?.pass) continue;
                let changed = false;
                for (let index = 0; index < installments.length; index += 1) {
                    const installment = installments[index];
                    if (installment.status === 'Pago' || installment.paid) continue;
                    const dueNumber = dateKeyToDayNumber(installment.dueDate);
                    if (!Number.isFinite(dueNumber)) continue;
                    const daysUntilDue = dueNumber - todayNumber;
                    const reminderType = daysUntilDue === 5 ? 'fiveDays' : daysUntilDue === 1 ? 'oneDay' : daysUntilDue === 0 ? 'dueToday' : daysUntilDue === -1 ? 'overdue' : '';
                    if (!reminderType) continue;

                    const reminderLog = { ...(installment.emailReminderLog || {}) };
                    const customerEmail = String(sale.customerEmail || sale.userEmail || '').trim();
                    const amount = Number(installment.balanceDue ?? installment.value ?? installment.amount ?? 0);
                    const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const dueDate = String(installment.dueDate || '').split('-').reverse().join('/');
                    const number = installment.number || installment.installmentNumber || index + 1;
                    const totalInstallments = installments.length;
                    const isOverdue = reminderType === 'overdue';
                    const headline = isOverdue ? 'Pagamento em atraso' : daysUntilDue === 0 ? 'Pagamento com vencimento hoje' : 'Lembrete de vencimento';
                    const message = isOverdue
                        ? `A parcela ${number}/${totalInstallments}, no valor de ${formattedAmount}, venceu em ${dueDate} e permanece pendente. Entre em contato para regularização.`
                        : `A parcela ${number}/${totalInstallments}, no valor de ${formattedAmount}, vence em ${dueDate}. Se o pagamento já foi realizado, desconsidere este lembrete.`;
                    const html = `<div style="font-family:Arial,sans-serif;background:#f1f5f9;padding:24px"><div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;overflow:hidden"><div style="background:#2441b4;color:#fff;padding:22px 28px;border-bottom:5px solid #0db8dc"><strong style="font-size:22px">${escapeEmailHtml(businessName)}</strong></div><div style="padding:28px;color:#1e293b;line-height:1.6"><h2 style="margin-top:0">${escapeEmailHtml(headline)}</h2><p>Olá, ${escapeEmailHtml(sale.customerName || 'cliente')}.</p><p>${escapeEmailHtml(message)}</p><p style="color:#64748b;font-size:13px">Referência: O.S. ${escapeEmailHtml(sale.osReference || sale.id)}</p></div></div></div>`;

                    if (customerEmail && !reminderLog[`${reminderType}Customer`]) {
                        try {
                            await sendEmail(emailConfig, customerEmail, `${headline} — ${businessName}`, html);
                            reminderLog[`${reminderType}Customer`] = new Date().toISOString();
                            changed = true;
                        } catch (error: any) {
                            console.error(`Falha no lembrete ${reminderType} da loja ${slug}:`, error?.message || 'erro de envio');
                        }
                    }
                    if (isOverdue && companyEmail && companyEmail.toLowerCase() !== customerEmail.toLowerCase() && !reminderLog.overdueCompany) {
                        const companyHtml = html.replace(`Olá, ${escapeEmailHtml(sale.customerName || 'cliente')}.`, `Atenção: cobrança de ${escapeEmailHtml(sale.customerName || 'cliente')}.`);
                        try {
                            await sendEmail(emailConfig, companyEmail, `Cobrança vencida para acompanhamento — ${sale.customerName || 'Cliente'}`, companyHtml);
                            reminderLog.overdueCompany = new Date().toISOString();
                            changed = true;
                        } catch (error: any) {
                            console.error(`Falha no aviso de atraso da loja ${slug}:`, error?.message || 'erro de envio');
                        }
                    }
                    installments[index] = { ...installment, emailReminderLog: reminderLog };
                }
                if (changed) await upsertStoreRecord(slug, 'sales', { ...sale, installments, reminderCheckedAt: new Date().toISOString() });
            }
        }
    } catch (error) {
        console.error('Falha ao processar lembretes de pagamento:', error);
    } finally {
        paymentReminderSweepRunning = false;
    }
};

const startPaymentReminderScheduler = () => {
    const firstRun = setTimeout(() => void processPaymentReminders(), 30_000);
    const interval = setInterval(() => void processPaymentReminders(), 60 * 60 * 1000);
    firstRun.unref?.();
    interval.unref?.();
};

let automaticBackupSweepRunning = false;
const processAutomaticGoogleDriveBackups = async () => {
    if (automaticBackupSweepRunning) return;
    automaticBackupSweepRunning = true;
    try {
        try { googleDriveClient(); } catch { return; }
        const now = new Date();
        const today = dateKeyInManaus(now);
        const time = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/Manaus', hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(now);
        const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Manaus', weekday: 'short' }).format(now);
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
        const tenants = (await listTenants()).filter((tenant: any) => tenant.active !== false);
        for (const tenant of tenants as any[]) {
            const slug = cleanSlug(tenant.storeSlug);
            const config = await getIntegrationConfig(slug, 'googledrive').catch(() => null);
            if (!config?.enabled || !config?.refreshToken) continue;
            if (config.lastBackupAt && dateKeyInManaus(new Date(config.lastBackupAt)) === today) continue;
            if (String(config.hour || '03:00') > time) continue;
            if (config.frequency === 'weekly' && Number(config.weekday || 0) !== weekday) continue;
            try {
                const result = await performGoogleDriveBackup(slug);
                await writeAudit(slug, { name: 'Backup automático' }, 'BACKUP', 'googledrive', result.fileId);
            } catch (error: any) {
                console.error(`Falha no backup automático da loja ${slug}:`, error?.message || 'erro desconhecido');
                const current = await getIntegrationConfig(slug, 'googledrive').catch(() => null);
                if (current) await upsertStoreRecord(slug, 'integrations', protectIntegrationRecord(slug, {
                    ...current,
                    id: 'googledrive',
                    lastBackupStatus: 'error',
                    lastError: String(error?.message || 'Falha no backup automático.').slice(0, 300),
                    lastAttemptAt: new Date().toISOString(),
                }, current));
            }
        }
    } catch (error) {
        console.error('Falha ao verificar backups automáticos:', error);
    } finally {
        automaticBackupSweepRunning = false;
    }
};

const startAutomaticBackupScheduler = () => {
    const firstRun = setTimeout(() => void processAutomaticGoogleDriveBackups(), 90_000);
    const interval = setInterval(() => void processAutomaticGoogleDriveBackups(), 60 * 60 * 1000);
    firstRun.unref?.();
    interval.unref?.();
};

let automaticCalendarSweepRunning = false;
const processAutomaticCalendarSync = async () => {
    if (automaticCalendarSweepRunning) return;
    automaticCalendarSweepRunning = true;
    try {
        try { googleDriveClient(); } catch { return; }
        const tenants = (await listTenants()).filter((tenant: any) => tenant.active !== false);
        for (const tenant of tenants as any[]) {
            const slug = cleanSlug(tenant.storeSlug);
            const config = await getIntegrationConfig(slug, 'googlecalendar').catch(() => null);
            if (!slug || !config?.enabled) continue;
            try {
                await syncGoogleCalendarForSlug(slug);
            } catch (error: any) {
                console.error(`Falha ao sincronizar Google Agenda da loja ${slug}:`, error?.message || 'erro desconhecido');
            }
        }
    } finally {
        automaticCalendarSweepRunning = false;
    }
};

const startAutomaticCalendarScheduler = () => {
    const firstRun = setTimeout(() => void processAutomaticCalendarSync(), 120_000);
    const interval = setInterval(() => void processAutomaticCalendarSync(), 15 * 60 * 1000);
    firstRun.unref?.();
    interval.unref?.();
};

// Unified notification endpoint
app.post('/api/store/:slug/notify', requireStoreAdmin, async (req, res, next) => {
    try {
        const { channel, to, message, subject, qrCodeBase64, pdfBase64, pdfFilename } = req.body as {
            channel: 'whatsapp' | 'telegram' | 'email';
            to: string;
            message: string;
            subject?: string;
            qrCodeBase64?: string;
            pdfBase64?: string;
            pdfFilename?: string;
        };

        if (!channel || !message) {
            return res.status(400).json({ message: 'channel e message são obrigatórios.' });
        }

        const tenantId = cleanSlug(req.params.slug);

        if (channel === 'whatsapp') {
            if (!to) return res.status(400).json({ message: 'Campo "to" (telefone) é obrigatório para WhatsApp.' });
            if (qrCodeBase64 || pdfBase64) {
                if (qrCodeBase64 && (qrCodeBase64.length > 700_000 || !/^[A-Za-z0-9+/=]+$/.test(qrCodeBase64))) {
                    return res.status(400).json({ message: 'QR Code inválido ou muito grande.' });
                }
                if (pdfBase64 && (pdfBase64.length > 1_500_000 || !/^[A-Za-z0-9+/=]+$/.test(pdfBase64))) {
                    return res.status(400).json({ message: 'PDF inválido ou muito grande.' });
                }
                await sendWhatsAppCharge(tenantId, to, { message, qrCodeBase64, pdfBase64, pdfFilename });
            } else {
                await sendWhatsAppMessage(tenantId, to, message);
            }
        } else if (channel === 'telegram') {
            const telegramConfig = await getIntegrationConfig(tenantId, 'telegram');
            await sendTelegramMessage(telegramConfig, message, to || undefined);
        } else if (channel === 'email') {
            if (!to) return res.status(400).json({ message: 'Campo "to" (e-mail) é obrigatório para E-mail.' });
            if (pdfBase64 && (pdfBase64.length > 2_800_000 || !/^[A-Za-z0-9+/=]+$/.test(pdfBase64))) {
                return res.status(400).json({ message: 'PDF inválido ou muito grande.' });
            }
            const emailConfig = await getIntegrationConfig(tenantId, 'email');
            const safeHtml = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            const tenant = await resolveTenant(tenantId);
            const businessName = String(tenant?.businessName || tenant?.name || 'Feitosa Soluções');
            const premiumHtml = `
                <div style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:Arial,sans-serif;color:#1e293b">
                    <div style="max-width:680px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 35px rgba(15,23,42,.12)">
                        <div style="background:#2441b4;border-bottom:5px solid #0db8dc;padding:26px 32px;color:#ffffff">
                            <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;opacity:.8">Atendimento premium</div>
                            <div style="font-size:24px;font-weight:700;margin-top:5px">${businessName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                        </div>
                        <div style="padding:30px 32px;font-size:15px;line-height:1.65">
                            ${safeHtml}
                            ${pdfBase64 ? '<p style="margin-top:24px;padding:14px 16px;background:#eff6ff;border-left:4px solid #2441b4;border-radius:7px">A sua Ordem de Serviço detalhada segue anexada em PDF.</p>' : ''}
                        </div>
                        <div style="padding:17px 32px;background:#f8fafc;color:#64748b;font-size:12px">Mensagem enviada com segurança pelo sistema ${businessName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}.</div>
                    </div>
                </div>`;
            const attachments = pdfBase64 ? [{
                filename: String(pdfFilename || 'ordem-de-servico.pdf').replace(/[^a-zA-Z0-9._-]/g, '_'),
                content: pdfBase64,
                encoding: 'base64' as const,
                contentType: 'application/pdf',
            }] : [];
            await sendEmail(emailConfig, to, subject || 'Notificação', premiumHtml, attachments);
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
        if (error?.code === '23505' || error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este e-mail já está em uso.' });
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

const nfseConfigSchema = z.object({
    municipalRegistration: z.string().trim().min(1).max(15),
    municipalityCode: z.string().regex(/^\d{7}$/),
    dpsSeries: z.coerce.number().int().min(1).max(49999),
    nextDps: z.coerce.number().int().min(1).max(999999999999999),
    nationalServiceCode: z.string().regex(/^\d{6}$/),
    municipalServiceCode: z.string().regex(/^\d{0,3}$/).optional().default(''),
    simpleNationalStatus: z.coerce.number().int().min(1).max(3),
    simpleNationalTaxRegime: z.coerce.number().int().min(1).max(3).optional().default(1),
    specialTaxRegime: z.coerce.number().int().refine(value => [0, 1, 2, 3, 4, 5, 6, 9].includes(value)),
    issTaxation: z.coerce.number().int().min(1).max(4),
    issWithholding: z.coerce.number().int().min(1).max(3),
    enabled: z.boolean().default(false),
    certificateBase64: z.string().max(4_000_000).optional(),
    certificatePassword: z.string().max(200).optional(),
});

const publicNfseConfig = (config: any) => ({
    id: 'nfse',
    environment: 'homologation',
    baseUrl: NFSE_HOMOLOGATION_BASE_URL,
    enabled: Boolean(config?.enabled),
    municipalRegistration: config?.municipalRegistration || '',
    municipalityCode: config?.municipalityCode || '1302603',
    dpsSeries: Number(config?.dpsSeries || 1),
    nextDps: Number(config?.nextDps || 1),
    nationalServiceCode: config?.nationalServiceCode || '',
    municipalServiceCode: config?.municipalServiceCode || '',
    simpleNationalStatus: Number(config?.simpleNationalStatus || 1),
    simpleNationalTaxRegime: Number(config?.simpleNationalTaxRegime || 1),
    specialTaxRegime: Number(config?.specialTaxRegime || 0),
    issTaxation: Number(config?.issTaxation || 1),
    issWithholding: Number(config?.issWithholding || 1),
    certificateConfigured: Boolean(config?.certificateEncrypted && config?.certificatePasswordEncrypted),
    certificateSubject: config?.certificateSubject || '',
    certificateValidFrom: config?.certificateValidFrom || '',
    certificateValidTo: config?.certificateValidTo || '',
    certificateFingerprint: config?.certificateFingerprint || '',
    lastConnectionAt: config?.lastConnectionAt || '',
    lastConnectionStatus: config?.lastConnectionStatus || '',
});

const getStoredNfseConfig = async (slug: string) => {
    const records = await listStoreRecords(slug, 'integrations');
    return (records || []).find((record: any) => record.id === 'nfse') || null;
};

const getNfseCredentials = (config: any) => {
    if (!nfseSecret) throw new Error('NFSE_SECRET_KEY não configurada no servidor.');
    if (!config?.certificateEncrypted || !config?.certificatePasswordEncrypted) throw new Error('Certificado A1 não configurado.');
    return {
        pfxBase64: decryptNfseSecret(config.certificateEncrypted, nfseSecret),
        passphrase: decryptNfseSecret(config.certificatePasswordEncrypted, nfseSecret),
    };
};

app.get('/api/store/:slug/nfse/config', requireStoreAdmin, async (req, res, next) => {
    try {
        return res.json(publicNfseConfig(await getStoredNfseConfig(cleanSlug(req.params.slug))));
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/fiscal-certificate', requireStoreAdmin, async (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        return res.json(publicFiscalCertificate(await getStoredNfseConfig(cleanSlug(req.params.slug)), nfseSecret.length >= 32));
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/fiscal-certificate', requireStoreAdmin, async (req, res, next) => {
    try {
        if (nfseSecret.length < 32) return res.status(503).json({ message: 'Configure NFSE_SECRET_KEY no servidor com pelo menos 32 caracteres antes de salvar o certificado.' });
        const validation = fiscalCertificateSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ message: 'Selecione um certificado A1 de até 2 MB e informe sua senha.' });
        const { certificateBase64, certificatePassword } = validation.data;
        const fields = prepareFiscalCertificate(certificateBase64, certificatePassword, nfseSecret);
        const slug = cleanSlug(req.params.slug);
        const current = await getStoredNfseConfig(slug) || {};
        const saved = await upsertStoreRecord(slug, 'integrations', {
            ...current, ...fields, id: 'nfse',
            certificateBase64: undefined, certificatePassword: undefined,
            updatedAt: new Date().toISOString(),
        });
        await writeAudit(slug, (req as any).auth, 'UPDATE', 'integrations', 'fiscal-certificate');
        res.setHeader('Cache-Control', 'no-store');
        return res.json(publicFiscalCertificate(saved, true));
    } catch (error: any) {
        if (/certificado|NFSE_SECRET_KEY/i.test(String(error?.message || ''))) return res.status(400).json({ message: error.message });
        return next(error);
    }
});

app.post('/api/store/:slug/nfse/config', requireStoreAdmin, async (req, res, next) => {
    try {
        if (!nfseSecret) return res.status(503).json({ message: 'Configure NFSE_SECRET_KEY no servidor antes de salvar o certificado.' });
        const validation = nfseConfigSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ message: 'Preencha corretamente todos os dados fiscais obrigatórios.' });
        const slug = cleanSlug(req.params.slug);
        const current = await getStoredNfseConfig(slug) || {};
        const input = validation.data;
        let certificateFields = {
            certificateEncrypted: current.certificateEncrypted,
            certificatePasswordEncrypted: current.certificatePasswordEncrypted,
            certificateSubject: current.certificateSubject,
            certificateValidFrom: current.certificateValidFrom,
            certificateValidTo: current.certificateValidTo,
            certificateFingerprint: current.certificateFingerprint,
        };
        if (input.certificateBase64) {
            if (!input.certificatePassword) return res.status(400).json({ message: 'Informe a senha do novo certificado A1.' });
            const pfxBase64 = input.certificateBase64.replace(/^data:[^;]+;base64,/, '');
            certificateFields = prepareFiscalCertificate(pfxBase64, input.certificatePassword, nfseSecret);
        }
        if (input.enabled && !certificateFields.certificateEncrypted) return res.status(400).json({ message: 'Selecione um certificado digital A1 (.pfx ou .p12) antes de habilitar a emissão.' });
        const saved = await upsertStoreRecord(slug, 'integrations', {
            ...current,
            ...input,
            ...certificateFields,
            certificateBase64: undefined,
            certificatePassword: undefined,
            id: 'nfse',
            environment: 'homologation',
            baseUrl: NFSE_HOMOLOGATION_BASE_URL,
            updatedAt: new Date().toISOString(),
        });
        await writeAudit(slug, (req as any).auth, 'UPDATE', 'integrations', 'nfse');
        return res.json(publicNfseConfig(saved));
    } catch (error: any) {
        if (String(error?.message).toLowerCase().includes('certificado') || String(error?.message).includes('NFSE_SECRET_KEY')) return res.status(400).json({ message: error.message });
        return next(error);
    }
});

app.post('/api/store/:slug/nfse/test-connection', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const config = await getStoredNfseConfig(slug);
        if (!config) return res.status(400).json({ message: 'Configure a NFS-e antes de testar a conexão.' });
        const credentials = getNfseCredentials(config);
        const result = await testNfseHomologationConnection(config.municipalityCode, credentials.pfxBase64, credentials.passphrase);
        const connected = result.status >= 200 && result.status < 300;
        await upsertStoreRecord(slug, 'integrations', { ...config, lastConnectionAt: new Date().toISOString(), lastConnectionStatus: connected ? 'connected' : 'failed' });
        if (!connected) return res.status(502).json({ message: `A SEFIN Nacional respondeu com HTTP ${result.status}.`, details: result.data });
        return res.json({ connected: true, environment: 'homologation', municipalityCode: config.municipalityCode });
    } catch (error: any) {
        if (String(error?.message).toLowerCase().includes('certificado') || String(error?.message).includes('NFSE_SECRET_KEY')) return res.status(400).json({ message: error.message });
        return next(error);
    }
});

app.post('/api/store/:slug/nfse/issue/:orderId', requireStoreAdmin, async (req, res, next) => {
    const slug = cleanSlug(req.params.slug);
    try {
        const config = await getStoredNfseConfig(slug);
        if (!config?.enabled) return res.status(400).json({ message: 'Ative a emissão de NFS-e em homologação nas integrações.' });

        const orders = await listStoreRecords(slug, 'service_orders');
        const order = (orders || []).find((item: any) => item.id === req.params.orderId);
        if (!order) return res.status(404).json({ message: 'Ordem de serviço não encontrada.' });
        if (order.orderType === 'Venda Direta') return res.status(400).json({ message: 'Venda direta deve utilizar documento fiscal de produto, não NFS-e.' });
        if (order.nfseHomologation?.status === 'AUTORIZADA') {
            return res.status(409).json({ message: 'Esta ordem já possui uma NFS-e autorizada em homologação.', nfse: order.nfseHomologation });
        }

        const tenant = await resolveTenant(slug);
        if (!tenant) return res.status(404).json({ message: 'Empresa não encontrada.' });
        const customers = await listStoreRecords(slug, 'customers');
        const customer = (customers || []).find((item: any) => item.id === order.customerId);
        const credentials = getNfseCredentials(config);
        const dpsNumber = await reserveNfseDpsNumber(slug);
        if (!dpsNumber) return res.status(409).json({ message: 'Não foi possível reservar o número da DPS.' });

        const dps = buildAndSignDps({
            tenant,
            config,
            order,
            customer,
            dpsNumber,
            pfxBase64: credentials.pfxBase64,
            passphrase: credentials.passphrase,
        });
        const transmission = await transmitDpsToHomologation(dps.signedXml, credentials.pfxBase64, credentials.passphrase);
        const authorized = transmission.status >= 200 && transmission.status < 300 && Boolean(transmission.authorizedXml);
        const accessKey = transmission.authorizedXml.match(/Id=["']NFS([^"']+)["']/)?.[1] || '';
        const nfseNumber = transmission.authorizedXml.match(/<nNFSe>([^<]+)<\/nNFSe>/)?.[1] || '';
        const fiscalXmlValue = (tag: string) => transmission.authorizedXml.match(
            new RegExp(`<(?:[\\w.-]+:)?${tag}[^>]*>([^<]*)<\\/(?:[\\w.-]+:)?${tag}>`),
        )?.[1]?.trim() || '';
        const fiscalNumber = (tag: string) => {
            const raw = fiscalXmlValue(tag);
            return raw === '' ? undefined : Number(raw);
        };
        const issuedAt = new Date().toISOString();
        const documentId = crypto.randomUUID();
        const fiscalDocument = await upsertStoreRecord(slug, 'fiscal_documents', {
            id: documentId,
            type: 'NFSE',
            environment: 'HOMOLOGACAO',
            status: authorized ? 'AUTORIZADA' : 'REJEITADA',
            orderId: order.id,
            dpsId: dps.dpsId,
            dpsNumber,
            dpsSeries: Number(config.dpsSeries),
            serviceTotal: dps.serviceTotal,
            accessKey,
            nfseNumber,
            signedDpsBase64: Buffer.from(dps.signedXml, 'utf8').toString('base64'),
            authorizedXmlBase64: transmission.authorizedXml ? Buffer.from(transmission.authorizedXml, 'utf8').toString('base64') : '',
            responseStatus: transmission.status,
            response: transmission.data,
            issuedAt,
        });
        const nfseSummary = {
            documentId: fiscalDocument?.id || documentId,
            status: authorized ? 'AUTORIZADA' : 'REJEITADA',
            environment: 'HOMOLOGACAO',
            dpsId: dps.dpsId,
            dpsNumber,
            dpsSeries: Number(config.dpsSeries),
            serviceTotal: dps.serviceTotal,
            accessKey,
            nfseNumber,
            issuedAt,
            competence: String(order.completedAt || order.createdAt || issuedAt).slice(0, 10),
            dpsIssuedAt: dps.emittedAt,
            issuerType: 'Prestador',
            purpose: 'NFS-e Normal',
            taxDescription: fiscalXmlValue('xTribMun') || fiscalXmlValue('xTribNac'),
            nbsCode: fiscalXmlValue('cNBS'),
            issBase: fiscalNumber('vBC'),
            issRate: fiscalNumber('pAliq'),
            issValue: fiscalNumber('vISSQN'),
            unconditionalDiscount: fiscalNumber('vDescIncond'),
            conditionalDiscount: fiscalNumber('vDescCond'),
            totalWithheld: fiscalNumber('vTotalRet'),
            netValue: fiscalNumber('vLiq'),
            ibsCbsTotal: (() => {
                const ibs = fiscalNumber('vIBSTot');
                const cbs = fiscalNumber('vCBS');
                return ibs === undefined && cbs === undefined ? undefined : Number(ibs || 0) + Number(cbs || 0);
            })(),
            totalWithIbsCbs: fiscalNumber('vTotNF'),
            complementaryInfo: fiscalXmlValue('xOutInf'),
        };
        await upsertStoreRecord(slug, 'service_orders', { ...order, nfseHomologation: nfseSummary });
        await writeAudit(slug, (req as any).auth, authorized ? 'AUTHORIZE' : 'REJECT', 'fiscal_documents', documentId);

        if (!authorized) {
            return res.status(422).json({
                message: 'A NFS-e não foi autorizada no ambiente de homologação.',
                nfse: nfseSummary,
                details: transmission.data,
            });
        }
        return res.status(201).json({ message: 'NFS-e autorizada no ambiente de homologação.', nfse: nfseSummary });
    } catch (error: any) {
        const message = String(error?.message || '');
        if (/CNPJ|código|série|serviço|certificado|NFSE_SECRET_KEY|DPS/i.test(message)) return res.status(400).json({ message });
        return next(error);
    }
});

app.get('/api/store/:slug/agenda/events', requireStoreUser, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        if (['admin', 'gerente', 'saas-admin'].includes(String((req as any).auth?.role || ''))) {
            return res.json(await calendarEventsForSlug(slug));
        }
        const appointments = await listStoreRecords(slug, 'appointments') || [];
        return res.json((appointments as any[]).map(item => ({ ...item, source: item.source || 'appointment', readOnly: false })));
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/google/calendar/status', requireStoreUser, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const [driveConfig, calendarConfig] = await Promise.all([
            getIntegrationConfig(slug, 'googledrive').catch(() => null),
            getIntegrationConfig(slug, 'googlecalendar').catch(() => null),
        ]);
        let serverConfigured = true;
        try { googleDriveClient(); } catch { serverConfigured = false; }
        return res.json({
            serverConfigured,
            connected: Boolean(driveConfig?.refreshToken),
            enabled: Boolean(calendarConfig?.enabled),
            calendarId: calendarConfig?.calendarId || 'primary',
            timeZone: calendarConfig?.timeZone || 'America/Manaus',
            lastSyncAt: calendarConfig?.lastSyncAt || '',
            lastSyncStatus: calendarConfig?.lastSyncStatus || '',
            lastSyncCount: Number(calendarConfig?.lastSyncCount || 0),
            lastRemovedCount: Number(calendarConfig?.lastRemovedCount || 0),
            lastError: calendarConfig?.lastError || '',
        });
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/google/calendar/connect', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const authUrl = createGoogleDriveAuthorizationUrl(googleDriveClient(), signGoogleDriveState(slug, 'agenda'));
        return res.json({ authUrl });
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/google/status', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const [driveConfig, calendarConfig] = await Promise.all([
            getIntegrationConfig(slug, 'googledrive').catch(() => null),
            getIntegrationConfig(slug, 'googlecalendar').catch(() => null),
        ]);
        let serverConfigured = true;
        try { googleDriveClient(); } catch { serverConfigured = false; }
        return res.json({
            serverConfigured,
            connected: Boolean(driveConfig?.refreshToken),
            connectedAt: driveConfig?.connectedAt || '',
            driveEnabled: Boolean(driveConfig?.enabled),
            calendarEnabled: Boolean(calendarConfig?.enabled),
            lastBackupAt: driveConfig?.lastBackupAt || '',
            lastSyncAt: calendarConfig?.lastSyncAt || '',
        });
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/google/connect', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const authUrl = createGoogleDriveAuthorizationUrl(googleDriveClient(), signGoogleDriveState(slug, 'integracoes'));
        return res.json({ authUrl });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/google/disconnect', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        await deleteStoreRecord(slug, 'integrations', 'googledrive');
        const calendar = await getIntegrationConfig(slug, 'googlecalendar').catch(() => null);
        if (calendar) await upsertStoreRecord(slug, 'integrations', {
            ...calendar, id: 'googlecalendar', enabled: false, disconnectedAt: new Date().toISOString(),
        });
        await writeAudit(slug, (req as any).auth, 'DISCONNECT', 'integrations', 'google');
        return res.json({ disconnected: true });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/google/calendar/settings', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const driveConfig = await getIntegrationConfig(slug, 'googledrive').catch(() => null);
        if (!driveConfig?.refreshToken) return res.status(400).json({ message: 'Conecte a conta Google desta empresa primeiro.' });
        const current = await getIntegrationConfig(slug, 'googlecalendar').catch(() => null) || {};
        const calendarId = String(req.body?.calendarId || 'primary').trim().slice(0, 250) || 'primary';
        const saved = await upsertStoreRecord(slug, 'integrations', {
            ...current,
            id: 'googlecalendar',
            enabled: Boolean(req.body?.enabled),
            calendarId,
            timeZone: 'America/Manaus',
            updatedAt: new Date().toISOString(),
        });
        await writeAudit(slug, (req as any).auth, 'UPDATE', 'calendar', 'googlecalendar');
        if (saved.enabled) scheduleCalendarSync(slug);
        return res.json({ enabled: Boolean(saved.enabled), calendarId, timeZone: 'America/Manaus' });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/google/calendar/sync', requireStoreAdmin, async (req, res, next) => {
    const slug = cleanSlug(req.params.slug);
    try {
        const result = await syncGoogleCalendarForSlug(slug);
        await writeAudit(slug, (req as any).auth, 'SYNC', 'calendar', 'googlecalendar');
        return res.json(result);
    } catch (error: any) {
        const current = await getIntegrationConfig(slug, 'googlecalendar').catch(() => null);
        if (current) await upsertStoreRecord(slug, 'integrations', {
            ...current, id: 'googlecalendar', lastSyncStatus: 'error',
            lastError: String(error?.message || 'Falha ao sincronizar.').slice(0, 300),
            lastAttemptAt: new Date().toISOString(),
        });
        return next(error);
    }
});

app.get('/api/store/:slug/:collection', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        const records = await listStoreRecords(cleanSlug(req.params.slug), req.params.collection);
        if (!records) return res.status(404).json({ message: 'Loja não encontrada.' });
        if (req.params.collection === 'integrations') {
            const slug = cleanSlug(req.params.slug);
            const safeRecords = [];
            for (const record of records as any[]) {
                const protectedRecord = protectIntegrationRecord(slug, record, record);
                if (JSON.stringify(protectedRecord) !== JSON.stringify(record)) {
                    await upsertStoreRecord(slug, 'integrations', protectedRecord);
                }
                safeRecords.push(sanitizeIntegrationRecord(protectedRecord));
            }
            return res.json(safeRecords);
        }
        return res.json(records);
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/:collection', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Dados inválidos.' });
        if (req.params.collection === 'integrations' && req.body.id === 'nfse') return res.status(400).json({ message: 'Use a configuração fiscal protegida da NFS-e.' });
        const slug = cleanSlug(req.params.slug);
        let input = req.body;
        if (['sales', 'service_orders'].includes(req.params.collection)) input = { ...input, installments: reconcileInstallments(input) };
        if (req.params.collection === 'integrations') {
            const currentRecords = await listStoreRecords(slug, 'integrations') || [];
            const current = (currentRecords as any[]).find(record => record.id === req.body.id) || {};
            input = protectIntegrationRecord(slug, req.body, current);
        }
        const record = req.params.collection === 'service_orders'
            ? await upsertServiceOrderWithStock(slug, input)
            : await upsertStoreRecord(slug, req.params.collection, input);
        if (!record) return res.status(404).json({ message: 'Loja não encontrada.' });
        if (req.params.collection === 'sales') await syncSalePaymentToServiceOrder(slug, record);
        await writeAudit(cleanSlug(req.params.slug), (req as any).auth, 'CREATE', req.params.collection, record.id);
        if (['appointments', 'sales', 'expenses'].includes(req.params.collection)) scheduleCalendarSync(slug);
        return res.status(201).json(req.params.collection === 'integrations' ? sanitizeIntegrationRecord(record) : record);
    }
    catch (error: any) {
        if (req.params.collection === 'service_orders' && /estoque|peça/i.test(String(error?.message || ''))) {
            return res.status(409).json({ message: String(error.message) });
        }
        return next(error);
    }
});

app.put('/api/store/:slug/:collection/:id', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Dados inválidos.' });
        if (req.params.collection === 'integrations' && req.params.id === 'nfse') return res.status(400).json({ message: 'Use a configuração fiscal protegida da NFS-e.' });
        const slug = cleanSlug(req.params.slug);
        let input = { ...req.body, id: req.params.id };
        if (['sales', 'service_orders'].includes(req.params.collection)) input = { ...input, installments: reconcileInstallments(input) };
        if (req.params.collection === 'integrations') {
            const currentRecords = await listStoreRecords(slug, 'integrations') || [];
            const current = (currentRecords as any[]).find(record => record.id === req.params.id) || {};
            input = protectIntegrationRecord(slug, input, current);
        }
        const record = req.params.collection === 'service_orders'
            ? await upsertServiceOrderWithStock(slug, input)
            : await upsertStoreRecord(slug, req.params.collection, input);
        if (!record) return res.status(404).json({ message: 'Loja não encontrada.' });
        if (req.params.collection === 'sales') await syncSalePaymentToServiceOrder(slug, record);
        await writeAudit(cleanSlug(req.params.slug), (req as any).auth, 'UPDATE', req.params.collection, record.id);
        if (['appointments', 'sales', 'expenses'].includes(req.params.collection)) scheduleCalendarSync(slug);
        return res.json(req.params.collection === 'integrations' ? sanitizeIntegrationRecord(record) : record);
    }
    catch (error: any) {
        if (req.params.collection === 'service_orders' && /estoque|peça/i.test(String(error?.message || ''))) {
            return res.status(409).json({ message: String(error.message) });
        }
        return next(error);
    }
});

app.delete('/api/store/:slug/:collection/:id', requireStoreUser, requireCollectionAccess, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        if (req.params.collection === 'integrations' && req.params.id === 'nfse') return res.status(400).json({ message: 'A configuração fiscal deve ser desativada, não excluída pela rota comum.' });
        const deletion = req.params.collection === 'service_orders'
            ? await deleteServiceOrderWithStock(slug, req.params.id)
            : { deleted: await deleteStoreRecord(slug, req.params.collection, req.params.id), returnedItems: 0 };
        if (deletion?.deleted) await writeAudit(slug, (req as any).auth, 'DELETE', req.params.collection, req.params.id);
        if (deletion?.deleted && ['appointments', 'sales', 'expenses', 'service_orders'].includes(req.params.collection)) scheduleCalendarSync(slug);
        return res.json(deletion || { deleted: false, returnedItems: 0 });
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

const sendPixThankYou = async (slug: string, order: any, paymentId: string, paidAmount: number) => {
    if (!order?.clientPhone || order.whatsappThankYouSentAt) return false;
    try {
        const records = await listStoreRecords(slug, 'integrations');
        const saved = (records || []).find((record: any) => record.id === 'whatsapp_templates') || {};
        const templates = { ...defaultWhatsAppTemplates, ...saved };
        if (!templates.paymentConfirmedEnabled) return false;
        const message = applyWhatsAppTemplate(templates.paymentConfirmed, {
            cliente: order.clientName || 'Cliente',
            valor: paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            numero: String(order.id || '').slice(0, 8).toUpperCase(),
            status: 'Pago',
            empresa: '',
            pix: '',
            titulo: 'Pagamento confirmado',
        });
        await sendWhatsAppMessage(slug, order.clientPhone, message);
        await upsertStoreRecord(slug, 'service_orders', {
            ...order,
            status: 'Pago',
            paymentStatus: 'Pago',
            paid: true,
            paidAt: order.paidAt || new Date().toISOString(),
            paidValue: paidAmount,
            paymentMethod: 'Pix / Mercado Pago',
            mercadoPagoPaymentId: paymentId,
            whatsappThankYouSentAt: new Date().toISOString(),
        });
        return true;
    } catch {
        return false;
    }
};

// Salvar configuração do Mercado Pago e webhook
app.post('/api/store/:slug/mercadopago/config', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const current = await getIntegrationConfig(slug, 'mercadopago') || {};
        const suppliedAccessToken = String(req.body.accessToken || '');
        const suppliedWebhookSecret = String(req.body.webhookSecret || '');
        const accessToken = suppliedAccessToken.startsWith('•') ? current.accessToken : suppliedAccessToken;
        const webhookSecret = suppliedWebhookSecret.startsWith('•') ? current.webhookSecret : suppliedWebhookSecret;
        const publicBaseUrl = normalizePublicBaseUrl(req.body.publicBaseUrl);
        const enabled = req.body.enabled !== false;

        if (!accessToken) return res.status(400).json({ message: 'Access Token é obrigatório.' });
        if (publicBaseUrl && !validPublicBaseUrl(publicBaseUrl)) {
            return res.status(400).json({ message: 'Informe uma URL pública HTTPS válida, sem localhost.' });
        }

        const webhookUrl = publicBaseUrl ? `${publicBaseUrl}/api/public/${slug}/mercadopago/webhook` : '';
        const autoReconciliationEnabled = Boolean(webhookSecret && webhookUrl);
        const storedConfig = protectIntegrationRecord(slug, {
            ...current,
            id: 'mercadopago',
            accessToken,
            webhookSecret,
            publicBaseUrl,
            webhookUrl,
            sandbox: !!req.body.sandbox,
            enabled,
            autoReconciliationEnabled,
            updatedAt: new Date().toISOString()
        }, {});
        await upsertStoreRecord(slug, 'integrations', storedConfig);
        return res.json({ ok: true, enabled, webhookUrl, autoReconciliationEnabled });
    } catch (error) { return next(error); }
});

// Gerar link de pagamento
app.post('/api/store/:slug/mercadopago/preference', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const mpConfig = await getIntegrationConfig(slug, 'mercadopago');

        if (!mpConfig?.accessToken || mpConfig.enabled === false) {
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
        const mpConfig = await getIntegrationConfig(slug, 'mercadopago');
        if (!mpConfig?.accessToken || mpConfig.enabled === false) {
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

app.get('/api/store/:slug/mercadopago/payments/latest', requireStoreAdmin, async (req, res) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const mpConfig = await getIntegrationConfig(slug, 'mercadopago');
        if (!mpConfig?.accessToken || mpConfig.enabled === false) {
            return res.status(400).json({ message: 'Mercado Pago não configurado.' });
        }

        const transactions = await listStoreRecords(slug, 'payment_transactions') || [];
        const latest = transactions
            .filter((item: any) => item.referenceType === 'test' && (item.paymentId || item.id))
            .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
        if (!latest) return res.status(404).json({ message: 'Nenhum pagamento de teste encontrado.' });

        const paymentId = String(latest.paymentId || latest.id);
        const payment = await getMPPayment(mpConfig.accessToken, paymentId);
        const status = String(payment.status || 'unknown');
        return res.json({
            paymentId,
            status,
            approved: status === 'approved',
            paidAt: payment.date_approved || null,
            paidAmount: Number(payment.transaction_amount) || Number(latest.expectedAmount) || 0,
            description: String(payment.description || 'Pagamento PIX'),
        });
    } catch (error: any) {
        return res.status(500).json({ message: String(error?.message || 'Erro ao consultar último pagamento') });
    }
});

app.get('/api/store/:slug/mercadopago/payments/:paymentId/status', requireStoreAdmin, async (req, res) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const paymentId = String(req.params.paymentId || '').trim();
        if (!/^\d+$/.test(paymentId)) {
            return res.status(400).json({ message: 'Identificador do pagamento inválido.' });
        }

        const mpConfig = await getIntegrationConfig(slug, 'mercadopago');
        if (!mpConfig?.accessToken || mpConfig.enabled === false) {
            return res.status(400).json({ message: 'Mercado Pago não configurado.' });
        }

        const payment = await getMPPayment(mpConfig.accessToken, paymentId);
        const status = String(payment.status || 'unknown');
        const paymentMethod = String(payment.payment_method_id || '');
        const paidAmount = Number(payment.transaction_amount) || 0;
        const paidAt = payment.date_approved || new Date().toISOString();
        const transactions = await listStoreRecords(slug, 'payment_transactions') || [];
        const transaction = transactions.find((item: any) => String(item.paymentId || item.id) === paymentId);
        if (transaction) {
            let reconciliationStatus = status === 'approved' && transaction.referenceType === 'test'
                ? 'completed'
                : transaction.reconciliationStatus;

            if (status === 'approved' && paymentMethod === 'pix' && transaction.referenceType === 'service_order') {
                const expectedAmount = Number(transaction.expectedAmount) || 0;
                if (expectedAmount > 0 && Math.abs(expectedAmount - paidAmount) <= 0.01) {
                    const orders = await listStoreRecords(slug, 'service_orders') || [];
                    const order = orders.find((item: any) => item.id === transaction.externalReference);
                    if (order) {
                        await upsertStoreRecord(slug, 'service_orders', {
                            ...order,
                            status: 'Pago',
                            paymentStatus: 'Pago',
                            paid: true,
                            paidAt,
                            paidValue: paidAmount,
                            paymentMethod: 'Pix / Mercado Pago',
                            mercadoPagoPaymentId: paymentId,
                        });
                        await sendPixThankYou(slug, { ...order, status: 'Pago', paymentStatus: 'Pago' }, paymentId, paidAmount);
                        reconciliationStatus = 'completed';
                    }
                }
            }

            await upsertStoreRecord(slug, 'payment_transactions', {
                ...transaction,
                paymentId,
                status,
                paymentStatus: status,
                paymentMethod,
                paidAmount,
                paidAt: status === 'approved' ? paidAt : transaction.paidAt,
                reconciliationStatus,
                updatedAt: new Date().toISOString(),
            });
        }

        return res.json({
            paymentId,
            status,
            statusDetail: String(payment.status_detail || ''),
            approved: status === 'approved',
            paymentMethod,
            paidAmount,
            paidAt: payment.date_approved || null,
        });
    } catch (error: any) {
        const message = String(error?.message || 'Erro ao consultar pagamento');
        return res.status(500).json({ message });
    }
});

app.post('/api/public/:slug/mercadopago/webhook', async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const notificationType = String(req.query.type || req.body?.type || '');
        if (notificationType && notificationType !== 'payment') return res.sendStatus(200);

        const mpConfig = await getIntegrationConfig(slug, 'mercadopago');
        if (!mpConfig?.accessToken || mpConfig.enabled === false || !mpConfig?.webhookSecret) return res.sendStatus(503);

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
            if (transaction.referenceType === 'service_order') {
                const orders = await listStoreRecords(slug, 'service_orders') || [];
                const order = orders.find((item: any) => item.id === externalReference);
                if (order) await sendPixThankYou(slug, order, paymentId, paidAmount);
            }
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
                    status: 'Pago',
                    paymentStatus: 'Pago',
                    paid: true,
                    paidAt,
                    paidValue: paidAmount,
                    paymentMethod: 'Pix / Mercado Pago',
                    mercadoPagoPaymentId: paymentId
                });
                await sendPixThankYou(slug, { ...order, status: 'Pago', paymentStatus: 'Pago' }, paymentId, paidAmount);
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

// Backup completo, restauração transacional e Google Drive
app.get('/api/store/:slug/backup/download', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const backup = await buildBackupForSlug(slug);
        res.setHeader('Content-Disposition', `attachment; filename="backup-${slug}-${new Date().toISOString().slice(0, 10)}.json"`);
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(backup, null, 2));
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/backup/validate', requireStoreAdmin, async (req, res) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const validated = validateBackupDocument(req.body?.backup, slug, dataEncryptionSecret);
        return res.json({
            valid: true,
            exportedAt: validated.exportedAt,
            legacy: validated.legacy,
            totals: Object.fromEntries(Object.entries(validated.collections).map(([key, records]) => [key, (records as any[]).length])),
            warning: validated.legacy ? 'Backup antigo: somente os módulos presentes no arquivo serão restaurados.' : '',
        });
    } catch (error: any) {
        return res.status(400).json({ message: error?.message || 'Arquivo de backup inválido.' });
    }
});

app.post('/api/store/:slug/backup/restore', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        if (String(req.body?.confirmation || '') !== `RESTAURAR ${slug}`) {
            return res.status(400).json({ message: `Digite RESTAURAR ${slug} para confirmar.` });
        }
        const validated = validateBackupDocument(req.body?.backup, slug, dataEncryptionSecret);
        const collections = await prepareRestoredCollections(slug, validated.collections);
        await replaceStoreCollections(slug, collections, validated.profile);
        await writeAudit(slug, (req as any).auth, 'RESTORE', 'backup', String(validated.exportedAt || ''));
        return res.json({ message: 'Backup restaurado com sucesso.', restoredAt: new Date().toISOString() });
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/backup/status', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const config = await getIntegrationConfig(slug, 'googledrive').catch(() => null);
        let serverConfigured = true;
        try { googleDriveClient(); } catch { serverConfigured = false; }
        return res.json({
            serverConfigured,
            connected: Boolean(config?.refreshToken),
            enabled: Boolean(config?.enabled),
            frequency: config?.frequency || 'daily',
            hour: config?.hour || '03:00',
            weekday: Number(config?.weekday ?? 0),
            lastBackupAt: config?.lastBackupAt || '',
            lastBackupStatus: config?.lastBackupStatus || '',
            lastError: config?.lastError || '',
        });
    } catch (error) { return next(error); }
});

app.get('/api/store/:slug/backup/google/connect', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const authUrl = createGoogleDriveAuthorizationUrl(googleDriveClient(), signGoogleDriveState(slug));
        return res.json({ authUrl });
    } catch (error) { return next(error); }
});

app.get('/api/backup/google/callback', async (req, res) => {
    let slug = '';
    let returnTo: GoogleReturnTarget = 'backup';
    try {
        ({ slug, returnTo } = verifyGoogleDriveState(String(req.query.state || '')));
        if (req.query.error) throw new Error('A autorização do Google Drive foi cancelada.');
        const tokens = await exchangeGoogleDriveCode(googleDriveClient(), String(req.query.code || ''));
        if (!tokens.refresh_token) throw new Error('O Google não forneceu autorização permanente. Tente conectar novamente.');
        const current = await getIntegrationConfig(slug, 'googledrive').catch(() => null) || {};
        await upsertStoreRecord(slug, 'integrations', protectIntegrationRecord(slug, {
            ...current,
            id: 'googledrive',
            connected: true,
            refreshToken: tokens.refresh_token,
            frequency: current.frequency || 'daily',
            hour: current.hour || '03:00',
            weekday: Number(current.weekday ?? 0),
            connectedAt: new Date().toISOString(),
        }, current));
        if (returnTo === 'agenda' || returnTo === 'integracoes') {
            const currentCalendar = await getIntegrationConfig(slug, 'googlecalendar').catch(() => null) || {};
            await upsertStoreRecord(slug, 'integrations', {
                ...currentCalendar,
                id: 'googlecalendar', enabled: true,
                calendarId: currentCalendar.calendarId || 'primary',
                timeZone: currentCalendar.timeZone || 'America/Manaus',
                connectedAt: new Date().toISOString(),
            });
            scheduleCalendarSync(slug);
        }
        return res.redirect(`/admin/${returnTo}?google=connected`);
    } catch (error: any) {
        const message = encodeURIComponent(error?.message || 'Falha ao conectar ao Google Drive.');
        return res.redirect(`/admin/${returnTo}?google=error&message=${message}`);
    }
});

app.post('/api/store/:slug/backup/google/settings', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const current = await getIntegrationConfig(slug, 'googledrive');
        if (!current?.refreshToken) return res.status(400).json({ message: 'Conecte o Google Drive primeiro.' });
        const frequency = req.body?.frequency === 'weekly' ? 'weekly' : 'daily';
        const hour = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(req.body?.hour || '')) ? String(req.body.hour) : '03:00';
        const weekday = Math.min(6, Math.max(0, Number(req.body?.weekday || 0)));
        const saved = protectIntegrationRecord(slug, {
            ...current, id: 'googledrive', enabled: Boolean(req.body?.enabled), frequency, hour, weekday,
        }, current);
        await upsertStoreRecord(slug, 'integrations', saved);
        await writeAudit(slug, (req as any).auth, 'UPDATE', 'backup', 'googledrive');
        return res.json({ enabled: saved.enabled, frequency, hour, weekday });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/backup/google/run', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const result = await performGoogleDriveBackup(slug);
        await writeAudit(slug, (req as any).auth, 'BACKUP', 'googledrive', result.fileId);
        return res.json(result);
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/backup/google/disconnect', requireStoreAdmin, async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        await deleteStoreRecord(slug, 'integrations', 'googledrive');
        const calendar = await getIntegrationConfig(slug, 'googlecalendar').catch(() => null);
        if (calendar) await upsertStoreRecord(slug, 'integrations', {
            ...calendar, id: 'googlecalendar', enabled: false, disconnectedAt: new Date().toISOString(),
        });
        await writeAudit(slug, (req as any).auth, 'DISCONNECT', 'backup', 'googledrive');
        return res.json({ disconnected: true });
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
app.get('/sw.js', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(path.join(distPath, 'sw.js'));
});
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

initializationPromise = initializeDatabases().then(() => { databaseReady = true; });
void initializationPromise.then(() => restoreWhatsAppSessions());
void initializationPromise.then(() => startPaymentReminderScheduler());
void initializationPromise.then(() => startAutomaticBackupScheduler());
void initializationPromise.then(() => startAutomaticCalendarScheduler());
void initializationPromise.catch((error) => {
    console.error('Falha ao iniciar o servidor:', error);
});
const server = app.listen(port, '0.0.0.0', () => console.log(`Feitosa Soluções disponível na porta ${port}`));
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 60_000;
