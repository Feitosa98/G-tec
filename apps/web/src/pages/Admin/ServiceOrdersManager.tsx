import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { 
    Plus, Trash2, Edit, ClipboardList, Printer, CheckCircle, Search, 
    Wrench, ShoppingBag, X, Laptop, Tag, MessageCircle, CreditCard, Copy
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { generateProfessionalPDF } from '../../utils/pdfGenerator';
import { useNotify } from '../../hooks/useNotify';
import { useMercadoPago } from '../../hooks/useMercadoPago';


// Função para gerar o Payload PIX (Copia e Cola e QR Code)
function generatePixPayload(key, name, city, amount, txid = '***') {
    if (!key || !name) return null;
    let rawKey = key.trim();
    let cleanKey = rawKey;
    const isEmail = rawKey.includes('@');
    const numbersOnly = rawKey.replace(/\D/g, '');
    if (!isEmail) {
        if (rawKey.length === 36 && rawKey.includes('-')) {
            cleanKey = rawKey.toLowerCase();
        } else if (numbersOnly.length === 11 && !rawKey.startsWith('+')) {
            cleanKey = numbersOnly;
        } else if (numbersOnly.length === 14) {
            cleanKey = numbersOnly;
        } else if ((numbersOnly.length === 12 || numbersOnly.length === 13) || rawKey.startsWith('+')) {
            cleanKey = numbersOnly.length <= 11 ? `+55${numbersOnly}` : `+${numbersOnly}`;
        } else {
            cleanKey = rawKey.replace(/[^a-zA-Z0-9@.\-_+]/g, '');
        }
    }
    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 25).trim();
    const finalName = cleanName.length > 0 ? cleanName : 'LOJA';
    const cleanCity = (city || 'Manaus').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 15).trim();
    const finalCity = cleanCity.length > 0 ? cleanCity : 'CIDADE';
    const pad = (str, len) => String(str).padStart(len, '0');
    const formatField = (id, value) => `${id}${pad(value.length, 2)}${value}`;
    const gui = formatField('00', 'br.gov.bcb.pix');
    const keyField = formatField('01', cleanKey);
    const merchantAccountInfo = formatField('26', gui + keyField);
    const merchantCategoryCode = formatField('52', '0000');
    const transactionCurrency = formatField('53', '986');
    const amountField = amount ? formatField('54', Number(amount).toFixed(2)) : '';
    const countryCode = formatField('58', 'BR');
    const merchantName = formatField('59', finalName);
    const merchantCity = formatField('60', finalCity);
    const txidField = formatField('05', txid);
    const additionalData = formatField('62', txidField);
    const header = '000201010211';
    let payload = header + merchantAccountInfo + merchantCategoryCode + transactionCurrency + amountField + countryCode + merchantName + merchantCity + additionalData + '6304';
    let polynomial = 0x1021;
    let result = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        result ^= (payload.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if ((result & 0x8000) !== 0) {
                result = (result << 1) ^ polynomial;
            } else {
                result = result << 1;
            }
            result &= 0xFFFF;
        }
    }
    const crc = result.toString(16).toUpperCase().padStart(4, '0');
    return payload + crc;
}

const calculateItemsTotal = (items: any[] = []) => items.reduce(
    (total, item) => total + (Number(item.price) || 0) * (Number(item.qty) || 1),
    0
);

const resolveOrderTotal = (order: any) => {
    const storedTotal = Number(order?.totalValue) || 0;
    const itemsTotal = calculateItemsTotal(order?.items || []);
    return storedTotal > 0 || itemsTotal === 0 ? storedTotal : itemsTotal;
};

