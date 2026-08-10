import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { ClipboardList, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_COLORS: Record<string, string> = {
    DELETE: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    CREATE: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    UPDATE: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

const COLLECTION_LABELS: Record<string, string> = {
    products: 'Produtos',
    customers: 'Clientes',
    sales: 'Vendas',
    service_orders: 'Ordens de Serviço',
    services: 'Serviços',
    suppliers: 'Fornecedores',
    appointments: 'Agenda',
    users: 'Usuários',
};

export default function AuditLog() {
    const { tenant } = useData();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterAction, setFilterAction] = useState<string>('ALL');

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };
    const headers = { 'Authorization': `Bearer ${getToken()}` };

    const fetchLogs = async () => {
        if (!tenant?.storeSlug) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/audit_log`, { headers });
            if (res.ok) setLogs(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [tenant]);

    const filteredLogs = [...logs]
        .reverse()
        .filter(l => filterAction === 'ALL' || l.action === filterAction);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 fade-in">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Log de Auditoria</h1>
                    <p className="text-slate-400 mt-1">Histórico de ações realizadas no sistema</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all border border-slate-700"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </header>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['ALL', 'DELETE', 'CREATE', 'UPDATE'].map(action => (
                    <button
                        key={action}
                        onClick={() => setFilterAction(action)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                            filterAction === action
                                ? (action === 'ALL' ? 'bg-slate-700 border-slate-600 text-white' : ACTION_COLORS[action])
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                    >
                        {action === 'ALL' ? 'Todos' : action}
                    </button>
                ))}
                <span className="ml-auto text-sm text-slate-500 flex items-center">{filteredLogs.length} registros</span>
            </div>

            {/* Log Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                {filteredLogs.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        {loading ? (
                            <p>Carregando...</p>
                        ) : (
                            <p className="text-sm">Nenhuma ação registrada ainda.<br />Os logs são criados automaticamente quando itens são excluídos.</p>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-950/40 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800/60">
                                    <th className="px-6 py-3 text-left">Data/Hora</th>
                                    <th className="px-6 py-3 text-left">Usuário</th>
                                    <th className="px-6 py-3 text-center">Ação</th>
                                    <th className="px-6 py-3 text-left">Coleção</th>
                                    <th className="px-6 py-3 text-left">ID do Registro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filteredLogs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-3.5 text-slate-400 font-mono text-xs">
                                            {log.timestamp ? format(new Date(log.timestamp), "dd/MM/yy HH:mm:ss", { locale: ptBR }) : '—'}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {(log.userEmail || 'S')[0].toUpperCase()}
                                                </div>
                                                <span className="text-slate-300 text-xs truncate max-w-[120px]">{log.userEmail || 'sistema'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${ACTION_COLORS[log.action] || 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                                                {log.action === 'DELETE' && <Trash2 className="w-3 h-3" />}
                                                {log.action === 'CREATE' && <AlertCircle className="w-3 h-3" />}
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 text-slate-300">
                                            {COLLECTION_LABELS[log.collection] || log.collection}
                                        </td>
                                        <td className="px-6 py-3.5 text-slate-500 font-mono text-xs truncate max-w-[160px]">
                                            {String(log.recordId || '—').slice(0, 16)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="text-center text-xs text-slate-600">
                💡 Os logs de exclusão são registrados automaticamente. Para rastrear criações e edições, a funcionalidade pode ser expandida.
            </div>
        </div>
    );
}
