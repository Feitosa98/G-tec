import assert from 'node:assert/strict';
import test from 'node:test';
import forge from 'node-forge';
import { buildAndSignDps, decryptNfseSecret, encryptNfseSecret } from './services/nfse.js';

test('protege e recupera a credencial fiscal', () => {
    const secret = 'segredo-de-teste-com-mais-de-32-caracteres';
    const original = 'conteudo-sensivel-do-certificado';
    const encrypted = encryptNfseSecret(original, secret);

    assert.notEqual(encrypted, original);
    assert.equal(decryptNfseSecret(encrypted, secret), original);
});

test('rejeita credencial fiscal adulterada ou chave incorreta', () => {
    const encrypted = encryptNfseSecret('senha-do-a1', 'segredo-principal-com-mais-de-32-caracteres');

    assert.throws(
        () => decryptNfseSecret(encrypted, 'outro-segredo-com-mais-de-32-caracteres'),
        /authenticate data|authentic/i,
    );
});

test('exige uma chave de proteção suficientemente longa', () => {
    assert.throws(() => encryptNfseSecret('valor', 'curta'), /NFSE_SECRET_KEY/);
});

test('monta e assina uma DPS 1.01 para homologação', () => {
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = keys.publicKey;
    certificate.serialNumber = '01';
    certificate.validity.notBefore = new Date(Date.now() - 60_000);
    certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
    certificate.setSubject([{ name: 'commonName', value: 'Certificado de teste' }]);
    certificate.setIssuer(certificate.subject.attributes);
    certificate.sign(keys.privateKey, forge.md.sha256.create());
    const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], 'senha-teste');
    const pfxBase64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());

    const result = buildAndSignDps({
        tenant: { document: '12345678000199', businessName: 'Feitosa Soluções em Informática' },
        config: {
            municipalityCode: '1302603', municipalRegistration: '12345', dpsSeries: 1,
            nationalServiceCode: '010101', municipalServiceCode: '', simpleNationalStatus: 3,
            simpleNationalTaxRegime: 1,
            specialTaxRegime: 0, issTaxation: 1, issWithholding: 1,
        },
        order: {
            id: 'abc-123', orderType: 'Manutenção', issueDescription: 'Manutenção de computador',
            totalValue: 150, items: [{ type: 'Serviço', name: 'Manutenção', qty: 1, price: 150 }],
            createdAt: '2026-08-12T12:00:00.000Z', clientName: 'Cliente Teste',
        },
        customer: null,
        dpsNumber: 1,
        pfxBase64,
        passphrase: 'senha-teste',
    });

    assert.match(result.dpsId, /^DPS13026032\d{14}000010{14}1$/);
    assert.match(result.signedXml, /<Signature/);
    assert.match(result.signedXml, /<dhEmi>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-04:00<\/dhEmi>/);
    assert.match(result.signedXml, /<IM>000000000012345<\/IM>/);
    assert.doesNotMatch(result.signedXml, /<prest>.*<xNome>/);
    assert.match(result.signedXml, /<regApTribSN>1<\/regApTribSN>/);
    assert.match(result.signedXml, /<tribFed><piscofins><CST>00<\/CST><\/piscofins><\/tribFed>/);
    assert.match(result.signedXml, /<totTrib><pTotTribSN>6\.00<\/pTotTribSN><\/totTrib>/);
    assert.match(result.signedXml, /URI="#DPS13026032/);
    assert.match(result.signedXml, /<cIntContrib>abc123<\/cIntContrib>/);
});
