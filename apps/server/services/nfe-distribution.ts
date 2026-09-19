import https from 'node:https';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { DOMParser } from '@xmldom/xmldom';

const gunzipAsync = promisify(gunzip);
const DISTRIBUTION_URL = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';

const stateCodes: Record<string, string> = {
    AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32', GO: '52',
    MA: '21', MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41', PE: '26', PI: '22',
    RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
};

export const parseNfeAccessKey = (rawKey: string) => {
    const key = String(rawKey || '').replace(/\D/g, '');
    if (key.length !== 44) throw new Error('A chave da NF-e deve ter exatamente 44 números.');
    let weight = 2;
    let sum = 0;
    for (let index = 42; index >= 0; index -= 1) {
        sum += Number(key[index]) * weight;
        weight = weight === 9 ? 2 : weight + 1;
    }
    const calculated = 11 - (sum % 11);
    const digit = calculated >= 10 ? 0 : calculated;
    if (digit !== Number(key[43])) throw new Error('A chave da NF-e possui dígito verificador inválido.');
    return {
        key,
        stateCode: key.slice(0, 2),
        yearMonth: key.slice(2, 6),
        issuerDocument: key.slice(6, 20),
        model: key.slice(20, 22),
        series: key.slice(22, 25),
        number: key.slice(25, 34),
        emissionType: key.slice(34, 35),
    };
};

const postSoap = (body: string, pfxBase64: string, passphrase: string) => new Promise<string>((resolve, reject) => {
    const request = https.request(DISTRIBUTION_URL, {
        method: 'POST',
        pfx: Buffer.from(pfxBase64, 'base64'),
        passphrase,
        minVersion: 'TLSv1.2',
        timeout: 20_000,
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
            SOAPAction: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': 'FeitosaSolucoes/1.0',
        },
    }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
            const content = Buffer.concat(chunks).toString('utf8');
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`A SEFAZ respondeu com HTTP ${response.statusCode || 0}.`));
            }
            resolve(content);
        });
    });
    request.on('timeout', () => request.destroy(new Error('A consulta à SEFAZ excedeu o tempo limite.')));
    request.on('error', reject);
    request.end(body);
});

const xmlText = (document: Document, tag: string) => {
    const node = document.getElementsByTagNameNS('*', tag)[0] || document.getElementsByTagName(tag)[0];
    return node?.textContent?.trim() || '';
};

const childElements = (parent: any, tag: string) => Array.from(
    parent?.getElementsByTagNameNS?.('*', tag)?.length
        ? parent.getElementsByTagNameNS('*', tag)
        : parent?.getElementsByTagName?.(tag) || [],
) as any[];

const childText = (parent: any, tag: string) => {
    const node = childElements(parent, tag)[0];
    return String(node?.textContent || '').trim();
};

const numberText = (parent: any, tag: string) => {
    const value = childText(parent, tag).replace(',', '.');
    return value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);
};

const taxGroup = (taxes: any, tag: string) => childElements(taxes, tag)[0];

/**
 * Converte o XML autorizado da NF-e em dados de entrada de estoque. Os campos
 * fiscais são mantidos no produto para poderem ser reaproveitados por uma
 * futura emissão, sem recalcular ou presumir a tributação da nota de compra.
 */
