import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeQueryKey, storeRequest } from '../../utils/api';

export const useSales = () => {
    return useQuery({
        queryKey: storeQueryKey('sales'),
        queryFn: () => storeRequest('sales')
    });
};

export const useAddSale = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (sale: any) => storeRequest('sales', { method: 'POST', body: JSON.stringify(sale) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('sales') })
    });
};

export const useUpdateSale = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`sales/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('sales') })
    });
};

export const useReceivables = () => {
    return useQuery({
        queryKey: storeQueryKey('expenses'), // Note: Assuming the backend collection is 'expenses' for now based on old DataContext
        queryFn: () => storeRequest('expenses')
    });
};

export const useAddReceivable = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (receivable: any) => storeRequest('expenses', { method: 'POST', body: JSON.stringify(receivable) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('expenses') })
    });
};

export const useUpdateReceivable = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('expenses') })
    });
};

export const useDeleteReceivable = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => storeRequest(`expenses/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('expenses') })
    });
};

export const useSubscriptions = () => {
    return useQuery({
        queryKey: storeQueryKey('subscriptions'),
        queryFn: () => storeRequest('subscriptions')
    });
};

export const useAddSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (subscription: any) => storeRequest('subscriptions', { method: 'POST', body: JSON.stringify(subscription) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('subscriptions') })
    });
};

export const useUpdateSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('subscriptions') })
    });
};
