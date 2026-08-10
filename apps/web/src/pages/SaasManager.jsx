import { useEffect, useMemo, useState } from 'react';
import { Building2, Database, ExternalLink, Image, LockKeyhole, LogOut, Pencil, Plus, Save, Store } from 'lucide-react';
import { showToast } from '../utils/toast';

const emptyForm = {
    businessName: '', shortName: '', storeSlug: '', document: '', email: '', billingEmail: '',
    whatsapp: '', phone: '', street: '', addressNumber: '', neighborhood: '', city: '', state: '',
    postalCode: '', customDomain: '', logoUrl: '', primaryColor: '#2563eb', accentColor: '#f59e0b',
    backgroundColor: '#0f172a', cardColor: '#1e293b', adminName: 'Administrador', adminUsername: 'admin', adminPassword: ''
};

const SaasManager = () => {
    const [token, setToken] = useState(() => sessionStorage.getItem('gtec-saas-token') || '');
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [tenants, setTenants] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);

    const publicUrl = useMemo(() => form.storeSlug ? `${window.location.origin}${import.meta.env.BASE_URL}?loja=${form.storeSlug}` : '', [form.storeSlug]);

    const apiRequest = async (path, options = {}) => {
        const response = await fetch(path, {
            ...options,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
        return data;
    };

    const loadTenants = async () => {
        if (!token) return;
        try {
            setTenants(await apiRequest('/api/saas/tenants'));
        } catch (error) {
            sessionStorage.removeItem('gtec-saas-token');
            setToken('');
            showToast.error(error.message);
        }
    };

    useEffect(() => { loadTenants(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogin = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('/api/saas/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Credenciais inválidas.');
            sessionStorage.setItem('gtec-saas-token', data.token);
            setToken(data.token);
        } catch (error) {
            showToast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm(current => ({
            ...current,
            [name]: name === 'storeSlug'
                ? value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-/, '')
                : value
        }));
    };

    const handleBusinessName = (event) => {
        const value = event.target.value;
        setForm(current => ({
            ...current,
            businessName: value,
            shortName: editingId || current.shortName ? current.shortName : value.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase(),
            storeSlug: editingId || current.storeSlug ? current.storeSlug : value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        }));
    };

    const handleLogo = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/') || file.size > 1024 * 1024) {
            showToast.error('Use uma imagem PNG, JPG ou SVG de até 1 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setForm(current => ({ ...current, logoUrl: reader.result }));
        reader.readAsDataURL(file);
    };

    const resetForm = () => { setForm(emptyForm); setEditingId(null); };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.businessName || !form.storeSlug || !form.email || (!editingId && !form.adminPassword)) {
            showToast.error('Preencha nome, identificador, e-mail e senha administrativa.');
            return;
        }
        setLoading(true);
        try {
            const address = [form.street, form.addressNumber, form.neighborhood, form.city, form.state, form.postalCode].filter(Boolean).join(', ');
            const payload = { ...form, address };
            if (editingId && !payload.adminPassword) delete payload.adminPassword;
            await apiRequest(editingId ? `/api/saas/tenants/${editingId}` : '/api/saas/tenants', {
                method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload)
            });
            showToast.success(editingId ? 'Loja atualizada.' : 'Loja e banco exclusivo criados.');
            resetForm();
            await loadTenants();
        } catch (error) {
            showToast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const editTenant = (tenant) => {
        setEditingId(tenant.id);
        setForm({ ...emptyForm, ...tenant, adminPassword: '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleTenant = async (tenant) => {
        try {
            await apiRequest(`/api/saas/tenants/${tenant.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !tenant.active }) });
            showToast.success(tenant.active ? 'Loja desativada.' : 'Loja ativada.');
            await loadTenants();
        } catch (error) { showToast.error(error.message); }
    };

    if (!token) {
        return (
            <div style={pageStyle}>
                <form onSubmit={handleLogin} style={{ ...panelStyle, width: 'min(420px, 92vw)', textAlign: 'center' }}>
                    <LockKeyhole size={48} color="var(--color-accent)" />
                    <h1 style={{ margin: '1rem 0 0.4rem' }}>Gestão SaaS</h1>
                    <p style={mutedStyle}>Área reservada para cadastro e administração das lojas.</p>
                    <input aria-label="Usuário gestor" placeholder="Usuário gestor" value={credentials.username} onChange={event => setCredentials(current => ({ ...current, username: event.target.value }))} style={inputStyle} required />
                    <input aria-label="Senha gestora" type="password" placeholder="Senha gestora" value={credentials.password} onChange={event => setCredentials(current => ({ ...current, password: event.target.value }))} style={inputStyle} required />
                    <button className="btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Acessar gestão'}</button>
                </form>
            </div>
        );
    }

    return (
        <div style={{ ...pageStyle, display: 'block', padding: '2rem' }}>
            <header style={{ maxWidth: '1280px', margin: '0 auto 1.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <p style={{ color: 'var(--color-accent)', fontWeight: 700, marginBottom: '0.25rem' }}>ÁREA RESERVADA</p>
                    <h1><Store size={28} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Gestão de lojas</h1>
                    <p style={mutedStyle}>Cada loja cadastrada recebe um banco PostgreSQL exclusivo.</p>
                </div>
                <button className="btn-outline" onClick={() => { sessionStorage.removeItem('gtec-saas-token'); setToken(''); }}><LogOut size={17} /> Sair</button>
            </header>

            <main style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <form onSubmit={handleSubmit} style={panelStyle}>
                    <h2 style={sectionTitle}><Plus size={20} /> {editingId ? 'Editar loja' : 'Cadastrar nova loja'}</h2>
                    <div style={gridStyle}>
                        <Field label="Nome da empresa *"><input name="businessName" value={form.businessName} onChange={handleBusinessName} style={inputStyle} /></Field>
                        <Field label="Nome curto *"><input name="shortName" value={form.shortName} onChange={handleChange} maxLength={20} style={inputStyle} /></Field>
                        <Field label="Identificador do link *"><input name="storeSlug" value={form.storeSlug} onChange={handleChange} disabled={Boolean(editingId)} style={inputStyle} /></Field>
                        <Field label="CNPJ ou documento"><input name="document" value={form.document} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="E-mail comercial *"><input name="email" type="email" value={form.email} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="E-mail financeiro"><input name="billingEmail" type="email" value={form.billingEmail} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="WhatsApp com DDI e DDD"><input name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="5592999999999" style={inputStyle} /></Field>
                        <Field label="Telefone"><input name="phone" value={form.phone} onChange={handleChange} style={inputStyle} /></Field>
                    </div>

                    <h3 style={sectionTitle}><Building2 size={19} /> Endereço</h3>
                    <div style={gridStyle}>
                        <Field label="Logradouro"><input name="street" value={form.street} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="Número"><input name="addressNumber" value={form.addressNumber} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="Bairro"><input name="neighborhood" value={form.neighborhood} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="Cidade"><input name="city" value={form.city} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="Estado"><input name="state" value={form.state} onChange={handleChange} maxLength={2} style={inputStyle} /></Field>
                        <Field label="CEP"><input name="postalCode" value={form.postalCode} onChange={handleChange} style={inputStyle} /></Field>
                    </div>

                    <h3 style={sectionTitle}><Image size={19} /> Identidade e acesso</h3>
                    <div style={gridStyle}>
                        <Field label="URL da logo"><input name="logoUrl" value={form.logoUrl?.startsWith('data:') ? '' : form.logoUrl} onChange={handleChange} placeholder="https://.../logo.png" style={inputStyle} /></Field>
                        <Field label="Enviar logo"><input type="file" accept="image/*" onChange={handleLogo} style={inputStyle} /></Field>
                        <Field label="Domínio próprio"><input name="customDomain" value={form.customDomain} onChange={handleChange} placeholder="loja.exemplo.com.br" style={inputStyle} /></Field>
                        <Field label="Nome do administrador"><input name="adminName" value={form.adminName} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label="Usuário administrador *"><input name="adminUsername" value={form.adminUsername} onChange={handleChange} style={inputStyle} /></Field>
                        <Field label={editingId ? 'Nova senha (opcional)' : 'Senha administrativa *'}><input name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange} style={inputStyle} /></Field>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
                        <code style={{ color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}>{publicUrl}</code>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {editingId && <button type="button" className="btn-outline" onClick={resetForm}>Cancelar</button>}
                            <button className="btn-primary" disabled={loading}><Save size={17} /> {loading ? 'Salvando...' : 'Salvar loja'}</button>
                        </div>
                    </div>
                </form>

                <section style={{ marginTop: '1.5rem' }}>
                    <h2 style={{ marginBottom: '1rem' }}>Lojas cadastradas ({tenants.length})</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {tenants.map(tenant => (
                            <article key={tenant.id} style={{ ...panelStyle, opacity: tenant.active ? 1 : 0.65 }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ width: 58, height: 58, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
                                        {tenant.logoUrl ? <img src={tenant.logoUrl} alt={tenant.businessName} style={{ maxWidth: 48, maxHeight: 48 }} /> : <Store />}
                                    </div>
                                    <div style={{ flex: 1 }}><h3>{tenant.businessName}</h3><p style={mutedStyle}>{tenant.email}</p></div>
                                    <span style={{ color: tenant.active ? 'var(--color-success)' : 'var(--color-danger)', fontSize: '0.8rem' }}>{tenant.active ? 'ATIVA' : 'INATIVA'}</span>
                                </div>
                                <p style={{ ...mutedStyle, marginTop: '1rem', display: 'flex', gap: 7, alignItems: 'center' }}><Database size={16} /> {tenant.databaseName}</p>
                                <p style={mutedStyle}>{tenant.city || 'Cidade não informada'}{tenant.state ? ` - ${tenant.state}` : ''} · {tenant.whatsapp || 'WhatsApp não informado'}</p>
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                                    <a className="btn-outline" href={`${window.location.origin}${import.meta.env.BASE_URL}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir acesso</a>
                                    <button className="btn-outline" onClick={() => editTenant(tenant)}><Pencil size={16} /> Editar</button>
                                    <button className="btn-outline" onClick={() => toggleTenant(tenant)}>{tenant.active ? 'Desativar' : 'Ativar'}</button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

const Field = ({ label, children }) => <label><span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.84rem', marginBottom: '0.4rem' }}>{label}</span>{children}</label>;
const pageStyle = { minHeight: '100vh', background: 'var(--color-bg-dark)', display: 'grid', placeItems: 'center' };
const panelStyle = { background: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' };
const inputStyle = { width: '100%', padding: '0.8rem', color: 'white', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-md)', outline: 'none' };
const sectionTitle = { display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.5rem', fontSize: '1.05rem' };
const mutedStyle = { color: 'var(--color-text-muted)', margin: 0 };

export default SaasManager;
