import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeQueryKey, storeRequest } from '../../utils/api';

export const useProducts = () => {
    return useQuery({
        queryKey: storeQueryKey('products'),
        queryFn: () => storeRequest('products')
    });
};

export const useAddProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (product: any) => storeRequest('products', { method: 'POST', body: JSON.stringify(product) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storeQueryKey('products') });
        }
    });
};

export const useUpdateProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: any) => storeRequest(`products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storeQueryKey('products') });
        }
    });
};

export const useDeleteProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => storeRequest(`products/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storeQueryKey('products') });
        }
    });
};
