import { apiFetch } from './api';

/**
 * Public (no login) workshop purchase invoice verification — backend must allow unauthenticated GET.
 * Response shape from SuccessResponseInterceptor: { success, verified, source, ... }.
 */
export function getPublicWorkshopPurchaseInvoiceVerify(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    return apiFetch(`/public/workshop-purchase-invoices/${encodeURIComponent(String(id))}`);
}

/** Public supplier→workshop sales invoice (AR) — no login. */
export function getPublicSupplierSalesInvoiceVerify(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing invoice id'));
    }
    return apiFetch(`/public/supplier-sales-invoices/${encodeURIComponent(String(id))}`);
}

/** Public super-supplier purchase bill (upstream vendor) — no login. */
export function getPublicSuperSupplierPurchaseVerify(id) {
    if (id == null || id === '') {
        return Promise.reject(new Error('Missing purchase id'));
    }
    return apiFetch(`/public/super-supplier-purchases/${encodeURIComponent(String(id))}`);
}
