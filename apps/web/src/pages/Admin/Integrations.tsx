import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { useAuthStore } from '../../store/authStore';
import { storeRequest } from '../../utils/api';
import toast from 'react-hot-toast';
import { Mail, MessageCircle, Send, QrCode, PowerOff, Save, RefreshCw, CreditCard, ShieldCheck, Upload, Wifi } from 'lucide-react';
import MercadoPagoPage from './MercadoPagoPage';

const defaultWaTemplates = {
    chargeCreatedEnabled: true,
    paymentConfirmedEnabled: true,
    serviceOrderCreatedEnabled: true,
    serviceCompletedEnabled: true,
    chargeCreated: 'Olá, {cliente}!\n\n{titulo}\nValor: R$ {valor}\n\nPIX Copia e Cola:\n{pix}\n\nO QR Code e o PDF seguem anexos.',
    paymentConfirmed: 'Olá, {cliente}! Recebemos seu pagamento PIX de R$ {valor}. A venda #{numero} está paga. Muito obrigado pela preferência!',
    serviceOrderCreated: 'Olá, {cliente}! Sua ordem de serviço #{numero} foi aberta com sucesso. Status atual: {status}. Valor previsto: R$ {valor}.',
    serviceCompleted: 'Olá, {cliente}! Sua ordem de serviço #{numero} foi concluída e está pronta para retirada. Valor: R$ {valor}. Obrigado pela preferência!',
};

const defaultNfseForm = {
    municipalRegistration: '', municipalityCode: '1302603', dpsSeries: 1, nextDps: 1,
    nationalServiceCode: '', municipalServiceCode: '', simpleNationalStatus: 1,
    simpleNationalTaxRegime: 1, specialTaxRegime: 0, issTaxation: 1, issWithholding: 1,
    enabled: false, certificateConfigured: false, certificateSubject: '', certificateValidTo: '',
    lastConnectionAt: '', lastConnectionStatus: '',
};

