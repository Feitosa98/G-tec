import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

export const GlobalConfirmModal = () => {
    const { confirmState, closeModal } = useUIStore();
    const { isOpen, title, message, onConfirm, onCancel, isAlert } = confirmState;

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                width: '90%',
                maxWidth: '450px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <button 
                    onClick={onCancel || closeModal}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer'
                    }}
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: isAlert ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        {isAlert ? <AlertTriangle size={24} color="#ef4444" /> : <Info size={24} color="#3b82f6" />}
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: 'var(--color-text-main)' }}>
                            {title}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                            {message}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                    {!isAlert && (
                        <button 
                            onClick={onCancel || closeModal}
                            className="btn-outline"
                        >
                            Cancelar
                        </button>
                    )}
                    <button 
                        onClick={onConfirm || closeModal}
                        className={isAlert ? "btn-primary" : "btn-danger"}
                        style={isAlert ? {} : { backgroundColor: '#ef4444' }}
                    >
                        {isAlert ? 'Entendi' : 'Confirmar'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    );
};
