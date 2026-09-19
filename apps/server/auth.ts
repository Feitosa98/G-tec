import crypto from 'node:crypto';

const deriveKey = (password: string, salt: string, options?: crypto.ScryptOptions) => new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, options || {}, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
    });
});
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const encode = (value) => Buffer.from(value).toString('base64url');

export const hashPassword = async (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await deriveKey(password, salt, {
        N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM
    }) as Buffer;
    return `s2$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${Buffer.from(derivedKey).toString('hex')}`;
};

export const verifyPassword = async (password, storedHash) => {
    const stored = String(storedHash || '');
    const modern = stored.split('$');
    const isModern = modern[0] === 's2' && modern.length === 6;
    const [salt, key] = isModern ? [modern[4], modern[5]] : stored.split(':');
    if (!salt || !key) return false;
    const options = isModern
        ? { N: Number(modern[1]), r: Number(modern[2]), p: Number(modern[3]), maxmem: SCRYPT_MAXMEM }
        : undefined;
    const derivedKey = await deriveKey(password, salt, options);
    const storedKey = Buffer.from(key, 'hex');
    const candidateKey = Buffer.from(derivedKey);
    return storedKey.length === candidateKey.length && crypto.timingSafeEqual(storedKey, candidateKey);
};

export const passwordNeedsRehash = (storedHash: unknown) => !String(storedHash || '').startsWith(`s2$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$`);

export const createToken = (payload, secret, expiresInSeconds = 7200) => {
    const now = Math.floor(Date.now() / 1000);
    const body = encode(JSON.stringify({ ...payload, iss: 'feitosa-solucoes', iat: now, jti: crypto.randomUUID(), exp: now + expiresInSeconds }));
    const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${signature}`;
};

export const verifyToken = (token, secret) => {
    try {
        const [body, signature] = String(token || '').split('.');
        if (!body || !signature) return null;
        const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
        const receivedBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expected);
        if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        return payload.iss === 'feitosa-solucoes' && Number(payload.iat) <= now + 60 && Number(payload.exp) > now ? payload : null;
    } catch {
        return null;
    }
};
