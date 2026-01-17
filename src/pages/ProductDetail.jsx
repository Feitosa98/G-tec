import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import { ArrowLeft, ShoppingCart, Cpu, HardDrive, Zap, ChevronLeft, ChevronRight, Share2, Copy, MessageCircle } from 'lucide-react';
import { showToast } from '../utils/toast';
import LoadingSpinner from '../components/LoadingSpinner';

const ProductDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, addToCart: contextAddToCart } = useData();
    // const { user } = useAuth(); // Unused
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [loading, setLoading] = useState(true);

    const product = products.find(p => p.id === id);
    const images = product?.images || (product?.image ? [product.image] : []);

    useEffect(() => {
        // Simulate loading delay for better UX
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, [id]);

    // Auto-play carousel - Must be called unconditionally
    useEffect(() => {
        if (!isAutoPlaying || images.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }, 3000); // Troca a cada 3 segundos

        return () => clearInterval(interval);
    }, [isAutoPlaying, images.length]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner size={60} color="var(--color-accent)" />
            </div>
        );
    }

    if (!product) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <h2>Produto não encontrado</h2>
                    <Link to="/" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>Voltar à Loja</Link>
                </div>
            </div>
        );
    }

    const handleAddToCart = () => {
        contextAddToCart(product);
        showToast.success('Produto adicionado ao carrinho!');
        navigate('/');
    };

    const nextImage = () => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header cartCount={0} toggleCart={() => { }} />

            <div className="container" style={{ padding: '3rem 20px', flex: 1 }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '2rem',
                        fontSize: '0.9rem'
                    }}
                >
                    <ArrowLeft size={20} />
                    Voltar
                </button>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '3rem',
                    alignItems: 'start'
                }}>
                    {/* Image Gallery Section */}
                    <div>
                        <div
                            style={{
                                background: 'var(--color-bg-card)',
                                borderRadius: 'var(--radius-lg)',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.05)',
                                position: 'relative'
                            }}
                            onMouseEnter={() => setIsAutoPlaying(false)}
                            onMouseLeave={() => setIsAutoPlaying(true)}
                        >
                            <img
                                src={images[currentImageIndex]}
                                alt={`${product.name} - ${currentImageIndex + 1}`}
                                style={{ width: '100%', height: '500px', objectFit: 'cover' }}
                            />

                            {/* Navigation Arrows */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        style={{
                                            position: 'absolute',
                                            left: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(0,0,0,0.5)',
                                            backdropFilter: 'blur(5px)',
                                            color: 'white',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(255,255,255,0.2)'
                                        }}
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(0,0,0,0.5)',
                                            backdropFilter: 'blur(5px)',
                                            color: 'white',
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(255,255,255,0.2)'
                                        }}
                                    >
                                        <ChevronRight size={24} />
                                    </button>

                                    {/* Image Counter */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '15px',
                                        right: '15px',
                                        background: 'rgba(0,0,0,0.7)',
                                        color: 'white',
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {currentImageIndex + 1} / {images.length}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div style={{
                                display: 'flex',
                                gap: '10px',
                                marginTop: '1rem',
                                overflowX: 'auto',
                                paddingBottom: '5px'
                            }}>
                                {images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden',
                                            border: currentImageIndex === idx ? '2px solid var(--color-accent)' : '2px solid transparent',
                                            opacity: currentImageIndex === idx ? 1 : 0.6,
                                            transition: 'all 0.2s',
                                            cursor: 'pointer',
                                            padding: 0,
                                            background: 'none'
                                        }}
                                    >
                                        <img
                                            src={img}
                                            alt={`Thumbnail ${idx + 1}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info Section */}
                    <div>
                        <div style={{ marginBottom: '1rem' }}>
                            <span style={{
                                background: product.category === 'Gamer' ? 'var(--color-danger)' : 'var(--color-primary)',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                            }}>
                                {product.category}
                            </span>
                        </div>

                        <h1 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '2.5rem',
                            marginBottom: '0.5rem'
                        }}>
                            {product.name}
                        </h1>

                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                            {product.brand} • {product.department}
                        </p>

                        {/* Specs */}
                        <div style={{
                            background: 'var(--color-bg-card)',
                            padding: '1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: '2rem',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Especificações</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                                {Object.entries(product.specs || {}).map(([key, value]) => {
                                    if (value === "N/A") return null;

                                    const labels = {
                                        cpu: { label: "Processador", icon: Cpu },
                                        gpu: { label: "Placa de Vídeo", icon: Zap },
                                        ram: { label: "Memória RAM", icon: HardDrive },
                                        storage: { label: "Armazenamento", icon: HardDrive },
                                        dpi: { label: "DPI", icon: Zap },
                                        lighting: { label: "Iluminação", icon: Zap },
                                        connection: { label: "Conexão", icon: Zap },
                                        switch: { label: "Switch", icon: Cpu },
                                        layout: { label: "Layout", icon: HardDrive },
                                        panel: { label: "Painel", icon: HardDrive },
                                        refresh_rate: { label: "Taxa de Atualização", icon: Zap },
                                        resolution: { label: "Resolução", icon: HardDrive }
                                    };

                                    const specInfo = labels[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), icon: Zap };
                                    const Icon = specInfo.icon;

                                    return (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                                <Icon size={20} color="var(--color-accent)" />
                                            </div>
                                            <div>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'block' }}>{specInfo.label}</span>
                                                <span style={{ fontWeight: 'bold' }}>{value}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Price & CTA */}
                        <div style={{
                            background: 'var(--color-bg-card)',
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-accent)'
                        }}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Preço à vista</span>
                                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                className="btn-primary"
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1rem' }}
                            >
                                <ShoppingCart size={20} />
                                Adicionar ao Carrinho
                            </button>
                        </div>
                    </div>
                </div>

                {/* Related Products */}
                <div style={{ marginTop: '4rem' }}>
                    <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '2rem',
                        marginBottom: '2rem',
                        background: 'linear-gradient(135deg, #fff 0%, var(--color-accent-light) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>
                        Produtos Relacionados
                    </h2>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {products
                            .filter(p => p.category === product.category && p.id !== product.id)
                            .slice(0, 4)
                            .map(relatedProduct => (
                                <Link
                                    key={relatedProduct.id}
                                    to={`/product/${relatedProduct.id}`}
                                    style={{
                                        background: 'var(--gradient-card)',
                                        borderRadius: 'var(--radius-lg)',
                                        overflow: 'hidden',
                                        border: 'var(--glass-border)',
                                        transition: 'all 0.3s',
                                        textDecoration: 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <img
                                        src={relatedProduct.images?.[0] || relatedProduct.image}
                                        alt={relatedProduct.name}
                                        style={{
                                            width: '100%',
                                            height: '200px',
                                            objectFit: 'cover'
                                        }}
                                    />
                                    <div style={{ padding: '1rem' }}>
                                        <h3 style={{
                                            fontSize: '1rem',
                                            marginBottom: '0.5rem',
                                            color: 'var(--color-text-main)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {relatedProduct.name}
                                        </h3>
                                        <p style={{
                                            color: 'var(--color-accent)',
                                            fontWeight: '700',
                                            fontSize: '1.2rem',
                                            fontFamily: 'var(--font-display)'
                                        }}>
                                            R$ {relatedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                    </div>
                </div>
            </div>

            <footer style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <p>&copy; 2024 GTEC Informática. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
};

export default ProductDetail;
