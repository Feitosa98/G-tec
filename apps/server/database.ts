import crypto from 'node:crypto';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { products as initialProducts } from '../web/src/data/products.js';
import { hashPassword, passwordNeedsRehash, verifyPassword } from './auth.js';

const databasePassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '';
if (process.env.NODE_ENV === 'production' && !databasePassword) {
    throw new Error('DB_PASSWORD deve ser definido em produção.');
}

const configuredDatabaseHost = process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1';
// No Node 22, `localhost` pode resolver para ::1. O MySQL da hospedagem
// compartilhada autoriza a aplicação pela interface IPv4 local.
const databaseHost = configuredDatabaseHost === 'localhost' ? '127.0.0.1' : configuredDatabaseHost;
const databaseConnectionLimit = Math.min(30, Math.max(5, Number(process.env.DB_CONNECTION_LIMIT || 12)));
const databaseMaxIdle = Math.min(databaseConnectionLimit, Math.max(3, Number(process.env.DB_MAX_IDLE || 8)));

const pool: Pool = mysql.createPool({
    host: databaseHost,
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'gtec',
    password: databasePassword || 'local-development-database-password',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'gtec',
    waitForConnections: true,
    connectionLimit: databaseConnectionLimit,
    queueLimit: 0,
    maxIdle: databaseMaxIdle,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4',
    timezone: 'Z'
});

const allowedCollections = new Set([
    'products', 'sales', 'expenses', 'customers', 'receivables', 'services',
    'service_orders', 'subscriptions', 'integrations', 'payment_transactions',
    'suppliers', 'stock_movements', 'appointments', 'audit_log', 'fiscal_documents', 'purchase_invoices'
]);

const defaultProfile = {
    businessName: 'Feitosa Soluções em Informática', legalName: 'IAGO DA SILVA FEITOSA',
    shortName: 'Feitosa Soluções', storeSlug: 'gtec-informatica', logoUrl: '/logo.png',
    document: '35.623.245/0001-50', email: 'contato@gtecinformatica.com.br', billingEmail: '',
    whatsapp: '5592992800023', phone: '', street: '', addressNumber: '', neighborhood: '',
    city: 'Manaus', state: 'AM', postalCode: '', address: 'Manaus - AM', customDomain: '',
    primaryColor: '#0052cc', accentColor: '#d4a024', backgroundColor: '#0a0e1a', cardColor: '#12182b'
};

const newTenantProfileDefaults = {
    legalName: '', logoUrl: '', document: '', billingEmail: '', whatsapp: '', phone: '', street: '',
    addressNumber: '', neighborhood: '', city: '', state: '', postalCode: '', address: '', customDomain: '',
    primaryColor: '#2563eb', accentColor: '#f59e0b', backgroundColor: '#0f172a', cardColor: '#1e293b'
};

type TenantRow = RowDataPacket & {
    id: string; store_slug: string; database_name: string; profile: unknown;
    active: number | boolean; created_at: Date; updated_at: Date;
};
type UserRow = RowDataPacket & {
    id: string; tenant_id: string; name: string; username: string; email: string;
    password_hash: string; role: string; created_at: Date; store_slug?: string;
};

type SessionRow = RowDataPacket & { payload: unknown; expires_at: Date };

const TENANT_CACHE_TTL_MS = 60_000;
const SESSION_CACHE_TTL_MS = 30_000;
const MAX_TENANT_CACHE_ENTRIES = 1_000;
const MAX_SESSION_CACHE_ENTRIES = 5_000;
const tenantCache = new Map<string, { value: TenantRow | null; expiresAt: number }>();
const sessionCache = new Map<string, { payload: any | null; expiresAt: number; userId: string; tenantId?: string }>();
const sessionLookupPromises = new Map<string, Promise<any | null>>();

const trimCache = <T>(cache: Map<string, T>, maximum: number) => {
    while (cache.size > maximum) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        cache.delete(oldestKey);
    }
};

const invalidateTenantCache = (slug?: string) => {
    if (slug) tenantCache.delete(slug);
    else tenantCache.clear();
};

const parseJson = <T = any>(value: unknown): T => {
    if (typeof value === 'string') return JSON.parse(value) as T;
    return (value || {}) as T;
};
const logicalDatabaseName = (slug: string, id: string) =>
    `store_${slug.replace(/[^a-z0-9]/g, '_').slice(0, 32)}_${id.replace(/-/g, '').slice(0, 8)}`;
