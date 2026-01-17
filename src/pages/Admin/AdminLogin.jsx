import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const AdminLogin = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        // Admin check is done inside login function based on credentials
        const result = login(email, password);

        if (result.success) {
            if (email === 'admin') { // Extra check for UX flow
                navigate('/admin');
            } else {
                setError('Acesso não autorizado. Use credenciais de administrador.');
            }
        } else {
            setError(result.message);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-dark)',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #151b2e 0%, #0a0f1c 100%)'
        }}>
            <div style={{
                background: 'var(--color-bg-card)',
                padding: '3rem',
                borderRadius: 'var(--radius-lg)',
                width: '100%',
                maxWidth: '400px',
                border: '1px solid var(--color-accent)',
                boxShadow: '0 0 50px rgba(196, 127, 23, 0.15)',
                textAlign: 'center'
            }}>
                <ShieldAlert size={48} color="var(--color-accent)" style={{ marginBottom: '1.5rem' }} />

                <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>GTEC ADMIN</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>Acesso Restrito</p>

                {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', padding: '10px', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        placeholder="Usuário"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={inputStyle}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Senha"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={inputStyle}
                        required
                    />

                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
                        Acessar Painel
                    </button>
                </form>

                <button
                    onClick={() => navigate('/')}
                    style={{ marginTop: '1.5rem', background: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline', fontSize: '0.9rem' }}
                >
                    Voltar para a Loja
                </button>
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
    fontSize: '1rem',
    textAlign: 'center'
};

export default AdminLogin;
