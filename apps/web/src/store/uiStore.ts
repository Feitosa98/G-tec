import { create } from 'zustand';

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    onCancel: (() => void) | null;
    isAlert: boolean;
}

interface UIStore {
    confirmState: ConfirmState;
    showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
    showAlert: (title: string, message: string, onConfirm?: () => void) => void;
    closeModal: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
    confirmState: {
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null,
        isAlert: false
    },
    
    closeModal: () => set((state) => ({ 
        confirmState: { ...state.confirmState, isOpen: false } 
    })),

    showConfirm: (title, message, onConfirm, onCancel) => {
        set({
            confirmState: {
                isOpen: true,
                title,
                message,
                onConfirm: () => {
                    if (onConfirm) onConfirm();
                    get().closeModal();
                },
                onCancel: () => {
                    if (onCancel) onCancel();
                    get().closeModal();
                },
                isAlert: false
            }
        });
    },

    showAlert: (title, message, onConfirm) => {
        set({
            confirmState: {
                isOpen: true,
                title,
                message,
                onConfirm: () => {
                    if (onConfirm) onConfirm();
                    get().closeModal();
                },
                onCancel: null,
                isAlert: true
            }
        });
    }
}));
