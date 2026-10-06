import { reconcileInstallments } from '../../web/src/utils/installmentPayments.js';

const validDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10));

const dateOnly = (value: unknown) => String(value || '').slice(0, 10);

const isPaid = (record: any) => record?.paid === true || ['pago', 'paga', 'paid', 'quitado', 'quitada']
    .includes(String(record?.status || record?.paymentStatus || '').trim().toLowerCase());

export const buildFinancialAgendaEvents = (sales: any[] = [], expenses: any[] = []) => {
    const receivables = sales.flatMap((sale: any) => {
        if (isPaid(sale)) return [];
        const installments = reconcileInstallments(sale);
        return installments.flatMap((installment: any, index: number) => {
            const date = dateOnly(installment?.dueDate);
            if (!validDate(date) || isPaid(installment)) return [];
            const amount = Number(installment?.balanceDue ?? installment?.value ?? installment?.amount ?? 0);
            const number = Number(installment?.number || installment?.installmentNumber || index + 1);
            const customer = String(sale?.customerName || sale?.clientName || 'Cliente');
            const overdue = date < new Date().toISOString().slice(0, 10);
            return [{
                id: `receivable-${sale.id}-${installment.id || number}`,
                title: `Cobrança: ${customer} — parcela ${number}/${installments.length}`,
                client: customer,
                phone: String(sale?.customerPhone || sale?.clientPhone || ''),
                email: String(sale?.customerEmail || sale?.userEmail || ''),
                type: 'Cobrança',
                date,
                time: '09:00',
                amount,
                status: overdue ? 'Vencido' : 'Pendente',
                financialKind: 'receivable',
                source: 'financial',
                readOnly: true,
                notes: `${overdue ? 'Cobrança vencida' : 'Vencimento'} · ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
            }];
        });
    });

    const payables = expenses.flatMap((expense: any) => {
        const date = dateOnly(expense?.dueDate);
        const pending = ['pending', 'pendente', 'aberto', 'a pagar'].includes(String(expense?.status || '').trim().toLowerCase());
        if (expense?.type !== 'outflow' || !pending || !validDate(date) || isPaid(expense)) return [];
        const amount = Number(expense?.value ?? expense?.amount ?? 0);
        const overdue = date < new Date().toISOString().slice(0, 10);
        return [{
            id: `payable-${expense.id}`,
            title: `Pagamento: ${expense.name || expense.description || 'Conta a pagar'}`,
            type: 'Pagamento',
            date,
            time: '08:00',
            amount,
            status: overdue ? 'Vencido' : 'Pendente',
            financialKind: 'payable',
            source: 'financial',
            readOnly: true,
            notes: `${overdue ? 'Pagamento vencido' : 'Conta a pagar'} · ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        }];
    });

    return [...receivables, ...payables];
};
