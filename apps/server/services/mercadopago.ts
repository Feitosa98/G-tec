import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

export interface MPPaymentItem {
    title: string;
    quantity: number;
    unit_price: number;
    currency_id?: string;
}

export interface MPPreferenceOptions {
    accessToken: string;
    items: MPPaymentItem[];
    payerEmail?: string;
    payerName?: string;
    externalReference?: string;
    notificationUrl?: string;
}

export interface MPPreferenceResult {
    id: string;
    initPoint: string;
    sandboxInitPoint: string;
}

/**
 * Cria uma preferência de pagamento no Mercado Pago (SDK v2)
 */
export async function createMPPreference(opts: MPPreferenceOptions): Promise<MPPreferenceResult> {
    const client = new MercadoPagoConfig({ accessToken: opts.accessToken, options: { timeout: 15000 } });
    const preferenceClient = new Preference(client);

    const response = await preferenceClient.create({
        body: {
            items: opts.items.map((item, idx) => ({
                id: String(idx + 1),
                title: item.title,
                quantity: item.quantity,
                unit_price: item.unit_price,
                currency_id: item.currency_id || 'BRL',
            })),
            payer: opts.payerEmail ? {
                email: opts.payerEmail,
                name: opts.payerName,
            } : undefined,
            external_reference: opts.externalReference,
            notification_url: opts.notificationUrl,
            payment_methods: {
                installments: 12,
            },
        }
    });

    return {
        id: String(response.id || ''),
        initPoint: response.init_point || '',
        sandboxInitPoint: response.sandbox_init_point || '',
    };
}

export async function getMPPayment(accessToken: string, paymentId: string) {
    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
    const paymentClient = new Payment(client);
    return paymentClient.get({ id: paymentId });
}
