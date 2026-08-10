import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle, Clock3, Search, TriangleAlert, WalletCards, X, MessageCircle, CreditCard, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useData } from '../../hooks/useData';
import { showToast } from '../../utils/toast';
import { useNotify } from '../../hooks/useNotify';
import { useMercadoPago } from '../../hooks/useMercadoPago';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const Receivables = () => {
    const { sales, markInstallmentPaid, showConfirm, showAlert } = useData();
    const { notify } = useNotify();
    const { generatePaymentLink, copyLinkToClipboard } = useMercadoPago();
    const [mpLinks, setMpLinks] = useState<Record<string, string>>({});

    const handleChargeWhatsApp = (receivable: any) => {
        const phone = receivable.customerPhone || receivable.clientPhone || '';
        const dueDate = receivable.dueDate ? format(new Date(receivable.dueDate), 'dd/MM/yyyy') : 'a combinar';
        const message = `💰 Olá, ${receivable.customerName || 'Cliente'}! Gostaríamos de lembrá-lo(a) que há uma cobrança em aberto no valor de ${currency.format(receivable.amount || 0)}, com vencimento em ${dueDate}.\n\nPor favor, entre em contato para regularizar. Obrigado! 🙏`;
        notify({ channel: 'whatsapp', to: phone, message });
    };
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
    const [paymentDetails, setPaymentDetails] = useState({
        juros: 0,
        multa: 0,
        desconto: 0,
        metodo: 'Dinheiro',
        observacao: ''
    });

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
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [sales]);

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

    const openPaymentModal = (receivable: any) => {
        let defaultJuros = 0;
        let defaultMulta = 0;
        
        if (receivable.displayStatus === 'Vencido') {
            const daysOverdue = Math.floor((new Date().getTime() - new Date(receivable.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 0) {
                defaultMulta = receivable.value * 0.02; // 2% multa
                defaultJuros = receivable.value * 0.01 * (daysOverdue / 30); // 1% ao mês
            }
        }
        
        setSelectedReceivable(receivable);
        setPaymentDetails({ juros: defaultJuros, multa: defaultMulta, desconto: 0, metodo: 'Dinheiro', observacao: '' });
        setPaymentModalOpen(true);
    };

    const confirmPayment = () => {
        if (!selectedReceivable) return;
        
        const finalValue = selectedReceivable.value + Number(paymentDetails.juros) + Number(paymentDetails.multa) - Number(paymentDetails.desconto);
        
        // Passando metodo de pagamento, valor final e desconto para o contexto
        markInstallmentPaid(selectedReceivable.saleId, selectedReceivable.id, paymentDetails.metodo, finalValue, Number(paymentDetails.desconto));
        
        showToast.success(`Parcela ${selectedReceivable.number}/${selectedReceivable.totalInstallments} marcada como paga.`);
        setPaymentModalOpen(false);
        setSelectedReceivable(null);
    };

    const handleMPPayment = async (item: any) => {
        const amount = Number(item.amount || item.value || item.total || 0);
        const result = await generatePaymentLink({
            items: [{ title: `Cobrança - ${item.customerName || item.clientName || 'Cliente'}`, quantity: 1, unit_price: amount }],
            payerName: item.customerName || item.clientName,
            externalReference: item.id,
            referenceType: 'installment',
            saleId: item.saleId,
        });
        if (result.link) {
            setMpLinks(prev => ({ ...prev, [item.id]: result.link! }));
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                        Cobranças a Prazo
                    </span>
                </h1>
                <p className="text-sm text-slate-400">
                    Acompanhe parcelas pendentes, vencidas e recebidas em tempo real.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard 
                    label="A receber" 
                    value={totals.pending} 
                    icon={Clock3} 
                    variant="amber" 
                />
                <SummaryCard 
                    label="Em atraso" 
                    value={totals.overdue} 
                    icon={TriangleAlert} 
                    variant="rose" 
                />
                <SummaryCard 
                    label="Recebido" 
                    value={totals.paid} 
                    icon={CheckCircle} 
                    variant="emerald" 
                />
                <SummaryCard 
                    label="Total parcelado" 
                    value={totals.pending + totals.overdue + totals.paid} 
                    icon={WalletCards} 
                    variant="indigo" 
                />
            </div>

            {/* Filter and Search controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Buscar por cliente, e-mail ou código do pedido..."
                        className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200 shadow-inner"
                    />
                    <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="w-full sm:w-48">
                    <select 
                        value={statusFilter} 
                        onChange={event => setStatusFilter(event.target.value)} 
                        className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200 cursor-pointer"
                    >
                        {['Todos', 'Pendente', 'Vencido', 'Pago'].map(status => (
                            <option key={status} value={status} className="bg-slate-900 text-slate-100">
                                {status}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Receivables Table */}
            <div className="overflow-hidden rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 shadow-xl shadow-black/20">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800/80 bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Pedido</th>
                                <th className="px-6 py-4">Parcela</th>
                                <th className="px-6 py-4">Vencimento</th>
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4">Situação</th>
                                <th className="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-slate-200">
                            {filteredReceivables.map(receivable => (
                                <tr key={receivable.id} className="hover:bg-slate-800/30 transition-colors duration-150 group">
                                    <td className="px-6 py-4">
                                        <strong className="font-semibold text-white group-hover:text-emerald-400 transition-colors block">
                                            {receivable.customerName}
                                        </strong>
                                        <span className="text-xs text-slate-400 font-normal block">
                                            {receivable.customerEmail}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300">
                                            #{String(receivable.saleId).slice(0, 8)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-300">
                                        {receivable.number}/{receivable.totalInstallments}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {format(new Date(receivable.dueDate), 'dd/MM/yyyy')}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-white tracking-tight">
                                        {currency.format(receivable.value)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={receivable.displayStatus} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {receivable.displayStatus !== 'Pago' ? (
                                                <button 
                                                    onClick={() => openPaymentModal(receivable)} 
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/40 hover:shadow-emerald-500/20 transition-all duration-200 active:scale-95 cursor-pointer"
                                                >
                                                    Confirmar pagamento
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">
                                                    Pago em {receivable.paidAt ? format(new Date(receivable.paidAt), 'dd/MM/yyyy') : '-'}
                                                </span>
                                            )}
                                            {receivable.displayStatus !== 'Pago' && (
                                                <button
                                                    onClick={() => handleChargeWhatsApp(receivable)}
                                                    title="Cobrar via WhatsApp"
                                                    className="p-2 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                            {mpLinks[receivable.id] ? (
                                                <button
                                                    onClick={() => copyLinkToClipboard(mpLinks[receivable.id])}
                                                    className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                    title="Copiar link de pagamento"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleMPPayment(receivable)}
                                                    className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                    title="Gerar Link Mercado Pago"
                                                >
                                                    <CreditCard size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredReceivables.length === 0 && (
                    <div className="py-16 px-4 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                        <div className="p-3 rounded-full bg-slate-800/50 border border-slate-700/50 text-slate-500">
                            <CalendarClock size={32} />
                        </div>
                        <p className="text-sm font-medium text-slate-400">Nenhuma cobrança encontrada.</p>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {paymentModalOpen && selectedReceivable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
                    <div className="w-full max-w-lg rounded-2xl bg-slate-900/95 border border-slate-800 p-6 shadow-2xl shadow-black/80 backdrop-blur-xl relative overflow-hidden">
                        {/* Decorative accent top line */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
                        
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <WalletCards size={20} />
                                </div>
                                Receber Pagamento
                            </h2>
                            <button 
                                onClick={() => setPaymentModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Selected Receivable Summary */}
                        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2 text-sm mb-5">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">Cliente:</span>
                                <strong className="text-slate-100 font-semibold">{selectedReceivable.customerName}</strong>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">Vencimento:</span>
                                <strong className="text-slate-100 font-semibold">{format(new Date(selectedReceivable.dueDate), 'dd/MM/yyyy')}</strong>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs uppercase tracking-wider font-medium">Valor Original:</span>
                                <strong className="text-slate-100 font-semibold">{currency.format(selectedReceivable.value)}</strong>
                            </div>
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Juros (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={paymentDetails.juros} 
                                    onChange={(e) => setPaymentDetails({...paymentDetails, juros: Number(e.target.value) || 0})} 
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Multa (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={paymentDetails.multa} 
                                    onChange={(e) => setPaymentDetails({...paymentDetails, multa: Number(e.target.value) || 0})} 
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Desconto/Isenção (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={paymentDetails.desconto} 
                                    onChange={(e) => setPaymentDetails({...paymentDetails, desconto: Number(e.target.value) || 0})} 
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Método</label>
                                <select 
                                    value={paymentDetails.metodo} 
                                    onChange={(e) => setPaymentDetails({...paymentDetails, metodo: e.target.value})} 
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all cursor-pointer"
                                >
                                    <option value="Dinheiro" className="bg-slate-900 text-slate-100">Dinheiro</option>
                                    <option value="PIX" className="bg-slate-900 text-slate-100">PIX</option>
                                    <option value="Cartão de Crédito" className="bg-slate-900 text-slate-100">Cartão de Crédito</option>
                                    <option value="Cartão de Débito" className="bg-slate-900 text-slate-100">Cartão de Débito</option>
                                    <option value="Transferência" className="bg-slate-900 text-slate-100">Transferência</option>
                                </select>
                            </div>
                        </div>

                        {/* Final Value Box */}
                        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-center mb-6">
                            <span className="block text-xs font-semibold uppercase tracking-wider text-emerald-400/80 mb-1">
                                Valor Final a Receber
                            </span>
                            <strong className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                                {currency.format(selectedReceivable.value + Number(paymentDetails.juros) + Number(paymentDetails.multa) - Number(paymentDetails.desconto))}
                            </strong>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button 
                                onClick={() => setPaymentModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmPayment}
                                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 border border-emerald-400/20 transition-all duration-200 active:scale-95 cursor-pointer"
                            >
                                Confirmar Recebimento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SummaryCard = ({ label, value, icon: Icon, variant }: { label: string; value: number; icon: any; variant: 'amber' | 'rose' | 'emerald' | 'indigo' }) => {
    const variantStyles = {
        amber: {
            iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            labelColor: 'text-amber-400',
            borderHover: 'hover:border-amber-500/30',
        },
        rose: {
            iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
            labelColor: 'text-rose-400',
            borderHover: 'hover:border-rose-500/30',
        },
        emerald: {
            iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            labelColor: 'text-emerald-400',
            borderHover: 'hover:border-emerald-500/30',
        },
        indigo: {
            iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
            labelColor: 'text-indigo-400',
            borderHover: 'hover:border-indigo-500/30',
        },
    };

    const style = variantStyles[variant] || variantStyles.indigo;

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-5 shadow-lg shadow-black/20 transition-all duration-300 ${style.borderHover} group`}>
            <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${style.labelColor}`}>
                    {label}
                </span>
                <div className={`p-2 rounded-xl border ${style.iconBg}`}>
                    <Icon size={18} />
                </div>
            </div>
            <strong className="text-2xl font-bold text-white tracking-tight block">
                {currency.format(value)}
            </strong>
        </div>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'Pago') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Pago
            </span>
        );
    }
    if (status === 'Vencido') {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Vencido
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Pendente
        </span>
    );
};

export default Receivables;
