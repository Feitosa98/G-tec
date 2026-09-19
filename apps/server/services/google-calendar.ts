import crypto from 'node:crypto';

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars';

const parseGoogleCalendarResponse = async (response: Response) => {
    if (response.status === 204) return {};
    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
        const error = new Error(data.error?.message || 'Falha na comunicação com o Google Agenda.');
        (error as any).status = response.status;
        throw error;
    }
    return data;
};

const addMinutes = (date: string, time: string, minutes: number) => {
    const parsed = new Date(`${date}T${time || '00:00'}:00Z`);
    parsed.setUTCMinutes(parsed.getUTCMinutes() + minutes);
    return parsed.toISOString().slice(0, 19);
};

const nextDate = (date: string) => {
    const parsed = new Date(`${date}T00:00:00Z`);
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed.toISOString().slice(0, 10);
};

export const googleCalendarEventId = (slug: string, appointmentId: string) =>
    crypto.createHash('sha256').update(`${slug}:${appointmentId}`, 'utf8').digest('hex').slice(0, 40);

const calendarEventBody = (slug: string, appointment: any, eventId: string, timeZone: string) => {
    const date = String(appointment.date || '');
    const time = String(appointment.time || '');
    const description = [
        appointment.type ? `Tipo: ${appointment.type}` : '',
        appointment.client ? `Cliente: ${appointment.client}` : '',
        appointment.phone ? `Telefone: ${appointment.phone}` : '',
        appointment.notes ? `Observações: ${appointment.notes}` : '',
        '',
        'Sincronizado pelo sistema Feitosa Soluções.',
    ].filter((line, index, lines) => line || (index > 0 && index < lines.length - 1)).join('\n').trim();

    return {
        id: eventId,
        summary: String(appointment.title || 'Agendamento'),
        description,
        start: time ? { dateTime: `${date}T${time}:00`, timeZone } : { date },
        end: time ? { dateTime: addMinutes(date, time, 60), timeZone } : { date: nextDate(date) },
        extendedProperties: { private: { feitosaSlug: slug, feitosaAppointmentId: String(appointment.id) } },
    };
};

export const upsertGoogleCalendarEvent = async (
    accessToken: string,
    slug: string,
    appointment: any,
    calendarId = 'primary',
    timeZone = 'America/Manaus'
) => {
    if (!appointment?.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(appointment.date || ''))) {
        throw new Error('O agendamento precisa ter identificador e data válida para sincronizar.');
    }
    const eventId = googleCalendarEventId(slug, String(appointment.id));
    const encodedCalendar = encodeURIComponent(calendarId || 'primary');
    const encodedEvent = encodeURIComponent(eventId);
    const body = calendarEventBody(slug, appointment, eventId, timeZone);
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const update = await fetch(`${CALENDAR_API_URL}/${encodedCalendar}/events/${encodedEvent}?sendUpdates=none`, {
        method: 'PUT', headers, body: JSON.stringify(body),
    });
    if (update.status !== 404) {
        const data = await parseGoogleCalendarResponse(update);
        return { eventId: String(data.id || eventId), htmlLink: String(data.htmlLink || '') };
    }
    const create = await fetch(`${CALENDAR_API_URL}/${encodedCalendar}/events?sendUpdates=none`, {
        method: 'POST', headers, body: JSON.stringify(body),
    });
    if (create.status === 409) {
        const retry = await fetch(`${CALENDAR_API_URL}/${encodedCalendar}/events/${encodedEvent}?sendUpdates=none`, {
            method: 'PUT', headers, body: JSON.stringify(body),
        });
        const data = await parseGoogleCalendarResponse(retry);
        return { eventId: String(data.id || eventId), htmlLink: String(data.htmlLink || '') };
    }
    const data = await parseGoogleCalendarResponse(create);
    return { eventId: String(data.id || eventId), htmlLink: String(data.htmlLink || '') };
};

export const deleteGoogleCalendarEvent = async (
    accessToken: string,
    slug: string,
    appointmentId: string,
    calendarId = 'primary'
) => {
    const eventId = googleCalendarEventId(slug, appointmentId);
    const response = await fetch(`${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 404 || response.status === 410) return { deleted: false, eventId };
    await parseGoogleCalendarResponse(response);
    return { deleted: true, eventId };
};

export const listManagedGoogleCalendarEventIds = async (
    accessToken: string,
    slug: string,
    calendarId = 'primary'
) => {
    const ids: string[] = [];
    let pageToken = '';
    do {
        const query = new URLSearchParams({
            maxResults: '2500',
            showDeleted: 'false',
            singleEvents: 'true',
            privateExtendedProperty: `feitosaSlug=${slug}`,
        });
        if (pageToken) query.set('pageToken', pageToken);
        const response = await fetch(`${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events?${query.toString()}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await parseGoogleCalendarResponse(response);
        for (const event of data.items || []) if (event?.id) ids.push(String(event.id));
        pageToken = String(data.nextPageToken || '');
    } while (pageToken);
    return ids;
};

export const deleteGoogleCalendarEventById = async (
    accessToken: string,
    eventId: string,
    calendarId = 'primary'
) => {
    const response = await fetch(`${CALENDAR_API_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 404 || response.status === 410) return false;
    await parseGoogleCalendarResponse(response);
    return true;
};
