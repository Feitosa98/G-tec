import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Plus, Trash2, Edit, Users, History, X, FileText, CheckCircle, Package } from 'lucide-react';
import { format } from 'date-fns';
import { showToast } from '../../utils/toast';

const CustomerManager = () => {
    const { tenant } = useData();
    const [customers, setCustomers] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', document: '', address: ''
    });
    const [historyCustomer, setHistoryCustomer] = useState(null);
    const { sales } = useData();

    const getCustomerSales = (customerId, customerName, customerEmail) => {
        return (sales || []).filter(sale => 
            (sale.clientId && sale.clientId === customerId) || 
            (customerEmail && sale.userEmail && sale.userEmail.toLowerCase() === customerEmail.toLowerCase()) ||
            (customerName && sale.customerName && sale.customerName.toLowerCase() === customerName.toLowerCase()) ||
            (customerName && sale.userEmail && sale.userEmail.toLowerCase() === customerName.toLowerCase())
        ).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    };

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };

    useEffect(() => {
        if (tenant?.storeSlug) {
            fetchCustomers();
        }
    }, [tenant]);

    const fetchCustomers = async () => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/customers`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCustomers(data);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const saveCustomer = async (customerData) => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify(customerData)
            });
            if (res.ok) {
                fetchCustomers();
                return true;
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch (error) {
            console.error(error);
            showToast.error('Erro ao salvar cliente');
            return false;
        }
    };

    const removeCustomer = async (id) => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/customers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                fetchCustomers();
                showToast.success('Cliente excluído');
            }
        } catch (error) {
            console.error(error);
            showToast.error('Erro ao excluir');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.substring(0, 11);
        
        let formatted = value;
        if (value.length > 10) {
            formatted = `(${value.substring(0,2)}) ${value.substring(2,7)}-${value.substring(7)}`;
        } else if (value.length > 6) {
            formatted = `(${value.substring(0,2)}) ${value.substring(2,6)}-${value.substring(6)}`;
        } else if (value.length > 2) {
            formatted = `(${value.substring(0,2)}) ${value.substring(2)}`;
        } else if (value.length > 0) {
            formatted = `(${value}`;
        }
        setFormData({ ...formData, phone: formatted });
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name || '',
            email: customer.email || '',
            phone: customer.phone || '',
            document: customer.document || '',
            address: customer.address || ''
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const customerData = {
            id: editingCustomer ? editingCustomer.id : crypto.randomUUID(),
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            document: formData.document,
            address: formData.address,
            createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString()
        };

        const success = await saveCustomer(customerData);
        if (success) {
            showToast.success(`Cliente ${editingCustomer ? 'atualizado' : 'cadastrado'} com sucesso!`);
            setIsFormOpen(false);
            setEditingCustomer(null);
            setFormData({ name: '', email: '', phone: '', document: '', address: '' });
        }
    };

    return (
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto min-h-screen text-slate-100">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-inner">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
                            Gerenciar Clientes
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">Cadastre, edite e acompanhe o histórico de seus clientes</p>
                    </div>
                </div>
                <button 
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200 cursor-pointer active:scale-95" 
                    onClick={() => { setIsFormOpen(!isFormOpen); setEditingCustomer(null); setFormData({ name: '', email: '', phone: '', document: '', address: '' }); }}
                >
                    <Plus className="w-5 h-5" /> Novo Cliente
                </button>
            </div>

            {/* Form Section */}
            {isFormOpen && (
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl transition-all duration-300">
                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800/80">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            {editingCustomer ? 'Editar Cliente' : 'Adicionar Cliente'}
                        </h3>
                        <button 
                            type="button" 
                            onClick={() => setIsFormOpen(false)}
                            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nome Completo / Empresa</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition-all duration-200" 
                                name="name" 
                                placeholder="Ex: João da Silva" 
                                value={formData.name} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">E-mail</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition-all duration-200" 
                                name="email" 
                                type="email" 
                                placeholder="Ex: joao@email.com" 
                                value={formData.email} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Telefone / WhatsApp</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition-all duration-200" 
                                name="phone" 
                                placeholder="Ex: (11) 99999-9999" 
                                value={formData.phone} 
                                onChange={handlePhoneChange} 
                                maxLength={15} 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">CPF / CNPJ</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition-all duration-200" 
                                name="document" 
                                placeholder="Apenas números ou formatado" 
                                value={formData.document} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Endereço Completo</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/80 transition-all duration-200" 
                                name="address" 
                                placeholder="Rua, Número, Bairro, Cidade" 
                                value={formData.address} 
                                onChange={handleChange} 
                            />
                        </div>

                        <div className="md:col-span-2 pt-2">
                            <button 
                                type="submit" 
                                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all duration-200 cursor-pointer active:scale-[0.99]"
                            >
                                {editingCustomer ? 'Atualizar Cliente' : 'Salvar Cliente'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Customers Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <th className="px-6 py-4">Nome</th>
                                <th className="px-6 py-4">Contato</th>
                                <th className="px-6 py-4">Documento</th>
                                <th className="px-6 py-4">Endereço</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <Users className="w-10 h-10 text-slate-600" />
                                            <p className="text-base font-medium">Nenhum cliente cadastrado.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                customers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-slate-800/40 transition-colors duration-150">
                                        <td className="px-6 py-4 text-sm font-semibold text-white">{customer.name}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="text-slate-200 font-medium">{customer.email || '-'}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{customer.phone || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300 font-mono text-xs">{customer.document || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-300 max-w-xs truncate" title={customer.address || ''}>{customer.address || '-'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button 
                                                    onClick={() => setHistoryCustomer(customer)} 
                                                    className="p-2 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer" 
                                                    title="Ver Histórico/Faturas"
                                                >
                                                    <History className="w-4.5 h-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(customer)} 
                                                    className="p-2 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer" 
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4.5 h-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => removeCustomer(customer.id)} 
                                                    className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer" 
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4.5 h-4.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Customer History Modal */}
            {historyCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300" onClick={() => setHistoryCustomer(null)}>
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start pb-4 border-b border-slate-800/80">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                        <History className="w-5 h-5" />
                                    </div>
                                    Histórico do Cliente
                                </h2>
                                <p className="text-xs text-slate-400 mt-1 pl-11">{historyCustomer.name}</p>
                            </div>
                            <button 
                                onClick={() => setHistoryCustomer(null)} 
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="border border-slate-800/80 rounded-xl overflow-hidden max-h-96 overflow-y-auto bg-slate-950/40">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3.5">Data</th>
                                        <th className="px-4 py-3.5">Pedido / Descrição</th>
                                        <th className="px-4 py-3.5">Total</th>
                                        <th className="px-4 py-3.5 text-right">Status Pagamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {getCustomerSales(historyCustomer.id, historyCustomer.name, historyCustomer.email).length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Package className="w-9 h-9 text-slate-600 opacity-60" />
                                                    <span className="text-sm font-medium">Nenhum pedido ou fatura encontrada.</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        getCustomerSales(historyCustomer.id, historyCustomer.name, historyCustomer.email).map(sale => (
                                            <tr key={sale.id || Math.random()} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3.5 text-sm text-slate-300">{sale.date ? format(new Date(sale.date), 'dd/MM/yyyy') : '-'}</td>
                                                <td className="px-4 py-3.5 text-sm">
                                                    <div className="font-mono font-semibold text-indigo-300">#{String(sale.id || '').slice(0, 8).toUpperCase()}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        {sale.items && sale.items.length > 0 ? sale.items[0].name : 'Venda'} {sale.items?.length > 1 ? `(+${sale.items.length - 1})` : ''}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-sm font-bold text-emerald-400">R$ {Number(sale.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3.5 text-sm text-right">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                                        sale.paymentStatus === 'Pendente' 
                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    }`}>
                                                        {sale.paymentStatus === 'Pendente' ? <FileText className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                        {sale.paymentStatus || 'Pago'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerManager;
