import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

const encode = (value) => Buffer.from(value).toString('base64url');

export const hashPassword = async (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
};

export const verifyPassword = async (password, storedHash) => {
    const [salt, key] = String(storedHash || '').split(':');
    if (!salt || !key) return false;
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    const storedKey = Buffer.from(key, 'hex');
    const candidateKey = Buffer.from(derivedKey);
    return storedKey.length === candidateKey.length && crypto.timingSafeEqual(storedKey, candidateKey);
};

export const createToken = (payload, secret, expiresInSeconds = 28800) => {
    const body = encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }));
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
        return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
    } catch {
        return null;
    }
};
