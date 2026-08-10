import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';

// Armazena as instâncias ativas e os QR Codes pendentes
const sessions = new Map<string, any>();
const qrCodes = new Map<string, string>();
const connectionStatus = new Map<string, string>(); // 'connecting', 'connected', 'disconnected'
const initializationPromises = new Map<string, Promise<any>>();

const getSessionDir = (tenantId: string) => path.join(process.cwd(), 'sessions', tenantId);

const hasSavedSession = (tenantId: string) => fs.existsSync(path.join(getSessionDir(tenantId), 'creds.json'));

const waitUntilConnected = async (tenantId: string, timeoutMs = 15_000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (connectionStatus.get(tenantId) === 'connected' && sessions.get(tenantId)) return;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('WhatsApp conectado, mas a sessão ainda está sincronizando. Tente novamente em alguns segundos.');
};

const normalizeWhatsAppPhone = (phone: string) => {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (digits.length < 12 || digits.length > 15) {
        throw new Error('Telefone inválido. Informe DDD e número do WhatsApp.');
    }
    return digits;
};

const resolveWhatsAppJid = async (sock: any, phone: string) => {
    const digits = normalizeWhatsAppPhone(phone);
    const matches = await sock.onWhatsApp(digits);
    const account = matches?.find((item: any) => item.exists);
    if (!account?.jid) throw new Error('Este telefone não foi encontrado no WhatsApp. Confira o DDD e o número.');
    return account.jid;
};

export async function initWhatsAppConnection(tenantId: string) {
    const current = sessions.get(tenantId);
    const status = connectionStatus.get(tenantId);
    if (current && (status === 'connected' || status === 'connecting')) return current;

    const pending = initializationPromises.get(tenantId);
    if (pending) return pending;

    const initialization = createWhatsAppConnection(tenantId);
    initializationPromises.set(tenantId, initialization);
    try {
        return await initialization;
    } finally {
        initializationPromises.delete(tenantId);
    }
}

async function createWhatsAppConnection(tenantId: string) {
    const sessionDir = getSessionDir(tenantId);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    connectionStatus.set(tenantId, 'connecting');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            const qrBase64 = await QRCode.toDataURL(qr);
            qrCodes.set(tenantId, qrBase64);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            connectionStatus.set(tenantId, 'disconnected');
            sessions.delete(tenantId);
            if (shouldReconnect) {
                setTimeout(() => void initWhatsAppConnection(tenantId).catch(console.error), 1_000);
            } else {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                qrCodes.delete(tenantId);
            }
        } else if (connection === 'open') {
            connectionStatus.set(tenantId, 'connected');
            qrCodes.delete(tenantId);
        }
    });

    sessions.set(tenantId, sock);
    return sock;
}

export async function restoreWhatsAppSession(tenantId: string) {
    if (!hasSavedSession(tenantId)) return false;
    await initWhatsAppConnection(tenantId);
    return true;
}

export async function restoreWhatsAppSessions() {
    const sessionsRoot = path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(sessionsRoot)) return;

    const tenantIds = fs.readdirSync(sessionsRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && hasSavedSession(entry.name))
        .map(entry => entry.name);

    await Promise.allSettled(tenantIds.map(tenantId => initWhatsAppConnection(tenantId)));
}

export function getWhatsAppStatus(tenantId: string) {
    return {
        status: connectionStatus.get(tenantId) || 'disconnected',
        qr: qrCodes.get(tenantId) || null
    };
}

export async function disconnectWhatsApp(tenantId: string) {
    const sock = sessions.get(tenantId);
    if (sock) {
        await sock.logout();
    }
    const sessionDir = path.join(process.cwd(), 'sessions', tenantId);
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    connectionStatus.set(tenantId, 'disconnected');
    qrCodes.delete(tenantId);
    sessions.delete(tenantId);
}

export async function sendWhatsAppMessage(tenantId: string, phone: string, text: string) {
    let sock = sessions.get(tenantId);
    if (!sock && hasSavedSession(tenantId)) {
        sock = await initWhatsAppConnection(tenantId);
    }
    if (!sock) {
        throw new Error('WhatsApp não conectado. Abra Integrações e conecte pelo QR Code.');
    }

    if (connectionStatus.get(tenantId) !== 'connected') await waitUntilConnected(tenantId);
    const jid = await resolveWhatsAppJid(sock, phone);
    return await sock.sendMessage(jid, { text });
}

export async function sendWhatsAppCharge(tenantId: string, phone: string, options: {
    message: string;
    qrCodeBase64?: string;
    pdfBase64?: string;
    pdfFilename?: string;
}) {
    let sock = sessions.get(tenantId);
    if (!sock && hasSavedSession(tenantId)) {
        sock = await initWhatsAppConnection(tenantId);
    }
    if (!sock) throw new Error('WhatsApp não conectado. Abra Integrações e conecte pelo QR Code.');
    if (connectionStatus.get(tenantId) !== 'connected') await waitUntilConnected(tenantId);
    const jid = await resolveWhatsAppJid(sock, phone);

    if (options.qrCodeBase64) {
        await sock.sendMessage(jid, {
            image: Buffer.from(options.qrCodeBase64, 'base64'),
            caption: options.message,
            mimetype: 'image/png',
        });
    } else {
        await sock.sendMessage(jid, { text: options.message });
    }

    if (options.pdfBase64) {
        await sock.sendMessage(jid, {
            document: Buffer.from(options.pdfBase64, 'base64'),
            mimetype: 'application/pdf',
            fileName: options.pdfFilename || 'cobranca.pdf',
            caption: 'Documento da cobrança',
        });
    }
}
