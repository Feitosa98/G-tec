import assert from 'node:assert/strict';
import test from 'node:test';
import forge from 'node-forge';
import { fiscalCertificateSchema, prepareFiscalCertificate, publicFiscalCertificate } from './services/fiscal-certificate.js';
import { decryptNfseSecret } from './services/nfse.js';

const secret = 'fiscal-test-key-with-at-least-32-characters';
const password = 'test-only-password';
const keys = forge.pki.rsa.generateKeyPair(1024);
const createCertificate = (from: number, to: number) => {
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(from);
    cert.validity.notAfter = new Date(to);
    cert.setSubject([{ name: 'commonName', value: 'EMPRESA FICTICIA - TESTE' }]);
    cert.setIssuer(cert.subject.attributes);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password);
    return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
};
const now = Date.now();
const validCertificate = createCertificate(now - 60_000, now + 86_400_000);

test('cadastra A1 sem campos de emissão e mantém formato compartilhado criptografado', () => {
    assert.equal(fiscalCertificateSchema.safeParse({ certificateBase64: validCertificate, certificatePassword: password }).success, true);
    const saved = prepareFiscalCertificate(validCertificate, password, secret);
    assert.equal(decryptNfseSecret(saved.certificateEncrypted, secret), validCertificate);
    assert.equal(decryptNfseSecret(saved.certificatePasswordEncrypted, secret), password);
    assert.match(saved.certificateSubject, /EMPRESA FICTICIA/);
    assert.equal(saved.lastConnectionStatus, '');
    assert.equal(saved.lastConnectionAt, '');
    assert.notEqual(saved.certificateEncrypted, validCertificate);
});

test('status público não revela arquivo, senha nem campos privados adicionais', () => {
    const fields = prepareFiscalCertificate(validCertificate, password, secret);
    const result = publicFiscalCertificate({ ...fields, certificateBase64: validCertificate, certificatePassword: password, enabled: true }, true);
    assert.equal(result.certificateConfigured, true);
    assert.equal(result.serverConfigured, true);
    assert.deepEqual(Object.keys(result).sort(), ['serverConfigured', 'certificateConfigured', 'certificateSubject', 'certificateValidFrom', 'certificateValidTo', 'certificateFingerprint'].sort());
    assert.equal(JSON.stringify(result).includes(password), false);
    assert.equal(publicFiscalCertificate(null, false).certificateConfigured, false);
    assert.equal(publicFiscalCertificate(null, false).serverConfigured, false);
});

test('recusa senha incorreta, arquivo inválido e certificado fora da validade', () => {
    assert.throws(() => prepareFiscalCertificate(validCertificate, 'wrong-password', secret), /arquivo e a senha/);
    assert.throws(() => prepareFiscalCertificate('nao-e-um-pfx', password, secret), /Certificado inválido/);
    assert.throws(() => prepareFiscalCertificate(createCertificate(now - 120_000, now - 60_000), password, secret), /vencido/);
    assert.throws(() => prepareFiscalCertificate(createCertificate(now + 60_000, now + 120_000), password, secret), /período de validade/);
});

test('recusa arquivo acima de 2 MB e alterações fiscais no cadastro de certificado', () => {
    assert.throws(() => prepareFiscalCertificate(Buffer.alloc(2_000_001).toString('base64'), password, secret), /até 2 MB/);
    assert.equal(fiscalCertificateSchema.safeParse({ certificateBase64: validCertificate, certificatePassword: '' }).success, false);
    assert.equal(fiscalCertificateSchema.safeParse({ certificateBase64: validCertificate, certificatePassword: password, enabled: true }).success, false);
    assert.throws(() => prepareFiscalCertificate(validCertificate, password, 'short'), /NFSE_SECRET_KEY/);
});
