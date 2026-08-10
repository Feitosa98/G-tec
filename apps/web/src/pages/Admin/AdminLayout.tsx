import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, DollarSign, LogOut, Monitor, CalendarClock, Palette, Wrench, ClipboardList, Users, Repeat, MessageSquare, ArchiveX, Building2, CalendarDays, FileBarChart2, Shield, ScrollText, HardDrive, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useData } from '../../hooks/useData';

const AdminLayout = () => {
    const { user, logout } = useAuthStore();
    const { tenant } = useData();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        setIsMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!isMenuOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsMenuOpen(false);
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isMenuOpen]);

    const staffRoles = ['admin', 'gerente', 'tecnico', 'vendedor'];
    if (!user || !staffRoles.includes(user.role)) {
        return <Navigate to="/admin/login" replace />;
    }

    const navItems = [
        { path: '/admin', label: 'Painel', icon: LayoutDashboard, roles: ['admin', 'gerente'] },
        { path: '/admin/clientes', label: 'Clientes', icon: Users, roles: staffRoles },
        { path: '/admin/ordens-servico', label: 'Ordens de Serviço', icon: ClipboardList, roles: ['admin', 'gerente', 'tecnico'] },
        { path: '/admin/pedidos', label: 'Pedidos Loja', icon: Package, roles: ['admin', 'gerente', 'vendedor'] },
        { path: '/admin/cobrancas', label: 'Cobranças', icon: CalendarClock, roles: ['admin', 'gerente'] },
        { path: '/admin/assinaturas', label: 'Contratos / Planos', icon: Repeat, roles: ['admin'] },
        { path: '/admin/produtos', label: 'Produtos', icon: Monitor, roles: ['admin', 'gerente', 'vendedor'] },
        { path: '/admin/estoque', label: 'Estoque', icon: ArchiveX, roles: ['admin', 'gerente', 'vendedor'] },
        { path: '/admin/servicos', label: 'Serviços', icon: Wrench, roles: ['admin', 'gerente', 'tecnico'] },
        { path: '/admin/financeiro', label: 'Financeiro', icon: DollarSign, roles: ['admin'] },
        { path: '/admin/fornecedores', label: 'Fornecedores', icon: Building2, roles: ['admin', 'gerente'] },
        { path: '/admin/agenda', label: 'Agenda', icon: CalendarDays, roles: ['admin', 'gerente', 'tecnico'] },
        { path: '/admin/relatorios', label: 'Relatórios', icon: FileBarChart2, roles: ['admin', 'gerente'] },
        { path: '/admin/permissoes', label: 'Permissões', icon: Shield, roles: ['admin'] },
        { path: '/admin/auditoria', label: 'Auditoria', icon: ScrollText, roles: ['admin'] },
        { path: '/admin/backup', label: 'Backup', icon: HardDrive, roles: ['admin'] },
        { path: '/admin/integracoes', label: 'Integrações', icon: MessageSquare, roles: ['admin'] },
        { path: '/admin/personalizar', label: 'Personalizar', icon: Palette, roles: ['admin'] },
    ].filter(item => item.roles.includes(user.role));

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-blue-500/30">
            {isMenuOpen && (
                <button
                    type="button"
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(82vw,300px)] shrink-0 flex-col border-r border-slate-800/60 bg-slate-900/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-[280px] lg:translate-x-0 lg:bg-slate-900/50 lg:shadow-none ${
                isMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Logo Area */}
                <div className="p-6 flex items-center gap-3 border-b border-slate-800/60 bg-gradient-to-b from-slate-900/80 to-transparent">
                    {tenant?.logoUrl ? (
                        <img 
                            src={tenant.logoUrl} 
                            alt={tenant.businessName} 
                            className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]" 
                        />
                    ) : (
                        <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <Monitor size={24} className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        </div>
                    )}
                    <span className="text-xl font-bold font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 truncate">
                        {tenant?.shortName || 'G-TEC'}
                    </span>
                    <button
                        type="button"
                        aria-label="Fechar menu"
                        onClick={() => setIsMenuOpen(false)}
                        className="ml-auto grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
                    >
                        <X size={22} />
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <ul className="space-y-1">
                        {navItems.map(item => {
                            const isActive = location.pathname === item.path;
                            return (
                                <li key={item.path}>
                                    <Link 
                                        to={item.path} 
                                        onClick={() => setIsMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group relative ${
                                            isActive 
                                                ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                        }`}
                                    >
                                        {/* Active glow line */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-r-full blur-[2px]"></div>
                                        )}
                                        
                                        <item.icon 
                                            size={20} 
                                            strokeWidth={isActive ? 2.5 : 2} 
                                            className={`transition-colors ${isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-blue-400'}`}
                                        />
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-800/60 bg-slate-900/30">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 p-3 text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl font-semibold transition-all hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-300 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <LogOut size={20} />
                        <span>Sair do Sistema</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="relative h-[100dvh] min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 lg:h-screen">
                {/* Subtle top glare */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-slate-800/70 bg-slate-950/90 px-3 py-2 backdrop-blur-xl lg:hidden">
                    <button
                        type="button"
                        aria-label="Abrir menu"
                        aria-expanded={isMenuOpen}
                        onClick={() => setIsMenuOpen(true)}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-700/70 bg-slate-900 text-slate-200 shadow-lg active:scale-95"
                    >
                        <Menu size={23} />
                    </button>

                    {tenant?.logoUrl && (
                        <img src={tenant.logoUrl} alt="" className="h-9 w-9 shrink-0 object-contain" />
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                            {tenant?.shortName || tenant?.businessName || 'G-TEC'}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                            {navItems.find(item => item.path === location.pathname)?.label || 'Painel administrativo'}
                        </p>
                    </div>
                </header>
                
                <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
