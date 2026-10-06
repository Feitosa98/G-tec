import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../hooks/useData';
import { Plus, Trash2, Edit, CalendarClock, Printer, Search, FileText } from 'lucide-react';
import { showToast } from '../../utils/toast';
import { jsPDF } from 'jspdf';
import { generateProfessionalPDF } from '../../utils/pdfGenerator';
import { contractBillingRows } from '../../utils/contractBilling';
import { downloadReceiptPdf } from '../../utils/receiptPdf';

// Função para gerar o Payload PIX (Copia e Cola e QR Code)
function generatePixPayload(key, name, city, amount, txid = '***') {
    if (!key || !name) return null;
    
    // Tratamento robusto da chave PIX
    let rawKey = key.trim();
    let cleanKey = rawKey;
    const isEmail = rawKey.includes('@');
    const numbersOnly = rawKey.replace(/\D/g, '');
    
    if (!isEmail) {
        if (rawKey.length === 36 && rawKey.includes('-')) {
            // É chave aleatória (UUID), mantém os hifens
            cleanKey = rawKey.toLowerCase();
        } else if (numbersOnly.length === 11 && !rawKey.startsWith('+')) {
            // Se tem 11 dígitos, pode ser CPF ou Celular sem +55.
            // Para garantir, vamos assumir que se o usuário não botou +, e tem 11 dígitos, pode ser CPF.
            // Mas se for celular, precisaria do +55. A regra geral do BACEN para CPF é 11 dígitos numéricos.
            cleanKey = numbersOnly;
        } else if (numbersOnly.length === 14) {
            // CNPJ
            cleanKey = numbersOnly;
        } else if ((numbersOnly.length === 12 || numbersOnly.length === 13) || rawKey.startsWith('+')) {
            // É telefone celular (com ou sem DDI preenchido incorretamente)
            cleanKey = numbersOnly.length <= 11 ? `+55${numbersOnly}` : `+${numbersOnly}`;
        } else {
            // Fallback: deixa apenas letras e números (remove parênteses, etc)
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

const SubscriptionsManager = () => {
    const { tenant, sales, registerSale, markInstallmentPaid, attachInstallmentReceipt, showConfirm, showAlert } = useData();
    const [receiptRow, setReceiptRow] = useState<any>(null);
    const [receiptMethod, setReceiptMethod] = useState('PIX');
    const [receiving, setReceiving] = useState(false);
    const receivingRef = useRef(false);
    const makeReceipt = async (row: any, method: string, paidAt: string) => {
        const date = paidAt ? new Date(paidAt).toLocaleDateString('pt-BR') : 'Não informada';
        const result = await generateProfessionalPDF({
            tenant, title: 'RECIBO', documentNumber: String(row.saleId).slice(-20), customerHeading: 'Recebido de:',
            customerInfo: [row.client, `Contrato: ${row.contract}`],
            documentInfo: [{ label: 'Data:', value: date }, { label: 'Forma:', value: method || 'Não informada' }],
            tableColumns: ['Descrição', 'Valor recebido'],
            tableRows: [[`Mensalidade - ${row.contract}\nVencimento: ${row.due ? row.due.split('-').reverse().join('/') : 'Não informado'}`, currency(row.total)]],
            columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, halign: 'right' } },
            totalLabel: 'TOTAL RECEBIDO:', totalValue: row.total,
            termsHeading: 'COMPROVANTE DE RECEBIMENTO',
            terms: `Declaramos o recebimento de ${currency(row.total)} de ${row.client}, referente à mensalidade do contrato ${row.contract}. Mensalidade quitada. Este recibo não substitui uma nota fiscal.`,
            filename: `Recibo_Mensalidade_${String(row.saleId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, returnBase64: true,
        });
        if (!result?.success) throw new Error('Não foi possível gerar o recibo PDF.');
        return { name: result.filename, base64: result.base64, generatedAt: new Date().toISOString() };
    };
    const receiveMonthly = async () => {
        if (!receiptRow || receivingRef.current) return;
        receivingRef.current = true;
        setReceiving(true);
        try {
            const pdf = await makeReceipt(receiptRow, receiptMethod, new Date().toISOString());
            if (!await markInstallmentPaid(receiptRow.saleId, receiptRow.installmentId, receiptMethod, receiptRow.total - receiptRow.paid, 0, pdf)) throw new Error('Não foi possível receber a mensalidade. Atualize a página e confira a situação.');
            showToast.success('Mensalidade recebida. Recibo PDF disponível.');
            setReceiptRow(null);
        } catch (error: any) { showToast.error(error.message || 'Falha ao receber mensalidade.'); }
        finally { receivingRef.current = false; setReceiving(false); }
    };
    const downloadMonthlyReceipt = async (row: any) => {
        if (receivingRef.current) return;
        receivingRef.current = true;
        setReceiving(true);
        try {
            let pdf = row.receiptPdf;
            if (!pdf) {
                pdf = await makeReceipt(row, row.paymentMethod, row.paidAt);
                if (!await attachInstallmentReceipt(row.saleId, row.installmentId, pdf)) throw new Error('Não foi possível salvar o recibo.');
            }
            downloadReceiptPdf(pdf);
        } catch (error: any) { showToast.error(error.message || 'Falha ao gerar recibo.'); }
        finally { receivingRef.current = false; setReceiving(false); }
    };
    const savingRef = useRef(false);
    const draftId = useRef(crypto.randomUUID());
    const [saving, setSaving] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState('Todos');
    const [activeTab, setActiveTab] = useState('faturamento');
    const [billingStatus, setBillingStatus] = useState('Todos');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exporting, setExporting] = useState(false);
    const [contractFilter, setContractFilter] = useState('Todos');
    const billingRef = useRef(new Set<string>());
    const [subscriptions, setSubscriptions] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [plans, setPlans] = useState([]);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSub, setEditingSub] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState({
        customerId: '', planId: '', customPrice: '', billingCycle: 'Mensal', nextDueDate: '', endDate: '', status: 'Ativo'
    });

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
            const [subsRes, custRes, servRes] = await Promise.all([
                fetch(`/api/store/${tenant.storeSlug}/subscriptions`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/customers`, { headers }),
                fetch(`/api/store/${tenant.storeSlug}/services`, { headers })
            ]);

            if (subsRes.ok) setSubscriptions(await subsRes.json());
            if (custRes.ok) setCustomers(await custRes.json());
            if (servRes.ok) {
                const services = await servRes.json();
                setPlans(services.filter(s => s.isPlan === true));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const saveSubscription = async (subData) => {
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/subscriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify(subData)
            });
            if (res.ok) {
                fetchData();
                return true;
            }
            return false;
        } catch (error) {
            console.error(error);
            showToast.error('Erro ao salvar contrato.');
            return false;
        }
    };

    const removeSubscription = async (id) => {
        showConfirm('Excluir Contrato', 'Deseja cancelar e excluir este contrato?', async () => {
            try {
                const response = await fetch(`/api/store/${tenant.storeSlug}/subscriptions/${id}`, {
                    method: 'DELETE',
                    headers
                });
                if (response.ok) {
                    setSubscriptions(subscriptions.filter(s => s.id !== id));
                }
            } catch (error) {
                console.error(error);
                showAlert('Erro', 'Não foi possível excluir o contrato.');
            }
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePlanChange = (e) => {
        const planId = e.target.value;
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setFormData({ ...formData, planId, customPrice: plan.price });
        } else {
            setFormData({ ...formData, planId: '', customPrice: '' });
        }
    };

    const handleEdit = (sub) => {
        setEditingSub(sub);
        setFormData({
            customerId: sub.customerId,
            planId: sub.planId,
            customPrice: sub.customPrice,
            billingCycle: sub.billingCycle,
            nextDueDate: sub.nextDueDate.substring(0, 10),
            endDate: sub.endDate ? sub.endDate.substring(0, 10) : '',
            status: sub.status
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (savingRef.current) return;
        
        const customer = customers.find(c => c.id === formData.customerId);
        const plan = plans.find(p => p.id === formData.planId);
        
        if (!customer || !plan) {
            showToast.error('Selecione um cliente e um plano.');
            return;
        }

        let finalDate = formData.endDate;
        if (!finalDate && formData.nextDueDate) {
            const defaultEnd = new Date(formData.nextDueDate);
            defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
            finalDate = defaultEnd.toISOString().substring(0, 10);
        }

        const subData = {
            id: editingSub ? editingSub.id : draftId.current,
            customerId: customer.id,
            clientName: customer.name,
            planId: plan.id,
            planName: plan.name,
            customPrice: Number(formData.customPrice),
            billingCycle: formData.billingCycle,
            nextDueDate: new Date(formData.nextDueDate).toISOString(),
            endDate: new Date(finalDate).toISOString(),
            status: formData.status,
            createdAt: editingSub ? editingSub.createdAt : new Date().toISOString()
        };

        savingRef.current = true;
        setSaving(true);
        const success = await saveSubscription(subData);
        savingRef.current = false;
        setSaving(false);
        if (success) {
            draftId.current = crypto.randomUUID();
            showToast.success(`Contrato ${editingSub ? 'atualizado' : 'gerado'} com sucesso!`);
            setIsFormOpen(false);
            setEditingSub(null);
            setFormData({ customerId: '', planId: '', customPrice: '', billingCycle: 'Mensal', nextDueDate: '', endDate: '', status: 'Ativo' });
        }
    };

    const handlePrintContract = (sub) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let cursorY = margin;

        // Cabeçalho
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('TERMO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, cursorY, { align: 'center' });
        cursorY += 15;

        // Corpo
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const text = `Pelo presente instrumento, ${tenant.businessName || 'Empresa'}, CNPJ ${tenant.document || 'Não informado'}, doravante denominada CONTRATADA, e ${sub.clientName}, doravante denominado(a) CONTRATANTE, firmam o presente acordo de prestação de serviços.\n\n` +
            `1. OBJETO: A CONTRATADA compromete-se a fornecer o plano/serviço: "${sub.planName}".\n\n` +
            `2. VALOR E CICLO: O valor acordado é de R$ ${Number(sub.customPrice || sub.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}, com ciclo de cobrança ${sub.billingCycle}.\n\n` +
            `3. VIGÊNCIA: O contrato inicia em ${new Date(sub.nextDueDate).toLocaleDateString('pt-BR')} e encerra em ${sub.endDate ? new Date(sub.endDate).toLocaleDateString('pt-BR') : 'Prazo Indeterminado'}, podendo ser renovado.\n\n` +
            `4. INADIMPLÊNCIA: O atraso no pagamento sujeitará o CONTRATANTE ao pagamento de:\n` +
            `   a) Multa moratória fixa de 6% (seis por cento) sobre o valor devido;\n` +
            `   b) Juros moratórios de 3% (três por cento) ao mês, cobrados pro rata die;\n` +
            `   c) Suspensão imediata da prestação dos serviços após 15 (quinze) dias de atraso;\n` +
            `   d) Encaminhamento do débito a Cartório de Protesto e aos órgãos de proteção ao crédito em caso de persistência na inadimplência.\n\n` +
            `E por estarem de acordo, assinam o presente termo.`;
        
        const splitText = doc.splitTextToSize(text, pageWidth - (margin * 2));
        doc.text(splitText, margin, cursorY);
        cursorY += splitText.length * 5 + 30;

        // Assinaturas
        doc.setDrawColor(0);
        doc.line(margin, cursorY, 90, cursorY);
        doc.line(120, cursorY, pageWidth - margin, cursorY);
        
        doc.setFontSize(10);
        doc.text('CONTRATADA', margin + 35, cursorY + 5, { align: 'center' });
        doc.text('CONTRATANTE', 120 + 35, cursorY + 5, { align: 'center' });

        doc.save(`Contrato_${sub.clientName.replace(/\s+/g, '_')}.pdf`);
    };

    const handleGenerateInvoice = async (sub) => {
        if (billingRef.current.has(sub.id)) return;
        if (!tenant.pixKey || !tenant.pixName) {
            showToast.error("Configure sua Chave PIX e Nome nas Configurações da Loja primeiro!");
            return;
        }

        billingRef.current.add(sub.id);
        try {
            const faturaId = `FAT-${new Date().getMonth()+1}${new Date().getFullYear()}-${sub.id.substring(0,4).toUpperCase()}`;
            const txid = `FAT${sub.id.substring(0,10).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
            const pixPayload = generatePixPayload(tenant.pixKey, tenant.pixName, tenant.city || 'Manaus', sub.customPrice, txid);

            const documentInfo = [
                { label: 'Vencimento:', value: new Date(sub.nextDueDate).toLocaleDateString('pt-BR') },
                { label: 'Ciclo:', value: sub.billingCycle }
            ];

            const success = await generateProfessionalPDF({
                tenant,
                title: 'FATURA',
                documentNumber: `# ${faturaId}`,
                customerInfo: [
                    sub.clientName
                ],
                documentInfo,
                tableColumns: ['Item / Descrição do Plano', 'Valor (R$)'],
                tableRows: [
                    [sub.planName, `R$ ${Number(sub.customPrice || sub.value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`]
                ],
                totalLabel: 'VALOR TOTAL:',
                totalValue: sub.customPrice || sub.value || 0,
                pixPayload,
                terms: 'Documento gerado automaticamente. O atraso no pagamento poderá acarretar suspensão temporária do serviço.',
                filename: `Fatura_${faturaId}_${sub.clientName.replace(/\s+/g, '_')}.pdf`
            });

            if (success) {
                // Mover vencimento para o próximo ciclo
                let nextDate = new Date(sub.nextDueDate);
                if (sub.billingCycle === 'Mensal') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (sub.billingCycle === 'Trimestral') nextDate.setMonth(nextDate.getMonth() + 3);
                else if (sub.billingCycle === 'Semestral') nextDate.setMonth(nextDate.getMonth() + 6);
                else if (sub.billingCycle === 'Anual') nextDate.setFullYear(nextDate.getFullYear() + 1);
                
                // Injetar a fatura nas Cobranças
                const invoiceSale = {
                    id: `contract-${sub.id}-${sub.nextDueDate.substring(0, 10)}`,
                    subscriptionId: sub.id,
                    source: 'subscription',
                    customerId: sub.customerId,
                    customerName: sub.clientName,
                    userEmail: sub.clientName, // Store clientName as fallback
                    total: Number(sub.customPrice ?? sub.value ?? 0),
                    customerPhone: customers.find(customer => customer.id === sub.customerId)?.phone || '',
                    customerEmail: customers.find(customer => customer.id === sub.customerId)?.email || '',
                    paymentStatus: 'Pendente',
                    installments: [{ id: `monthly-contract-${sub.id}-${sub.nextDueDate.substring(0, 10)}`, number: 1, amount: Number(sub.customPrice ?? sub.value ?? 0), value: Number(sub.customPrice ?? sub.value ?? 0), dueDate: sub.nextDueDate.substring(0, 10), status: 'Pendente', paid: false }],
                    paymentTerms: {
                        type: 'terms',
                        installments: 1,
                        firstDueDate: sub.nextDueDate.substring(0, 10)
                    },
                    items: [{ name: `Mensalidade: ${sub.planName} (${sub.billingCycle})`, price: sub.customPrice, quantity: 1, costPrice: 0 }],
                    status: 'Aprovado' // So it goes straight to valid receivables se for o caso
                };
                await registerSale(invoiceSale, 'Faturamento Automático');

                const updatedSub = { ...sub, nextDueDate: nextDate.toISOString() };
                if (!await saveSubscription(updatedSub)) throw new Error('Não foi possível atualizar o vencimento.');
                showToast.success("Fatura gerada e vencimento atualizado!");
            } else {
                showAlert("Erro", "Não foi possível gerar a fatura.");
            }

        } catch (err) {
            console.error(err);
            showAlert("Erro", "Erro ao processar fatura.");
        } finally {
            billingRef.current.delete(sub.id);
        }
    };

    const getStatusInfo = (sub) => {
        if (sub.status !== 'Ativo') {
            return { text: sub.status, className: 'bg-slate-800/60 text-slate-400 border-slate-700/50' };
        }
        
        const now = new Date();
        const due = new Date(sub.nextDueDate);
        now.setHours(0,0,0,0);
        due.setHours(0,0,0,0);
        
        if (due < now) return { text: 'Atrasado', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
        if (due.getTime() === now.getTime()) return { text: 'Vence Hoje', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
        return { text: 'Em Dia', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    };

    const contractAmounts = (sub) => {
        const invoices = sales.filter(sale => sale.subscriptionId === sub.id);
        return invoices.reduce((result, sale) => {
            const total = Number(sale.total) || 0;
            const paid = sale.paymentStatus === 'Pago' || sale.status === 'Pago' ? total
                : sale.paidTotal != null ? Number(sale.paidTotal) || 0
                : (sale.installments || []).filter(item => item.paid || item.status === 'Pago').reduce((sum, item) => sum + (Number(item.amount ?? item.value) || 0), 0);
            result.total += total;
            result.paid += Math.min(total, Math.max(0, paid));
            result.pending += Math.max(0, total - paid);
            result.count += 1;
            return result;
        }, { total: 0, paid: 0, pending: 0, count: 0 });
    };
    const filteredSubs = subscriptions.filter(s => {
        const amounts = contractAmounts(s);
        return (s.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || s.planName?.toLowerCase().includes(searchTerm.toLowerCase()))
            && (contractFilter === 'Todos' || s.status === contractFilter)
            && (paymentFilter === 'Todos' || (paymentFilter === 'Pago' && amounts.count > 0 && amounts.pending === 0)
                || (paymentFilter === 'Pendente' && amounts.pending > 0) || (paymentFilter === 'Sem fatura' && amounts.count === 0));
    }).sort((a, b) => String(a.clientName).localeCompare(String(b.clientName), 'pt-BR'));
    const totals = filteredSubs.reduce((result, sub) => {
        const amount = contractAmounts(sub);
        return { total: result.total + amount.total, paid: result.paid + amount.paid, pending: result.pending + amount.pending };
    }, { total: 0, paid: 0, pending: 0 });
    const currency = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus' }).format(new Date());
    const billingRows = contractBillingRows(sales, subscriptions, today).filter(row =>
        `${row.client} ${row.contract}`.toLocaleLowerCase('pt-BR').includes(searchTerm.toLocaleLowerCase('pt-BR'))
        && (billingStatus === 'Todos' || row.status === billingStatus)
        && (!dateFrom || row.due >= dateFrom) && (!dateTo || (row.due && row.due <= dateTo))
    ).sort((a, b) => a.client.localeCompare(b.client, 'pt-BR') || a.due.localeCompare(b.due));
    const billingTotals = billingRows.reduce((sum, row) => ({ total: sum.total + row.total, paid: sum.paid + row.paid, overdue: sum.overdue + row.overdue, upcoming: sum.upcoming + row.upcoming, undated: sum.undated + row.undated }), { total: 0, paid: 0, overdue: 0, upcoming: 0, undated: 0 });
    const billingCards = [['Total faturado', billingTotals.total], ['Vencido', billingTotals.overdue], ['A vencer', billingTotals.upcoming], ['Pago', billingTotals.paid]];
    const exportBillingPDF = async () => {
        if (exporting) return;
        if (!billingRows.length) { showToast.info('Nenhuma cobrança encontrada para estes filtros.'); return; }
        setExporting(true);
        try {
            const success = await generateProfessionalPDF({
                tenant, title: 'RELATÓRIO DE CONTRATOS', documentNumber: today,
                customerHeading: 'Filtros aplicados:', termsHeading: 'CRITÉRIOS DO RELATÓRIO',
                customerInfo: [`Busca: ${searchTerm || 'Todos os clientes'}`, `Situação: ${billingStatus}`],
                documentInfo: [{ label: 'Vencimentos:', value: `${dateFrom || 'Sem início'} a ${dateTo || 'Sem fim'}` }],
                tableColumns: ['Cliente / Contrato', 'Vencimento', 'Situação', 'Faturado', 'Pago', 'Saldo'],
                tableRows: billingRows.map(row => [`${row.client}\n${row.contract}`, row.due ? row.due.split('-').reverse().join('/') : 'Não informado', row.status, currency(row.total), currency(row.paid), currency(row.total - row.paid)]),
                columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 24 }, 2: { cellWidth: 26 }, 3: { cellWidth: 25, halign: 'right' }, 4: { cellWidth: 25, halign: 'right' }, 5: { cellWidth: 25, halign: 'right' } },
                totalLabel: 'TOTAL:', totalValue: billingTotals.total,
                summaryRows: billingCards.map(([label, value]) => ({ label, value: currency(value) })),
                terms: `Valores das cobranças vinculadas aos contratos, conforme os filtros selecionados. Canceladas excluídas. Vencimentos de hoje integram A vencer. Faturas antigas sem vínculo não estão incluídas.${billingTotals.undated ? ` Saldo sem vencimento: ${currency(billingTotals.undated)}.` : ''}`,
                filename: `Relatorio_Contratos_${today}.pdf`
            });
            if (!success) throw new Error('Falha ao gerar PDF');
        } catch { showToast.error('Não foi possível gerar o relatório. Tente novamente.'); }
        finally { setExporting(false); }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in text-slate-100 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
                        <CalendarClock className="w-8 h-8 text-blue-400 shrink-0" />
                        <span>Contratos e Assinaturas</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Gerencie mensalidades, hospedagens e planos recorrentes com faturamento automatizado.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 text-sm backdrop-blur-md"
                            placeholder="Buscar cliente ou plano..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => { 
                            setActiveTab('contratos');
                            setIsFormOpen(!isFormOpen); 
                            setEditingSub(null); 
                            setFormData({ customerId: '', planId: '', customPrice: '', billingCycle: 'Mensal', nextDueDate: '', endDate: '', status: 'Ativo' }); 
                        }}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 active:scale-[0.98] cursor-pointer whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Novo Contrato</span>
                    </button>
                </div>
            </div>

            <div className="flex gap-3">
                <button type="button" onClick={() => setActiveTab('faturamento')} className={`px-4 py-3 rounded-xl ${activeTab === 'faturamento' ? 'bg-blue-600' : 'bg-slate-800'}`}>Faturamento dos contratos</button>
                <button type="button" onClick={() => setActiveTab('contratos')} className={`px-4 py-3 rounded-xl ${activeTab === 'contratos' ? 'bg-blue-600' : 'bg-slate-800'}`}>Cadastro de contratos</button>
            </div>
            {activeTab === 'faturamento' && <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <label>Situação<select className="block bg-slate-900 p-3 rounded-xl" value={billingStatus} onChange={e => setBillingStatus(e.target.value)}>{['Todos', 'Pago', 'Vencido', 'A vencer', 'Sem vencimento'].map(status => <option key={status}>{status}</option>)}</select></label>
                    <label>Vencimento inicial<input type="date" className="block bg-slate-900 p-3 rounded-xl" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
                    <label>Vencimento final<input type="date" className="block bg-slate-900 p-3 rounded-xl" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} /></label>
                    <button type="button" disabled={exporting || !billingRows.length || (dateFrom && dateTo && dateFrom > dateTo)} onClick={exportBillingPDF} className="bg-blue-600 disabled:opacity-50 rounded-xl p-3">{exporting ? 'Gerando PDF…' : 'Exportar relatório PDF'}</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{billingCards.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><div>{label}</div><strong className="text-xl">{currency(value)}</strong></div>)}</div>
                <p className="text-xs text-slate-400">Totais dos filtros atuais. Faturas antigas sem vínculo não estão incluídas. Vencimentos de hoje entram em A vencer.</p>
                {billingTotals.undated > 0 && <p className="text-amber-400">Saldo sem vencimento informado: {currency(billingTotals.undated)}</p>}
                <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Cliente / Contrato', 'Vencimento', 'Situação', 'Faturado', 'Pago', 'Saldo', 'Ações'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
                    {billingRows.map(row => <tr key={row.id} className="border-t border-slate-800"><td className="p-3">{row.client}<div className="text-slate-400">{row.contract}</div></td><td className="p-3">{row.due ? row.due.split('-').reverse().join('/') : 'Não informado'}</td><td className="p-3">{row.status}</td><td className="p-3">{currency(row.total)}</td><td className="p-3">{currency(row.paid)}</td><td className="p-3">{currency(row.total - row.paid)}</td><td className="p-3">{row.status === 'Pago' ? <button disabled={receiving} onClick={() => downloadMonthlyReceipt(row)} className="bg-blue-600 rounded-lg px-3 py-2 disabled:opacity-50">Recibo PDF</button> : <button disabled={receiving} onClick={() => { setReceiptRow(row); setReceiptMethod('PIX'); }} className="bg-emerald-600 rounded-lg px-3 py-2 disabled:opacity-50">Receber mensalidade</button>}</td></tr>)}
                    {!billingRows.length && <tr><td colSpan={7} className="p-6 text-center">Nenhuma cobrança encontrada.</td></tr>}
                </tbody></table></div>
            </div>}
            {receiptRow && <div role="dialog" aria-modal="true" aria-label="Receber mensalidade" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4"><h2 className="text-xl font-bold">Receber mensalidade</h2><p>{receiptRow.client} · {receiptRow.contract}</p><p>Saldo a receber: <strong>{currency(receiptRow.total - receiptRow.paid)}</strong></p><label className="block">Forma de pagamento<select value={receiptMethod} disabled={receiving} onChange={e => setReceiptMethod(e.target.value)} className="block w-full bg-slate-800 rounded-lg p-3 mt-2">{['PIX', 'Dinheiro', 'Transferência', 'Crédito', 'Débito', 'Boleto'].map(method => <option key={method}>{method}</option>)}</select></label><p className="text-sm text-slate-400">O recibo PDF será salvo junto à mensalidade e ficará disponível para download.</p><div className="flex justify-end gap-3"><button disabled={receiving} onClick={() => setReceiptRow(null)} className="px-3 py-2">Cancelar</button><button disabled={receiving} onClick={receiveMonthly} className="bg-emerald-600 rounded-lg px-3 py-2 disabled:opacity-50">{receiving ? 'Salvando…' : 'Confirmar recebimento'}</button></div></div></div>}
            {activeTab === 'contratos' && <>
            <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                    <select aria-label="Filtrar situação do contrato" value={contractFilter} onChange={e => setContractFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                        {['Todos', 'Ativo', 'Suspenso', 'Cancelado'].map(value => <option key={value}>{value}</option>)}
                    </select>
                    <select aria-label="Filtrar pagamento" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                        {['Todos', 'Pago', 'Pendente', 'Sem fatura'].map(value => <option key={value}>{value}</option>)}
                    </select>
                    <span className="p-3 text-slate-400">{filteredSubs.length} contrato(s) encontrados</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {[['Total faturado', totals.total], ['Total pago', totals.paid], ['Total pendente', totals.pending]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><div className="text-sm text-slate-400">{label}</div><div className="text-xl font-semibold">{currency(value)}</div></div>)}
                </div>
                <p className="text-xs text-slate-400">Totais das faturas vinculadas aos contratos filtrados. Faturas antigas sem vínculo não estão incluídas.</p>
            </div>
            {/* Form Section */}
            {isFormOpen && (
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 transition-all">
                    <h3 className="text-xl font-semibold text-slate-100 border-b border-slate-800/80 pb-4 flex items-center gap-2">
                        {editingSub ? 'Editar Contrato' : 'Firmar Novo Contrato'}
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Cliente</label>
                            <select 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed" 
                                name="customerId" 
                                value={formData.customerId} 
                                onChange={handleChange} 
                                required 
                                disabled={!!editingSub}
                            >
                                <option value="" className="bg-slate-900 text-slate-400">-- Selecione o Cliente --</option>
                                {[...customers].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR')).map(c => <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Plano / Serviço Recorrente</label>
                            <select 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md" 
                                name="planId" 
                                value={formData.planId} 
                                onChange={handlePlanChange} 
                                required
                            >
                                <option value="" className="bg-slate-900 text-slate-400">-- Selecione o Plano --</option>
                                {plans.map(p => <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">{p.name}</option>)}
                            </select>
                            {plans.length === 0 && (
                                <p className="text-xs text-rose-400 mt-1">Cadastre um Serviço marcando "É um plano?" primeiro.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Valor Acordado (R$)</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md" 
                                type="number" 
                                step="0.01" 
                                name="customPrice" 
                                value={formData.customPrice} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Ciclo de Cobrança</label>
                            <select 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md" 
                                name="billingCycle" 
                                value={formData.billingCycle} 
                                onChange={handleChange}
                            >
                                <option value="Mensal" className="bg-slate-900 text-slate-200">Mensal</option>
                                <option value="Trimestral" className="bg-slate-900 text-slate-200">Trimestral</option>
                                <option value="Semestral" className="bg-slate-900 text-slate-200">Semestral</option>
                                <option value="Anual" className="bg-slate-900 text-slate-200">Anual</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Data do (Próximo) Vencimento</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md [color-scheme:dark]" 
                                type="date" 
                                name="nextDueDate" 
                                value={formData.nextDueDate} 
                                onChange={handleChange} 
                                required 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Data Final (Término)</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md [color-scheme:dark]" 
                                type="date" 
                                name="endDate" 
                                value={formData.endDate} 
                                onChange={handleChange} 
                                title="Se vazio, assumirá 1 ano automaticamente." 
                            />
                            <p className="text-xs text-slate-500">Se vazio, assume 1 ano.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Status</label>
                            <select 
                                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm backdrop-blur-md" 
                                name="status" 
                                value={formData.status} 
                                onChange={handleChange}
                            >
                                <option value="Ativo" className="bg-slate-900 text-slate-200">Ativo</option>
                                <option value="Suspenso" className="bg-slate-900 text-slate-200">Suspenso</option>
                                <option value="Cancelado" className="bg-slate-900 text-slate-200">Cancelado</option>
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            disabled={saving}
                            className="md:col-span-2 mt-2 w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all duration-200 active:scale-[0.99] cursor-pointer"
                        >
                            {saving ? 'Salvando…' : editingSub ? 'Salvar Alterações' : 'Salvar Contrato'}
                        </button>
                    </form>
                </div>
            )}

            {/* Table Section */}
            <div className="overflow-hidden bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Plano</th>
                                <th className="px-6 py-4">Valor / Ciclo</th>
                                <th className="px-6 py-4">Próx. Vencimento</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Faturas / Recebimentos</th>
                                <th className="px-6 py-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredSubs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum contrato encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredSubs.map(sub => {
                                    const statusInfo = getStatusInfo(sub);
                                    return (
                                        <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors duration-150">
                                            <td className="px-6 py-4 font-semibold text-slate-100 whitespace-nowrap">
                                                {sub.clientName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                                                {sub.planName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-slate-200">
                                                    R$ {Number(sub.customPrice || sub.value || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {sub.billingCycle}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300 font-mono text-xs whitespace-nowrap">
                                                {sub.nextDueDate ? new Date(sub.nextDueDate).toLocaleDateString('pt-BR') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.className}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs">
                                                <div>Faturado: {currency(contractAmounts(sub).total)}</div>
                                                <div className="text-emerald-400">Pago: {currency(contractAmounts(sub).paid)}</div>
                                                <div className="text-amber-400">Pendente: {currency(contractAmounts(sub).pending)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handlePrintContract(sub)} 
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors cursor-pointer" 
                                                        title="Imprimir Termo de Contrato"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                        <span>Contrato</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleGenerateInvoice(sub)} 
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer" 
                                                        title="Gerar Fatura com PIX"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        <span>Faturar</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleEdit(sub)} 
                                                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer" 
                                                        title="Editar Contrato"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => removeSubscription(sub.id)} 
                                                        className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer" 
                                                        title="Cancelar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </>}
        </div>
    );
};

export default SubscriptionsManager;
