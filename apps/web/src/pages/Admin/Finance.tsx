import React, { useMemo, useState } from 'react';
import { useData } from '../../hooks/useData';
import { Plus, X, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, Check, Search, ReceiptText, CalendarClock, BarChart3, WalletCards } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const Finance = () => {
    const { expenses, addExpense, updateExpense, removeExpense, getFinancialSummary } = useData();
    const summary = getFinancialSummary();

    const [desc, setDesc] = useState('');
    const [value, setValue] = useState('');
    const [type, setType] = useState('outflow'); // 'inflow' or 'outflow'
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState('Pago');
    const [category, setCategory] = useState('Operacional');
    const [movementFilter, setMovementFilter] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEntries = useMemo(() => [...expenses]
        .filter((item: any) => movementFilter === 'Todos'
            || (movementFilter === 'Entradas' && item.type === 'inflow')
            || (movementFilter === 'Saídas' && item.type !== 'inflow')
            || (movementFilter === 'Pendentes' && item.status === 'Pendente'))
        .filter((item: any) => !searchTerm.trim() || String(item.name || item.description || '').toLowerCase().includes(searchTerm.trim().toLowerCase()))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()), [expenses, movementFilter, searchTerm]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!desc || !value || !date) return;

        addExpense({
            name: desc,
            value: Number(value),
            date: new Date(date).toISOString(),
            dueDate: type === 'outflow' && status === 'Pendente' ? date : undefined,
            status: type === 'outflow' ? status : 'Pago',
            paid: type !== 'outflow' || status === 'Pago',
            type: type,
            category,
        });

        setDesc('');
        setValue('');
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                    Controle Financeiro
                </h1>
                <p className="text-slate-400 text-sm md:text-base mt-1.5">
                    Gerencie suas entradas e saídas e acompanhe o DRE da sua empresa.
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Recebido', value: summary.cashReceived, icon: WalletCards, color: 'emerald' },
                    { label: 'A receber', value: summary.pending, icon: CalendarClock, color: 'amber' },
                    { label: 'Contas a pagar', value: summary.pendingPayables, icon: ReceiptText, color: 'rose' },
                    { label: 'Resultado líquido', value: summary.netProfit, icon: BarChart3, color: summary.netProfit >= 0 ? 'cyan' : 'rose' },
                ].map(card => (
                    <div key={card.label} className="rounded-2xl border border-slate-800/80 bg-slate-900/55 p-4 shadow-lg">
                        <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><span>{card.label}</span><card.icon size={18} className="text-cyan-400" /></div>
                        <div className="mt-2 text-xl font-extrabold text-white">R$ {Number(card.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-3">
                <Link to="/admin/cobrancas" className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"><CalendarClock size={17} /> Cobranças e recebimentos</Link>
                <Link to="/admin/pedidos" className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"><ReceiptText size={17} /> Vendas e pedidos</Link>
                <Link to="/admin/relatorios" className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20"><BarChart3 size={17} /> Relatórios financeiros</Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Transaction Management */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-slate-950/50 hover:border-slate-700/60 transition-all duration-300 flex flex-col">
                    <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2.5 mb-6">
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <DollarSign size={20} />
                        </span>
                        Lançamentos Manuais
                    </h3>

                    <form onSubmit={handleAdd} className="space-y-4 mb-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className={`w-full rounded-xl px-4 py-3 bg-slate-950/60 border ${
                                    type === 'inflow' 
                                        ? 'border-emerald-500/50 text-emerald-400 focus:ring-emerald-500/30' 
                                        : 'border-rose-500/50 text-rose-400 focus:ring-rose-500/30'
                                } focus:outline-none focus:ring-2 font-semibold text-sm transition-all cursor-pointer`}
                            >
                                <option value="outflow" className="bg-slate-900 text-rose-400">Saída (Despesa)</option>
                                <option value="inflow" className="bg-slate-900 text-emerald-400">Entrada (Receita)</option>
                            </select>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full rounded-xl px-4 py-3 bg-slate-950/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/40 text-sm transition-all"
                                required
                            />
                        </div>

                        {type === 'outflow' && (
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Situação do pagamento</label>
                                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-xl px-4 py-3 bg-slate-950/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-slate-700 text-sm">
                                    <option value="Pago">Já pago</option>
                                    <option value="Pendente">Conta a pagar / criar lembrete na Agenda</option>
                                </select>
                                {status === 'Pendente' && <p className="text-xs text-amber-300 mt-1.5">A data acima será o vencimento e aparecerá na Agenda.</p>}
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Categoria contábil</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl px-4 py-3 bg-slate-950/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-slate-700 text-sm">
                                {['Operacional', 'Vendas', 'Serviços', 'Fornecedores', 'Impostos', 'Pessoal', 'Infraestrutura', 'Marketing', 'Outros'].map(option => <option key={option} value={option}>{option}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                placeholder="Descrição (Ex: Aluguel, Venda Extra)"
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                className="flex-1 rounded-xl px-4 py-3 bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/40 text-sm transition-all"
                                required
                            />
                            <input
                                type="number"
                                placeholder="Valor (R$)"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full sm:w-36 rounded-xl px-4 py-3 bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/40 text-sm transition-all"
                                required
                            />
                            <button 
                                type="submit"
                                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center transition-all duration-200 cursor-pointer"
                            >
                                <Plus size={20} className="stroke-[2.5]" />
                            </button>
                        </div>
                    </form>

                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Últimos Lançamentos
                    </h4>
                    <div className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-2">
                        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar lançamento" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-9 pr-3 text-sm text-slate-200" /></div>
                        <select value={movementFilter} onChange={e => setMovementFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200">
                            {['Todos', 'Entradas', 'Saídas', 'Pendentes'].map(option => <option key={option}>{option}</option>)}
                        </select>
                    </div>
                    <ul className="max-h-[350px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
                        {filteredEntries.map(item => (
                            <li 
                                key={item.id} 
                                className={`flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700/80 transition-all ${
                                    item.type === 'inflow' ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`p-2 rounded-lg shrink-0 ${
                                        item.type === 'inflow' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                    }`}>
                                        {item.type === 'inflow' ?
                                            <ArrowUpCircle size={18} /> :
                                            <ArrowDownCircle size={18} />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-200 text-sm truncate">
                                            {item.name || item.description || 'Sem descrição'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {format(new Date(item.date), 'dd/MM/yyyy')}
                                            {item.category && <span className="ml-2 text-slate-500">• {item.category}</span>}
                                            {item.status === 'Pendente' && <span className="ml-2 text-amber-300">Pendente</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 ml-4 shrink-0">
                                    <span className={`font-bold text-sm ${
                                        item.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                        {item.type === 'inflow' ? '+' : '-'} R$ {Number(item.value || item.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    {item.type === 'outflow' && item.status === 'Pendente' && (
                                        <button onClick={() => updateExpense(item.id, { ...item, status: 'Pago', paid: true, paidAt: new Date().toISOString() })} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Marcar como pago">
                                            <Check size={16} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => removeExpense(item.id)} 
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                        title="Remover lançamento"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                        {filteredEntries.length === 0 && (
                            <div className="p-8 text-center text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800/50 border-dashed">
                                <p className="text-sm">Nenhum lançamento registrado.</p>
                            </div>
                        )}
                    </ul>
                </div>

                {/* DRE Simplificado */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-slate-950/50 hover:border-slate-700/60 transition-all duration-300 h-fit">
                    <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2.5 mb-6">
                        <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <TrendingUp size={20} />
                        </span>
                        DRE Resumido do Mês
                    </h3>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center py-2.5 text-sm md:text-base border-b border-slate-800/40">
                            <span className="text-slate-400">Receita Total (Vendas + Extras)</span>
                            <span className="text-emerald-400 font-semibold">+ R$ {summary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex justify-between items-center py-2.5 text-sm md:text-base border-b border-slate-800/40">
                            <span className="text-slate-400">(-) Custo dos Produtos (CMV)</span>
                            <span className="text-rose-400 font-semibold">- R$ {summary.totalCOGS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex justify-between items-center py-3 text-slate-100 font-bold text-sm md:text-base border-t border-b border-dashed border-slate-700/60 my-2">
                            <span>= Lucro Bruto</span>
                            <span className="text-slate-100">R$ {summary.grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex justify-between items-center py-2.5 text-sm md:text-base border-b border-slate-800/40">
                            <span className="text-slate-400">(-) Despesas Administrativas</span>
                            <span className="text-rose-400 font-semibold">- R$ {summary.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className={`mt-8 p-6 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                        summary.netProfit >= 0
                            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950/80 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
                            : 'bg-gradient-to-br from-rose-950/40 via-slate-900/80 to-slate-950/80 border-rose-500/30 shadow-lg shadow-rose-950/20'
                    }`}>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Resultado Líquido
                        </span>
                        <span className={`text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-md ${
                            summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                            R$ {summary.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Finance;
