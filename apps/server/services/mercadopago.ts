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

export interface MPPixPaymentOptions {
    accessToken: string;
    amount: number;
    description: string;
    payerEmail: string;
    payerName?: string;
    externalReference?: string;
    notificationUrl?: string;
    idempotencyKey: string;
}

export interface MPPixPaymentResult {
    id: string;
    status: string;
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl: string;
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

export async function createMPPixPayment(opts: MPPixPaymentOptions): Promise<MPPixPaymentResult> {
    const client = new MercadoPagoConfig({ accessToken: opts.accessToken, options: { timeout: 15000 } });
    const paymentClient = new Payment(client);
    const response = await paymentClient.create({
        body: {
            transaction_amount: opts.amount,
            description: opts.description,
            payment_method_id: 'pix',
            external_reference: opts.externalReference,
            notification_url: opts.notificationUrl,
            payer: {
                email: opts.payerEmail,
                first_name: opts.payerName,
            },
        },
        requestOptions: { idempotencyKey: opts.idempotencyKey },
    });

    const transactionData = response.point_of_interaction?.transaction_data;
    return {
        id: String(response.id || ''),
        status: String(response.status || 'pending'),
        qrCode: transactionData?.qr_code || '',
        qrCodeBase64: transactionData?.qr_code_base64 || '',
        ticketUrl: transactionData?.ticket_url || '',
    };
}
