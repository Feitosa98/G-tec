import { useMemo, useState } from 'react';
import { Building2, Check, Copy, ExternalLink, Image, Link2, Palette, Save } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { showToast } from '../../utils/toast';

const themePresets = [
    { name: 'Tecnologia', primaryColor: '#0052cc', accentColor: '#d4a024', backgroundColor: '#0a0e1a', cardColor: '#12182b' },
    { name: 'Varejo', primaryColor: '#7c3aed', accentColor: '#f97316', backgroundColor: '#111827', cardColor: '#1f2937' },
    { name: 'Elegante', primaryColor: '#0f766e', accentColor: '#fbbf24', backgroundColor: '#071a18', cardColor: '#102724' },
    { name: 'Claro', primaryColor: '#2563eb', accentColor: '#ea580c', backgroundColor: '#1e293b', cardColor: '#334155' }
];

const TenantSettings = () => {
    const { tenant, updateTenant } = useData();
    const [settings, setSettings] = useState(tenant);
    const [copied, setCopied] = useState(false);

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

    const handleSave = (event) => {
        event.preventDefault();
        if (!settings.businessName || !settings.shortName || !settings.storeSlug) {
            showToast.error('Preencha o nome da empresa, nome curto e identificador do link.');
            return;
        }
        updateTenant(settings);
        showToast.success('Identidade da empresa atualizada.');
    };

    const copyPublicUrl = async () => {
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem' }}>Personalizar Empresa</h1>
                <p style={{ color: 'var(--color-text-muted)' }}>Configure a identidade visual e o endereço da loja para cada cliente do SaaS.</p>
            </div>

            <form onSubmit={handleSave}>
                <Section title="Identidade" icon={Building2}>
                    <div style={gridStyle}>
                        <Field label="Nome da empresa">
                            <input name="businessName" value={settings.businessName} onChange={handleChange} style={inputStyle} />
                        </Field>
                        <Field label="Nome curto">
                            <input name="shortName" value={settings.shortName} onChange={handleChange} maxLength={20} style={inputStyle} />
                        </Field>
                        <Field label="CNPJ ou documento">
                            <input name="document" value={settings.document} onChange={handleChange} style={inputStyle} />
                        </Field>
                        <Field label="E-mail comercial">
                            <input name="email" type="email" value={settings.email} onChange={handleChange} style={inputStyle} />
                        </Field>
                        <Field label="WhatsApp com DDI e DDD">
                            <input name="whatsapp" value={settings.whatsapp} onChange={handleChange} style={inputStyle} />
                        </Field>
                        <Field label="Endereço">
                            <input name="address" value={settings.address} onChange={handleChange} style={inputStyle} />
                        </Field>
                    </div>
                </Section>

                <Section title="Logo" icon={Image}>
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ height: '120px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '12px', display: 'grid', placeItems: 'center', padding: '1rem' }}>
                            {settings.logoUrl ? <img src={settings.logoUrl} alt="Prévia da logo" style={{ maxWidth: '100%', maxHeight: '90px', objectFit: 'contain' }} /> : <Image size={36} color="var(--color-text-muted)" />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            <Field label="Endereço da imagem">
                                <input name="logoUrl" value={settings.logoUrl?.startsWith('data:') ? '' : settings.logoUrl} onChange={handleChange} placeholder="https://.../logo.png" style={inputStyle} />
                            </Field>
                            <label className="btn-outline" style={{ width: 'fit-content', cursor: 'pointer', padding: '0.7rem 1rem' }}>
                                Enviar arquivo
                                <input type="file" accept="image/*" onChange={handleLogoFile} hidden />
                            </label>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>PNG, JPG ou SVG de até 1 MB.</span>
                        </div>
                    </div>
                </Section>

                <Section title="Tema" icon={Palette}>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        {themePresets.map(preset => (
                            <button key={preset.name} type="button" onClick={() => setSettings(current => ({ ...current, ...preset }))} style={{ background: preset.cardColor, color: 'white', border: `2px solid ${preset.accentColor}`, borderRadius: '10px', padding: '0.7rem 1rem' }}>
                                {preset.name}
                            </button>
                        ))}
                    </div>
                    <div style={gridStyle}>
                        <ColorField label="Cor principal" name="primaryColor" value={settings.primaryColor} onChange={handleChange} />
                        <ColorField label="Cor de destaque" name="accentColor" value={settings.accentColor} onChange={handleChange} />
                        <ColorField label="Cor de fundo" name="backgroundColor" value={settings.backgroundColor} onChange={handleChange} />
                        <ColorField label="Cor dos cartões" name="cardColor" value={settings.cardColor} onChange={handleChange} />
                    </div>
                </Section>

                <Section title="Link da Loja" icon={Link2}>
                    <div style={gridStyle}>
                        <Field label="Identificador do link">
                            <input name="storeSlug" value={settings.storeSlug} onChange={handleChange} style={inputStyle} />
                        </Field>
                        <Field label="Domínio próprio (opcional)">
                            <input name="customDomain" value={settings.customDomain} onChange={handleChange} placeholder="loja.suaempresa.com.br" style={inputStyle} />
                        </Field>
                    </div>
                    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <ExternalLink size={18} color="var(--color-accent)" />
                        <code style={{ flex: 1, overflowWrap: 'anywhere', color: 'var(--color-text-muted)' }}>{publicUrl}</code>
                        <button type="button" onClick={copyPublicUrl} className="btn-outline" style={{ padding: '0.55rem 0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar'}
                        </button>
                    </div>
                </Section>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Save size={18} /> Salvar personalização
                    </button>
                </div>
            </form>
        </div>
    );
};

const Section = ({ title, icon: Icon, children }) => (
    <section style={{ background: 'var(--color-bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon size={20} color="var(--color-accent)" /> {title}</h2>
        {children}
    </section>
);

const Field = ({ label, children }) => <label><span style={labelStyle}>{label}</span>{children}</label>;

const ColorField = ({ label, name, value, onChange }) => (
    <Field label={label}>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
            <input name={name} type="color" value={value} onChange={onChange} style={{ width: '52px', height: '44px', padding: '3px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
            <input name={name} value={value} onChange={onChange} style={inputStyle} />
        </div>
    </Field>
);

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' };
const labelStyle = { display: 'block', color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.45rem' };
const inputStyle = { width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', color: 'white', outline: 'none' };

export default TenantSettings;
