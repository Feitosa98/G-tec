import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn, Lock, Mail } from 'lucide-react';

interface LoginBrand {
    businessName: string;
    shortName: string;
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
}

const defaultBrand: LoginBrand = {
    businessName: 'Feitosa Soluções em Informática',
    shortName: 'Feitosa Soluções',
    logoUrl: '',
    primaryColor: '#2563eb',
    accentColor: '#f59e0b'
};

const AdminLogin = () => {
    const { loginAdmin } = useAuthStore();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [brand, setBrand] = useState<LoginBrand>(defaultBrand);

    useEffect(() => {
        const controller = new AbortController();

        fetch('/api/tenants/resolve?slug=feitosa', { signal: controller.signal })
            .then(response => response.ok ? response.json() : Promise.reject())
            .then(tenant => setBrand({
                businessName: tenant.businessName || defaultBrand.businessName,
                shortName: tenant.shortName || tenant.businessName || defaultBrand.shortName,
                logoUrl: tenant.logoUrl || '',
                primaryColor: tenant.primaryColor || defaultBrand.primaryColor,
                accentColor: tenant.accentColor || defaultBrand.accentColor
            }))
            .catch(() => {});

        return () => controller.abort();
    }, []);

    useEffect(() => {
        document.title = `${brand.shortName} | Acesso administrativo`;
    }, [brand.shortName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Admin check is done inside login function based on credentials
            const result = await loginAdmin(email, password);

            if (result.success) {
                navigate('/admin');
            } else {
                setError(result.message || 'Credenciais inválidas.');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao conectar ao servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
            {/* Animated Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ backgroundColor: `${brand.primaryColor}30` }}></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ backgroundColor: `${brand.accentColor}20`, animationDelay: '2s' }}></div>

            <div className="relative z-10 w-full max-w-md p-8 md:p-10 mx-4 bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                
                <div className="flex justify-center mb-6">
                    <div
                        className="w-[74px] h-[74px] p-3 rounded-2xl border flex items-center justify-center"
                        style={{ backgroundColor: `${brand.accentColor}12`, borderColor: `${brand.accentColor}40`, boxShadow: `0 0 24px ${brand.accentColor}25` }}
                    >
                        {brand.logoUrl ? (
                            <img src={brand.logoUrl} alt={brand.shortName} className="w-full h-full object-contain" />
                        ) : (
                            <ShieldAlert size={40} style={{ color: brand.accentColor }} />
                        )}
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h2
                        className="text-3xl font-bold tracking-tight font-display text-transparent bg-clip-text"
                        style={{ backgroundImage: `linear-gradient(90deg, #f8fafc, ${brand.primaryColor}, ${brand.accentColor})` }}
                    >
                        {brand.shortName}
                    </h2>
                    <p className="text-slate-400 mt-2 font-medium">Painel Administrativo · Acesso seguro</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                        <ShieldAlert size={18} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 ml-1">Usuário</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail size={18} className="text-slate-500" />
                            </div>
                            <input
                                type="text"
                                placeholder="admin ou e-mail"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-300 ml-1">Senha</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock size={18} className="text-slate-500" />
                            </div>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 mt-4 py-3.5 px-4 text-white rounded-xl font-semibold transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                        style={{ backgroundImage: `linear-gradient(90deg, ${brand.primaryColor}, ${brand.accentColor})`, boxShadow: `0 0 20px ${brand.primaryColor}45` }}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <LogIn size={20} />
                                <span>Acessar Painel</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-800 pt-6">
                    <p className="text-xs text-slate-500">
                        &copy; {new Date().getFullYear()} {brand.businessName}. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
