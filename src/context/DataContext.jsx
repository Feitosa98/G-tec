import { useState, useEffect } from 'react';
import { products as initialProducts } from '../data/products';
import { DataContext } from './data-context';

const defaultTenant = {
    businessName: 'GTEC Informática',
    shortName: 'GTEC',
    logoUrl: `${import.meta.env.BASE_URL}logo.png`,
    primaryColor: '#0052cc',
    accentColor: '#d4a024',
    backgroundColor: '#0a0e1a',
    cardColor: '#12182b',
    storeSlug: 'gtec-informatica',
    customDomain: '',
    whatsapp: '5592992800023',
    email: 'contato@gtecinformatica.com.br',
    document: '45.123.789/0001-90',
    address: 'Manaus - AM'
};

const readStoredValue = (key, fallback) => {
    try {
        const storedValue = localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) : fallback;
    } catch {
        localStorage.removeItem(key);
        return fallback;
    }
};

export const DataProvider = ({ children }) => {
    // --- STATE ---
    const [products, setProducts] = useState(() => readStoredValue('gtec-products-v5', initialProducts));
    const [sales, setSales] = useState(() => readStoredValue('gtec-sales-v2', []));
    const [expenses, setExpenses] = useState(() => readStoredValue('gtec-expenses-v2', []));
    const [cart, setCart] = useState(() => readStoredValue('gtec-cart-v2', []));
    const [tenant, setTenant] = useState(() => ({
        ...defaultTenant,
        ...readStoredValue('gtec-tenant-v1', {})
    }));

    // --- PERSISTENCE ---
    useEffect(() => {
        localStorage.setItem('gtec-products-v5', JSON.stringify(products));
    }, [products]);

    useEffect(() => {
        localStorage.setItem('gtec-sales-v2', JSON.stringify(sales));
    }, [sales]);

    useEffect(() => {
        localStorage.setItem('gtec-expenses-v2', JSON.stringify(expenses));
    }, [expenses]);

    useEffect(() => {
        localStorage.setItem('gtec-cart-v2', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        localStorage.setItem('gtec-tenant-v1', JSON.stringify(tenant));

        const root = document.documentElement;
        root.style.setProperty('--color-primary', tenant.primaryColor);
        root.style.setProperty('--color-primary-dark', tenant.primaryColor);
        root.style.setProperty('--color-accent', tenant.accentColor);
        root.style.setProperty('--color-accent-light', tenant.accentColor);
        root.style.setProperty('--color-bg-dark', tenant.backgroundColor);
        root.style.setProperty('--color-bg-darker', tenant.backgroundColor);
        root.style.setProperty('--color-bg-card', tenant.cardColor);
        root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${tenant.primaryColor} 0%, ${tenant.backgroundColor} 100%)`);
        root.style.setProperty('--gradient-accent', `linear-gradient(135deg, ${tenant.accentColor} 0%, ${tenant.primaryColor} 100%)`);
        root.style.setProperty('--gradient-card', `linear-gradient(145deg, ${tenant.cardColor} 0%, ${tenant.backgroundColor} 100%)`);
        document.title = tenant.businessName;
    }, [tenant]);

    // --- ACTIONS ---

    // Product Actions
    const addProduct = (product) => {
        const newProduct = { ...product, id: crypto.randomUUID() };
        setProducts([...products, newProduct]);
    };

    const updateProduct = (updatedProduct) => {
        setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    };

    const deleteProduct = (id) => {
        setProducts(products.filter(p => p.id !== id));
    };

    // Sales Actions
    const registerSale = (orderDataOrItems, userEmail = 'guest') => {
        let newSale;
        if (Array.isArray(orderDataOrItems)) {
            // Simple call (just items)
            const cartItems = orderDataOrItems;
            newSale = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                items: cartItems,
                total: cartItems.reduce((acc, item) => acc + item.price, 0),
                totalCost: cartItems.reduce((acc, item) => acc + (item.costPrice || 0), 0),
                userEmail: userEmail,
                status: 'Pendente',
                type: 'sale'
            };
        } else {
            // Full order object from Checkout
            const installmentCount = Math.max(1, Number(orderDataOrItems.paymentTerms?.installments) || 1);
            const firstDueDate = orderDataOrItems.paymentTerms?.firstDueDate
                ? new Date(`${orderDataOrItems.paymentTerms.firstDueDate}T12:00:00`)
                : new Date();
            const baseInstallmentValue = Math.floor((Number(orderDataOrItems.total) / installmentCount) * 100) / 100;
            const installments = orderDataOrItems.paymentTerms?.type === 'terms'
                ? Array.from({ length: installmentCount }, (_, index) => {
                    const dueDate = new Date(firstDueDate);
                    dueDate.setMonth(firstDueDate.getMonth() + index);
                    const isLast = index === installmentCount - 1;
                    const value = isLast
                        ? Number((Number(orderDataOrItems.total) - (baseInstallmentValue * index)).toFixed(2))
                        : baseInstallmentValue;

                    return {
                        id: crypto.randomUUID(),
                        number: index + 1,
                        dueDate: dueDate.toISOString(),
                        value,
                        status: 'Pendente',
                        paidAt: null
                    };
                })
                : [];

            newSale = {
                ...orderDataOrItems,
                id: crypto.randomUUID(), // Always generate secure ID
                type: 'sale',
                installments,
                paymentStatus: installments.length > 0 ? 'Pendente' : 'Pago',
                totalCost: orderDataOrItems.items?.reduce((acc, item) => acc + (item.costPrice || 0), 0) || 0
            };
        }
        setSales(currentSales => [...currentSales, newSale]);
    };

    const updateOrderStatus = (saleId, newStatus) => {
        setSales(currentSales => currentSales.map(sale => sale.id === saleId ? { ...sale, status: newStatus } : sale));
    };

    const markInstallmentPaid = (saleId, installmentId) => {
        setSales(currentSales => currentSales.map(sale => {
            if (sale.id !== saleId) return sale;

            const installments = (sale.installments || []).map(installment =>
                installment.id === installmentId
                    ? { ...installment, status: 'Pago', paidAt: new Date().toISOString() }
                    : installment
            );

            return {
                ...sale,
                installments,
                paymentStatus: installments.length > 0 && installments.every(installment => installment.status === 'Pago')
                    ? 'Pago'
                    : 'Pendente'
            };
        }));
    };

    const updateTenant = (settings) => {
        setTenant(currentTenant => ({ ...currentTenant, ...settings }));
    };

    // Expense Actions
    const addExpense = (expense) => {
        // expense: { id, name, value, date, type: 'fixed' | 'variable' }
        setExpenses([...expenses, { ...expense, id: crypto.randomUUID() }]);
    };

    const removeExpense = (id) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    // Cart Actions
    const addToCart = (product) => {
        // Check if product already exists in cart
        const existingIndex = cart.findIndex(item => item.id === product.id);

        if (existingIndex !== -1) {
            // Product exists, increment quantity
            const newCart = [...cart];
            newCart[existingIndex] = {
                ...newCart[existingIndex],
                quantity: (newCart[existingIndex].quantity || 1) + 1
            };
            setCart(newCart);
        } else {
            // New product, add with quantity 1
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const updateCartItemQuantity = (index, newQuantity) => {
        if (newQuantity <= 0) {
            removeFromCart(index);
            return;
        }

        const newCart = [...cart];
        newCart[index] = { ...newCart[index], quantity: newQuantity };
        setCart(newCart);
    };

    const removeFromCart = (index) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const clearCart = () => {
        setCart([]);
    };

    // Get total number of items (considering quantities)
    const getCartItemCount = () => {
        return cart.reduce((total, item) => total + (item.quantity || 1), 0);
    };

    const generateMockData = () => {
        // 1. Generate Fake Sales (Last 30 days)
        const newSales = [];
        const today = new Date();
        const statuses = ['Entregue', 'Enviado', 'Pendente', 'Cancelado'];

        for (let i = 0; i < 45; i++) {
            const randomProduct = products[Math.floor(Math.random() * products.length)];
            const daysAgo = Math.floor(Math.random() * 30);
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);

            // Use promo price if correct, else normal price
            const finalPrice = randomProduct.promoPrice || randomProduct.price;

            newSales.push({
                id: crypto.randomUUID(),
                date: date.toISOString(),
                items: [{ ...randomProduct, price: finalPrice }], // Simulate structure
                total: finalPrice, // CORRECTED FIELD NAME
                totalCost: randomProduct.costPrice || (finalPrice * 0.7), // CORRECTED FIELD NAME
                userEmail: `cliente${Math.floor(Math.random() * 20)}@email.com`, // Fake users
                status: statuses[Math.floor(Math.random() * statuses.length)],
                type: 'sale'
            });
        }

        // 2. Generate Fixed Expenses
        const expenses = [
            { id: crypto.randomUUID(), description: 'Aluguel Loja', amount: 2500, type: 'expense', date: new Date(today.setDate(5)).toISOString(), manual: true }, // 5th of month
            { id: crypto.randomUUID(), description: 'Internet Fibra', amount: 200, type: 'expense', date: new Date(today.setDate(10)).toISOString(), manual: true },
            { id: crypto.randomUUID(), description: 'Energia', amount: 450, type: 'expense', date: new Date(today.setDate(15)).toISOString(), manual: true },
            { id: crypto.randomUUID(), description: 'Marketing Facebook', amount: 1500, type: 'expense', date: new Date(today.setDate(20)).toISOString(), manual: true },
        ];

        // Merge and Save
        const allFinancials = [...newSales, ...expenses];
        setSales(allFinancials); // In our simplified model, 'sales' holds all transactions
        localStorage.setItem('gtec-sales-v2', JSON.stringify(allFinancials));

        return true;
    };

    // --- CALCULATIONS ---
    const getFinancialSummary = () => {
        // Safe reduce with initial values and number checks
        const productSalesRevenue = sales
            .filter(s => s.type === 'sale')
            .reduce((acc, sale) => acc + (Number(sale.total) || 0), 0);

        const totalCOGS = sales
            .filter(s => s.type === 'sale')
            .reduce((acc, sale) => acc + (Number(sale.totalCost) || 0), 0);

        // For mock data, expenses are mixed into 'sales' array with type 'expense'
        // For legacy data, they might be in 'expenses' state
        const mixedExpenses = sales
            .filter(s => s.type === 'expense')
            .reduce((acc, e) => acc + (Number(e.amount) || Number(e.value) || 0), 0);

        const legacyExpenses = expenses
            .reduce((acc, e) => acc + (Number(e.value) || 0), 0);

        const totalExpenses = mixedExpenses + legacyExpenses;

        const totalRevenue = productSalesRevenue;
        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;

        return {
            totalRevenue,
            totalCOGS,
            totalExpenses,
            grossProfit,
            netProfit,
            salesCount: sales.filter(s => s.type === 'sale').length
        };
    };

    return (
        <DataContext.Provider value={{
            products,
            sales,
            expenses,
            addProduct,
            updateProduct,
            deleteProduct,
            registerSale,
            addExpense,
            removeExpense,
            getFinancialSummary,
            updateOrderStatus,
            markInstallmentPaid,
            cart,
            addToCart,
            updateCartItemQuantity,
            removeFromCart,
            clearCart,
            getCartItemCount,
            generateMockData,
            tenant,
            updateTenant,
            cartTotal: cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0)
        }}>
            {children}
        </DataContext.Provider>
    );
};
