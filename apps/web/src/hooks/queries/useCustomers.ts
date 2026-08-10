import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeQueryKey, storeRequest } from '../../utils/api';

export const useCustomers = () => {
    return useQuery({
        queryKey: storeQueryKey('customers'),
        queryFn: () => storeRequest('customers')
    });
};

export const useAddCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (customer: any) => storeRequest('customers', { method: 'POST', body: JSON.stringify(customer) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storeQueryKey('customers') });
        }
    });
};

export const useUpdateCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storeQueryKey('customers') });
        }
    });
};

export const useDeleteCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => storeRequest(`customers/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storeQueryKey('customers') });
        }
    });
};
