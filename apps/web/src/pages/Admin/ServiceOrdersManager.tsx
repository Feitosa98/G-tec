import React, { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { 
    Plus, Trash2, Edit, ClipboardList, Printer, CheckCircle, Search, 
    Wrench, ShoppingBag, X, Laptop, Tag, MessageCircle, CreditCard, Copy, QrCode, ExternalLink, FileText, ShieldCheck, Eye, Mail
} from 'lucide-react';
import { showToast } from '../../utils/toast';
import { generateDanfsePDF, generateProfessionalPDF } from '../../utils/pdfGenerator';
import { useNotify } from '../../hooks/useNotify';
import { formatBrazilianPhone } from '../../utils/phone';
import { useMercadoPago } from '../../hooks/useMercadoPago';
import { useQueryClient } from '@tanstack/react-query';
import { storeQueryKey } from '../../utils/api';
import { reconcileInstallments } from '../../utils/installmentPayments';


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

const serviceOrderNumber = (order: any) => Number(order?.orderNumber) > 0
    ? String(Math.trunc(Number(order.orderNumber))).padStart(6, '0')
    : String(order?.id || '').split('-')[0].slice(0, 8).toUpperCase();

const serviceOrderReference = (order: any) => `#${serviceOrderNumber(order)}`;

const defaultFlowTemplates = {
    chargeCreatedEnabled: true,
    paymentConfirmedEnabled: true,
    serviceOrderCreatedEnabled: true,
    serviceCompletedEnabled: true,
    chargeCreated: 'Olá, {cliente}!\n\n{titulo}\nValor: R$ {valor}\n\nPIX Copia e Cola:\n{pix}\n\nO QR Code e o PDF seguem anexos.',
    serviceOrderCreated: 'Olá, {cliente}! Sua ordem de serviço #{numero} foi aberta com sucesso. Status atual: {status}. Valor previsto: R$ {valor}.',
    serviceCompleted: 'Olá, {cliente}! Sua ordem de serviço #{numero} foi concluída e está pronta para retirada. Valor: R$ {valor}. Obrigado pela preferência!',
};

const fillMessageTemplate = (template: string, values: Record<string, string>) => Object.entries(values)
    .reduce((message, [key, value]) => message.replaceAll(`{${key}}`, value), template);

const ServiceOrdersManager = () => {
    const queryClient = useQueryClient();
    const { tenant, showConfirm, showAlert, registerSale } = useData();
    const { notify } = useNotify();
    const { generatePixPayment, checkPixPaymentStatus, copyLinkToClipboard } = useMercadoPago();
    const [mpConfigured, setMpConfigured] = useState(false);
    const [whatsappConnected, setWhatsappConnected] = useState(false);
    const [waTemplates, setWaTemplates] = useState(defaultFlowTemplates);
    const [pixPayments, setPixPayments] = useState<Record<string, any>>({});
    const [pixModal, setPixModal] = useState<{ order: any; payment: any } | null>(null);
    const [nfseHomologationEnabled, setNfseHomologationEnabled] = useState(false);
    const [nfseConfig, setNfseConfig] = useState<any>(null);
    const [issuingNfseId, setIssuingNfseId] = useState('');

    const handleSendWhatsApp = async (order: any) => {
        const phone = order.clientPhone || '';
        if (!phone) {
            showToast.error('Cadastre o telefone do cliente antes de enviar a mensagem.');
            return;
        }
        if (!whatsappConnected) {
            showToast.info('WhatsApp desconectado. Conecte-o em Integrações antes de enviar.');
            return;
        }

            const isCompleted = ['Concluída', 'Concluído', 'Finalizada', 'Entregue', 'Paga', 'Pago'].includes(order.status);
        const message = fillMessageTemplate(
            isCompleted ? waTemplates.serviceCompleted : waTemplates.serviceOrderCreated,
            {
                cliente: order.clientName || 'Cliente',
                numero: serviceOrderNumber(order),
                valor: resolveOrderTotal(order).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                status: order.status || 'Aberta',
                empresa: tenant?.businessName || '',
                titulo: isCompleted ? 'Serviço concluído' : 'Ordem de serviço aberta',
                pix: '',
            }
        );
        await notify({ channel: 'whatsapp', to: phone, message });
    };

    const handleMPPayment = async (order: any) => {
        const customer = customers.find((item: any) => item.id === order.customerId);
        const payerEmail = order.clientEmail || customer?.email;
        if (!payerEmail) {
            showToast.error('Informe o e-mail do cliente na venda para gerar o PIX.');
            return;
        }
        const result = await generatePixPayment({
            amount: resolveOrderTotal(order),
            description: `${order.orderType === 'Venda Direta' ? 'Venda' : 'O.S.'} ${serviceOrderReference(order)}`,
            payerEmail,
            payerName: order.clientName,
            externalReference: order.id,
            referenceType: 'service_order',
        });
        if (result.success) {
            const payment = { ...result, status: 'pending' };
            setPixPayments(prev => ({ ...prev, [order.id]: payment }));
            setPixModal({ order, payment });
        }
    };

    const sendAutomaticCharge = async (order: any, payment: any) => {
        if (!whatsappConnected || !waTemplates.chargeCreatedEnabled || !order.clientPhone || !payment?.qrCode || !payment?.qrCodeBase64) return false;
        const total = resolveOrderTotal(order);
        const rows = (order.items || []).map((item: any) => [
            item.type || '-',
            item.name || '-',
            String(item.qty || 1),
            `R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${(Number(item.price || 0) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        ]);
        if (rows.length === 0) rows.push(['Venda', 'Valor informado manualmente', '1', `R$ ${total.toFixed(2).replace('.', ',')}`, `R$ ${total.toFixed(2).replace('.', ',')}`]);

        const pdf = await generateProfessionalPDF({
            tenant,
            title: 'RECIBO DE VENDA',
            documentNumber: serviceOrderReference(order),
            customerInfo: [order.clientName, order.clientPhone, order.clientEmail || ''],
            documentInfo: [
                { label: 'Data:', value: new Date(order.createdAt).toLocaleDateString('pt-BR') },
                { label: 'Status:', value: 'Aguardando pagamento' },
            ],
            tableColumns: ['Tipo', 'Item', 'Qtd', 'V. Unit', 'Total'],
            tableRows: rows,
            totalLabel: 'TOTAL A PAGAR:',
            totalValue: total,
            pixPayload: payment.qrCode,
            filename: `venda_${serviceOrderNumber(order)}.pdf`,
            returnBase64: true,
            save: false,
        });
        if (!pdf?.base64) return false;

        const title = `Cobrança da venda ${serviceOrderReference(order)}`;
        const message = fillMessageTemplate(waTemplates.chargeCreated, {
            cliente: order.clientName || 'Cliente',
            titulo: title,
            numero: serviceOrderNumber(order),
            valor: total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            pix: payment.qrCode,
            status: 'Aguardando pagamento',
            empresa: tenant?.businessName || '',
        });
        return notify({
            channel: 'whatsapp',
            to: order.clientPhone,
            message,
            qrCodeBase64: payment.qrCodeBase64,
            pdfBase64: pdf.base64,
            pdfFilename: pdf.filename,
        });
    };

    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [inventory, setInventory] = useState([]); // Combined products and services
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState({
        customerId: '', clientName: '', clientPhone: '', clientEmail: '',
        device: '', devicePassword: '', issueDescription: '', technicalReport: '', warranty: '90 dias',
        status: 'Aberta', paymentStatus: 'Pendente', items: [], expenses: [], payments: [], installments: [], manualTotal: '', orderType: 'Manutenção', financeSynced: false
    });

    const [selectedItem, setSelectedItem] = useState('');
    const [itemQty, setItemQty] = useState(1);
    const [itemPrice, setItemPrice] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
    const [paymentNote, setPaymentNote] = useState('');
    const [installmentCount, setInstallmentCount] = useState(2);
    const [installmentIntervalDays, setInstallmentIntervalDays] = useState(30);
    const [firstDueDate, setFirstDueDate] = useState('');

    useEffect(() => {
        const paymentId = pixModal?.payment?.paymentId;
        if (!paymentId || pixModal?.payment?.status === 'approved') return;
        let active = true;
        const verify = async () => {
            const result = await checkPixPaymentStatus(paymentId);
            if (!active || !result.success || !result.status) return;
            if (result.approved) {
                const approvedPayment = { ...pixModal.payment, status: 'approved', paidAt: result.paidAt };
                setPixPayments(prev => ({ ...prev, [pixModal.order.id]: approvedPayment }));
                setPixModal({ order: pixModal.order, payment: approvedPayment });
                showToast.success('Pagamento PIX confirmado!');
                void fetchData();
            }
        };
        void verify();
        const interval = window.setInterval(verify, 3000);
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [pixModal?.payment?.paymentId, pixModal?.payment?.status, checkPixPaymentStatus]);

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
            const [ordersRes, custRes, prodRes, servRes, integrationsRes, nfseRes, whatsappStatusRes] = await Promise.all([
                fetch(`/api/store/${tenant.storeSlug}/service_orders`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/customers`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/products`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/services`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/integrations`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/nfse/config`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/whatsapp/status?restore=0`, { headers })
            ]);

            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (custRes.ok) setCustomers(await custRes.json());
            
            const prods = prodRes.ok ? await prodRes.json() : [];
            const servs = servRes.ok ? await servRes.json() : [];
            const integrations = integrationsRes.ok ? await integrationsRes.json() : [];
            const nfseConfig = nfseRes.ok ? await nfseRes.json() : null;
            const whatsappStatus = whatsappStatusRes.ok ? await whatsappStatusRes.json() : null;
            setWhatsappConnected(whatsappStatus?.status === 'connected');
            setNfseConfig(nfseConfig);
            setNfseHomologationEnabled(Boolean(nfseConfig?.enabled && nfseConfig?.certificateConfigured));
            setMpConfigured(integrations.some((item: any) => item.id === 'mercadopago' && item.enabled !== false && item.accessToken));
            const savedTemplates = integrations.find((item: any) => item.id === 'whatsapp_templates');
            setWaTemplates({ ...defaultFlowTemplates, ...(savedTemplates || {}) });
            
            setInventory([
                ...prods.map(p => {
                    const stock = Number(p.stock ?? p.quantity ?? 0);
                    return { ...p, stock, _type: 'Produto', _label: `[Produto] ${p.name} - R$ ${Number(p.price).toLocaleString('pt-BR', {minimumFractionDigits: 2})} · estoque ${stock}` };
                }),
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
                const savedOrder = await res.json();
                queryClient.invalidateQueries({ queryKey: storeQueryKey('products') });
                queryClient.invalidateQueries({ queryKey: storeQueryKey('serviceOrders') });
                fetchData();
                return savedOrder;
            } else {
                const errorBody = await res.json().catch(() => null);
                throw new Error(errorBody?.message || `Falha ao salvar (código ${res.status})`);
            }
        } catch (error: any) {
            console.error(error);
            showToast.error(`Erro ao salvar O.S.: ${error?.message || 'falha desconhecida'}`);
            return null;
        }
    };

    const removeOrder = async (id) => {
        showConfirm('Excluir O.S.', 'Deseja realmente excluir esta O.S.?', async () => {
            try {
                const res = await fetch(`/api/store/${tenant.storeSlug}/service_orders/${id}`, {
                    method: 'DELETE', headers
                });
                if (res.ok) {
                    const result = await res.json().catch(() => ({}));
                    queryClient.invalidateQueries({ queryKey: storeQueryKey('products') });
                    queryClient.invalidateQueries({ queryKey: storeQueryKey('serviceOrders') });
                    queryClient.invalidateQueries({ queryKey: storeQueryKey('sales') });
                    fetchData();
                    showToast.success(result.returnedItems > 0
                        ? `O.S. excluída e ${result.returnedItems} peça(s) devolvida(s) ao estoque.`
                        : 'O.S. excluída.');
                } else {
                    const result = await res.json().catch(() => null);
                    throw new Error(result?.message || 'Não foi possível excluir a O.S.');
                }
            } catch (error: any) {
                console.error(error);
                showAlert('Erro', error?.message || 'Não foi possível excluir a O.S.');
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
            setFormData({ ...formData, customerId: cust.id, clientName: cust.name, clientPhone: formatBrazilianPhone(cust.phone), clientEmail: cust.email || '' });
        } else {
            setFormData({ ...formData, customerId: '', clientName: '', clientPhone: '', clientEmail: '' });
        }
    };

    const handleAddItem = (e) => {
        e.preventDefault();
        if (!selectedItem) return;
        const item = inventory.find(i => String(i.id) === String(selectedItem));
        if (item) {
            const orderPrice = Number(itemPrice);
            if (!Number.isFinite(orderPrice) || orderPrice < 0) {
                showToast.error('Informe um valor válido para o item nesta O.S.');
                return;
            }
            const requestedQuantity = Math.max(1, Number(itemQty) || 1);
            const availableStock = Number(item.stock ?? item.quantity ?? 0);
            if (item._type === 'Produto' && availableStock < requestedQuantity) {
                showToast.info(`Venda permitida. O estoque de ${item.name} ficará em ${availableStock - requestedQuantity}.`);
            }
            setFormData({
                ...formData,
                items: [...formData.items, {
                    id: item.id,
                    type: item._type,
                    name: item.name,
                    catalogPrice: Number(item.price),
                    cost: Number(item.cost ?? item.costPrice ?? item.purchasePrice ?? 0),
                    price: orderPrice,
                    qty: requestedQuantity,
                    stockAtSelection: item._type === 'Produto' ? availableStock : undefined,
                    allowsNegativeStock: item._type === 'Produto' && availableStock < requestedQuantity
                }],
                manualTotal: ''
            });
            setSelectedItem('');
            setItemQty(1);
            setItemPrice('');
        }
    };

    const handleSelectedItemChange = (itemId) => {
        setSelectedItem(itemId);
        const item = inventory.find(candidate => String(candidate.id) === String(itemId));
        setItemPrice(item ? String(Number(item.price) || 0) : '');
    };

    const handleOrderItemPriceChange = (index, value) => {
        const price = Math.max(0, Number(value) || 0);
        const items = formData.items.map((item, itemIndex) => itemIndex === index ? { ...item, price } : item);
        setFormData({ ...formData, items, manualTotal: '' });
    };

    const handleRemoveItem = (index) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems, manualTotal: '' });
    };

    const calculatedTotal = calculateItemsTotal(formData.items);
    const manualTotalValue = Number(formData.manualTotal);
    const hasValidManualTotal = formData.manualTotal !== '' && Number.isFinite(manualTotalValue) && manualTotalValue > 0;
    const finalTotal = hasValidManualTotal ? manualTotalValue : calculatedTotal;
    const itemCostTotal = formData.items.reduce((total, item) => total + (Number(item.cost ?? item.costPrice ?? 0) || 0) * (Number(item.qty) || 1), 0);
    const orderExpenseTotal = formData.expenses.reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
    const totalCost = itemCostTotal + orderExpenseTotal;
    const netProfit = finalTotal - totalCost;
    const paidTotal = formData.payments.reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
    const balanceDue = Math.max(0, finalTotal - paidTotal);

    const handleAddExpense = () => {
        const amount = Number(String(expenseAmount).replace(',', '.'));
        if (!expenseDescription.trim() || !Number.isFinite(amount) || amount <= 0) {
            showToast.error('Informe a descrição e o valor da despesa.');
            return;
        }
        setFormData({ ...formData, expenses: [...formData.expenses, { id: crypto.randomUUID(), description: expenseDescription.trim(), amount }] });
        setExpenseDescription('');
        setExpenseAmount('');
    };

    const handleAddPayment = () => {
        const amount = Number(String(paymentAmount).replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            showToast.error('Informe um valor de pagamento válido.');
            return;
        }
        const payments = [...formData.payments, { id: crypto.randomUUID(), amount, method: paymentMethod, note: paymentNote.trim(), paidAt: new Date().toISOString() }];
        const nextPaidTotal = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
        setFormData({ ...formData, payments, paymentStatus: finalTotal > 0 && nextPaidTotal >= finalTotal ? 'Pago' : 'Parcial' });
        setPaymentAmount('');
        setPaymentNote('');
    };

    const handleGenerateInstallments = () => {
        const count = Math.max(1, Math.min(60, Number(installmentCount) || 1));
        const interval = Math.max(1, Math.min(365, Number(installmentIntervalDays) || 30));
        if (finalTotal <= 0) {
            showToast.error('Informe os itens ou o valor final antes de gerar as parcelas.');
            return;
        }
        const baseDate = firstDueDate
            ? new Date(`${firstDueDate}T12:00:00`)
            : new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
        const baseAmount = Math.floor((finalTotal / count) * 100) / 100;
        const installments = Array.from({ length: count }, (_, index) => {
            const dueDate = new Date(baseDate);
            dueDate.setDate(baseDate.getDate() + index * interval);
            const amount = index === count - 1
                ? Number((finalTotal - baseAmount * (count - 1)).toFixed(2))
                : baseAmount;
            return {
                id: crypto.randomUUID(), number: index + 1, installmentNumber: index + 1,
                amount, value: amount, dueDate: dueDate.toISOString().slice(0, 10),
                status: 'Pendente', paid: false,
            };
        });
        setFormData({ ...formData, installments, paymentStatus: 'Pendente' });
        showToast.success(`${count} parcela(s) calculada(s).`);
    };

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
        if ((order.installments || []).length > 0) setPaymentMethod('A prazo');
        setFormData({
            customerId: order.customerId || '',
            clientName: order.clientName || '',
            clientPhone: formatBrazilianPhone(order.clientPhone),
            clientEmail: order.clientEmail || '',
            device: order.device || '',
            devicePassword: order.devicePassword || '',
            issueDescription: order.issueDescription || '',
            technicalReport: order.technicalReport || '',
            warranty: order.warranty || '90 dias',
            status: order.status || 'Aberta',
            paymentStatus: order.paymentStatus || (order.status === 'Pago' ? 'Pago' : 'Pendente'),
            items: order.items || [],
            expenses: order.expenses || [],
            payments: order.payments || [],
            installments: order.installments || [],
            manualTotal: Number(order.manualTotal) > 0 ? String(order.manualTotal) : (order.items && order.items.length > 0 ? '' : String(order.totalValue || '')),
            orderType: order.orderType || 'Manutenção',
            financeSynced: order.financeSynced || false
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const forcePaid = ['Paga', 'Pago'].includes(formData.status) || formData.paymentStatus === 'Pago';
        const resolvedPayments = forcePaid && paidTotal < finalTotal
            ? [...formData.payments, { id: crypto.randomUUID(), amount: Math.max(0, finalTotal - paidTotal), method: paymentMethod === 'A prazo' ? 'Baixa manual' : paymentMethod, note: paymentNote.trim() || 'Baixa pelo status da O.S.', paidAt: new Date().toISOString() }]
            : formData.payments;
        const resolvedPaidTotal = forcePaid ? finalTotal : resolvedPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
        const resolvedPaymentStatus = forcePaid || (finalTotal > 0 && resolvedPaidTotal >= finalTotal) ? 'Pago' : resolvedPaidTotal > 0 ? 'Parcial' : formData.paymentStatus;
        const resolvedStatus = resolvedPaymentStatus === 'Pago' ? 'Paga' : formData.status;
        const resolvedInstallments = reconcileInstallments({ ...formData, payments: resolvedPayments, paidTotal: resolvedPaidTotal, paymentStatus: resolvedPaymentStatus });
        let orderData = {
            id: editingOrder ? editingOrder.id : crypto.randomUUID(),
            customerId: formData.customerId,
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            clientEmail: formData.clientEmail,
            device: formData.device,
            devicePassword: formData.devicePassword,
            issueDescription: formData.issueDescription,
            technicalReport: formData.technicalReport,
            warranty: formData.warranty,
            status: resolvedStatus,
            paymentStatus: resolvedPaymentStatus,
            items: formData.items,
            expenses: formData.expenses,
            payments: resolvedPayments,
            installments: resolvedInstallments,
            manualTotal: hasValidManualTotal ? manualTotalValue : undefined,
            totalValue: finalTotal,
            itemCostTotal,
            expenseTotal: orderExpenseTotal,
            totalCost,
            netProfit,
            paidTotal: resolvedPaidTotal,
            balanceDue: Math.max(0, finalTotal - resolvedPaidTotal),
            orderType: formData.orderType,
            financeSynced: true,
            createdAt: editingOrder ? editingOrder.createdAt : new Date().toISOString()
        };

        const savedOrder = await saveOrder(orderData);
        if (savedOrder) {
            orderData = { ...orderData, ...savedOrder };
            try {
                await registerSale({
                    id: `os-${orderData.id}`,
                    type: 'sale',
                    source: 'service_order',
                    osReference: orderData.id,
                    customerId: orderData.customerId,
                    customerName: orderData.clientName,
                    userEmail: orderData.clientEmail || orderData.clientName,
                    customerEmail: orderData.clientEmail || '',
                    customerPhone: orderData.clientPhone || '',
                    date: orderData.createdAt,
                    total: orderData.totalValue,
                    totalCost: orderData.totalCost,
                    items: orderData.items.map(item => ({ ...item, quantity: Number(item.qty) || 1 })),
                    expenses: orderData.expenses,
                    payments: orderData.payments,
                    installments: orderData.installments,
                    paidTotal: orderData.paidTotal,
                    balanceDue: orderData.balanceDue,
                    paymentStatus: orderData.paymentStatus,
                    status: orderData.status,
                }, 'Faturamento de O.S.');
            } catch (financeError) {
                console.error(financeError);
                showToast.info('O.S. salva, mas o financeiro não sincronizou. Tente salvar novamente.');
            }
            showToast.success(`Ordem de Serviço ${editingOrder ? 'atualizada' : 'gerada'} com sucesso!`);

            if (!editingOrder && orderData.orderType === 'Venda Direta' && mpConfigured) {
                const payment = await generatePixPayment({
                    amount: Number(orderData.totalValue) || 0,
                    description: `Venda ${serviceOrderReference(orderData)}`,
                    payerEmail: orderData.clientEmail,
                    payerName: orderData.clientName,
                    externalReference: orderData.id,
                    referenceType: 'service_order',
                });
                if (payment.success) {
                    const pendingPayment = { ...payment, status: 'pending' };
                    setPixPayments(prev => ({ ...prev, [orderData.id]: pendingPayment }));
                    setPixModal({ order: orderData, payment: pendingPayment });
                    if (waTemplates.chargeCreatedEnabled) {
                        const sent = await sendAutomaticCharge(orderData, pendingPayment);
                        if (sent) {
                            await saveOrder({ ...orderData, whatsappChargeSentAt: new Date().toISOString() });
                            showToast.success('Cobrança, QR Code e PDF enviados ao cliente.');
                        } else {
                            showToast.error('Venda criada, mas o WhatsApp não enviou a cobrança. Verifique a conexão.');
                        }
                    }
                }
            }

            if (!editingOrder && orderData.orderType !== 'Venda Direta' && orderData.clientPhone && waTemplates.serviceOrderCreatedEnabled && whatsappConnected) {
                const message = fillMessageTemplate(waTemplates.serviceOrderCreated, {
                    cliente: orderData.clientName || 'Cliente',
                    numero: serviceOrderNumber(orderData),
                    valor: Number(orderData.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    status: orderData.status,
                    empresa: tenant?.businessName || '',
                    titulo: 'Ordem de serviço aberta',
                    pix: '',
                });
                await notify({ channel: 'whatsapp', to: orderData.clientPhone, message });
            } else if (!editingOrder && orderData.orderType !== 'Venda Direta' && orderData.clientPhone && waTemplates.serviceOrderCreatedEnabled) {
                showToast.info('O.S. salva. WhatsApp desconectado; a mensagem automática não foi enviada.');
            }

            // 🔔 Notificação automática via WhatsApp ao concluir/entregar
            if (orderData.orderType !== 'Venda Direta' && ['Concluída', 'Concluído', 'Finalizada', 'Entregue', 'Paga', 'Pago'].includes(orderData.status) && orderData.clientPhone && waTemplates.serviceCompletedEnabled && whatsappConnected) {
                const msg = fillMessageTemplate(waTemplates.serviceCompleted, {
                    cliente: orderData.clientName || 'Cliente',
                    numero: serviceOrderNumber(orderData),
                    valor: Number(orderData.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    status: orderData.status,
                    empresa: tenant?.businessName || '',
                    titulo: 'Serviço concluído',
                    pix: '',
                });
                await notify({ channel: 'whatsapp', to: orderData.clientPhone, message: msg });
            }

            const becameCompleted = ['Concluída', 'Concluído', 'Finalizada', 'Entregue', 'Paga', 'Pago'].includes(orderData.status)
                && editingOrder?.status !== orderData.status;
            if (orderData.clientEmail && (!editingOrder || becameCompleted)) {
                const emailSent = await sendOrderEmail(orderData, true);
                if (!emailSent) showToast.info('O.S. salva, mas o e-mail automático não foi enviado. Confira a integração de e-mail.');
            }

            setIsFormOpen(false);
            setEditingOrder(null);
            resetForm();
        }
    };

    const resetForm = () => {
        setFormData({
            customerId: '', clientName: '', clientPhone: '', clientEmail: '', device: '', devicePassword: '',
            issueDescription: '', technicalReport: '', warranty: '90 dias', status: 'Aberta', paymentStatus: 'Pendente', items: [], expenses: [], payments: [], installments: [], manualTotal: '', orderType: 'Manutenção', financeSynced: false
        });
        setSelectedItem('');
        setItemQty(1);
        setItemPrice('');
        setExpenseDescription('');
        setExpenseAmount('');
        setPaymentAmount('');
        setPaymentMethod('Dinheiro');
        setPaymentNote('');
        setInstallmentCount(2);
        setInstallmentIntervalDays(30);
        setFirstDueDate('');
    };

    
    const printOrder = async (order) => {
        try {
            const payableTotal = resolveOrderTotal(order);
            // Com Mercado Pago ativo, nunca mistura a cobrança com a chave PIX fixa.
            const txid = `OS${order.id.substring(0,10).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
            let mercadoPagoPix = pixPayments[order.id]?.qrCode;
            if (mpConfigured && order.paymentStatus !== 'Pago' && !mercadoPagoPix) {
                const customer = customers.find((item: any) => item.id === order.customerId);
                const payerEmail = order.clientEmail || customer?.email;
                if (!payerEmail) {
                    showToast.error('Informe o e-mail do cliente antes de gerar o PDF com PIX.');
                    return;
                }
                const result = await generatePixPayment({
                    amount: payableTotal,
                    description: `${order.orderType === 'Venda Direta' ? 'Venda' : 'O.S.'} ${serviceOrderReference(order)}`,
                    payerEmail,
                    payerName: order.clientName,
                    externalReference: order.id,
                    referenceType: 'service_order',
                });
                if (!result.success || !result.qrCode) return;
                const payment = { ...result, status: 'pending' };
                mercadoPagoPix = result.qrCode;
                setPixPayments(prev => ({ ...prev, [order.id]: payment }));
            }
            const pixPayload = order.paymentStatus === 'Pago'
                ? null
                : mpConfigured
                ? (mercadoPagoPix || null)
                : generatePixPayload(tenant.pixKey, tenant.pixName, tenant.city || 'Manaus', payableTotal, txid);

            const isVenda = order.orderType === 'Venda Direta';
            const termsText = !isVenda
                ? `Garantia: ${order.warranty || '90 dias'}, contada da retirada, válida para o serviço e as peças substituídas. Não cobre mau uso, oxidação, quedas, líquidos, surtos elétricos ou violação do lacre. Equipamentos não retirados em até 90 dias após o aviso poderão receber destinação adequada.`
                : '';
            const paidAmount = Number(order.paidTotal) || (order.payments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0);
            const openBalance = Math.max(0, payableTotal - paidAmount);

            const itemRows = (order.items || []).map(item => [
                item.type || '-',
                item.name || '-',
                String(item.qty || 1),
                `R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${(Number(item.price || 0) * (item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]);
            if (itemRows.length === 0) {
                itemRows.push([
                    isVenda ? 'Venda' : 'Serviço',
                    'Valor informado manualmente',
                    '1',
                    `R$ ${payableTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${payableTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                ]);
            }

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
                title: isVenda ? 'RECIBO DE VENDA — VIA DO CLIENTE' : 'ORDEM DE SERVIÇO — VIA DO CLIENTE',
                documentNumber: serviceOrderReference(order),
                customerInfo: [
                    order.clientName,
                    formatBrazilianPhone(order.clientPhone) || 'Sem telefone',
                    order.clientEmail || 'Sem e-mail'
                ],
                documentInfo,
                tableColumns: ['Tipo', 'Item', 'Qtd', 'V. Unit', 'Total'],
                tableRows: itemRows,
                totalLabel: 'TOTAL A PAGAR:',
                totalValue: payableTotal,
                terms: termsText,
                pixPayload: pixPayload,
                premiumStyle: true,
                compactStyle: true,
                summaryRows: [
                    { label: 'TOTAL PAGO', value: `R$ ${paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: [36, 65, 180] },
                    { label: 'SALDO EM ABERTO', value: `R$ ${openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: openBalance > 0 ? [217, 119, 6] : [22, 163, 74] },
                    { label: 'SITUAÇÃO', value: order.paymentStatus || (openBalance === 0 ? 'PAGO' : 'PENDENTE'), color: openBalance === 0 ? [22, 163, 74] : [217, 119, 6] },
                ],
                paymentRows: (order.payments || []).map(payment => [new Date(payment.paidAt).toLocaleString('pt-BR'), payment.method || '-', `R$ ${Number(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, payment.note || '']),
                signatureLabels: ['Assinatura do cliente', tenant.shortName || tenant.businessName || 'Empresa'],
                filename: `OS_${serviceOrderNumber(order)}.pdf`
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

    const sendOrderEmail = async (order: any, automatic = false) => {
        const customer = customers.find((item: any) => item.id === order.customerId);
        const email = order.clientEmail || customer?.email;
        if (!email) {
            if (!automatic) showToast.error('Cadastre o e-mail do cliente antes de enviar a O.S.');
            return false;
        }

        try {
            const total = resolveOrderTotal(order);
            const isVenda = order.orderType === 'Venda Direta';
            const paid = Number(order.paidTotal) || (order.payments || []).reduce(
                (sum: number, payment: any) => sum + Number(payment.amount || 0), 0
            );
            const balance = Math.max(0, total - paid);
            const rows = (order.items || []).map((item: any) => [
                item.type || '-', item.name || '-', String(item.qty || 1),
                `R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${(Number(item.price || 0) * (Number(item.qty) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            ]);
            if (!rows.length) rows.push([
                isVenda ? 'Venda' : 'Serviço', 'Valor informado manualmente', '1',
                `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            ]);

            const pdf = await generateProfessionalPDF({
                tenant,
                title: isVenda ? 'RECIBO DE VENDA' : 'ORDEM DE SERVIÇO',
                documentNumber: serviceOrderReference(order),
                customerInfo: [order.clientName || 'Cliente', formatBrazilianPhone(order.clientPhone) || 'Sem telefone', email],
                documentInfo: [
                    { label: 'Emissão:', value: new Date(order.createdAt || Date.now()).toLocaleDateString('pt-BR') },
                    { label: 'Status:', value: order.status || 'Aberta' },
                    ...(!isVenda && order.device ? [{ label: 'Equipamento:', value: order.device }] : []),
                    ...(!isVenda && order.warranty ? [{ label: 'Garantia:', value: order.warranty }] : []),
                ],
                tableColumns: ['Tipo', 'Item', 'Qtd', 'V. Unit', 'Total'],
                tableRows: rows,
                totalLabel: 'VALOR TOTAL:',
                totalValue: total,
                terms: isVenda ? '' : `Garantia de ${order.warranty || '90 dias'} para peças e serviços, contada da data de retirada. A garantia cobre exclusivamente o serviço executado e/ou as peças substituídas. Não cobre danos por mau uso, oxidação, quedas, contato com líquidos, surtos elétricos ou violação do lacre técnico.`,
                pixPayload: mpConfigured ? pixPayments[order.id]?.qrCode : generatePixPayload(tenant.pixKey, tenant.pixName, tenant.city || 'Manaus', balance || total, `OS${String(order.id).replace(/-/g, '').slice(0, 10).toUpperCase()}`),
                premiumStyle: true,
                summaryRows: [
                    { label: 'TOTAL PAGO', value: `R$ ${paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: [36, 65, 180] },
                    { label: 'SALDO EM ABERTO', value: `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: balance > 0 ? [217, 119, 6] : [22, 163, 74] },
                    { label: 'SITUAÇÃO', value: order.paymentStatus || (balance === 0 ? 'PAGO' : 'PENDENTE'), color: balance === 0 ? [22, 163, 74] : [217, 119, 6] },
                ],
                paymentRows: (order.payments || []).map((payment: any) => [
                    new Date(payment.paidAt).toLocaleString('pt-BR'), payment.method || '-',
                    `R$ ${Number(payment.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, payment.note || '',
                ]),
                signatureLabels: ['Assinatura do cliente', tenant.shortName || tenant.businessName || 'Empresa'],
                filename: `OS_${serviceOrderNumber(order)}.pdf`,
                returnBase64: true,
                save: false,
            });
            if (!pdf?.base64) throw new Error('Não foi possível montar o PDF.');

            return await notify({
                channel: 'email',
                to: email,
                subject: `${isVenda ? 'Recibo de venda' : 'Ordem de Serviço'} ${serviceOrderReference(order)} — ${tenant?.businessName || 'Feitosa Soluções'}`,
                message: `Olá, ${order.clientName || 'cliente'}!\n\nSua ${isVenda ? 'venda' : 'Ordem de Serviço'} está com status “${order.status || 'Aberta'}”.\nValor total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\nSituação do pagamento: ${order.paymentStatus || 'Pendente'}.\n\nO documento completo segue em anexo.`,
                pdfBase64: pdf.base64,
                pdfFilename: pdf.filename,
            });
        } catch (error: any) {
            console.error(error);
            if (!automatic) showToast.error(error?.message || 'Não foi possível enviar a O.S. por e-mail.');
            return false;
        }
    };

    const generateTestServiceInvoice = async (order: any) => {
        try {
            if (order.orderType === 'Venda Direta') {
                showToast.error('A nota de serviço de teste está disponível somente para ordens de serviço.');
                return;
            }

            const customer = customers.find((item: any) => item.id === order.customerId);
            const serviceItems = (order.items || []).filter((item: any) =>
                String(item.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().startsWith('servi')
            );
            const serviceTotal = serviceItems.length > 0
                ? calculateItemsTotal(serviceItems)
                : resolveOrderTotal(order);

            if (!order.clientName || serviceTotal <= 0) {
                showToast.error('Informe o cliente e um valor de serviço maior que zero antes do teste.');
                return;
            }

            const issuedAt = order.testServiceInvoice?.issuedAt || new Date().toISOString();
            const testNumber = order.testServiceInvoice?.number
                || `TEST-${new Date(issuedAt).getFullYear()}-${String(order.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
            const rows = serviceItems.length > 0
                ? serviceItems.map((item: any) => [
                    item.name || 'Serviço',
                    String(item.qty || 1),
                    `R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                ])
                : [[
                    order.issueDescription || order.orderType || 'Serviço informado na ordem de serviço',
                    '1',
                    `R$ ${serviceTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                    `R$ ${serviceTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                ]];

            const customerDocument = customer?.cpfCnpj || customer?.document || '';
            const customerAddress = customer?.address || '';
            const generated = await generateProfessionalPDF({
                tenant,
                title: 'NFS-e DE TESTE',
                documentNumber: testNumber,
                customerInfo: [
                    order.clientName,
                    customerDocument ? `CPF/CNPJ: ${customerDocument}` : 'CPF/CNPJ: não informado',
                    customerAddress || order.clientEmail || 'Endereço: não informado',
                ],
                documentInfo: [
                    { label: 'Emissão:', value: new Date(issuedAt).toLocaleString('pt-BR') },
                    { label: 'Ambiente:', value: 'TESTE LOCAL' },
                    { label: 'Situação:', value: 'SIMULADA' },
                    { label: 'Referência:', value: `O.S. ${serviceOrderReference(order)}` },
                ],
                tableColumns: ['Descrição do serviço', 'Qtd', 'V. Unit.', 'Total'],
                tableRows: rows,
                totalLabel: 'TOTAL DOS SERVIÇOS:',
                totalValue: serviceTotal,
                terms: 'DOCUMENTO DE SIMULAÇÃO SEM VALIDADE FISCAL. Esta nota não foi assinada, autorizada nem transmitida à Prefeitura, à SEFIN Nacional ou ao Ambiente de Dados Nacional. Uso exclusivo para validação interna do sistema.',
                filename: `NFSe_TESTE_${testNumber}.pdf`,
                testMode: true,
            });

            if (!generated) {
                showAlert('Erro', 'Não foi possível gerar a nota de serviço de teste.');
                return;
            }

            const saved = await saveOrder({
                ...order,
                testServiceInvoice: {
                    number: testNumber,
                    status: 'SIMULADA',
                    environment: 'TESTE_LOCAL',
                    issuedAt,
                    serviceTotal,
                },
            });
            if (saved) showToast.success('Nota de serviço de teste gerada. Nenhum dado foi enviado ao governo.');
        } catch (error) {
            console.error(error);
            showAlert('Erro', 'Erro ao gerar a nota de serviço de teste.');
        }
    };

    const issueNfseHomologation = (order: any) => {
        showConfirm(
            'Transmitir NFS-e em homologação',
            'A DPS será assinada com o certificado A1 e enviada ao ambiente oficial de testes da NFS-e Nacional. O documento não terá validade fiscal. Deseja continuar?',
            async () => {
                setIssuingNfseId(order.id);
                try {
                    const response = await fetch(`/api/store/${tenant.storeSlug}/nfse/issue/${order.id}`, {
                        method: 'POST', headers,
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.message || 'A NFS-e não foi autorizada em homologação.');
                    showToast.success('NFS-e autorizada no ambiente oficial de homologação.');
                    await fetchData();
                } catch (error: any) {
                    showAlert('NFS-e não autorizada', error.message || 'Não foi possível transmitir a NFS-e.');
                    await fetchData();
                } finally {
                    setIssuingNfseId('');
                }
            }
        );
    };

    const viewNfseHomologation = async (order: any) => {
        const preview = window.open('', '_blank');
        try {
            if (preview) preview.document.write('<title>Gerando DANFSe...</title><p style="font-family:Arial;padding:24px">Gerando DANFSe de homologação...</p>');
            const customer = customers.find((item: any) => item.id === order.customerId) || null;
            const generated = await generateDanfsePDF({
                tenant,
                config: nfseConfig,
                order,
                customer,
                nfse: order.nfseHomologation,
            });
            if (!generated.success || !generated.url) throw new Error('Não foi possível gerar o DANFSe.');
            if (preview) preview.location.href = generated.url;
            else window.open(generated.url, '_blank');
        } catch (error: any) {
            preview?.close();
            showAlert('Erro', error.message || 'Não foi possível visualizar a NFS-e.');
        }
    };


    const getStatusColor = (status) => {
        switch (status) {
            case 'Aberta': return 'var(--color-accent)';
            case 'Em Andamento': return '#3b82f6';
            case 'Aguardando Peça': return '#f59e0b';
            case 'Aprovando Orçamento': return '#8b5cf6';
            case 'Concluída': return 'var(--color-success)';
            case 'Finalizada': return 'var(--color-success)';
            case 'Entregue': return '#10b981';
            case 'Paga': return '#10b981';
            case 'Pago': return '#10b981';
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
            case 'Finalizada':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'Entregue':
                return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
            case 'Pago':
            case 'Paga':
                return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40';
            case 'Cancelada':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
        }
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredOrders = [...orders]
        .filter(o =>
            o.clientName?.toLowerCase().includes(normalizedSearch) ||
            o.device?.toLowerCase().includes(normalizedSearch) ||
            String(o.id || '').toLowerCase().includes(normalizedSearch) ||
            serviceOrderNumber(o).toLowerCase().includes(normalizedSearch)
        )
        .sort((left, right) => {
            const dateDifference = new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
            if (dateDifference !== 0) return dateDifference;
            return Number(right.orderNumber || 0) - Number(left.orderNumber || 0);
        });

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
                            {orders.filter(o => ['Concluída', 'Finalizada', 'Entregue', 'Aprovada', 'Paga', 'Pago'].includes(o.status)).length}
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
                                <input aria-label="Buscar cliente pelo início do nome" placeholder="Digite as primeiras letras do cliente…" list="os-customer-names"
                                    className="w-full mb-2 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200"
                                    onChange={event => {
                                        const match = customers.find(customer => `${customer.name} — ${customer.phone || customer.email || customer.id}` === event.target.value);
                                        if (match) handleCustomerChange({ target: { value: match.id } });
                                    }} />
                                <datalist id="os-customer-names">
                                    {[...customers].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')).map(customer => <option key={customer.id} value={`${customer.name} — ${customer.phone || customer.email || customer.id}`} />)}
                                </datalist>
                                <select 
                                    value={formData.customerId} 
                                    onChange={handleCustomerChange} 
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">-- Selecione ou digite manualmente abaixo --</option>
                                    {[...customers].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })).map(c => (
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
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={15}
                                    placeholder="(92) 99999-9999"
                                    value={formData.clientPhone} 
                                    onChange={e => setFormData({ ...formData, clientPhone: formatBrazilianPhone(e.target.value) })}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
                                    required 
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    E-mail do cliente {formData.orderType === 'Venda Direta' ? '*' : ''}
                                </label>
                                <input
                                    type="email"
                                    name="clientEmail"
                                    placeholder="cliente@email.com — necessário para gerar PIX pelo Mercado Pago"
                                    value={formData.clientEmail}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    required={formData.orderType === 'Venda Direta' && mpConfigured}
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
                                            Aparelho / Equipamento (opcional)
                                        </label>
                                        <input 
                                            name="device" 
                                            placeholder="Ex: Notebook Dell Inspiron 15" 
                                            value={formData.device} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" 
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
                                            Defeito Relatado (opcional)
                                        </label>
                                        <textarea 
                                            name="issueDescription" 
                                            placeholder="O que o cliente relatou?" 
                                            value={formData.issueDescription} 
                                            onChange={handleChange} 
                                            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[80px] resize-y" 
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
                                    onChange={e => handleSelectedItemChange(e.target.value)}
                                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                >
                                    <option value="">-- Adicionar Produto ou Serviço --</option>
                                    {inventory.map(item => (
                                        <option key={item.id} value={String(item.id)}>{item._label}</option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Valor na O.S."
                                        value={itemPrice}
                                        onChange={e => setItemPrice(e.target.value)}
                                        className="w-32 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                        title="Valor aplicado somente nesta ordem de serviço"
                                    />
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
                                                        {Number.isFinite(Number(it.catalogPrice)) && (
                                                            <div className="text-[10px] text-slate-500 mt-1">Cadastro: R$ {Number(it.catalogPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center text-slate-300">{it.qty}</td>
                                                    <td className="p-3 text-right text-slate-300">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-xs text-slate-500">R$</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={Number(it.price || 0)}
                                                                onChange={event => handleOrderItemPriceChange(idx, event.target.value)}
                                                                className="w-24 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-right text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                                aria-label={`Valor de ${it.name} nesta ordem de serviço`}
                                                            />
                                                        </div>
                                                    </td>
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

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className="bg-slate-950/40 rounded-2xl border border-slate-800/80 p-5 space-y-4">
                                <h4 className="text-sm font-semibold text-rose-300">Despesas desta O.S.</h4>
                                <div className="grid grid-cols-[1fr_120px_auto] gap-2">
                                    <input value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} placeholder="Descrição da despesa" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200" />
                                    <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-right text-slate-200" />
                                    <button type="button" onClick={handleAddExpense} className="px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white">Adicionar</button>
                                </div>
                                {formData.expenses.map((expense, index) => (
                                    <div key={expense.id || index} className="flex items-center justify-between gap-3 text-sm border-t border-slate-800 pt-2">
                                        <span className="text-slate-300">{expense.description}</span>
                                        <div className="flex items-center gap-2"><span className="font-semibold text-rose-300">R$ {Number(expense.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><button type="button" onClick={() => setFormData({ ...formData, expenses: formData.expenses.filter((_, i) => i !== index) })} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-slate-950/40 rounded-2xl border border-slate-800/80 p-5 space-y-4">
                                <h4 className="text-sm font-semibold text-emerald-300">Pagamentos da O.S.</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200">
                                        <option value="Dinheiro">Dinheiro</option><option value="PIX">PIX</option><option value="Crédito">Crédito</option><option value="Débito">Débito</option><option value="A prazo">Pagamento a prazo</option>
                                    </select>
                                    {paymentMethod !== 'A prazo' && <>
                                        <input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Valor recebido" inputMode="decimal" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200" />
                                        <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Observação" className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200" />
                                        <button type="button" onClick={() => setPaymentAmount(String(balanceDue || finalTotal))} className="px-3 py-2 rounded-xl border border-slate-700 text-sm text-slate-300 hover:bg-slate-800">Usar saldo total</button>
                                        <button type="button" onClick={handleAddPayment} className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white">Registrar pagamento</button>
                                    </>}
                                </div>
                                {paymentMethod === 'A prazo' && (
                                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <label className="text-[11px] text-slate-400">Parcelas<input type="number" min="1" max="60" value={installmentCount} onChange={e => setInstallmentCount(Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200" /></label>
                                            <label className="text-[11px] text-slate-400">Dias entre parcelas<input type="number" min="1" max="365" value={installmentIntervalDays} onChange={e => setInstallmentIntervalDays(Number(e.target.value))} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200" /></label>
                                            <label className="text-[11px] text-slate-400">1º vencimento<input type="date" value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)} className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-sm text-slate-200" /></label>
                                        </div>
                                        <button type="button" onClick={handleGenerateInstallments} className="w-full px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold">Calcular vencimentos</button>
                                    </div>
                                )}
                                {formData.installments.length > 0 && (
                                    <div className="rounded-xl border border-slate-800 overflow-hidden">
                                        {reconcileInstallments(formData).map((installment, index) => (
                                            <div key={installment.id || index} className="flex items-center justify-between gap-3 px-3 py-2 text-xs border-b last:border-0 border-slate-800">
                                                <span className="text-slate-300">{installment.number || index + 1}/{formData.installments.length} · vence {new Date(`${installment.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                                                <span className={installment.status === 'Pago' ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>R$ {Number(installment.amount ?? installment.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {installment.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {formData.payments.map((payment, index) => (
                                    <div key={payment.id || index} className="flex items-center justify-between gap-3 text-sm border-t border-slate-800 pt-2">
                                        <span className="text-slate-300">{payment.method} · {new Date(payment.paidAt).toLocaleString('pt-BR')}</span>
                                        <div className="flex items-center gap-2"><span className="font-semibold text-emerald-300">R$ {Number(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><button type="button" onClick={() => setFormData({ ...formData, payments: formData.payments.filter((_, i) => i !== index) })} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Fechamento & Totais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end border-t border-slate-800/80 pt-6">
                            <div className="grid grid-cols-1 gap-4">
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
                                    <option value="Finalizada">Finalizada</option>
                                    <option value="Paga">Paga</option>
                                    <option value="Pago">Pago (legado)</option>
                                    <option value="Cancelada">Cancelada</option>
                                </select>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Situação do pagamento</label>
                                    <select name="paymentStatus" value={formData.paymentStatus} onChange={handleChange} className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-base font-medium text-slate-200">
                                        <option value="Pendente">Pendente</option><option value="Parcial">Parcial</option><option value="Pago">Pago</option><option value="Cancelado">Cancelado</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 flex flex-col items-end gap-1.5 shadow-inner">
                                <div className="text-xs font-medium text-slate-400">
                                    Subtotal dos itens: <span className="text-slate-200 font-semibold">R$ {calculatedTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="text-xs text-slate-400">Custo dos itens: <span className="text-rose-300 font-semibold">R$ {itemCostTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                <div className="text-xs text-slate-400">Despesas: <span className="text-rose-300 font-semibold">R$ {orderExpenseTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                <div className="text-xs text-slate-400">Lucro líquido: <span className={netProfit >= 0 ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                <div className="text-xs text-slate-400">Total pago: <span className="text-blue-300 font-semibold">R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> · Saldo: <span className="text-amber-300 font-semibold">R$ {balanceDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
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
                                                {serviceOrderReference(order)}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <div className="font-semibold text-slate-100">{order.clientName}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{formatBrazilianPhone(order.clientPhone) || 'Sem telefone'}</div>
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
                                            {order.testServiceInvoice?.status === 'SIMULADA' && (
                                                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                    NFS-e teste
                                                </span>
                                            )}
                                            {order.nfseHomologation?.status && (
                                                <span className={`inline-flex mt-1 ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${order.nfseHomologation.status === 'AUTORIZADA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                                    NFS-e homol. {order.nfseHomologation.status.toLowerCase()}
                                                </span>
                                            )}
                                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${order.paymentStatus === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : order.paymentStatus === 'Parcial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                {order.paymentStatus || 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {!mpConfigured || order.paymentStatus === 'Pago' ? null : pixPayments[order.id]?.qrCode ? (
                                                    <button
                                                        onClick={() => setPixModal({ order, payment: pixPayments[order.id] })}
                                                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                        title="Exibir QR Code PIX"
                                                    >
                                                        <QrCode size={14} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleMPPayment(order)}
                                                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"
                                                        title="Gerar QR Code PIX pelo Mercado Pago"
                                                    >
                                                        <CreditCard size={14} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => printOrder(order)} 
                                                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer" 
                                                    title="Imprimir via do cliente"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => sendOrderEmail(order)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all cursor-pointer"
                                                    title="Enviar O.S. premium por e-mail"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                </button>
                                                {order.orderType !== 'Venda Direta' && (
                                                    <button
                                                        onClick={() => generateTestServiceInvoice(order)}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all cursor-pointer"
                                                        title={order.testServiceInvoice ? 'Gerar novamente a NFS-e de teste' : 'Gerar NFS-e de teste (sem valor fiscal)'}
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {nfseHomologationEnabled && order.orderType !== 'Venda Direta' && order.nfseHomologation?.status !== 'AUTORIZADA' && (
                                                    <button
                                                        onClick={() => issueNfseHomologation(order)}
                                                        disabled={issuingNfseId === order.id}
                                                        className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition-all cursor-pointer disabled:animate-pulse disabled:opacity-50"
                                                        title="Transmitir NFS-e ao ambiente oficial de homologação"
                                                    >
                                                        <ShieldCheck className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {order.nfseHomologation?.status === 'AUTORIZADA' && (
                                                    <button
                                                        onClick={() => viewNfseHomologation(order)}
                                                        className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                                                        title="Ver NFS-e autorizada em homologação"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                )}
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

            {pixModal && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPixModal(null)}>
                    <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-xl font-bold text-white">PIX da venda {serviceOrderReference(pixModal.order)}</h3>
                                <p className="text-sm text-slate-400">{pixModal.order.clientName} — R$ {resolveOrderTotal(pixModal.order).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <button onClick={() => setPixModal(null)} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        {pixModal.payment.status === 'approved' ? (
                            <div className="py-10 text-center rounded-xl border border-emerald-400/30 bg-emerald-500/10">
                                <CheckCircle className="w-20 h-20 mx-auto text-emerald-400 mb-4" />
                                <p className="text-2xl font-bold text-emerald-400">Pagamento confirmado!</p>
                                <p className="text-sm text-slate-300 mt-2">A venda foi baixada automaticamente.</p>
                            </div>
                        ) : (
                            <div className="grid gap-5 sm:grid-cols-[210px_1fr]">
                                <div className="bg-white rounded-xl p-3">
                                    <img src={`data:image/png;base64,${pixModal.payment.qrCodeBase64}`} alt="QR Code PIX" className="w-full aspect-square object-contain" />
                                </div>
                                <div className="min-w-0 space-y-3">
                                    <p className="font-semibold text-emerald-400">Aguardando pagamento</p>
                                    <p className="text-xs text-slate-400">A confirmação será consultada automaticamente.</p>
                                    <textarea readOnly value={pixModal.payment.qrCode} className="w-full h-28 resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300 font-mono" />
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => copyLinkToClipboard(pixModal.payment.qrCode)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm flex items-center gap-2">
                                            <Copy className="w-4 h-4" /> Copiar PIX
                                        </button>
                                        {pixModal.payment.ticketUrl && <a href={pixModal.payment.ticketUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm flex items-center gap-2">
                                            <ExternalLink className="w-4 h-4" /> Abrir pagamento
                                        </a>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceOrdersManager;
