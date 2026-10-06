export function downloadReceiptPdf(pdf: { name: string; base64: string }) {
    const bytes = Uint8Array.from(atob(pdf.base64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = pdf.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
