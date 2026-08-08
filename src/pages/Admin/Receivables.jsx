import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle, Clock3, Search, TriangleAlert, WalletCards } from 'lucide-react';
import { format } from 'date-fns';
import { useData } from '../../hooks/useData';
import { showToast } from '../../utils/toast';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const Receivables = () => {
    const { sales, markInstallmentPaid } = useData();
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    const receivables = useMemo(() => sales.flatMap(sale =>
        (sale.installments || []).map(installment => {
            const overdue = installment.status !== 'Pago' && new Date(installment.dueDate) < new Date();
            return {
                ...installment,
                displayStatus: overdue ? 'Vencido' : installment.status,
                saleId: sale.id,
                customerName: sale.customerName || 'Cliente',
                customerEmail: sale.userEmail || '',
                customerPhone: sale.customerPhone || '',
                totalInstallments: sale.installments.length
            };
        })
    ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)), [sales]);

    const filteredReceivables = receivables.filter(receivable => {
        const matchesStatus = statusFilter === 'Todos' || receivable.displayStatus === statusFilter;
        const normalizedSearch = searchTerm.toLowerCase();
        const matchesSearch = !normalizedSearch
            || receivable.customerName.toLowerCase().includes(normalizedSearch)
            || receivable.customerEmail.toLowerCase().includes(normalizedSearch)
            || String(receivable.saleId).toLowerCase().includes(normalizedSearch);
        return matchesStatus && matchesSearch;
    });

    const totals = receivables.reduce((summary, receivable) => {
        if (receivable.displayStatus === 'Pago') summary.paid += receivable.value;
        else if (receivable.displayStatus === 'Vencido') summary.overdue += receivable.value;
        else summary.pending += receivable.value;
        return summary;
    }, { pending: 0, overdue: 0, paid: 0 });

    const handlePaid = (receivable) => {
        markInstallmentPaid(receivable.saleId, receivable.id);
        showToast.success(`Parcela ${receivable.number}/${receivable.totalInstallments} marcada como paga.`);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem' }}>Cobranças a Prazo</h1>
                <p style={{ color: 'var(--color-text-muted)' }}>Acompanhe parcelas pendentes, vencidas e recebidas.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <SummaryCard label="A receber" value={totals.pending} icon={Clock3} color="var(--color-warning)" />
                <SummaryCard label="Em atraso" value={totals.overdue} icon={TriangleAlert} color="var(--color-danger)" />
                <SummaryCard label="Recebido" value={totals.paid} icon={CheckCircle} color="var(--color-success)" />
                <SummaryCard label="Total parcelado" value={totals.pending + totals.overdue + totals.paid} icon={WalletCards} color="var(--color-accent)" />
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                    <input
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Buscar cliente, e-mail ou pedido..."
                        style={inputStyle}
                    />
                    <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                </div>
                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={{ ...inputStyle, width: '180px' }}>
                    {['Todos', 'Pendente', 'Vencido', 'Pago'].map(status => <option key={status} value={status} style={{ background: '#12182b' }}>{status}</option>)}
                </select>
            </div>

            <div style={{ overflowX: 'auto', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={cellHeader}>Cliente</th>
                            <th style={cellHeader}>Pedido</th>
                            <th style={cellHeader}>Parcela</th>
                            <th style={cellHeader}>Vencimento</th>
                            <th style={cellHeader}>Valor</th>
                            <th style={cellHeader}>Situação</th>
                            <th style={cellHeader}>Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReceivables.map(receivable => (
                            <tr key={receivable.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={cellBody}>
                                    <strong>{receivable.customerName}</strong>
                                    <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{receivable.customerEmail}</span>
                                </td>
                                <td style={cellBody}>#{String(receivable.saleId).slice(0, 8)}</td>
                                <td style={cellBody}>{receivable.number}/{receivable.totalInstallments}</td>
                                <td style={cellBody}>{format(new Date(receivable.dueDate), 'dd/MM/yyyy')}</td>
                                <td style={{ ...cellBody, fontWeight: 'bold' }}>{currency.format(receivable.value)}</td>
                                <td style={cellBody}><StatusBadge status={receivable.displayStatus} /></td>
                                <td style={cellBody}>
                                    {receivable.displayStatus !== 'Pago' ? (
                                        <button onClick={() => handlePaid(receivable)} className="btn-primary" style={{ padding: '0.55rem 0.8rem', fontSize: '0.8rem' }}>
                                            Confirmar pagamento
                                        </button>
                                    ) : (
                                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                            Pago em {receivable.paidAt ? format(new Date(receivable.paidAt), 'dd/MM/yyyy') : '-'}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredReceivables.length === 0 && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <CalendarClock size={36} style={{ marginBottom: '0.8rem' }} />
                        <p>Nenhuma cobrança encontrada.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const SummaryCard = ({ label, value, icon: Icon, color }) => (
    <div style={{ background: 'var(--color-bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color, marginBottom: '0.7rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>{label}</span>
            <Icon size={20} />
        </div>
        <strong style={{ fontSize: '1.45rem' }}>{currency.format(value)}</strong>
    </div>
);

const StatusBadge = ({ status }) => {
    const colors = { Pago: 'var(--color-success)', Vencido: 'var(--color-danger)', Pendente: 'var(--color-warning)' };
    return <span style={{ color: colors[status], background: `color-mix(in srgb, ${colors[status]} 15%, transparent)`, padding: '0.35rem 0.65rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{status}</span>;
};

const inputStyle = {
    width: '100%',
    padding: '0.8rem',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    outline: 'none'
};

const cellHeader = { padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' };
const cellBody = { padding: '1rem' };

export default Receivables;
