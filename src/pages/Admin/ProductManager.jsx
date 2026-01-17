import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Plus, Trash2, Edit, Upload, Image as ImageIcon } from 'lucide-react';
import { showToast } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';

const ProductManager = () => {
    const { products, addProduct, deleteProduct, updateProduct } = useData();
    const navigate = useNavigate();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        name: '', price: '', costPrice: '', category: 'Gamer', department: 'Notebooks', brand: '', image: '', cpumodel: '', gpumodel: '', ram: '', storage: ''
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
            // In a real app, this would be the URL returned from backend/S3
            // Here we use a high-quality placehold.co or unsplash url based on category
            const randomId = Math.floor(Math.random() * 1000);
            const fakeUrl = `https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=1000&auto=format&fit=crop`; // Keep safe consistent image for demo

            setFormData(prev => ({ ...prev, image: fakeUrl }));
            setUploading(false);
            showToast.success('Imagem enviada com sucesso!');
        }, 1500);
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            price: product.price,
            costPrice: product.costPrice || '',
            category: product.category,
            department: product.department,
            brand: product.brand,
            image: product.image,
            cpumodel: product.specs?.cpu || '',
            gpumodel: product.specs?.gpu || '',
            ram: product.specs?.ram || '',
            storage: product.specs?.storage || ''
        });
        setIsFormOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const productData = {
            id: editingProduct ? editingProduct.id : Date.now(),
            name: formData.name,
            price: Number(formData.price),
            costPrice: Number(formData.costPrice),
            category: formData.category,
            department: formData.department,
            brand: formData.brand,
            image: formData.image || "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=1000",
            specs: {
                cpu: formData.cpumodel,
                gpu: formData.gpumodel,
                ram: formData.ram,
                storage: formData.storage
            },
            images: editingProduct ? editingProduct.images : [] // Preserve images if editing
        };

        if (editingProduct) {
            updateProduct(productData);
            showToast.success('Produto atualizado com sucesso!');
        } else {
            addProduct(productData);
            showToast.success('Produto cadastrado com sucesso!');
        }

        setIsFormOpen(false);
        setEditingProduct(null);
        setFormData({ name: '', price: '', costPrice: '', category: 'Gamer', department: 'Notebooks', brand: '', image: '', cpumodel: '', gpumodel: '', ram: '', storage: '' });
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>Gerenciar Produtos</h1>
                <button className="btn-primary" onClick={() => navigate('/admin/create-product')}>
                    <Plus size={20} style={{ marginRight: '5px' }} /> Novo Produto
                </button>
            </div>

            {isFormOpen && (
                <div style={{ background: 'var(--color-bg-card)', padding: '2rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem', border: '1px solid var(--color-accent)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>{editingProduct ? 'Editar Produto' : 'Adicionar item ao catálogo'}</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <input name="name" placeholder="Nome do Produto" value={formData.name} onChange={handleChange} style={inputStyle} required />
                        <input name="brand" placeholder="Marca (Ex: Dell, Asus)" value={formData.brand} onChange={handleChange} style={inputStyle} required />
                        <input name="price" type="number" placeholder="Preço de Venda (R$)" value={formData.price} onChange={handleChange} style={inputStyle} required />
                        <input name="costPrice" type="number" placeholder="Preço de Custo (R$)" value={formData.costPrice} onChange={handleChange} style={inputStyle} required />

                        <select name="department" value={formData.department} onChange={handleChange} style={inputStyle}>
                            <option value="Notebooks">Notebooks</option>
                            <option value="Periféricos">Periféricos</option>
                            <option value="Hardware">Hardware</option>
                        </select>
                        <select name="category" value={formData.category} onChange={handleChange} style={inputStyle}>
                            <option value="Gamer">Gamer</option>
                            <option value="Office">Office</option>
                            <option value="Workstation">Workstation</option>
                            <option value="Acessórios">Acessórios</option>
                        </select>

                        <input name="cpumodel" placeholder="CPU (Ex: i7-12700K)" value={formData.cpumodel} onChange={handleChange} style={inputStyle} />
                        <input name="gpumodel" placeholder="GPU (Ex: RTX 3060)" value={formData.gpumodel} onChange={handleChange} style={inputStyle} />
                        <input name="ram" placeholder="RAM (Ex: 16GB)" value={formData.ram} onChange={handleChange} style={inputStyle} />
                        <input name="storage" placeholder="Armazenamento (Ex: 1TB SSD)" value={formData.storage} onChange={handleChange} style={inputStyle} />

                        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <input name="image" placeholder="URL da Imagem (ou use o upload)" value={formData.image} onChange={handleChange} style={{ ...inputStyle, width: '100%' }} />
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                    disabled={uploading}
                                />
                                <button type="button" className="btn-primary" style={{ background: uploading ? 'var(--color-text-muted)' : 'var(--color-accent)', minWidth: '140px' }}>
                                    {uploading ? 'Enviando...' : (
                                        <>
                                            <Upload size={18} style={{ marginRight: '8px' }} /> Upload
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {formData.image && (
                            <div style={{ gridColumn: 'span 2', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '5px' }}>Pré-visualização:</p>
                                <img src={formData.image} alt="Preview" style={{ maxHeight: '150px', maxWidth: '100%', borderRadius: 'var(--radius-sm)' }} />
                            </div>
                        )}

                        <button type="submit" className="btn-primary" style={{ gridColumn: 'span 2' }}>
                            {editingProduct ? 'Atualizar Produto' : 'Salvar Produto'}
                        </button>
                    </form>
                </div>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={thStyle}>Produto</th>
                            <th style={thStyle}>Marca</th>
                            <th style={thStyle}>Custo</th>
                            <th style={thStyle}>Venda</th>
                            <th style={thStyle}>Lucro Unit.</th>
                            <th style={thStyle}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={tdStyle}>{product.name}</td>
                                <td style={tdStyle}>{product.brand}</td>
                                <td style={{ ...tdStyle, color: 'var(--color-danger)' }}>R$ {product.costPrice?.toLocaleString('pt-BR')}</td>
                                <td style={{ ...tdStyle, color: 'var(--color-success)' }}>R$ {product.price?.toLocaleString('pt-BR')}</td>
                                <td style={tdStyle}>R$ {(product.price - (product.costPrice || 0)).toLocaleString('pt-BR')}</td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => handleEdit(product)} style={{ color: 'var(--color-accent)', background: 'none', cursor: 'pointer' }} title="Editar">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => deleteProduct(product.id)} style={{ color: 'var(--color-danger)', background: 'none', cursor: 'pointer' }} title="Excluir">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.8rem',
    borderRadius: 'var(--radius-sm)',
    color: 'white',
    outline: 'none'
};

const thStyle = { padding: '1rem', color: 'var(--color-text-muted)' };
const tdStyle = { padding: '1rem' };

export default ProductManager;
