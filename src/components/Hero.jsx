import React from 'react';
import { Sparkles, TrendingUp, Award } from 'lucide-react';

const Hero = () => {
    return (
        <section className="hero" style={{
            position: 'relative',
            minHeight: '500px',
            display: 'flex',
            alignItems: 'center',
            padding: '3rem 0',
            backgroundImage: 'linear-gradient(135deg, rgba(10,14,26,0.95) 0%, rgba(10,14,26,0.7) 50%, rgba(10,14,26,0.9) 100%), url("https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=2000&auto=format&fit=crop")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            overflow: 'hidden'
        }}>
            {/* Animated Background Elements */}
            <div style={{
                position: 'absolute',
                top: '20%',
                right: '10%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(212,160,36,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(60px)',
                animation: 'float 8s ease-in-out infinite',
                pointerEvents: 'none'
            }}></div>

            <div style={{
                position: 'absolute',
                bottom: '10%',
                left: '5%',
                width: '300px',
                height: '300px',
                background: 'radial-gradient(circle, rgba(0,82,204,0.15) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(60px)',
                animation: 'float 10s ease-in-out infinite reverse',
                pointerEvents: 'none'
            }}></div>

            <div className="container" style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ maxWidth: '800px' }}>
                    {/* Badge */}
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(212, 160, 36, 0.1)',
                        border: '1px solid rgba(212, 160, 36, 0.3)',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '50px',
                        marginBottom: '2rem',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <Sparkles size={16} color="var(--color-accent)" />
                        <span style={{
                            color: 'var(--color-accent)',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>Ofertas Exclusivas</span>
                    </div>

                    {/* Main Heading */}
                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                        fontWeight: '900',
                        lineHeight: '1.1',
                        marginBottom: '1.5rem',
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-display)',
                        background: 'linear-gradient(135deg, #fff 0%, var(--color-accent-light) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        Potência Máxima
                        <br />
                        <span style={{
                            background: 'linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>Performance Extrema</span>
                    </h1>

                    <p style={{
                        fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                        color: 'var(--color-text-muted)',
                        maxWidth: '600px',
                        marginBottom: '3rem',
                        lineHeight: '1.7'
                    }}>
                        Os melhores notebooks gamer e workstations do mercado. Hardware de última geração para quem não aceita menos que a vitória.
                    </p>

                    {/* CTA Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <button className="btn-primary" onClick={() => document.querySelector('.products-grid')?.scrollIntoView({ behavior: 'smooth' })}>
                            Ver Produtos
                        </button>
                        <button className="btn-outline">
                            Ofertas Especiais
                        </button>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '2rem',
                        marginTop: '2.5rem',
                        paddingTop: '1.5rem',
                        borderTop: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <Award size={20} color="var(--color-accent)" />
                                <span style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-accent)' }}>+500</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Clientes Satisfeitos</p>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <TrendingUp size={20} color="var(--color-success)" />
                                <span style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-success)' }}>4.9★</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Avaliação Média</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Gradient Overlay */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '120px',
                background: 'linear-gradient(to bottom, var(--color-bg-darker), transparent)',
                pointerEvents: 'none'
            }}></div>

            {/* Bottom Border Glow */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
                boxShadow: '0 0 20px var(--color-accent-glow)'
            }}></div>
        </section>
    );
};

export default Hero;
