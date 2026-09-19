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
    Package,
    FileCode2,
    FileText,
    ScanLine,
    Search,
    FileCheck2,
    Plus,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { readDanfeDocument } from '../../utils/danfeOcr';

const formatAccountingValue = (value: string | number) => value === '' || value === null || value === undefined
    ? ''
    : Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const accountingValueFromInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits ? Number(digits) / 100 : '';
};

const CreateProduct = () => {
    const { addProduct, tenant } = useData();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Form, 2: Preview
    const [uploading, setUploading] = useState(false);
    const [invoiceKey, setInvoiceKey] = useState('');
    const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
    const [invoiceSupplier, setInvoiceSupplier] = useState('');
    const [invoiceSupplierDetails, setInvoiceSupplierDetails] = useState<any>(null);
    const [readingInvoice, setReadingInvoice] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrStatus, setOcrStatus] = useState('');
    const [invoiceReadMessage, setInvoiceReadMessage] = useState('');
    const [invoiceRawText, setInvoiceRawText] = useState('');
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
        storage: '',
        ncm: '', cest: '', cfop: '', unit: 'UN', origin: '', icmsCst: '', csosn: '', icmsRate: '',
        ipiCst: '', ipiRate: '', pisCst: '', pisRate: '', cofinsCst: '', cofinsRate: '',
        ibsCbsCst: '', taxClassification: '', ibsRate: '', cbsRate: '', benefitCode: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAccountingChange = (field: 'costPrice' | 'price' | 'promoPrice', value: string) => {
        const amount = accountingValueFromInput(value);
        setFormData(current => ({ ...current, [field]: amount === '' ? '' : String(amount) }));
    };

    const updateInvoiceAccountingValue = (index: number, field: 'costPrice' | 'price', value: string) => {
        const amount = accountingValueFromInput(value);
        setInvoiceItems(items => items.map((candidate, itemIndex) => itemIndex === index
            ? { ...candidate, [field]: amount === '' ? '' : amount }
            : candidate));
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

    const getXmlText = (parent: Element | Document | null | undefined, tag: string) => {
        if (!parent) return '';
        const namespaced = parent.getElementsByTagNameNS?.('*', tag)?.[0];
        return (namespaced || parent.getElementsByTagName(tag)[0])?.textContent?.trim() || '';
    };

    const getXmlElement = (parent: Element | Document | null | undefined, tag: string) => {
        if (!parent) return null;
        return (parent.getElementsByTagNameNS?.('*', tag)?.[0] || parent.getElementsByTagName(tag)[0]) as Element | null;
    };

    const getXmlNumber = (parent: Element | Document | null | undefined, tag: string) => {
        if (!parent) return undefined;
        const raw = getXmlText(parent, tag).replace(',', '.');
        return raw === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw);
    };

    const applyInvoiceData = (data: any) => {
        setInvoiceKey(data.key || '');
        setInvoiceSupplier(data.supplierDetails?.name || data.supplier || 'Fornecedor não identificado');
        setInvoiceSupplierDetails(data.supplierDetails || null);
        setInvoiceItems((data.items || []).map((item: any) => ({ ...item, selected: item.selected !== false })));
        showToast.success(`${data.items?.length || 0} produto(s) encontrado(s). Confira antes de importar.`);
    };

    const parseNfeXml = (xmlText: string) => {
        const document = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (document.querySelector('parsererror')) throw new Error('O arquivo XML está inválido.');
        const infNfe = Array.from(document.getElementsByTagNameNS('*', 'infNFe'))[0] || document.getElementsByTagName('infNFe')[0];
        const key = String(infNfe?.getAttribute('Id') || '').replace(/^NFe/i, '').replace(/\D/g, '');
        const issuer = Array.from(document.getElementsByTagNameNS('*', 'emit'))[0] || document.getElementsByTagName('emit')[0];
        const supplier = issuer ? getXmlText(issuer, 'xNome') : '';
        const issuerAddress = issuer && (Array.from(issuer.getElementsByTagNameNS('*', 'enderEmit'))[0] || issuer.getElementsByTagName('enderEmit')[0]);
        const supplierDetails = {
            name: supplier || (issuer ? getXmlText(issuer, 'xFant') : '') || 'Fornecedor não identificado',
            cnpj: issuer ? (getXmlText(issuer, 'CNPJ') || getXmlText(issuer, 'CPF')) : '',
            phone: issuer ? getXmlText(issuer, 'fone') : '',
            email: issuer ? getXmlText(issuer, 'email') : '',
            address: issuerAddress ? [
                getXmlText(issuerAddress, 'xLgr'), getXmlText(issuerAddress, 'nro'),
                getXmlText(issuerAddress, 'xBairro'), getXmlText(issuerAddress, 'xMun'),
                getXmlText(issuerAddress, 'UF'), getXmlText(issuerAddress, 'CEP'),
            ].filter(Boolean).join(', ') : '',
            category: 'Fornecedor de produtos',
        };
        const details = Array.from(document.getElementsByTagNameNS('*', 'det')).length
            ? Array.from(document.getElementsByTagNameNS('*', 'det'))
            : Array.from(document.getElementsByTagName('det'));
        const items = details.map((detail: Element, index: number) => {
            const product = getXmlElement(detail, 'prod')!;
            const taxes = getXmlElement(detail, 'imposto');
            const icms = getXmlElement(taxes, 'ICMS');
            const icmsDetail = Array.from(icms?.children || [])[0] as Element | undefined;
            const ipi = getXmlElement(taxes, 'IPI');
            const ipiDetail = getXmlElement(ipi, 'IPITrib') || getXmlElement(ipi, 'IPINT');
            const pis = getXmlElement(taxes, 'PIS');
            const pisDetail = Array.from(pis?.children || [])[0] as Element | undefined;
            const cofins = getXmlElement(taxes, 'COFINS');
            const cofinsDetail = Array.from(cofins?.children || [])[0] as Element | undefined;
            const ibsCbs = getXmlElement(taxes, 'IBSCBS');
            const ibsCbsDetail = getXmlElement(ibsCbs, 'gIBSCBS');
            const quantity = Number(getXmlText(product, 'qCom').replace(',', '.')) || 1;
            const costPrice = Number(getXmlText(product, 'vUnCom').replace(',', '.')) || 0;
            return {
                id: `${key || Date.now()}-${index + 1}`,
                name: getXmlText(product, 'xProd') || `Produto ${index + 1}`,
                barcode: getXmlText(product, 'cEAN') === 'SEM GTIN' ? '' : getXmlText(product, 'cEAN'),
                sku: getXmlText(product, 'cProd'),
                ncm: getXmlText(product, 'NCM'),
                cest: getXmlText(product, 'CEST'),
                cfop: getXmlText(product, 'CFOP'),
                unit: getXmlText(product, 'uCom') || 'UN',
                taxableUnit: getXmlText(product, 'uTrib') || getXmlText(product, 'uCom') || 'UN',
                stock: quantity,
                costPrice,
                price: Number((costPrice * 1.3).toFixed(2)),
                category: 'Office', department: 'Hardware', brand: '',
                fiscal: {
                    origin: getXmlText(icmsDetail!, 'orig'),
                    icmsCst: getXmlText(icmsDetail!, 'CST'),
                    csosn: getXmlText(icmsDetail!, 'CSOSN'),
                    icmsBaseMode: getXmlText(icmsDetail!, 'modBC'),
                    icmsBase: getXmlNumber(icmsDetail, 'vBC'),
                    icmsRate: getXmlNumber(icmsDetail, 'pICMS'),
                    icmsValue: getXmlNumber(icmsDetail, 'vICMS'),
                    icmsStBase: getXmlNumber(icmsDetail, 'vBCST'),
                    icmsStRate: getXmlNumber(icmsDetail, 'pICMSST'),
                    icmsStValue: getXmlNumber(icmsDetail, 'vICMSST'),
                    ipiCst: getXmlText(ipiDetail!, 'CST'),
                    ipiLegalCode: getXmlText(ipi!, 'cEnq'),
                    ipiRate: getXmlNumber(ipiDetail, 'pIPI'),
                    ipiValue: getXmlNumber(ipiDetail, 'vIPI'),
                    pisCst: getXmlText(pisDetail!, 'CST'),
                    pisRate: getXmlNumber(pisDetail, 'pPIS'),
                    pisValue: getXmlNumber(pisDetail, 'vPIS'),
                    cofinsCst: getXmlText(cofinsDetail!, 'CST'),
                    cofinsRate: getXmlNumber(cofinsDetail, 'pCOFINS'),
                    cofinsValue: getXmlNumber(cofinsDetail, 'vCOFINS'),
                    ibsCbsCst: getXmlText(ibsCbs!, 'CST'),
                    taxClassification: getXmlText(ibsCbs!, 'cClassTrib'),
                    ibsCbsBase: getXmlNumber(ibsCbsDetail, 'vBC'),
                    ibsRate: getXmlNumber(ibsCbsDetail, 'pIBSUF'),
                    ibsValue: getXmlNumber(ibsCbsDetail, 'vIBS'),
                    cbsRate: getXmlNumber(ibsCbsDetail, 'pCBS'),
                    cbsValue: getXmlNumber(ibsCbsDetail, 'vCBS'),
                    benefitCode: getXmlText(icmsDetail!, 'cBenef'),
                },
            };
        });
        if (!items.length) throw new Error('Nenhum produto foi localizado nesse XML de NF-e.');
        return { key, supplier, supplierDetails, items };
    };

    const storeInvoiceSummary = async (data: any) => {
        if (!tenant?.storeSlug || !data.key) return;
        const token = (() => { try { return JSON.parse(localStorage.getItem('gtec-session') || '{}')?.token || ''; } catch { return ''; } })();
        const requestHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
        await fetch(`/api/store/${tenant.storeSlug}/purchase_invoices`, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({ id: data.key, key: data.key, supplier: data.supplier, supplierDetails: data.supplierDetails, items: data.items, importedAt: new Date().toISOString() }),
        });

        if (data.supplierDetails?.name && data.supplierDetails.name !== 'Fornecedor não identificado') {
            const suppliersResponse = await fetch(`/api/store/${tenant.storeSlug}/suppliers`, { headers: requestHeaders });
            const suppliers = suppliersResponse.ok ? await suppliersResponse.json() : [];
            const documentDigits = String(data.supplierDetails.cnpj || '').replace(/\D/g, '');
            const existing = suppliers.find((supplierRecord: any) => documentDigits
                ? String(supplierRecord.cnpj || '').replace(/\D/g, '') === documentDigits
                : String(supplierRecord.name || '').trim().toLowerCase() === String(data.supplierDetails.name).trim().toLowerCase());
            const filledDetails = Object.fromEntries(Object.entries(data.supplierDetails).filter(([, value]) => Boolean(value)));
            await fetch(`/api/store/${tenant.storeSlug}/suppliers`, {
                method: 'POST',
                headers: requestHeaders,
                body: JSON.stringify({
                    ...(existing || {}), ...filledDetails,
                    id: existing?.id || crypto.randomUUID(),
                    notes: existing?.notes || `Cadastrado automaticamente pela NF-e ${data.key}.`,
                    updatedAt: new Date().toISOString(),
                }),
            });
        }
    };

    const handleNfeXml = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || file.size > 5_000_000) return showToast.error('Selecione um XML de até 5 MB.');
        setReadingInvoice(true);
        try {
            const data = parseNfeXml(await file.text());
            applyInvoiceData(data);
            await storeInvoiceSummary(data);
        } catch (error: any) { showToast.error(error.message || 'Não foi possível ler a NF-e.'); }
        finally { setReadingInvoice(false); event.target.value = ''; }
    };

    const lookupInvoiceKey = async (rawKey = invoiceKey) => {
        const key = String(rawKey).replace(/\D/g, '');
        if (key.length !== 44) return showToast.error('A chave da NF-e deve ter 44 números.');
        setReadingInvoice(true);
        try {
            const token = (() => { try { return JSON.parse(localStorage.getItem('gtec-session') || '{}')?.token || ''; } catch { return ''; } })();
            const response = await fetch(`/api/store/${tenant.storeSlug}/purchase-invoices/lookup/${key}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Não foi possível consultar a chave.');
            if (data.items?.length) {
                applyInvoiceData(data);
                await storeInvoiceSummary(data);
                return;
            }
            if (data.xml) {
                const parsed = parseNfeXml(data.xml);
                applyInvoiceData(parsed);
                await storeInvoiceSummary(parsed);
                return;
            }
            setInvoiceKey(key);
            setInvoiceSupplier(data.supplierDetails?.name || data.supplier || 'Fornecedor não identificado');
            setInvoiceSupplierDetails(data.supplierDetails || null);
            setInvoiceItems([{
                id: `${key}-manual-1`, name: '', barcode: '', sku: '', ncm: '', cfop: '', unit: 'UN',
                stock: 1, costPrice: 0, price: 0, category: 'Office', department: 'Hardware', brand: '', fiscal: {}, selected: true,
            }]);
            showToast.success('Chave válida. Complete os itens da nota para incluir no estoque.');
            if (data.message) showToast.info(data.message);
        } catch (error: any) { showToast.error(error.message || 'Não foi possível consultar a chave.'); }
        finally { setReadingInvoice(false); }
    };

    const scanInvoiceDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = event.target.files?.[0];
        if (!file || readingInvoice) return;
        if (file.size > 20_000_000) {
            event.target.value = '';
            return showToast.error('Selecione uma foto ou PDF de até 20 MB.');
        }
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        setReadingInvoice(true);
        setInvoiceReadMessage('');
        setInvoiceRawText('');
        setOcrProgress(0);
        setOcrStatus(isPdf ? 'Abrindo o PDF...' : 'Preparando a imagem...');
        try {
            const Detector = (window as any).BarcodeDetector;
            let scannedKey = '';
            if (Detector && !isPdf) {
                try {
                    const requestedFormats = ['qr_code', 'code_128'];
                    const supportedFormats = typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : requestedFormats;
                    const formats = requestedFormats.filter(format => supportedFormats.includes(format));
                    if (formats.length) {
                        const bitmap = await createImageBitmap(file);
                        const codes = await new Detector({ formats }).detect(bitmap);
                        bitmap.close?.();
                        scannedKey = codes.map((code: any) => String(code.rawValue || '').trim()).reduce((found: string, content: string) => {
                            if (found) return found;
                            const urlKey = content.match(/(?:chNFe|p)=?(\d{44})/i)?.[1];
                            const directKey = /^\d{44}$/.test(content.replace(/\s/g, '')) ? content.replace(/\s/g, '') : '';
                            const embeddedKey = content.match(/(?:^|\D)(\d{44})(?:\D|$)/)?.[1];
                            return urlKey || directKey || embeddedKey || '';
                        }, '');
                    }
                } catch { /* O OCR completo continua mesmo quando o leitor de código não reconhece. */ }
            }

            const recognized = await readDanfeDocument(file, (progress, status) => {
                setOcrProgress(Math.round(progress * 100));
                if (status) setOcrStatus(status);
            });
            const key = scannedKey || recognized.key;
            setInvoiceRawText(recognized.rawText || '');
            if (recognized.items.length) {
                const data = { ...recognized, key, supplier: recognized.supplierDetails?.name || recognized.supplier };
                applyInvoiceData(data);
                const message = recognized.method === 'text'
                    ? `${recognized.items.length} produto(s) identificado(s) pelo texto do PDF. Confira descrição, quantidade e custo antes de cadastrar.`
                    : `${recognized.items.length} produto(s) identificado(s) por OCR (${Math.round(recognized.confidence)}% de confiança no texto). Confira todos os campos.`;
                setInvoiceReadMessage(message + ' O custo é o valor unitário da tabela, sem ratear descontos/frete da nota.');
                showToast.info(message);
            } else {
                setInvoiceKey(key);
                setInvoiceSupplier(recognized.supplier);
                setInvoiceSupplierDetails(recognized.supplierDetails);
                setInvoiceItems([{ id: 'manual-document-1', name: '', sku: '', barcode: '', ncm: '', cest: '', cfop: '', unit: 'UN', stock: 1, costPrice: 0, price: 0, category: 'Office', department: 'Hardware', brand: '', fiscal: {}, selected: false }]);
                setInvoiceReadMessage('Não foi possível reconhecer os produtos com segurança. Nenhum produto foi cadastrado. Confira o texto lido abaixo e preencha a tabela manualmente, ou envie um PDF/foto mais nítido.');
            }
        } catch (error: any) {
            const message = String(error?.message || error || 'Não foi possível ler a nota fiscal.');
            setInvoiceReadMessage(message);
            showToast.error(message);
        }
        finally { setReadingInvoice(false); setOcrProgress(0); setOcrStatus(''); input.value = ''; }
    };

    const importInvoiceProducts = async () => {
        const selected = invoiceItems.filter(item => item.selected);
        if (!selected.length) return showToast.error('Selecione pelo menos um produto.');
        if (selected.some(item => !String(item.name || '').trim())) return showToast.error('Informe o nome de todos os produtos selecionados.');
        setReadingInvoice(true);
        try {
            for (const item of selected) {
                await addProduct({
                    id: crypto.randomUUID(), name: item.name, price: Number(item.price), costPrice: Number(item.costPrice),
                    stock: Number(item.stock), quantity: Number(item.stock), barcode: item.barcode, sku: item.sku,
                    ncm: item.ncm, cest: item.cest, cfop: item.cfop, unit: item.unit, taxableUnit: item.taxableUnit,
                    fiscal: item.fiscal || {}, category: item.category, department: item.department,
                    brand: item.brand, image: '', images: [], invoiceKey, supplier: invoiceSupplier,
                });
            }
            await storeInvoiceSummary({
                key: invoiceKey,
                supplier: invoiceSupplier,
                supplierDetails: invoiceSupplierDetails || { name: invoiceSupplier },
                items: selected.map(item => Object.fromEntries(Object.entries(item).filter(([field]) => field !== 'selected'))),
            });
            showToast.success(`${selected.length} produto(s) incluído(s) no estoque.`);
            setInvoiceItems([]);
        } catch { showToast.error('Não foi possível concluir toda a importação. Confira o estoque.'); }
        finally { setReadingInvoice(false); }
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
            ncm: formData.ncm.replace(/\D/g, ''), cest: formData.cest.replace(/\D/g, ''),
            cfop: formData.cfop.replace(/\D/g, ''), unit: formData.unit.trim().toUpperCase() || 'UN',
            fiscal: {
                origin: formData.origin, icmsCst: formData.icmsCst, csosn: formData.csosn,
                icmsRate: formData.icmsRate === '' ? undefined : Number(formData.icmsRate),
                ipiCst: formData.ipiCst, ipiRate: formData.ipiRate === '' ? undefined : Number(formData.ipiRate),
                pisCst: formData.pisCst, pisRate: formData.pisRate === '' ? undefined : Number(formData.pisRate),
                cofinsCst: formData.cofinsCst, cofinsRate: formData.cofinsRate === '' ? undefined : Number(formData.cofinsRate),
                ibsCbsCst: formData.ibsCbsCst, taxClassification: formData.taxClassification,
                ibsRate: formData.ibsRate === '' ? undefined : Number(formData.ibsRate),
                cbsRate: formData.cbsRate === '' ? undefined : Number(formData.cbsRate), benefitCode: formData.benefitCode,
            },
            specs: {
                cpu: formData.cpumodel,
                gpu: formData.gpumodel,
                ram: formData.ram,
                storage: formData.storage
            }
        };

        addProduct(productData);
        showToast.success('Anúncio publicado com sucesso! 🚀');
        navigate('/admin/cadastros?tipo=produtos');
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

                <section className="bg-slate-900/70 border border-cyan-500/20 rounded-3xl p-6 shadow-xl space-y-5">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400"><FileCode2 size={22} /></div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Entrada por Nota Fiscal</h2>
                            <p className="text-sm text-slate-400">Leia os itens da NF-e e confira custo, preço de venda e quantidade antes de incluir no estoque.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        <label className="relative flex items-center justify-center gap-2 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer transition-colors">
                            <FileCode2 size={18} /> Importar XML
                            <input type="file" accept=".xml,text/xml,application/xml" onChange={handleNfeXml} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </label>
                        <label className="relative flex items-center justify-center gap-2 p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold cursor-pointer transition-colors">
                            <ScanLine size={18} /> Escanear DANFE (foto)
                            <input type="file" accept="image/*" capture="environment" onChange={scanInvoiceDocument} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </label>
                        <label className="relative flex items-center justify-center gap-2 p-4 rounded-xl bg-violet-700 hover:bg-violet-600 text-white font-semibold cursor-pointer transition-colors">
                            <FileText size={18} /> Enviar PDF da nota
                            <input type="file" accept=".pdf,application/pdf" onChange={scanInvoiceDocument} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </label>
                        <div className="flex gap-2">
                            <input value={invoiceKey} onChange={e => setInvoiceKey(e.target.value.replace(/\D/g, '').slice(0, 44))} placeholder="Chave da NF-e (44 números)" className="min-w-0 flex-1 bg-slate-950/70 border border-slate-700 rounded-xl px-3 text-sm text-slate-100" />
                            <button type="button" onClick={() => lookupInvoiceKey()} className="p-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white" title="Consultar NF-e pela chave"><Search size={18} /></button>
                        </div>
                    </div>

                    {readingInvoice && <div className="space-y-2"><div className="flex items-center gap-2 text-sm text-cyan-300"><Loader2 size={16} className="animate-spin" /> {ocrStatus || 'Lendo e validando a nota fiscal...'}{ocrProgress > 0 ? ` ${ocrProgress}%` : ''}</div>{ocrProgress > 0 && <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-500 transition-all" style={{ width: `${ocrProgress}%` }} /></div>}</div>}
                    {invoiceReadMessage && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{invoiceReadMessage}</p>}
                    {invoiceRawText && <details className="text-sm text-slate-400"><summary className="cursor-pointer">Conferir texto extraído da nota</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-xs">{invoiceRawText}</pre></details>}

                    {invoiceItems.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-slate-300"><strong className="text-white">Fornecedor:</strong> {invoiceSupplier}</span>
                                <span className="text-slate-400">NF-e: {invoiceKey || 'sem chave identificada'}</span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-800">
                                <table className="w-full min-w-[850px] text-sm">
                                    <thead className="bg-slate-950/80 text-slate-400"><tr><th className="p-3 text-left">Usar</th><th className="p-3 text-left">Produto</th><th className="p-3">Qtd.</th><th className="p-3">Custo</th><th className="p-3">Venda</th><th className="p-3 text-left">Dados fiscais</th><th className="p-3"></th></tr></thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {invoiceItems.map((item, index) => (
                                            <tr key={item.id} className="bg-slate-900/50">
                                                <td className="p-3"><input type="checkbox" checked={item.selected} onChange={e => setInvoiceItems(items => items.map((candidate, i) => i === index ? { ...candidate, selected: e.target.checked } : candidate))} /></td>
                                                <td className="p-3"><input value={item.name} onChange={e => setInvoiceItems(items => items.map((candidate, i) => i === index ? { ...candidate, name: e.target.value } : candidate))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100" />{item.needsReview && <p className="mt-1 text-xs text-amber-300">Valores divergentes: confira quantidade e custo antes de selecionar.</p>}</td>
                                                <td className="p-3"><input type="number" min="0" step="0.001" value={item.stock} onChange={e => setInvoiceItems(items => items.map((candidate, i) => i === index ? { ...candidate, stock: e.target.value } : candidate))} className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-right" /></td>
                                                <td className="p-3"><div className="flex w-32 items-center rounded-lg border border-slate-700 bg-slate-950 px-2"><span className="text-xs font-semibold text-slate-500">R$</span><input type="text" inputMode="numeric" value={formatAccountingValue(item.costPrice)} onChange={e => updateInvoiceAccountingValue(index, 'costPrice', e.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-right tabular-nums text-slate-100 outline-none" placeholder="0,00" /></div></td>
                                                <td className="p-3"><div className="flex w-32 items-center rounded-lg border border-cyan-700 bg-slate-950 px-2"><span className="text-xs font-semibold text-cyan-500">R$</span><input type="text" inputMode="numeric" value={formatAccountingValue(item.price)} onChange={e => updateInvoiceAccountingValue(index, 'price', e.target.value)} className="min-w-0 flex-1 bg-transparent py-2 text-right tabular-nums text-slate-100 outline-none" placeholder="0,00" /></div></td>
                                                <td className="p-3 text-xs text-slate-400 min-w-56">
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <input value={item.ncm || ''} maxLength={8} placeholder="NCM" onChange={e => setInvoiceItems(items => items.map((candidate, i) => i === index ? { ...candidate, ncm: e.target.value.replace(/\D/g, '') } : candidate))} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5" />
                                                        <input value={item.cfop || ''} maxLength={4} placeholder="CFOP" onChange={e => setInvoiceItems(items => items.map((candidate, i) => i === index ? { ...candidate, cfop: e.target.value.replace(/\D/g, '') } : candidate))} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5" />
                                                    </div>
                                                    <div className="mt-1.5">{item.barcode || item.sku || 'Sem código'} · {item.fiscal?.csosn ? `CSOSN ${item.fiscal.csosn}` : `CST ${item.fiscal?.icmsCst || '-'}`}</div>
                                                    <details className="mt-2">
                                                        <summary className="cursor-pointer text-cyan-400">Conferir tributos</summary>
                                                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                            {[
                                                                ['origin', 'Origem'], ['icmsCst', 'CST ICMS'], ['csosn', 'CSOSN'], ['icmsRate', 'ICMS %'],
                                                                ['ipiCst', 'CST IPI'], ['ipiRate', 'IPI %'], ['pisCst', 'CST PIS'], ['pisRate', 'PIS %'],
                                                                ['cofinsCst', 'CST COFINS'], ['cofinsRate', 'COFINS %'], ['ibsCbsCst', 'CST IBS/CBS'], ['taxClassification', 'Class. trib.'],
                                                                ['ibsRate', 'IBS %'], ['cbsRate', 'CBS %'],
                                                            ].map(([field, placeholder]) => <input key={field} value={item.fiscal?.[field] ?? ''} placeholder={placeholder} onChange={e => setInvoiceItems(items => items.map((candidate, i) => i === index ? { ...candidate, fiscal: { ...(candidate.fiscal || {}), [field]: e.target.value } } : candidate))} className="min-w-0 bg-slate-950 border border-slate-700 rounded px-2 py-1.5" />)}
                                                        </div>
                                                    </details>
                                                </td>
                                                <td className="p-3"><button type="button" onClick={() => setInvoiceItems(items => items.filter((_, i) => i !== index))} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" title="Remover item"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap justify-end gap-3">
                                <button type="button" onClick={() => setInvoiceItems(items => [...items, { id: `${invoiceKey || Date.now()}-manual-${items.length + 1}`, name: '', barcode: '', sku: '', ncm: '', cest: '', cfop: '', unit: 'UN', stock: 1, costPrice: 0, price: 0, category: 'Office', department: 'Hardware', brand: '', fiscal: {}, selected: true }])} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold"><Plus size={18} /> Adicionar item</button>
                                <button type="button" onClick={importInvoiceProducts} disabled={readingInvoice} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold"><FileCheck2 size={18} /> Incluir selecionados no estoque</button>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-slate-500">A foto ou o PDF (até 10 páginas e 20 MB) é processado localmente no navegador: nenhum conteúdo da nota é enviado a serviços de OCR externos. O sistema tenta ler fornecedor, chave e produtos; confira os resultados antes de cadastrar. Com certificado A1, a chave também pode recuperar o XML oficial.</p>
                </section>

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
                                    <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/70 px-4 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/50">
                                        <span className="font-semibold text-slate-500">R$</span>
                                        <input name="costPrice" type="text" inputMode="numeric" value={formatAccountingValue(formData.costPrice)} onChange={e => handleAccountingChange('costPrice', e.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-right text-slate-100 tabular-nums outline-none" required placeholder="0,00" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                        Preço de Venda (R$) *
                                    </label>
                                    <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/70 px-4 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/50">
                                        <span className="font-semibold text-slate-500">R$</span>
                                        <input name="price" type="text" inputMode="numeric" value={formatAccountingValue(formData.price)} onChange={e => handleAccountingChange('price', e.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-right text-slate-100 tabular-nums outline-none" required placeholder="0,00" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Fiscal */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400"><FileCheck2 size={18} /></div>
                                <div><h3 className="text-base font-semibold text-slate-200">3. Dados fiscais</h3><p className="text-xs text-slate-500">Serão reutilizados na emissão fiscal. Confirme as regras com a contabilidade.</p></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    ['ncm', 'NCM (8 números)', 8], ['cest', 'CEST', 7], ['cfop', 'CFOP', 4], ['unit', 'Unidade (UN)', 6],
                                    ['origin', 'Origem ICMS', 1], ['icmsCst', 'CST ICMS', 3], ['csosn', 'CSOSN', 3], ['icmsRate', 'ICMS %', 8],
                                    ['ipiCst', 'CST IPI', 2], ['ipiRate', 'IPI %', 8], ['pisCst', 'CST PIS', 2], ['pisRate', 'PIS %', 8],
                                    ['cofinsCst', 'CST COFINS', 2], ['cofinsRate', 'COFINS %', 8], ['ibsCbsCst', 'CST IBS/CBS', 3], ['taxClassification', 'Classificação tributária', 6],
                                    ['ibsRate', 'IBS %', 8], ['cbsRate', 'CBS %', 8], ['benefitCode', 'Código benefício fiscal', 12],
                                ].map(([field, placeholder, maxLength]) => <input key={field as string} name={field as string} value={(formData as any)[field as string]} onChange={handleChange} maxLength={maxLength as number} placeholder={placeholder as string} className={`w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-3 text-slate-100 placeholder-slate-500 text-sm outline-none focus:border-cyan-500 ${(field === 'benefitCode') ? 'col-span-2' : ''}`} />)}
                            </div>
                        </div>

                        {/* Section 4: Tech Specs */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <Cpu size={18} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-200">4. Especificações Técnicas</h3>
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

                        {/* Section 5: Media */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800/80">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                    <ImageIcon size={18} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-200">5. Mídia</h3>
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
