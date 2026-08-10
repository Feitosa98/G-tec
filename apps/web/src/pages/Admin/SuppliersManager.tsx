import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Building2, Phone, Mail, Plus, Edit, Trash2, Save, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_SUPPLIER = {
    name: '', cnpj: '', contact: '', phone: '', email: '', address: '', category: '', notes: ''
};

export default function SuppliersManager() {
    const { tenant } = useData();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState(EMPTY_SUPPLIER);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };
    const headers = { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

    const fetchSuppliers = async () => {
        if (!tenant?.storeSlug) return;
        const res = await fetch(`/api/store/${tenant.storeSlug}/suppliers`, { headers });
        if (res.ok) setSuppliers(await res.json());
    };

    useEffect(() => { fetchSuppliers(); }, [tenant]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Nome do fornecedor é obrigatório'); return; }
        const payload = { ...form, id: editing?.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
        await fetch(`/api/store/${tenant.storeSlug}/suppliers`, {
            method: 'POST', headers, body: JSON.stringify(payload)
        });
        toast.success(editing ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
        setIsFormOpen(false);
        setEditing(null);
        setForm(EMPTY_SUPPLIER);
        fetchSuppliers();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este fornecedor?')) return;
        await fetch(`/api/store/${tenant.storeSlug}/suppliers/${id}`, { method: 'DELETE', headers });
        toast.success('Fornecedor excluído');
        fetchSuppliers();
    };

    const openEdit = (s: any) => {
        setEditing(s);
        setForm({ name: s.name || '', cnpj: s.cnpj || '', contact: s.contact || '', phone: s.phone || '', email: s.email || '', address: s.address || '', category: s.category || '', notes: s.notes || '' });
        setIsFormOpen(true);
    };

    const filtered = suppliers.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.category?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 fade-in">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Fornecedores</h1>
                    <p className="text-slate-400 mt-1">Gerencie seus parceiros e fornecedores</p>
                </div>
                <button
                    onClick={() => { setEditing(null); setForm(EMPTY_SUPPLIER); setIsFormOpen(true); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus className="w-4 h-4" /> Novo Fornecedor
                </button>
            </header>

            {/* Search */}
            <div className="relative max-w-sm">
                <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar fornecedor..."
                    className="w-full bg-slate-900/80 border border-slate-700/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 pr-10 text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>Nenhum fornecedor cadastrado ainda.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(s => (
                        <div key={s.id} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-white">{s.name}</h3>
                                    {s.category && <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5 mt-1 inline-block">{s.category}</span>}
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(s.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5 text-sm text-slate-400">
                                {s.contact && <p>👤 {s.contact}</p>}
                                {s.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{s.phone}</div>}
                                {s.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{s.email}</div>}
                                {s.cnpj && <p className="font-mono text-xs">{s.cnpj}</p>}
                                {s.notes && <p className="text-slate-500 italic text-xs mt-2">{s.notes}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white">{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {[
                                { label: 'Nome *', key: 'name', placeholder: 'Nome do fornecedor' },
                                { label: 'CNPJ', key: 'cnpj', placeholder: '00.000.000/0001-00' },
                                { label: 'Contato / Responsável', key: 'contact', placeholder: 'Nome do responsável' },
                                { label: 'Telefone / WhatsApp', key: 'phone', placeholder: '(92) 99999-9999' },
                                { label: 'E-mail', key: 'email', placeholder: 'fornecedor@exemplo.com' },
                                { label: 'Categoria', key: 'category', placeholder: 'Ex: Peças, Equipamentos, Insumos' },
                                { label: 'Endereço', key: 'address', placeholder: 'Rua, nº, Bairro, Cidade' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="text-sm text-slate-400 mb-1.5 block">{f.label}</label>
                                    <input
                                        type="text" value={(form as any)[f.key]} placeholder={f.placeholder}
                                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                        className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all"
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Observações</label>
                                <textarea
                                    value={form.notes} rows={3} placeholder="Informações adicionais..."
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all resize-none"
                                />
                            </div>
                            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> {editing ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
