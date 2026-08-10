import { useAuthStore } from '../store/authStore';
import { getStoreSlug } from '../utils/api';
import toast from 'react-hot-toast';

interface NotifyOptions {
    channel: 'whatsapp' | 'telegram' | 'email';
    to: string;
    message: string;
    subject?: string;
}

export function useNotify() {
    const token = useAuthStore(state => state.user?.token || '');

    const notify = async (opts: NotifyOptions): Promise<boolean> => {
        const storeSlug = getStoreSlug();
        if (!storeSlug || !token) {
            toast.error('Tenant não encontrado.');
            return false;
        }

        const toastId = toast.loading(
            opts.channel === 'whatsapp'
                ? '📲 Enviando WhatsApp...'
                : opts.channel === 'email'
                    ? '📧 Enviando E-mail...'
                    : '✈️ Enviando Telegram...'
        );

        try {
            const res = await fetch(`/api/store/${storeSlug}/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(opts)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Erro desconhecido');

            toast.success('Mensagem enviada com sucesso! ✅', { id: toastId });
            return true;
        } catch (err: any) {
            toast.error(`Falha: ${err.message}`, { id: toastId });
            return false;
        }
    };

    return { notify };
}