const mapTenant = (row: TenantRow) => ({
    id: row.id, databaseName: row.database_name, active: Boolean(row.active),
    createdAt: row.created_at, updatedAt: row.updated_at, ...parseJson(row.profile)
});
const mapPublicTenant = (row: TenantRow) => {
    const tenant = mapTenant(row) as any;
    delete tenant.databaseName;
    return tenant;
};
const tenantBySlug = async (slug: string, includeInactive = false, connection: Pool | PoolConnection = pool) => {
    const cacheable = !includeInactive && connection === pool;
    if (cacheable) {
        const cached = tenantCache.get(slug);
        if (cached && cached.expiresAt > Date.now()) return cached.value;
        if (cached) tenantCache.delete(slug);
    }
    const [rows] = await connection.execute<TenantRow[]>(
        `SELECT * FROM tenants WHERE store_slug = ? ${includeInactive ? '' : 'AND active = TRUE'} LIMIT 1`, [slug]
    );
    const value = rows[0] || null;
    if (cacheable) {
        tenantCache.set(slug, { value, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
        trimCache(tenantCache, MAX_TENANT_CACHE_ENTRIES);
    }
    return value;
};
const tenantByDatabaseName = async (databaseName: string) => {
    const [rows] = await pool.execute<TenantRow[]>('SELECT * FROM tenants WHERE database_name = ? LIMIT 1', [databaseName]);
    return rows[0] || null;
};

export const waitForDatabase = async () => {
    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try { await pool.query('SELECT 1'); return; }
        catch (error) {
            if (attempt === 30) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

const createTables = async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(36) PRIMARY KEY, store_slug VARCHAR(100) NOT NULL UNIQUE,
        database_name VARCHAR(100) NOT NULL UNIQUE, profile JSON NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.query(`CREATE TABLE IF NOT EXISTS store_records (
        tenant_id VARCHAR(36) NOT NULL, collection VARCHAR(64) NOT NULL,
        record_id VARCHAR(100) NOT NULL, data JSON NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (tenant_id, collection, record_id),
        INDEX idx_store_records_order (tenant_id, collection, created_at),
        CONSTRAINT fk_store_records_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.query(`CREATE TABLE IF NOT EXISTS store_users (
        id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, name VARCHAR(180) NOT NULL,
        username VARCHAR(190) NOT NULL, email VARCHAR(190) NOT NULL DEFAULT '',
        password_hash VARCHAR(255) NOT NULL, role VARCHAR(32) NOT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_store_users_tenant_username (tenant_id, username),
        INDEX idx_store_users_tenant_email (tenant_id, email),
        CONSTRAINT fk_store_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash CHAR(64) PRIMARY KEY, user_id VARCHAR(64) NOT NULL,
        tenant_id VARCHAR(36) NULL, role VARCHAR(32) NOT NULL, payload JSON NOT NULL,
        expires_at TIMESTAMP(3) NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_auth_sessions_user (tenant_id, user_id), INDEX idx_auth_sessions_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await pool.query('DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP(3)');
};

export const ensureStoreDatabase = async (databaseName: string, admin: any = null, seedInitialProducts = false) => {
    const tenant = await tenantByDatabaseName(databaseName);
    if (!tenant) throw new Error('Empresa não encontrada para inicialização.');
    if (seedInitialProducts) {
        const [rows] = await pool.execute<RowDataPacket[]>(
            "SELECT COUNT(*) AS count FROM store_records WHERE tenant_id = ? AND collection = 'products'", [tenant.id]
        );
        if (Number(rows[0]?.count || 0) === 0) {
            for (const product of initialProducts) {
                await pool.execute(
                    "INSERT INTO store_records (tenant_id, collection, record_id, data) VALUES (?, 'products', ?, ?)",
                    [tenant.id, product.id, JSON.stringify(product)]
                );
            }
        }
    }
    if (admin?.password) {
        const username = String(admin.username || 'admin').trim().toLowerCase();
        const [existingUsers] = await pool.execute<UserRow[]>(
            'SELECT * FROM store_users WHERE tenant_id = ? AND username = ? LIMIT 1', [tenant.id, username]
        );
        await pool.execute(
            `INSERT INTO store_users (id, tenant_id, name, username, email, password_hash, role)
             VALUES (?, ?, ?, ?, ?, ?, 'admin')
             ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash)`,
            [crypto.randomUUID(), tenant.id, admin.name || 'Administrador', username, admin.email || '', await hashPassword(String(admin.password))]
        );
        if (existingUsers[0]) await revokeUserSessions(existingUsers[0].id, tenant.id);
    }
};

export const initializeDatabases = async () => {
    await waitForDatabase();
    await createTables();
    const configuredDefaultAdminPassword = process.env.DEFAULT_STORE_ADMIN_PASSWORD;
    const defaultAdminPassword = configuredDefaultAdminPassword || 'local-development-store-password';
    if (process.env.NODE_ENV === 'production' && (!configuredDefaultAdminPassword || defaultAdminPassword.length < 12)) {
        throw new Error('DEFAULT_STORE_ADMIN_PASSWORD deve ser definido com pelo menos 12 caracteres em produção e não pode reutilizar a senha SaaS.');
    }
    if (process.env.NODE_ENV === 'production' && configuredDefaultAdminPassword === process.env.SAAS_ADMIN_PASSWORD) {
        throw new Error('DEFAULT_STORE_ADMIN_PASSWORD deve ser diferente de SAAS_ADMIN_PASSWORD.');
    }
    let existingDefault = await tenantBySlug(defaultProfile.storeSlug, true);
    if (!existingDefault) {
        const id = crypto.randomUUID();
        const databaseName = logicalDatabaseName(defaultProfile.storeSlug, id);
        await pool.execute('INSERT INTO tenants (id, store_slug, database_name, profile) VALUES (?, ?, ?, ?)',
            [id, defaultProfile.storeSlug, databaseName, JSON.stringify(defaultProfile)]);
        invalidateTenantCache(defaultProfile.storeSlug);
        existingDefault = await tenantBySlug(defaultProfile.storeSlug, true);
    } else {
        const currentProfile = parseJson<any>(existingDefault.profile);
        const usesLegacyBrand = ['GTEC Informática', 'G-TEC Informática'].includes(currentProfile.businessName)
            || ['GTEC', 'G-TEC'].includes(currentProfile.shortName);
        const usesPlaceholderFiscalData = !currentProfile.legalName || currentProfile.document === '45.123.789/0001-90';
        if (usesLegacyBrand || usesPlaceholderFiscalData) {
            const profile = { ...currentProfile,
                businessName: usesLegacyBrand ? defaultProfile.businessName : currentProfile.businessName,
                shortName: usesLegacyBrand ? defaultProfile.shortName : currentProfile.shortName,
                legalName: defaultProfile.legalName, document: defaultProfile.document };
            await pool.execute('UPDATE tenants SET profile = ? WHERE id = ?', [JSON.stringify(profile), existingDefault.id]);
            invalidateTenantCache(defaultProfile.storeSlug);
        }
    }
    const [defaultAdmins] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM store_users WHERE tenant_id = ? AND role = 'admin'", [existingDefault!.id]
    );
    if (Number(defaultAdmins[0]?.count || 0) === 0) {
        await ensureStoreDatabase(existingDefault!.database_name, {
            name: 'Administrador', username: 'admin', email: defaultProfile.email, password: defaultAdminPassword
        }, true);
    }
};

export const listTenants = async () => {
    const [rows] = await pool.query<TenantRow[]>('SELECT * FROM tenants ORDER BY created_at');
    return rows.map(mapTenant);
};
export const resolveTenant = async (slug: string, host = '') => {
    if (slug) { const tenant = await tenantBySlug(slug); return tenant ? mapPublicTenant(tenant) : null; }
    const normalizedHost = host.split(':')[0].toLowerCase();
    const [rows] = await pool.query<TenantRow[]>('SELECT * FROM tenants WHERE active = TRUE ORDER BY created_at');
    const tenant = rows.find(row => String(parseJson<any>(row.profile).customDomain || '').toLowerCase() === normalizedHost)
        || rows.find(row => row.store_slug === defaultProfile.storeSlug);
    return tenant ? mapPublicTenant(tenant) : null;
};
export const createTenant = async (input: any) => {
    if (await tenantBySlug(input.storeSlug, true)) {
        const error = new Error('Identificador já cadastrado.'); (error as any).code = 'ER_DUP_ENTRY'; throw error;
    }
    const id = crypto.randomUUID(); const storeSlug = input.storeSlug;
    const databaseName = logicalDatabaseName(storeSlug, id);
    const profile = { ...newTenantProfileDefaults, ...input, storeSlug };
    delete profile.adminPassword; delete profile.adminUsername; delete profile.adminName;
    try {
        await pool.execute('INSERT INTO tenants (id, store_slug, database_name, profile) VALUES (?, ?, ?, ?)',
            [id, storeSlug, databaseName, JSON.stringify(profile)]);
        invalidateTenantCache(storeSlug);
    } catch (error: any) {
        error.tenantCreationStage = 'tenant';
        throw error;
    }
    try {
        await ensureStoreDatabase(databaseName, { name: input.adminName || 'Administrador',
            username: input.adminUsername || 'admin', email: input.email || '', password: input.adminPassword });
    } catch (error: any) {
        await pool.execute('DELETE FROM tenants WHERE id = ?', [id]);
        invalidateTenantCache(storeSlug);
        error.tenantCreationStage = 'admin';
        throw error;
    }
    return mapTenant((await tenantBySlug(storeSlug, true))!);
};
export const updateTenantRecord = async (id: string, input: any) => {
    const [rows] = await pool.execute<TenantRow[]>('SELECT * FROM tenants WHERE id = ? LIMIT 1', [id]);
    const current = rows[0]; if (!current) return null;
    const profile = { ...parseJson<any>(current.profile), ...input, storeSlug: current.store_slug };
    delete profile.databaseName; delete profile.adminPassword;
    await pool.execute('UPDATE tenants SET profile = ? WHERE id = ?', [JSON.stringify(profile), id]);
    invalidateTenantCache(current.store_slug);
    if (input.adminPassword) await ensureStoreDatabase(current.database_name, { name: input.adminName || 'Administrador',
        username: input.adminUsername || 'admin', email: input.email || '', password: input.adminPassword });
    const [updated] = await pool.execute<TenantRow[]>('SELECT * FROM tenants WHERE id = ? LIMIT 1', [id]);
    return mapTenant(updated[0]);
};
export const updateTenantBySlug = async (slug: string, input: any) => {
    const current = await tenantBySlug(slug, true); if (!current) return null;
    const allowedFields = ['businessName','legalName','shortName','logoUrl','document','email','billingEmail','whatsapp','phone',
        'street','addressNumber','neighborhood','city','state','postalCode','address','primaryColor','accentColor','pixKey','pixName'];
    const safeInput = Object.fromEntries(Object.entries(input).filter(([key]) => allowedFields.includes(key)));
    const profile = { ...parseJson<any>(current.profile), ...safeInput, storeSlug: slug };
    await pool.execute('UPDATE tenants SET profile = ? WHERE id = ?', [JSON.stringify(profile), current.id]);
    invalidateTenantCache(slug);
    return mapTenant((await tenantBySlug(slug, true))!);
};
export const setTenantStatus = async (id: string, active: boolean) => {
    const [result]: any = await pool.execute('UPDATE tenants SET active = ? WHERE id = ?', [active, id]);
    if (!result.affectedRows) return null;
    const [rows] = await pool.execute<TenantRow[]>('SELECT * FROM tenants WHERE id = ? LIMIT 1', [id]);
    if (rows[0]) invalidateTenantCache(rows[0].store_slug);
    return rows[0] ? mapTenant(rows[0]) : null;
};

export const listStoreRecords = async (slug: string, collection: string) => {
    if (!allowedCollections.has(collection)) throw new Error('Coleção inválida.');
    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT records.data
         FROM tenants
         LEFT JOIN store_records records
           ON records.tenant_id = tenants.id AND records.collection = ?
         WHERE tenants.store_slug = ? AND tenants.active = TRUE
         ORDER BY records.created_at`, [collection, slug]);
    if (!rows.length) return null;
    return rows.filter(row => row.data !== null && row.data !== undefined).map(row => parseJson(row.data));
};
export const upsertStoreRecord = async (slug: string, collection: string, data: any) => {
    if (!allowedCollections.has(collection)) throw new Error('Coleção inválida.');
    const tenant = await tenantBySlug(slug); if (!tenant) return null;
    const record = { ...data, id: data.id || crypto.randomUUID() };
    await pool.execute(`INSERT INTO store_records (tenant_id, collection, record_id, data) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP(3)`,
        [tenant.id, collection, record.id, JSON.stringify(record)]);
    return record;
};

const productQuantitiesFromOrder = (order: any) => {
    const quantities = new Map<string, number>();
    for (const item of order?.items || []) {
        const type = String(item?.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const productId = String(item?.id || item?.productId || '').trim();
        const quantity = Math.max(0, Number(item?.qty ?? item?.quantity ?? 0) || 0);
        if (!productId || quantity <= 0 || (!type.startsWith('produto') && !type.startsWith('peca'))) continue;
        quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    return quantities;
};

const storeRecordForUpdate = async (connection: PoolConnection, tenantId: string, collection: string, id: string) => {
    const [rows] = await connection.execute<RowDataPacket[]>(
        'SELECT data FROM store_records WHERE tenant_id = ? AND collection = ? AND record_id = ? FOR UPDATE',
        [tenantId, collection, id]
    );
    return rows[0]?.data ? parseJson<any>(rows[0].data) : null;
};

const saveRecordInTransaction = async (connection: PoolConnection, tenantId: string, collection: string, record: any) => {
    await connection.execute(
        `INSERT INTO store_records (tenant_id, collection, record_id, data) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP(3)`,
        [tenantId, collection, record.id, JSON.stringify(record)]
    );
};

const reserveServiceOrderNumber = async (connection: PoolConnection, tenantId: string) => {
    // Serializa a reserva por empresa para impedir números duplicados em criações simultâneas.
    await connection.execute('SELECT id FROM tenants WHERE id = ? FOR UPDATE', [tenantId]);
    const [counterRows] = await connection.execute<RowDataPacket[]>(
        "SELECT data FROM store_records WHERE tenant_id = ? AND collection = 'system_counters' AND record_id = 'service_order' FOR UPDATE",
        [tenantId],
    );
    let nextNumber = 1;
    if (counterRows[0]) {
        nextNumber = Math.max(1, Number(parseJson<any>(counterRows[0].data)?.nextNumber) || 1);
    } else {
        const [orderRows] = await connection.execute<RowDataPacket[]>(
            "SELECT data FROM store_records WHERE tenant_id = ? AND collection = 'service_orders'",
            [tenantId],
        );
        const greatestExisting = orderRows.reduce((maximum, row) => {
            const order = parseJson<any>(row.data);
            return Math.max(maximum, Number(order?.orderNumber) || 0);
        }, 0);
        nextNumber = greatestExisting + 1;
    }
    await saveRecordInTransaction(connection, tenantId, 'system_counters', {
        id: 'service_order', nextNumber: nextNumber + 1, updatedAt: new Date().toISOString(),
    });
    return nextNumber;
};

/** Salva a O.S. e reserva/devolve suas peças na mesma transação. */
export const upsertServiceOrderWithStock = async (slug: string, input: any) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const tenant = await tenantBySlug(slug, false, connection);
        if (!tenant) { await connection.rollback(); return null; }

        const id = String(input.id || crypto.randomUUID());
        const previous = await storeRecordForUpdate(connection, tenant.id, 'service_orders', id);
        const orderNumber = Number(previous?.orderNumber) || await reserveServiceOrderNumber(connection, tenant.id);
        const previousQuantities = previous?.stockCommitted ? productQuantitiesFromOrder(previous) : new Map<string, number>();
        const nextQuantities = productQuantitiesFromOrder(input);
        const productIds = [...new Set([...previousQuantities.keys(), ...nextQuantities.keys()])];
        const movementAt = new Date().toISOString();

        for (const productId of productIds) {
            const product = await storeRecordForUpdate(connection, tenant.id, 'products', productId);
            if (!product) throw new Error(`A peça ${productId} não existe mais no estoque.`);
            const difference = (nextQuantities.get(productId) || 0) - (previousQuantities.get(productId) || 0);
            if (difference === 0) continue;
            const currentStock = Number(product.stock ?? product.quantity ?? 0) || 0;
            const nextStock = currentStock - difference;
            await saveRecordInTransaction(connection, tenant.id, 'products', { ...product, stock: nextStock, quantity: nextStock });
            const movement = {
                id: crypto.randomUUID(), productId, productName: product.name || 'Produto',
                type: difference > 0 ? 'out' : 'in', quantity: Math.abs(difference), orderId: id,
                note: difference > 0 ? `Reserva automática na O.S. #${String(orderNumber).padStart(6, '0')}` : `Ajuste/devolução automática da O.S. #${String(orderNumber).padStart(6, '0')}`,
                date: movementAt, automatic: true, negativeStock: nextStock < 0, balanceAfter: nextStock,
            };
            await saveRecordInTransaction(connection, tenant.id, 'stock_movements', movement);
        }

        const record = {
            ...input, id, orderNumber, stockCommitted: true,
            stockCommittedAt: previous?.stockCommittedAt || movementAt,
            updatedAt: movementAt,
        };
        await saveRecordInTransaction(connection, tenant.id, 'service_orders', record);
        await connection.commit();
        return record;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/** Exclui a O.S., devolve somente peças previamente reservadas e remove o lançamento financeiro vinculado. */
export const deleteServiceOrderWithStock = async (slug: string, id: string) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const tenant = await tenantBySlug(slug, false, connection);
        if (!tenant) { await connection.rollback(); return null; }
        const order = await storeRecordForUpdate(connection, tenant.id, 'service_orders', id);
        if (!order) { await connection.rollback(); return null; }

        let returnedItems = 0;
        if (order.stockCommitted && !order.stockReturnedAt) {
            for (const [productId, quantity] of productQuantitiesFromOrder(order)) {
                const product = await storeRecordForUpdate(connection, tenant.id, 'products', productId);
                if (!product) continue;
                const currentStock = Number(product.stock ?? product.quantity ?? 0) || 0;
                const nextStock = currentStock + quantity;
                await saveRecordInTransaction(connection, tenant.id, 'products', { ...product, stock: nextStock, quantity: nextStock });
                await saveRecordInTransaction(connection, tenant.id, 'stock_movements', {
                    id: crypto.randomUUID(), productId, productName: product.name || 'Produto', type: 'in', quantity,
                    orderId: id, note: `Devolução por exclusão da O.S. #${id.slice(0, 8).toUpperCase()}`,
                    date: new Date().toISOString(), automatic: true,
                });
                returnedItems += quantity;
            }
        }

        await connection.execute('DELETE FROM store_records WHERE tenant_id = ? AND collection = ? AND record_id = ?', [tenant.id, 'service_orders', id]);
        await connection.execute('DELETE FROM store_records WHERE tenant_id = ? AND collection = ? AND record_id = ?', [tenant.id, 'sales', `os-${id}`]);
        await connection.commit();
        return { deleted: true, returnedItems };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
export const reserveNfseDpsNumber = async (slug: string) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const tenant = await tenantBySlug(slug, false, connection);
        if (!tenant) { await connection.rollback(); return null; }
        const [rows] = await connection.execute<RowDataPacket[]>(
            "SELECT data FROM store_records WHERE tenant_id = ? AND collection = 'integrations' AND record_id = 'nfse' FOR UPDATE", [tenant.id]);
        if (!rows[0]) { await connection.rollback(); return null; }
        const config = parseJson<any>(rows[0].data); const number = Number(config.nextDps || 1); config.nextDps = number + 1;
        await connection.execute("UPDATE store_records SET data = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE tenant_id = ? AND collection = 'integrations' AND record_id = 'nfse'",
            [JSON.stringify(config), tenant.id]);
        await connection.commit(); return number;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
};
export const deleteStoreRecord = async (slug: string, collection: string, id: string) => {
    if (!allowedCollections.has(collection)) throw new Error('Coleção inválida.');
    const tenant = await tenantBySlug(slug); if (!tenant) return false;
    const [result]: any = await pool.execute('DELETE FROM store_records WHERE tenant_id = ? AND collection = ? AND record_id = ?',
        [tenant.id, collection, id]);
    return result.affectedRows > 0;
};

export const replaceStoreCollections = async (
    slug: string,
    collections: Record<string, any[]>,
    profile: Record<string, any> = {}
) => {
    const entries = Object.entries(collections);
    if (!entries.length || entries.some(([collection, records]) => !allowedCollections.has(collection) || !Array.isArray(records))) {
        throw new Error('Conteúdo do backup inválido.');
    }
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const tenant = await tenantBySlug(slug, false, connection);
        if (!tenant) throw new Error('Empresa não encontrada.');

        for (const [collection, records] of entries) {
            await connection.execute('DELETE FROM store_records WHERE tenant_id = ? AND collection = ?', [tenant.id, collection]);
            const ids = new Set<string>();
            for (const input of records) {
                if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Registro inválido em ${collection}.`);
                const id = String(input.id || '').trim();
                if (!id || id.length > 100 || ids.has(id)) throw new Error(`Identificador inválido ou duplicado em ${collection}.`);
                ids.add(id);
                const record = { ...input, id };
                await connection.execute(
                    'INSERT INTO store_records (tenant_id, collection, record_id, data) VALUES (?, ?, ?, ?)',
                    [tenant.id, collection, id, JSON.stringify(record)]
                );
            }
        }

        const allowedProfileFields = ['businessName','legalName','shortName','logoUrl','document','email','billingEmail','whatsapp','phone',
            'street','addressNumber','neighborhood','city','state','postalCode','address','primaryColor','accentColor','pixKey','pixName'];
        const safeProfile = Object.fromEntries(Object.entries(profile || {}).filter(([key]) => allowedProfileFields.includes(key)));
        if (Object.keys(safeProfile).length) {
            const currentProfile = parseJson<any>(tenant.profile);
            await connection.execute('UPDATE tenants SET profile = ? WHERE id = ?', [
                JSON.stringify({ ...currentProfile, ...safeProfile, storeSlug: slug }), tenant.id
            ]);
        }
        await connection.commit();
        invalidateTenantCache(slug);
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const publicUser = (user: UserRow, storeSlug: string) => ({ id: user.id, name: user.name, email: user.email, role: user.role, storeSlug });
export const authenticateStoreAdmin = async (slug: string, username: string, password: string) => {
    const tenant = await tenantBySlug(slug); if (!tenant) return null;
    const normalized = String(username || '').trim().toLowerCase();
    const [rows] = await pool.execute<UserRow[]>('SELECT * FROM store_users WHERE tenant_id = ? AND username = ? LIMIT 1', [tenant.id, normalized]);
    const user = rows[0];
    if (!user || user.role === 'customer' || !(await verifyPassword(password, user.password_hash))) return null;
    if (passwordNeedsRehash(user.password_hash)) {
        await pool.execute('UPDATE store_users SET password_hash = ? WHERE id = ?', [await hashPassword(password), user.id]);
    }
    return publicUser(user, slug);
};
export const authenticateStoreAdminGlobally = async (username: string, password: string) => {
    const normalized = String(username || '').trim().toLowerCase(); if (!normalized || !password) return null;
    const [rows] = await pool.execute<UserRow[]>(`SELECT u.*, t.store_slug FROM store_users u JOIN tenants t ON t.id = u.tenant_id
        WHERE t.active = TRUE AND (u.username = ? OR u.email = ?) AND u.role <> 'customer'`, [normalized, normalized]);
    const matches: any[] = [];
    for (const user of rows) {
        if (await verifyPassword(password, user.password_hash)) {
            if (passwordNeedsRehash(user.password_hash)) {
                await pool.execute('UPDATE store_users SET password_hash = ? WHERE id = ?', [await hashPassword(password), user.id]);
            }
            matches.push(publicUser(user, user.store_slug!));
        }
    }
    if (matches.length > 1) { const error = new Error('Estas credenciais estão vinculadas a mais de uma loja. Use um e-mail exclusivo.');
        (error as any).code = 'AMBIGUOUS_LOGIN'; throw error; }
    return matches[0] || null;
};

const staffRoles = new Set(['admin', 'gerente', 'tecnico', 'vendedor']);
export const listStoreUsers = async (slug: string) => {
    const tenant = await tenantBySlug(slug); if (!tenant) return null;
    const [rows] = await pool.execute<RowDataPacket[]>("SELECT id, name, email, role, created_at AS createdAt FROM store_users WHERE tenant_id = ? AND role <> 'customer' ORDER BY created_at", [tenant.id]);
    return rows;
};
export const upsertStoreUser = async (slug: string, input: any) => {
    const tenant = await tenantBySlug(slug); if (!tenant) return null;
    const id = String(input.id || crypto.randomUUID()); const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase(); const role = String(input.role || 'vendedor');
    if (!name || !email || !staffRoles.has(role)) throw new Error('Dados de usuário inválidos.');
    const [rows] = await pool.execute<UserRow[]>('SELECT * FROM store_users WHERE tenant_id = ? AND id = ? LIMIT 1', [tenant.id, id]);
    if (!rows[0]) {
        if (!input.password || String(input.password).length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
        await pool.execute('INSERT INTO store_users (id, tenant_id, name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, tenant.id, name, email, email, await hashPassword(String(input.password)), role]);
    } else if (input.password) {
        if (String(input.password).length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
        await pool.execute('UPDATE store_users SET name = ?, username = ?, email = ?, role = ?, password_hash = ? WHERE tenant_id = ? AND id = ?',
            [name, email, email, role, await hashPassword(String(input.password)), tenant.id, id]);
    } else {
        await pool.execute('UPDATE store_users SET name = ?, username = ?, email = ?, role = ? WHERE tenant_id = ? AND id = ?',
            [name, email, email, role, tenant.id, id]);
    }
    await revokeUserSessions(id, tenant.id);
    return { id, name, email, role };
};
export const deleteStoreUser = async (slug: string, id: string, currentUserId?: string) => {
    if (id === currentUserId) throw new Error('Você não pode excluir seu próprio usuário.');
    const tenant = await tenantBySlug(slug); if (!tenant) return false;
    const [rows] = await pool.execute<UserRow[]>('SELECT * FROM store_users WHERE tenant_id = ? AND id = ? LIMIT 1', [tenant.id, id]);
    const target = rows[0]; if (!target || target.role === 'customer') return false;
    if (target.role === 'admin') {
        const [admins] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM store_users WHERE tenant_id = ? AND role = 'admin'", [tenant.id]);
        if (Number(admins[0]?.count || 0) <= 1) throw new Error('A loja precisa manter pelo menos um administrador.');
    }
    await revokeUserSessions(id, tenant.id);
    const [result]: any = await pool.execute('DELETE FROM store_users WHERE tenant_id = ? AND id = ?', [tenant.id, id]);
    return result.affectedRows > 0;
};
export const registerCustomer = async (slug: string, name: string, email: string, password: string) => {
    const tenant = await tenantBySlug(slug); if (!tenant) return null;
    const normalizedEmail = email.toLowerCase();
    const [existing] = await pool.execute<UserRow[]>('SELECT * FROM store_users WHERE tenant_id = ? AND username = ? LIMIT 1', [tenant.id, normalizedEmail]);
    if (existing[0]) return { conflict: true };
    const id = crypto.randomUUID(); const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute("INSERT INTO store_users (id, tenant_id, name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, 'customer')",
            [id, tenant.id, name, normalizedEmail, normalizedEmail, await hashPassword(password)]);
        const customer = { id, name, email: normalizedEmail };
        await connection.execute("INSERT INTO store_records (tenant_id, collection, record_id, data) VALUES (?, 'customers', ?, ?)",
            [tenant.id, id, JSON.stringify(customer)]);
        await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return { id, name, email: normalizedEmail, role: 'customer', storeSlug: slug };
};
export const authenticateCustomer = async (slug: string, email: string, password: string) => {
    const tenant = await tenantBySlug(slug); if (!tenant) return null;
    const [rows] = await pool.execute<UserRow[]>("SELECT * FROM store_users WHERE tenant_id = ? AND username = ? AND role = 'customer' LIMIT 1",
        [tenant.id, email.toLowerCase()]);
    const user = rows[0]; if (!user || !(await verifyPassword(password, user.password_hash))) return null;
    if (passwordNeedsRehash(user.password_hash)) {
        await pool.execute('UPDATE store_users SET password_hash = ? WHERE id = ?', [await hashPassword(password), user.id]);
    }
    return publicUser(user, slug);
};

const sessionHash = (token: string) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

export const createAuthSession = async (payload: any, expiresInSeconds = 7200) => {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sessionHash(token);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await pool.execute(
        'INSERT INTO auth_sessions (token_hash, user_id, tenant_id, role, payload, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [tokenHash, String(payload.id || payload.role), payload.storeSlug || null, payload.role, JSON.stringify(payload), expiresAt]
    );
    sessionCache.set(tokenHash, {
        payload,
        expiresAt: Math.min(expiresAt.getTime(), Date.now() + SESSION_CACHE_TTL_MS),
        userId: String(payload.id || payload.role),
        tenantId: payload.storeSlug || undefined,
    });
    trimCache(sessionCache, MAX_SESSION_CACHE_ENTRIES);
    return token;
};

export const resolveAuthSession = async (token: string) => {
    if (!token) return null;
    const tokenHash = sessionHash(token);
    const cached = sessionCache.get(tokenHash);
    if (cached && cached.expiresAt > Date.now()) return cached.payload;
    if (cached) sessionCache.delete(tokenHash);
    const inFlight = sessionLookupPromises.get(tokenHash);
    if (inFlight) return inFlight;
    const lookup = (async () => {
        const [rows] = await pool.execute<SessionRow[]>(
            'SELECT payload, expires_at FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP(3) LIMIT 1',
            [tokenHash]
        );
        if (!rows[0]) {
            sessionCache.set(tokenHash, { payload: null, expiresAt: Date.now() + 5_000, userId: '' });
            return null;
        }
        const payload = parseJson<any>(rows[0].payload);
        sessionCache.set(tokenHash, {
            payload,
            expiresAt: Math.min(new Date(rows[0].expires_at).getTime(), Date.now() + SESSION_CACHE_TTL_MS),
            userId: String(payload.id || payload.role),
            tenantId: payload.storeSlug || undefined,
        });
        trimCache(sessionCache, MAX_SESSION_CACHE_ENTRIES);
        return payload;
    })().finally(() => sessionLookupPromises.delete(tokenHash));
    sessionLookupPromises.set(tokenHash, lookup);
    return lookup;
};

export const deleteAuthSession = async (token: string) => {
    if (!token) return;
    const tokenHash = sessionHash(token);
    sessionCache.delete(tokenHash);
    await pool.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [tokenHash]);
};

export const revokeUserSessions = async (userId: string, tenantId?: string) => {
    let tenantScope = tenantId;
    if (tenantId) {
        const [tenantRows] = await pool.execute<RowDataPacket[]>('SELECT store_slug FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
        tenantScope = String(tenantRows[0]?.store_slug || tenantId);
    }
    for (const [tokenHash, cached] of sessionCache) {
        if (cached.userId === userId && (!tenantScope || cached.tenantId === tenantScope)) sessionCache.delete(tokenHash);
    }
    if (tenantId) await pool.execute('DELETE FROM auth_sessions WHERE user_id = ? AND tenant_id IN (?, ?)', [userId, tenantId, tenantScope]);
    else await pool.execute('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);
};
