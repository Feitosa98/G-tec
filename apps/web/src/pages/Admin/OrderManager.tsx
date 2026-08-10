import React, { useState, useCallback } from 'react';
import { useData } from '../../hooks/useData';
import { Package, Truck, CheckCircle, XCircle, Search, Eye, FileText, X, MessageCircle, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { showToast } from '../../utils/toast';
import { generateProfessionalPDF } from '../../utils/pdfGenerator';
import { useNotify } from '../../hooks/useNotify';
import BarcodeScanner from '../../components/BarcodeScanner';

const OrderManager = () => {
    const { sales, updateOrderStatus, tenant } = useData();
    const { notify } = useNotify();
    const [showScanner, setShowScanner] = useState(false);

    const handleBarcodeScanned = useCallback((code: string) => {
        setSearchTerm(code);
        showToast.success(`Código lido: ${code}`);
    }, []);

    const handleSendWhatsApp = (sale: any) => {
        const phone = sale.customerPhone || sale.whatsapp || '';
        const items = (sale.items || []).map((i: any) => `• ${i.name} x${i.quantity}`).join('\n');
        const message = `🛍️ Olá, ${sale.customerName || 'Cliente'}! Seu pedido #${String(sale.id || '').slice(0, 8).toUpperCase()} foi registrado com sucesso!\n\n${items}\n\n💰 Total: R$ ${Number(sale.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nObrigado pela preferência! 😊`;
        notify({ channel: 'whatsapp', to: phone, message });
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);

    const filteredSales = (sales || [])
        .filter(sale => sale.type === 'sale' || (!sale.type && sale.items))
        .filter(sale =>
            String(sale.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    const handleStatusUpdate = (id, newStatus) => {
        updateOrderStatus(id, newStatus);
        showToast.success(`Pedido #${String(id || '').slice(0, 8)} atualizado para: ${newStatus}`);
    };

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Pendente': return 'bg-amber-500/10 border-amber-500/20 text-amber-300';
            case 'Enviado': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300';
            case 'Entregue': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
            case 'Cancelado': return 'bg-rose-500/10 border-rose-500/20 text-rose-300';
            default: return 'bg-amber-500/10 border-amber-500/20 text-amber-300';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Pendente': return <Package size={14} />;
            case 'Enviado': return <Truck size={14} />;
            case 'Entregue': return <CheckCircle size={14} />;
            case 'Cancelado': return <XCircle size={14} />;
            default: return <Package size={14} />;
        }
    };

    const generateReceipt = async (order) => {
        const terms = order.paymentMethod === 'terms' 
            ? 'TERMO DE CONFISSÃO DE DÍVIDA: O atraso no pagamento sujeitará o cliente ao pagamento de multa moratória fixa de 6% (seis por cento) sobre o valor devido, juros moratórios de 3% (três por cento) ao mês cobrados pro rata die, suspensão da prestação dos serviços após 15 (quinze) dias de atraso e encaminhamento do débito a Cartório de Protesto.'
            : '';

        const success = await generateProfessionalPDF({
            tenant,
            title: 'RECIBO DE VENDA',
            documentNumber: `#${order.id.slice(0, 8).toUpperCase()}`,
            customerInfo: [
                order.customerName || 'Cliente Consumidor',
                order.userEmail || 'Email não informado'
            ],
            documentInfo: [
                { label: 'Data Emissão:', value: new Date(order.date).toLocaleDateString('pt-BR') },
                { label: 'Status:', value: order.status || 'Confirmado' },
                { label: 'Forma Pgto:', value: order.paymentMethod || 'Não informado' }
            ],
            tableColumns: ['Descrição do Produto', 'Qtd', 'Preço Unit.', 'Total'],
            tableRows: order.items.map(item => [
                item.name,
                String(item.quantity || 1),
                `R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${(Number(item.price || 0) * (item.quantity || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]),
            totalLabel: 'TOTAL A PAGAR:',
            totalValue: order.total,
            terms: terms,
            filename: `recibo-${order.id.slice(0, 8)}.pdf`
        });

        if (success) showToast.success('Recibo profissional gerado!');
        else showToast.error('Erro ao gerar recibo.');
    };

    return (
        <div className="p-6 md:p-8 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        Gerenciar Pedidos
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Acompanhe e gerencie as vendas da sua loja.</p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-3 max-w-md">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Buscar por ID, Email ou código de barras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-800/80 focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
                        />
                        <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <button
                        onClick={() => setShowScanner(true)}
                        title="Escanear código de barras com câmera"
                        className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl transition-all"
                    >
                        <Camera size={18} />
                    </button>
                </div>
            </div>

            {showScanner && (
                <BarcodeScanner
                    onScan={handleBarcodeScanned}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {/* Orders Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-950/60 border-b border-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                <th className="px-5 py-4">ID Pedido</th>
                                <th className="px-5 py-4">Data</th>
                                <th className="px-5 py-4">Cliente</th>
                                <th className="px-5 py-4">Total</th>
                                <th className="px-5 py-4">Pagamento</th>
                                <th className="px-5 py-4">Status</th>
                                <th className="px-5 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredSales.map(sale => (
                                <tr key={sale.id || Math.random()} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-5 py-4 font-mono font-semibold text-indigo-400">
                                        #{String(sale.id || '').slice(0, 8).toUpperCase()}
                                    </td>
                                    <td className="px-5 py-4 text-slate-300">
                                        {sale.date ? format(new Date(sale.date), 'dd/MM/yyyy HH:mm') : '-'}
                                    </td>
                                    <td className="px-5 py-4 text-slate-300">
                                        {sale.userEmail || 'Não informado'}
                                    </td>
                                    <td className="px-5 py-4 font-bold text-slate-100">
                                        R$ {Number(sale.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className="block font-medium text-slate-200 text-xs">
                                            {sale.paymentMethod || 'Não informado'}
                                        </span>
                                        <span className={`text-xs font-semibold ${sale.paymentStatus === 'Pendente' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {sale.paymentStatus || 'Pago'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-sm ${getStatusBadgeStyle(sale.status || 'Pendente')}`}>
                                            {getStatusIcon(sale.status || 'Pendente')}
                                            <span>{sale.status || 'Pendente'}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <select
                                                value={sale.status || 'Pendente'}
                                                onChange={(e) => handleStatusUpdate(sale.id, e.target.value)}
                                                className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 transition-colors"
                                            >
                                                <option value="Pendente" className="bg-slate-900 text-slate-200">Pendente</option>
                                                <option value="Enviado" className="bg-slate-900 text-slate-200">Enviado</option>
                                                <option value="Entregue" className="bg-slate-900 text-slate-200">Entregue</option>
                                                <option value="Cancelado" className="bg-slate-900 text-slate-200">Cancelado</option>
                                            </select>

                                            <button
                                                onClick={() => generateReceipt(sale)}
                                                title="Gerar Recibo"
                                                className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all shadow-sm"
                                            >
                                                <FileText size={16} />
                                            </button>
                                            <button
                                                onClick={() => setSelectedOrder(sale)}
                                                title="Ver Detalhes"
                                                className="p-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-all shadow-sm"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleSendWhatsApp(sale)}
                                                title="Enviar Recibo via WhatsApp"
                                                className="p-2 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all shadow-sm"
                                            >
                                                <MessageCircle size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredSales.length === 0 && (
                    <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
                        <Package size={44} className="stroke-[1.5] text-slate-600 opacity-60" />
                        <p className="text-slate-400 text-sm font-medium">Nenhum pedido encontrado.</p>
                    </div>
                )}
            </div>

            {/* Order Details Modal (Glassmorphism) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 text-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start border-b border-slate-800/80 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-indigo-400">
                                    Pedido #{String(selectedOrder.id || '').slice(0, 8).toUpperCase()}
                                </h2>
                                <p className="text-slate-400 text-xs mt-0.5">Visualização de Detalhes</p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Data e Hora</p>
                                <p className="text-sm font-medium text-slate-200">{selectedOrder.date ? format(new Date(selectedOrder.date), 'dd/MM/yyyy HH:mm') : '-'}</p>
                            </div>
                            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</p>
                                <p className="text-sm font-medium text-slate-200 truncate">{selectedOrder.userEmail || 'Não informado'}</p>
                            </div>
                            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</p>
                                <p className="text-base font-bold text-emerald-400">R$ {Number(selectedOrder.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 space-y-1">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pagamento</p>
                                <p className="text-sm font-medium text-slate-200">
                                    {selectedOrder.paymentMethod || 'Não informado'}
                                    <br />
                                    <span className="text-xs text-slate-400 font-normal">{selectedOrder.paymentStatus || 'Pago'}</span>
                                </p>
                            </div>
                        </div>

                        {selectedOrder.installments?.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Parcelas</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {selectedOrder.installments.map(installment => (
                                        <div key={installment.id} className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 text-center">
                                            <strong className="block text-sm font-bold text-slate-200">{installment.number}/{selectedOrder.installments.length}</strong>
                                            <span className="text-xs font-bold text-indigo-400 block mt-0.5">R$ {Number(installment.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            <span className="block text-[11px] text-slate-400 mt-1">{format(new Date(installment.dueDate), 'dd/MM/yyyy')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Itens do Pedido</h3>
                            <ul className="bg-slate-950/50 border border-slate-800/80 rounded-xl divide-y divide-slate-800/60 overflow-hidden">
                                {selectedOrder.items.map((item, idx) => (
                                    <li key={idx} className="flex items-center justify-between p-3.5 text-sm">
                                        <div>
                                            <span className="font-medium text-slate-200">{item.name}</span>
                                            <span className="text-slate-400 text-xs ml-2">x {item.quantity || 1}</span>
                                        </div>
                                        <span className="font-semibold text-slate-100">R$ {Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderManager;
