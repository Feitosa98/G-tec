import { useState } from 'react';
import { useData } from '../../hooks/useData';
import { Download, Database, Shield, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function BackupManager() {
    const { tenant } = useData();
    const [loading, setLoading] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };

    const handleDownloadBackup = async () => {
        if (!tenant?.storeSlug) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/backup/download`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error('Falha ao gerar backup');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${tenant.storeSlug}-${format(new Date(), 'dd-MM-yyyy')}.json`;
            a.click();
            URL.revokeObjectURL(url);

            const now = new Date().toISOString();
            setLastBackup(now);
            localStorage.setItem('gtec-last-backup', now);
            toast.success('Backup baixado com sucesso!');
        } catch (err: any) {
            toast.error(err.message || 'Erro ao gerar backup');
        } finally {
            setLoading(false);
        }
    };

    const storedBackup = lastBackup || localStorage.getItem('gtec-last-backup');

    const WHAT_IS_BACKED_UP = [
        { icon: '🛍️', label: 'Produtos e serviços cadastrados' },
        { icon: '👥', label: 'Clientes e contatos' },
        { icon: '💰', label: 'Vendas e pedidos' },
        { icon: '🔧', label: 'Ordens de serviço' },
        { icon: '🏭', label: 'Fornecedores' },
        { icon: '📅', label: 'Agendamentos' },
        { icon: '🔗', label: 'Configurações de integrações' },
    ];

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 fade-in">
            <header>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Backup de Dados</h1>
                <p className="text-slate-400 mt-1">Exporte uma cópia completa de todos os seus dados</p>
            </header>

            {/* Status Card */}
            <div className={`rounded-2xl border p-6 flex items-center gap-4 ${storedBackup ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                {storedBackup
                    ? <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                    : <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                }
                <div>
                    <p className={`font-semibold ${storedBackup ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {storedBackup ? 'Backup realizado' : 'Sem backup registrado'}
                    </p>
                    <p className="text-slate-400 text-sm">
                        {storedBackup
                            ? `Último backup: ${format(new Date(storedBackup), "dd/MM/yyyy 'às' HH:mm")}`
                            : 'Recomendamos fazer backup semanalmente para não perder dados importantes.'}
                    </p>
                </div>
            </div>

            {/* Main Download Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <Database className="w-10 h-10 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Exportar Backup Completo</h2>
                        <p className="text-slate-400 mt-1">Arquivo JSON com todos os dados do sistema</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {WHAT_IS_BACKED_UP.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                            <span className="text-base">{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleDownloadBackup}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 text-base"
                >
                    {loading
                        ? <><Clock className="w-5 h-5 animate-spin" /> Gerando backup...</>
                        : <><Download className="w-5 h-5" /> Baixar Backup Agora</>
                    }
                </button>
            </div>

            {/* Tips */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-slate-400" />
                    <h3 className="font-semibold text-slate-200">Boas Práticas de Backup</h3>
                </div>
                <ul className="space-y-2 text-slate-400 text-sm list-disc list-inside">
                    <li>Faça backup <strong className="text-slate-300">pelo menos uma vez por semana</strong></li>
                    <li>Salve o arquivo em <strong className="text-slate-300">Google Drive, OneDrive ou pen drive</strong></li>
                    <li>O arquivo <code className="bg-slate-800 px-1 rounded text-xs">.json</code> pode ser usado para restaurar os dados futuramente</li>
                    <li>Mantenha <strong className="text-slate-300">ao menos 3 backups</strong> de datas diferentes</li>
                </ul>
            </div>
        </div>
    );
}
