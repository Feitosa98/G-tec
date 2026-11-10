import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateInstallmentAmounts } from '../web/src/utils/installmentSchedule.js';
import { reconcileInstallments } from '../web/src/utils/installmentPayments.js';

test('an entry is deducted before the remaining installments are calculated', () => {
    assert.deepEqual(calculateInstallmentAmounts(4800, 650, 4), [1037.5, 1037.5, 1037.5, 1037.5]);
});

test('a balance schedule does not deduct the entry twice from its first installment', () => {
    const parts = reconcileInstallments({
        installments: calculateInstallmentAmounts(4800, 650, 4).map(value => ({ value })),
        payments: [{ amount: 650 }],
        installmentPaymentOffset: 650,
    });
    assert.deepEqual(parts.map(part => [part.status, part.balanceDue]), [
        ['Pendente', 1037.5], ['Pendente', 1037.5], ['Pendente', 1037.5], ['Pendente', 1037.5],
    ]);
});
