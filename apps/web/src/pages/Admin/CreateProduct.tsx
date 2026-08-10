import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import { showToast } from '../../utils/toast';
import { 
    ArrowLeft, 
    Upload, 
    Eye, 
    Check, 
    Cpu, 
    HardDrive, 
    Zap, 
    ShoppingCart,
    Tag,
    DollarSign,
    Layers,
    Image as ImageIcon,
    Sparkles,
    Loader2,
    Package
} from 'lucide-react';
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
        promoPrice: '',
        category: 'Gamer',
        department: 'Notebooks',
        brand: '',
        image: '',
        images: [] as string[],
        cpumodel: '',
        gpumodel: '',
        ram: '',
        storage: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
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
            <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header Actions */}
                    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                <Eye size={22} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    Preview do Anúncio
                                </h2>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wide uppercase">
                                    Modo Rascunho
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white font-medium text-sm transition-all duration-200"
                            >
                                <ArrowLeft size={18} /> Voltar e Editar
                            </button>
                            <button
                                onClick={handlePublish}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Check size={18} /> Publicar Agora
                            </button>
                        </div>
                    </div>

                    {/* Simulated Product Page */}
                    <div className="bg-slate-900/60 backdrop-blur-xl border border-dashed border-indigo-500/40 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                            {/* Image Showcase */}
                            <div className="lg:col-span-6 space-y-4">
                                <div className="aspect-square w-full rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl group relative">
                                    <img
                                        src={formData.image || 'https://via.placeholder.com/500'}
                                        alt="Preview"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {!formData.image && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                                            <ImageIcon size={48} />
                                            <span className="text-sm">Nenhuma imagem carregada</span>
                                        </div>
                                    )}
                                </div>
                                {formData.images.length > 0 && (
                                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                                        {formData.images.map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img}
                                                alt={`Galeria ${idx + 1}`}
                                                className="w-20 h-20 rounded-xl object-cover border border-slate-800 hover:border-indigo-500 transition-colors flex-shrink-0"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                                            formData.category === 'Gamer'
                                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                                        }`}>
                                            {formData.category}
                                        </span>
                                        {formData.department && (
                                            <span className="text-xs text-slate-400 font-medium px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60">
                                                {formData.department}
                                            </span>
                                        )}
                                    </div>

                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                                        {formData.name || 'Nome do Produto'}
                                    </h1>

                                    <p className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                        {formData.brand && <span>Marca: <strong className="text-slate-200">{formData.brand}</strong></span>}
                                    </p>

                                    {/* Specifications Card */}
                                    <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 space-y-3">
                                        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <Sparkles size={16} className="text-indigo-400" /> Especificações Técnicas
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <SpecItem icon={Cpu} label="Processador" value={formData.cpumodel} />
                                            <SpecItem icon={Zap} label="Placa de Vídeo" value={formData.gpumodel} />
                                            <SpecItem icon={HardDrive} label="Memória RAM" value={formData.ram} />
                                            <SpecItem icon={Layers} label="Armazenamento" value={formData.storage} />
                                        </div>
                                    </div>
                                </div>

                                {/* Pricing & Action */}
                                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                                    <div>
                                        <span className="text-xs font-medium text-slate-400 block mb-1">Preço à vista</span>
                                        {formData.promoPrice ? (
                                            <div className="flex items-baseline gap-3 flex-wrap">
                                                <span className="text-lg text-slate-500 line-through font-medium">
                                                    R$ {Number(formData.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                                                    R$ {Number(formData.promoPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                                                R$ {formData.price ? Number(formData.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        disabled
                                        className="w-full py-4 px-6 rounded-xl bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 font-semibold flex items-center justify-center gap-2 cursor-not-allowed opacity-75"
                                    >
                                        <ShoppingCart size={20} /> Adicionar ao Carrinho (Modo Preview)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- FORM STEP ---
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
                            <Package size={14} /> Cadastrar Produto
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
                            Criar Novo Anúncio
                        </h1>
                    </div>
                    <div className="text-xs font-medium text-slate-400 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl self-start sm:self-auto">
                        Passo <span className="text-indigo-400 font-bold">1</span> de 2
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-16 -mr-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-8 relative z-10">

                        {/* Section 1: Basic Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Tag size={18} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-200">1. Informações Básicas</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Título do Anúncio *
                                    </label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                        required
                                        placeholder="Ex: Notebook Gamer G-Pro i7 16GB RTX 4060..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Marca *
                                    </label>
                                    <input
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                        required
                                        placeholder="Ex: Dell, Lenovo, Asus..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Departamento
                                    </label>
                                    <select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 cursor-pointer"
                                    >
                                        <option value="Notebooks" className="bg-slate-900 text-slate-100">Notebooks</option>
                                        <option value="Periféricos" className="bg-slate-900 text-slate-100">Periféricos</option>
                                        <option value="Hardware" className="bg-slate-900 text-slate-100">Hardware</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Categoria
                                    </label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 cursor-pointer"
                                    >
                                        <option value="Gamer" className="bg-slate-900 text-slate-100">Gamer</option>
                                        <option value="Office" className="bg-slate-900 text-slate-100">Office</option>
                                        <option value="Workstation" className="bg-slate-900 text-slate-100">Workstation</option>
                                        <option value="Acessórios" className="bg-slate-900 text-slate-100">Acessórios</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Pricing */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <DollarSign size={18} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-200">2. Preços</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Preço de Custo (R$) *
                                    </label>
                                    <input
                                        name="costPrice"
                                        type="number"
                                        value={formData.costPrice}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                        required
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Preço de Venda (R$) *
                                    </label>
                                    <input
                                        name="price"
                                        type="number"
                                        value={formData.price}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                        required
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Tech Specs */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Cpu size={18} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-200">3. Especificações Técnicas</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input
                                    name="cpumodel"
                                    placeholder="Processador (CPU) ex: Intel Core i7-13700H"
                                    value={formData.cpumodel}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                />
                                <input
                                    name="gpumodel"
                                    placeholder="Placa de Vídeo (GPU) ex: NVIDIA RTX 4060 8GB"
                                    value={formData.gpumodel}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                />
                                <input
                                    name="ram"
                                    placeholder="Memória RAM ex: 16GB DDR5 4800MHz"
                                    value={formData.ram}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                />
                                <input
                                    name="storage"
                                    placeholder="Armazenamento ex: SSD NVMe 1TB"
                                    value={formData.storage}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                />
                            </div>
                        </div>

                        {/* Section 4: Media */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <ImageIcon size={18} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-200">4. Mídia</h3>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                                <div className="flex-1">
                                    <input
                                        name="image"
                                        placeholder="Cole a URL da imagem principal..."
                                        value={formData.image}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        disabled={uploading}
                                    />
                                    <button
                                        type="button"
                                        disabled={uploading}
                                        className={`w-full sm:w-auto px-5 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                                            uploading
                                                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                        }`}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" /> Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={18} /> Simular Upload
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {formData.image && (
                                <div className="pt-2">
                                    <span className="text-xs text-slate-400 block mb-2 font-medium">Pré-visualização rápida:</span>
                                    <div className="w-24 h-24 rounded-xl border border-slate-800 overflow-hidden bg-slate-950 relative group">
                                        <img src={formData.image} alt="Preview thumbnail" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="pt-6 border-t border-slate-800/80 flex justify-end">
                            <button
                                type="submit"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Eye size={20} /> Ver Preview do Anúncio
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const SpecItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Icon size={16} />
        </div>
        <div className="overflow-hidden">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">{label}</span>
            <span className="text-xs font-semibold text-slate-200 truncate block">{value || 'N/A'}</span>
        </div>
    </div>
);

export default CreateProduct;
