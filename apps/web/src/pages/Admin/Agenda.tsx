import { useState, useEffect } from 'react';
import { useData } from '../../hooks/useData';
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, Phone, X, Save, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBrazilianPhone } from '../../utils/phone';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const TYPE_COLORS: Record<string, string> = {
    'Entrega': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'Visita Técnica': 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    'Reunião': 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    'Retirada': 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    'Outro': 'bg-slate-500/20 border-slate-500/40 text-slate-300',
};

const EMPTY_FORM = { title: '', client: '', phone: '', type: 'Entrega', date: '', time: '', notes: '' };

export default function Agenda() {
    const { tenant } = useData();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };
    const headers = { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

    const fetchAppointments = async () => {
        if (!tenant?.storeSlug) return;
        const res = await fetch(`/api/store/${tenant.storeSlug}/appointments`, { headers });
        if (res.ok) setAppointments(await res.json());
    };

    useEffect(() => { fetchAppointments(); }, [tenant]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const appointmentsForDay = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return appointments.filter(a => a.date === dateStr);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.date) { toast.error('Título e data são obrigatórios'); return; }
        const payload = { ...form, id: editing?.id || crypto.randomUUID() };
        await fetch(`/api/store/${tenant.storeSlug}/appointments`, {
            method: 'POST', headers, body: JSON.stringify(payload)
        });
        toast.success(editing ? 'Agendamento atualizado!' : 'Agendamento criado!');
        setIsFormOpen(false); setEditing(null); setForm(EMPTY_FORM);
        fetchAppointments();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir agendamento?')) return;
        await fetch(`/api/store/${tenant.storeSlug}/appointments/${id}`, { method: 'DELETE', headers });
        toast.success('Agendamento excluído'); fetchAppointments();
    };

    const openNewForDay = (day: number) => {
        setEditing(null);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setForm({ ...EMPTY_FORM, date: dateStr });
        setIsFormOpen(true);
    };

    const dayAppointments = selectedDay ? appointmentsForDay(selectedDay) : [];

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 fade-in">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Agenda</h1>
                    <p className="text-slate-400 mt-1">Gerencie entregas, visitas técnicas e compromissos</p>
                </div>
                <button
                    onClick={() => { setEditing(null); setForm(EMPTY_FORM); setIsFormOpen(true); }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus className="w-4 h-4" /> Novo Agendamento
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                    {/* Calendar Header */}
                    <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
                        <h2 className="font-semibold text-white">{MONTHS[month]} {year}</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setCurrentDate(new Date())}
                                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all font-medium"
                            >
                                Hoje
                            </button>
                            <button
                                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 border-b border-slate-800/50">
                        {DAYS.map(d => (
                            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
                        ))}
                    </div>

                    {/* Days grid */}
                    <div className="grid grid-cols-7">
                        {Array.from({ length: firstDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-24 border-b border-r border-slate-800/30" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayAppts = appointmentsForDay(day);
                            const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
                            const isSelected = selectedDay === day;
                            return (
                                <div
                                    key={day}
                                    onClick={() => setSelectedDay(isSelected ? null : day)}
                                    className={`h-24 border-b border-r border-slate-800/30 p-1.5 cursor-pointer hover:bg-slate-800/30 transition-all ${isSelected ? 'bg-blue-500/10' : ''}`}
                                >
                                    <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                                        {day}
                                    </div>
                                    <div className="space-y-0.5 overflow-hidden">
                                        {dayAppts.slice(0, 2).map(a => (
                                            <div key={a.id} className={`text-xs px-1.5 py-0.5 rounded truncate border ${TYPE_COLORS[a.type] || TYPE_COLORS['Outro']}`}>
                                                {a.time && <span className="font-mono mr-1">{a.time}</span>}
                                                {a.title}
                                            </div>
                                        ))}
                                        {dayAppts.length > 2 && (
                                            <div className="text-xs text-slate-500 px-1">+{dayAppts.length - 2} mais</div>
                                        )}
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); openNewForDay(day); }}
                                        className="opacity-0 group-hover:opacity-100 absolute bottom-1 right-1 p-0.5 text-slate-600 hover:text-blue-400"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Side panel */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/80">
                        <h3 className="font-semibold text-slate-200">
                            {selectedDay ? `${selectedDay} de ${MONTHS[month]}` : 'Próximos agendamentos'}
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-800/50 overflow-y-auto max-h-[500px]">
                        {(selectedDay ? dayAppointments : [...appointments].sort((a, b) => a.date > b.date ? 1 : -1).slice(0, 10)).map(a => (
                            <div key={a.id} className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[a.type] || TYPE_COLORS['Outro']}`}>{a.type}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditing(a); setForm(a); setIsFormOpen(true); }} className="p-1 text-slate-500 hover:text-cyan-400 rounded">
                                            <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(a.id)} className="p-1 text-slate-500 hover:text-rose-400 rounded">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-slate-200 font-medium text-sm">{a.title}</p>
                                <div className="space-y-1 text-xs text-slate-400">
                                    {a.time && <p className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.date} às {a.time}</p>}
                                    {a.client && <p className="flex items-center gap-1"><User className="w-3 h-3" />{a.client}</p>}
                                    {a.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{formatBrazilianPhone(a.phone)}</p>}
                                    {a.notes && <p className="text-slate-500 italic">{a.notes}</p>}
                                </div>
                            </div>
                        ))}
                        {(selectedDay ? dayAppointments : appointments).length === 0 && (
                            <div className="p-8 text-center text-slate-500 text-sm">
                                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                Nenhum agendamento
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white">{editing ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Título *</label>
                                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Entrega notebook João"
                                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-slate-400 mb-1.5 block">Data *</label>
                                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 mb-1.5 block">Horário</label>
                                    <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                                        className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Tipo</label>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-slate-100 outline-none">
                                    {Object.keys(TYPE_COLORS).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Cliente</label>
                                <input type="text" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} placeholder="Nome do cliente"
                                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Telefone</label>
                                <input type="tel" inputMode="numeric" maxLength={15} value={form.phone} onChange={e => setForm({ ...form, phone: formatBrazilianPhone(e.target.value) })} placeholder="(92) 99999-9999"
                                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-400 mb-1.5 block">Observações</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Detalhes adicionais..."
                                    className="w-full bg-slate-950/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-2.5 text-slate-100 outline-none transition-all resize-none" />
                            </div>
                            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> {editing ? 'Salvar Alterações' : 'Criar Agendamento'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
