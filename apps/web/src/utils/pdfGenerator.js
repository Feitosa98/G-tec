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

        // --- HEADER CONTENT ---
        // Logo e identificação da empresa
        if (logo) {
            doc.addImage(logo, 'PNG', 15, 8, 25, 25);
        }

        const companyX = logo ? 46 : 15;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const bName = tenant.businessName || 'G-TEC Informática';
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
        const startY = 60;
        
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
        doc.text(`Gerado por ${tenant.businessName || 'G-TEC'} - ${new Date().toLocaleString('pt-BR')}`, 105, pageHeight - 10, { align: 'center' });
        doc.text('Documento gerado eletronicamente.', 105, pageHeight - 6, { align: 'center' });

        doc.save(options.filename || 'documento.pdf');
        return true;
    } catch (err) {
        console.error('Error generating PDF:', err);
        return false;
    }
};
