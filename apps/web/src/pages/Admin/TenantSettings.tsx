import { useEffect, useState } from 'react';
import { Building2, Image, Palette, Save, QrCode } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { showToast } from '../../utils/toast';
import { formatBrazilianPhone } from '../../utils/phone';

const TenantSettings = () => {
    const { tenant, updateTenant } = useData();
    const [settings, setSettings] = useState(tenant || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (tenant) setSettings({ ...tenant, whatsapp: formatBrazilianPhone(tenant.whatsapp) });
    }, [tenant]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setSettings(current => ({
            ...current,
            [name]: value
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
        if (!settings.businessName?.trim() || !settings.shortName?.trim()) {
            showToast.error('Preencha o nome da empresa e o nome curto.');
            return;
        }
        setIsSaving(true);
        try {
            await updateTenant(settings);
            showToast.success('Dados da empresa atualizados.');
        } catch {
            showToast.error('Não foi possível salvar os dados da empresa.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent mb-2">
                    Personalizar Empresa
                </h1>
                <p className="text-slate-400 text-sm sm:text-base font-normal">
                    Atualize os dados usados no sistema, nos documentos e nos recebimentos.
                </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <Section title="Identidade" icon={Building2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <Field label="Nome da empresa">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="businessName"
                                value={settings.businessName || ''}
                                onChange={handleChange}
                            />
                        </Field>
                        <Field label="Razão social">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="legalName"
                                value={settings.legalName || ''}
                                onChange={handleChange}
                                placeholder="Nome empresarial registrado no CNPJ"
                            />
                        </Field>
                        <Field label="Nome curto">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="shortName"
                                value={settings.shortName || ''}
                                onChange={handleChange}
                                maxLength={20}
                            />
                        </Field>
                        <Field label="CNPJ ou documento">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="document"
                                value={settings.document || ''}
                                onChange={handleChange}
                            />
                        </Field>
                        <Field label="E-mail comercial">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="email"
                                type="email"
                                value={settings.email || ''}
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
                                value={settings.whatsapp || ''}
                                onChange={handlePhoneChange}
                                maxLength={15}
                            />
                        </Field>
                        <Field label="Endereço">
                            <input
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200 shadow-inner hover:border-slate-700"
                                name="address"
                                value={settings.address || ''}
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

                <Section title="Cores da marca" icon={Palette}>
                    <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                        Estas cores são usadas na tela de acesso da empresa.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <ColorField label="Cor principal" name="primaryColor" value={settings.primaryColor || '#2563eb'} onChange={handleChange} />
                        <ColorField label="Cor de destaque" name="accentColor" value={settings.accentColor || '#f59e0b'} onChange={handleChange} />
                    </div>
                </Section>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                        <Save size={18} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
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
                pattern="#[0-9a-fA-F]{6}"
                maxLength={7}
            />
        </div>
    </Field>
);

export default TenantSettings;
