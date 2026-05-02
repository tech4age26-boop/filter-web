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
