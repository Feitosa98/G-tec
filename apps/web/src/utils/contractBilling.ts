const cents = (value: unknown) => Math.max(0, Math.round((Number(value) || 0) * 100));
const paidStatus = (item: any) => item.paid || ['Pago', 'Paga'].includes(item.paymentStatus) || ['Pago', 'Paga'].includes(item.status);
const cancelled = (item: any) => ['Cancelado', 'Cancelada'].includes(item.status) || ['Cancelado', 'Cancelada'].includes(item.paymentStatus);

export function contractBillingRows(sales: any[], subscriptions: any[], today: string) {
    return sales.filter(sale => sale.subscriptionId && !cancelled(sale)).flatMap(sale => {
        const contract = subscriptions.find(sub => sub.id === sale.subscriptionId);
        const parts = sale.installments?.length ? sale.installments : [{ amount: sale.total, dueDate: sale.paymentTerms?.firstDueDate || sale.dueDate }];
        const explicitPaid = parts.reduce((sum: number, part: any) => sum + (paidStatus(part) ? cents(part.amount ?? part.value) : cents(part.paidTotal)), 0);
        let remainingPaid = Math.max(0, cents(sale.paidTotal ?? (sale.payments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)) - explicitPaid);
        return parts.map((part: any, index: number) => {
            if (cancelled(part)) return null;
            const total = cents(part.amount ?? part.value);
            let paid = paidStatus(sale) || paidStatus(part) ? total : Math.min(total, cents(part.paidTotal));
            const allocated = Math.min(total - paid, remainingPaid);
            paid += allocated;
            remainingPaid -= allocated;
            const pending = total - paid;
            const due = String(part.dueDate || '').slice(0, 10);
            const status = !pending ? 'Pago' : !due ? 'Sem vencimento' : due < today ? 'Vencido' : 'A vencer';
            return { id: `${sale.id}-${index}`, client: contract?.clientName || sale.customerName || '', contract: contract?.planName || 'Contrato arquivado', due, total: total / 100, paid: paid / 100, overdue: status === 'Vencido' ? pending / 100 : 0, upcoming: status === 'A vencer' ? pending / 100 : 0, undated: status === 'Sem vencimento' ? pending / 100 : 0, status };
        }).filter(Boolean);
    });
}
