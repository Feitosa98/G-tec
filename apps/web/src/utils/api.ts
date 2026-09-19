import { useAuthStore } from '../store/authStore';

export const getStoreSlug = () => useAuthStore.getState().user?.storeSlug
    || new URLSearchParams(window.location.search).get('loja')
    || localStorage.getItem('gtec-active-tenant')
    || 'gtec-informatica';

export const storeQueryKey = (resource: string) => ['store', getStoreSlug(), resource] as const;

export const storeRequest = async (path: string, options: RequestInit = {}) => {
    const slug = getStoreSlug();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    if (options.signal) options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    let response: Response;
    try {
        response = await fetch(`/api/store/${slug}/${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    } catch (error: any) {
        if (error?.name === 'AbortError') throw new Error('O servidor demorou demais para responder. Tente novamente.');
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
    
    if (response.status === 401) {
        useAuthStore.getState().logout();
        const loginUrl = '/';
        window.location.replace(loginUrl);
        throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (!response.ok) {
        throw new Error('Erro na requisição.');
    }
    
    return response.json();
};
