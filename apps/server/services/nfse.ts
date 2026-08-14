import crypto from 'node:crypto';
import https from 'node:https';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const NFSE_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
export const NFSE_HOMOLOGATION_BASE_URL = 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional';
const NFSE_HOMOLOGATION_PARAMETERS_BASE_URL = 'https://adn.producaorestrita.nfse.gov.br/parametrizacao';

const digits = (value: unknown) => String(value || '').replace(/\D/g, '');
const escapeXml = (value: unknown) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const encryptionKey = (secret: string) => {
    if (!secret || secret.length < 32) throw new Error('NFSE_SECRET_KEY não configurada ou deve ter pelo menos 32 caracteres.');
    return crypto.createHash('sha256').update(secret).digest();
};

export const encryptNfseSecret = (value: string, secret: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
};

export const decryptNfseSecret = (payload: string, secret: string) => {
    const [version, iv, tag, encrypted] = String(payload || '').split(':');
    if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Credencial fiscal armazenada em formato inválido.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
};

const parsePfx = (pfxBase64: string, passphrase: string) => {
    try {
        const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(pfxBase64));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
            || p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]
            || [];
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
        const privateKey = keyBags.find(bag => bag.key)?.key;
        const certificate = certBags.find(bag => bag.cert)?.cert;
        if (!privateKey || !certificate) throw new Error('Certificado ou chave privada não encontrados no arquivo A1.');
        return {
            privateKeyPem: forge.pki.privateKeyToPem(privateKey),
            certificatePem: forge.pki.certificateToPem(certificate),
            certificate,
        };
    } catch (error: any) {
        if (String(error?.message).includes('Certificado ou chave')) throw error;
        throw new Error('Não foi possível abrir o certificado A1. Confira o arquivo e a senha.');
    }
};

export const inspectNfseCertificate = (pfxBase64: string, passphrase: string) => {
    const { certificatePem, certificate } = parsePfx(pfxBase64, passphrase);
    const subject = certificate.subject.attributes
        .map(attribute => `${attribute.shortName || attribute.name}=${attribute.value}`)
        .join(', ');
    return {
        subject,
        validFrom: certificate.validity.notBefore.toISOString(),
        validTo: certificate.validity.notAfter.toISOString(),
        fingerprint: crypto.createHash('sha256').update(certificatePem).digest('hex').match(/.{1,2}/g)?.join(':') || '',
    };
};

const xmlElement = (name: string, value: unknown, optional = false) => {
    if (optional && (value === undefined || value === null || value === '')) return '';
    return `<${name}>${escapeXml(value)}</${name}>`;
};

const personXml = (tag: string, person: any) => {
    const document = digits(person?.document);
    if (![11, 14].includes(document.length)) return '';
    const name = String(person?.name || '').trim();
    if (!name) throw new Error('Informe o nome do tomador do serviço.');
    const documentTag = document.length === 14 ? 'CNPJ' : 'CPF';
    const phone = digits(person.phone);
    const validPhone = phone.length >= 6 && phone.length <= 20 ? phone : '';
    const email = String(person.email || '').trim().slice(0, 80);
    return `<${tag}>${xmlElement(documentTag, document)}${xmlElement('xNome', name)}${xmlElement('fone', validPhone, true)}${xmlElement('email', email, true)}</${tag}>`;
};

const toManausFiscalDateTime = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Manaus',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}-04:00`;
};

