const numberFromOcr = (value: string) => {
    const cleaned = String(value || '').replace(/[^\d,.-]/g, '');
    if (!cleaned) return 0;
    if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    const pieces = cleaned.split('.');
    if (pieces.length > 2) return Number(pieces.join('')) || 0;
    return Number(cleaned) || 0;
};

const extractAccessKey = (text: string) => {
    const grouped = text.match(/\b\d{4}(?:[ \t]+\d{4}){10}\b/)?.[0];
    if (grouped) return grouped.replace(/\D/g, '');
    const explicit = text.match(/(?:CHAVE\s+DE\s+ACESSO|CHAVE)[^\d]{0,80}((?:\d[\s.:-]*){44})/i)?.[1];
    if (explicit) return explicit.replace(/\D/g, '').slice(0, 44);
    const candidates = text.match(/(?:\d[\s.:-]*){44}/g) || [];
    return candidates.map(candidate => candidate.replace(/\D/g, '')).find(candidate => candidate.length === 44) || '';
};

const extractCnpj = (text: string) => {
    const match = text.match(/CNPJ[^\d]{0,25}(\d{2}[.\s]?\d{3}[.\s]?\d{3}[\s/]?\d{4}[-\s]?\d{2})/i);
    return match?.[1]?.replace(/\D/g, '') || '';
};

const extractSupplier = (text: string, cnpj: string) => {
    const receiptName = text.match(/RECEBEMOS\s+DE\s+(.+?)\s+OS\s+PRODUTOS/i)?.[1];
    if (receiptName) return receiptName.trim();
    const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const cnpjIndex = cnpj ? lines.findIndex(line => line.replace(/\D/g, '').includes(cnpj)) : -1;
    const candidates = lines.slice(0, cnpjIndex > 0 ? cnpjIndex : Math.min(lines.length, 12)).reverse();
    return candidates.find(line => /[A-ZÁÉÍÓÚÃÕÇ]{3}/i.test(line)
        && line.length >= 4
        && !/DANFE|DOCUMENTO AUXILIAR|NOTA FISCAL|CHAVE DE ACESSO|CNPJ|INSCRIÇÃO/i.test(line)) || 'Fornecedor não identificado';
};

