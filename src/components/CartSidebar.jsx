import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Plus, Minus } from 'lucide-react';
import { useData } from '../context/DataContext';

const CartSidebar = ({ isOpen, closeCart }) => {
    const navigate = useNavigate();
    const { cart, cartTotal, removeFromCart, updateCartItemQuantity } = useData();

    return (
        <>
            {/* Overlay */}
            <div
                onClick={closeCart}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'all' : 'none',
                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            />

            {/* Sidebar */}
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: '100%',
                maxWidth: '420px',
                height: '100%',
                background: 'var(--gradient-card)',
                boxShadow: 'var(--shadow-xl)',
                borderLeft: '1px solid rgba(212, 160, 36, 0.2)',
                zIndex: 1001,
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.75rem',
                    borderBottom: '1px solid rgba(212, 160, 36, 0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.5rem',
                        background: 'linear-gradient(135deg, #fff 0%, var(--color-accent-light) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Carrinho</h2>
                    <button
                        onClick={closeCart}
                        className="icon-btn"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {cart.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            color: 'var(--color-text-muted)',
                            marginTop: '3rem',
                            padding: '2rem'
                        }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                margin: '0 auto 1rem',
                                background: 'rgba(212, 160, 36, 0.1)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span style={{ fontSize: '2rem' }}>🛒</span>
                            </div>
                            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Seu carrinho está vazio</p>
                            <p style={{ fontSize: '0.9rem' }}>Adicione produtos para continuar</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {cart.map((item, index) => (
                                <div key={`${item.id}-${index}`} style={{
                                    display: 'flex',
                                    gap: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    transition: 'all 0.3s'
                                }}>
                                    <img
                                        src={item.images?.[0] || item.image}
                                        alt={item.name}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            objectFit: 'cover',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid rgba(212, 160, 36, 0.2)'
                                        }}
                                    />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <h4 style={{
                                            fontSize: '0.95rem',
                                            fontWeight: '600',
                                            lineHeight: '1.3'
                                        }}>{item.name}</h4>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            marginTop: 'auto'
                                        }}>
                                            {/* Quantity Controls */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: '0.25rem'
                                            }}>
                                                <button
                                                    onClick={() => updateCartItemQuantity(index, (item.quantity || 1) - 1)}
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        color: 'var(--color-text-main)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span style={{
                                                    minWidth: '24px',
                                                    textAlign: 'center',
                                                    fontWeight: '600',
                                                    fontSize: '0.9rem'
                                                }}>
                                                    {item.quantity || 1}
                                                </span>
                                                <button
                                                    onClick={() => updateCartItemQuantity(index, (item.quantity || 1) + 1)}
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '4px',
                                                        background: 'var(--gradient-accent)',
                                                        color: '#000',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            {/* Price */}
                                            <div style={{ flex: 1 }}>
                                                <p style={{
                                                    color: 'var(--color-accent)',
                                                    fontWeight: '700',
                                                    fontSize: '1rem',
                                                    fontFamily: 'var(--font-display)'
                                                }}>
                                                    R$ {(item.price * (item.quantity || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                {item.quantity > 1 && (
                                                    <p style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)'
                                                    }}>
                                                        {item.quantity}× R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Remove Button */}
                                            <button
                                                onClick={() => removeFromCart(index)}
                                                style={{
                                                    color: 'var(--color-danger)',
                                                    background: 'rgba(255, 71, 87, 0.1)',
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div style={{
                        padding: '1.75rem',
                        background: 'rgba(0,0,0,0.4)',
                        borderTop: '1px solid rgba(212, 160, 36, 0.2)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '1.25rem',
                            fontSize: '1.3rem',
                            fontWeight: '700'
                        }}>
                            <span style={{ color: 'var(--color-text-main)' }}>Total:</span>
                            <span style={{
                                color: 'var(--color-accent)',
                                fontFamily: 'var(--font-display)'
                            }}>
                                R$ {(cartTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <button
                            className="btn-primary"
                            style={{
                                width: '100%',
                                justifyContent: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '1rem'
                            }}
                            onClick={() => {
                                closeCart();
                                navigate('/checkout');
                            }}
                        >
                            Finalizar Compra
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default CartSidebar;
