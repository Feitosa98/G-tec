import { create } from 'zustand';

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
}

interface CartStore {
    cart: CartItem[];
    addToCart: (item: any) => void;
    updateCartItemQuantity: (id: string, delta: number) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    getCartItemCount: () => number;
    getCartTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
    cart: [],
    
    addToCart: (item) => {
        set((state) => {
            const existingItem = state.cart.find(i => i.id === item.id);
            if (existingItem) {
                return {
                    cart: state.cart.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i)
                };
            }
            return { cart: [...state.cart, { ...item, quantity: 1 }] };
        });
    },

    updateCartItemQuantity: (id, delta) => {
        set((state) => ({
            cart: state.cart.map(item => {
                if (item.id === id) {
                    const newQuantity = (item.quantity || 1) + delta;
                    return { ...item, quantity: Math.max(1, newQuantity) };
                }
                return item;
            })
        }));
    },

    removeFromCart: (id) => {
        set((state) => ({ cart: state.cart.filter(item => item.id !== id) }));
    },

    clearCart: () => set({ cart: [] }),

    getCartItemCount: () => {
        return get().cart.reduce((total, item) => total + (item.quantity || 1), 0);
    },

    getCartTotal: () => {
        return get().cart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);
    }
}));