const extractItems = (text: string) => {
    const lines = text.split(/\r?\n/).map(line => line.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const tableHeader = /DADOS DO[S]? PRODUTO[S]?|DESCRI[ÇC][ÃA]O DO PROD/i;
    const headerIndex = lines.findIndex(line => tableHeader.test(line));
    const items: any[] = [];
    let buffered: string[] = [];
    let insideTable = headerIndex < 0;
    const rowPattern = /^(\S{1,30})\s+(.+?)\s+(\d{4}\.?\d{2}\.?\d{2})\s+(?:\d{1,4}\s+)?(\d{4})\s+([A-ZÇ0-9]{1,6})\s+([\d.,]+)\s+(?:R\$\s*)?([\d.,]+)\s+(?:R\$\s*)?([\d.,]+)(?:\s|$)/i;
    for (const line of lines) {
        if (tableHeader.test(line)) {
            insideTable = true;
            buffered = [];
            continue;
        }
        if (/C[ÁA]LCULO DO ISSQN|DADOS ADICIONAIS|INFORMA[ÇC][ÕO]ES COMPLEMENTARES|TRANSPORTADOR/i.test(line)) {
            insideTable = false;
            buffered = [];
            continue;
        }
        if (!insideTable || /^(?:C[ÓO]DIGO|NCM|CFOP|CST|CSOSN|QUANT|VALOR\s+UNIT)/i.test(line)) continue;
        // Alguns emissores quebram uma linha da tabela em vários fragmentos.
        let match = line.match(rowPattern);
        if (!match) {
            buffered.push(line);
            if (buffered.length > 5) buffered.shift();
            match = buffered.join(' ').match(rowPattern);
        }
        if (match) {
            const quantity = numberFromOcr(match[6]);
            const costPrice = numberFromOcr(match[7]);
            if (quantity <= 0 || costPrice < 0) { buffered = []; continue; }
            const lineTotal = numberFromOcr(match[8]);
            const needsReview = Math.abs(quantity * costPrice - lineTotal) > Math.max(0.05, lineTotal * 0.01);
            items.push({
                id: `ocr-${items.length + 1}`,
                sku: match[1],
                name: match[2].trim(),
                ncm: match[3].replace(/\D/g, ''),
                cfop: match[4],
                unit: match[5].toUpperCase(),
                stock: quantity,
                costPrice,
                price: Number((costPrice * 1.3).toFixed(2)),
                barcode: '', category: 'Office', department: 'Hardware', brand: '', selected: !needsReview,
                needsReview,
            });
            buffered = [];
        } else if (items.length && buffered.length === 1 && /[A-ZÁÉÍÓÚÃÕÇ]/i.test(line)
            && !/^(?:\d{3,}|[A-Z]+[-_]?\d+)\s+/i.test(line)
            && !/\d{8}|\b\d{4}\s+[A-Z]{1,4}\s+\d|TOTAL|ICMS|IPI|BASE|FOLHA|DANFE/i.test(line)) {
            items[items.length - 1].name = `${items[items.length - 1].name} ${line}`.trim();
            buffered = [];
        }
    }
    return items;
};

/** Reconstrói linhas pela posição visual, não pela ordem interna do PDF. */
export const pdfTextToLines = (items: Array<{ str?: string; transform?: number[] }>) => {
    const positioned = items.filter(item => item.str?.trim() && item.transform?.length === 6)
        .map(item => ({ text: item.str!.trim(), x: item.transform![4], y: item.transform![5] }))
        .sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Array<{ y: number; cells: typeof positioned }> = [];
    for (const item of positioned) {
        const row = rows[rows.length - 1];
        if (row && Math.abs(row.y - item.y) <= 2) row.cells.push(item);
        else rows.push({ y: item.y, cells: [item] });
    }
    let descriptionX: number | undefined;
    let ncmX: number | undefined;
    let inTable = false;
    return rows.map(row => {
        const cells = row.cells.sort((a, b) => a.x - b.x);
        const text = cells.map(cell => cell.text).join(' ');
        const description = cells.find(cell => /^DESCRI/i.test(cell.text));
        const ncm = cells.find(cell => /^NCM/i.test(cell.text));
        if (description && ncm) {
            descriptionX = description.x;
            ncmX = ncm.x;
            inTable = true;
        } else if (/CALCULO DO ISSQN|CÁLCULO DO ISSQN|DADOS ADICIONAIS/i.test(text)) {
            inTable = false;
        } else if (inTable && descriptionX !== undefined && ncmX !== undefined
            && !cells.some(cell => cell.x >= ncmX! - 2 && /^\d{4}\.?\d{2}\.?\d{2}$/.test(cell.text))) {
            const descriptionCells = cells.filter(cell => cell.x >= descriptionX! - 2 && cell.x < ncmX! - 2);
            // Ignora dígitos de precisão que transbordaram da coluna de preço.
            if (descriptionCells.length && !cells.some(cell => cell.x < descriptionX! - 2)) {
                return descriptionCells.map(cell => cell.text).join(' ');
            }
        }
        return text;
    }).join('\n');
};

export const parseDanfeText = (text: string) => {
    const key = extractAccessKey(text);
    const cnpj = key.length === 44 ? key.slice(6, 20) : extractCnpj(text);
    const supplier = extractSupplier(text, cnpj);
    return {
        key,
        supplier,
        supplierDetails: { name: supplier, cnpj, category: 'Fornecedor de produtos' },
        items: extractItems(text),
        rawText: text,
    };
};

const prepareImage = async (file: Blob) => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(2, 2600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < image.data.length; index += 4) {
        const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
        const adjusted = gray > 185 ? 255 : gray < 65 ? 0 : Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
        image.data[index] = adjusted;
        image.data[index + 1] = adjusted;
        image.data[index + 2] = adjusted;
    }
    context.putImageData(image, 0, 0);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.')), 'image/jpeg', 0.94));
};

