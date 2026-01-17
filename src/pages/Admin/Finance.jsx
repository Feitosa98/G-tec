import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';

const Finance = () => {
    const { expenses, addExpense, removeExpense, getFinancialSummary } = useData();
    const summary = getFinancialSummary();

    const [desc, setDesc] = useState('');
    const [value, setValue] = useState('');
    const [type, setType] = useState('outflow'); // 'inflow' or 'outflow'
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleAdd = (e) => {
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
        <div style={{ padding: '2rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '2rem' }}>Controle Financeiro</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>

                {/* Transaction Management */}
                <div style={{ background: 'var(--color-bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Lançamentos Manuais (Entradas / Saídas)
                    </h3>

                    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    background: 'var(--color-bg-card)', // Ensure solid background
                                    color: type === 'inflow' ? 'var(--color-success)' : 'var(--color-danger)',
                                    borderColor: type === 'inflow' ? 'var(--color-success)' : 'var(--color-danger)',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="outflow" style={{ color: 'var(--color-danger)', background: 'var(--color-bg-card)' }}>Saída (Despesa)</option>
                                <option value="inflow" style={{ color: 'var(--color-success)', background: 'var(--color-bg-card)' }}>Entrada (Receita)</option>
                            </select>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                style={inputStyle}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                placeholder="Descrição (Ex: Aluguel, Venda Extra)"
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                style={{ ...inputStyle, flex: 2 }}
                                required
                            />
                            <input
                                type="number"
                                placeholder="Valor (R$)"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                style={{ ...inputStyle, flex: 1 }}
                                required
                            />
                            <button className="btn-primary" style={{ padding: '0 1.5rem' }}>
                                <Plus size={20} />
                            </button>
                        </div>
                    </form>

                    <ul style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => (
                            <li key={item.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {item.type === 'inflow' ?
                                            <ArrowUpCircle size={16} color="var(--color-success)" /> :
                                            <ArrowDownCircle size={16} color="var(--color-danger)" />
                                        }
                                        <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {format(new Date(item.date), 'dd/MM/yyyy')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{
                                        color: item.type === 'inflow' ? 'var(--color-success)' : 'var(--color-danger)',
                                        fontWeight: 'bold'
                                    }}>
                                        {item.type === 'inflow' ? '+' : '-'} R$ {item.value.toLocaleString('pt-BR')}
                                    </span>
                                    <button onClick={() => removeExpense(item.id)} style={{ color: 'var(--color-text-muted)', background: 'none' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                        {expenses.length === 0 && <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>Nenhum lançamento registrado.</p>}
                    </ul>
                </div>

                {/* DRE Simplificado */}
                <div style={{ background: 'var(--color-bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Resumo do Mês</h3>

                    <div style={rowStyle}>
                        <span>Receita Total (Vendas + Extras)</span>
                        <span style={{ color: 'var(--color-success)' }}>+ R$ {summary.totalRevenue.toLocaleString('pt-BR')}</span>
                    </div>

                    <div style={rowStyle}>
                        <span>(-) Custo dos Produtos (CMV)</span>
                        <span style={{ color: 'var(--color-danger)' }}>- R$ {summary.totalCOGS.toLocaleString('pt-BR')}</span>
                    </div>

                    <div style={{ ...rowStyle, borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '10px' }}>
                        <span style={{ fontWeight: 'bold' }}>= Lucro Bruto</span>
                        <span style={{ fontWeight: 'bold' }}>R$ {summary.grossProfit.toLocaleString('pt-BR')}</span>
                    </div>

                    <div style={rowStyle}>
                        <span>(-) Despesas Externas</span>
                        <span style={{ color: 'var(--color-danger)' }}>- R$ {summary.totalExpenses.toLocaleString('pt-BR')}</span>
                    </div>

                    <div style={{
                        marginTop: '2rem',
                        padding: '1.5rem',
                        background: 'var(--color-bg-dark)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>RESULTADO LÍQUIDO</span>
                        <span style={{
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            color: summary.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                        }}>
                            R$ {summary.netProfit.toLocaleString('pt-BR')}
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.8rem',
    borderRadius: 'var(--radius-sm)',
    color: 'white',
    outline: 'none'
};

const rowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    fontSize: '1rem'
};

export default Finance;
