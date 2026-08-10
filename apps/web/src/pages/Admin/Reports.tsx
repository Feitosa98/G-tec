import { useState } from 'react';
import { useData } from '../../hooks/useData';
import { FileSpreadsheet, FileText, Download, Filter, BarChart2, Users, Package, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { generateProfessionalPDF } from '../../utils/pdfGenerator';
import toast from 'react-hot-toast';

type ReportType = 'sales' | 'os' | 'customers' | 'products' | 'financial';

const escapeCsvCell = (value: unknown) => {
    const raw = String(value ?? '');
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
};

const downloadCsv = (headers: unknown[], rows: unknown[][], filename: string) => {
    const content = [headers, ...rows].map(row => row.map(escapeCsvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const REPORT_OPTIONS = [
    { id: 'sales' as const, label: 'Vendas / Pedidos', icon: BarChart2, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { id: 'os' as const, label: 'Ordens de Serviço', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    { id: 'customers' as const, label: 'Clientes', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { id: 'products' as const, label: 'Produtos / Estoque', icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { id: 'financial' as const, label: 'Financeiro / Cobranças', icon: DollarSign, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
];

export default function Reports() {
    const { sales, products, tenant } = useData();
    const [selectedReport, setSelectedReport] = useState<ReportType>('sales');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };
    const headers = { 'Authorization': `Bearer ${getToken()}` };

    const filterByDate = (items: any[], dateField: string) => {
        return items.filter(item => {
            const d = item[dateField] || item.data?.[dateField] || item.createdAt;
            if (!d) return true;
            const date = new Date(d);
            if (dateFrom && date < new Date(dateFrom)) return false;
            if (dateTo && date > new Date(dateTo + 'T23:59:59')) return false;
            return true;
        });
    };

    const getSalesData = () => {
        const filtered = filterByDate(
            (sales || []).filter(s => s.type === 'sale' || (!s.type && s.items)),
            'date'
        );
        return {
            headers: ['ID', 'Data', 'Cliente', 'Itens', 'Total', 'Pagamento', 'Status'],
            rows: filtered.map(s => [
                String(s.id || '').slice(0, 8).toUpperCase(),
                s.date ? format(new Date(s.date), 'dd/MM/yyyy') : '',
                s.customerName || s.userEmail || '',
                String((s.items || []).length),
                `R$ ${Number(s.total || 0).toFixed(2)}`,
                s.paymentMethod || '',
                s.status || 'Pendente',
            ]),
            total: filtered.reduce((acc, s) => acc + Number(s.total || 0), 0),
        };
    };

    const getOSData = async () => {
        const res = await fetch(`/api/store/${tenant?.storeSlug}/service_orders`, { headers });
        const orders = res.ok ? await res.json() : [];
        const filtered = filterByDate(orders, 'createdAt');
        return {
            headers: ['ID', 'Data', 'Cliente', 'Dispositivo', 'Status', 'Valor'],
            rows: filtered.map((o: any) => [
                String(o.id || '').slice(0, 8).toUpperCase(),
                o.createdAt ? format(new Date(o.createdAt), 'dd/MM/yyyy') : '',
                o.clientName || '',
                o.device || o.orderType || '',
                o.status || '',
                `R$ ${Number(o.totalValue || 0).toFixed(2)}`,
            ]),
            total: filtered.reduce((acc: number, o: any) => acc + Number(o.totalValue || 0), 0),
        };
    };

    const getCustomersData = async () => {
        const res = await fetch(`/api/store/${tenant?.storeSlug}/customers`, { headers });
        const customers = res.ok ? await res.json() : [];
        return {
            headers: ['Nome', 'CPF/CNPJ', 'Telefone', 'E-mail', 'Endereço'],
            rows: customers.map((c: any) => [c.name || '', c.cpfCnpj || '', c.phone || '', c.email || '', c.address || '']),
            total: customers.length,
        };
    };

    const getProductsData = () => {
        return {
            headers: ['Nome', 'Código', 'Preço', 'Estoque', 'Estoque Mínimo', 'Categoria'],
            rows: (products || []).map((p: any) => [p.name || '', p.barcode || p.sku || '', `R$ ${Number(p.price || 0).toFixed(2)}`, String(p.stock ?? p.quantity ?? 0), String(p.minStock ?? 5), p.category || '']),
            total: (products || []).length,
        };
    };

    const getFinancialData = () => {
        const receivables = (sales || []).flatMap((s: any) => (s.installments || []).map((inst: any) => ({ ...inst, customerName: s.customerName })));
        const filtered = filterByDate(receivables, 'dueDate');
        return {
            headers: ['Cliente', 'Parcela', 'Vencimento', 'Status', 'Valor'],
            rows: filtered.map((r: any) => [r.customerName || '', `${r.installmentNumber || 1}/${r.totalInstallments || 1}`, r.dueDate ? format(new Date(r.dueDate), 'dd/MM/yyyy') : '', r.status || '', `R$ ${Number(r.amount || 0).toFixed(2)}`]),
            total: filtered.filter((r: any) => r.status !== 'Pago').reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0),
        };
    };

    const getReportData = async () => {
        switch (selectedReport) {
            case 'sales': return getSalesData();
            case 'os': return await getOSData();
            case 'customers': return await getCustomersData();
            case 'products': return getProductsData();
            case 'financial': return getFinancialData();
        }
    };

    const exportExcel = async () => {
        try {
            const data = await getReportData();
            downloadCsv(data.headers, data.rows, `relatorio-${selectedReport}-${format(new Date(), 'dd-MM-yyyy')}.csv`);
            toast.success('Planilha exportada!');
        } catch (err) {
            toast.error('Erro ao exportar Excel');
        }
    };

    const exportPDF = async () => {
        try {
            const data = await getReportData();
            const label = REPORT_OPTIONS.find(r => r.id === selectedReport)?.label || 'Relatório';
            await generateProfessionalPDF({
                tenant,
                title: `RELATÓRIO — ${label.toUpperCase()}`,
                documentNumber: format(new Date(), 'dd/MM/yyyy'),
                customerInfo: [],
                documentInfo: [
                    { label: 'Período:', value: `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` },
                    { label: 'Total de registros:', value: String(data.rows.length) },
                ],
                tableColumns: data.headers,
                tableRows: data.rows,
                totalLabel: selectedReport === 'customers' || selectedReport === 'products' ? 'Total de registros:' : 'VALOR TOTAL:',
                totalValue: selectedReport === 'customers' || selectedReport === 'products' ? data.total : data.total,
                filename: `relatorio-${selectedReport}-${format(new Date(), 'dd-MM-yyyy')}.pdf`,
            });
            toast.success('Relatório PDF gerado!');
        } catch (err) {
            toast.error('Erro ao gerar PDF');
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 fade-in">
            <header>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Relatórios</h1>
                <p className="text-slate-400 mt-1">Exporte dados do sistema em planilha ou PDF</p>
            </header>

            {/* Report type selection */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {REPORT_OPTIONS.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setSelectedReport(r.id)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${selectedReport === r.id ? r.bg + ' shadow-lg' : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'}`}
                    >
                        <r.icon className={`w-6 h-6 ${selectedReport === r.id ? r.color : 'text-slate-500'}`} />
                        <span className={`text-xs font-medium text-center ${selectedReport === r.id ? 'text-slate-200' : 'text-slate-500'}`}>{r.label}</span>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <h3 className="font-medium text-slate-200">Filtros de Período</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                    <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Data inicial</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                    </div>
                    <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Data final</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                    </div>
                </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={exportExcel}
                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/20"
                >
                    <FileSpreadsheet className="w-6 h-6" />
                    <div className="text-left">
                        <p className="font-bold">Exportar planilha (.csv)</p>
                        <p className="text-emerald-200 text-xs font-normal">Compatível com Excel</p>
                    </div>
                    <Download className="w-5 h-5 ml-auto" />
                </button>
                <button
                    onClick={exportPDF}
                    className="flex-1 flex items-center justify-center gap-3 py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-rose-600/20"
                >
                    <FileText className="w-6 h-6" />
                    <div className="text-left">
                        <p className="font-bold">Exportar PDF</p>
                        <p className="text-rose-200 text-xs font-normal">Relatório formatado</p>
                    </div>
                    <Download className="w-5 h-5 ml-auto" />
                </button>
            </div>
        </div>
    );
}
