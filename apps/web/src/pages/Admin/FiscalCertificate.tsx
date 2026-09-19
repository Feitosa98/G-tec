import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Save, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

type CertificateStatus = {
    serverConfigured: boolean;
    certificateConfigured: boolean;
    certificateSubject: string;
    certificateValidFrom: string;
    certificateValidTo: string;
    certificateFingerprint: string;
};

export default function FiscalCertificate({ slug, token, onSaved }: {
    slug: string; token: string; onSaved: (status: CertificateStatus) => void;
}) {
    const [status, setStatus] = useState<CertificateStatus | null>(null);
    const [loadError, setLoadError] = useState('');
    const [certificate, setCertificate] = useState('');
    const [password, setPassword] = useState('');
    const [reading, setReading] = useState(false);
    const [saving, setSaving] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const reader = useRef<FileReader | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/store/${slug}/fiscal-certificate`, {
            headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        }).then(async response => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Não foi possível carregar o certificado.');
            setStatus(data);
        }).catch(error => {
            if (!controller.signal.aborted) setLoadError(error.message);
        });
        return () => { controller.abort(); reader.current?.abort(); };
    }, [slug, token]);

    const selectCertificate = (file?: File) => {
        reader.current?.abort();
        setCertificate('');
        setPassword('');
        setReading(false);
        if (!file) return;
        if (!/\.(pfx|p12)$/i.test(file.name) || file.size === 0 || file.size > 2_000_000) {
            toast.error('Selecione um certificado A1 .pfx ou .p12 de até 2 MB.');
            if (fileInput.current) fileInput.current.value = '';
            return;
        }
        const nextReader = new FileReader();
        reader.current = nextReader;
        setReading(true);
        nextReader.onload = () => {
            setCertificate(String(nextReader.result || '').split(',')[1] || '');
            setReading(false);
        };
        nextReader.onerror = () => {
            setReading(false);
            toast.error('Não foi possível ler o arquivo. Selecione-o novamente.');
        };
        nextReader.readAsDataURL(file);
    };

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!certificate || !password || saving || !status?.serverConfigured) return;
        setSaving(true);
        try {
            const response = await fetch(`/api/store/${slug}/fiscal-certificate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ certificateBase64: certificate, certificatePassword: password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Não foi possível salvar o certificado.');
            setStatus(data);
            onSaved(data);
            setCertificate('');
            if (fileInput.current) fileInput.current.value = '';
            toast.success('Certificado salvo para consulta e emissão desta empresa.');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setPassword('');
            setSaving(false);
        }
    };

    const expired = Boolean(status?.certificateValidTo && new Date(status.certificateValidTo).getTime() <= Date.now());
    const date = (value: string) => new Date(value).toLocaleDateString('pt-BR');
    return (
        <form onSubmit={save} className="max-w-3xl space-y-6">
            <div>
                <h2 className="flex items-center gap-3 text-xl font-semibold text-white"><ShieldCheck className="h-5 w-5 text-cyan-400" />Certificado digital A1</h2>
                <p className="mt-2 text-sm text-slate-400">Cadastre uma vez para usar na consulta de NF-e e na emissão de NFS-e desta empresa.</p>
            </div>
            {loadError && <p role="alert" className="text-sm text-rose-300">{loadError} Reabra esta aba para tentar novamente.</p>}
            {!status && !loadError && <p role="status" className="text-sm text-slate-400">Carregando configuração...</p>}
            {status && <>
                {!status.serverConfigured && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">O servidor ainda precisa da chave de proteção fiscal (NFSE_SECRET_KEY). Solicite essa configuração ao administrador antes de enviar o certificado.</p>}
                <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/30 p-5">
                    <p className={`text-sm font-semibold ${expired ? 'text-rose-300' : status.certificateConfigured ? 'text-emerald-300' : 'text-slate-300'}`}>
                        {expired ? 'Certificado vencido — substitua para continuar utilizando' : status.certificateConfigured ? 'Certificado cadastrado' : 'Nenhum certificado cadastrado'}
                    </p>
                    {status.certificateSubject && <p className="break-all text-sm text-slate-300">Titular: {status.certificateSubject}</p>}
                    {status.certificateValidTo && <p className="text-sm text-slate-300">Validade: {status.certificateValidFrom ? `${date(status.certificateValidFrom)} a ` : ''}{date(status.certificateValidTo)}</p>}
                    <p className="text-xs text-slate-400">Arquivo e senha são criptografados no servidor. As credenciais salvas não são devolvidas ao navegador.</p>
                </div>
                <fieldset disabled={!status.serverConfigured || saving} className="space-y-4 disabled:opacity-50">
                    <label className="block space-y-2 text-sm text-slate-300">
                        <span className="flex items-center gap-2"><Upload className="h-4 w-4" />{status.certificateConfigured ? 'Substituir certificado A1' : 'Arquivo do certificado A1'} (.pfx ou .p12, até 2 MB)</span>
                        <input ref={fileInput} type="file" required accept=".pfx,.p12,application/x-pkcs12" onChange={event => selectCertificate(event.target.files?.[0])} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-200" />
                    </label>
                    <label className="block space-y-2 text-sm text-slate-300">
                        <span>Senha do certificado selecionado</span>
                        <input type="password" required maxLength={200} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200" />
                    </label>
                    <button disabled={reading || !certificate || !password || saving} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"><Save className="h-4 w-4" />{saving ? 'Validando e salvando...' : reading ? 'Lendo arquivo...' : 'Salvar certificado'}</button>
                </fieldset>
            </>}
            <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
                <p><strong>Consulta de NF-e:</strong> utilize a chave de acesso de 44 dígitos na importação de produtos. O CNPJ e o estado da empresa devem estar completos. O download depende da autorização da SEFAZ para esse CNPJ.</p>
                <p><strong>Emissão:</strong> o mesmo certificado será utilizado pela NFS-e. A emissão disponível continua em homologação (teste, sem valor fiscal), com configuração própria na aba NFS-e. Este cadastro não habilita emissão de NF-e de produtos.</p>
                <p>Salvar valida o arquivo, a senha e a validade. Isso não confirma autorização fiscal nem conexão com a SEFAZ.</p>
            </div>
        </form>
    );
}
