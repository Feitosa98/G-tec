import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

const loadImage = (src) => {
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.src = src;
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
    });
};

const formatPhone = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length > 11) cleaned = cleaned.substring(2);
    if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    if (cleaned.length === 10) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    return phone;
};

/**
 * Generates a highly professional PDF document
 * @param {Object} options Configuration options
 * @param {Object} options.tenant Information about the store (name, document, logo, colors)
 * @param {string} options.title Document Title (e.g., 'RECIBO', 'ORDEM DE SERVIÇO')
 * @param {string} options.documentNumber Document ID or number
 * @param {Array} options.customerInfo Array of strings for the "Billed To" section
 * @param {Array} options.documentInfo Array of strings for the "Details" section
 * @param {Array} options.tableColumns Array of strings for table headers
 * @param {Array} options.tableRows Array of arrays for table body
 * @param {string} options.totalLabel Label for total (e.g., 'TOTAL A PAGAR:')
 * @param {number} options.totalValue Total numerical value
 * @param {string} options.terms (Optional) Legal terms to append at the bottom
 * @param {string} options.pixPayload (Optional) Pix payload for QR code
 * @param {string} options.filename Filename to save
 */
export const generateProfessionalPDF = async (options) => {
    const {
        tenant,
        title,
        documentNumber,
        customerInfo = [],
        documentInfo = [],
        tableColumns = [],
        tableRows = [],
        totalLabel = 'TOTAL:',
        totalValue = 0,
        terms = '',
        testMode = false,
    } = options;

    try {
        const doc = new jsPDF();
        
        // Colors mapped to the new theme
        const colorPrimary = [9, 9, 11]; // Zinc 950
        const colorAccent = [59, 130, 246]; // Blue 500
        const colorText = [63, 63, 70]; // Zinc 700
        const colorLight = [244, 244, 245]; // Zinc 50

        const logo = await loadImage(tenant.logoUrl);

        // --- BACKGROUND GRAPHICS ---
        // Header Dark Bar
        doc.setFillColor(...colorPrimary);
        doc.rect(0, 0, 210, 45, 'F');

        // Accent Line below header
        doc.setDrawColor(...colorAccent);
        doc.setLineWidth(1.5);
        doc.line(0, 45, 210, 45);

        if (testMode) {
            doc.setFillColor(185, 28, 28);
            doc.rect(0, 46, 210, 10, 'F');
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('SEM VALOR FISCAL — AMBIENTE DE TESTE', 105, 52.5, { align: 'center' });
        }

        // --- HEADER CONTENT ---
        // Logo e identificação da empresa
        if (logo) {
            doc.addImage(logo, 'PNG', 15, 8, 25, 25);
        }

        const companyX = logo ? 46 : 15;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const bName = tenant.businessName || 'Feitosa Soluções em Informática';
        const companyName = doc.splitTextToSize(bName, 76)[0];
        doc.text(companyName, companyX, 15);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text(`CNPJ/CPF: ${tenant.document || 'Não informado'}`, companyX, 21);
        doc.text(doc.splitTextToSize(tenant.address || 'Endereço não informado', 76)[0], companyX, 27);
        doc.text(doc.splitTextToSize(`${tenant.email || ''}  |  ${formatPhone(tenant.whatsapp)}`, 76)[0], companyX, 33);

        // Identificação do documento em área reservada, sem sobrepor a empresa
        doc.setFillColor(20, 27, 45);
        doc.roundedRect(132, 8, 63, 29, 3, 3, 'F');
        doc.setFontSize(title.length > 18 ? 15 : 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAccent);
        const titleLines = doc.splitTextToSize(title, 55).slice(0, 2);
        doc.text(titleLines, 163.5, 17, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`${documentNumber}`, 163.5, 32, { align: 'center' });

        // --- INFO PANELS ---
        const startY = testMode ? 68 : 60;
        
        // Left Column: Customer Info
        doc.setTextColor(...colorPrimary);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Faturado Para:', 15, startY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorText);
        customerInfo.forEach((line, index) => {
            doc.text(line, 15, startY + 7 + (index * 6));
        });

        // Right Column: Document Info
        doc.setTextColor(...colorPrimary);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhes do Documento:', 120, startY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorText);
        documentInfo.forEach((line, index) => {
            const yPos = startY + 7 + (index * 6);
            doc.text(line.label, 120, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(line.value, 195, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');
        });

        // --- TABLE ---
        autoTable(doc, {
            startY: startY + 35,
            head: [tableColumns],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: colorPrimary,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left',
                fontSize: 9
            },
            bodyStyles: {
                textColor: colorText,
                fontSize: 9,
                cellPadding: 4
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            },
            columnStyles: tableColumns.length === 5 ? {
                0: { cellWidth: 23 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 32, halign: 'right' },
                4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
            } : {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 18, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            },
        });

        // --- TOTAL SUMMARY ---
        let finalY = doc.lastAutoTable.finalY + 15;
        
        // Background for total
        doc.setFillColor(...colorLight);
        doc.rect(110, finalY - 8, 85, 22, 'F');
        doc.setDrawColor(...colorAccent);
        doc.setLineWidth(1);
        doc.line(110, finalY - 8, 110, finalY + 14);

        doc.setFontSize(12);
        doc.setTextColor(...colorPrimary);
        doc.setFont('helvetica', 'bold');
        doc.text(totalLabel, 115, finalY + 1);

        doc.setFontSize(16);
        doc.setTextColor(...colorAccent); 
        doc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 2, { align: 'right' });

        // --- TERMS ---
        if (terms) {
            finalY += 30;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150, 150, 150);
            const splitTerms = doc.splitTextToSize(terms, 180);
            doc.text(splitTerms, 15, finalY);
        }

        // --- PIX BOX (Optional) ---
        const drawPixBox = async () => {
            if (options.pixPayload) {
                // If it pushes too far down, add a page
                if (finalY > 230) {
                    doc.addPage();
                    finalY = 20;
                } else {
                    finalY += 15;
                }

                doc.setFillColor(244, 244, 245); // Zinc 50
                doc.setDrawColor(228, 228, 231); // Zinc 200
                doc.roundedRect(15, finalY, 180, 50, 4, 4, 'FD');
                
                doc.setFontSize(14);
                doc.setTextColor(16, 185, 129); // Emerald 500
                doc.setFont('helvetica', 'bold');
                doc.text('PIX', 20, finalY + 10);
                
                doc.setFontSize(10);
                doc.setTextColor(...colorText);
                doc.setFont('helvetica', 'normal');
                doc.text('Escaneie o QR Code ou utilize o PIX Copia e Cola:', 35, finalY + 9);
                
                doc.setFontSize(7);
                doc.setFont('courier', 'normal');
                const splitPix = doc.splitTextToSize(options.pixPayload, 110);
                doc.text(splitPix, 20, finalY + 18);

                try {
                    const qrDataUrl = await QRCode.toDataURL(options.pixPayload, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
                    doc.addImage(qrDataUrl, 'PNG', 142, finalY + 3, 44, 44);
                } catch (error) {
                    console.error("Could not load QR", error);
                }
            }
        };

        await drawPixBox();

        // --- FOOTER ---
        const pageHeight = doc.internal.pageSize.height;
        doc.setDrawColor(230, 230, 230);
        doc.line(15, pageHeight - 15, 195, pageHeight - 15);

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Gerado por ${tenant.businessName || 'Feitosa Soluções em Informática'} - ${new Date().toLocaleString('pt-BR')}`, 105, pageHeight - 10, { align: 'center' });
        doc.text(testMode ? 'Simulação local — não transmitida ao Sistema Nacional NFS-e.' : 'Documento gerado eletronicamente.', 105, pageHeight - 6, { align: 'center' });

        if (options.returnBase64) {
            const dataUri = doc.output('datauristring');
            return {
                success: true,
                base64: dataUri.substring(dataUri.indexOf(',') + 1),
                filename: options.filename || 'documento.pdf',
            };
        }
        if (options.save !== false) doc.save(options.filename || 'documento.pdf');
        return true;
    } catch (err) {
        console.error('Error generating PDF:', err);
        return false;
    }
};

const formatDocument = (value = '') => {
    const digits = String(value).replace(/\D/g, '');
    if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return value || 'Não informado';
};

const money = (value) => Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
});

export const generateDanfsePDF = async ({ tenant, config, order, customer, nfse, returnBase64 = false }) => {
    try {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);
        const issueDate = nfse?.issuedAt ? new Date(nfse.issuedAt) : new Date();
        const description = order?.issueDescription || order?.technicalReport || order?.orderType || 'Serviço de informática';
        const issuerAddress = [tenant?.street, tenant?.addressNumber, tenant?.neighborhood, tenant?.city, tenant?.state, tenant?.postalCode]
            .filter(Boolean).join(' - ') || tenant?.address || 'Endereço não informado';
        const customerDocument = customer?.cpfCnpj || customer?.document || order?.clientDocument || '';
        const customerAddress = customer?.address || [customer?.street, customer?.addressNumber, customer?.neighborhood, customer?.city, customer?.state, customer?.postalCode]
            .filter(Boolean).join(' - ') || 'Não informado';

        doc.setDrawColor(38, 59, 112);
        doc.setLineWidth(0.6);
        doc.rect(margin, 10, contentWidth, 277);

        doc.setFillColor(38, 59, 112);
        doc.rect(margin, 10, contentWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('DANFSe', 15, 21);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento Auxiliar da Nota Fiscal de Serviço eletrônica', 15, 27);
        doc.setFontSize(7);
        doc.text('Padrão Nacional — Ambiente de Produção Restrita', 15, 32);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`NFS-e ${nfse?.nfseNumber || '-'}`, 195, 20, { align: 'right' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`DPS ${nfse?.dpsNumber || '-'}  |  Série ${nfse?.dpsSeries || '-'}`, 195, 27, { align: 'right' });

        doc.setFillColor(254, 226, 226);
        doc.setDrawColor(185, 28, 28);
        doc.rect(margin, 35, contentWidth, 12, 'FD');
        doc.setTextColor(153, 27, 27);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('HOMOLOGAÇÃO / TESTE — SEM VALIDADE FISCAL', pageWidth / 2, 42.5, { align: 'center' });

        const section = (title, y, height) => {
            doc.setDrawColor(148, 163, 184);
            doc.setLineWidth(0.25);
            doc.rect(margin, y, contentWidth, height);
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, y, contentWidth, 7, 'F');
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(title, margin + 3, y + 4.8);
        };
        const labelValue = (label, value, x, y, maxWidth = 84) => {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text(label, x, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(doc.splitTextToSize(String(value || '-'), maxWidth), x, y + 4);
        };

        section('IDENTIFICAÇÃO DA NFS-e', 50, 31);
        labelValue('Chave de acesso', nfse?.accessKey || '-', 13, 61, 125);
        labelValue('Data e hora da emissão', issueDate.toLocaleString('pt-BR'), 143, 61, 49);
        labelValue('Situação', 'AUTORIZADA EM HOMOLOGAÇÃO', 13, 73, 80);
        labelValue('Município de emissão', `${tenant?.city || 'Manaus'} - ${tenant?.state || 'AM'}`, 104, 73, 88);

        section('PRESTADOR DO SERVIÇO', 84, 40);
        labelValue('Nome / Razão social', tenant?.legalName || tenant?.businessName || 'Feitosa Soluções em Informática', 13, 95, 110);
        labelValue('CNPJ', formatDocument(tenant?.document), 130, 95, 62);
        labelValue('Inscrição municipal', config?.municipalRegistration || '-', 13, 107, 50);
        labelValue('Regime tributário', 'ME/EPP optante pelo Simples Nacional', 67, 107, 125);
        labelValue('Endereço', issuerAddress, 13, 119, 179);

        section('TOMADOR DO SERVIÇO', 127, 34);
        labelValue('Nome / Razão social', order?.clientName || customer?.name || 'Não informado', 13, 138, 110);
        labelValue('CPF/CNPJ', formatDocument(customerDocument), 130, 138, 62);
        labelValue('E-mail / Telefone', [order?.clientEmail || customer?.email, order?.clientPhone || customer?.phone].filter(Boolean).join(' | ') || 'Não informado', 13, 150, 90);
        labelValue('Endereço', customerAddress, 107, 150, 85);

        section('SERVIÇO PRESTADO', 164, 49);
        labelValue('Código de tributação nacional / municipal', `${config?.nationalServiceCode || '-'} / ${config?.municipalServiceCode || '-'}`, 13, 175, 75);
        labelValue('Local da prestação', `${tenant?.city || 'Manaus'} - ${tenant?.state || 'AM'}`, 100, 175, 92);
        labelValue('Descrição do serviço', description, 13, 187, 179);
        if (order?.technicalReport) labelValue('Informações complementares', order.technicalReport, 13, 201, 179);

        section('VALORES E TRIBUTAÇÃO', 216, 42);
        labelValue('Valor dos serviços', money(nfse?.serviceTotal), 13, 227, 45);
        labelValue('Desconto incondicionado', money(0), 61, 227, 45);
        labelValue('ISSQN retido', 'Não', 109, 227, 35);
        labelValue('Valor líquido', money(nfse?.serviceTotal), 149, 227, 43);
        labelValue('Tributação do ISSQN', 'Operação tributável — ISSQN devido no município da prestação', 13, 241, 105);
        labelValue('Percentual aproximado do Simples Nacional', '6,00%', 124, 241, 68);

        const consultationBaseUrl = nfse?.environment === 'PRODUCAO'
            ? 'https://www.nfse.gov.br/ConsultaPublica/'
            : 'https://www.producaorestrita.nfse.gov.br/ConsultaPublica/';
        const consultationUrl = `${consultationBaseUrl}?tpc=1&chave=${encodeURIComponent(nfse?.accessKey || '')}`;
        const qrDataUrl = await QRCode.toDataURL(consultationUrl, { width: 500, margin: 1, errorCorrectionLevel: 'M' });
        doc.addImage(qrDataUrl, 'PNG', 13, 262, 20, 20);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Leia o QR para consultar esta NFS-e no Portal Nacional.', 36, 268);
        doc.text('Documento gerado diretamente pelo sistema a partir da NFS-e autorizada pelo ambiente nacional de homologação.', 36, 273);
        doc.text(`Referência interna: O.S. #${String(order?.id || '').slice(0, 8).toUpperCase()}`, 36, 278);
        doc.setTextColor(15, 23, 42);
        doc.setFont('courier', 'normal');
        doc.text(doc.splitTextToSize(nfse?.accessKey || '-', 155), 36, 283);

        if (returnBase64) {
            const dataUri = doc.output('datauristring');
            return {
                success: true,
                base64: dataUri.substring(dataUri.indexOf(',') + 1),
                filename: `DANFSe_HOMOLOGACAO_${nfse?.nfseNumber || 'nota'}.pdf`,
            };
        }
        const blob = doc.output('blob');
        return { success: true, url: URL.createObjectURL(blob), filename: `DANFSe_HOMOLOGACAO_${nfse?.nfseNumber || 'nota'}.pdf` };
    } catch (error) {
        console.error('Erro ao gerar DANFSe:', error);
        return { success: false };
    }
};
