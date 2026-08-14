import React, { useState } from 'react';
import { useData } from '../../hooks/useData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { DollarSign, TrendingUp, ShoppingBag, FileText, Table, CreditCard, Users } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const escapeCsvCell = (value) => {
    const stringValue = String(value ?? '');
    const safeValue = /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
    return `"${safeValue.replaceAll('"', '""')}"`;
};

const downloadCsv = (rows, filename) => {
    const content = rows.map(row => row.map(escapeCsvCell).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const Card = ({ title, value, subtitle, icon: Icon, color }: { title: any; value: any; subtitle?: any; icon: any; color?: string }) => (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg transition-all duration-300 hover:border-slate-700 hover:shadow-indigo-500/10 flex justify-between items-start group">
        <div className="space-y-2 z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
            <h3 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{value}</h3>
            {subtitle && (
                <p 
                    className="text-xs font-medium mt-2 flex items-center gap-1"
                    style={{ color: color || '#10b981' }}
                >
                    {subtitle}
                </p>
            )}
        </div>
        <div 
            className="p-3.5 rounded-xl border border-white/10 shadow-inner flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{
                backgroundColor: color ? `color-mix(in srgb, ${color} 15%, transparent)` : 'rgba(255, 255, 255, 0.08)',
                color: color || '#ffffff',
            }}
        >
            <Icon className="w-7 h-7" />
        </div>
        <div 
            className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-40"
            style={{ backgroundColor: color || '#6366f1' }}
        />
    </div>
);

