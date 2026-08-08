import crypto from 'node:crypto';
import pg from 'pg';
import { products as initialProducts } from '../src/data/products.js';
import { hashPassword, verifyPassword } from './auth.js';

const { Pool } = pg;
const baseConfig = {
    host: process.env.PGHOST || 'db',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'gtec',
    password: process.env.PGPASSWORD || 'gtec_local_change_me'
};

const controlDatabase = process.env.PGDATABASE || 'gtec_control';
const controlPool = new Pool({ ...baseConfig, database: controlDatabase });
const adminPool = new Pool({ ...baseConfig, database: 'postgres' });
const storePools = new Map();
const allowedCollections = new Set(['products', 'sales', 'expenses', 'customers', 'receivables']);

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

const sanitizeDatabaseName = (slug, id) => `store_${slug.replace(/[^a-z0-9]/g, '_').slice(0, 32)}_${id.replace(/-/g, '').slice(0, 8)}`;
const quoteIdentifier = (value) => `"${value.replace(/"/g, '""')}"`;
const getStorePool = (databaseName) => {
    if (!storePools.has(databaseName)) storePools.set(databaseName, new Pool({ ...baseConfig, database: databaseName }));
    return storePools.get(databaseName);
};

const mapTenant = (row) => ({
    id: row.id,
    databaseName: row.database_name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...row.profile
});

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

export const ensureStoreDatabase = async (databaseName, admin = null) => {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (exists.rowCount === 0) await adminPool.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);

    const pool = getStorePool(databaseName);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS receivables (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, email TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
    `);

    const productCount = await pool.query('SELECT COUNT(*)::int AS count FROM products');
    if (productCount.rows[0].count === 0) {
        for (const product of initialProducts) {
            await pool.query('INSERT INTO products (id, data) VALUES ($1, $2)', [product.id, product]);
        }
    }

    if (admin?.password) {
        const passwordHash = await hashPassword(admin.password);
        await pool.query(
            `INSERT INTO users (id, name, username, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5, 'admin')
             ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
            [crypto.randomUUID(), admin.name || 'Administrador', admin.username || 'admin', admin.email || '', passwordHash]
        );
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

    const existingDefault = await controlPool.query('SELECT * FROM tenants WHERE store_slug = $1', [defaultProfile.storeSlug]);
    if (existingDefault.rowCount === 0) {
        const id = crypto.randomUUID();
        const databaseName = sanitizeDatabaseName(defaultProfile.storeSlug, id);
        await ensureStoreDatabase(databaseName, { name: 'Administrador', username: 'admin', email: defaultProfile.email, password: process.env.DEFAULT_STORE_ADMIN_PASSWORD || 'admin123' });
        await controlPool.query(
            'INSERT INTO tenants (id, store_slug, database_name, profile) VALUES ($1, $2, $3, $4)',
            [id, defaultProfile.storeSlug, databaseName, defaultProfile]
        );
    }

    const tenants = await controlPool.query('SELECT * FROM tenants');
    for (const row of tenants.rows) await ensureStoreDatabase(row.database_name);
};

export const listTenants = async () => {
    const result = await controlPool.query('SELECT * FROM tenants ORDER BY created_at ASC');
    return result.rows.map(mapTenant);
};

export const resolveTenant = async (slug, host = '') => {
    const normalizedHost = host.split(':')[0];
    const result = slug
        ? await controlPool.query('SELECT * FROM tenants WHERE store_slug = $1 AND active = TRUE', [slug])
        : await controlPool.query("SELECT * FROM tenants WHERE active = TRUE AND (profile->>'customDomain' = $1 OR store_slug = 'gtec-informatica') ORDER BY CASE WHEN profile->>'customDomain' = $1 THEN 0 ELSE 1 END LIMIT 1", [normalizedHost]);
    return result.rowCount ? mapTenant(result.rows[0]) : null;
};

export const createTenant = async (input) => {
    const duplicate = await controlPool.query('SELECT 1 FROM tenants WHERE store_slug = $1', [input.storeSlug]);
    if (duplicate.rowCount) {
        const error = new Error('Identificador já cadastrado.');
        error.code = '23505';
        throw error;
    }
    const id = crypto.randomUUID();
    const storeSlug = input.storeSlug;
    const databaseName = sanitizeDatabaseName(storeSlug, id);
    const profile = { ...defaultProfile, ...input, storeSlug };
    delete profile.adminPassword;
    delete profile.adminUsername;

    await ensureStoreDatabase(databaseName, {
        name: input.adminName || 'Administrador',
        username: input.adminUsername || 'admin',
        email: input.email || '',
        password: input.adminPassword
    });
    const result = await controlPool.query(
        'INSERT INTO tenants (id, store_slug, database_name, profile) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, storeSlug, databaseName, profile]
    );
    return mapTenant(result.rows[0]);
};

