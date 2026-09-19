import { z } from 'zod';
import { encryptNfseSecret, inspectNfseCertificate } from './nfse.js';

export const fiscalCertificateSchema = z.object({
    certificateBase64: z.string().min(1).max(2_666_668),
    certificatePassword: z.string().min(1).max(200),
}).strict();

// Keep the existing encrypted storage so emission and lookup use the same A1.
export const prepareFiscalCertificate = (base64: string, password: string, secret: string) => {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
        || !base64 || Buffer.from(base64, 'base64').length > 2_000_000) {
        throw new Error('Certificado inválido. Selecione um arquivo A1 de até 2 MB.');
    }
    const certificate = inspectNfseCertificate(base64, password);
    const now = Date.now();
    if (new Date(certificate.validTo).getTime() <= now) throw new Error('O certificado A1 informado está vencido.');
    if (new Date(certificate.validFrom).getTime() > now) throw new Error('O certificado A1 ainda não está dentro do período de validade.');
    return {
        certificateEncrypted: encryptNfseSecret(base64, secret),
        certificatePasswordEncrypted: encryptNfseSecret(password, secret),
        certificateSubject: certificate.subject,
        certificateValidFrom: certificate.validFrom,
        certificateValidTo: certificate.validTo,
        certificateFingerprint: certificate.fingerprint,
        // A replacement invalidates the connection test for the previous A1.
        lastConnectionAt: '',
        lastConnectionStatus: '',
    };
};

export const publicFiscalCertificate = (config: any, serverConfigured: boolean) => ({
    serverConfigured,
    certificateConfigured: Boolean(config?.certificateEncrypted && config?.certificatePasswordEncrypted),
    certificateSubject: config?.certificateSubject || '',
    certificateValidFrom: config?.certificateValidFrom || '',
    certificateValidTo: config?.certificateValidTo || '',
    certificateFingerprint: config?.certificateFingerprint || '',
});
