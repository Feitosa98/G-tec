import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct } from './queries/useProducts';
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer } from './queries/useCustomers';
import { useServices, useAddService, useUpdateService, useDeleteService, useServiceOrders, useAddServiceOrder, useUpdateServiceOrder } from './queries/useServices';
import { useSales, useAddSale, useUpdateSale, useReceivables, useAddReceivable, useUpdateReceivable, useDeleteReceivable, useSubscriptions, useAddSubscription, useUpdateSubscription } from './queries/useFinance';
import { useTenant, useUpdateTenantSettings } from './queries/useTenant';
import { useCartStore } from '../store/cartStore';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';
import { reconcileInstallments } from '../utils/installmentPayments';
import { useMemo } from 'react';

export const useData = () => {
    // Queries
    const { data: tenantData } = useTenant();
    const { data: productsData } = useProducts();
    const { data: customersData } = useCustomers();
    const { data: servicesData } = useServices();
    const { data: serviceOrdersData } = useServiceOrders();
    const { data: salesData } = useSales();
    const { data: expensesData } = useReceivables();
    const { data: subscriptionsData } = useSubscriptions();
    const serviceOrders = useMemo(() => (serviceOrdersData || []).map((order: any) => ({ ...order, installments: reconcileInstallments(order) })), [serviceOrdersData]);
    const sales = useMemo(() => (salesData || []).map((sale: any) => ({ ...sale, installments: reconcileInstallments(sale) })), [salesData]);

    // Mutations
    const { mutateAsync: addProductMut } = useAddProduct();
    const { mutateAsync: updateProductMut } = useUpdateProduct();
    const { mutateAsync: deleteProductMut } = useDeleteProduct();

    const { mutateAsync: addCustomerMut } = useAddCustomer();
    const { mutateAsync: updateCustomerMut } = useUpdateCustomer();
    const { mutateAsync: deleteCustomerMut } = useDeleteCustomer();

    const { mutateAsync: addServiceMut } = useAddService();
    const { mutateAsync: updateServiceMut } = useUpdateService();
    const { mutateAsync: deleteServiceMut } = useDeleteService();

    const { mutateAsync: addOrderMut } = useAddServiceOrder();
    const { mutateAsync: updateOrderMut } = useUpdateServiceOrder();

    const { mutateAsync: addSaleMut } = useAddSale();
    const { mutateAsync: updateSaleMut } = useUpdateSale();
    const { mutateAsync: addExpenseMut } = useAddReceivable();
    const { mutateAsync: updateExpenseMut } = useUpdateReceivable();
    const { mutateAsync: removeExpenseMut } = useDeleteReceivable();

    const { mutateAsync: addSubMut } = useAddSubscription();
    const { mutateAsync: updateSubMut } = useUpdateSubscription();

    const { mutateAsync: updateTenantMut } = useUpdateTenantSettings();

    // Zustand Stores
    const cartStore = useCartStore();
    const uiStore = useUIStore();

    // Mock data function to replace old behavior safely
    const generateMockData = () => {
        uiStore.showAlert('Atenção', 'A geração de dados fictícios está desabilitada na nova versão.');
    };

    const getFinancialSummary = () => {
        const totalSales = (salesData || []).reduce((acc: number, sale: any) => acc + (Number(sale.total) || 0), 0);
        const extraRevenue = (expensesData || []).filter((entry: any) => entry.type === 'inflow')
            .reduce((acc: number, entry: any) => acc + (Number(entry.value ?? entry.amount) || 0), 0);
        const totalExpenses = (expensesData || []).filter((entry: any) => entry.type !== 'inflow')
            .reduce((acc: number, entry: any) => acc + (Number(entry.value ?? entry.amount) || 0), 0);
        const cashReceivedFromSales = (salesData || []).reduce((total: number, sale: any) => {
            if (Number.isFinite(Number(sale.paidTotal))) return total + Number(sale.paidTotal);
            if (sale.paymentStatus === 'Pago' || sale.status === 'Pago') return total + (Number(sale.total) || 0);
            return total;
        }, 0);
        const totalCOGS = (salesData || []).reduce((total: number, sale: any) => {
            const calculatedItemCost = (sale.items || []).reduce(
                (subtotal: number, item: any) => subtotal + (Number(item.cost ?? item.costPrice ?? item.purchasePrice) || 0) * (Number(item.quantity ?? item.qty) || 1), 0
            );
            return total + (Number.isFinite(Number(sale.totalCost)) ? Number(sale.totalCost) : calculatedItemCost);
        }, 0);
        const totalRevenue = totalSales + extraRevenue;
        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;
        const pendingReceivables = sales.reduce((total: number, sale: any) => {
            const installments = sale.installments || [];
            if (installments.length) return total + installments
                .filter((installment: any) => installment.status !== 'Pago' && !installment.paid)
                .reduce((subtotal: number, installment: any) => subtotal + (Number(installment.balanceDue ?? installment.value ?? installment.amount) || 0), 0);
            return total + Math.max(0, Number(sale.balanceDue ?? 0) || 0);
        }, 0);
        const pendingPayables = (expensesData || []).filter((entry: any) => entry.type !== 'inflow' && entry.status === 'Pendente')
            .reduce((total: number, entry: any) => total + (Number(entry.value ?? entry.amount) || 0), 0);
        const cashReceived = cashReceivedFromSales + extraRevenue;

        return {
            totalRevenue,
            totalCOGS,
            grossProfit,
            totalExpenses,
            netProfit,
            revenue: totalRevenue,
            expenses: totalExpenses,
            balance: netProfit,
            pending: pendingReceivables,
            cashReceived,
            pendingPayables,
        };
    };

    return {
        // Data arrays (fallback to empty array if loading)
        tenant: tenantData,
        products: productsData || [],
        customers: customersData || [],
        services: servicesData || [],
        serviceOrders,
        sales,
        expenses: expensesData || [],
        subscriptions: subscriptionsData || [],

        // Product functions
        addProduct: async (p: any) => { await addProductMut(p); return true; },
        updateProduct: async (id: string, p: any) => { await updateProductMut({ id, ...p }); return true; },
        deleteProduct: async (id: string) => { await deleteProductMut(id); return true; },

        // Customer functions (missing in old context exports but we add for safety, or map to setCustomers)
        setCustomers: async (newCustomers: any) => {
            // This is a complex one, we should probably warn or adapt.
            // But let's export the individual ones
        },
        addCustomer: async (c: any) => { await addCustomerMut(c); return true; },
        updateCustomer: async (id: string, c: any) => { await updateCustomerMut({ id, ...c }); return true; },
        deleteCustomer: async (id: string) => { await deleteCustomerMut(id); return true; },

        // Sales and expenses
        registerSale: async (sale: any, _source?: string) => { await addSaleMut(sale); return true; },
        addExpense: async (e: any) => { await addExpenseMut(e); return true; },
        updateExpense: async (id: string, e: any) => { await updateExpenseMut({ id, ...e }); return true; },
        removeExpense: async (id: string) => { await removeExpenseMut(id); return true; },
        getFinancialSummary,

        // Service orders
        updateOrderStatus: async (id: string, status: string) => {
            const sale = salesData?.find((item: any) => item.id === id);
            if (!sale) return false;
            await updateSaleMut({ ...sale, id, status });
            return true;
        },

        // Subscriptions
        markInstallmentPaid: async (saleId: string, installmentId: string, method?: string, finalValue?: number, discount?: number) => {
            const sale = salesData?.find((item: any) => item.id === saleId);
            if (sale) {
                const paidAt = new Date().toISOString();
                const currentInstallments = reconcileInstallments(sale);
                const selected = currentInstallments.find((item: any) => item.id === installmentId);
                if (!selected || selected.paid) return false;
                const receipt = { id: crypto.randomUUID(), installmentId, amount: Number(finalValue ?? selected.balanceDue ?? selected.value), principalAmount: selected.balanceDue ?? selected.value, method: method || 'Dinheiro', note: 'Recebimento de parcela', paidAt };
                const priorPayments = sale.payments?.length ? sale.payments : Number(sale.paidTotal) > 0
                    ? [{ id: crypto.randomUUID(), amount: Number(sale.paidTotal), method: 'Saldo recebido anteriormente', paidAt }] : [];
                const salePayments = [...priorPayments, receipt];
                const newInstallments = currentInstallments.map((installment: any) => installment.id === installmentId
                    ? { ...installment, status: 'Pago', paid: true, allocatedByReceipts: false, paidTotal: installment.value, balanceDue: 0, paidAt, paymentMethod: method, paidValue: finalValue, discount }
                    : installment);
                const allPaid = newInstallments.length > 0 && newInstallments.every((installment: any) => installment.status === 'Pago' || installment.paid);
                const paidTotal = newInstallments.filter((installment: any) => installment.status === 'Pago' || installment.paid)
                    .reduce((sum: number, installment: any) => sum + Number(installment.value ?? installment.amount ?? 0), 0)
                    + newInstallments.filter((installment: any) => !installment.paid).reduce((sum: number, installment: any) => sum + Number(installment.paidTotal || 0), 0);
                await updateSaleMut({ ...sale, id: saleId, payments: salePayments, installments: newInstallments, paidTotal, balanceDue: Math.max(0, Number(sale.total || 0) - paidTotal), paymentStatus: allPaid ? 'Pago' : paidTotal > 0 ? 'Parcial' : 'Pendente', status: allPaid ? 'Pago' : sale.status });

                if (sale.osReference) {
                    const order = serviceOrdersData?.find((item: any) => item.id === sale.osReference);
                    if (order) {
                        const existingPayments = order.payments || [];
                        const payments = existingPayments.some((payment: any) => payment.installmentId === installmentId)
                            ? existingPayments
                            : [...existingPayments, receipt];
                        await updateOrderMut({
                            ...order, id: order.id, installments: newInstallments, payments, paidTotal,
                            balanceDue: Math.max(0, Number(order.totalValue || sale.total || 0) - paidTotal),
                            paymentStatus: allPaid ? 'Pago' : 'Parcial', status: allPaid ? 'Paga' : order.status,
                        });
                    }
                }
                return true;
            }
            return false;
        },

        // Cart
        cart: cartStore.cart,
        addToCart: cartStore.addToCart,
        updateCartItemQuantity: cartStore.updateCartItemQuantity,
        removeFromCart: cartStore.removeFromCart,
        clearCart: cartStore.clearCart,
        getCartItemCount: cartStore.getCartItemCount,
        cartTotal: cartStore.getCartTotal(),

        // Tenant
        updateTenant: async (t: any) => { await updateTenantMut(t); return true; },

        // UI Modals
        showConfirm: uiStore.showConfirm,
        showAlert: uiStore.showAlert,

        generateMockData,
        
        // Stubs for setX to avoid crashes
        setServices: () => {},
        setServiceOrders: () => {},
        setSubscriptions: () => {}
    };
};