const createDanfeWorker = async (onProgress?: (progress: number, status: string) => void) => {
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker('por', OEM.LSTM_ONLY, {
        workerPath: '/ocr/worker.min.js',
        langPath: '/ocr',
        corePath: '/ocr',
        // O worker local recebe a política de segurança do servidor, sem blob.
        workerBlobURL: false,
        errorHandler: () => undefined, // Os erros são tratados pela promise da leitura.
        logger: message => onProgress?.(Number(message.progress || 0), String(message.status || '')),
    });
};

export const readDanfeImage = async (file: Blob, onProgress?: (progress: number, status: string) => void) => {
    const image = await prepareImage(file);
    const worker = await createDanfeWorker(onProgress);
    try {
        const result = await worker.recognize(image);
        return { ...parseDanfeText(result.data.text), confidence: Number(result.data.confidence || 0), method: 'ocr' };
    } finally {
        await worker.terminate();
    }
};

const renderPdfPage = async (page: any) => {
    const naturalViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(3, Math.max(1.5, 2200 / Math.max(naturalViewport.width, naturalViewport.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!context) throw new Error('Não foi possível preparar uma página do PDF.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob
        ? resolve(blob)
        : reject(new Error('Não foi possível converter uma página do PDF.')), 'image/jpeg', 0.95));
};

export const readDanfePdf = async (file: File, onProgress?: (progress: number, status: string) => void) => {
    const pdfjs = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    let worker: Awaited<ReturnType<typeof createDanfeWorker>> | undefined;
    let activePage = 1;
    const texts: string[] = [];
    const confidences: number[] = [];
    try {
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        if (pageCount > 10) throw new Error('O PDF possui mais de 10 páginas. Envie somente as páginas da DANFE.');
        for (activePage = 1; activePage <= pageCount; activePage += 1) {
            onProgress?.((activePage - 1) / pageCount, `Lendo texto da página ${activePage} de ${pageCount}`);
            const page = await pdf.getPage(activePage);
            try {
                const content = await page.getTextContent();
                const nativeText = pdfTextToLines(content.items as any[]);
                const nativeResult = parseDanfeText(nativeText);
                const hasProductTable = /DADOS DO[S]? PRODUTO[S]?|DESCRI[ÇC][ÃA]O DO PROD/i.test(nativeText);
                if (nativeResult.items.length || (nativeText.length >= 100 && !hasProductTable)) {
                    texts.push(nativeText);
                } else {
                    worker ||= await createDanfeWorker((progress, status) => {
                        onProgress?.(((activePage - 1) + progress) / pageCount, `Página ${activePage} de ${pageCount}: ${status}`);
                    });
                    const result = await worker.recognize(await renderPdfPage(page));
                    const ocrResult = parseDanfeText(result.data.text);
                    texts.push(ocrResult.items.length > nativeResult.items.length ? result.data.text : nativeText || result.data.text);
                    confidences.push(Number(result.data.confidence || 0));
                }
            } finally { page.cleanup(); }
        }
        const parsed = parseDanfeText(texts.join('\n'));
        const confidence = confidences.length
            ? confidences.reduce((total, value) => total + value, 0) / confidences.length
            : 0;
        onProgress?.(1, 'Leitura concluída. Confira os produtos antes de importar.');
        return { ...parsed, confidence, pageCount, method: confidences.length ? 'ocr' : 'text' };
    } catch (error: any) {
        if (error?.name === 'PasswordException') throw new Error('Este PDF está protegido por senha. Envie uma cópia desbloqueada.');
        if (error?.name === 'InvalidPDFException') throw new Error('O PDF está inválido ou incompleto. Baixe a nota novamente e tente outra vez.');
        throw error;
    } finally {
        try { await worker?.terminate(); } finally { await loadingTask.destroy(); }
    }
};

export const readDanfeDocument = (file: File, onProgress?: (progress: number, status: string) => void) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    return isPdf ? readDanfePdf(file, onProgress) : readDanfeImage(file, onProgress);
};
