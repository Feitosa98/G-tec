import { useData } from './useData';
import { showToast } from '../utils/toast';

interface MPItems {
    title: string;
    quantity: number;
    unit_price: number;
}

interface GeneratePaymentLinkOptions {
    items: MPItems[];
    payerEmail?: string;
    payerName?: string;
    externalReference?: string;
    referenceType?: 'service_order' | 'installment';
    saleId?: string;
    /** Se true, abre o link automaticamente em nova aba */
    openLink?: boolean;
}

interface GeneratePaymentLinkResult {
    link: string | null;
    success: boolean;
}

/**
 * Hook para gerar links de pagamento via Mercado Pago
 */
export function useMercadoPago() {
    const { tenant } = useData();

    const getToken = () => {
        try { return JSON.parse(localStorage.getItem('gtec-session'))?.token || ''; }
        catch { return ''; }
    };

    const generatePaymentLink = async (opts: GeneratePaymentLinkOptions): Promise<GeneratePaymentLinkResult> => {
        if (!tenant?.storeSlug) {
            showToast.error('Tenant não identificado');
            return { link: null, success: false };
        }

        const toastId = showToast.loading('Gerando link de pagamento...');
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 20000);
        try {
            const res = await fetch(`/api/store/${tenant.storeSlug}/mercadopago/preference`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`,
                },
                body: JSON.stringify(opts),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                showToast.dismiss(toastId);
                showToast.error(data.message || 'Erro ao gerar link');
                return { link: null, success: false };
            }

            const link = data.initPoint || data.sandboxInitPoint;
            if (!link) {
                showToast.dismiss(toastId);
                showToast.error('O Mercado Pago não retornou um link de pagamento');
                return { link: null, success: false };
            }
            showToast.dismiss(toastId);
            showToast.success('Link de pagamento gerado!');

            if (opts.openLink && link) {
                window.open(link, '_blank');
            }

            return { link, success: true };
        } catch (err: any) {
            showToast.dismiss(toastId);
            showToast.error(err?.name === 'AbortError'
                ? 'O Mercado Pago demorou para responder. Tente novamente.'
                : 'Erro ao conectar com Mercado Pago');
            return { link: null, success: false };
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    const copyLinkToClipboard = async (link: string) => {
        try {
            await navigator.clipboard.writeText(link);
            showToast.success('Link copiado!');
        } catch {
            showToast.error('Não foi possível copiar');
        }
    };

    return { generatePaymentLink, copyLinkToClipboard };
}
