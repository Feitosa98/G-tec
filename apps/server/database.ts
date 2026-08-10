import crypto from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, asc, or, sql } from 'drizzle-orm';
import { products as initialProducts } from '../web/src/data/products.js';
import { hashPassword, verifyPassword } from './auth.js';
import * as schema from './schema.js';

const { Pool } = pg;
const databasePassword = process.env.PGPASSWORD || 'local-development-database-password';
if (process.env.NODE_ENV === 'production' && (!process.env.PGPASSWORD || databasePassword.length < 12)) {
    throw new Error('PGPASSWORD deve ser definido com pelo menos 12 caracteres em produção.');
}
const baseConfig = {
    host: process.env.PGHOST || 'db',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'gtec',
    password: databasePassword
};

const controlDatabase = process.env.PGDATABASE || 'gtec_control';
const controlPool = new Pool({ ...baseConfig, database: controlDatabase });
const adminPool = new Pool({ ...baseConfig, database: 'postgres' });

const controlDb = drizzle(controlPool, { schema });

const storePools = new Map();
const storeDbs = new Map();

const allowedCollections = new Map<string, any>([
    ['products', schema.products],
    ['sales', schema.sales],
    ['expenses', schema.expenses],
    ['customers', schema.customers],
    ['receivables', schema.receivables],
    ['services', schema.services],
    ['service_orders', schema.serviceOrders],
    ['subscriptions', schema.subscriptions],
    ['integrations', schema.integrations],
    ['payment_transactions', schema.paymentTransactions],
    ['suppliers', schema.suppliers],
    ['stock_movements', schema.stockMovements],
    ['appointments', schema.appointments],
    ['audit_log', schema.auditLogs]
]);

const defaultProfile = {
    businessName: 'GTEC Informática',
    shortName: 'GTEC',
    storeSlug: 'gtec-informatica',
    logoUrl: '/logo.png',
    document: '45.123.789/0001-90',
    email: 'contato@gtecinformatica.com.br',
    billingEmail: '',
    whatsapp: '5592992800023',
    phone: '',
    street: '',
    addressNumber: '',
    neighborhood: '',
    city: 'Manaus',
    state: 'AM',
    postalCode: '',
    address: 'Manaus - AM',
    customDomain: '',
    primaryColor: '#0052cc',
    accentColor: '#d4a024',
    backgroundColor: '#0a0e1a',
    cardColor: '#12182b'
};

const newTenantProfileDefaults = {
    logoUrl: '',
    document: '',
    billingEmail: '',
    whatsapp: '',
    phone: '',
    street: '',
    addressNumber: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: '',
    address: '',
    customDomain: '',
    primaryColor: '#2563eb',
    accentColor: '#f59e0b',
    backgroundColor: '#0f172a',
    cardColor: '#1e293b'
};

const sanitizeDatabaseName = (slug: string, id: string) => `store_${slug.replace(/[^a-z0-9]/g, '_').slice(0, 32)}_${id.replace(/-/g, '').slice(0, 8)}`;
const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

const getStoreDb = (databaseName: string) => {
    if (!storePools.has(databaseName)) {
        const pool = new Pool({ ...baseConfig, database: databaseName });
        storePools.set(databaseName, pool);
        storeDbs.set(databaseName, drizzle(pool, { schema }));
    }
    return storeDbs.get(databaseName);
};

const mapTenant = (row: any) => ({
    id: row.id,
    databaseName: row.databaseName,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...row.profile
});

const mapPublicTenant = (row: any) => {
    const tenant = mapTenant(row);
    delete tenant.databaseName;
    return tenant;
};

