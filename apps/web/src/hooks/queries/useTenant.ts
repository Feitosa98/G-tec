import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeRequest, getStoreSlug } from '../../utils/api';

const defaultTenant = {
    id: 'gtec-default',
    businessName: 'Feitosa Soluções em Informática',
    legalName: 'IAGO DA SILVA FEITOSA',
    shortName: 'Feitosa Soluções',
    logoUrl: '/G-tec/logo.png', // Fallback, will be replaced by actual data
    primaryColor: '#0052cc',
    accentColor: '#d4a024',
    backgroundColor: '#0a0e1a',
    cardColor: '#12182b',
    storeSlug: 'gtec-informatica',
    customDomain: '',
    whatsapp: '5592992800023',
    email: 'contato@gtecinformatica.com.br',
    billingEmail: '',
    phone: '',
    document: '35.623.245/0001-50',
    address: 'Manaus - AM',
    street: '',
    addressNumber: '',
    neighborhood: '',
    city: 'Manaus',
    state: 'AM',
    postalCode: '',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z'
};

export const useTenant = () => {
    return useQuery({
        queryKey: ['tenant', getStoreSlug()],
        queryFn: async () => {
            const slug = getStoreSlug();
            try {
                const response = await fetch(`/api/tenants/resolve?slug=${slug}`);
                if (!response.ok) return defaultTenant;
                const data = await response.json();
                return data || defaultTenant;
            } catch {
                return defaultTenant;
            }
        },
        staleTime: 1000 * 60 * 60 // 1 hour
    });
};

export const useUpdateTenantSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: any) => storeRequest('settings', { method: 'PUT', body: JSON.stringify(settings) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenant'] })
    });
};
