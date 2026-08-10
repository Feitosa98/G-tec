export const formatBrazilianPhone = (value: string | null | undefined) => {
    let digits = String(value || '').replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
        digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);

    if (!digits) return '';
    if (digits.length <= 2) return `(${digits}`;

    const areaCode = digits.slice(0, 2);
    const localNumber = digits.slice(2);
    if (localNumber.length <= 4) return `(${areaCode}) ${localNumber}`;

    return `(${areaCode}) ${localNumber.slice(0, -4)}-${localNumber.slice(-4)}`;
};

