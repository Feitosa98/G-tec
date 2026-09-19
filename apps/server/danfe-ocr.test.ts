import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDanfeText, pdfTextToLines } from '../web/src/utils/danfeOcr.js';

test('identifica chave, fornecedor e produto no texto de uma DANFE', () => {
    const result = parseDanfeText(`
        ACME TECNOLOGIA LTDA
        CNPJ 38.067.712/0001-09
        DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA
        CHAVE DE ACESSO 3526 0838 0677 1200 0109 5500 2001 3241 3812 2476 5814
        DADOS DOS PRODUTOS / SERVIÇOS
        CÓDIGO DESCRIÇÃO DO PRODUTO NCM/SH CST CFOP UN QUANT VALOR UNIT VALOR TOTAL
        001 CABO USB REFORÇADO 85444200 000 5102 UN 2,000 25,00 50,00
        DADOS ADICIONAIS
    `);
    assert.equal(result.key, '35260838067712000109550020013241381224765814');
    assert.equal(result.supplierDetails.cnpj, '38067712000109');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, 'CABO USB REFORÇADO');
    assert.equal(result.items[0].stock, 2);
    assert.equal(result.items[0].costPrice, 25);
});

test('aceita cabeçalho singular após transportador e descrição em duas linhas', () => {
    const result = parseDanfeText(`
RECEBEMOS DE FORNECEDOR TESTE LTDA OS PRODUTOS CONSTANTES DA NOTA
TRANSPORTADOR/VOLUMES TRANSPORTADOS
QUANTIDADE ESPECIE MARCA NUMERAÇÃO
DADOS DO PRODUTO / SERVIÇO
COD. PROD DESCRIÇÃO DO PROD./SERV. NCM/SH CST CFOP UN QUANT. V.UNITARIO V.TOTAL
AUT0077 LEITOR DE CODIGO DE BARRA 2D EL-860 84719012 420 5102 UN 1,0000 1.005,950 1.005,95 337,38 67,48 0,00
0IA FIXO (NACIONAL)
CALCULO DO ISSQN
DADOS ADICIONAIS`);
    assert.equal(result.supplier, 'FORNECEDOR TESTE LTDA');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].name, 'LEITOR DE CODIGO DE BARRA 2D EL-860 0IA FIXO (NACIONAL)');
    assert.equal(result.items[0].stock, 1);
    assert.equal(result.items[0].costPrice, 1005.95);
    assert.equal(result.items[0].selected, true);
});

test('lê tabelas repetidas em várias páginas sem incluir rodapés', () => {
    const result = parseDanfeText(`DADOS DOS PRODUTOS
001 CABO USB 85444200 000 5102 UN 2,000 25,00 50,00
DADOS ADICIONAIS
TEXTO QUE NÃO É PRODUTO
DADOS DO PRODUTO / SERVIÇO
002 ADAPTADOR USB 8471.90.12 5102 PC 1,000 40,00 40,00
CALCULO DO ISSQN`);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].name, 'CABO USB');
    assert.equal(result.items[1].ncm, '84719012');
});

test('não seleciona valores inconsistentes nem transforma quantidade zero em um', () => {
    const result = parseDanfeText(`DADOS DOS PRODUTOS
001 CABO USB 85444200 000 5102 UN 2,000 25,00 500,00
002 CABO SEM QUANTIDADE 85444200 000 5102 UN 0,000 25,00 0,00`);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].needsReview, true);
    assert.equal(result.items[0].selected, false);
});

test('reconstrói colunas por posição e preserva somente continuação da descrição', () => {
    const cell = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });
    const text = pdfTextToLines([
        cell('0', 390, 80), cell('0IA FIXO (NACIONAL)', 65, 80),
        cell('1,0000 1.005,950 1.005,95', 320, 90), cell('84719012', 240, 90),
        cell('AUT0077', 20, 90), cell('LEITOR EL-860', 65, 90), cell('420 5102 UN', 280, 90),
        cell('COD. PROD', 20, 100), cell('DESCRIÇÃO DO PROD./SERV.', 65, 100), cell('NCM/SH', 240, 100),
        cell('DADOS DO PRODUTO / SERVIÇO', 20, 115),
    ]);
    const parsed = parseDanfeText(text);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].name, 'LEITOR EL-860 0IA FIXO (NACIONAL)');
    assert.equal(parsed.items[0].costPrice, 1005.95);
});

test('recupera linha fragmentada e mantém código do produto', () => {
    const parsed = parseDanfeText(`DADOS DOS PRODUTOS
ABC-01 CABO USB
REFORÇADO
85444200 000 5102 UN 2 25,00 50,00`);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].sku, 'ABC-01');
    assert.equal(parsed.items[0].name, 'CABO USB REFORÇADO');
});
