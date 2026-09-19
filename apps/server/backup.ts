import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const BACKUP_COLLECTIONS = [
    'products', 'sales', 'expenses', 'customers', 'receivables', 'services',
    'service_orders', 'subscriptions', 'integrations', 'payment_transactions',
    'suppliers', 'stock_movements', 'appointments', 'audit_log',
    'fiscal_documents', 'purchase_invoices',
] as const;

export type BackupCollections = Record<string, any[]>;

const checksumFor = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const createBackupDocument = (slug: string, profile: Record<string, any>, collections: BackupCollections) => {
    const base = {
        format: 'feitosa-solucoes-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        tenant: { slug, profile },
        collections,
        totals: Object.fromEntries(Object.entries(collections).map(([key, records]) => [key, records.length])),
        security: { usersPreserved: true, integrationSecretsExcluded: true },
    };
    return { ...base, checksum: checksumFor(base) };
};

export const encryptBackupDocument = (document: unknown, secret: string) => {
    const key = createHash('sha256').update(secret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(document), 'utf8'), cipher.final()]);
    return {
        format: 'feitosa-solucoes-encrypted-backup',
        version: 1,
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64url'),
        tag: cipher.getAuthTag().toString('base64url'),
        data: encrypted.toString('base64url'),
    };
};

const decryptBackupDocument = (input: any, secret: string) => {
    try {
        const key = createHash('sha256').update(secret).digest();
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(String(input.iv || ''), 'base64url'));
        decipher.setAuthTag(Buffer.from(String(input.tag || ''), 'base64url'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(String(input.data || ''), 'base64url')),
            decipher.final(),
        ]).toString('utf8');
        return JSON.parse(decrypted);
    } catch {
        throw new Error('O backup criptografado está corrompido ou pertence a outra instalação.');
    }
};

export const validateBackupDocument = (input: any, expectedSlug: string, encryptionSecret = '') => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Arquivo de backup inválido.');
    if (input.format === 'feitosa-solucoes-encrypted-backup') {
        if (!encryptionSecret) throw new Error('Este backup criptografado exige a chave da instalação.');
        return validateBackupDocument(decryptBackupDocument(input, encryptionSecret), expectedSlug, encryptionSecret);
    }

    if (input.format === 'feitosa-solucoes-backup' && input.version === 2) {
        const { checksum, ...base } = input;
        if (!/^[a-f0-9]{64}$/i.test(String(checksum || '')) || checksumFor(base) !== checksum) {
            throw new Error('O arquivo está corrompido ou foi alterado.');
        }
        const sourceSlug = String(input.tenant?.slug || '');
        if (sourceSlug && sourceSlug !== expectedSlug) throw new Error('Este backup pertence a outra empresa.');
        if (!input.collections || typeof input.collections !== 'object') throw new Error('O backup não contém coleções válidas.');
        const collections: BackupCollections = {};
        let totalRecords = 0;
        for (const collection of BACKUP_COLLECTIONS) {
            const records = input.collections[collection];
            if (!Array.isArray(records)) throw new Error(`Coleção ausente ou inválida: ${collection}.`);
            totalRecords += records.length;
            if (totalRecords > 100_000) throw new Error('O backup excede o limite de registros permitido.');
            collections[collection] = records;
        }
        return { collections, profile: input.tenant?.profile || {}, legacy: false, exportedAt: input.exportedAt };
    }

    // Compatibilidade com os backups JSON disponibilizados antes da versão 2.
    const legacyCollections: BackupCollections = {};
    let found = 0;
    for (const collection of BACKUP_COLLECTIONS) {
        const records = input[collection];
        if (Array.isArray(records)) {
            legacyCollections[collection] = records;
            found += records.length;
        }
    }
    if (!input.exportedAt || !input.tenant || !found) throw new Error('Formato de backup não reconhecido.');
    if (String(input.tenant) !== expectedSlug) throw new Error('Este backup pertence a outra empresa.');
    return { collections: legacyCollections, profile: {}, legacy: true, exportedAt: input.exportedAt };
};
