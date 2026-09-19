import crypto from 'node:crypto';

const keyFromSecret = (secret: string) => {
    if (!secret || secret.length < 32) {
        throw new Error('A chave de criptografia deve ter pelo menos 32 caracteres.');
    }
    return crypto.createHash('sha256').update(secret, 'utf8').digest();
};

export const getDataEncryptionSecret = () => {
    const configured = process.env.DATA_ENCRYPTION_KEY
        || process.env.INTEGRATION_SECRET_KEY
        || process.env.NFSE_SECRET_KEY
        || process.env.SAAS_TOKEN_SECRET;
    const secret = configured || (process.env.NODE_ENV === 'production' ? '' : 'local-data-encryption-key-development-only');
    keyFromSecret(secret);
    return secret;
};

export const isEncryptedValue = (value: unknown) => String(value || '').startsWith('v1:');

export const encryptSecret = (value: string, secret: string, context = 'feitosa-solucoes') => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':');
};

export const decryptSecret = (payload: string, secret: string, context = 'feitosa-solucoes') => {
    const [version, iv, tag, encrypted] = String(payload || '').split(':');
    if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Credencial criptografada em formato inválido.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
};

export const decryptStoredSecret = (value: string, secret: string, context = 'feitosa-solucoes') =>
    isEncryptedValue(value) ? decryptSecret(value, secret, context) : String(value || '');

export const maskSecret = (value: unknown) => value ? '••••••••••••' : '';
