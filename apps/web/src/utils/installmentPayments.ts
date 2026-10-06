const cents = (value: any) => Math.max(0, Math.round((Number(value) || 0) * 100));

// Reconcile general receipts with installments without counting targeted receipts twice.
export function reconcileInstallments(record: any) {
    const parts = record.installments?.length ? record.installments : record.subscriptionId ? [{
        id: `monthly-${record.id}`, number: 1, amount: record.total, value: record.total,
        dueDate: String(record.paymentTerms?.firstDueDate || record.dueDate || '').slice(0, 10),
        status: 'Pendente',
    }] : [];
    const payments = record.payments || [];
    const explicit = parts.map((part: any) => part.allocatedByReceipts && Array.isArray(record.payments)
        ? 0 : part.paid || ['Pago', 'Paga'].includes(part.status)
            ? cents(part.value ?? part.amount) : cents(part.paidTotal));
    const recorded = Array.isArray(record.payments) ? payments.reduce((sum: number, p: any) => sum + cents(p.principalAmount ?? p.amount), 0) : cents(record.paidTotal);
    let available = Math.max(0, recorded - explicit.reduce((sum: number, value: number) => sum + value, 0));
    const fullyPaid = record.paid || ['Pago', 'Paga'].includes(record.paymentStatus) || ['Pago', 'Paga'].includes(record.status);
    return parts.map((part: any, index: number) => {
        if (['Cancelado', 'Cancelada'].includes(part.status)) return part;
        const total = cents(part.value ?? part.amount);
        const allocated = Math.min(Math.max(0, total - explicit[index]), available);
        available -= allocated;
        const paidTotal = fullyPaid ? total : Math.min(total, explicit[index] + allocated);
        const paid = total > 0 && paidTotal >= total;
        return { ...part, value: total / 100, paidTotal: paidTotal / 100, balanceDue: (total - paidTotal) / 100, paid, allocatedByReceipts: allocated > 0 || part.allocatedByReceipts || false, status: paid ? 'Pago' : paidTotal ? 'Parcial' : 'Pendente' };
    });
}
