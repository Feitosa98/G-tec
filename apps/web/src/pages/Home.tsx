import { FormEvent, useEffect, useState } from 'react';
import { Building2, Lock, LogIn, Mail, ShieldCheck, Store } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Home() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const loginAdmin = useAuthStore(state => state.loginAdmin);
    const [brandLogo, setBrandLogo] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/tenants/resolve?slug=feitosa')
            .then(response => response.ok ? response.json() : Promise.reject())
            .then(tenant => setBrandLogo(tenant.logoUrl || ''))
            .catch(() => {});
    }, []);

    if (searchParams.has('loja')) {
        return <Navigate to="/" replace />;
    }

    const handleLogin = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        const result = await loginAdmin(username, password);
        if (result.success) {
            navigate('/admin');
        } else {
            setError(result.message || 'Credenciais inválidas.');
        }
        setLoading(false);
    };

    return (
        <main className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex items-center justify-center px-5 py-10">
            <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-blue-600/20 blur-[140px]" />
            <div className="absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full bg-amber-500/15 blur-[150px]" />

            <section className="relative z-10 w-full max-w-5xl grid lg:grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-2xl">
                <div className="p-8 md:p-14 flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-9">
                        <div className="w-16 h-16 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center overflow-hidden">
                            {brandLogo ? <img src={brandLogo} alt="Feitosa Soluções" className="w-full h-full object-contain p-2" /> : <Building2 className="text-amber-400" size={30} />}
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Plataforma de gestão</p>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Feitosa <span className="text-blue-400">Soluções</span></h1>
                        </div>
                    </div>

                    <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-xl">Sua loja organizada em um só lugar.</h2>
                    <p className="mt-5 text-lg text-slate-400 max-w-xl">Acesse vendas, estoque, serviços, financeiro e integrações com segurança e dados separados para cada empresa.</p>

                    <div className="mt-9 flex flex-wrap gap-4 text-sm text-slate-300">
                        <span className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-400" /> Acesso seguro</span>
                        <span className="flex items-center gap-2"><Store size={18} className="text-blue-400" /> Ambiente exclusivo por loja</span>
                    </div>
                </div>

                <div className="p-8 md:p-12 bg-slate-950/55 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col justify-center">
                    <h3 className="text-2xl font-semibold">Acesso único</h3>
                    <p className="text-slate-400 mt-2 mb-7">Entre com suas credenciais. A loja cadastrada será aberta automaticamente.</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <label className="block">
                            <span className="block text-sm font-medium text-slate-300 mb-2">Usuário ou e-mail</span>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={username}
                                    onChange={event => setUsername(event.target.value)}
                                    autoComplete="username"
                                    placeholder="Digite seu usuário"
                                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                    required
                                />
                            </div>
                        </label>

                        <label className="block">
                            <span className="block text-sm font-medium text-slate-300 mb-2">Senha</span>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    autoComplete="current-password"
                                    placeholder="Digite sua senha"
                                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                    required
                                />
                            </div>
                        </label>

                        {error && <p className="text-sm text-red-400">{error}</p>}

                        <button disabled={loading} className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-amber-500 font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-60">
                            <LogIn size={19} />
                            {loading ? 'Entrando...' : 'Acessar minha loja'}
                        </button>
                    </form>

                    <button onClick={() => navigate('/gestor-saas')} className="mt-5 text-sm text-slate-500 hover:text-slate-300 transition">Acesso do gestor da plataforma</button>
                </div>
            </section>
        </main>
    );
}
