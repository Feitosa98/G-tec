import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // { name, email, role: 'admin' | 'customer' }
    const [loading, setLoading] = useState(true);

    // Load session on mount
    useEffect(() => {
        const session = localStorage.getItem('gtec-session');
        if (session) {
            setUser(JSON.parse(session));
        }
        setLoading(false);
    }, []);

    // Login Logic
    const login = (email, password) => {
        // 1. Check Admin Hardcoded
        if (email === 'admin' && password === 'admin123') {
            const adminUser = { name: 'Administrador', email: 'admin', role: 'admin' };
            setUser(adminUser);
            localStorage.setItem('gtec-session', JSON.stringify(adminUser));
            return { success: true };
        }

        // 2. Check Customers in LocalStorage
        const users = JSON.parse(localStorage.getItem('gtec-users') || '[]');
        const foundUser = users.find(u => u.email === email && u.password === password);

        if (foundUser) {
            const sessionUser = { name: foundUser.name, email: foundUser.email, role: 'customer' };
            setUser(sessionUser);
            localStorage.setItem('gtec-session', JSON.stringify(sessionUser));
            return { success: true };
        }

        return { success: false, message: 'Credenciais inválidas.' };
    };

    // Register Logic
    const register = (name, email, password) => {
        const users = JSON.parse(localStorage.getItem('gtec-users') || '[]');

        if (users.find(u => u.email === email)) {
            return { success: false, message: 'E-mail já cadastrado.' };
        }

        const newUser = { name, email, password, role: 'customer' }; // In real app, hash password!
        users.push(newUser);
        localStorage.setItem('gtec-users', JSON.stringify(users));

        // Auto login
        const sessionUser = { name, email, role: 'customer' };
        setUser(sessionUser);
        localStorage.setItem('gtec-session', JSON.stringify(sessionUser));

        return { success: true };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('gtec-session');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
