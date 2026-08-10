import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
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
            updateProduct(editingProduct.id, productData);
            showToast.success('Produto atualizado com sucesso!');
        } else {
            addProduct(productData);
            showToast.success('Produto cadastrado com sucesso!');
        }

        setIsFormOpen(false);
        setEditingProduct(null);
        setFormData({ name: '', price: '', costPrice: '', category: 'Gamer', department: 'Notebooks', brand: '', image: '', cpumodel: '', gpumodel: '', ram: '', storage: '' });
    };

    const inputClasses = "w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 text-sm outline-none transition-all duration-200";

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen text-slate-100 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        Gerenciar Produtos
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Adicione e edite os produtos do catálogo
                    </p>
                </div>
                <button
                    onClick={() => navigate('/admin/create-product')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 cursor-pointer active:scale-95 self-start sm:self-auto"
                >
                    <Plus size={20} />
                    <span>Novo Produto</span>
                </button>
            </div>

            {/* Form Drawer / Panel */}
            {isFormOpen && (
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8 mb-8 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-xl font-bold text-indigo-300 mb-6 flex items-center gap-2">
                        {editingProduct ? 'Editar Produto' : 'Adicionar item ao catálogo'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            name="name"
                            placeholder="Nome do Produto"
                            value={formData.name}
                            onChange={handleChange}
                            className={inputClasses}
                            required
                        />
                        <input
                            name="brand"
                            placeholder="Marca (Ex: Dell, Asus)"
                            value={formData.brand}
                            onChange={handleChange}
                            className={inputClasses}
                            required
                        />
                        <input
                            name="price"
                            type="number"
                            placeholder="Preço de Venda (R$)"
                            value={formData.price}
                            onChange={handleChange}
                            className={inputClasses}
                            required
                        />
                        <input
                            name="costPrice"
                            type="number"
                            placeholder="Preço de Custo (R$)"
                            value={formData.costPrice}
                            onChange={handleChange}
                            className={inputClasses}
                            required
                        />

                        <select
                            name="department"
                            value={formData.department}
                            onChange={handleChange}
                            className={inputClasses}
                        >
                            <option value="Notebooks" className="bg-slate-900 text-slate-200">Notebooks</option>
                            <option value="Periféricos" className="bg-slate-900 text-slate-200">Periféricos</option>
                            <option value="Hardware" className="bg-slate-900 text-slate-200">Hardware</option>
                        </select>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className={inputClasses}
                        >
                            <option value="Gamer" className="bg-slate-900 text-slate-200">Gamer</option>
                            <option value="Office" className="bg-slate-900 text-slate-200">Office</option>
                            <option value="Workstation" className="bg-slate-900 text-slate-200">Workstation</option>
                            <option value="Acessórios" className="bg-slate-900 text-slate-200">Acessórios</option>
                        </select>

                        <input
                            name="cpumodel"
                            placeholder="CPU (Ex: i7-12700K)"
                            value={formData.cpumodel}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                        <input
                            name="gpumodel"
                            placeholder="GPU (Ex: RTX 3060)"
                            value={formData.gpumodel}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                        <input
                            name="ram"
                            placeholder="RAM (Ex: 16GB)"
                            value={formData.ram}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                        <input
                            name="storage"
                            placeholder="Armazenamento (Ex: 1TB SSD)"
                            value={formData.storage}
                            onChange={handleChange}
                            className={inputClasses}
                        />

                        <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 items-center">
                            <div className="flex-1 w-full">
                                <input
                                    name="image"
                                    placeholder="URL da Imagem (ou use o upload)"
                                    value={formData.image}
                                    onChange={handleChange}
                                    className={inputClasses}
                                />
                            </div>
                            <div className="relative w-full sm:w-auto">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                    disabled={uploading}
                                />
                                <button
                                    type="button"
                                    className={`w-full sm:w-auto min-w-[140px] px-5 py-3 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 transition-all duration-200 ${
                                        uploading
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20'
                                    }`}
                                >
                                    {uploading ? (
                                        'Enviando...'
                                    ) : (
                                        <>
                                            <Upload size={18} /> Upload
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {formData.image && (
                            <div className="md:col-span-2 bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 text-center">
                                <p className="text-xs font-medium text-slate-400 mb-2">Pré-visualização:</p>
                                <img
                                    src={formData.image}
                                    alt="Preview"
                                    className="max-h-40 mx-auto rounded-lg object-contain shadow-md"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className="md:col-span-2 w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 cursor-pointer active:scale-[0.99]"
                        >
                            {editingProduct ? 'Atualizar Produto' : 'Salvar Produto'}
                        </button>
                    </form>
                </div>
            )}

            {/* Products Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/60 border-b border-slate-800">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Produto</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Marca</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Custo</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Venda</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Lucro Unit.</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {products.map(product => (
                                <tr key={product.id} className="hover:bg-slate-800/40 transition-colors duration-150">
                                    <td className="px-6 py-4 text-sm font-semibold text-slate-200">{product.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-400">{product.brand}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-rose-400">R$ {product.costPrice?.toLocaleString('pt-BR')}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-emerald-400">R$ {product.price?.toLocaleString('pt-BR')}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-cyan-400">R$ {(product.price - (product.costPrice || 0)).toLocaleString('pt-BR')}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(product)}
                                                className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                                title="Editar"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => deleteProduct(product.id)}
                                                className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                title="Excluir"
                                            >
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
        </div>
    );
};

export default ProductManager;
