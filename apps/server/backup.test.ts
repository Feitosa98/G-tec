import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_COLLECTIONS, createBackupDocument, encryptBackupDocument, validateBackupDocument } from './backup.js';

const collections = () => Object.fromEntries(BACKUP_COLLECTIONS.map(collection => [collection, []]));

test('cria e valida backup versão 2 para a mesma empresa', () => {
    const data = collections();
    data.products = [{ id: 'produto-1', name: 'Produto' }];
    const backup = createBackupDocument('f2-informatica', { businessName: 'F2 Informática' }, data);
    const validated = validateBackupDocument(backup, 'f2-informatica');
    assert.equal(validated.legacy, false);
    assert.equal(validated.collections.products.length, 1);
});

test('recusa backup alterado depois de gerado', () => {
    const backup = createBackupDocument('f2-informatica', {}, collections());
    backup.collections.products.push({ id: 'injetado' });
    assert.throws(() => validateBackupDocument(backup, 'f2-informatica'), /corrompido|alterado/);
});

test('recusa restaurar backup de outra empresa', () => {
    const backup = createBackupDocument('outra-empresa', {}, collections());
    assert.throws(() => validateBackupDocument(backup, 'f2-informatica'), /outra empresa/);
});

test('aceita o formato legado com aviso de compatibilidade', () => {
    const backup = { exportedAt: new Date().toISOString(), tenant: 'f2-informatica', products: [{ id: 'p1' }] };
    const validated = validateBackupDocument(backup, 'f2-informatica');
    assert.equal(validated.legacy, true);
    assert.equal(validated.collections.products.length, 1);
    assert.equal(validated.collections.sales, undefined);
});

test('criptografa o backup automático e restaura somente com a chave correta', () => {
    const backup = createBackupDocument('f2-informatica', {}, collections());
    const encrypted = encryptBackupDocument(backup, 'uma-chave-segura-de-teste-com-32-caracteres');
    assert.equal(JSON.stringify(encrypted).includes('f2-informatica'), false);
    assert.equal(validateBackupDocument(encrypted, 'f2-informatica', 'uma-chave-segura-de-teste-com-32-caracteres').legacy, false);
    assert.throws(() => validateBackupDocument(encrypted, 'f2-informatica', 'outra-chave-segura-de-teste-com-32-caracteres'), /corrompido|outra instalação/);
});
