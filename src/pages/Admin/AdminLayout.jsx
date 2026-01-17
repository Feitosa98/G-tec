import React from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Package, DollarSign, LogOut, Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminLayout = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Route Protection: Check if user exists and is Admin
    if (!user || user.role !== 'admin') {
        return <Navigate to="/admin/login" replace />;
    }

    const navItems = [
        { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/admin/orders', label: 'Pedidos', icon: Package }, // Updated Order item
        { path: '/admin/products', label: 'Produtos', icon: Monitor }, // Swapped icon for variety
        { path: '/admin/finance', label: 'Financeiro', icon: DollarSign },
    ];

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg-dark)' }}>
            {/* Sidebar */}
            <aside style={{
                width: '240px',
                background: 'var(--color-bg-card)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-accent)' }}>
                    <Monitor size={28} />
                    <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', fontWeight: 'bold' }}>GTEC</span>
                </div>

                <nav style={{ flex: 1, padding: '1rem' }}>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {navItems.map(item => (
                            <li key={item.path}>
                                <Link to={item.path} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: location.pathname === item.path ? 'var(--color-accent)' : 'transparent',
                                    color: location.pathname === item.path ? 'white' : 'var(--color-text-muted)',
                                    fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                                    transition: 'all 0.2s'
                                }}>
                                    <item.icon size={20} />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div style={{ padding: '1rem' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--color-danger)',
                            borderRadius: 'var(--radius-md)',
                            transition: 'background 0.2s'
                        }}
                    >
                        <LogOut size={20} />
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
