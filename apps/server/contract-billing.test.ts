import test from 'node:test';
import assert from 'node:assert/strict';
import { contractBillingRows } from '../web/src/utils/contractBilling.js';

test('separa parcelas vencidas, de hoje e pagas sem contar recebimento duas vezes', () => {
    const rows = contractBillingRows([{ id: 's', subscriptionId: 'c', total: 300, paidTotal: 150, installments: [
        { amount: 100, dueDate: '2026-09-01', status: 'Pago' },
        { amount: 100, dueDate: '2026-09-10' },
        { amount: 100, dueDate: '2026-09-18' },
    ] }], [], '2026-09-18');
    assert.deepEqual(rows.map(row => [row.paid, row.overdue, row.upcoming]), [[100, 0, 0], [50, 50, 0], [0, 0, 100]]);
    assert.equal(rows.reduce((sum, row) => sum + row.total, 0), 300);
});
test('exclui canceladas e não presume data de vencimento ausente', () => {
    const rows = contractBillingRows([
        { id: 'a', subscriptionId: 'c', total: 100, status: 'Cancelado' },
        { id: 'b', subscriptionId: 'c', total: 200 },
        { id: 'c', total: 500 },
    ], [], '2026-09-18');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].undated, 200);
});
test('quitação integral prevalece sobre parcelas desatualizadas', () => {
    const rows = contractBillingRows([{ id: 's', subscriptionId: 'c', paymentStatus: 'Pago', installments: [{ amount: 90.15, dueDate: '2026-09-01' }] }], [], '2026-09-18');
    assert.equal(rows[0].paid, 90.15);
    assert.equal(rows[0].overdue, 0);
});
