import React, { useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const [isRegister, setIsRegister] = useState(false);

    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        let result;
        if (isRegister) {
            result = register(formData.name, formData.email, formData.password);
        } else {
            result = login(formData.email, formData.password);
        }

        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header cartCount={0} toggleCart={() => { }} /> {/* Dummy props for detached login page */}

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{
                    background: 'var(--color-bg-card)',
                    padding: '2.5rem',
                    borderRadius: 'var(--radius-lg)',
                    width: '100%',
                    maxWidth: '400px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', textAlign: 'center' }}>
                        {isRegister ? 'Criar Conta' : 'Acessar Conta'}
                    </h2>

                    {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {isRegister && (
                            <input
                                placeholder="Seu Nome"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={inputStyle}
                                required
                            />
                        )}
                        <input
                            type="email"
                            placeholder="E-mail"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={inputStyle}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Senha"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            style={inputStyle}
                            required
                        />

                        <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
                            {isRegister ? 'Cadastrar' : 'Entrar'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        {isRegister ? 'Já tem uma conta?' : 'Novo na GTEC?'}
                        <button
                            onClick={() => { setIsRegister(!isRegister); setError(''); }}
                            style={{ background: 'none', color: 'var(--color-accent)', fontWeight: 'bold', marginLeft: '5px', textDecoration: 'underline' }}
                        >
                            {isRegister ? 'Fazer Login' : 'Cadastre-se'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    outline: 'none',
    fontSize: '1rem'
};

export default LoginPage;
