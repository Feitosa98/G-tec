import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeQueryKey, storeRequest } from '../../utils/api';

export const useServices = () => {
    return useQuery({
        queryKey: storeQueryKey('services'),
        queryFn: () => storeRequest('services')
    });
};

export const useAddService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (service: any) => storeRequest('services', { method: 'POST', body: JSON.stringify(service) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('services') })
    });
};

export const useUpdateService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('services') })
    });
};

export const useDeleteService = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => storeRequest(`services/${id}`, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('services') })
    });
};

export const useServiceOrders = () => {
    return useQuery({
        queryKey: storeQueryKey('serviceOrders'),
        queryFn: () => storeRequest('service_orders')
    });
};

export const useAddServiceOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (order: any) => storeRequest('service_orders', { method: 'POST', body: JSON.stringify(order) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('serviceOrders') })
    });
};

export const useUpdateServiceOrder = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`service_orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: storeQueryKey('serviceOrders') })
    });
};
