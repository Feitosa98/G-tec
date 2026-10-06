import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInstallments } from '../web/src/utils/installmentPayments.js';

test('general receipts settle three installments and partially settle the fourth', () => {
    const installments = Array.from({ length: 10 }, (_, i) => ({ id: String(i), amount: 475, status: 'Pendente' }));
    const result = reconcileInstallments({ installments, payments: [{ amount: 250 }, { amount: 1250 }] });
    assert.deepEqual(result.slice(0, 4).map(p => [p.status, p.paidTotal, p.balanceDue]), [
        ['Pago', 475, 0], ['Pago', 475, 0], ['Pago', 475, 0], ['Parcial', 75, 400],
    ]);
    assert.deepEqual(reconcileInstallments({ installments: result, paidTotal: 1500 }), result);
});

test('targeted paid installment is not allocated twice', () => {
    const result = reconcileInstallments({ installments: [{ value: 100 }, { value: 100, status: 'Pago' }], payments: [{ amount: 100, installmentId: 'second' }] });
    assert.equal(result[0].balanceDue, 100);
    assert.equal(result[1].balanceDue, 0);
});

test('full payment status settles every installment', () => {
    assert.equal(reconcileInstallments({ installments: [{ value: 100 }], paymentStatus: 'Pago' })[0].status, 'Pago');
});

test('settling the remaining balance of a partial installment preserves earlier receipts', () => {
    const payments = [{ amount: 1500 }];
    const installments = reconcileInstallments({ installments: Array.from({ length: 10 }, () => ({ value: 475 })), payments });
    installments[3] = { ...installments[3], paid: true, status: 'Pago', allocatedByReceipts: false };
    const result = reconcileInstallments({ installments, payments: [...payments, { amount: 400 }] });
    assert.deepEqual(result.slice(0, 4).map(p => p.status), ['Pago', 'Pago', 'Pago', 'Pago']);
    assert.equal(result[4].balanceDue, 475);
});
