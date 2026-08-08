import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
    authenticateStoreAdmin,
    authenticateCustomer,
    createTenant,
    deleteStoreRecord,
    initializeDatabases,
    listStoreRecords,
    listTenants,
    resolveTenant,
    registerCustomer,
    setTenantStatus,
    updateTenantBySlug,
    updateTenantRecord,
    upsertStoreRecord
} from './database.js';
import { createToken, verifyToken } from './auth.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const masterUser = process.env.SAAS_ADMIN_USER || 'gestor';
const masterPassword = process.env.SAAS_ADMIN_PASSWORD || 'admin123';
const tokenSecret = process.env.SAAS_TOKEN_SECRET || `${masterPassword}:gtec-saas`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

const tokenFromRequest = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const requireMaster = (req, res, next) => {
    const payload = verifyToken(tokenFromRequest(req), tokenSecret);
    if (!payload || payload.role !== 'saas-admin') return res.status(401).json({ message: 'Acesso não autorizado.' });
    req.auth = payload;
    next();
};

const requireStoreAdmin = (req, res, next) => {
    const payload = verifyToken(tokenFromRequest(req), tokenSecret);
    if (!payload || (payload.role !== 'saas-admin' && (payload.role !== 'admin' || payload.storeSlug !== req.params.slug))) {
        return res.status(401).json({ message: 'Acesso não autorizado.' });
    }
    req.auth = payload;
    next();
};

const cleanSlug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/saas/login', (req, res) => {
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
        const storeSlug = cleanSlug(req.body.storeSlug || req.body.businessName);
        if (!req.body.businessName || !storeSlug || !req.body.email || !req.body.adminPassword) {
            return res.status(400).json({ message: 'Nome, identificador, e-mail e senha administrativa são obrigatórios.' });
        }
        const tenant = await createTenant({ ...req.body, storeSlug });
        return res.status(201).json(tenant);
    } catch (error) {
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

app.post('/api/store/:slug/login', async (req, res, next) => {
    try {
        const slug = cleanSlug(req.params.slug);
        const user = await authenticateStoreAdmin(slug, req.body.username, req.body.password);
        if (!user) return res.status(401).json({ message: 'Credenciais inválidas.' });
        return res.json({ user, token: createToken(user, tokenSecret) });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/customer/register', async (req, res, next) => {
    try {
        if (!req.body.name || !req.body.email || !req.body.password) return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
        const user = await registerCustomer(cleanSlug(req.params.slug), req.body.name, req.body.email, req.body.password);
        if (!user) return res.status(404).json({ message: 'Loja não encontrada.' });
        if (user.conflict) return res.status(409).json({ message: 'E-mail já cadastrado.' });
        return res.status(201).json({ user, token: createToken(user, tokenSecret) });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/customer/login', async (req, res, next) => {
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

app.post('/api/store/:slug/sales', async (req, res, next) => {
    try { return res.status(201).json(await upsertStoreRecord(cleanSlug(req.params.slug), 'sales', req.body)); }
    catch (error) { return next(error); }
});

app.get('/api/store/:slug/:collection', async (req, res, next) => {
    try {
        const records = await listStoreRecords(cleanSlug(req.params.slug), req.params.collection);
        return records ? res.json(records) : res.status(404).json({ message: 'Loja não encontrada.' });
    } catch (error) { return next(error); }
});

app.post('/api/store/:slug/:collection', requireStoreAdmin, async (req, res, next) => {
    try { return res.status(201).json(await upsertStoreRecord(cleanSlug(req.params.slug), req.params.collection, req.body)); }
    catch (error) { return next(error); }
});

app.put('/api/store/:slug/:collection/:id', requireStoreAdmin, async (req, res, next) => {
    try { return res.json(await upsertStoreRecord(cleanSlug(req.params.slug), req.params.collection, { ...req.body, id: req.params.id })); }
    catch (error) { return next(error); }
});

app.delete('/api/store/:slug/:collection/:id', requireStoreAdmin, async (req, res, next) => {
    try { return res.json({ deleted: await deleteStoreRecord(cleanSlug(req.params.slug), req.params.collection, req.params.id) }); }
    catch (error) { return next(error); }
});

app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(distPath, { maxAge: '1h', index: false }));

app.use((error, _req, res, _next) => {
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
