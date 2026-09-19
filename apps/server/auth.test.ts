import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { createToken, hashPassword, passwordNeedsRehash, verifyPassword, verifyToken } from './auth.js';

test('hashPassword valida somente a senha correta', async () => {
    const hash = await hashPassword('senha-forte-123');
    assert.equal(await verifyPassword('senha-forte-123', hash), true);
    assert.equal(await verifyPassword('senha-incorreta', hash), false);
    assert.notEqual(hash, 'senha-forte-123');
    assert.equal(passwordNeedsRehash(hash), false);
});

test('hashes antigos continuam válidos e são identificados para atualização', async () => {
    const legacyScrypt = promisify(crypto.scrypt);
    const salt = '00112233445566778899aabbccddeeff';
    const key = await legacyScrypt('senha-antiga-123', salt, 64) as Buffer;
    const legacyHash = `${salt}:${key.toString('hex')}`;
    assert.equal(await verifyPassword('senha-antiga-123', legacyHash), true);
    assert.equal(passwordNeedsRehash(legacyHash), true);
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
