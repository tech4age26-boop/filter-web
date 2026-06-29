/** Split "1410 - Inventory Asset" → { code, name } */
export function parseAccountDisplay(accountDisplay) {
    const s = String(accountDisplay || '').trim();
    if (!s) return { code: '', name: '' };
    const i = s.indexOf(' - ');
    if (i === -1) return { code: s, name: '' };
    return { code: s.slice(0, i).trim(), name: s.slice(i + 3).trim() };
}

/**
 * Invoice line label for off-catalog / non-inventory items.
 * Uses typed item name when present, otherwise the selected GL account label.
 */
export function resolveManualInvoiceLineLabel(line, searchText = '') {
    const item = String(searchText ?? line?.item ?? '').trim();
    if (item) return item;
    const { code, name } = parseAccountDisplay(line?.account);
    if (name) return name;
    if (code) return code;
    return '';
}

/** Line is ready to submit without a catalog product (account + qty + price). */
export function isManualInvoiceLineComplete(line, searchText = '') {
    const label = resolveManualInvoiceLineLabel(line, searchText);
    if (!label) return false;
    const qty = parseFloat(String(line?.qty ?? '').replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) return false;
    const price = parseFloat(String(line?.price ?? '').replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) return false;
    return true;
}

export function isInvoiceLineSubmitReady(line, searchText = '') {
    const hasProduct =
        line?.productId != null && String(line.productId).trim() !== '';
    if (hasProduct) {
        const qty = parseFloat(String(line?.qty ?? '').replace(',', '.'));
        return Number.isFinite(qty) && qty > 0;
    }
    return isManualInvoiceLineComplete(line, searchText);
}
