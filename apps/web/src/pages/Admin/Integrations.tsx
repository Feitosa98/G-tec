import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { useAuthStore } from '../../store/authStore';
import { storeRequest } from '../../utils/api';
import toast from 'react-hot-toast';
import { Mail, MessageCircle, Send, QrCode, PowerOff, Save, RefreshCw, CreditCard } from 'lucide-react';
import MercadoPagoPage from './MercadoPagoPage';

export default function Integrations() {
    const { tenant } = useData();
    const token = useAuthStore(state => state.user?.token || '');
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'telegram' | 'email' | 'mercadopago'>('whatsapp');

    const [emailForm, setEmailForm] = useState({ host: '', port: '', user: '', pass: '', from: '' });
    const [telegramForm, setTelegramForm] = useState({ token: '', defaultChatId: '' });
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [loadingTelegram, setLoadingTelegram] = useState(false);

    // WhatsApp State
    const [waStatus, setWaStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
    const [waQr, setWaQr] = useState<string | null>(null);
    const [isPollingWa, setIsPollingWa] = useState(false);

    useEffect(() => {
        if (!tenant?.storeSlug || !token) return;
        storeRequest('integrations').then((records: any[]) => {
            const email = records.find(record => record.id === 'email');
            const telegram = records.find(record => record.id === 'telegram');
            if (email) setEmailForm({ host: email.host || '', port: email.port || '', user: email.user || '', pass: email.pass || '', from: email.from || '' });
            if (telegram) setTelegramForm({ token: telegram.token || '', defaultChatId: telegram.defaultChatId || '' });
        }).catch(() => toast.error('Não foi possível carregar as integrações.'));
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

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 fade-in">
            <header className="mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                    Integrações
                </h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Conecte o G-TEC aos seus canais de comunicação favoritos
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
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-xl">
                {activeTab === 'whatsapp' && (
                    <div className="max-w-2xl">
                        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                            <MessageCircle className="w-5 h-5 mr-3 text-emerald-500" />
                            Integração Oficial com WhatsApp
                        </h2>
                        
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-medium text-slate-200">Status da Conexão</h3>
                                    <p className="text-sm text-slate-400 mt-1">Conecte seu celular para enviar recibos e cobranças automaticamente.</p>
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
            </div>
        </div>
    );
}