const ServiceOrdersManager = () => {
    const { tenant, showConfirm, showAlert, registerSale } = useData();
    const { notify } = useNotify();
    const { generatePaymentLink, copyLinkToClipboard } = useMercadoPago();
    const [mpLinks, setMpLinks] = useState<Record<string, string>>({});

    const handleSendWhatsApp = (order: any) => {
        const phone = order.clientPhone || '';
        const message = `🔧 Olá, ${order.clientName || 'Cliente'}! Sua Ordem de Serviço #${String(order.id || '').slice(0, 8).toUpperCase()} (${order.device || order.orderType || 'Serviço'}) está com status: *${order.status}*.\n\n💰 Valor: R$ ${resolveOrderTotal(order).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nObrigado pela preferência! 😊`;
        notify({ channel: 'whatsapp', to: phone, message });
    };

    const handleMPPayment = async (order: any) => {
        const result = await generatePaymentLink({
            items: [{ title: `O.S. #${String(order.id || '').slice(0, 8).toUpperCase()} - ${order.device || order.orderType || 'Serviço'}`, quantity: 1, unit_price: resolveOrderTotal(order) }],
            payerName: order.clientName,
            externalReference: order.id,
            referenceType: 'service_order',
        });
        if (result.link) {
            setMpLinks(prev => ({ ...prev, [order.id]: result.link! }));
        }
    };

    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [inventory, setInventory] = useState([]); // Combined products and services
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState({
        customerId: '', clientName: '', clientPhone: '', 
        device: '', devicePassword: '', issueDescription: '', technicalReport: '', warranty: '', 
        status: 'Aberta', items: [], manualTotal: '', orderType: 'Manutenção', financeSynced: false
    });

    const [selectedItem, setSelectedItem] = useState('');
    const [itemQty, setItemQty] = useState(1);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };

    const headers = { 'Authorization': `Bearer ${getToken()}` };

    useEffect(() => {
        if (tenant?.storeSlug) {
            fetchData();
        }
    }, [tenant]);

    const fetchData = async () => {
        try {
            const [ordersRes, custRes, prodRes, servRes] = await Promise.all([
                fetch(`/api/store/${tenant.storeSlug}/service_orders`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/customers`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/products`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/services`, { headers })
            ]);

            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (custRes.ok) setCustomers(await custRes.json());
            
            const prods = prodRes.ok ? await prodRes.json() : [];
            const servs = servRes.ok ? await servRes.json() : [];
            
            setInventory([
                ...prods.map(p => ({ ...p, _type: 'Produto', _label: `[Produto] ${p.name} - R$ ${Number(p.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` })),
                ...servs.map(s => ({ ...s, _type: 'Serviço', _label: `[Serviço] ${s.name} - R$ ${Number(s.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` }))
            ]);
            
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const saveOrder = async (orderData) => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/service_orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify(orderData)
            });
            if (res.ok) {
                fetchData();
                return true;
            } else {
                throw new Error('Falha ao salvar');
            }
        } catch (error) {
            console.error(error);
            showToast.error('Erro ao salvar O.S.');
            return false;
        }
    };

    const removeOrder = async (id) => {
        showConfirm('Excluir O.S.', 'Deseja realmente excluir esta O.S.?', async () => {
            try {
                const res = await fetch(`/api/store/${tenant.storeSlug}/service_orders/${id}`, {
                    method: 'DELETE', headers
                });
                if (res.ok) {
                    fetchData();
                    showToast.success('O.S. excluída');
                }
            } catch (error) {
                console.error(error);
                showAlert('Erro', 'Não foi possível excluir a O.S.');
            }
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCustomerChange = (e) => {
        const custId = e.target.value;
        const cust = customers.find(c => c.id === custId);
        if (cust) {
            setFormData({ ...formData, customerId: cust.id, clientName: cust.name, clientPhone: cust.phone || '' });
        } else {
            setFormData({ ...formData, customerId: '', clientName: '', clientPhone: '' });
        }
    };

    const handleAddItem = (e) => {
        e.preventDefault();
        if (!selectedItem) return;
        const item = inventory.find(i => i.id === selectedItem);
        if (item) {
            setFormData({
                ...formData,
                items: [...formData.items, {
                    id: item.id,
                    type: item._type,
                    name: item.name,
                    price: Number(item.price),
                    qty: Number(itemQty)
                }]
            });
            setSelectedItem('');
            setItemQty(1);
        }
    };

    const handleRemoveItem = (index) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const calculatedTotal = calculateItemsTotal(formData.items);
    const manualTotalValue = Number(formData.manualTotal);
    const hasValidManualTotal = formData.manualTotal !== '' && Number.isFinite(manualTotalValue) && manualTotalValue > 0;
    const finalTotal = hasValidManualTotal ? manualTotalValue : calculatedTotal;

    const handleManualTotalChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value === '') {
            setFormData({ ...formData, manualTotal: '' });
            return;
        }
        const floatValue = parseInt(value, 10) / 100;
        if (floatValue <= 0) {
            setFormData({ ...formData, manualTotal: '' });
            return;
        }
        setFormData({ ...formData, manualTotal: String(floatValue) });
    };

    const handleEdit = (order) => {
        setEditingOrder(order);
        setFormData({
            customerId: order.customerId || '',
            clientName: order.clientName || '',
            clientPhone: order.clientPhone || '',
            device: order.device || '',
            devicePassword: order.devicePassword || '',
            issueDescription: order.issueDescription || '',
            technicalReport: order.technicalReport || '',
            warranty: order.warranty || '',
            status: order.status || 'Aberta',
            items: order.items || [],
            manualTotal: Number(order.manualTotal) > 0 ? String(order.manualTotal) : (order.items && order.items.length > 0 ? '' : String(order.totalValue || '')),
            orderType: order.orderType || 'Manutenção',
            financeSynced: order.financeSynced || false
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let newFinanceSynced = formData.financeSynced;
        if (!newFinanceSynced && ['Aprovada', 'Concluída', 'Entregue'].includes(formData.status)) {
            const dueDate = new Date();
            // Send to Receivables
            const saleData = {
                customerName: formData.clientName,
                userEmail: formData.clientName, // Store clientName as fallback
                total: finalTotal,
                paymentTerms: {
                    type: 'terms',
                    installments: 1,
                    firstDueDate: dueDate.toISOString().substring(0, 10)
                },
                items: formData.items,
                status: 'Confirmado',
                osReference: editingOrder ? editingOrder.id : null
            };
            registerSale(saleData, 'Faturamento de O.S.');
            newFinanceSynced = true;
        }

        const orderData = {
            id: editingOrder ? editingOrder.id : crypto.randomUUID(),
            customerId: formData.customerId,
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            device: formData.device,
            devicePassword: formData.devicePassword,
            issueDescription: formData.issueDescription,
            technicalReport: formData.technicalReport,
            warranty: formData.warranty,
            status: formData.status,
            items: formData.items,
            manualTotal: hasValidManualTotal ? manualTotalValue : undefined,
            totalValue: finalTotal,
            orderType: formData.orderType,
            financeSynced: newFinanceSynced,
            createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString()
        };

        const success = await saveOrder(orderData);
        if (success) {
            showToast.success(`Ordem de Serviço ${editingOrder ? 'atualizada' : 'gerada'} com sucesso!`);

            // 🔔 Notificação automática via WhatsApp ao concluir/entregar
            if (['Concluída', 'Concluído', 'Entregue'].includes(orderData.status) && orderData.clientPhone) {
                const msg = `🔧 Olá, ${orderData.clientName || 'Cliente'}! Sua Ordem de Serviço #${String(orderData.id || '').slice(0, 8).toUpperCase()} (${orderData.device || orderData.orderType || 'Serviço'}) foi *${orderData.status}* com sucesso!\n\n💰 Valor: R$ ${Number(orderData.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n✅ Você já pode retirar seu dispositivo. Obrigado pela preferência! 😊`;
                notify({ channel: 'whatsapp', to: orderData.clientPhone, message: msg });
            }

            setIsFormOpen(false);
            setEditingOrder(null);
            resetForm();
        }
    };

    const resetForm = () => {
        setFormData({
            customerId: '', clientName: '', clientPhone: '', device: '', devicePassword: '',
            issueDescription: '', technicalReport: '', warranty: '', status: 'Aberta', items: [], manualTotal: '', orderType: 'Manutenção', financeSynced: false
        });
        setSelectedItem('');
        setItemQty(1);
    };

    
    const printOrder = async (order) => {
        try {
            const payableTotal = resolveOrderTotal(order);
            // Generate PIX
            const txid = `OS${order.id.substring(0,10).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
            const pixPayload = generatePixPayload(tenant.pixKey, tenant.pixName, tenant.city || 'Manaus', payableTotal, txid);

            const isVenda = order.orderType === 'Venda Direta';
            const termsText = (['Aprovada', 'Concluída', 'Entregue'].includes(order.status) || isVenda)
                ? 'TERMO DE CONFISSÃO DE DÍVIDA: O atraso no pagamento sujeitará o cliente ao pagamento de multa moratória fixa de 6% (seis por cento) sobre o valor devido, juros moratórios de 3% (três por cento) ao mês cobrados pro rata die, suspensão da prestação dos serviços após 15 (quinze) dias de atraso e encaminhamento do débito a Cartório de Protesto.'
                : '';

            const documentInfo = [
                { label: 'Data:', value: new Date(order.createdAt).toLocaleDateString('pt-BR') },
                { label: 'Status:', value: order.status }
            ];

            if (!isVenda) {
                documentInfo.push({ label: 'Equipamento:', value: order.device });
                documentInfo.push({ label: 'Defeito:', value: order.issueDescription });
                if (order.warranty) documentInfo.push({ label: 'Garantia:', value: order.warranty });
                if (order.technicalReport) documentInfo.push({ label: 'Laudo:', value: order.technicalReport });
            }

            const success = await generateProfessionalPDF({
                tenant,
                title: isVenda ? 'RECIBO DE VENDA' : 'ORDEM DE SERVIÇO',
                documentNumber: `#${order.id.split('-')[0].toUpperCase()}`,
                customerInfo: [
                    order.clientName,
                    order.clientPhone || 'Sem telefone'
                ],
                documentInfo,
                tableColumns: ['Tipo', 'Item', 'Qtd', 'V. Unit', 'Total'],
                tableRows: (order.items || []).map(item => [
                    item.type || '-',
                    item.name || '-',
                    String(item.qty || 1),
                    `R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${(Number(item.price || 0) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                ]),
                totalLabel: 'TOTAL A PAGAR:',
                totalValue: payableTotal,
                terms: termsText,
                pixPayload: pixPayload,
                filename: `OS_${order.id.substring(0,6).toUpperCase()}.pdf`
            });

            if (success) {
                showToast.success('PDF gerado com sucesso!');
            } else {
                showAlert('Erro', 'Não foi possível gerar o PDF.');
            }
        } catch (err) {
            console.error(err);
            showAlert("Erro", "Erro ao gerar PDF da O.S.");
        }
    };


    const getStatusColor = (status) => {
        switch (status) {
            case 'Aberta': return 'var(--color-accent)';
            case 'Em Andamento': return '#3b82f6';
            case 'Aguardando Peça': return '#f59e0b';
            case 'Aprovando Orçamento': return '#8b5cf6';
            case 'Concluída': return 'var(--color-success)';
            case 'Entregue': return '#10b981';
            case 'Cancelada': return 'var(--color-danger)';
            default: return 'var(--color-text-muted)';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Aberta':
                return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
            case 'Em Andamento':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'Aguardando Peça':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'Aprovando Orçamento':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
            case 'Aprovada':
                return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
            case 'Concluída':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'Entregue':
                return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
            case 'Cancelada':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    const filteredOrders = orders.filter(o => 
        o.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        o.device?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.id.includes(searchTerm)
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner">
                        <ClipboardList className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                            Ordens de Serviço
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                            Gerencie manutenções, diagnósticos técnicos e faturamentos diretos
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                            type="text"
                            placeholder="Buscar O.S. ou cliente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-inner" 
                        />
                    </div>
                    <button 
                        onClick={() => { setIsFormOpen(!isFormOpen); setEditingOrder(null); resetForm(); }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-medium text-sm shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center gap-2 cursor-pointer"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Nova O.S.</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total de O.S.</div>
                        <div className="text-2xl font-extrabold text-slate-100 mt-0.5">{orders.length}</div>
                    </div>
                </div>
                
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                        <Wrench className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Em Andamento</div>
                        <div className="text-2xl font-extrabold text-amber-400 mt-0.5">
                            {orders.filter(o => ['Aberta', 'Em Andamento', 'Aguardando Peça', 'Aprovando Orçamento'].includes(o.status)).length}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Concluídas</div>
                        <div className="text-2xl font-extrabold text-emerald-400 mt-0.5">
                            {orders.filter(o => ['Concluída', 'Entregue', 'Aprovada'].includes(o.status)).length}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                        <Tag className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento Total</div>
                        <div className="text-xl font-extrabold text-indigo-300 mt-0.5">
                            R$ {orders.reduce((acc, curr) => acc + resolveOrderTotal(curr), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Section */}
            {isFormOpen && (
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden transition-all border-t-2 border-t-indigo-500">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
                        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            {editingOrder ? <Edit className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                            <span>{editingOrder ? 'Editar Ordem de Serviço' : 'Criar Nova Ordem de Serviço'}</span>
                        </h3>
                        <button 
                            type="button" 
                            onClick={() => { setIsFormOpen(false); setEditingOrder(null); resetForm(); }}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Tipo de O.S */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                            <label className={`flex items-center gap-3 p-3.5 rounded-lg cursor-pointer transition-all border ${formData.orderType === 'Manutenção' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}>
                                <input 
                                    type="radio" 
                                    name="orderType" 
                                    value="Manutenção" 
                                    checked={formData.orderType === 'Manutenção'} 
                                    onChange={handleChange}
                                    className="sr-only" 
                                />
                                <div className={`p-2 rounded-lg ${formData.orderType === 'Manutenção' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <Wrench className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">🔧 Manutenção (O.S. Padrão)</div>
                                    <div className="text-xs opacity-70">Para equipamentos com laudo técnico e peças</div>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 p-3.5 rounded-lg cursor-pointer transition-all border ${formData.orderType === 'Venda Direta' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}>
                                <input 
                                    type="radio" 
                                    name="orderType" 
                                    value="Venda Direta" 
                                    checked={formData.orderType === 'Venda Direta'} 
                                    onChange={handleChange}
                                    className="sr-only" 
                                />
                                <div className={`p-2 rounded-lg ${formData.orderType === 'Venda Direta' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                                    <ShoppingBag className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">🛒 Venda Direta / Faturamento</div>
                                    <div className="text-xs opacity-70">Para venda simples de produtos e serviços</div>
                                </div>
                            </label>
                        </div>

                        {/* Seção Cliente */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Buscar Cliente Cadastrado
                                </label>
                                <select 
                                    value={formData.customerId} 
                                    onChange={handleCustomerChange} 
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">-- Selecione ou digite manualmente abaixo --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.phone || c.email || 'Sem contato'})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Nome do Cliente *
                                </label>
                                <input 
                                    name="clientName" 
                                    placeholder="Nome do Cliente" 
                                    value={formData.clientName} 
                                    onChange={handleChange} 
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Telefone / WhatsApp *
                                </label>
                                <input 
                                    name="clientPhone" 
                                    placeholder="Telefone/WhatsApp" 
                                    value={formData.clientPhone} 
                                    onChange={handleChange} 
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                    required 
                                />
                            </div>
                        </div>

                        {/* Seção Aparelho (Somente se orderType === 'Manutenção') */}
                        {formData.orderType === 'Manutenção' && (
                            <div className="bg-slate-950/40 rounded-2xl border border-slate-800/80 p-5 space-y-4">
                                <h4 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                                    <Laptop className="w-4 h-4" /> Informações do Equipamento
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Aparelho / Equipamento *
                                        </label>
                                        <input 
                                            name="device" 
                                            placeholder="Ex: Notebook Dell Inspiron 15" 
                                            value={formData.device} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                            required={formData.orderType === 'Manutenção'} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Senha do Aparelho
                                        </label>
                                        <input 
                                            name="devicePassword" 
                                            placeholder="Ex: 1234 ou Padrão Z" 
                                            value={formData.devicePassword} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Garantia
                                        </label>
                                        <input 
                                            name="warranty" 
                                            placeholder="Ex: 90 dias balcão" 
                                            value={formData.warranty} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Defeito Relatado *
                                        </label>
                                        <textarea 
                                            name="issueDescription" 
                                            placeholder="O que o cliente relatou?" 
                                            value={formData.issueDescription} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[80px] resize-y" 
                                            required={formData.orderType === 'Manutenção'} 
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                            Laudo Técnico (Preenchido pelo técnico)
                                        </label>
                                        <textarea 
                                            name="technicalReport" 
                                            placeholder="Qual foi o diagnóstico e o serviço realizado?" 
                                            value={formData.technicalReport} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[80px] resize-y" 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Seção Peças e Serviços */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-indigo-400 flex items-center gap-2">
                                <Tag className="w-4 h-4" /> Peças e Serviços Utilizados
                            </h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select 
                                    value={selectedItem} 
                                    onChange={e => setSelectedItem(e.target.value)} 
                                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">-- Adicionar Produto ou Serviço --</option>
                                    {inventory.map(item => (
                                        <option key={item.id} value={item.id}>{item._label}</option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={itemQty} 
                                        onChange={e => setItemQty(Number(e.target.value))} 
                                        className="w-20 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                        title="Quantidade" 
                                    />
                                    <button 
                                        onClick={handleAddItem} 
                                        type="button" 
                                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Adicionar</span>
                                    </button>
                                </div>
                            </div>

                            {formData.items.length > 0 && (
                                <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
                                    <table className="w-full text-left text-sm text-slate-300">
                                        <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                                            <tr>
                                                <th className="p-3">Item</th>
                                                <th className="p-3 text-center">Qtd</th>
                                                <th className="p-3 text-right">V. Unit</th>
                                                <th className="p-3 text-right">Total</th>
                                                <th className="p-3 text-center">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/40">
                                            {formData.items.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-200">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase mr-2 ${it.type === 'Produto' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                                                            {it.type}
                                                        </span>
                                                        {it.name}
                                                    </td>
                                                    <td className="p-3 text-center text-slate-300">{it.qty}</td>
                                                    <td className="p-3 text-right text-slate-300">R$ {Number(it.price || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    <td className="p-3 text-right font-semibold text-slate-200">R$ {(Number(it.price || 0) * it.qty).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    <td className="p-3 text-center">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveItem(idx)} 
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                                                            title="Remover item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Fechamento & Totais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end border-t border-slate-800/80 pt-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    Status da O.S.
                                </label>
                                <select 
                                    name="status" 
                                    value={formData.status} 
                                    onChange={handleChange} 
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-base font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                >
                                    <option value="Aberta">Aberta</option>
                                    <option value="Em Andamento">Em Andamento</option>
                                    <option value="Aguardando Peça">Aguardando Peça</option>
                                    <option value="Aprovando Orçamento">Aprovando Orçamento</option>
                                    <option value="Aprovada">Aprovada</option>
                                    <option value="Concluída">Concluída</option>
                                    <option value="Entregue">Entregue</option>
                                    <option value="Cancelada">Cancelada</option>
                                </select>
                            </div>
                            
                            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col items-end gap-1.5 shadow-inner">
                                <div className="text-xs font-medium text-slate-400">
                                    Subtotal dos itens: <span className="text-slate-200 font-semibold">R$ {calculatedTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-200">Valor Final (R$):</span>
                                    <input 
                                        type="text" 
                                        placeholder="Automático"
                                        value={formData.manualTotal !== '' ? Number(formData.manualTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : ''}
                                        onChange={handleManualTotalChange}
                                        className="w-36 bg-slate-900 border border-emerald-500/40 rounded-lg px-3 py-1.5 text-right text-lg font-extrabold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <small className="text-[11px] text-slate-500">* Altere apenas se houver desconto ou acréscimo</small>
                            </div>

                            <button 
                                type="submit" 
                                className="md:col-span-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold text-base shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span>{editingOrder ? 'Salvar Alterações na O.S.' : 'Gerar Ordem de Serviço'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table / List Section */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm text-slate-300">
                        <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="py-4 px-5">O.S. / Data</th>
                                <th className="py-4 px-5">Cliente</th>
                                <th className="py-4 px-5">Aparelho / Tipo</th>
                                <th className="py-4 px-5">Status</th>
                                <th className="py-4 px-5">Valor</th>
                                <th className="py-4 px-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 px-4 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <ClipboardList className="w-12 h-12 text-slate-600" />
                                            <span className="text-base font-medium">Nenhuma ordem de serviço encontrada.</span>
                                            <span className="text-xs text-slate-500">Crie uma nova O.S. ou limpe a busca.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="py-4 px-5">
                                            <div className="font-mono font-bold text-indigo-300">
                                                #{order.id.substring(0, 6).toUpperCase()}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <div className="font-semibold text-slate-100">{order.clientName}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{order.clientPhone || 'Sem telefone'}</div>
                                        </td>
                                        <td className="py-4 px-5 text-slate-300">
                                            {order.orderType === 'Venda Direta' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                    <ShoppingBag className="w-3 h-3" /> Venda Direta
                                                </span>
                                            ) : (
                                                order.device || '-'
                                            )}
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(order.status)}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 font-bold text-slate-100">
                                            <div>R$ {resolveOrderTotal(order).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            {order.paymentStatus === 'Pago' && (
                                                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    PIX pago
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {order.paymentStatus === 'Pago' ? null : mpLinks[order.id] ? (
                                                    <button
                                                        onClick={() => copyLinkToClipboard(mpLinks[order.id])}
                                                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                        title="Copiar link de pagamento"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleMPPayment(order)}
                                                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                        title="Gerar Link Mercado Pago"
                                                    >
                                                        <CreditCard size={14} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => printOrder(order)} 
                                                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer" 
                                                    title="Imprimir PDF"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(order)} 
                                                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all cursor-pointer" 
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => removeOrder(order.id)} 
                                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer" 
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleSendWhatsApp(order)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                                                    title="Notificar Cliente (WhatsApp)"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ServiceOrdersManager;
