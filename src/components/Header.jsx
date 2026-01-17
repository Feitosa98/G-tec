import React, { useState } from 'react';
import { ShoppingCart, Search, Menu, User, LogOut, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Link, useNavigate } from 'react-router-dom';

const Header = ({ cartCount, toggleCart, searchTerm = '', setSearchTerm = () => { } }) => {
    const { user, logout } = useAuth();
    const { getCartItemCount } = useData();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const actualCartCount = getCartItemCount();

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const closeMenu = () => setIsMenuOpen(false);

    // Navigation Links Data
    const navLinks = [
        { name: 'Início', path: '/' },
        { name: 'Produtos', path: '/#products' }, // In a real app, could be separate page
    ];

    if (user?.role === 'admin') {
        navLinks.push({ name: 'Admin', path: '/admin' });
    }

    return (
        <header className="header" style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(10, 14, 26, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(212, 160, 36, 0.1)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
            height: 'var(--header-height)',
        }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>

                {/* 1. Left: Hamburger (Mobile) + Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                    {/* Hamburger Button (Mobile Only) */}
                    <button
                        className="mobile-only"
                        onClick={toggleMenu}
                        style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <Menu size={24} />
                    </button>

                    <Link to="/" className="logo" onClick={closeMenu}>
                        <img src="/logo.png" alt="GTEC Informática" style={{ height: '50px', objectFit: 'contain' }} />
                    </Link>

                    {/* Desktop Nav Links */}
                    <nav className="desktop-only" style={{ marginLeft: '2rem', display: 'flex', gap: '2rem' }}>
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                style={{
                                    color: 'var(--color-text-muted)',
                                    fontWeight: '500',
                                    transition: 'color 0.2s',
                                    fontSize: '0.95rem'
                                }}
                                onMouseEnter={(e) => e.target.style.color = 'var(--color-accent)'}
                                onMouseLeave={(e) => e.target.style.color = 'var(--color-text-muted)'}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* 2. Right: Search + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

                    {/* Desktop Search */}
                    <div className="search-bar desktop-only" style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Buscar produtos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                padding: '0.65rem 1rem 0.65rem 2.5rem',
                                borderRadius: '24px',
                                color: 'white',
                                width: '280px',
                                outline: 'none',
                                fontSize: '0.9rem',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onFocus={(e) => {
                                e.target.style.background = 'rgba(255,255,255,0.12)';
                                e.target.style.borderColor = 'var(--color-accent)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(212, 160, 36, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.background = 'rgba(255,255,255,0.08)';
                                e.target.style.borderColor = 'rgba(255,255,255,0.12)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    </div>

                    <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }} className="desktop-only"></div>

                    {/* User & Cart */}
                    <div style={{ display: 'flex', items: 'center', gap: '1.2rem' }}>
                        {user ? (
                            <button
                                onClick={() => navigate(user.role === 'admin' ? '/admin' : '/account')}
                                title="Minha Conta"
                                className="icon-btn desktop-only"
                            >
                                <User size={22} />
                            </button>
                        ) : (
                            <Link to="/login" className="icon-btn desktop-only" title="Entrar">
                                <User size={22} />
                            </Link>
                        )}

                        <button onClick={toggleCart} className="icon-btn" style={{ position: 'relative' }}>
                            <ShoppingCart size={24} />
                            {cartCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-5px', right: '-5px',
                                    background: 'var(--color-accent)', color: 'white',
                                    fontSize: '0.7rem', fontWeight: 'bold',
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- Mobile Drawer Overlay --- */}
            <div
                className={`mobile-drawer-overlay ${isMenuOpen ? 'open' : ''}`}
                onClick={closeMenu}
            ></div>

            {/* --- Mobile Drawer Content --- */}
            <div className={`mobile-drawer ${isMenuOpen ? 'open' : ''}`}>
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>Menu</span>
                    <button onClick={closeMenu} style={{ background: 'none', color: 'var(--color-text-muted)' }}><XCircle size={24} /></button>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Mobile Search */}
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="O que você procura?"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '0.8rem 1rem 0.8rem 2.5rem',
                                borderRadius: '8px',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    </div>

                    {/* Mobile Links */}
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                onClick={closeMenu}
                                style={{ fontSize: '1.1rem', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>

                    {/* Mobile User Actions */}
                    <div style={{ marginTop: '1rem' }}>
                        {user ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '40px', height: '40px', background: 'var(--color-accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                        {user.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 'bold' }}>{user.name}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{user.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { navigate(user.role === 'admin' ? '/admin' : '/account'); closeMenu(); }}
                                    className="btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    Minha Conta
                                </button>
                                <button
                                    onClick={() => { logout(); closeMenu(); }}
                                    style={{ color: 'var(--color-danger)', background: 'none', border: 'none', textAlign: 'left', padding: '0.5rem 0' }}
                                >
                                    Sair da Conta
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                onClick={closeMenu}
                                className="btn-primary"
                                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <User size={18} /> Entrar / Cadastrar
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
