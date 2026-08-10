import TelegramBot from 'node-telegram-bot-api';

const bots = new Map<string, TelegramBot>();

function getBot(token: string) {
    if (!bots.has(token)) {
        bots.set(token, new TelegramBot(token, { polling: false }));
    }
    return bots.get(token)!;
}

export async function sendTelegramMessage(tenantDb: any, message: string, chatId?: string) {
    const configDoc = await tenantDb.query.integrations.findFirst({
        where: (integrations: any, { eq }: any) => eq(integrations.id, 'telegram')
    });

    if (!configDoc || !configDoc.data || !configDoc.data.token) {
        throw new Error('Telegram integration not configured');
    }

    const { token, defaultChatId } = configDoc.data;
    const targetChatId = chatId || defaultChatId;

    if (!targetChatId) {
        throw new Error('No Telegram chat ID provided');
    }

    const bot = getBot(token);
    return await bot.sendMessage(targetChatId, message, { parse_mode: 'HTML' });
}
