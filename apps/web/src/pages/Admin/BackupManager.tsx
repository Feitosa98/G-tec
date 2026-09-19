import { useCallback, useEffect, useState } from 'react';
import { useData } from '../../hooks/useData';
import { AlertTriangle, CheckCircle, Clock, Cloud, Database, Download, Link, RotateCcw, Save, Shield, Unlink, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type DriveStatus = {
    serverConfigured: boolean;
    connected: boolean;
    enabled: boolean;
    frequency: 'daily' | 'weekly';
    hour: string;
    weekday: number;
    lastBackupAt: string;
    lastBackupStatus: string;
    lastError: string;
};

const labels: Record<string, string> = {
    products: 'Produtos', sales: 'Vendas', expenses: 'Lançamentos financeiros', customers: 'Clientes',
    receivables: 'Contas a receber', services: 'Serviços', service_orders: 'Ordens de serviço',
    subscriptions: 'Assinaturas', integrations: 'Integrações (sem senhas)', payment_transactions: 'Transações',
    suppliers: 'Fornecedores', stock_movements: 'Movimentações de estoque', appointments: 'Agendamentos',
    audit_log: 'Auditoria', fiscal_documents: 'Documentos fiscais', purchase_invoices: 'Notas de compra',
};

const emptyDriveStatus: DriveStatus = {
    serverConfigured: false, connected: false, enabled: false, frequency: 'daily', hour: '03:00',
    weekday: 0, lastBackupAt: '', lastBackupStatus: '', lastError: '',
};

export default function BackupManager() {
    const { tenant } = useData();
    const slug = tenant?.storeSlug || '';
    const [loading, setLoading] = useState('');
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const [backupFile, setBackupFile] = useState<any>(null);
    const [backupName, setBackupName] = useState('');
    const [preview, setPreview] = useState<any>(null);
    const [confirmation, setConfirmation] = useState('');
    const [drive, setDrive] = useState<DriveStatus>(emptyDriveStatus);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session') || '{}')?.token || ''; }
        catch { return ''; }
    };
    const headers = (json = false) => ({
        Authorization: `Bearer ${getToken()}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
    });
    const responseMessage = async (res: Response, fallback: string) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || fallback);
        return data;
    };

    const loadStatus = useCallback(async () => {
        if (!slug) return;
        try {
            const res = await fetch(`/api/store/${slug}/backup/status`, { headers: headers() });
            setDrive(await responseMessage(res, 'Falha ao consultar o Google Drive.'));
        } catch (error: any) {
            toast.error(error.message);
        }
    }, [slug]);

    useEffect(() => { void loadStatus(); }, [loadStatus]);
    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        if (query.get('google') === 'connected') toast.success('Google Drive conectado com sucesso!');
        if (query.get('google') === 'error') toast.error(query.get('message') || 'Não foi possível conectar ao Google Drive.');
        if (query.has('google')) window.history.replaceState({}, '', '/admin/backup');
    }, []);

    const handleDownloadBackup = async () => {
        if (!slug) return;
        setLoading('download');
        try {
            const res = await fetch(`/api/store/${slug}/backup/download`, { headers: headers() });
            if (!res.ok) throw new Error('Falha ao gerar backup.');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `backup-${slug}-${format(new Date(), 'dd-MM-yyyy')}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
            const now = new Date().toISOString();
            setLastBackup(now);
            localStorage.setItem('gtec-last-backup', now);
            toast.success('Backup completo baixado!');
        } catch (error: any) { toast.error(error.message); }
        finally { setLoading(''); }
    };

    const handleBackupFile = async (file?: File) => {
        setBackupFile(null); setPreview(null); setConfirmation(''); setBackupName('');
        if (!file) return;
        if (file.size > 18 * 1024 * 1024) return toast.error('O backup não pode ultrapassar 18 MB.');
        setLoading('validate');
        try {
            const parsed = JSON.parse(await file.text());
            const res = await fetch(`/api/store/${slug}/backup/validate`, {
                method: 'POST', headers: headers(true), body: JSON.stringify({ backup: parsed }),
            });
            const result = await responseMessage(res, 'Backup inválido.');
            setBackupFile(parsed); setBackupName(file.name); setPreview(result);
            toast.success('Arquivo validado. Confira os dados antes de restaurar.');
        } catch (error: any) { toast.error(error.message || 'Não foi possível ler o arquivo.'); }
        finally { setLoading(''); }
    };

    const handleRestore = async () => {
        if (!backupFile || confirmation !== `RESTAURAR ${slug}`) return;
        setLoading('restore');
        try {
            const res = await fetch(`/api/store/${slug}/backup/restore`, {
                method: 'POST', headers: headers(true), body: JSON.stringify({ backup: backupFile, confirmation }),
            });
            await responseMessage(res, 'Falha ao restaurar o backup.');
            toast.success('Dados restaurados com sucesso. Atualizando o sistema...');
            setTimeout(() => window.location.reload(), 1200);
        } catch (error: any) { toast.error(error.message); setLoading(''); }
    };

    const connectDrive = async () => {
        setLoading('connect');
        try {
            const res = await fetch(`/api/store/${slug}/backup/google/connect`, { headers: headers() });
            const data = await responseMessage(res, 'Falha ao iniciar conexão.');
            window.location.assign(data.authUrl);
        } catch (error: any) { toast.error(error.message); setLoading(''); }
    };

    const saveDriveSettings = async () => {
        setLoading('settings');
        try {
            const res = await fetch(`/api/store/${slug}/backup/google/settings`, {
                method: 'POST', headers: headers(true),
                body: JSON.stringify({ enabled: drive.enabled, frequency: drive.frequency, hour: drive.hour, weekday: drive.weekday }),
            });
            await responseMessage(res, 'Falha ao salvar o agendamento.');
            toast.success('Agendamento salvo!'); await loadStatus();
        } catch (error: any) { toast.error(error.message); }
        finally { setLoading(''); }
    };

    const runDriveBackup = async () => {
        setLoading('drive');
        try {
            const res = await fetch(`/api/store/${slug}/backup/google/run`, { method: 'POST', headers: headers(true) });
            await responseMessage(res, 'Falha ao enviar para o Google Drive.');
            toast.success('Backup enviado ao Google Drive!'); await loadStatus();
        } catch (error: any) { toast.error(error.message); }
        finally { setLoading(''); }
    };

    const disconnectDrive = async () => {
        if (!window.confirm('Desconectar o Google Drive? Os backups já enviados não serão apagados.')) return;
        setLoading('disconnect');
        try {
            const res = await fetch(`/api/store/${slug}/backup/google/disconnect`, { method: 'POST', headers: headers(true) });
            await responseMessage(res, 'Falha ao desconectar.');
            toast.success('Google Drive desconectado.'); await loadStatus();
        } catch (error: any) { toast.error(error.message); }
        finally { setLoading(''); }
    };

    const storedBackup = lastBackup || localStorage.getItem('gtec-last-backup');
    const previewTotal = preview
        ? (Object.values(preview.totals || {}) as unknown[]).reduce<number>((sum, value) => sum + Number(value || 0), 0)
        : 0;

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 fade-in">
            <header>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Backup e Restauração</h1>
                <p className="text-slate-400 mt-1">Proteja todos os dados operacionais da empresa</p>
            </header>

            <div className={`rounded-2xl border p-5 flex items-center gap-4 ${storedBackup || drive.lastBackupAt ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                {storedBackup || drive.lastBackupAt ? <CheckCircle className="w-8 h-8 text-emerald-400" /> : <AlertTriangle className="w-8 h-8 text-amber-400" />}
                <div>
                    <p className="font-semibold text-slate-100">{storedBackup || drive.lastBackupAt ? 'Backup registrado' : 'Nenhum backup recente registrado'}</p>
                    <p className="text-slate-400 text-sm">{drive.lastBackupAt ? `Último envio ao Drive: ${format(new Date(drive.lastBackupAt), "dd/MM/yyyy 'às' HH:mm")}` : storedBackup ? `Último download: ${format(new Date(storedBackup), "dd/MM/yyyy 'às' HH:mm")}` : 'Faça uma cópia agora ou conecte o Google Drive.'}</p>
                </div>
            </div>

            <section className="grid lg:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-3"><Database className="w-8 h-8 text-blue-400" /><div><h2 className="text-xl font-bold text-white">Backup manual completo</h2><p className="text-sm text-slate-400">Inclui os módulos financeiros, fiscais e de estoque</p></div></div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">{Object.values(labels).map(label => <span key={label}>✓ {label}</span>)}</div>
                    <button onClick={handleDownloadBackup} disabled={Boolean(loading)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                        {loading === 'download' ? <Clock className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} Baixar backup agora
                    </button>
                    <p className="text-xs text-slate-500"><Shield className="w-3.5 h-3.5 inline mr-1" />Senhas, tokens e certificados não são exportados. Os usuários atuais são preservados na restauração.</p>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-3"><RotateCcw className="w-8 h-8 text-amber-400" /><div><h2 className="text-xl font-bold text-white">Restaurar dados</h2><p className="text-sm text-slate-400">O arquivo é validado antes de qualquer alteração</p></div></div>
                    <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-5 flex flex-col items-center cursor-pointer text-slate-400">
                        <UploadCloud className="w-7 h-7 mb-2" /><span className="text-sm">{backupName || 'Selecionar arquivo JSON'}</span>
                        <input type="file" accept="application/json,.json" className="hidden" onChange={event => void handleBackupFile(event.target.files?.[0])} />
                    </label>
                    {preview && <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 space-y-3"><p className="text-emerald-400 text-sm font-semibold">Arquivo válido — {previewTotal} registros</p>{preview.warning && <p className="text-amber-400 text-xs">{preview.warning}</p>}<input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={`Digite RESTAURAR ${slug}`} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" /><button onClick={handleRestore} disabled={Boolean(loading) || confirmation !== `RESTAURAR ${slug}`} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded-lg">{loading === 'restore' ? 'Restaurando...' : 'Restaurar este backup'}</button></div>}
                </div>
            </section>

            <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Cloud className="w-9 h-9 text-sky-400" /><div><h2 className="text-xl font-bold text-white">Backup automático no Google Drive</h2><p className="text-sm text-slate-400">Cada empresa conecta sua própria conta; os arquivos são criptografados e separados</p></div></div>{drive.connected && <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">Conectado nesta empresa</span>}</div>
                {!drive.serverConfigured ? <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-sm text-amber-300">A integração precisa das credenciais do Google configuradas no servidor antes da primeira conexão.</div> : !drive.connected ? <button onClick={connectDrive} disabled={Boolean(loading)} className="px-5 py-3 bg-white text-slate-900 font-bold rounded-xl flex items-center gap-2"><Link className="w-5 h-5" /> Conectar Google Drive</button> : <div className="space-y-5">
                    <div className="grid sm:grid-cols-4 gap-4 items-end">
                        <label className="text-sm text-slate-300 flex items-center gap-3 h-11"><input type="checkbox" checked={drive.enabled} onChange={event => setDrive(current => ({ ...current, enabled: event.target.checked }))} className="w-5 h-5" /> Backup automático</label>
                        <label className="text-xs text-slate-400">Frequência<select value={drive.frequency} onChange={event => setDrive(current => ({ ...current, frequency: event.target.value as 'daily' | 'weekly' }))} className="mt-1 w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 text-white"><option value="daily">Todos os dias</option><option value="weekly">Uma vez por semana</option></select></label>
                        {drive.frequency === 'weekly' && <label className="text-xs text-slate-400">Dia<select value={drive.weekday} onChange={event => setDrive(current => ({ ...current, weekday: Number(event.target.value) }))} className="mt-1 w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 text-white"><option value={0}>Domingo</option><option value={1}>Segunda</option><option value={2}>Terça</option><option value={3}>Quarta</option><option value={4}>Quinta</option><option value={5}>Sexta</option><option value={6}>Sábado</option></select></label>}
                        <label className="text-xs text-slate-400">Horário de Manaus<input type="time" value={drive.hour} onChange={event => setDrive(current => ({ ...current, hour: event.target.value }))} className="mt-1 w-full h-11 bg-slate-950 border border-slate-700 rounded-lg px-3 text-white" /></label>
                    </div>
                    {drive.lastBackupStatus === 'error' && <p className="text-sm text-red-400">Última tentativa: {drive.lastError || 'falhou'}</p>}
                    <div className="flex flex-wrap gap-3"><button onClick={saveDriveSettings} disabled={Boolean(loading)} className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Salvar agendamento</button><button onClick={runDriveBackup} disabled={Boolean(loading)} className="px-4 py-2.5 bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-2"><UploadCloud className="w-4 h-4" /> Fazer backup agora</button><button onClick={disconnectDrive} disabled={Boolean(loading)} className="px-4 py-2.5 text-red-400 border border-red-500/30 rounded-lg flex items-center gap-2"><Unlink className="w-4 h-4" /> Desconectar</button></div>
                </div>}
            </section>
        </div>
    );
}