const Dashboard = () => {
    const { generateMockData, sales, tenant, products, expenses, customers, showAlert } = useData();
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
        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
        const dailyData: Record<string, any> = {};

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
        const productStats: Record<string, { name: string; qty: number; revenue: number; image?: string }> = {};

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

    // --- 5. Monthly Comparison Data ---
    const getMonthlyComparison = () => {
        const months: Record<string, any> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            months[key] = { name: key, 'Este Período': 0, 'Mês Anterior': 0 };
        }
        (sales || []).forEach(s => {
            if (!s.date || s.type === 'expense') return;
            const d = new Date(s.date);
            const key = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            if (months[key]) months[key]['Este Período'] += Number(s.total || 0);
        });
        return Object.values(months);
    };

    const monthlyComparisonData = getMonthlyComparison();

    // --- 6. Growth Rate Calculation ---
    const calculateGrowthRate = () => {
        if (!sales || sales.length === 0) return 0;
        const now = new Date();
        let days = 30;
        if (timeRange === '7d') days = 7;
        if (timeRange === '30d') days = 30;

        const currentStartDate = new Date();
        currentStartDate.setDate(now.getDate() - days);

        const previousStartDate = new Date();
        previousStartDate.setDate(now.getDate() - (days * 2));

        let currentRev = 0;
        let previousRev = 0;

        sales.forEach(s => {
            if (!s.date || s.type === 'expense') return;
            const d = new Date(s.date);
            const rev = Number(s.total || 0);
            if (d >= currentStartDate && d <= now) {
                currentRev += rev;
            } else if (d >= previousStartDate && d < currentStartDate) {
                previousRev += rev;
            }
        });

        if (previousRev === 0) return currentRev > 0 ? 100 : 0;
        return ((currentRev - previousRev) / previousRev) * 100;
    };

    const growthRate = calculateGrowthRate();

    const ticketMedio = filteredSummary.transactionCount > 0 
        ? filteredSummary.totalRevenue / filteredSummary.transactionCount 
        : 0;

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
            const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
            });

            const logo = await loadImage(tenant.logoUrl);

            // Header
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 210, 40, 'F');
            if (logo) doc.addImage(logo, 'PNG', 14, 5, 30, 30);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(tenant.businessName, 50, 20);

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

            const previousTableEnd = (doc as any).lastAutoTable.finalY;
            doc.text('Últimas Vendas (Top 50 do Período)', 14, previousTableEnd + 15);

            autoTable(doc, {
                startY: previousTableEnd + 20,
                head: [['Data', 'ID', 'Valor', 'Status']],
                body: recentSales,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });

            doc.save('relatorio-feitosa-solucoes.pdf');
        } catch (err) {
            console.error(err);
            showAlert("Erro", "Erro ao gerar PDF.");
        }
    };

    const exportToExcel = () => {
        try {
            const summaryRows = [
                ['Resumo financeiro'],
                ['Indicador', 'Valor'],
                ['Receita Total', filteredSummary.totalRevenue],
                ['Custos Totais', filteredSummary.totalExpenses + filteredSummary.totalCOGS],
                ['Lucro Líquido', netProfit],
                ['Pedidos', filteredSummary.transactionCount],
                []
            ];

            const salesRows = [
                ['Vendas'],
                ['ID', 'Data', 'Cliente', 'Total', 'Custo', 'Lucro', 'Status'],
                ...filteredSales.map(sale => [
                    sale.id,
                    new Date(sale.date).toLocaleDateString('pt-BR'),
                    sale.userEmail,
                    sale.total,
                    sale.totalCost,
                    (sale.total || 0) - (sale.totalCost || 0),
                    sale.status
                ])
            ];

            downloadCsv([...summaryRows, ...salesRows], 'relatorio-feitosa-solucoes.csv');
        } catch (err) {
            console.error(err);
            showAlert("Erro", "Erro ao gerar a planilha.");
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen bg-slate-950 text-slate-100 transition-all duration-300">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
                        Dashboard Financeiro
                    </h1>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p className="text-sm text-slate-400">Visão geral do desempenho da loja</p>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                            {growthRate >= 0 ? '📈' : '📉'} {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}% vs período anterior
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Time Range Filter */}
                    <div className="flex p-1 gap-1 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-inner">
                        {[
                            { id: '7d', label: '7 Dias' },
                            { id: '30d', label: '30 Dias' },
                            { id: 'all', label: 'Geral' }
                        ].map(({ id, label }) => (
                            <button
                                key={id}
                                onClick={() => setTimeRange(id)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    timeRange === id
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={handleGenerateData} 
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 backdrop-blur-md transition-all duration-200 hover:shadow-lg active:scale-95 cursor-pointer"
                    >
                        <DollarSign className="w-4 h-4 text-indigo-400" /> 
                        <span>Gerar Dados</span>
                    </button>

                    <button 
                        onClick={exportToPDF} 
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-md shadow-rose-600/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                        <FileText className="w-4 h-4" /> 
                        <span>PDF</span>
                    </button>

                    <button 
                        onClick={exportToExcel} 
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                        <Table className="w-4 h-4" /> 
                        <span>Excel</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards (Filtered) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <Card
                    title="Vendas Totais"
                    value={`R$ ${filteredSummary.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle={`${filteredSummary.transactionCount} pedidos no período`}
                    icon={DollarSign}
                />
                <Card
                    title="Ticket Médio"
                    value={`R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtitle="Média por venda"
                    icon={CreditCard}
                    color="#3b82f6"
                />
                <Card
                    title="Lucro Líquido"
                    value={`R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    subtitle={netProfit >= 0 ? "+ Excelente" : "Atenção"}
                    icon={TrendingUp}
                    color={netProfit >= 0 ? "#10b981" : "#f43f5e"}
                />
                <Card
                    title="Custos (CPV + Despesas)"
                    value={`R$ ${(filteredSummary.totalExpenses + filteredSummary.totalCOGS).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    icon={ShoppingBag}
                    color="#f59e0b"
                />
                <Card
                    title="Clientes Ativos"
                    value={(customers || []).length.toString()}
                    subtitle="Base cadastrada"
                    icon={Users}
                    color="#8b5cf6"
                />
            </div>

            {/* Monthly Comparison AreaChart */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-wide">
                            Comparativo Mensal (Últimos 6 Meses)
                        </h3>
                        <p className="text-xs text-slate-400">Evolução do faturamento comparado ao período anterior</p>
                    </div>
                </div>
                <div className="h-72 min-h-0 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyComparisonData}>
                            <defs>
                                <linearGradient id="monthlyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} tickMargin={10} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `R$${val / 1000}k`} />
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: '#0f172a', 
                                    borderColor: '#334155', 
                                    borderRadius: '0.75rem',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                    color: '#f8fafc'
                                }}
                                formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                                itemStyle={{ color: '#f8fafc' }}
                                cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="Este Período" 
                                stroke="#6366f1" 
                                strokeWidth={2.5}
                                fillOpacity={1} 
                                fill="url(#monthlyRevenueGradient)" 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts & Ranking Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Advanced Chart */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-wide">
                            Evolução de Vendas
                        </h3>
                    </div>
                    <div className="h-80 min-h-0 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={advancedChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} tickMargin={10} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `R$${val / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: '#0f172a', 
                                        borderColor: '#334155', 
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                        color: '#f8fafc'
                                    }}
                                    itemStyle={{ color: '#f8fafc' }}
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                                />
                                <Bar dataKey="Receita" fill="#6366f1" name="Receita" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="Lucro" fill="#10b981" name="Lucro" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Products */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-wide">
                            Produtos Mais Vendidos
                        </h3>
                    </div>
                    <div className="flex flex-col gap-3">
                        {topProducts.map((product, index) => (
                            <div 
                                key={index} 
                                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 hover:translate-x-1 ${
                                    index === 0 
                                        ? 'bg-amber-500/10 border-amber-500/30' 
                                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                                        index === 0 
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                            : 'bg-slate-800 text-slate-300 border border-slate-700/50'
                                    }`}>
                                        #{index + 1}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm text-slate-100">{product.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{product.qty} unidades vendidas</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-400 text-base">
                                        R$ {product.revenue.toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {topProducts.length === 0 && (
                            <div className="flex items-center justify-center p-8 rounded-xl bg-slate-800/20 border border-dashed border-slate-800 text-slate-500 text-sm">
                                Sem dados no período.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