export const buildAndSignDps = (input: {
    tenant: any;
    config: any;
    order: any;
    customer: any;
    dpsNumber: number;
    pfxBase64: string;
    passphrase: string;
}) => {
    const { tenant, config, order, customer, dpsNumber, pfxBase64, passphrase } = input;
    const issuerDocument = digits(tenant.document);
    if (issuerDocument.length !== 14) throw new Error('O CNPJ do prestador deve conter 14 dígitos.');
    const municipalityCode = digits(config.municipalityCode);
    if (municipalityCode.length !== 7) throw new Error('Informe o código IBGE de 7 dígitos do município emissor.');
    const series = String(Number(config.dpsSeries || 1));
    if (Number(series) < 1 || Number(series) > 49999) throw new Error('A série da DPS deve estar entre 1 e 49999 para emissor próprio.');
    const nationalServiceCode = digits(config.nationalServiceCode);
    if (nationalServiceCode.length !== 6) throw new Error('Informe o código de tributação nacional do serviço com 6 dígitos.');

    const serviceItems = (order.items || []).filter((item: any) =>
        String(item.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().startsWith('servi')
    );
    const serviceTotal = serviceItems.length
        ? serviceItems.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.qty || 1), 0)
        : Number(order.totalValue || 0);
    if (!Number.isFinite(serviceTotal) || serviceTotal <= 0) throw new Error('A ordem não possui valor de serviço válido.');

    const description = serviceItems.length
        ? serviceItems.map((item: any) => `${item.name} (${Number(item.qty || 1)} x R$ ${Number(item.price || 0).toFixed(2)})`).join('; ')
        : String(order.issueDescription || order.orderType || 'Prestação de serviço');
    const paddedSeries = series.padStart(5, '0');
    const paddedNumber = String(dpsNumber).padStart(15, '0');
    const dpsId = `DPS${municipalityCode}2${issuerDocument}${paddedSeries}${paddedNumber}`;
    const emittedAt = new Date();
    const competence = String(order.completedAt || order.createdAt || emittedAt.toISOString()).slice(0, 10);
    const customerData = {
        document: customer?.document || order.clientDocument,
        name: order.clientName || customer?.name,
        phone: order.clientPhone || customer?.phone,
        email: order.clientEmail || customer?.email,
    };
    const rawMunicipalRegistration = digits(config.municipalRegistration);
    const municipalRegistration = rawMunicipalRegistration ? rawMunicipalRegistration.padStart(15, '0') : '';
    const municipalTaxCode = digits(config.municipalServiceCode);
    const applicationVersion = 'FeitosaSolucoes-1.0';
    const regime = Number(config.simpleNationalStatus || 1);
    const simpleRegime = regime === 3 ? xmlElement('regApTribSN', Number(config.simpleNationalTaxRegime || 1)) : '';
    const federalAndTotalTaxXml = regime === 3
        ? `<tribFed><piscofins>${xmlElement('CST', '00')}</piscofins></tribFed><totTrib>${xmlElement('pTotTribSN', '6.00')}</totTrib>`
        : `<totTrib>${xmlElement('indTotTrib', 0)}</totTrib>`;

    const internalCode = String(order.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const unsignedXml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="${NFSE_NAMESPACE}" versao="1.01"><infDPS Id="${dpsId}">${xmlElement('tpAmb', 2)}${xmlElement('dhEmi', toManausFiscalDateTime(emittedAt))}${xmlElement('verAplic', applicationVersion)}${xmlElement('serie', Number(series))}${xmlElement('nDPS', dpsNumber)}${xmlElement('dCompet', competence)}${xmlElement('tpEmit', 1)}${xmlElement('cLocEmi', municipalityCode)}<prest>${xmlElement('CNPJ', issuerDocument)}${xmlElement('IM', municipalRegistration, true)}<regTrib>${xmlElement('opSimpNac', regime)}${simpleRegime}${xmlElement('regEspTrib', Number(config.specialTaxRegime || 0))}</regTrib></prest>${personXml('toma', customerData)}<serv><locPrest>${xmlElement('cLocPrestacao', municipalityCode)}</locPrest><cServ>${xmlElement('cTribNac', nationalServiceCode)}${xmlElement('cTribMun', municipalTaxCode, true)}${xmlElement('xDescServ', description.slice(0, 2000))}${xmlElement('cIntContrib', internalCode, true)}</cServ></serv><valores><vServPrest>${xmlElement('vServ', serviceTotal.toFixed(2))}</vServPrest><trib><tribMun>${xmlElement('tribISSQN', Number(config.issTaxation || 1))}${xmlElement('tpRetISSQN', Number(config.issWithholding || 1))}</tribMun>${federalAndTotalTaxXml}</trib></valores></infDPS></DPS>`;

    const { privateKeyPem, certificatePem } = parsePfx(pfxBase64, passphrase);
    const signer = new SignedXml({
        privateKey: privateKeyPem,
        publicCert: certificatePem,
        canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        getKeyInfoContent: SignedXml.getKeyInfoContent,
    });
    signer.addReference({
        xpath: `//*[local-name(.)='infDPS' and @Id='${dpsId}']`,
        transforms: [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        ],
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
        uri: `#${dpsId}`,
    });
    signer.computeSignature(unsignedXml, {
        location: { reference: "/*[local-name(.)='DPS']", action: 'append' },
    });
    return { signedXml: signer.getSignedXml(), dpsId, serviceTotal, emittedAt: emittedAt.toISOString() };
};

const httpsJson = (url: URL, options: https.RequestOptions, body?: string) => new Promise<{ status: number; data: any; raw: string }>((resolve, reject) => {
    const request = https.request(url, options, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let data: any = raw;
            try { data = raw ? JSON.parse(raw) : {}; } catch { /* resposta não JSON */ }
            resolve({ status: response.statusCode || 0, data, raw });
        });
    });
    request.setTimeout(30000, () => request.destroy(new Error('Tempo limite excedido na comunicação com a NFS-e Nacional.')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
});

const tlsOptions = (pfxBase64: string, passphrase: string): https.RequestOptions => ({
    pfx: Buffer.from(pfxBase64, 'base64'),
    passphrase,
    rejectUnauthorized: true,
});

export const testNfseHomologationConnection = async (municipalityCode: string, pfxBase64: string, passphrase: string) => {
    const url = new URL(`${NFSE_HOMOLOGATION_PARAMETERS_BASE_URL}/${digits(municipalityCode)}/convenio`);
    return httpsJson(url, { ...tlsOptions(pfxBase64, passphrase), method: 'GET', headers: { Accept: 'application/json' } });
};

export const transmitDpsToHomologation = async (signedXml: string, pfxBase64: string, passphrase: string) => {
    const compressed = await gzipAsync(Buffer.from(signedXml, 'utf8'));
    const body = JSON.stringify({ dpsXmlGZipB64: compressed.toString('base64') });
    const url = new URL(`${NFSE_HOMOLOGATION_BASE_URL}/nfse`);
    const response = await httpsJson(url, {
        ...tlsOptions(pfxBase64, passphrase),
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    let authorizedXml = '';
    const compressedXml = response.data?.nfseXmlGZipB64;
    if (compressedXml) authorizedXml = (await gunzipAsync(Buffer.from(compressedXml, 'base64'))).toString('utf8');
    return { ...response, authorizedXml };
};
