import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Plus, Trash2, Edit, Wrench } from 'lucide-react';
import { showToast } from '../../utils/toast';

const ServicesManager = () => {
    // We will use a dedicated state for services, fetching from our generic data context if available
    // For now, let's assume we need to manage it. Since useData might not have services yet,
    // we'll implement a local state backed by the same API pattern.
    const { tenant } = useData();
    const [services, setServices] = useState([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [formData, setFormData] = useState<any>({
        name: '', description: '', price: '', formattedPrice: '', estimatedTime: '', isPlan: false
    });

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };

    useEffect(() => {
        if (tenant?.storeSlug) {
            fetchServices();
        }
    }, [tenant]);

    const fetchServices = async () => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/services`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setServices(data);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const saveService = async (serviceData) => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify(serviceData)
            });
            if (res.ok) {
                fetchServices();
                return true;
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch (error) {
            console.error(error);
            showToast.error('Erro ao salvar serviço');
            return false;
        }
    };

    const removeService = async (id) => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/services/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                fetchServices();
                showToast.success('Serviço excluído');
            }
        } catch (error) {
            console.error(error);
            showToast.error('Erro ao excluir');
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleCurrencyChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value === '') value = '0';
        const floatValue = parseInt(value, 10) / 100;
        const formatted = floatValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        setFormData({ ...formData, price: floatValue, formattedPrice: formatted });
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setFormData({
            name: service.name,
            description: service.description || '',
            price: service.price,
            formattedPrice: Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            estimatedTime: service.estimatedTime || '',
            isPlan: service.isPlan || false
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const serviceData = {
            id: editingService ? editingService.id : crypto.randomUUID(),
            name: formData.name,
            description: formData.description,
            price: Number(formData.price),
            estimatedTime: formData.estimatedTime,
            isPlan: formData.isPlan
        };

        const success = await saveService(serviceData);
        if (success) {
            showToast.success(`Serviço ${editingService ? 'atualizado' : 'cadastrado'} com sucesso!`);
            setIsFormOpen(false);
            setEditingService(null);
            setFormData({ name: '', description: '', price: '', formattedPrice: '', estimatedTime: '', isPlan: false });
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 text-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    <Wrench className="w-8 h-8 text-indigo-400" /> Gerenciar Serviços
                </h1>
                <button 
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200 cursor-pointer active:scale-95" 
                    onClick={() => { setIsFormOpen(!isFormOpen); setEditingService(null); setFormData({ name: '', description: '', price: '', formattedPrice: '', estimatedTime: '', isPlan: false }); }}
                >
                    <Plus className="w-5 h-5" /> Novo Serviço
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
                    <h3 className="text-xl font-semibold text-slate-200 border-b border-slate-800/80 pb-4 flex items-center gap-2">
                        <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                        {editingService ? 'Editar Serviço' : 'Adicionar Serviço'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Nome do Serviço</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200" 
                                name="name" 
                                placeholder="Ex: Formatação" 
                                value={formData.name} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Valor (R$)</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200" 
                                name="formattedPrice" 
                                type="text" 
                                placeholder="Ex: 150,00" 
                                value={formData.formattedPrice} 
                                onChange={handleCurrencyChange} 
                                required 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Tempo Estimado</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200" 
                                name="estimatedTime" 
                                placeholder="Ex: 2 horas" 
                                value={formData.estimatedTime} 
                                onChange={handleChange} 
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Descrição Curta</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200" 
                                name="description" 
                                placeholder="Detalhes adicionais" 
                                value={formData.description} 
                                onChange={handleChange} 
                            />
                        </div>
                        
                        <label className="md:col-span-2 flex items-center gap-3 p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors group">
                            <input 
                                type="checkbox" 
                                name="isPlan" 
                                checked={formData.isPlan} 
                                onChange={handleChange} 
                                className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/40 focus:ring-offset-slate-900 accent-indigo-500 cursor-pointer" 
                            />
                            <span className="text-sm font-medium">Este serviço é um Plano / Assinatura Recorrente (Aparecerá na aba Contratos)</span>
                        </label>

                        <button 
                            type="submit" 
                            className="md:col-span-2 w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 cursor-pointer active:scale-[0.99]"
                        >
                            {editingService ? 'Atualizar Serviço' : 'Salvar Serviço'}
                        </button>
                    </form>
                </div>
            )}

            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead>
                            <tr className="border-b border-slate-800/80 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                                <th className="px-6 py-4">Serviço</th>
                                <th className="px-6 py-4">Descrição</th>
                                <th className="px-6 py-4">Tempo Est.</th>
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {services.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                                        Nenhum serviço cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                services.map(service => (
                                    <tr key={service.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-200">
                                            <div className="font-semibold text-slate-100">{service.name}</div>
                                            {service.isPlan && (
                                                <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                    Plano Recorrente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{service.description || '-'}</td>
                                        <td className="px-6 py-4 text-slate-300">{service.estimatedTime || '-'}</td>
                                        <td className="px-6 py-4 font-semibold text-emerald-400">R$ {service.price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleEdit(service)} 
                                                    className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer" 
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => removeService(service.id)} 
                                                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer" 
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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
        </div>
    );
};

export default ServicesManager;
