import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNfeAccessKey, parseNfePurchaseXml } from './services/nfe-distribution.js';

test('valida e separa os campos da chave de NF-e informada', () => {
    const parsed = parseNfeAccessKey('3526 0838 0677 1200 0109 5500 2001 3241 3812 2476 5814');
    assert.equal(parsed.key, '35260838067712000109550020013241381224765814');
    assert.equal(parsed.issuerDocument, '38067712000109');
    assert.equal(parsed.model, '55');
    assert.equal(parsed.series, '002');
    assert.equal(parsed.number, '001324138');
});

test('rejeita chave de NF-e com dígito verificador incorreto', () => {
    assert.throws(() => parseNfeAccessKey('35260838067712000109550020013241381224765815'), /dígito verificador/);
});

test('extrai produtos, NCM e tributos do XML autorizado com namespace', () => {
    const xml = `<?xml version="1.0"?><nfe:nfeProc xmlns:nfe="http://www.portalfiscal.inf.br/nfe"><nfe:NFe><nfe:infNFe Id="NFe35260838067712000109550020013241381224765814"><nfe:emit><nfe:CNPJ>38067712000109</nfe:CNPJ><nfe:xNome>Fornecedor Teste</nfe:xNome></nfe:emit><nfe:det nItem="1"><nfe:prod><nfe:cProd>ABC1</nfe:cProd><nfe:cEAN>SEM GTIN</nfe:cEAN><nfe:xProd>Produto Fiscal</nfe:xProd><nfe:NCM>84713012</nfe:NCM><nfe:CEST>2105300</nfe:CEST><nfe:CFOP>5102</nfe:CFOP><nfe:uCom>UN</nfe:uCom><nfe:qCom>2.0000</nfe:qCom><nfe:vUnCom>100.00</nfe:vUnCom><nfe:vProd>200.00</nfe:vProd></nfe:prod><nfe:imposto><nfe:ICMS><nfe:ICMS00><nfe:orig>0</nfe:orig><nfe:CST>00</nfe:CST><nfe:vBC>200.00</nfe:vBC><nfe:pICMS>18.00</nfe:pICMS><nfe:vICMS>36.00</nfe:vICMS></nfe:ICMS00></nfe:ICMS><nfe:IPI><nfe:cEnq>999</nfe:cEnq><nfe:IPITrib><nfe:CST>50</nfe:CST><nfe:pIPI>5.00</nfe:pIPI><nfe:vIPI>10.00</nfe:vIPI></nfe:IPITrib></nfe:IPI><nfe:PIS><nfe:PISAliq><nfe:CST>01</nfe:CST><nfe:pPIS>1.65</nfe:pPIS><nfe:vPIS>3.30</nfe:vPIS></nfe:PISAliq></nfe:PIS><nfe:COFINS><nfe:COFINSAliq><nfe:CST>01</nfe:CST><nfe:pCOFINS>7.60</nfe:pCOFINS><nfe:vCOFINS>15.20</nfe:vCOFINS></nfe:COFINSAliq></nfe:COFINS><nfe:IBSCBS><nfe:CST>000</nfe:CST><nfe:cClassTrib>000001</nfe:cClassTrib><nfe:gIBSCBS><nfe:vBC>200.00</nfe:vBC><nfe:pIBSUF>0.10</nfe:pIBSUF><nfe:vIBS>0.20</nfe:vIBS><nfe:pCBS>0.90</nfe:pCBS><nfe:vCBS>1.80</nfe:vCBS></nfe:gIBSCBS></nfe:IBSCBS></nfe:imposto></nfe:det></nfe:infNFe></nfe:NFe></nfe:nfeProc>`;
    const result = parseNfePurchaseXml(xml);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, 'Produto Fiscal');
    assert.equal(result.items[0].ncm, '84713012');
    assert.equal(result.items[0].cest, '2105300');
    assert.equal(result.items[0].fiscal.icmsCst, '00');
    assert.equal(result.items[0].fiscal.icmsRate, 18);
    assert.equal(result.items[0].fiscal.ipiRate, 5);
    assert.equal(result.items[0].fiscal.pisRate, 1.65);
    assert.equal(result.items[0].fiscal.cofinsRate, 7.6);
    assert.equal(result.items[0].fiscal.ibsCbsCst, '000');
    assert.equal(result.items[0].fiscal.taxClassification, '000001');
});
