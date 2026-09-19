import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const digits = value => String(value || '').replace(/\D/g, '');
const documentNumber = value => {
    const number = digits(value);
    if (number.length === 14) return number.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (number.length === 11) return number.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return value || '-';
};
const cep = value => digits(value).replace(/^(\d{5})(\d{3})$/, '$1-$2') || '-';
const dateOnly = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '-';
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR') : '-';
const fit = (doc, value, width, maxLines = 2) => doc.splitTextToSize(String(value || '-'), width).slice(0, maxLines);
const simpleNational = { 1: 'Não optante', 2: 'Optante - MEI', 3: 'Optante - ME/EPP' };
const simpleRegime = {
    1: 'Tributos federais e municipal pelo Simples Nacional',
    2: 'Tributos federais pelo Simples Nacional e ISSQN fora do Simples',
    3: 'Tributos federais e municipal fora do Simples Nacional',
};
const specialRegime = {
    0: 'Nenhum', 1: 'Ato cooperado', 2: 'Estimativa', 3: 'Microempresa municipal',
    4: 'Notário ou registrador', 5: 'Profissional autônomo', 6: 'Sociedade de profissionais', 9: 'Outros',
};
const issTaxation = { 1: 'Operação tributável', 2: 'Exportação de serviço', 3: 'Não incidência', 4: 'Imunidade' };
const issRetention = { 1: 'Não retido', 2: 'Retido pelo tomador', 3: 'Retido pelo intermediário' };

const loadLogo = async () => {
    const response = await fetch('/nfse-logo-oficial.png', { cache: 'force-cache' });
    if (!response.ok) throw new Error('Não foi possível carregar a logomarca oficial da NFS-e.');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Não foi possível preparar a logomarca da NFS-e.'));
        reader.readAsDataURL(blob);
    });
};

