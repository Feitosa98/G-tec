import { useAuthStore } from '../store/authStore';

export const getStoreSlug = () => useAuthStore.getState().user?.storeSlug
    || new URLSearchParams(window.location.search).get('loja')
    || localStorage.getItem('gtec-active-tenant')
    || 'gtec-informatica';

export const storeQueryKey = (resource: string) => ['store', getStoreSlug(), resource] as const;

export const storeRequest = async (path: string, options: RequestInit = {}) => {
    const token = useAuthStore.getState().user?.token;
    const slug = getStoreSlug();
    
    const response = await fetch(`/api/store/${slug}/${path}`, {
        ...options,
        headers: { 
            'Content-Type': 'application/json', 
            ...(token ? { Authorization: `Bearer ${token}` } : {}), 
            ...options.headers 
        }
    });
    
    if (response.status === 401 && token) {
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
