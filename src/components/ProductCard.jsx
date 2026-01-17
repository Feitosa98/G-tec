import React, { useState } from 'react';
import { Cpu, HardDrive, ShoppingCart, Zap, Star, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const ProductCard = ({ product, addToCart }) => {
    const [isHovered, setIsHovered] = useState(false);
    const hasPromo = product.promoPrice && product.promoPrice < product.price;
    const discount = hasPromo ? Math.round(((product.price - product.promoPrice) / product.price) * 100) : 0;
    const displayPrice = hasPromo ? product.promoPrice : product.price;

    return (
        <div
            className="product-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: 'var(--gradient-card)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: isHovered ? '1px solid rgba(212, 160, 36, 0.3)' : 'var(--glass-border)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
                boxShadow: isHovered ? 'var(--shadow-xl), 0 0 30px rgba(212, 160, 36, 0.2)' : 'var(--shadow-md)',
                position: 'relative'
            }}
        >
            {/* Image Container */}
            <Link to={`/product/${product.id}`} style={{ display: 'block', height: '240px', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                <img
                    src={product.images?.[0] || product.image}
                    alt={product.name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: isHovered ? 'scale(1.1)' : 'scale(1)'
                    }}
                />

                {/* Gradient Overlay */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '50%',
                    background: 'linear-gradient(to top, rgba(18,24,43,0.9), transparent)',
                    pointerEvents: 'none'
                }}></div>

                {/* Category Badge */}
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: product.category === 'Gamer' ? 'var(--gradient-accent)' : 'var(--gradient-primary)',
                    color: product.category === 'Gamer' ? '#000' : '#fff',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: 'var(--shadow-md)'
                }}>
                    {product.category}
                </div>

                {/* Discount Badge */}
                {hasPromo && (
                    <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'var(--color-danger)',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <TrendingUp size={12} />
                        -{discount}%
                    </div>
                )}
            </Link>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
                <Link to={`/product/${product.id}`} style={{ textDecoration: 'none' }}>
                    <h3 style={{
                        fontSize: '1.15rem',
                        marginBottom: '0.75rem',
                        fontFamily: 'var(--font-display)',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: isHovered ? 'var(--color-accent-light)' : 'var(--color-text-main)',
                        transition: 'color 0.3s'
                    }}>
                        {product.name}
                    </h3>
                </Link>

                {/* Brand */}
                <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--color-text-muted)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <Star size={12} color="var(--color-accent)" fill="var(--color-accent)" />
                    {product.brand}
                </div>

                {/* Specs Grid */}
                {(product.specs?.cpu || product.specs?.gpu || product.specs?.ram) && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gap: '8px',
                        marginBottom: '1.5rem',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)'
                    }}>
                        {product.specs?.cpu && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Cpu size={14} color="var(--color-accent)" />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.specs.cpu}</span>
                            </div>
                        )}
                        {product.specs?.gpu && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={14} color="var(--color-accent)" />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.specs.gpu}</span>
                            </div>
                        )}
                        {product.specs?.ram && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HardDrive size={14} color="var(--color-accent)" />
                                <span>{product.specs.ram}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Price & Action */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '1.25rem',
                    gap: '1rem'
                }}>
                    <div>
                        {hasPromo && (
                            <span style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                textDecoration: 'line-through',
                                marginBottom: '2px'
                            }}>
                                R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>R$</span>
                            <span style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: hasPromo ? 'var(--color-success)' : 'var(--color-accent)',
                                fontFamily: 'var(--font-display)'
                            }}>
                                {displayPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            addToCart(product);
                        }}
                        style={{
                            background: isHovered ? 'var(--gradient-accent)' : 'var(--gradient-primary)',
                            color: isHovered ? '#000' : '#fff',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
                            boxShadow: isHovered ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                            flexShrink: 0
                        }}
                    >
                        <ShoppingCart size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;
