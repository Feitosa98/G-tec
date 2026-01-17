import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, ShoppingBag, PieChart, FileText, Table, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const Card = ({ title, value, subtitle, icon: Icon, color }) => (
    <div style={{
        background: 'var(--color-bg-card)',
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start'
    }}>
        <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{title}</p>
            <h3 style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{value}</h3>
            {subtitle && <p style={{ fontSize: '0.8rem', color: color || 'var(--color-success)', marginTop: '0.5rem' }}>{subtitle}</p>}
        </div>
        <div style={{
            background: color ? `${color}20` : 'rgba(255,255,255,0.1)',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            color: color || 'white'
        }}>
            <Icon size={24} />
        </div>
    </div>
);

const Dashboard = () => {
    const { getFinancialSummary, generateMockData, sales } = useData();
    const [timeRange, setTimeRange] = useState('30d');

    // --- 1. Filter Logic ---
    const getFilteredSales = () => {
        if (!sales) return [];
        const now = new Date();
        const filtered = sales.filter(s => {
            const saleDate = new Date(s.date);
            if (timeRange === '7d') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(now.getDate() - 7);
                return saleDate >= sevenDaysAgo;
            }
            if (timeRange === '30d') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(now.getDate() - 30);
                return saleDate >= thirtyDaysAgo;
            }
            return true; // 'all'
        });
        return filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const filteredSales = getFilteredSales();

    // --- 2. Calculate Financials based on Filtered Data ---
    const calculateFilteredSummary = () => {
        return filteredSales.reduce((acc, sale) => {
            if (sale.type === 'expense') {
                acc.totalExpenses += Number(sale.amount) || Number(sale.value) || Number(sale.total) || 0;
            } else {
                acc.totalRevenue += Number(sale.total) || 0;
                acc.totalCOGS += Number(sale.totalCost) || 0;
                acc.transactionCount++;
            }
            return acc;
        }, { totalRevenue: 0, totalExpenses: 0, totalCOGS: 0, transactionCount: 0 });
    };

    const filteredSummary = calculateFilteredSummary();
    const netProfit = filteredSummary.totalRevenue - filteredSummary.totalCOGS - filteredSummary.totalExpenses;

    // --- 3. Chart Data Aggregation (Daily) ---
    const getChartData = () => {
        const dailyData = {};

        filteredSales.forEach(sale => {
            const dateStr = new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = { name: dateStr, Receita: 0, Custos: 0, Lucro: 0 };
            }

            if (sale.type === 'expense') {
                const expenseValue = Number(sale.amount) || Number(sale.value) || Number(sale.total) || 0;
                dailyData[dateStr].Custos += expenseValue;
                dailyData[dateStr].Lucro -= expenseValue;
            } else {
                dailyData[dateStr].Receita += Number(sale.total) || 0;
                dailyData[dateStr].Custos += Number(sale.totalCost) || 0;
                dailyData[dateStr].Lucro += (Number(sale.total) - Number(sale.totalCost));
            }
        });

        return Object.values(dailyData);
    };

    const advancedChartData = getChartData();

    // --- 4. Top Products Ranking ---
    const getTopProducts = () => {
        const productStats = {};

        filteredSales.forEach(sale => {
            if (sale.type !== 'expense' && sale.items) {
                sale.items.forEach(item => {
                    const itemId = item.id;
                    if (!productStats[itemId]) {
                        productStats[itemId] = {
                            name: item.name,
                            qty: 0,
                            revenue: 0,
                            image: item.images?.[0] || item.image
                        };
                    }
                    productStats[itemId].qty += 1;
                    productStats[itemId].revenue += Number(item.price);
                });
            }
        });

        return Object.values(productStats)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5); // Top 5
    };

    const topProducts = getTopProducts();

    // --- Actions ---
    const handleGenerateData = () => {
        if (confirm("Isso vai apagar os dados atuais e gerar dados fictícios. Continuar?")) {
            generateMockData();
            window.location.reload();
        }
    };

    const exportToPDF = async () => {
        try {
            const doc = new jsPDF();
            const loadImage = (src) => new Promise((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
            });

            const logo = await loadImage('/logo.png');

            // Header
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 210, 40, 'F');
            if (logo) doc.addImage(logo, 'PNG', 14, 5, 30, 30);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('GTEC Informática', 50, 20);

            doc.setTextColor(250, 204, 21);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text('Relatório Financeiro', 50, 28);

            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 200, 35, { align: 'right' });

            // Summary
            autoTable(doc, {
                startY: 60,
                head: [['Indicador', 'Valor']],
                body: [
                    ['Receita Total', `R$ ${filteredSummary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                    ['Custos Totais', `R$ ${(filteredSummary.totalExpenses + filteredSummary.totalCOGS).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                    ['Lucro Líquido', `R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
                    ['Pedidos no Período', filteredSummary.transactionCount]
                ],
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [250, 204, 21] },
                columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
            });

            // Details
            const recentSales = filteredSales.slice(0, 50).map(s => [
                new Date(s.date).toLocaleDateString('pt-BR'),
                String(s.id),
                Number(s.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                s.status || '-'
            ]);

            doc.text('Últimas Vendas (Top 50 do Período)', 14, doc.lastAutoTable.finalY + 15);

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 20,
                head: [['Data', 'ID', 'Valor', 'Status']],
                body: recentSales,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });

            doc.save('relatorio-gtec.pdf');
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar PDF.");
        }
    };

    const exportToExcel = () => {
        try {
            const summaryData = [
                { Indicador: 'Receita Total', Valor: filteredSummary.totalRevenue },
                { Indicador: 'Custos Totais', Valor: filteredSummary.totalExpenses + filteredSummary.totalCOGS },
                { Indicador: 'Lucro Líquido', Valor: netProfit },
                { Indicador: 'Pedidos', Valor: filteredSummary.transactionCount }
            ];

            const salesData = filteredSales.map(s => ({
                ID: s.id,
                Data: new Date(s.date).toLocaleDateString('pt-BR'),
                Cliente: s.userEmail,
                Total: s.total,
                Custo: s.totalCost,
                Lucro: (s.total || 0) - (s.totalCost || 0),
                Status: s.status
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "Vendas");
            XLSX.writeFile(wb, "relatorio-gtec.xlsx");
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar Excel.");
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header with Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.5rem' }}>Dashboard Financeiro</h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>Visão geral do desempenho da loja</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Time Range Filter */}
                    <div style={{ background: 'var(--color-bg-card)', padding: '5px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex' }}>
                        {['7d', '30d', 'all'].map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                style={{
                                    background: timeRange === range ? 'var(--color-accent)' : 'transparent',
                                    color: timeRange === range ? 'white' : 'var(--color-text-muted)',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {range === '7d' ? '7 Dias' : range === '30d' ? '30 Dias' : 'Geral'}
                            </button>
                        ))}
                    </div>

                    <button onClick={handleGenerateData} className="btn-outline" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                        <DollarSign size={16} /> Gerar Dados
                    </button>

                    <button onClick={exportToPDF} style={{ background: 'var(--color-danger)', color: 'white', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} /> PDF
                    </button>

                    <button onClick={exportToExcel} style={{ background: 'var(--color-success)', color: 'white', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Table size={16} /> Excel
                    </button>
                </div>
            </div>

            {/* KPI Cards (Filtered) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <Card
                    title="Vendas Totais"
                    value={`R$ ${filteredSummary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle={`${filteredSummary.transactionCount} pedidos no período`}
                    icon={DollarSign}
                />
                <Card
                    title="Lucro Líquido"
                    value={`R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle={netProfit >= 0 ? "+ Excelente" : "Atenção"}
                    icon={TrendingUp}
                    color={netProfit >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                />
                <Card
                    title="Custos (CPV + Despesas)"
                    value={`R$ ${(filteredSummary.totalExpenses + filteredSummary.totalCOGS).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={ShoppingBag}
                    color="#f59e0b"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>

                {/* Advanced Chart */}
                <div style={{ background: 'var(--color-bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <TrendingUp size={20} color="var(--color-accent)" />
                        Evolução de Vendas
                    </h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={advancedChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={12} tickMargin={10} />
                                <YAxis stroke="var(--color-text-muted)" fontSize={12} tickFormatter={(val) => `R$${val / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--color-bg-dark)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'white' }}
                                />
                                <Bar dataKey="Receita" fill="var(--color-primary)" name="Receita" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Lucro" fill="var(--color-success)" name="Lucro" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Products */}
                <div style={{ background: 'var(--color-bg-card)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShoppingBag size={20} color="var(--color-accent)" />
                        Produtos Mais Vendidos
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {topProducts.map((product, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                borderLeft: index === 0 ? '3px solid var(--color-accent)' : '3px solid transparent'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        width: '40px', height: '40px',
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.2rem', fontWeight: 'bold', color: index === 0 ? 'var(--color-accent)' : 'white'
                                    }}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{product.name}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{product.qty} unidades vendidas</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>R$ {product.revenue.toLocaleString('pt-BR')}</p>
                                </div>
                            </div>
                        ))}
                        {topProducts.length === 0 && <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Sem dados no período.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
