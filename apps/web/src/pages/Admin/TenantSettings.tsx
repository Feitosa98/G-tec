import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Copy, ExternalLink, Image, Link2, Palette, Save, QrCode } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { showToast } from '../../utils/toast';
import { formatBrazilianPhone } from '../../utils/phone';

const themePresets = [
    { name: 'Tecnologia', primaryColor: '#0052cc', accentColor: '#d4a024', backgroundColor: '#0a0e1a', cardColor: '#12182b' },
    { name: 'Varejo', primaryColor: '#7c3aed', accentColor: '#f97316', backgroundColor: '#111827', cardColor: '#1f2937' },
    { name: 'Elegante', primaryColor: '#0f766e', accentColor: '#fbbf24', backgroundColor: '#071a18', cardColor: '#102724' },
    { name: 'Claro', primaryColor: '#2563eb', accentColor: '#ea580c', backgroundColor: '#1e293b', cardColor: '#334155' }
];

const TenantSettings = () => {
    const { tenant, updateTenant } = useData();
    const [settings, setSettings] = useState(tenant || {});
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (tenant) setSettings({ ...tenant, whatsapp: formatBrazilianPhone(tenant.whatsapp) });
    }, [tenant]);

    const publicUrl = useMemo(() => {
        if (settings.customDomain) {
            return settings.customDomain.startsWith('http') ? settings.customDomain : `https://${settings.customDomain}`;
        }
        return `${window.location.origin}${import.meta.env.BASE_URL}?loja=${settings.storeSlug}`;
    }, [settings.customDomain, settings.storeSlug]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setSettings(current => ({
            ...current,
            [name]: name === 'storeSlug'
                ? value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
                : value
        }));
    };

    const handlePhoneChange = (event) => {
        setSettings(current => ({
            ...current,
            whatsapp: formatBrazilianPhone(event.target.value)
        }));
    };

    const handleLogoFile = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast.error('Selecione um arquivo de imagem.');
            return;
        }
        if (file.size > 1024 * 1024) {
            showToast.error('A imagem deve ter no máximo 1 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => setSettings(current => ({ ...current, logoUrl: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (!settings.businessName || !settings.shortName || !settings.storeSlug) {
            showToast.error('Preencha o nome da empresa, nome curto e identificador do link.');
            return;
        }
        try {
            await updateTenant(settings);
            showToast.success('Identidade da empresa atualizada.');
        } catch {
            showToast.error('Não foi possível salvar a identidade no banco da loja.');
        }
    };

    const copyPublicUrl = async () => {
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent mb-2">
                    Personalizar Empresa
                </h1>
                <p className="text-slate-400 text-sm sm:text-base font-normal">
                    Configure a identidade visual e o endereço da loja para cada cliente do SaaS.
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <Section title="Identidade" icon={Building2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <Field label="Nome da empresa">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="businessName"
                                value={settings.businessName}
                                onChange={handleChange}
                            />
                        </Field>
                        <Field label="Nome curto">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="shortName"
                                value={settings.shortName}
                                onChange={handleChange}
                                maxLength={20}
                            />
                        </Field>
                        <Field label="CNPJ ou documento">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="document"
                                value={settings.document}
                                onChange={handleChange}
                            />
                        </Field>
                        <Field label="E-mail comercial">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="email"
                                type="email"
                                value={settings.email}
                                onChange={handleChange}
                            />
                        </Field>
                        <Field label="WhatsApp com DDI e DDD">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="whatsapp"
                                type="tel"
                                inputMode="numeric"
                                placeholder="(92) 99999-9999"
                                value={settings.whatsapp}
                                onChange={handlePhoneChange}
                                maxLength={15}
                            />
                        </Field>
                        <Field label="Endereço">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="address"
                                value={settings.address}
                                onChange={handleChange}
                            />
                        </Field>
                    </div>
                </Section>

                <Section title="Recebimentos / PIX" icon={QrCode}>
                    <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                        Esta chave fixa é usada somente quando o Mercado Pago não estiver configurado. Com a integração ativa, cada venda gera um PIX próprio e conciliável.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="Chave PIX (CPF/CNPJ, E-mail, Celular ou Aleatória)">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="pixKey"
                                value={settings.pixKey || ''}
                                onChange={handleChange}
                                placeholder="Sua chave PIX"
                            />
                        </Field>
                        <Field label="Nome do Titular da Conta (Exatamente como no banco)">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="pixName"
                                value={settings.pixName || ''}
                                onChange={handleChange}
                                placeholder="Nome do Titular"
                            />
                        </Field>
                    </div>
                </Section>

                <Section title="Logo" icon={Image}>
                    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-6 items-center">
                        <div className="h-32 rounded-xl bg-slate-950/60 border border-dashed border-slate-700/80 flex items-center justify-center p-3 shadow-inner overflow-hidden">
                            {settings.logoUrl ? (
                                <img src={settings.logoUrl} alt="Prévia da logo" className="max-w-full max-h-24 object-contain" />
                            ) : (
                                <Image size={36} className="text-slate-600" />
                            )}
                        </div>
                        <div className="flex flex-col gap-3">
                            <Field label="Endereço da imagem">
                                <input
                                    className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                    name="logoUrl"
                                    value={settings.logoUrl?.startsWith('data:') ? '' : settings.logoUrl}
                                    onChange={handleChange}
                                    placeholder="https://.../logo.png"
                                />
                            </Field>
                            <div className="flex items-center gap-3 flex-wrap">
                                <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-200 text-sm font-medium hover:bg-slate-700/60 hover:text-white cursor-pointer transition-all duration-200 shadow-sm active:scale-95">
                                    Enviar arquivo
                                    <input type="file" accept="image/*" onChange={handleLogoFile} hidden />
                                </label>
                                <span className="text-xs text-slate-500">PNG, JPG ou SVG de até 1 MB.</span>
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="Tema" icon={Palette}>
                    <div className="flex flex-wrap gap-3 mb-6">
                        {themePresets.map(preset => (
                            <button
                                key={preset.name}
                                type="button"
                                onClick={() => setSettings(current => ({ ...current, ...preset }))}
                                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white border transition-all duration-200 shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
                                style={{ background: preset.cardColor, borderColor: preset.accentColor }}
                            >
                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: preset.primaryColor }} />
                                {preset.name}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <ColorField label="Cor principal" name="primaryColor" value={settings.primaryColor} onChange={handleChange} />
                        <ColorField label="Cor de destaque" name="accentColor" value={settings.accentColor} onChange={handleChange} />
                        <ColorField label="Cor de fundo" name="backgroundColor" value={settings.backgroundColor} onChange={handleChange} />
                        <ColorField label="Cor dos cartões" name="cardColor" value={settings.cardColor} onChange={handleChange} />
                    </div>
                </Section>

                <Section title="Link da Loja" icon={Link2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                        <Field label="Identificador do link">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="storeSlug"
                                value={settings.storeSlug}
                                onChange={handleChange}
                            />
                        </Field>
                        <Field label="Domínio próprio (opcional)">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="customDomain"
                                value={settings.customDomain}
                                onChange={handleChange}
                                placeholder="loja.suaempresa.com.br"
                            />
                        </Field>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center gap-3 flex-wrap shadow-inner">
                        <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <ExternalLink size={18} />
                        </span>
                        <code className="flex-1 min-w-[200px] text-sm font-mono text-slate-300 break-all select-all">
                            {publicUrl}
                        </code>
                        <button
                            type="button"
                            onClick={copyPublicUrl}
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 active:scale-95 shadow-sm cursor-pointer ${
                                copied
                                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                    : 'border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copiado' : 'Copiar'}
                        </button>
                    </div>
                </Section>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                        <Save size={18} /> Salvar personalização
                    </button>
                </div>
            </form>
        </div>
    );
};

const Section = ({ title, icon: Icon, children }) => (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-6 shadow-xl shadow-black/20 transition-all duration-300 hover:border-slate-700/60 mb-6">
        <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-100 mb-6 border-b border-slate-800/60 pb-3">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner">
                <Icon size={20} />
            </span>
            {title}
        </h2>
        {children}
    </section>
);

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
        </label>
        {children}
    </div>
);

const ColorField = ({ label, name, value, onChange }) => (
    <Field label={label}>
        <div className="flex items-center gap-3">
            <input
                name={name}
                type="color"
                value={value}
                onChange={onChange}
                className="w-12 h-10 p-1 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer shadow-inner shrink-0"
            />
            <input
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                name={name}
                value={value}
                onChange={onChange}
            />
        </div>
    </Field>
);

export default TenantSettings;
