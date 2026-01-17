import toast from 'react-hot-toast';

export const showToast = {
    success: (message) => {
        toast.success(message, {
            duration: 3000,
            position: 'top-right',
            style: {
                background: 'var(--color-bg-card)',
                color: 'white',
                border: '1px solid var(--color-success)',
            },
            iconTheme: {
                primary: 'var(--color-success)',
                secondary: 'white',
            },
        });
    },

    error: (message) => {
        toast.error(message, {
            duration: 4000,
            position: 'top-right',
            style: {
                background: 'var(--color-bg-card)',
                color: 'white',
                border: '1px solid var(--color-danger)',
            },
            iconTheme: {
                primary: 'var(--color-danger)',
                secondary: 'white',
            },
        });
    },

    info: (message) => {
        toast(message, {
            duration: 3000,
            position: 'top-right',
            icon: 'ℹ️',
            style: {
                background: 'var(--color-bg-card)',
                color: 'white',
                border: '1px solid var(--color-primary)',
            },
        });
    },
};
