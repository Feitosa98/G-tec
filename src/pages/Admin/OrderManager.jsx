import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Package, Truck, CheckCircle, XCircle, Search, Eye, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { showToast } from '../../utils/toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const OrderManager = () => {
    const { sales, updateOrderStatus } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);

    const filteredSales = sales
        .filter(sale => sale.type === 'sale' || (!sale.type && sale.items)) // Filter only actual sales
        .filter(sale =>
            sale.id.toString().includes(searchTerm) ||
            (sale.userEmail && sale.userEmail.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => new Date(b.date) - new Date(a.date));

    const handleStatusUpdate = (id, newStatus) => {
        updateOrderStatus(id, newStatus);
        showToast.success(`Pedido #${id} atualizado para: ${newStatus}`);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pendente': return 'var(--color-warning)';
            case 'Enviado': return 'var(--color-primary)';
            case 'Entregue': return 'var(--color-success)';
            case 'Cancelado': return 'var(--color-danger)';
            default: return 'var(--color-text-muted)';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Pendente': return <Package size={16} />;
            case 'Enviado': return <Truck size={16} />;
            case 'Entregue': return <CheckCircle size={16} />;
            case 'Cancelado': return <XCircle size={16} />;
            default: return <Package size={16} />;
        }
    };

    const generateReceipt = async (order) => {
        try {
            const doc = new jsPDF();

            // --- Helper: Load Image ---
            const loadImage = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.src = src;
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                });
            }

            const logo = await loadImage('/logo.png');

            // --- Colors & Fonts ---
            const colorPrimary = [15, 23, 42];   // Navy Blue
            const colorAccent = [250, 204, 21];  // Gold
            const colorGray = [100, 116, 139];   // Slate 500

            // --- Header Background ---
            // A stylish angled background for the top
            doc.setFillColor(...colorPrimary);
            doc.rect(0, 0, 210, 40, 'F');

            // Gold Accent Line
            doc.setDrawColor(...colorAccent);
            doc.setLineWidth(1.5);
            doc.line(0, 40, 210, 40);

            // --- Header Content ---
            // Logo
            if (logo) {
                doc.addImage(logo, 'PNG', 15, 5, 30, 30);
            }

            // Company Info (Left - White text on Dark bg)
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('GTEC Informática', 50, 18);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('CNPJ: 45.123.789/0001-90', 50, 25);
            doc.text('R. Rio Mucuim, 45 - São José Operário, Manaus - AM, 69086-120', 50, 30);
            doc.text('contato@gtecinformatica.com.br | (92) 9 9280-0023', 50, 35);

            // Receipt Title (Right)
            doc.setFontSize(28);
            doc.setTextColor(...colorAccent);
            doc.text('RECIBO', 195, 25, { align: 'right' });

            doc.setFontSize(10);
            doc.setTextColor(255, 255, 255);
            doc.text(`#${order.id}`, 195, 33, { align: 'right' });


            // --- Info Section (2 Columns) ---
            const startY = 55;

            // Left: Billed To
            doc.setTextColor(...colorPrimary);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Faturado Para:', 15, startY);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(order.userEmail, 15, startY + 6);
            doc.text('Cliente Consumidor', 15, startY + 11);

            // Right: Payment Details
            doc.setTextColor(...colorPrimary);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalhes do Pedido:', 120, startY);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);

            doc.text(`Data Emissão:`, 120, startY + 6);
            doc.text(new Date(order.date).toLocaleDateString('pt-BR'), 195, startY + 6, { align: 'right' });

            doc.text(`Status:`, 120, startY + 11);
            doc.text(order.status || 'Confirmado', 195, startY + 11, { align: 'right' });

            doc.text(`Método Pagamento:`, 120, startY + 16);
            doc.text('Cartão de Crédito', 195, startY + 16, { align: 'right' }); // Mock payment method


            // --- Items Table ---
            const tableBody = order.items.map(item => [
                item.name,
                "1", // Quantity assumed 1
                `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ]);

            autoTable(doc, {
                startY: startY + 25,
                head: [['Descrição do Produto', 'Qtd', 'Preço Unit.', 'Total']],
                body: tableBody,
                theme: 'grid',
                headStyles: {
                    fillColor: colorPrimary,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'left'
                },
                styles: {
                    fontSize: 10,
                    cellPadding: 3,
                    textColor: [50, 50, 50]
                },
                columnStyles: {
                    0: { cellWidth: 'auto' }, // Desc
                    1: { cellWidth: 20, halign: 'center' }, // Qty
                    2: { cellWidth: 35, halign: 'right' }, // Price
                    3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }  // Total
                },
                foot: [['', '', 'Subtotal:', `R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]],
                footStyles: {
                    fillColor: [241, 245, 249], // Light gray
                    textColor: colorPrimary,
                    fontStyle: 'bold',
                    halign: 'right'
                }
            });

            // --- Total Summary Box ---
            const finalY = doc.lastAutoTable.finalY + 10;
            const boxWidth = 80;
            const boxX = 115; // Align to right side roughly

            // Total Amount Large
            doc.setFontSize(14);
            doc.setTextColor(...colorPrimary);
            doc.text('TOTAL A PAGAR:', boxX, finalY + 5);

            doc.setFontSize(20);
            doc.setTextColor(...colorAccent); // Gold for the money
            doc.setFont('helvetica', 'bold');
            doc.text(`R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 195, finalY + 5, { align: 'right' });

            // --- Footer ---
            const pageHeight = doc.internal.pageSize.height;
            doc.setDrawColor(200, 200, 200);
            doc.line(15, pageHeight - 20, 195, pageHeight - 20);

            doc.setFontSize(9);
            doc.setTextColor(...colorGray);
            doc.text('Obrigado por comprar com a GTEC Informática!', 105, pageHeight - 15, { align: 'center' });
            doc.text('Este documento é um comprovante de venda gerado eletronicamente.', 105, pageHeight - 10, { align: 'center' });

            doc.save(`recibo-gtec-${order.id}.pdf`);
            showToast.success('Recibo profissional gerado!');

        } catch (err) {
            console.error(err);
            showToast.error('Erro ao gerar recibo.');
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '2rem' }}>Gerenciar Pedidos</h1>

            {/* Search */}
            <div style={{ marginBottom: '2rem', position: 'relative', maxWidth: '400px' }}>
                <input
                    type="text"
                    placeholder="Buscar por ID ou Email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={inputStyle}
                />
                <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            </div>

            {/* Orders Table */}
            <div style={{ overflowX: 'auto', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th style={thStyle}>ID Pedido</th>
                            <th style={thStyle}>Data</th>
                            <th style={thStyle}>Cliente</th>
                            <th style={thStyle}>Total</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSales.map(sale => (
                            <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={tdStyle}>#{sale.id}</td>
                                <td style={tdStyle}>{format(new Date(sale.date), 'dd/MM/yyyy HH:mm')}</td>
                                <td style={tdStyle}>{sale.userEmail}</td>
                                <td style={tdStyle}>R$ {sale.total.toLocaleString('pt-BR')}</td>
                                <td style={tdStyle}>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        background: `${getStatusColor(sale.status || 'Pendente')}20`,
                                        color: getStatusColor(sale.status || 'Pendente'),
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {getStatusIcon(sale.status || 'Pendente')}
                                        {sale.status || 'Pendente'}
                                    </div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <select
                                            value={sale.status || 'Pendente'}
                                            onChange={(e) => handleStatusUpdate(sale.id, e.target.value)}
                                            style={{
                                                background: 'var(--color-bg-dark)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                                padding: '5px',
                                                borderRadius: '4px',
                                                outline: 'none',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <option value="Pendente">Pendente</option>
                                            <option value="Enviado">Enviado</option>
                                            <option value="Entregue">Entregue</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>

                                        <button
                                            onClick={() => generateReceipt(sale)}
                                            title="Gerar Recibo"
                                            style={{ background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                                        >
                                            <FileText size={20} />
                                        </button>

                                        <button
                                            onClick={() => setSelectedOrder(sale)}
                                            title="Ver Detalhes"
                                            style={{ background: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                                        >
                                            <Eye size={20} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredSales.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Nenhum pedido encontrado.</div>}
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setSelectedOrder(null)}>
                    <div style={{
                        background: 'var(--color-bg-card)',
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '600px',
                        width: '90%',
                        border: '1px solid var(--color-accent)',
                        maxHeight: '80vh',
                        overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                            Detalhes do Pedido #{selectedOrder.id}
                        </h2>

                        <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Data</p>
                                <p>{format(new Date(selectedOrder.date), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                            <div>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Cliente</p>
                                <p>{selectedOrder.userEmail}</p>
                            </div>
                            <div>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Status</p>
                                <p style={{ color: getStatusColor(selectedOrder.status), fontWeight: 'bold' }}>{selectedOrder.status || 'Pendente'}</p>
                            </div>
                            <div>
                                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Total</p>
                                <p style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>R$ {selectedOrder.total.toLocaleString('pt-BR')}</p>
                            </div>
                        </div>

                        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Itens do Pedido</h3>
                        <ul style={{ marginBottom: '2rem' }}>
                            {selectedOrder.items.map((item, idx) => (
                                <li key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '0.8rem 0',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <span>{item.name}</span>
                                    <span>R$ {item.price.toLocaleString('pt-BR')}</span>
                                </li>
                            ))}
                        </ul>

                        <button className="btn-primary" style={{ width: '100%' }} onClick={() => setSelectedOrder(null)}>
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.8rem',
    borderRadius: 'var(--radius-md)',
    color: 'white',
    outline: 'none',
    width: '100%'
};

const thStyle = { padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' };
const tdStyle = { padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' };

export default OrderManager;
