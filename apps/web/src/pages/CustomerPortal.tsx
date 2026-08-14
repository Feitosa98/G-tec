import { useEffect, useState, type ReactElement } from 'react';
import { Search, CheckCircle, Clock, Wrench, XCircle, Package, RefreshCw } from 'lucide-react';

const STATUS_CONFIG: Record<string, { color: string; icon: ReactElement; label: string }> = {
    'Aberta':     { color: 'bg-blue-500/10 border-blue-500/30 text-blue-400', icon: <Clock className="w-4 h-4" />, label: 'Em Aberto' },
    'Em Andamento': { color: 'bg-amber-500/10 border-amber-500/30 text-amber-400', icon: <Wrench className="w-4 h-4" />, label: 'Em Andamento' },
    'Aguardando Peça': { color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400', icon: <Package className="w-4 h-4" />, label: 'Aguardando Peça' },
    'Concluída':  { color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: <CheckCircle className="w-4 h-4" />, label: 'Concluída' },
    'Concluído':  { color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: <CheckCircle className="w-4 h-4" />, label: 'Concluída' },
    'Entregue':   { color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: <CheckCircle className="w-4 h-4" />, label: 'Entregue' },
    'Cancelada':  { color: 'bg-rose-500/10 border-rose-500/30 text-rose-400', icon: <XCircle className="w-4 h-4" />, label: 'Cancelada' },
};

export default function CustomerPortal() {
    const [searchInput, setSearchInput] = useState('');
    const [results, setResults] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const params = new URLSearchParams(window.location.search);
    const explicitStoreSlug = params.get('loja') || '';
    const [storeSlug, setStoreSlug] = useState(explicitStoreSlug);

    useEffect(() => {
        if (explicitStoreSlug) return;

        const controller = new AbortController();
        fetch('/api/tenants/resolve', { signal: controller.signal })
            .then(response => response.ok ? response.json() : Promise.reject())
            .then(tenant => setStoreSlug(tenant.storeSlug || ''))
            .catch(error => {
                if (error?.name !== 'AbortError') {
                    setError('Não foi possível identificar a loja. Acesse o link enviado pela empresa.');
                }
            });

        return () => controller.abort();
    }, [explicitStoreSlug]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const search = searchInput.trim();
        if (search.length < 6) {
            setError('Informe o número completo da O.S. ou telefone.');
            return;
        }
        if (!storeSlug) {
            setError('Não foi possível identificar a loja. Acesse o link enviado pela empresa.');
            return;
        }
        setLoading(true);
        setError(null);
        setResults(null);
        try {
            const res = await fetch(`/api/public/${storeSlug}/os/${encodeURIComponent(search)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Erro ao buscar');
            setResults(data);
            if (data.length === 0) setError('Nenhuma O.S. encontrada para esta busca.');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col">
            {/* Radial glow background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-3xl" />
            </div>

            <main className="flex-1 flex flex-col items-center justify-center p-6">
                {/* Logo/Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-6">
                        <Wrench className="w-10 h-10 text-blue-400" />
                    </div>
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-2">
                        Acompanhar Reparo
                    </h1>
                    <p className="text-slate-400 text-lg">
                        Digite o número da sua O.S. ou telefone para ver o status do seu dispositivo.
                    </p>
                </div>

                {/* Search Form */}
                <form onSubmit={handleSearch} className="w-full max-w-lg space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Ex: (92) 99999-9999 ou código da O.S."
                            className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl px-5 py-4 text-slate-100 placeholder-slate-500 outline-none transition-all text-base shadow-xl"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 text-base"
                    >
                        {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        {loading ? 'Buscando...' : 'Consultar Status'}
                    </button>
                </form>

                {/* Error */}
                {error && (
                    <div className="mt-8 w-full max-w-lg p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-center">
                        {error}
                    </div>
                )}

                {/* Results */}
                {results && results.length > 0 && (
                    <div className="mt-8 w-full max-w-lg space-y-4">
                        {results.map((os) => {
                            const cfg = STATUS_CONFIG[os.status] || { color: 'bg-slate-500/10 border-slate-500/30 text-slate-400', icon: <Clock className="w-4 h-4" />, label: os.status };
                            return (
                                <div key={os.id} className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-slate-500 font-mono">O.S. #{String(os.id || '').slice(0, 8).toUpperCase()}</p>
                                            <h2 className="text-lg font-bold text-white mt-0.5">{os.clientName}</h2>
                                        </div>
                                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${cfg.color}`}>
                                            {cfg.icon} {cfg.label}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Dispositivo</p>
                                            <p className="text-slate-200 font-medium">{os.device || os.orderType || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs mb-1">Valor</p>
                                            <p className="text-slate-200 font-medium">R$ {Number(os.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-slate-500 text-xs mb-1">Problema relatado</p>
                                            <p className="text-slate-300 text-sm">{os.issueDescription || '—'}</p>
                                        </div>
                                        {os.warranty && (
                                            <div className="col-span-2">
                                                <p className="text-slate-500 text-xs mb-1">Garantia</p>
                                                <p className="text-emerald-400 text-sm">{os.warranty}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <footer className="text-center text-xs text-slate-600 p-4">
                Feitosa Soluções em Informática
            </footer>
        </div>
    );
}
