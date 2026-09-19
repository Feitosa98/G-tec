import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Monitor, PlusCircle, Users, Wrench } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import CustomerManager from './CustomerManager';
import ProductManager from './ProductManager';
import CreateProduct from './CreateProduct';
import ServicesManager from './ServicesManager';
import SuppliersManager from './SuppliersManager';

const registrationTabs = [
    { id: 'clientes', label: 'Clientes', icon: Users, roles: ['admin', 'gerente', 'tecnico', 'vendedor'], component: CustomerManager },
    { id: 'produtos', label: 'Produtos', icon: Monitor, roles: ['admin', 'gerente', 'vendedor'], component: ProductManager },
    { id: 'novo-produto', label: 'Novo produto', icon: PlusCircle, roles: ['admin', 'gerente', 'vendedor'], component: CreateProduct },
    { id: 'servicos', label: 'Serviços', icon: Wrench, roles: ['admin', 'gerente', 'tecnico'], component: ServicesManager },
    { id: 'fornecedores', label: 'Fornecedores', icon: Building2, roles: ['admin', 'gerente'], component: SuppliersManager },
];

const RegistrationsManager = () => {
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const availableTabs = useMemo(
        () => registrationTabs.filter(tab => tab.roles.includes(user?.role || '')),
        [user?.role]
    );
    const requestedTab = searchParams.get('tipo');
    const activeTab = availableTabs.find(tab => tab.id === requestedTab) || availableTabs[0];

    useEffect(() => {
        if (activeTab && requestedTab !== activeTab.id) {
            setSearchParams({ tipo: activeTab.id }, { replace: true });
        }
    }, [activeTab, requestedTab, setSearchParams]);

    if (!activeTab) return null;

    const ActiveManager = activeTab.component;

    return (
        <div className="min-h-screen animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2 shadow-xl backdrop-blur-xl">
                    <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Tipos de cadastro">
                        {availableTabs.map(tab => {
                            const Icon = tab.icon;
                            const isActive = tab.id === activeTab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setSearchParams({ tipo: tab.id })}
                                    className={`inline-flex min-w-max items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    <Icon size={17} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ActiveManager />
        </div>
    );
};

export default RegistrationsManager;
