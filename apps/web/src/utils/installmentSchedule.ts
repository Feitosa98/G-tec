const cents = (value: unknown) => Math.max(0, Math.round((Number(value) || 0) * 100));

// The upfront payment is a receipt, not another installment.  Build the
// schedule from the amount that remains after all receipts already entered.
export function calculateInstallmentAmounts(total: unknown, paidTotal: unknown, count: unknown) {
    const installments = Math.max(1, Math.min(60, Math.trunc(Number(count) || 1)));
    const remaining = Math.max(0, cents(total) - cents(paidTotal));
    const base = Math.floor(remaining / installments);

    return Array.from({ length: installments }, (_, index) => (
        (index === installments - 1 ? remaining - base * (installments - 1) : base) / 100
    ));
}
