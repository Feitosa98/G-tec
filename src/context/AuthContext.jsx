import { useState } from 'react';
import { AuthContext } from './auth-context';

const readSession = () => {
    try {
        const session = JSON.parse(localStorage.getItem('gtec-session'));
        if (session?.role === 'admin' && !session.token) {
            localStorage.removeItem('gtec-session');
            return null;
        }
        return session;
    } catch {
        localStorage.removeItem('gtec-session');
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(readSession); // { name, email, role: 'admin' | 'customer' }

    const getStoreSlug = () => new URLSearchParams(window.location.search).get('loja')
        || localStorage.getItem('gtec-active-tenant')
        || 'gtec-informatica';

    const login = async (email, password) => {
        try {
            const response = await fetch(`/api/store/${getStoreSlug()}/customer/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || 'Credenciais inválidas.' };
            const sessionUser = { ...data.user, token: data.token };
            setUser(sessionUser);
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            return { success: true };
        } catch {
            return { success: false, message: 'Não foi possível conectar ao servidor.' };
        }
    };

    const loginAdmin = async (username, password) => {
        const storeSlug = getStoreSlug();
        try {
            const response = await fetch(`/api/store/${storeSlug}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || 'Credenciais inválidas.' };
            const sessionUser = { ...data.user, token: data.token };
            setUser(sessionUser);
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            localStorage.setItem('gtec-active-tenant', storeSlug);
            return { success: true };
        } catch {
            return { success: false, message: 'Não foi possível conectar ao servidor.' };
        }
    };

    const register = async (name, email, password) => {
        try {
            const response = await fetch(`/api/store/${getStoreSlug()}/customer/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || 'Não foi possível cadastrar.' };
            const sessionUser = { ...data.user, token: data.token };
            setUser(sessionUser);
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            return { success: true };
        } catch {
            return { success: false, message: 'Não foi possível conectar ao servidor.' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('gtec-session');
    };

    return (
        <AuthContext.Provider value={{ user, login, loginAdmin, register, logout, loading: false }}>
            {children}
        </AuthContext.Provider>
    );
};