export default function Integrations() {
    const { tenant } = useData();
    const token = useAuthStore(state => state.user?.token || '');
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'telegram' | 'email' | 'mercadopago' | 'nfse'>('whatsapp');

    const [emailForm, setEmailForm] = useState({ host: '', port: '', user: '', pass: '', from: '' });
    const [telegramForm, setTelegramForm] = useState({ token: '', defaultChatId: '' });
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [loadingTelegram, setLoadingTelegram] = useState(false);

    // WhatsApp State
    const [waStatus, setWaStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
    const [waQr, setWaQr] = useState<string | null>(null);
    const [isPollingWa, setIsPollingWa] = useState(false);
    const [waTemplates, setWaTemplates] = useState(defaultWaTemplates);
    const [savingWaTemplates, setSavingWaTemplates] = useState(false);
    const [nfseForm, setNfseForm] = useState(defaultNfseForm);
    const [nfseCertificate, setNfseCertificate] = useState('');
    const [nfseCertificateName, setNfseCertificateName] = useState('');
    const [nfseCertificatePassword, setNfseCertificatePassword] = useState('');
    const [savingNfse, setSavingNfse] = useState(false);
    const [testingNfse, setTestingNfse] = useState(false);

    useEffect(() => {
        if (!tenant?.storeSlug || !token) return;
        storeRequest('integrations').then((records: any[]) => {
            const email = records.find(record => record.id === 'email');
            const telegram = records.find(record => record.id === 'telegram');
            if (email) setEmailForm({ host: email.host || '', port: email.port || '', user: email.user || '', pass: email.pass || '', from: email.from || '' });
            if (telegram) setTelegramForm({ token: telegram.token || '', defaultChatId: telegram.defaultChatId || '' });
        }).catch(() => toast.error('Não foi possível carregar as integrações.'));
        fetch(`/api/store/${tenant.storeSlug}/whatsapp/templates`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => setWaTemplates({ ...defaultWaTemplates, ...data }))
            .catch(() => toast.error('Não foi possível carregar as mensagens do WhatsApp.'));
        fetch(`/api/store/${tenant.storeSlug}/nfse/config`, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(async res => res.ok ? res.json() : Promise.reject(await res.json()))
            .then(data => setNfseForm({ ...defaultNfseForm, ...data }))
            .catch(() => undefined);
    }, [tenant?.storeSlug, token]);

    const fetchWaStatus = async () => {
        if (!tenant?.storeSlug) return;
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/whatsapp/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setWaStatus(data.status);
            setWaQr(data.qr);
            if (data.status === 'connected') {
                setIsPollingWa(false);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchWaStatus();
        let interval: any;
        if (isPollingWa) {
            interval = setInterval(fetchWaStatus, 3000);
        }
        return () => clearInterval(interval);
    }, [isPollingWa, tenant]);

    const handleConnectWa = async () => {
        if (!tenant?.storeSlug) return;
        try {
            await fetch(`/api/store/${tenant.storeSlug}/whatsapp/connect`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setWaStatus('connecting');
            setIsPollingWa(true);
        } catch (e) {
            toast.error('Erro ao iniciar conexão com WhatsApp');
        }
    };

    const handleDisconnectWa = async () => {
        if (!tenant?.storeSlug) return;
        try {
            await fetch(`/api/store/${tenant.storeSlug}/whatsapp/disconnect`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setWaStatus('disconnected');
            setWaQr(null);
            setIsPollingWa(false);
            toast.success('WhatsApp desconectado');
        } catch (e) {
            toast.error('Erro ao desconectar WhatsApp');
        }
    };

    const handleSaveWaTemplates = async () => {
        if (!tenant?.storeSlug) return;
        setSavingWaTemplates(true);
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/whatsapp/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(waTemplates),
            });
            if (!res.ok) throw new Error();
            toast.success('Mensagens automáticas salvas.');
        } catch {
            toast.error('Não foi possível salvar as mensagens.');
        } finally {
            setSavingWaTemplates(false);
        }
    };

    const handleSaveEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingEmail(true);
        try {
            await storeRequest('integrations/email', { method: 'PUT', body: JSON.stringify(emailForm) });
            toast.success('Configurações de e-mail salvas');
        } catch (err) {
            toast.error('Erro ao salvar e-mail');
        } finally { setLoadingEmail(false); }
    };

    const handleSaveTelegram = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingTelegram(true);
        try {
            await storeRequest('integrations/telegram', { method: 'PUT', body: JSON.stringify(telegramForm) });
            toast.success('Configurações do Telegram salvas');
        } catch (err) {
            toast.error('Erro ao salvar Telegram');
        } finally { setLoadingTelegram(false); }
    };

    const handleNfseCertificate = (file?: File) => {
        if (!file) return;
        if (!/\.(pfx|p12)$/i.test(file.name)) {
            toast.error('Selecione um certificado A1 no formato .pfx ou .p12.');
            return;
        }
        if (file.size > 2_000_000) {
            toast.error('O certificado deve ter no máximo 2 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setNfseCertificate(String(reader.result || '').split(',')[1] || '');
            setNfseCertificateName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const handleSaveNfse = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!tenant?.storeSlug) return;
    if (nfseForm.enabled && !nfseForm.certificateConfigured && !nfseCertificate) {
            toast.error('Selecione o certificado digital A1.');
            return;
        }
        if (nfseCertificate && !nfseCertificatePassword) {
            toast.error('Informe a senha do novo certificado A1.');
            return;
        }
        setSavingNfse(true);
        try {
            const response = await fetch(`/api/store/${tenant.storeSlug}/nfse/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ...nfseForm, certificateBase64: nfseCertificate || undefined, certificatePassword: nfseCertificatePassword || undefined }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Não foi possível salvar a configuração fiscal.');
            setNfseForm({ ...defaultNfseForm, ...data });
            setNfseCertificate('');
            setNfseCertificateName('');
            setNfseCertificatePassword('');
            toast.success('Configuração da NFS-e em homologação salva.');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSavingNfse(false);
        }
    };

    const handleTestNfse = async () => {
        if (!tenant?.storeSlug) return;
        setTestingNfse(true);
        try {
            const response = await fetch(`/api/store/${tenant.storeSlug}/nfse/test-connection`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Falha na conexão com a SEFIN Nacional.');
            setNfseForm(current => ({ ...current, lastConnectionStatus: 'connected', lastConnectionAt: new Date().toISOString() }));
            toast.success('Conexão com a homologação da NFS-e Nacional confirmada.');
        } catch (error: any) {
            setNfseForm(current => ({ ...current, lastConnectionStatus: 'failed', lastConnectionAt: new Date().toISOString() }));
            toast.error(error.message);
        } finally {
            setTestingNfse(false);
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 fade-in">
            <header className="mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Integrações
                </h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Conecte a Feitosa Soluções aos seus canais de comunicação favoritos
                </p>
            </header>

            <div className="flex space-x-2 border-b border-slate-800/80 mb-8">
                <button
                    onClick={() => setActiveTab('whatsapp')}
                    className={`pb-4 px-4 text-sm font-medium transition-colors flex items-center space-x-2 ${
                        activeTab === 'whatsapp' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                </button>
                <button
                    onClick={() => setActiveTab('telegram')}
                    className={`pb-4 px-4 text-sm font-medium transition-colors flex items-center space-x-2 ${
                        activeTab === 'telegram' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Send className="w-4 h-4" />
                    <span>Telegram</span>
                </button>
                <button
                    onClick={() => setActiveTab('email')}
                    className={`pb-4 px-4 text-sm font-medium transition-colors flex items-center space-x-2 ${
                        activeTab === 'email' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Mail className="w-4 h-4" />
                    <span>E-mail (SMTP)</span>
                </button>
                <button
                    onClick={() => setActiveTab('mercadopago')}
                    className={`pb-4 px-4 text-sm font-medium transition-colors flex items-center space-x-2 ${
                        activeTab === 'mercadopago' ? 'border-b-2 border-yellow-500 text-yellow-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <CreditCard className="w-4 h-4" />
                    <span>Mercado Pago</span>
                </button>
                <button
                    onClick={() => setActiveTab('nfse')}
                    className={`pb-4 px-4 text-sm font-medium transition-colors flex items-center space-x-2 ${
                        activeTab === 'nfse' ? 'border-b-2 border-cyan-500 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    <span>NFS-e (Homologação)</span>
                </button>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-xl">
                {activeTab === 'whatsapp' && (
                    <div className="max-w-4xl">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                            <MessageCircle className="w-5 h-5 mr-3 text-emerald-500" />
                            Conexão experimental com WhatsApp
                        </h2>
                        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                            Esta conexão por QR Code não usa a API oficial da Meta. Não recomendamos vincular o número principal da empresa nem enviar documentos de clientes por este canal. Para envio automático e seguro de PDFs, configure futuramente a API oficial do WhatsApp Business.
                        </div>
                        
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-medium text-slate-200">Status da Conexão</h3>
                                    <p className="text-sm text-slate-400 mt-1">Recurso experimental para mensagens, QR Code e PDF.</p>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                                    waStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    waStatus === 'connecting' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                }`}>
                                    {waStatus === 'connected' ? 'Conectado' : waStatus === 'connecting' ? 'Aguardando QR' : 'Desconectado'}
                                </div>
                            </div>

                            {waStatus === 'disconnected' && (
                                <button onClick={handleConnectWa} className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center font-medium">
                                    <QrCode className="w-5 h-5 mr-2" />
                                    Gerar QR Code de Acesso
                                </button>
                            )}

                            {waStatus === 'connecting' && waQr && (
                                <div className="text-center p-6 bg-white rounded-xl max-w-xs mx-auto">
                                    <img src={waQr} alt="WhatsApp QR Code" className="w-full h-auto" />
                                    <p className="text-slate-800 text-sm mt-4 font-medium">Escaneie com seu WhatsApp</p>
                                </div>
                            )}
                            
                            {waStatus === 'connecting' && !waQr && (
                                <div className="flex items-center justify-center p-12 text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                                    <p>Iniciando sessão do WhatsApp...</p>
                                </div>
                            )}

                            {waStatus === 'connected' && (
                                <button onClick={handleDisconnectWa} className="w-full sm:w-auto px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-all flex items-center justify-center font-medium">
                                    <PowerOff className="w-5 h-5 mr-2" />
                                    Desconectar Sessão
                                </button>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-6 space-y-5">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Mensagens automáticas</h3>
                                <p className="text-sm text-slate-400 mt-1">Campos disponíveis: {'{cliente}'}, {'{numero}'}, {'{valor}'}, {'{status}'}, {'{empresa}'}, {'{titulo}'} e {'{pix}'}.</p>
                            </div>
                            {[
                                ['chargeCreated', 'chargeCreatedEnabled', 'Venda criada / cobrança PIX'],
                                ['paymentConfirmed', 'paymentConfirmedEnabled', 'Pagamento confirmado / agradecimento'],
                                ['serviceOrderCreated', 'serviceOrderCreatedEnabled', 'Ordem de serviço aberta'],
                                ['serviceCompleted', 'serviceCompletedEnabled', 'Serviço concluído / retirada'],
                            ].map(([field, enabledField, label]) => (
                                <div key={field} className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4">
                                    <label className="mb-3 flex items-center gap-3 text-sm font-medium text-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={Boolean((waTemplates as any)[enabledField])}
                                            onChange={event => setWaTemplates(current => ({ ...current, [enabledField]: event.target.checked }))}
                                            className="h-4 w-4 accent-emerald-500"
                                        />
                                        {label}
                                    </label>
                                    <textarea
                                        value={(waTemplates as any)[field]}
                                        onChange={event => setWaTemplates(current => ({ ...current, [field]: event.target.value }))}
                                        rows={field === 'chargeCreated' ? 7 : 4}
                                        className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                                    />
                                </div>
                            ))}
                            <button onClick={handleSaveWaTemplates} disabled={savingWaTemplates} className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> {savingWaTemplates ? 'Salvando...' : 'Salvar mensagens automáticas'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'telegram' && (
                    <form onSubmit={handleSaveTelegram} className="max-w-2xl space-y-6">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                            <Send className="w-5 h-5 mr-3 text-blue-500" />
                            Integração com Telegram Bot
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Bot Token (BotFather)</label>
                                <input
                                    type="text"
                                    value={telegramForm.token}
                                    onChange={(e) => setTelegramForm({ ...telegramForm, token: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600"
                                    placeholder="ex: 123456789:ABCdefGHIjklMNO..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Chat ID Padrão (Opcional)</label>
                                <input
                                    type="text"
                                    value={telegramForm.defaultChatId}
                                    onChange={(e) => setTelegramForm({ ...telegramForm, defaultChatId: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-600"
                                    placeholder="ID do grupo ou chat privado"
                                />
                            </div>
                        </div>
                        <button disabled={loadingTelegram} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center font-medium mt-8">
                            <Save className="w-5 h-5 mr-2" />
                            {loadingTelegram ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </form>
                )}

                {activeTab === 'email' && (
                    <form onSubmit={handleSaveEmail} className="max-w-2xl space-y-6">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                            <Mail className="w-5 h-5 mr-3 text-indigo-500" />
                            Configuração de Servidor SMTP (E-mail)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-400 mb-2">Host SMTP</label>
                                <input
                                    type="text"
                                    value={emailForm.host}
                                    onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="smtp.gmail.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Porta SMTP</label>
                                <input
                                    type="text"
                                    value={emailForm.port}
                                    onChange={(e) => setEmailForm({ ...emailForm, port: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="465 ou 587"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">E-mail de Remetente (From)</label>
                                <input
                                    type="email"
                                    value={emailForm.from}
                                    onChange={(e) => setEmailForm({ ...emailForm, from: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="no-reply@suaempresa.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Usuário</label>
                                <input
                                    type="text"
                                    value={emailForm.user}
                                    onChange={(e) => setEmailForm({ ...emailForm, user: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Senha</label>
                                <input
                                    type="password"
                                    value={emailForm.pass}
                                    onChange={(e) => setEmailForm({ ...emailForm, pass: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <button disabled={loadingEmail} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center font-medium mt-8">
                            <Save className="w-5 h-5 mr-2" />
                            {loadingEmail ? 'Salvando...' : 'Salvar Servidor SMTP'}
                        </button>
                    </form>
                )}
                {activeTab === 'mercadopago' && (
                    <MercadoPagoPage />
                )}
                {activeTab === 'nfse' && (
                    <form onSubmit={handleSaveNfse} className="max-w-4xl space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 text-cyan-400" /> NFS-e Nacional
                            </h2>
                            <p className="mt-2 text-sm text-slate-400">Configuração do emissor próprio para serviços da empresa.</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                            Ambiente oficial de homologação (produção restrita). Os documentos enviados servem apenas para testes e não têm validade fiscal.
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Inscrição Municipal</span>
                                <input required maxLength={15} value={nfseForm.municipalRegistration} onChange={e => setNfseForm({ ...nfseForm, municipalRegistration: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Código IBGE do município</span>
                                <input required pattern="\d{7}" value={nfseForm.municipalityCode} onChange={e => setNfseForm({ ...nfseForm, municipalityCode: e.target.value.replace(/\D/g, '').slice(0, 7) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                                <span className="block text-xs text-slate-500">Manaus: 1302603</span>
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Código de tributação nacional (6 dígitos)</span>
                                <input required pattern="\d{6}" value={nfseForm.nationalServiceCode} onChange={e => setNfseForm({ ...nfseForm, nationalServiceCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                                <span className="block text-xs text-slate-500">Código padrão usado nas ordens de serviço durante o teste.</span>
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Código municipal (opcional, até 3 dígitos)</span>
                                <input pattern="\d{0,3}" value={nfseForm.municipalServiceCode} onChange={e => setNfseForm({ ...nfseForm, municipalServiceCode: e.target.value.replace(/\D/g, '').slice(0, 3) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Série da DPS</span>
                                <input required type="number" min={1} max={49999} value={nfseForm.dpsSeries} onChange={e => setNfseForm({ ...nfseForm, dpsSeries: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Próximo número da DPS</span>
                                <input required type="number" min={1} value={nfseForm.nextDps} onChange={e => setNfseForm({ ...nfseForm, nextDps: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Opção pelo Simples Nacional</span>
                                <select value={nfseForm.simpleNationalStatus} onChange={e => setNfseForm({ ...nfseForm, simpleNationalStatus: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200">
                                    <option value={1}>Não optante</option><option value={2}>Optante - MEI</option><option value={3}>Optante - ME/EPP</option>
                                </select>
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Regime especial de tributação</span>
                                <select value={nfseForm.specialTaxRegime} onChange={e => setNfseForm({ ...nfseForm, specialTaxRegime: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200">
                                    <option value={0}>Nenhum</option><option value={1}>Ato cooperado</option><option value={2}>Estimativa</option><option value={3}>Microempresa municipal</option><option value={4}>Notário ou registrador</option><option value={5}>Profissional autônomo</option><option value={6}>Sociedade de profissionais</option><option value={9}>Outros</option>
                                </select>
                            </label>
                            {nfseForm.simpleNationalStatus === 3 && (
                                <label className="space-y-2 text-sm text-slate-300">
                                    <span>Apuração do Simples Nacional</span>
                                    <select value={nfseForm.simpleNationalTaxRegime} onChange={e => setNfseForm({ ...nfseForm, simpleNationalTaxRegime: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200">
                                        <option value={1}>Tributos federal e municipal pelo Simples</option><option value={2}>Federal pelo Simples e ISS fora</option><option value={3}>Tributos fora do Simples</option>
                                    </select>
                                </label>
                            )}
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Tributação do ISSQN</span>
                                <select value={nfseForm.issTaxation} onChange={e => setNfseForm({ ...nfseForm, issTaxation: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200">
                                    <option value={1}>Operação tributável</option><option value={2}>Exportação de serviço</option><option value={3}>Não incidência</option><option value={4}>Imunidade</option>
                                </select>
                            </label>
                            <label className="space-y-2 text-sm text-slate-300">
                                <span>Retenção do ISSQN</span>
                                <select value={nfseForm.issWithholding} onChange={e => setNfseForm({ ...nfseForm, issWithholding: Number(e.target.value) })} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200">
                                    <option value={1}>Não retido</option><option value={2}>Retido pelo tomador</option><option value={3}>Retido pelo intermediário</option>
                                </select>
                            </label>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-white">Certificado digital A1</h3>
                                    <p className="text-xs text-slate-400 mt-1">O arquivo e a senha são criptografados no servidor e nunca retornam para o navegador.</p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-xs ${nfseForm.certificateConfigured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 text-slate-400'}`}>
                                    {nfseForm.certificateConfigured ? 'Certificado configurado' : 'Não configurado'}
                                </span>
                            </div>
                            {nfseForm.certificateSubject && <p className="break-all text-xs text-slate-400">Titular: {nfseForm.certificateSubject}</p>}
                            {nfseForm.certificateValidTo && <p className="text-xs text-slate-400">Válido até: {new Date(nfseForm.certificateValidTo).toLocaleDateString('pt-BR')}</p>}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-500/40 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-300 hover:bg-cyan-500/10">
                                    <Upload className="h-4 w-4" /> {nfseCertificateName || (nfseForm.certificateConfigured ? 'Trocar certificado .pfx/.p12' : 'Selecionar certificado .pfx/.p12')}
                                    <input type="file" accept=".pfx,.p12,application/x-pkcs12" className="hidden" onChange={e => handleNfseCertificate(e.target.files?.[0])} />
                                </label>
                                <input type="password" value={nfseCertificatePassword} onChange={e => setNfseCertificatePassword(e.target.value)} placeholder={nfseCertificate ? 'Senha do novo certificado' : 'Senha (somente ao trocar certificado)'} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                            </div>
                        </div>
                        <label className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-200">
                            <input type="checkbox" checked={nfseForm.enabled} onChange={e => setNfseForm({ ...nfseForm, enabled: e.target.checked })} className="h-4 w-4 accent-cyan-500" />
                            Liberar o botão de transmissão para homologação nas ordens de serviço
                        </label>
                        <div className="flex flex-wrap gap-3">
                            <button disabled={savingNfse} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"><Save className="h-4 w-4" />{savingNfse ? 'Salvando...' : 'Salvar configuração'}</button>
                            <button type="button" disabled={testingNfse || !nfseForm.certificateConfigured} onClick={handleTestNfse} className="flex items-center gap-2 rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"><Wifi className="h-4 w-4" />{testingNfse ? 'Testando...' : 'Testar conexão'}</button>
                            {nfseForm.lastConnectionStatus && <span className={`self-center text-sm ${nfseForm.lastConnectionStatus === 'connected' ? 'text-emerald-400' : 'text-rose-400'}`}>{nfseForm.lastConnectionStatus === 'connected' ? 'Conexão confirmada' : 'Último teste falhou'}</span>}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
