import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { CreditCard, Key, Shield, CheckCircle, AlertCircle, Save, ExternalLink, Copy, Trash2, X, Link, QrCode } from 'lucide-react';
import { useMercadoPago } from '../../hooks/useMercadoPago';
import toast from 'react-hot-toast';

export default function MercadoPagoPage() {
    const { tenant } = useData();
    const { generatePixPayment, copyLinkToClipboard } = useMercadoPago();

    const [accessToken, setAccessToken] = useState('');
    const [sandbox, setSandbox] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [webhookSecret, setWebhookSecret] = useState('');
    const [publicBaseUrl, setPublicBaseUrl] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [autoReconciliationEnabled, setAutoReconciliationEnabled] = useState(false);

    // Test link generation
    const [showTestModal, setShowTestModal] = useState(false);
    const [testAmount, setTestAmount] = useState('10.00');
    const [testDesc, setTestDesc] = useState('Produto Teste');
    const [testEmail, setTestEmail] = useState('');
    const [generatedPix, setGeneratedPix] = useState<{ paymentId?: string; qrCode?: string; qrCodeBase64?: string; ticketUrl?: string } | null>(null);
    const [generatingTest, setGeneratingTest] = useState(false);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };
    const headers = { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        const loadConfig = async () => {
            if (!tenant?.storeSlug) return;
            const res = await fetch(`/api/store/${tenant.storeSlug}/integrations`, { headers });
            if (res.ok) {
                const list = await res.json();
                const mp = list.find((r: any) => r.id === 'mercadopago');
                if (mp) {
                    setAccessToken(mp.accessToken ? '••••••••••••••••' + mp.accessToken.slice(-6) : '');
                    setSandbox(mp.sandbox ?? true);
                    setConfigured(!!mp.accessToken);
                    setWebhookSecret(mp.webhookSecret ? '••••••••••••••••' + mp.webhookSecret.slice(-6) : '');
                    setPublicBaseUrl(mp.publicBaseUrl || '');
                    setWebhookUrl(mp.webhookUrl || '');
                    setAutoReconciliationEnabled(!!mp.autoReconciliationEnabled);
                }
            }
        };
        loadConfig();
    }, [tenant]);

    useEffect(() => {
        if (tenant?.email) setTestEmail(current => current || tenant.email);
    }, [tenant?.email]);

    const handleSave = async () => {
        if (!accessToken) {
            toast.error('Cole seu Access Token do Mercado Pago');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/api/store/${tenant?.storeSlug}/mercadopago/config`, {
                method: 'POST', headers,
                body: JSON.stringify({ accessToken, webhookSecret, publicBaseUrl, sandbox }),
            });
            if (res.ok) {
                const data = await res.json();
                setConfigured(true);
                setWebhookUrl(data.webhookUrl || '');
                setAutoReconciliationEnabled(!!data.autoReconciliationEnabled);
                toast.success('Mercado Pago configurado com sucesso!');
            } else {
                const d = await res.json();
                toast.error(d.message || 'Erro ao salvar');
            }
        } finally { setSaving(false); }
    };

    const handleTestLink = async () => {
        const amount = parseFloat(testAmount.replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Informe um valor maior que zero.');
            return;
        }
        if (!testEmail.trim()) {
            toast.error('Informe o e-mail do pagador.');
            return;
        }

        setGeneratingTest(true);
        setGeneratedPix(null);
        try {
            const result = await generatePixPayment({
                amount,
                description: testDesc.trim() || 'Produto Teste',
                payerEmail: testEmail.trim(),
                referenceType: 'test',
            });
            if (result.success) setGeneratedPix(result);
        } finally {
            setGeneratingTest(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Status Banner */}
            <div className={`flex items-center gap-4 p-5 rounded-2xl border ${configured ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                {configured
                    ? <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                    : <AlertCircle className="w-8 h-8 text-amber-400 shrink-0" />}
                <div>
                    <p className={`font-semibold ${configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {configured ? '✅ Mercado Pago Conectado' : '⚠️ Não configurado'}
                    </p>
                    <p className="text-slate-400 text-sm">
                        {configured
                            ? 'Você pode gerar links de pagamento nas telas de OS e Cobranças'
                            : 'Configure seu Access Token para habilitar links de pagamento'}
                    </p>
                </div>
            </div>

            <div className={`flex items-center gap-4 p-5 rounded-2xl border ${autoReconciliationEnabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/40 border-slate-700/60'}`}>
                {autoReconciliationEnabled
                    ? <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                    : <Shield className="w-8 h-8 text-slate-500 shrink-0" />}
                <div>
                    <p className={`font-semibold ${autoReconciliationEnabled ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {autoReconciliationEnabled ? 'Baixa automática do PIX ativada' : 'Baixa automática do PIX desativada'}
                    </p>
                    <p className="text-slate-400 text-sm">
                        {autoReconciliationEnabled
                            ? 'Pagamentos PIX aprovados serão conciliados automaticamente.'
                            : 'Informe a URL pública HTTPS e a chave secreta do webhook.'}
                    </p>
                </div>
            </div>

            {/* Config Card */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Key className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-200">Access Token</h3>
                        <p className="text-xs text-slate-500">Encontrado em: Mercado Pago → Desenvolvimento → Credenciais</p>
                    </div>
                    <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer"
                        className="ml-auto text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        Abrir painel <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                <div>
                    <label className="text-sm text-slate-400 mb-2 block">
                        {sandbox ? 'Access Token de Teste (Sandbox)' : 'Access Token de Produção'}
                    </label>
                    <input
                        type="password"
                        value={accessToken}
                        onChange={e => setAccessToken(e.target.value)}
                        placeholder={sandbox ? 'TEST-XXXXXXXXXXXX...' : 'APP_USR-XXXXXXXXXXXX...'}
                        className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-slate-100 outline-none transition-all font-mono text-sm"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">URL pública do sistema (HTTPS)</label>
                        <input
                            type="url"
                            value={publicBaseUrl}
                            onChange={e => setPublicBaseUrl(e.target.value)}
                            placeholder="https://sistema.seudominio.com.br"
                            className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-slate-100 outline-none transition-all font-mono text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 mb-2 block">Chave secreta do Webhook</label>
                        <input
                            type="password"
                            value={webhookSecret}
                            onChange={e => setWebhookSecret(e.target.value)}
                            placeholder="Chave exibida em Webhooks no Mercado Pago"
                            className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-slate-100 outline-none transition-all font-mono text-sm"
                        />
                    </div>
                </div>

                {webhookUrl && (
                    <div className="flex items-center gap-2 p-3 bg-slate-950/60 rounded-xl border border-slate-700">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500 mb-1">Cadastre esta URL no evento Pagamentos do Mercado Pago:</p>
                            <p className="text-blue-400 text-xs truncate font-mono">{webhookUrl}</p>
                        </div>
                        <button onClick={() => copyLinkToClipboard(webhookUrl)} className="p-2 text-slate-400 hover:text-white" title="Copiar URL do webhook">
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
                    <button
                        onClick={() => setSandbox(!sandbox)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${sandbox ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sandbox ? '' : 'translate-x-5'}`} />
                    </button>
                    <div>
                        <p className={`text-sm font-medium ${sandbox ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {sandbox ? '🧪 Modo Teste (Sandbox)' : '🚀 Modo Produção'}
                        </p>
                        <p className="text-xs text-slate-500">
                            {sandbox ? 'Pagamentos não são reais — use para testar' : 'Pagamentos reais serão processados'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Salvando...' : 'Salvar Configuração'}
                </button>
            </div>

            {/* How to use */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-slate-400" />
                    <h3 className="font-semibold text-slate-200">Como usar</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { step: '1', title: 'Configure o Token', desc: 'Cole seu Access Token acima e salve', icon: Key },
                        { step: '2', title: 'Gere o Link', desc: 'Clique em 💳 nas telas de OS ou Cobranças', icon: Link },
                        { step: '3', title: 'Envie ao Cliente', desc: 'Copie o link ou envie direto pelo WhatsApp', icon: CreditCard },
                    ].map(({ step, title, desc, icon: Icon }) => (
                        <div key={step} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{step}</div>
                            <div>
                                <p className="text-slate-200 font-medium text-sm">{title}</p>
                                <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Test generator */}
            {configured && (
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-4">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-400" /> Testar Geração de Link
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">Descrição</label>
                            <input value={testDesc} onChange={e => setTestDesc(e.target.value)}
                                className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-100 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1.5 block">Valor (R$)</label>
                            <input value={testAmount} onChange={e => setTestAmount(e.target.value)}
                                className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-100 outline-none text-sm" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-slate-400 mb-1.5 block">E-mail do pagador</label>
                            <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                                placeholder="cliente@email.com"
                                className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-100 outline-none text-sm" />
                        </div>
                    </div>
                    <button onClick={handleTestLink} disabled={generatingTest}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                        <Link className="w-4 h-4" />
                        {generatingTest ? 'Gerando QR Code...' : 'Gerar QR Code PIX'}
                    </button>
                    {generatedPix?.qrCode && generatedPix.qrCodeBase64 && (
                        <div className="grid gap-5 md:grid-cols-[220px_1fr] p-5 bg-slate-950/60 rounded-2xl border border-emerald-500/20">
                            <div className="bg-white rounded-xl p-3 flex items-center justify-center">
                                <img
                                    src={`data:image/png;base64,${generatedPix.qrCodeBase64}`}
                                    alt="QR Code PIX"
                                    className="w-full max-w-[196px] aspect-square object-contain"
                                />
                            </div>
                            <div className="min-w-0 space-y-3">
                                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                                    <QrCode className="w-5 h-5" /> PIX pronto para pagamento
                                </div>
                                <p className="text-xs text-slate-400">Escaneie o QR Code ou copie o código PIX abaixo.</p>
                                <textarea readOnly value={generatedPix.qrCode}
                                    className="w-full h-24 resize-none bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 font-mono outline-none" />
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => copyLinkToClipboard(generatedPix.qrCode!)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                                        <Copy className="w-4 h-4" /> Copiar PIX
                                    </button>
                                    {generatedPix.ticketUrl && (
                                        <a href={generatedPix.ticketUrl} target="_blank" rel="noreferrer"
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium flex items-center gap-2">
                                            <ExternalLink className="w-4 h-4" /> Abrir pagamento
                                        </a>
                                    )}
                                </div>
                                {generatedPix.paymentId && <p className="text-[11px] text-slate-600">Pagamento #{generatedPix.paymentId}</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
