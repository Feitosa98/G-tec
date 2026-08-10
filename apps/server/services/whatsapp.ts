import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';

// Armazena as instâncias ativas e os QR Codes pendentes
const sessions = new Map<string, any>();
const qrCodes = new Map<string, string>();
const connectionStatus = new Map<string, string>(); // 'connecting', 'connected', 'disconnected'

export async function initWhatsAppConnection(tenantId: string) {
    const sessionDir = path.join(process.cwd(), 'sessions', tenantId);
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
            if (shouldReconnect) {
                initWhatsAppConnection(tenantId);
            } else {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                sessions.delete(tenantId);
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
    if (!sock) {
        throw new Error('WhatsApp not connected');
    }
    
    // Check if it's connected
    if (connectionStatus.get(tenantId) !== 'connected') {
        throw new Error('WhatsApp is connecting or disconnected');
    }

    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    return await sock.sendMessage(jid, { text });
}

export async function sendWhatsAppCharge(tenantId: string, phone: string, options: {
    message: string;
    qrCodeBase64?: string;
    pdfBase64?: string;
    pdfFilename?: string;
}) {
    const sock = sessions.get(tenantId);
    if (!sock || connectionStatus.get(tenantId) !== 'connected') {
        throw new Error('WhatsApp is connecting or disconnected');
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) throw new Error('Invalid WhatsApp phone');
    const jid = `${digits}@s.whatsapp.net`;

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