export const waitForDatabase = async () => {
    for (let attempt = 1; attempt <= 30; attempt += 1) {
        try {
            await controlPool.query('SELECT 1');
            return;
        } catch (error) {
            if (attempt === 30) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

export const ensureStoreDatabase = async (databaseName: string, admin: any = null, seedInitialProducts = false) => {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (exists.rowCount === 0) await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);

    const pool = storePools.get(databaseName) || (getStoreDb(databaseName) && storePools.get(databaseName));
    const db = getStoreDb(databaseName);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS receivables (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS service_orders (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS integrations (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS payment_transactions (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, email TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
    `);

    const productCount = await db.select({ count: sql`COUNT(*)::int` }).from(schema.products);
    if (seedInitialProducts && productCount[0].count === 0) {
        for (const product of initialProducts) {
            await db.insert(schema.products).values({ id: product.id, data: product });
        }
    }

    if (admin?.password) {
        const passwordHash = await hashPassword(admin.password);
        await db.insert(schema.users).values({
            id: crypto.randomUUID(),
            name: admin.name || 'Administrador',
            username: String(admin.username || 'admin').trim().toLowerCase(),
            email: admin.email || '',
            passwordHash,
            role: 'admin'
        }).onConflictDoUpdate({
            target: schema.users.username,
            set: { name: sql`EXCLUDED.name`, email: sql`EXCLUDED.email`, passwordHash: sql`EXCLUDED.password_hash` }
        });
    }
};

export const initializeDatabases = async () => {
    await waitForDatabase();
    await controlPool.query(`
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            store_slug TEXT UNIQUE NOT NULL,
            database_name TEXT UNIQUE NOT NULL,
            profile JSONB NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const existingDefault = await controlDb.select().from(schema.tenants).where(eq(schema.tenants.storeSlug, defaultProfile.storeSlug));
    if (existingDefault.length === 0) {
        const defaultAdminPassword = process.env.DEFAULT_STORE_ADMIN_PASSWORD || 'local-development-store-password';
        if (process.env.NODE_ENV === 'production' && (!process.env.DEFAULT_STORE_ADMIN_PASSWORD || defaultAdminPassword.length < 12)) {
            throw new Error('DEFAULT_STORE_ADMIN_PASSWORD deve ser definido com pelo menos 12 caracteres em produção.');
        }
        const id = crypto.randomUUID();
        const databaseName = sanitizeDatabaseName(defaultProfile.storeSlug, id);
        await ensureStoreDatabase(databaseName, { name: 'Administrador', username: 'admin', email: defaultProfile.email, password: defaultAdminPassword }, true);
        await controlDb.insert(schema.tenants).values({
            id,
            storeSlug: defaultProfile.storeSlug,
            databaseName,
            profile: defaultProfile
        });
    }

    const allTenants = await controlDb.select().from(schema.tenants);
    for (const row of allTenants) await ensureStoreDatabase(row.databaseName);
};

export const listTenants = async () => {
    const result = await controlDb.select().from(schema.tenants).orderBy(asc(schema.tenants.createdAt));
    return result.map(mapTenant);
};

export const resolveTenant = async (slug: string, host = '') => {
    const normalizedHost = host.split(':')[0];
    let result;
    
    if (slug) {
        result = await controlDb.select().from(schema.tenants).where(and(eq(schema.tenants.storeSlug, slug), eq(schema.tenants.active, true)));
    } else {
        result = await controlDb.select().from(schema.tenants)
            .where(and(
                eq(schema.tenants.active, true),
                sql`(profile->>'customDomain' = ${normalizedHost} OR store_slug = 'gtec-informatica')`
            ))
            .orderBy(sql`CASE WHEN profile->>'customDomain' = ${normalizedHost} THEN 0 ELSE 1 END`)
            .limit(1);
    }
    
    return result.length ? mapPublicTenant(result[0]) : null;
};

export const createTenant = async (input: any) => {
    const duplicate = await controlDb.select().from(schema.tenants).where(eq(schema.tenants.storeSlug, input.storeSlug));
    if (duplicate.length > 0) {
        const error = new Error('Identificador já cadastrado.');
        (error as any).code = '23505';
        throw error;
    }
    const id = crypto.randomUUID();
    const storeSlug = input.storeSlug;
    const databaseName = sanitizeDatabaseName(storeSlug, id);
    const profile = { ...newTenantProfileDefaults, ...input, storeSlug };
    delete profile.adminPassword;
    delete profile.adminUsername;
    delete profile.adminName;

    await ensureStoreDatabase(databaseName, {
        name: input.adminName || 'Administrador',
        username: input.adminUsername || 'admin',
        email: input.email || '',
        password: input.adminPassword
    });
    
    const result = await controlDb.insert(schema.tenants).values({
        id,
        storeSlug,
        databaseName,
        profile
    }).returning();
    
    return mapTenant(result[0]);
};

export const updateTenantRecord = async (id: string, input: any) => {
    const current = await controlDb.select().from(schema.tenants).where(eq(schema.tenants.id, id));
    if (current.length === 0) return null;
    
    const profile = { ...current[0].profile as any, ...input, storeSlug: current[0].storeSlug };
    delete profile.databaseName;
    delete profile.adminPassword;
    
    const result = await controlDb.update(schema.tenants)
        .set({ profile, updatedAt: new Date() })
        .where(eq(schema.tenants.id, id))
        .returning();
        
    if (input.adminPassword) {
        await ensureStoreDatabase(current[0].databaseName, {
            name: input.adminName || 'Administrador',
            username: input.adminUsername || 'admin',
            email: input.email || '',
            password: input.adminPassword
        });
    }
    return mapTenant(result[0]);
};

export const updateTenantBySlug = async (slug: string, input: any) => {
    const current = await controlDb.select().from(schema.tenants).where(eq(schema.tenants.storeSlug, slug));
    if (current.length === 0) return null;
    
    const allowedFields = [
        'businessName', 'shortName', 'logoUrl', 'document', 'email', 'billingEmail', 'whatsapp', 'phone',
        'street', 'addressNumber', 'neighborhood', 'city', 'state', 'postalCode', 'address', 'customDomain',
        'primaryColor', 'accentColor', 'backgroundColor', 'cardColor', 'pixKey', 'pixName'
    ];
    const safeInput = Object.fromEntries(Object.entries(input).filter(([key]) => allowedFields.includes(key)));
    const profile = { ...current[0].profile as any, ...safeInput, storeSlug: slug };
    
    const result = await controlDb.update(schema.tenants)
        .set({ profile, updatedAt: new Date() })
        .where(eq(schema.tenants.storeSlug, slug))
        .returning();
        
    return mapTenant(result[0]);
};

export const setTenantStatus = async (id: string, active: boolean) => {
    const result = await controlDb.update(schema.tenants)
        .set({ active, updatedAt: new Date() })
        .where(eq(schema.tenants.id, id))
        .returning();
    return result.length ? mapTenant(result[0]) : null;
};

const getTenantDatabase = async (slug: string, includeInactive = false) => {
    const conditions = includeInactive ? eq(schema.tenants.storeSlug, slug) : and(eq(schema.tenants.storeSlug, slug), eq(schema.tenants.active, true));
    const result = await controlDb.select({ databaseName: schema.tenants.databaseName }).from(schema.tenants).where(conditions as any);
    return result[0]?.databaseName || null;
};

export const listStoreRecords = async (slug: string, collection: string) => {
    const table = allowedCollections.get(collection);
    if (!table) throw new Error('Coleção inválida.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    
    const db = getStoreDb(databaseName);
    const result = await db.select({ data: table.data }).from(table).orderBy(asc(table.createdAt));
    return result.map((row: any) => row.data);
};

export const upsertStoreRecord = async (slug: string, collection: string, data: any) => {
    const table = allowedCollections.get(collection);
    if (!table) throw new Error('Coleção inválida.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    
    const record = { ...data, id: data.id || crypto.randomUUID() };
    const db = getStoreDb(databaseName);
    
    await db.insert(table).values({ id: record.id, data: record }).onConflictDoUpdate({
        target: table.id,
        set: { data: sql`EXCLUDED.data`, updatedAt: sql`NOW()` }
    });
    
    return record;
};

export const deleteStoreRecord = async (slug: string, collection: string, id: string) => {
    const table = allowedCollections.get(collection);
    if (!table) throw new Error('Coleção inválida.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return false;
    
    const db = getStoreDb(databaseName);
    const result = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
    return result.length > 0;
};

export const authenticateStoreAdmin = async (slug: string, username: string, password: string) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    
    const db = getStoreDb(databaseName);
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const result = await db.select().from(schema.users).where(eq(schema.users.username, normalizedUsername));
    
    if (result.length === 0 || !(await verifyPassword(password, result[0].passwordHash))) return null;
    if (result[0].role === 'customer') return null;
    return { id: result[0].id, name: result[0].name, email: result[0].email, role: result[0].role, storeSlug: slug };
};

export const authenticateStoreAdminGlobally = async (username: string, password: string) => {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername || !password) return null;

    const tenants = await controlDb.select({
        storeSlug: schema.tenants.storeSlug,
        databaseName: schema.tenants.databaseName
    }).from(schema.tenants).where(eq(schema.tenants.active, true));

    const matches: any[] = [];
    for (const tenant of tenants) {
        const db = getStoreDb(tenant.databaseName);
        const users = await db.select().from(schema.users).where(or(
            eq(schema.users.username, normalizedUsername),
            eq(schema.users.email, normalizedUsername)
        ));

        for (const user of users) {
            if (user.role !== 'customer' && await verifyPassword(password, user.passwordHash)) {
                matches.push({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    storeSlug: tenant.storeSlug
                });
            }
        }
    }

    if (matches.length > 1) {
        const error = new Error('Estas credenciais estão vinculadas a mais de uma loja. Use um e-mail exclusivo.');
        (error as any).code = 'AMBIGUOUS_LOGIN';
        throw error;
    }

    return matches[0] || null;
};

const staffRoles = new Set(['admin', 'gerente', 'tecnico', 'vendedor']);

export const listStoreUsers = async (slug: string) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    const db = getStoreDb(databaseName);
    const result = await db.select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        createdAt: schema.users.createdAt
    }).from(schema.users).where(sql`${schema.users.role} <> 'customer'`).orderBy(asc(schema.users.createdAt));
    return result;
};

export const upsertStoreUser = async (slug: string, input: any) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;

    const id = String(input.id || crypto.randomUUID());
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const role = String(input.role || 'vendedor');
    if (!name || !email || !staffRoles.has(role)) throw new Error('Dados de usuário inválidos.');

    const db = getStoreDb(databaseName);
    const current = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (current.length === 0) {
        if (!input.password || String(input.password).length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
        await db.insert(schema.users).values({
            id, name, username: email, email, role,
            passwordHash: await hashPassword(String(input.password))
        });
    } else {
        const values: any = { name, username: email, email, role };
        if (input.password) {
            if (String(input.password).length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
            values.passwordHash = await hashPassword(String(input.password));
        }
        await db.update(schema.users).set(values).where(eq(schema.users.id, id));
    }
    return { id, name, email, role };
};

export const deleteStoreUser = async (slug: string, id: string, currentUserId?: string) => {
    if (id === currentUserId) throw new Error('Você não pode excluir seu próprio usuário.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return false;
    const db = getStoreDb(databaseName);
    const target = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (!target.length || target[0].role === 'customer') return false;
    if (target[0].role === 'admin') {
        const admins = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'admin'));
        if (admins.length <= 1) throw new Error('A loja precisa manter pelo menos um administrador.');
    }
    const result = await db.delete(schema.users).where(eq(schema.users.id, id)).returning({ id: schema.users.id });
    return result.length > 0;
};

export const registerCustomer = async (slug: string, name: string, email: string, password: string) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    
    const db = getStoreDb(databaseName);
    const existing = await db.select().from(schema.users).where(eq(schema.users.username, email.toLowerCase()));
    
    if (existing.length > 0) return { conflict: true };
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    
    await db.insert(schema.users).values({
        id, name, username: email.toLowerCase(), email: email.toLowerCase(), passwordHash, role: 'customer'
    });
    await db.insert(schema.customers).values({
        id, data: { id, name, email: email.toLowerCase() }
    });
    
    return { id, name, email: email.toLowerCase(), role: 'customer', storeSlug: slug };
};

export const authenticateCustomer = async (slug: string, email: string, password: string) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    
    const db = getStoreDb(databaseName);
    const result = await db.select().from(schema.users).where(and(eq(schema.users.username, email.toLowerCase()), eq(schema.users.role, 'customer')));
    
    if (result.length === 0 || !(await verifyPassword(password, result[0].passwordHash))) return null;
    return { id: result[0].id, name: result[0].name, email: result[0].email, role: 'customer', storeSlug: slug };
};
