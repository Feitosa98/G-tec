import { create } from 'zustand';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'gerente' | 'tecnico' | 'vendedor' | 'customer' | 'saas-admin';
    token: string;
    storeSlug?: string;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    loginAdmin: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
}

const readSession = (): User | null => {
    try {
        const session = JSON.parse(localStorage.getItem('gtec-session') || 'null');
        if (session && session.role !== 'customer' && !session.token) {
            localStorage.removeItem('gtec-session');
            return null;
        }
        return session;
    } catch {
        localStorage.removeItem('gtec-session');
        return null;
    }
};

const getStoreSlug = () => new URLSearchParams(window.location.search).get('loja')
    || localStorage.getItem('gtec-active-tenant')
    || 'gtec-informatica';

export const useAuthStore = create<AuthState>((set) => ({
    user: readSession(),
    loading: false,

    login: async (email, password) => {
        try {
            const response = await fetch(`/api/store/${getStoreSlug()}/customer/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || 'Credenciais inválidas.' };
            const sessionUser = { ...data.user, token: data.token };
            set({ user: sessionUser });
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            return { success: true };
        } catch {
            return { success: false, message: 'Não foi possível conectar ao servidor.' };
        }
    },

    loginAdmin: async (username, password) => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || 'Credenciais inválidas.' };
            const sessionUser = { ...data.user, token: data.token };
            set({ user: sessionUser });
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            localStorage.setItem('gtec-active-tenant', sessionUser.storeSlug);
            return { success: true };
        } catch {
            return { success: false, message: 'Não foi possível conectar ao servidor.' };
        }
    },

    register: async (name, email, password) => {
        try {
            const response = await fetch(`/api/store/${getStoreSlug()}/customer/register`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password })
            });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.message || 'Não foi possível cadastrar.' };
            const sessionUser = { ...data.user, token: data.token };
            set({ user: sessionUser });
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            return { success: true };
        } catch {
            return { success: false, message: 'Não foi possível conectar ao servidor.' };
        }
    },

    logout: () => {
        set({ user: null });
        localStorage.removeItem('gtec-session');
    }
}));
