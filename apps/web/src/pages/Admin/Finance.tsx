import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import { Plus, X, ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const Finance = () => {
    const { expenses, addExpense, removeExpense, getFinancialSummary } = useData();
    const summary = getFinancialSummary();

    const [desc, setDesc] = useState('');
    const [value, setValue] = useState('');
    const [type, setType] = useState('outflow'); // 'inflow' or 'outflow'
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!desc || !value || !date) return;

        addExpense({
            name: desc,
            value: Number(value),
            date: new Date(date).toISOString(),
            type: type
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
                    <ul className="max-h-[350px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
                        {[...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => (
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
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 ml-4 shrink-0">
                                    <span className={`font-bold text-sm ${
                                        item.type === 'inflow' ? 'text-emerald-400' : 'text-rose-400'
                                    }`}>
                                        {item.type === 'inflow' ? '+' : '-'} R$ {Number(item.value || item.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
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
                        {expenses.length === 0 && (
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
