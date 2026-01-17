import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import ProductCard from '../components/ProductCard';
import CartSidebar from '../components/CartSidebar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Filter } from 'lucide-react';
import { showToast } from '../utils/toast';
import GoogleReviews from '../components/GoogleReviews';

const Store = () => {
    const { products, registerSale, cart, addToCart: contextAddToCart, removeFromCart: contextRemoveFromCart, clearCart } = useData();
    const { user } = useAuth();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedDept, setSelectedDept] = useState('Todos');
    const [selectedBrand, setSelectedBrand] = useState('Todas');
    const [showFilters, setShowFilters] = useState(false); // Mobile toggle
    const [searchTerm, setSearchTerm] = useState('');

    // Advanced Filters
    const [priceRange, setPriceRange] = useState({ min: 0, max: 50000 });
    const [showOnSale, setShowOnSale] = useState(false);
    const [sortBy, setSortBy] = useState('default'); // default, price-asc, price-desc, name

    // Auto-scroll to products when searching
    useEffect(() => {
        if (searchTerm) {
            const productsGrid = document.querySelector('.products-grid');
            if (productsGrid) {
                productsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [searchTerm]);

    // Simulate network delay for filtering
    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [selectedDept, selectedBrand, searchTerm]);

    const toggleCart = () => setIsCartOpen(!isCartOpen);

    const addToCart = (product) => {
        contextAddToCart(product);
        setIsCartOpen(true);
    };

    const removeFromCart = (index) => {
        contextRemoveFromCart(index);
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        const userEmail = user?.email || 'guest';

        registerSale(cart, userEmail);
        clearCart();
        showToast.success('Compra realizada com sucesso! 🎉');
        setIsCartOpen(false);
    };

    // --- FILTER LOGIC ---
    const departments = ['Todos', ...new Set(products.map(p => p.department))];
    const brands = ['Todas', ...new Set(products.map(p => p.brand))];

    const filteredProducts = products.filter(product => {
        const deptMatch = selectedDept === 'Todos' || product.department === selectedDept;
        const brandMatch = selectedBrand === 'Todas' || product.brand === selectedBrand;
        const searchMatch = searchTerm === '' ||
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.specs?.cpu && product.specs.cpu.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (product.specs?.gpu && product.specs.gpu.toLowerCase().includes(searchTerm.toLowerCase()));

        // Price filter
        const priceMatch = product.price >= priceRange.min && product.price <= priceRange.max;

        // On Sale filter
        const saleMatch = !showOnSale || (product.promoPrice && product.promoPrice < product.price);

        return deptMatch && brandMatch && searchMatch && priceMatch && saleMatch;
    }).sort((a, b) => {
        // Sorting
        switch (sortBy) {
            case 'price-asc':
                return a.price - b.price;
            case 'price-desc':
                return b.price - a.price;
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });

    return (
        <div className="store-page">
            <Header
                cartCount={cart.length}
                toggleCart={toggleCart}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
            />

            <CartSidebar
                isOpen={isCartOpen}
                closeCart={() => setIsCartOpen(false)}
                cartItems={cart}
                removeFromCart={removeFromCart}
                onCheckout={handleCheckout} // Pass checkout handler
            />

            <Hero />

            <div className="container" style={{ padding: '2rem 20px', display: 'flex', gap: '2rem', position: 'relative' }}>

                {/* Sidebar Filters - Desktop */}
                <aside className="filters" style={{
                    width: '250px',
                    minWidth: '250px',
                    display: 'none',
                    '@media (min-width: 768px)': { display: 'block' } // Would need real CSS for media queries, hacking execution for now
                }}>
                    <div style={{ position: 'sticky', top: '100px', background: 'var(--color-bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Filter size={18} color="var(--color-accent)" /> Filtros
                        </h3>

                        {/* Department Filter */}
                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Departamento</h4>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {departments.map(dept => (
                                    <li key={dept}>
                                        <button
                                            onClick={() => setSelectedDept(dept)}
                                            style={{
                                                background: 'none',
                                                color: selectedDept === dept ? 'var(--color-accent)' : 'white',
                                                fontWeight: selectedDept === dept ? 'bold' : 'normal',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                transition: 'color 0.2s',
                                                width: '100%'
                                            }}
                                        >
                                            {dept}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Brand Filter */}
                        <div>
                            <h4 style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Marca</h4>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {brands.map(brand => (
                                    <li key={brand}>
                                        <button
                                            onClick={() => setSelectedBrand(brand)}
                                            style={{
                                                background: 'none',
                                                color: selectedBrand === brand ? 'var(--color-accent)' : 'white',
                                                fontWeight: selectedBrand === brand ? 'bold' : 'normal',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                transition: 'color 0.2s',
                                                width: '100%'
                                            }}
                                        >
                                            {brand}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </aside>

                {/* Product Grid Area */}
                <div style={{ flex: 1 }}>
                    {/* Filter Controls Bar */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        padding: '1rem',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(212, 160, 36, 0.15)'
                    }}>
                        {/* Sort Dropdown */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: 'var(--color-text-main)',
                                padding: '0.65rem 2.5rem 0.65rem 1rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                outline: 'none',
                                fontFamily: 'var(--font-main)',
                                transition: 'all 0.3s',
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                appearance: 'none',
                                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'rgba(212,160,36,0.8)\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.7rem center',
                                backgroundSize: '1.2rem'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                        >
                            <option value="default" style={{ background: '#1a1f35', color: '#fff' }}>Ordenar por</option>
                            <option value="price-asc" style={{ background: '#1a1f35', color: '#fff' }}>💰 Menor Preço</option>
                            <option value="price-desc" style={{ background: '#1a1f35', color: '#fff' }}>💎 Maior Preço</option>
                            <option value="name" style={{ background: '#1a1f35', color: '#fff' }}>🔤 Nome (A-Z)</option>
                        </select>

                        {/* On Sale Toggle */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            padding: '0.65rem 1rem',
                            background: showOnSale ? 'rgba(212, 160, 36, 0.2)' : 'rgba(255,255,255,0.05)',
                            border: showOnSale ? '2px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 'var(--radius-sm)',
                            transition: 'all 0.3s',
                            fontSize: '0.9rem',
                            fontWeight: showOnSale ? '600' : '400',
                            userSelect: 'none'
                        }}>
                            <input
                                type="checkbox"
                                checked={showOnSale}
                                onChange={(e) => setShowOnSale(e.target.checked)}
                                style={{
                                    accentColor: 'var(--color-accent)',
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer'
                                }}
                            />
                            <span style={{ color: showOnSale ? 'var(--color-accent)' : 'var(--color-text-main)' }}>
                                🔥 Apenas Promoções
                            </span>
                        </label>
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '2.5rem',
                        paddingBottom: '1rem',
                        borderBottom: '2px solid rgba(212, 160, 36, 0.2)'
                    }}>
                        <h2 style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '2rem',
                            background: 'linear-gradient(135deg, #fff 0%, var(--color-accent-light) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            {selectedDept}
                            {selectedBrand !== 'Todas' && <span style={{
                                color: 'var(--color-text-muted)',
                                fontSize: '1.2rem',
                                background: 'none',
                                WebkitTextFillColor: 'var(--color-text-muted)'
                            }}> / {selectedBrand}</span>}
                        </h2>
                        <div style={{
                            background: 'rgba(212, 160, 36, 0.1)',
                            border: '1px solid rgba(212, 160, 36, 0.3)',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <span style={{
                                color: 'var(--color-accent)',
                                fontWeight: '700',
                                fontSize: '1.1rem'
                            }}>{filteredProducts.length}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>produtos</span>
                        </div>
                    </div>

                    {/* Hack to force display sidebar on desktop since inline media queries don't work */}
                    <style>{`
            @media (min-width: 768px) {
              .filters { display: block !important; }
            }
          `}</style>

                    {/* Hack to force display sidebar on desktop since inline media queries don't work */}
                    <style>{`
            @media (min-width: 768px) {
              .filters { display: block !important; }
            }
          `}</style>

                    {loading ? (
                        <div style={{ padding: '6rem', display: 'flex', justifyContent: 'center' }}>
                            <LoadingSpinner size={60} color="var(--color-primary)" />
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="products-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '2rem'
                        }}>
                            {/* Mock Promotion Banner for lower part of grid if needed, or just let cards show 'OFERTA' */}
                            {filteredProducts.map(product => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    addToCart={addToCart}
                                />
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)' }}>
                            <h3>Nenhum produto encontrado.</h3>
                            <p>Tente limpar os filtros.</p>
                        </div>
                    )}
                </div>
            </div>

            <GoogleReviews />

            <footer style={{
                background: 'var(--gradient-card)',
                borderTop: '1px solid rgba(212, 160, 36, 0.2)',
                marginTop: '4rem'
            }}>
                <div className="container" style={{
                    padding: '3rem 24px 2rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '2rem'
                }}>
                    {/* Brand Section */}
                    <div>
                        <img src="/logo.png" alt="GTEC" style={{ height: '50px', marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                            Hardware de alta performance para gamers e profissionais. Qualidade e tecnologia de ponta.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <a href="https://www.facebook.com/gtecinfor.am" target="_blank" rel="noopener noreferrer" style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(212, 160, 36, 0.1)',
                                border: '1px solid rgba(212, 160, 36, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-accent)',
                                transition: 'all 0.3s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#1877F2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(212, 160, 36, 0.1)'}
                                title="Facebook">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </a>
                            <a href="https://www.instagram.com/gtecinformatica.am/" target="_blank" rel="noopener noreferrer" style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(212, 160, 36, 0.1)',
                                border: '1px solid rgba(212, 160, 36, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-accent)',
                                transition: 'all 0.3s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(212, 160, 36, 0.1)'}
                                title="Instagram">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                            </a>
                            <a href="https://wa.me/5592992800023?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20GTEC%20Inform%C3%A1tica!" target="_blank" rel="noopener noreferrer" style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'rgba(212, 160, 36, 0.1)',
                                border: '1px solid rgba(212, 160, 36, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-accent)',
                                transition: 'all 0.3s'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#25D366'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(212, 160, 36, 0.1)'}
                                title="WhatsApp">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 style={{
                            color: 'var(--color-accent)',
                            marginBottom: '1rem',
                            fontFamily: 'var(--font-display)',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>Links Rápidos</h4>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li><a href="/" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', transition: 'color 0.3s' }}>Início</a></li>
                            <li><a href="/#products" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', transition: 'color 0.3s' }}>Produtos</a></li>
                            <li><a href="/admin" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', transition: 'color 0.3s' }}>Admin</a></li>
                            <li><a href="/account" style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', transition: 'color 0.3s' }}>Minha Conta</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 style={{
                            color: 'var(--color-accent)',
                            marginBottom: '1rem',
                            fontFamily: 'var(--font-display)',
                            fontSize: '0.9rem',
                            textTransform: 'uppercase',
                            letterSpacing: '1px'
                        }}>Contato</h4>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>📧 contato@gtecinformatica.com.br</li>
                            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>📱 (92) 9 9280-0023</li>
                            <li style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>📍 R. Rio Mucuim, 45 - São José Operário, Manaus - AM</li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    padding: '1.5rem 0',
                    textAlign: 'center'
                }}>
                    <div className="container">
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            &copy; {new Date().getFullYear()} GTEC Informática. Todos os direitos reservados.
                        </p>
                    </div>
                </div>
            </footer>

            {/* Floating WhatsApp Button */}
            <a
                href="https://wa.me/5592992800023?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20GTEC%20Inform%C3%A1tica!"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)',
                    zIndex: 999,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 211, 102, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.4)';
                }}
                title="Fale conosco no WhatsApp"
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
            </a>
        </div >
    );
};

export default Store;
