import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Shield, User, Clock, Trash2, Plus, Edit, Search, X, Save, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = [
    { id: 'admin', label: 'Administrador', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', desc: 'Acesso total ao sistema' },
    { id: 'gerente', label: 'Gerente', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', desc: 'Sem acesso a dados financeiros sensíveis' },
    { id: 'tecnico', label: 'Técnico', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', desc: 'Apenas Ordens de Serviço e Agenda' },
    { id: 'vendedor', label: 'Vendedor', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', desc: 'Apenas PDV, Produtos e Clientes' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
    admin:    ['dashboard', 'clientes', 'ordens-servico', 'pedidos', 'cobrancas', 'assinaturas', 'produtos', 'estoque', 'servicos', 'financeiro', 'fornecedores', 'agenda', 'relatorios', 'integracoes', 'personalizar', 'permissoes', 'auditoria', 'backup'],
    gerente:  ['dashboard', 'clientes', 'ordens-servico', 'pedidos', 'cobrancas', 'produtos', 'estoque', 'servicos', 'fornecedores', 'agenda', 'relatorios'],
    tecnico:  ['ordens-servico', 'agenda', 'clientes'],
    vendedor: ['pedidos', 'produtos', 'estoque', 'clientes'],
};

export default function PermissionsManager() {
    const { tenant } = useData();
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'vendedor' });
    const [editing, setEditing] = useState<any>(null);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };
    const headers = { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

    const fetchUsers = async () => {
        if (!tenant?.storeSlug) return;
        const res = await fetch(`/api/store/${tenant.storeSlug}/users`, { headers });
        if (res.ok) setUsers(await res.json());
    };

    useEffect(() => { fetchUsers(); }, [tenant]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.email) { toast.error('Nome e e-mail são obrigatórios'); return; }
        const payload = { ...form, id: editing?.id || crypto.randomUUID(), updatedAt: new Date().toISOString() };
        if (!editing && form.password.length < 8) { toast.error('A senha deve ter pelo menos 8 caracteres'); return; }
        const response = await fetch(`/api/store/${tenant.storeSlug}/users`, { method: 'POST', headers, body: JSON.stringify(payload) });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            toast.error(data.message || 'Não foi possível salvar o usuário');
            return;
        }
        toast.success(editing ? 'Usuário atualizado!' : 'Usuário criado!');
        setIsFormOpen(false); setEditing(null); setForm({ name: '', email: '', password: '', role: 'vendedor' });
        fetchUsers();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este usuário?')) return;
        const response = await fetch(`/api/store/${tenant.storeSlug}/users/${id}`, { method: 'DELETE', headers });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            toast.error(data.message || 'Não foi possível remover o usuário');
            return;
        }
        toast.success('Usuário removido'); fetchUsers();
    };

    const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 fade-in">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Controle de Acesso</h1>
                    <p className="text-slate-400 mt-1">Gerencie usuários e permissões por cargo</p>
                </div>
                <button
                    onClick={() => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'vendedor' }); setIsFormOpen(true); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus className="w-4 h-4" /> Novo Usuário
                </button>
            </header>

            {/* Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROLES.map(role => (
                    <div key={role.id} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-slate-400" />
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${role.color}`}>{role.label}</span>
                        </div>
                        <p className="text-slate-400 text-sm">{role.desc}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                            {ROLE_PERMISSIONS[role.id].slice(0, 4).map(p => (
                                <span key={p} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">{p}</span>
                            ))}
                            {ROLE_PERMISSIONS[role.id].length > 4 && (
                                <span className="text-xs text-slate-500">+{ROLE_PERMISSIONS[role.id].length - 4}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-200">Usuários do Sistema</h2>
                    <div className="relative max-w-xs">
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário..."
                            className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2 pr-10 text-sm text-slate-100 outline-none transition-all" />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>

                {filteredUsers.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <User className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Nenhum usuário cadastrado.<br />Crie usuários adicionais para sua equipe.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-950/40 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-3 text-left">Usuário</th>
                                <th className="px-6 py-3 text-left">E-mail</th>
                                <th className="px-6 py-3 text-center">Cargo</th>
                                <th className="px-6 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredUsers.map(u => {
                                const role = ROLES.find(r => r.id === u.role) || ROLES[0];
                                return (
                                    <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {(u.name || 'U')[0].toUpperCase()}
                                                </div>
                                                <span className="text-slate-200 font-medium">{u.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">{u.email}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${role.color}`}>{role.label}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => { setEditing(u); setForm({ name: u.name || '', email: u.email || '', password: '', role: u.role || 'vendedor' }); setIsFormOpen(true); }}
                                                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(u.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {[
                                { label: 'Nome completo *', key: 'name', type: 'text', placeholder: 'Ex: João Silva' },
                                { label: 'E-mail *', key: 'email', type: 'email', placeholder: 'joao@empresa.com' },
                                { label: editing ? 'Nova senha (deixe em branco para manter)' : 'Senha *', key: 'password', type: 'password', placeholder: '••••••••' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="text-sm text-slate-400 mb-1.5 block">{f.label}</label>
                                    <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                                        className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                                </div>
                            ))}
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Cargo / Permissão</label>
                                <div className="relative">
                                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                                        className="w-full appearance-none bg-slate-950/60 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all pr-10">
                                        {ROLES.map(r => <option key={r.id} value={r.id}>{r.label} — {r.desc}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                </div>
                            </div>
                            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> {editing ? 'Salvar Alterações' : 'Criar Usuário'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
