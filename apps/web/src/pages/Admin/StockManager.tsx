import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Package, AlertTriangle, Plus, Minus, History, TrendingUp, TrendingDown, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StockManager() {
    const { products, tenant } = useData();
    const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
    const [movementModal, setMovementModal] = useState<any>(null);
    const [movementType, setMovementType] = useState<'in' | 'out'>('in');
    const [movementQty, setMovementQty] = useState(1);
    const [movementNote, setMovementNote] = useState('');
    const [movements, setMovements] = useState<any[]>([]);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };

    const headers = { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

    const productsWithStock = (products || []).map((p: any) => ({
        ...p,
        stock: Number(p.stock ?? p.quantity ?? 0),
        minStock: Number(p.minStock ?? 5),
    }));

    const lowStockProducts = productsWithStock.filter((p: any) => p.stock > 0 && p.stock <= p.minStock);
    const outOfStockProducts = productsWithStock.filter((p: any) => p.stock <= 0);

    const filteredProducts = productsWithStock.filter((p: any) => {
        if (filter === 'low') return p.stock > 0 && p.stock <= p.minStock;
        if (filter === 'out') return p.stock <= 0;
        return true;
    });

    const fetchMovements = async () => {
        if (!tenant?.storeSlug) return;
        const res = await fetch(`/api/store/${tenant.storeSlug}/stock_movements`, { headers });
        if (res.ok) setMovements(await res.json());
    };

    useEffect(() => { fetchMovements(); }, [tenant]);

    const handleMovement = async () => {
        if (!tenant?.storeSlug || !movementModal) return;
        const movement = {
            id: crypto.randomUUID(),
            productId: movementModal.id,
            productName: movementModal.name,
            type: movementType,
            quantity: movementQty,
            note: movementNote,
            date: new Date().toISOString(),
        };

        // Save movement log
        await fetch(`/api/store/${tenant.storeSlug}/stock_movements`, {
            method: 'POST', headers, body: JSON.stringify(movement)
        });

        // Update product stock
        const newStock = movementType === 'in'
            ? (movementModal.stock + movementQty)
            : Math.max(0, movementModal.stock - movementQty);

        await fetch(`/api/store/${tenant.storeSlug}/products/${movementModal.id}`, {
            method: 'PUT', headers,
            body: JSON.stringify({ ...movementModal, stock: newStock })
        });

        toast.success(`Estoque ${movementType === 'in' ? 'adicionado' : 'retirado'} com sucesso!`);
        setMovementModal(null);
        setMovementQty(1);
        setMovementNote('');
        fetchMovements();
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 fade-in">
            <header>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Controle de Estoque
                </h1>
                <p className="text-slate-400 mt-2">Monitore quantidades e movimentações de produtos</p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                        <Package className="w-8 h-8 text-blue-400 shrink-0" />
                        <div>
                            <p className="text-2xl font-bold text-white">{productsWithStock.length}</p>
                            <p className="text-slate-400 text-sm">Total de Produtos</p>
                        </div>
                    </div>
                </div>
                <div
                    onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
                    className={`cursor-pointer bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-5 transition-all ${filter === 'low' ? 'border-amber-500/50' : 'border-slate-800/80'}`}
                >
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                        <div>
                            <p className="text-2xl font-bold text-amber-400">{lowStockProducts.length}</p>
                            <p className="text-slate-400 text-sm">Estoque Baixo</p>
                        </div>
                    </div>
                </div>
                <div
                    onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}
                    className={`cursor-pointer bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-5 transition-all ${filter === 'out' ? 'border-rose-500/50' : 'border-slate-800/80'}`}
                >
                    <div className="flex items-center gap-3">
                        <X className="w-8 h-8 text-rose-400 shrink-0" />
                        <div>
                            <p className="text-2xl font-bold text-rose-400">{outOfStockProducts.length}</p>
                            <p className="text-slate-400 text-sm">Sem Estoque</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-200">Produtos</h2>
                    <div className="flex gap-2">
                        {(['all', 'low', 'out'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            >
                                {f === 'all' ? 'Todos' : f === 'low' ? 'Estoque Baixo' : 'Sem Estoque'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-950/40 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-3 text-left">Produto</th>
                                <th className="px-6 py-3 text-center">Estoque Atual</th>
                                <th className="px-6 py-3 text-center">Estoque Mínimo</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredProducts.map((p: any) => {
                                const isOut = p.stock <= 0;
                                const isLow = !isOut && p.stock <= p.minStock;
                                return (
                                    <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4 text-slate-200 font-medium">{p.name}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-lg font-bold ${isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
                                                {p.stock}
                                            </span>
                                            <span className="text-slate-500 text-xs ml-1">{p.unit || 'un'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-400">{p.minStock}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isOut ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : isLow ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                                {isOut ? 'Esgotado' : isLow ? 'Baixo' : 'OK'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => { setMovementModal(p); setMovementType('in'); }}
                                                    className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                    title="Entrada de estoque"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setMovementModal(p); setMovementType('out'); }}
                                                    className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                                    title="Saída de estoque"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent movements */}
            {movements.length > 0 && (
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800/80 flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" />
                        <h2 className="font-semibold text-slate-200">Últimas Movimentações</h2>
                    </div>
                    <div className="divide-y divide-slate-800/50">
                        {[...movements].reverse().slice(0, 10).map((m: any) => (
                            <div key={m.id} className="px-6 py-3 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3">
                                    {m.type === 'in'
                                        ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        : <TrendingDown className="w-4 h-4 text-rose-400" />}
                                    <div>
                                        <span className="text-slate-200 font-medium">{m.productName}</span>
                                        {m.note && <span className="text-slate-500 ml-2">— {m.note}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`font-bold ${m.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                                    </span>
                                    <span className="text-slate-500 text-xs">{new Date(m.date).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Movement Modal */}
            {movementModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">
                                {movementType === 'in' ? '📦 Entrada de Estoque' : '📤 Saída de Estoque'}
                            </h3>
                            <button onClick={() => setMovementModal(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-slate-300 font-medium">{movementModal.name}</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setMovementType('in')}
                                className={`py-2 rounded-xl font-medium text-sm transition-all ${movementType === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                            >Entrada (+)</button>
                            <button
                                onClick={() => setMovementType('out')}
                                className={`py-2 rounded-xl font-medium text-sm transition-all ${movementType === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                            >Saída (-)</button>
                        </div>
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">Quantidade</label>
                            <input
                                type="number" min={1} value={movementQty}
                                onChange={e => setMovementQty(Number(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400 mb-2 block">Observação (opcional)</label>
                            <input
                                type="text" value={movementNote}
                                onChange={e => setMovementNote(e.target.value)}
                                placeholder="Ex: Compra fornecedor, venda balcão..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={handleMovement}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Registrar Movimentação
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
