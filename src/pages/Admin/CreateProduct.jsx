import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { showToast } from '../../utils/toast';
import { ArrowLeft, Upload, Eye, Check, Cpu, HardDrive, Zap, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateProduct = () => {
    const { addProduct } = useData();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Form, 2: Preview
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        costPrice: '',
        category: 'Gamer',
        department: 'Notebooks',
        brand: '',
        image: '',
        images: [],
        cpumodel: '',
        gpumodel: '',
        ram: '',
        storage: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        // Simulate upload delay
        setTimeout(() => {
            const fakeUrl = `https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=1000&auto=format&fit=crop`; // Demo URL
            setFormData(prev => ({
                ...prev,
                image: fakeUrl,
                images: [...prev.images, fakeUrl] // Add to gallery
            }));
            setUploading(false);
            showToast.success('Imagem simulada enviada!');
        }, 1200);
    };

    const handlePublish = () => {
        const productData = {
            id: Date.now(),
            name: formData.name,
            price: Number(formData.price),
            costPrice: Number(formData.costPrice),
            promoPrice: formData.promoPrice ? Number(formData.promoPrice) : null,
            category: formData.category,
            department: formData.department,
            brand: formData.brand,
            image: formData.image || "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=1000",
            images: formData.images.length > 0 ? formData.images : [formData.image],
            specs: {
                cpu: formData.cpumodel,
                gpu: formData.gpumodel,
                ram: formData.ram,
                storage: formData.storage
            }
        };

        addProduct(productData);
        showToast.success('Anúncio publicado com sucesso! 🚀');
        navigate('/admin/products');
    };

    if (step === 2) {
        // --- PREVIEW MODE ---
        return (
            <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', background: 'var(--color-bg-card)', padding: '1rem', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Preview do Anúncio</h2>
                        <span style={{ fontSize: '0.8rem', background: 'var(--color-text-muted)', color: 'black', padding: '2px 8px', borderRadius: '4px' }}>Modo Rascunho</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid var(--color-text-muted)', color: 'var(--color-text-muted)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ArrowLeft size={18} /> Voltar e Editar
                        </button>
                        <button onClick={handlePublish} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Check size={18} /> Publicar Agora
                        </button>
                    </div>
                </div>

                {/* Simulated Product Page */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr',
                    gap: '3rem',
                    background: '#0a0a0f', // Approx. page bg
                    padding: '2rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--color-accent)'
                }}>
                    {/* Image */}
                    <div>
                        <img
                            src={formData.image || 'https://via.placeholder.com/500'}
                            alt="Preview"
                            style={{ width: '100%', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                            {formData.images.map((img, idx) => (
                                <img key={idx} src={img} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }} />
                            ))}
                        </div>
                    </div>

                    {/* Details */}
                    <div>
                        <span style={{
                            background: formData.category === 'Gamer' ? 'var(--color-danger)' : 'var(--color-primary)',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                        }}>
                            {formData.category}
                        </span>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
                            {formData.name || 'Nome do Produto'}
                        </h1>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
                            {formData.brand} • {formData.department}
                        </p>

                        <div style={{ background: 'var(--color-bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Especificações</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <SpecItem icon={Cpu} label="Processador" value={formData.cpumodel} />
                                <SpecItem icon={Zap} label="Placa de Vídeo" value={formData.gpumodel} />
                                <SpecItem icon={HardDrive} label="Memória RAM" value={formData.ram} />
                                <SpecItem icon={HardDrive} label="Armazenamento" value={formData.storage} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Preço à vista</span>
                            {formData.promoPrice ? (
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                                    <span style={{ fontSize: '1.5rem', color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                                        R$ {Number(formData.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                        R$ {Number(formData.promoPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ) : (
                                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                                    R$ {Number(formData.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            )}
                        </div>

                        <button className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1rem', opacity: 0.7, cursor: 'not-allowed' }}>
                            <ShoppingCart size={20} /> Adicionar ao Carrinho
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- FORM STEP ---
    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '2rem' }}>Criar Novo Anúncio</h1>

            <div style={{ background: 'var(--color-bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                    {/* Basic Info */}
                    <div style={{ gridColumn: 'span 2' }}>
                        <h3 style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>1. Informações Básicas</h3>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Título do Anúncio</label>
                        <input name="name" value={formData.name} onChange={handleChange} style={inputStyle} required placeholder="Ex: Notebook Gamer G-Pro..." />
                    </div>

                    <div>
                        <label style={labelStyle}>Marca</label>
                        <input name="brand" value={formData.brand} onChange={handleChange} style={inputStyle} required placeholder="Ex: Dell" />
                    </div>
                    <div>
                        <label style={labelStyle}>Departamento</label>
                        <select name="department" value={formData.department} onChange={handleChange} style={inputStyle}>
                            <option value="Notebooks">Notebooks</option>
                            <option value="Periféricos">Periféricos</option>
                            <option value="Hardware">Hardware</option>
                        </select>
                    </div>

                    <div>
                        <label style={labelStyle}>Categoria</label>
                        <select name="category" value={formData.category} onChange={handleChange} style={inputStyle}>
                            <option value="Gamer">Gamer</option>
                            <option value="Office">Office</option>
                            <option value="Workstation">Workstation</option>
                            <option value="Acessórios">Acessórios</option>
                        </select>
                    </div>

                    {/* Pricing */}
                    <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                        <h3 style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>2. Preços</h3>
                    </div>
                    <div>
                        <label style={labelStyle}>Preço de Custo (R$)</label>
                        <input name="costPrice" type="number" value={formData.costPrice} onChange={handleChange} style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Preço de Venda (R$)</label>
                        <input name="price" type="number" value={formData.price} onChange={handleChange} style={inputStyle} required />
                    </div>

                    {/* Tech Specs */}
                    <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                        <h3 style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>3. Especificações Técnicas</h3>
                    </div>
                    <input name="cpumodel" placeholder="Processador (CPU)" value={formData.cpumodel} onChange={handleChange} style={inputStyle} />
                    <input name="gpumodel" placeholder="Placa de Vídeo (GPU)" value={formData.gpumodel} onChange={handleChange} style={inputStyle} />
                    <input name="ram" placeholder="Memória RAM" value={formData.ram} onChange={handleChange} style={inputStyle} />
                    <input name="storage" placeholder="Armazenamento" value={formData.storage} onChange={handleChange} style={inputStyle} />

                    {/* Media */}
                    <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                        <h3 style={{ color: 'var(--color-accent)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>4. Mídia</h3>
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <input name="image" placeholder="Cole a URL da imagem aqui" value={formData.image} onChange={handleChange} style={{ ...inputStyle, width: '100%' }} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                disabled={uploading}
                            />
                            <button type="button" className="btn-primary" style={{ background: uploading ? 'var(--color-text-muted)' : 'var(--color-accent)', minWidth: '140px' }} disabled={uploading}>
                                {uploading ? 'Enviando...' : <><Upload size={18} style={{ marginRight: '8px' }} /> Upload</>}
                            </button>
                        </div>
                    </div>
                    {formData.image && (
                        <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                            <img src={formData.image} style={{ height: '100px', borderRadius: '8px' }} />
                        </div>
                    )}


                    {/* Submit */}
                    <div style={{ gridColumn: 'span 2', marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <Eye size={20} /> Ver Preview
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

// Helper Components & Styles
const SpecItem = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon size={20} color="var(--color-accent)" />
        <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'block' }}>{label}</span>
            <span style={{ fontWeight: 'bold' }}>{value || 'N/A'}</span>
        </div>
    </div>
);

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.8rem',
    borderRadius: 'var(--radius-sm)',
    color: 'white',
    width: '100%',
    outline: 'none'
};

const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem'
};

export default CreateProduct;
