import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
    onScan: (code: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'barcode-scanner-container';

    useEffect(() => {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 100 } },
            (decodedText) => {
                onScan(decodedText);
                scanner.stop().catch(() => {});
                onClose();
            },
            () => {}
        ).catch((err) => {
            setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
            console.error(err);
        });

        return () => {
            scanner.stop().catch(() => {});
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <Camera className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Leitor de Código de Barras</h3>
                            <p className="text-xs text-slate-400">Aponte a câmera para o código do produto</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
                        {error}
                    </div>
                ) : (
                    <div
                        id={containerId}
                        className="w-full rounded-xl overflow-hidden border border-slate-700/50"
                        style={{ minHeight: '250px' }}
                    />
                )}

                <p className="text-center text-xs text-slate-500">
                    Também funciona com leitores USB — apenas leia com o campo de busca ativo
                </p>
            </div>
        </div>
    );
}