export const updateTenantRecord = async (id, input) => {
    const current = await controlPool.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (!current.rowCount) return null;
    const profile = { ...current.rows[0].profile, ...input, storeSlug: current.rows[0].store_slug };
    delete profile.databaseName;
    delete profile.adminPassword;
    const result = await controlPool.query('UPDATE tenants SET profile = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, profile]);
    if (input.adminPassword) {
        await ensureStoreDatabase(current.rows[0].database_name, {
            name: input.adminName || 'Administrador',
            username: input.adminUsername || 'admin',
            email: input.email || '',
            password: input.adminPassword
        });
    }
    return mapTenant(result.rows[0]);
};

export const updateTenantBySlug = async (slug, input) => {
    const current = await controlPool.query('SELECT * FROM tenants WHERE store_slug = $1', [slug]);
    if (!current.rowCount) return null;
    const allowedFields = [
        'businessName', 'shortName', 'logoUrl', 'document', 'email', 'billingEmail', 'whatsapp', 'phone',
        'street', 'addressNumber', 'neighborhood', 'city', 'state', 'postalCode', 'address', 'customDomain',
        'primaryColor', 'accentColor', 'backgroundColor', 'cardColor'
    ];
    const safeInput = Object.fromEntries(Object.entries(input).filter(([key]) => allowedFields.includes(key)));
    const profile = { ...current.rows[0].profile, ...safeInput, storeSlug: slug };
    const result = await controlPool.query('UPDATE tenants SET profile = $2, updated_at = NOW() WHERE store_slug = $1 RETURNING *', [slug, profile]);
    return mapTenant(result.rows[0]);
};

export const setTenantStatus = async (id, active) => {
    const result = await controlPool.query('UPDATE tenants SET active = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, active]);
    return result.rowCount ? mapTenant(result.rows[0]) : null;
};

const getTenantDatabase = async (slug, includeInactive = false) => {
    const result = await controlPool.query(`SELECT database_name FROM tenants WHERE store_slug = $1 ${includeInactive ? '' : 'AND active = TRUE'}`, [slug]);
    return result.rows[0]?.database_name || null;
};

export const listStoreRecords = async (slug, collection) => {
    if (!allowedCollections.has(collection)) throw new Error('Coleção inválida.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    const result = await getStorePool(databaseName).query(`SELECT data FROM ${collection} ORDER BY created_at ASC`);
    return result.rows.map(row => row.data);
};

export const upsertStoreRecord = async (slug, collection, data) => {
    if (!allowedCollections.has(collection)) throw new Error('Coleção inválida.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    const record = { ...data, id: data.id || crypto.randomUUID() };
    await getStorePool(databaseName).query(
        `INSERT INTO ${collection} (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [record.id, record]
    );
    return record;
};

export const deleteStoreRecord = async (slug, collection, id) => {
    if (!allowedCollections.has(collection)) throw new Error('Coleção inválida.');
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return false;
    const result = await getStorePool(databaseName).query(`DELETE FROM ${collection} WHERE id = $1`, [id]);
    return result.rowCount > 0;
};

export const authenticateStoreAdmin = async (slug, username, password) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    const result = await getStorePool(databaseName).query('SELECT * FROM users WHERE username = $1 AND role = $2', [username, 'admin']);
    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) return null;
    return { id: result.rows[0].id, name: result.rows[0].name, email: result.rows[0].email, role: 'admin', storeSlug: slug };
};

export const registerCustomer = async (slug, name, email, password) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    const pool = getStorePool(databaseName);
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1', [email.toLowerCase()]);
    if (existing.rowCount) return { conflict: true };
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await pool.query(
        "INSERT INTO users (id, name, username, email, password_hash, role) VALUES ($1, $2, $3, $3, $4, 'customer')",
        [id, name, email.toLowerCase(), passwordHash]
    );
    await pool.query('INSERT INTO customers (id, data) VALUES ($1, $2)', [id, { id, name, email: email.toLowerCase() }]);
    return { id, name, email: email.toLowerCase(), role: 'customer', storeSlug: slug };
};

export const authenticateCustomer = async (slug, email, password) => {
    const databaseName = await getTenantDatabase(slug);
    if (!databaseName) return null;
    const result = await getStorePool(databaseName).query('SELECT * FROM users WHERE username = $1 AND role = $2', [email.toLowerCase(), 'customer']);
    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) return null;
    return { id: result.rows[0].id, name: result.rows[0].name, email: result.rows[0].email, role: 'customer', storeSlug: slug };
};
