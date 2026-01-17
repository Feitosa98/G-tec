import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Navigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import { Package, Calendar, DollarSign } from 'lucide-react';

const AccountPage = () => {
    const { user } = useAuth();
    const { sales } = useData();

    // Protect Route: Only logged-in customers
    if (!user || user.role !== 'customer') {
        return <Navigate to="/login" replace />;
    }

    // Filter sales for this user
    const userOrders = sales.filter(sale => sale.userEmail === user.email);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header cartCount={0} toggleCart={() => { }} />

            <div className="container" style={{ padding: '3rem 20px', flex: 1 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.5rem' }}>
                    Minha Conta
                </h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                    Olá, <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{user.name}</span>! Aqui estão seus pedidos.
                </p>

                {userOrders.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem',
                        background: 'var(--color-bg-card)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                        <Package size={48} color="var(--color-text-muted)" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ marginBottom: '0.5rem' }}>Nenhum pedido ainda</h3>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Comece a explorar nossa loja!</p>
                        <Link to="/" className="btn-primary">Ver Produtos</Link>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {userOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => (
                            <div key={order.id} style={{
                                background: 'var(--color-bg-card)',
                                padding: '1.5rem',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                {/* Order Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                            <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>
                                                Pedido #{order.id.toString().slice(-6)}
                                            </h3>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                background: (() => {
                                                    switch (order.status) {
                                                        case 'Pendente': return 'rgba(234, 179, 8, 0.1)';
                                                        case 'Enviado': return 'rgba(59, 130, 246, 0.1)';
                                                        case 'Entregue': return 'rgba(34, 197, 94, 0.1)';
                                                        case 'Cancelado': return 'rgba(239, 68, 68, 0.1)';
                                                        default: return 'rgba(255, 255, 255, 0.1)';
                                                    }
                                                })(),
                                                color: (() => {
                                                    switch (order.status) {
                                                        case 'Pendente': return 'var(--color-warning)';
                                                        case 'Enviado': return 'var(--color-primary)';
                                                        case 'Entregue': return 'var(--color-success)';
                                                        case 'Cancelado': return 'var(--color-danger)';
                                                        default: return 'var(--color-text-muted)';
                                                    }
                                                })(),
                                                border: `1px solid ${(() => {
                                                    switch (order.status) {
                                                        case 'Pendente': return 'var(--color-warning)';
                                                        case 'Enviado': return 'var(--color-primary)';
                                                        case 'Entregue': return 'var(--color-success)';
                                                        case 'Cancelado': return 'var(--color-danger)';
                                                        default: return 'var(--color-text-muted)';
                                                    }
                                                })()}`,
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}>
                                                {order.status || 'Pendente'}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Calendar size={14} />
                                            {new Date(order.date).toLocaleDateString('pt-BR')} às {new Date(order.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Total</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                            R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {order.items.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <img src={item.image} alt={item.name} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>{item.name}</h4>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{item.brand}</p>
                                            </div>
                                            <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                                                R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <footer style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p>&copy; 2024 GTEC Informática. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
};

export default AccountPage;