export const generateDanfseOfficialPDF = async ({ tenant, config, order, customer, nfse, returnBase64 = false }) => {
    try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const x = 2, width = 206;
        const line = 0.176; // 0,5 ponto
        doc.setLineWidth(line);
        doc.setDrawColor(0);
        doc.rect(1.5, 1.5, 207, 294);
        doc.setFont('helvetica', 'normal');

        const horizontal = y => doc.line(x, y, x + width, y);
        const vertical = (at, y, height) => doc.line(at, y, at, y + height);
        const cell = (label, value, left, top, cellWidth, height, options = {}) => {
            if (options.shaded) {
                doc.setFillColor(242, 242, 242);
                doc.rect(left, top, cellWidth, height, 'F');
            }
            doc.setTextColor(0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(options.block ? 7 : 6);
            doc.text(String(label || ''), left + 1.2, top + 2.6);
            if (value !== undefined && value !== '') {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.text(fit(doc, value, cellWidth - 2.4, options.lines || 2), left + 1.2, top + 5.4);
            }
        };
        const block = (title, top, height) => {
            horizontal(top);
            cell(title, '', x, top, 50, height, { block: true, shaded: true });
        };

        // Cabeçalho oficial da NT 008/2026 v1.02.
        doc.setFillColor(242, 242, 242);
        doc.rect(x, 2, width, 12, 'F');
        doc.addImage(await loadLogo(), 'PNG', 4.9, 4.2, 40, 8.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('DANFSe v2.0', 105, 6.1, { align: 'center' });
        doc.text('Documento Auxiliar da NFS-e', 105, 9.6, { align: 'center' });
        if (nfse?.environment !== 'PRODUCAO') {
            doc.setTextColor(220, 0, 0);
            doc.text('NFS-e SEM VALIDADE JURÍDICA', 105, 12.7, { align: 'center' });
        }
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Município: ${tenant?.city || '-'} / ${tenant?.state || '-'}`, 157, 5.4);
        doc.setFontSize(6);
        doc.text('Ambiente Gerador: Sistema Nacional NFS-e', 157, 9);
        doc.text(`Tipo de Ambiente: ${nfse?.environment === 'PRODUCAO' ? 'Produção' : 'Produção Restrita'}`, 157, 12);
        horizontal(14);

        const accessKey = digits(nfse?.accessKey);
        const consultationUrl = `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${encodeURIComponent(accessKey)}`;
        const qr = await QRCode.toDataURL(consultationUrl, { width: 500, margin: 1, errorCorrectionLevel: 'M' });
        doc.addImage(qr, 'PNG', 176.3, 16.7, 17, 17);
        doc.setFontSize(5.2);
        doc.text(fit(doc, 'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e.', 32, 4), 174.8, 35.7);

        cell('CHAVE DE ACESSO DA NFS-E', accessKey || '-', x, 14, 153, 8);
        cell('NÚMERO DA NFS-E', nfse?.nfseNumber || '-', x, 22, 51, 7);
        cell('COMPETÊNCIA DA NFS-E', dateOnly(nfse?.competence || order?.createdAt), 53, 22, 51, 7);
        cell('DATA E HORA DA EMISSÃO DA NFS-E', dateTime(nfse?.issuedAt), 104, 22, 53, 7);
        cell('NÚMERO DA DPS', nfse?.dpsNumber || '-', x, 29, 51, 7);
        cell('SÉRIE DA DPS', nfse?.dpsSeries || '-', 53, 29, 51, 7);
        cell('DATA E HORA DA EMISSÃO DA DPS', dateTime(nfse?.dpsIssuedAt || nfse?.issuedAt), 104, 29, 53, 7);
        cell('EMITENTE DA NFS-E', nfse?.issuerType || 'Prestador', x, 36, 51, 7, { shaded: true });
        cell('SITUAÇÃO DA NFS-E', nfse?.status || '-', 53, 36, 51, 7);
        cell('FINALIDADE', nfse?.purpose || '-', 104, 36, 53, 7);
        [53, 104, 157].forEach(at => vertical(at, 22, 21));
        horizontal(43);

        const issuerAddress = [tenant?.street, tenant?.addressNumber, tenant?.neighborhood].filter(Boolean).join(', ') || tenant?.address || '-';
        block('PRESTADOR / FORNECEDOR', 43, 7);
        cell('CNPJ / CPF / NIF', documentNumber(tenant?.document), 52, 43, 52, 7);
        cell('Indicador Municipal (Inscrição)', config?.municipalRegistration || '-', 104, 43, 52, 7);
        cell('Telefone', tenant?.phone || tenant?.whatsapp || '-', 156, 43, 52, 7);
        cell('Nome / Nome Empresarial', tenant?.legalName || tenant?.businessName || '-', x, 50, 102, 7);
        cell('Município / Sigla UF', `${tenant?.city || '-'} / ${tenant?.state || '-'}`, 104, 50, 52, 7);
        cell('Código IBGE / CEP', `${config?.municipalityCode || '-'} / ${cep(tenant?.postalCode)}`, 156, 50, 52, 7);
        cell('Endereço', issuerAddress, x, 57, 102, 7);
        cell('E-mail', tenant?.email || tenant?.billingEmail || '-', 104, 57, 104, 7);
        cell('Simples Nacional na Data de Competência', simpleNational[config?.simpleNationalStatus] || '-', x, 64, 74, 8);
        cell('Regime de Apuração Tributária pelo SN', Number(config?.simpleNationalStatus) === 3 ? simpleRegime[config?.simpleNationalTaxRegime] || '-' : '-', 76, 64, 132, 8);
        [52, 104, 156].forEach(at => vertical(at, 43, 21));
        vertical(104, 64, 8); horizontal(72);

        const customerDocument = customer?.cpfCnpj || customer?.document || order?.clientDocument || '';
        const customerAddress = customer?.address || [customer?.street, customer?.addressNumber, customer?.neighborhood].filter(Boolean).join(', ') || '-';
        block('TOMADOR / ADQUIRENTE', 72, 7);
        cell('CNPJ / CPF / NIF', documentNumber(customerDocument), 52, 72, 52, 7);
        cell('Indicador Municipal (Inscrição)', customer?.municipalRegistration || '-', 104, 72, 52, 7);
        cell('Telefone', order?.clientPhone || customer?.phone || '-', 156, 72, 52, 7);
        cell('Nome / Nome Empresarial', order?.clientName || customer?.name || '-', x, 79, 102, 7);
        cell('Município / Sigla UF', `${customer?.city || '-'} / ${customer?.state || '-'}`, 104, 79, 52, 7);
        cell('Código IBGE / CEP', `${customer?.municipalityCode || '-'} / ${cep(customer?.postalCode || customer?.zipCode)}`, 156, 79, 52, 7);
        cell('Endereço', customerAddress, x, 86, 102, 8);
        cell('E-mail', order?.clientEmail || customer?.email || '-', 104, 86, 104, 8);
        [52, 104, 156].forEach(at => vertical(at, 72, 22)); horizontal(94);

        const serviceItems = (order?.items || []).filter(item => String(item.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().startsWith('servi'));
        const description = serviceItems.length
            ? serviceItems.map(item => `${item.name} (${Number(item.qty || 1)} x ${money(item.price)})`).join('; ')
            : order?.issueDescription || order?.orderType || '-';
        block('SERVIÇO PRESTADO', 94, 7);
        cell('Código de Tributação Nacional / Municipal', `${config?.nationalServiceCode || '-'} / ${config?.municipalServiceCode || '-'}`, 52, 94, 62, 7);
        cell('Código da NBS', nfse?.nbsCode || '-', 114, 94, 42, 7);
        cell('Local da Prestação / Sigla UF / País', `${tenant?.city || '-'} / ${tenant?.state || '-'} / BR`, 156, 94, 52, 7);
        cell('', nfse?.taxDescription || '-', x, 101, width, 7, { lines: 1 });
        cell('Descrição do Serviço', description, x, 108, width, 39, { lines: 12 });
        [52, 114, 156].forEach(at => vertical(at, 94, 7)); horizontal(101); horizontal(108); horizontal(147);

        block('TRIBUTAÇÃO MUNICIPAL (ISSQN)', 147, 7);
        cell('Tipo de Tributação do ISSQN', issTaxation[config?.issTaxation] || '-', 52, 147, 52, 7);
        cell('Município / Sigla UF / País de Incidência do ISSQN', `${tenant?.city || '-'} / ${tenant?.state || '-'} / BR`, 104, 147, 104, 7);
        cell('Regime Especial de Tributação do ISSQN', specialRegime[config?.specialTaxRegime] || '-', x, 154, 52, 8);
        cell('Retenção do ISSQN', issRetention[config?.issWithholding] || '-', 52, 154, 52, 8);
        cell('BC ISSQN', nfse?.issBase === undefined ? '-' : money(nfse.issBase), 104, 154, 35, 8);
        cell('Alíquota Aplicada', nfse?.issRate === undefined ? '-' : `${nfse.issRate}%`, 139, 154, 34, 8);
        cell('ISSQN Apurado', nfse?.issValue === undefined ? '-' : money(nfse.issValue), 173, 154, 35, 8);
        [52, 104, 139, 173].forEach(at => vertical(at, 147, 15)); horizontal(162);

        block('VALOR TOTAL DA NFS-E', 162, 8);
        cell('Valor da Operação / Serviço', money(nfse?.serviceTotal), 52, 162, 52, 8);
        cell('Desconto Incondicionado', nfse?.unconditionalDiscount === undefined ? '-' : money(nfse.unconditionalDiscount), 104, 162, 52, 8);
        cell('Desconto Condicionado', nfse?.conditionalDiscount === undefined ? '-' : money(nfse.conditionalDiscount), 156, 162, 52, 8);
        cell('Total das Retenções (ISSQN / Federais)', nfse?.totalWithheld === undefined ? '-' : money(nfse.totalWithheld), x, 170, 52, 8);
        cell('VALOR LÍQUIDO DA NFS-E', nfse?.netValue === undefined ? '-' : money(nfse.netValue), 52, 170, 52, 8, { shaded: true });
        cell('Total do IBS/CBS', nfse?.ibsCbsTotal === undefined ? '-' : money(nfse.ibsCbsTotal), 104, 170, 52, 8);
        cell('VALOR LÍQUIDO DA NFS-E + IBS/CBS', nfse?.totalWithIbsCbs === undefined ? '-' : money(nfse.totalWithIbsCbs), 156, 170, 52, 8, { shaded: true });
        [52, 104, 156].forEach(at => vertical(at, 162, 16)); horizontal(178);

        block('INFORMAÇÕES COMPLEMENTARES', 178, 7);
        const complementary = [nfse?.complementaryInfo, order?.technicalReport].filter(Boolean).join(' | ') || '-';
        cell('Informações Complementares', complementary, x, 185, width, 80, { lines: 23 });
        horizontal(265);
        cell('DATA DA CIENTIFICAÇÃO', '', x, 265, 50, 20, { block: true });
        cell('IDENTIFICAÇÃO E ASSINATURA', '', 52, 265, 75, 20, { block: true });
        cell('Nº NFS-e / CHAVE NFS-e', `${nfse?.nfseNumber || '-'} / ${accessKey || '-'}`, 127, 265, 81, 20, { block: true, lines: 5 });
        vertical(52, 265, 20); vertical(127, 265, 20); horizontal(285);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.text('Modelo gerado conforme Nota Técnica SE/CGNFS-e nº 008, versão 1.02 (DANFSe v2.0).', x, 291);

        if (returnBase64) {
            const dataUri = doc.output('datauristring');
            return { success: true, base64: dataUri.slice(dataUri.indexOf(',') + 1), filename: `DANFSe_${nfse?.nfseNumber || 'nota'}.pdf` };
        }
        const blob = doc.output('blob');
        return { success: true, url: URL.createObjectURL(blob), filename: `DANFSe_${nfse?.nfseNumber || 'nota'}.pdf` };
    } catch (error) {
        console.error('Erro ao gerar DANFSe oficial:', error);
        return { success: false, error: error?.message || 'Erro ao gerar DANFSe.' };
    }
};