export const parseNfePurchaseXml = (xml: string) => {
    const document = new DOMParser().parseFromString(String(xml || ''), 'application/xml') as unknown as Document;
    const parserError = childElements(document, 'parsererror')[0];
    if (parserError) throw new Error('O XML retornado pela SEFAZ está inválido.');

    const infNfe = childElements(document, 'infNFe')[0];
    if (!infNfe) throw new Error('O XML não contém uma NF-e autorizada.');
    const key = String(infNfe.getAttribute?.('Id') || '').replace(/^NFe/i, '').replace(/\D/g, '');
    const issuer = childElements(infNfe, 'emit')[0];
    const issuerAddress = childElements(issuer, 'enderEmit')[0];
    const supplierDetails = {
        name: childText(issuer, 'xNome') || childText(issuer, 'xFant') || 'Fornecedor não identificado',
        cnpj: childText(issuer, 'CNPJ') || childText(issuer, 'CPF'),
        phone: childText(issuer, 'fone'),
        email: childText(issuer, 'email'),
        address: [
            childText(issuerAddress, 'xLgr'), childText(issuerAddress, 'nro'), childText(issuerAddress, 'xBairro'),
            childText(issuerAddress, 'xMun'), childText(issuerAddress, 'UF'), childText(issuerAddress, 'CEP'),
        ].filter(Boolean).join(', '),
        category: 'Fornecedor de produtos',
    };

    const items = childElements(infNfe, 'det').map((detail: any, index: number) => {
        const product = childElements(detail, 'prod')[0];
        const taxes = childElements(detail, 'imposto')[0];
        const icms = taxGroup(taxes, 'ICMS');
        const icmsDetail = icms && Array.from(icms.childNodes || []).find((node: any) => node.nodeType === 1);
        const ipi = taxGroup(taxes, 'IPI');
        const ipiDetail = ipi && (taxGroup(ipi, 'IPITrib') || taxGroup(ipi, 'IPINT'));
        const pis = taxGroup(taxes, 'PIS');
        const pisDetail = pis && Array.from(pis.childNodes || []).find((node: any) => node.nodeType === 1);
        const cofins = taxGroup(taxes, 'COFINS');
        const cofinsDetail = cofins && Array.from(cofins.childNodes || []).find((node: any) => node.nodeType === 1);
        const ibsCbs = taxGroup(taxes, 'IBSCBS');
        const ibsCbsDetail = ibsCbs && taxGroup(ibsCbs, 'gIBSCBS');
        const quantity = numberText(product, 'qCom') || 1;
        const costPrice = numberText(product, 'vUnCom') || 0;

        return {
            id: `${key || 'nfe'}-${detail.getAttribute?.('nItem') || index + 1}`,
            name: childText(product, 'xProd') || `Produto ${index + 1}`,
            barcode: childText(product, 'cEAN').toUpperCase() === 'SEM GTIN' ? '' : childText(product, 'cEAN'),
            taxableBarcode: childText(product, 'cEANTrib').toUpperCase() === 'SEM GTIN' ? '' : childText(product, 'cEANTrib'),
            sku: childText(product, 'cProd'),
            ncm: childText(product, 'NCM').replace(/\D/g, ''),
            cest: childText(product, 'CEST').replace(/\D/g, ''),
            cfop: childText(product, 'CFOP').replace(/\D/g, ''),
            unit: childText(product, 'uCom') || 'UN',
            taxableUnit: childText(product, 'uTrib') || childText(product, 'uCom') || 'UN',
            stock: quantity,
            costPrice,
            price: Number((costPrice * 1.3).toFixed(2)),
            invoiceTotal: numberText(product, 'vProd'),
            category: 'Office', department: 'Hardware', brand: '',
            fiscal: {
                origin: childText(icmsDetail, 'orig'),
                icmsCst: childText(icmsDetail, 'CST'),
                csosn: childText(icmsDetail, 'CSOSN'),
                icmsBaseMode: childText(icmsDetail, 'modBC'),
                icmsBase: numberText(icmsDetail, 'vBC'),
                icmsRate: numberText(icmsDetail, 'pICMS'),
                icmsValue: numberText(icmsDetail, 'vICMS'),
                icmsStBaseMode: childText(icmsDetail, 'modBCST'),
                icmsStBase: numberText(icmsDetail, 'vBCST'),
                icmsStRate: numberText(icmsDetail, 'pICMSST'),
                icmsStValue: numberText(icmsDetail, 'vICMSST'),
                ipiCst: childText(ipiDetail, 'CST'),
                ipiLegalCode: childText(ipi, 'cEnq'),
                ipiRate: numberText(ipiDetail, 'pIPI'),
                ipiValue: numberText(ipiDetail, 'vIPI'),
                pisCst: childText(pisDetail, 'CST'),
                pisRate: numberText(pisDetail, 'pPIS'),
                pisValue: numberText(pisDetail, 'vPIS'),
                cofinsCst: childText(cofinsDetail, 'CST'),
                cofinsRate: numberText(cofinsDetail, 'pCOFINS'),
                cofinsValue: numberText(cofinsDetail, 'vCOFINS'),
                ibsCbsCst: childText(ibsCbs, 'CST'),
                taxClassification: childText(ibsCbs, 'cClassTrib'),
                ibsCbsBase: numberText(ibsCbsDetail, 'vBC'),
                ibsRate: numberText(ibsCbsDetail, 'pIBSUF'),
                ibsValue: numberText(ibsCbsDetail, 'vIBS'),
                cbsRate: numberText(ibsCbsDetail, 'pCBS'),
                cbsValue: numberText(ibsCbsDetail, 'vCBS'),
                benefitCode: childText(icmsDetail, 'cBenef'),
            },
        };
    });

    if (!items.length) throw new Error('O XML autorizado não contém produtos para importar.');
    return { key, supplier: supplierDetails.name, supplierDetails, items };
};

export const fetchNfeXmlByAccessKey = async (input: {
    key: string; companyDocument: string; companyState: string; pfxBase64: string; passphrase: string;
}) => {
    const parsed = parseNfeAccessKey(input.key);
    const companyDocument = String(input.companyDocument || '').replace(/\D/g, '');
    if (companyDocument.length !== 14) throw new Error('O CNPJ da empresa precisa estar completo para consultar a SEFAZ.');
    const authorStateCode = stateCodes[String(input.companyState || '').trim().toUpperCase()];
    if (!authorStateCode) throw new Error('O estado da empresa precisa estar configurado para consultar a SEFAZ.');
    const requestXml = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><cUFAutor>${authorStateCode}</cUFAutor><CNPJ>${companyDocument}</CNPJ><consChNFe><chNFe>${parsed.key}</chNFe></consChNFe></distDFeInt>`;
    const soap = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${requestXml}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
    const responseXml = await postSoap(soap, input.pfxBase64, input.passphrase);
    const document = new DOMParser().parseFromString(responseXml, 'application/xml') as unknown as Document;
    const status = xmlText(document, 'cStat');
    const reason = xmlText(document, 'xMotivo');
    const nodes = Array.from(document.getElementsByTagNameNS('*', 'docZip').length
        ? document.getElementsByTagNameNS('*', 'docZip')
        : document.getElementsByTagName('docZip'));
    const documents: Array<{ schema: string; xml: string }> = [];
    for (const node of nodes) {
        const compressed = String(node.textContent || '').trim();
        if (!compressed) continue;
        const xml = (await gunzipAsync(Buffer.from(compressed, 'base64'))).toString('utf8');
        documents.push({ schema: node.getAttribute('schema') || '', xml });
    }
    const fullDocument = documents.find(item => /procNFe|nfeProc/i.test(item.schema)
        || /<(?:[\w.-]+:)?det(?:\s|>)/i.test(item.xml));
    return { status, reason, xml: fullDocument?.xml || '', documents: documents.map(item => item.schema) };
};
