import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinancialAgendaEvents } from './services/agenda-events.js';
import { googleCalendarEventId } from './services/google-calendar.js';

test('cria lembretes apenas para parcelas e contas ainda pendentes', () => {
    const events = buildFinancialAgendaEvents([
        {
            id: 'sale-1', customerName: 'Cliente Teste', customerEmail: 'cliente@example.com',
            installments: [
                { id: 'p1', number: 1, dueDate: '2099-01-10', value: 100, status: 'Pendente' },
                { id: 'p2', number: 2, dueDate: '2099-02-10', value: 100, status: 'Pago' },
            ],
        },
    ], [
        { id: 'e1', name: 'Aluguel', type: 'outflow', dueDate: '2099-01-05', value: 500, status: 'Pendente' },
        { id: 'e2', name: 'Internet', type: 'outflow', dueDate: '2099-01-06', value: 150, status: 'Pago' },
    ]);

    assert.equal(events.length, 2);
    assert.deepEqual(events.map(event => event.type).sort(), ['Cobrança', 'Pagamento']);
    assert.ok(events.every(event => event.readOnly && event.source === 'financial'));
});

test('ignora venda integralmente paga mesmo que uma parcela esteja inconsistente', () => {
    const events = buildFinancialAgendaEvents([{ id: 'sale-2', status: 'Pago', installments: [{ id: 'p1', dueDate: '2099-01-10', status: 'Pendente' }] }], []);
    assert.equal(events.length, 0);
});

test('identificador do Google Agenda é determinístico e válido', () => {
    const first = googleCalendarEventId('f2-informatica', 'receivable-sale-1-p1');
    const second = googleCalendarEventId('f2-informatica', 'receivable-sale-1-p1');
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{40}$/);
});
