import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptSecret, decryptStoredSecret, encryptSecret, isEncryptedValue, maskSecret } from './security.js';

const secret = 'chave-de-teste-segura-com-mais-de-32-caracteres';

test('protege credenciais com contexto e autenticação', () => {
    const encrypted = encryptSecret('credencial-sensivel', secret, 'tenant:campo');
    assert.equal(isEncryptedValue(encrypted), true);
    assert.notEqual(encrypted, 'credencial-sensivel');
    assert.equal(decryptSecret(encrypted, secret, 'tenant:campo'), 'credencial-sensivel');
    assert.throws(() => decryptSecret(encrypted, secret, 'outro-contexto'), /authenticate|authentic/i);
});

test('aceita texto legado somente durante a migração e mascara respostas', () => {
    assert.equal(decryptStoredSecret('legado', secret, 'tenant:campo'), 'legado');
    assert.equal(maskSecret('segredo'), '••••••••••••');
    assert.equal(maskSecret(''), '');
});
