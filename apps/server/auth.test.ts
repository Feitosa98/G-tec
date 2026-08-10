import assert from 'node:assert/strict';
import test from 'node:test';
import { createToken, hashPassword, verifyPassword, verifyToken } from './auth.js';

test('hashPassword valida somente a senha correta', async () => {
    const hash = await hashPassword('senha-forte-123');
    assert.equal(await verifyPassword('senha-forte-123', hash), true);
    assert.equal(await verifyPassword('senha-incorreta', hash), false);
    assert.notEqual(hash, 'senha-forte-123');
});

test('tokens assinados são validados e adulterações são rejeitadas', () => {
    const secret = 'segredo-de-teste-comprido-e-unico';
    const token = createToken({ role: 'admin', storeSlug: 'loja' }, secret, 60);
    assert.equal(verifyToken(token, secret)?.role, 'admin');
    assert.equal(verifyToken(`${token}x`, secret), null);
    assert.equal(verifyToken(token, 'outro-segredo-comprido-e-unico'), null);
});

test('tokens expirados são rejeitados', () => {
    const secret = 'segredo-de-teste-comprido-e-unico';
    const token = createToken({ role: 'admin' }, secret, -1);
    assert.equal(verifyToken(token, secret), null);
});
