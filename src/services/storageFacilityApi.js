import { apiFetch } from './api';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

const base = '/supplier/storage-facility';

export const listStorageBrands = () => apiFetch(`${base}/brands`);

export const createStorageBrand = (body) =>
    apiFetch(`${base}/brands`, { method: 'POST', body: JSON.stringify(body) });

export const updateStorageBrand = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

export const getStorageBrandSummary = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/summary`);

export const listStorageBrandUsers = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/users`);

export const createStorageBrandUser = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/users`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listStorageProducts = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/products`);

export const createStorageProduct = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/products`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateStorageProduct = (brandId, productId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
    );

export const setStorageProductCatalogMap = (brandId, productId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}/catalog-map`,
        { method: 'PUT', body: JSON.stringify(body) },
    );

export const deleteStorageProduct = (brandId, productId) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}`,
        { method: 'DELETE' },
    );

export const getStorageProductTimeline = (brandId, productId, params = {}) =>
    apiFetch(
        withQuery(
            `${base}/brands/${encodeURIComponent(brandId)}/products/${encodeURIComponent(productId)}/timeline`,
            params,
        ),
    );

export const listStorageAuditLog = (brandId, params = {}) =>
    apiFetch(
        withQuery(`${base}/brands/${encodeURIComponent(brandId)}/audit`, params),
    );

export const listStorageMovements = (brandId, params = {}) =>
    apiFetch(
        withQuery(`${base}/brands/${encodeURIComponent(brandId)}/movements`, params),
    );

export const postStorageMovement = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/movements`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const postStorageBulkMovements = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/movements/bulk`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listStorageLocations = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/locations`);

export const createStorageLocation = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/locations`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateStorageLocation = (brandId, locationId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/locations/${encodeURIComponent(locationId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
    );

export const deleteStorageLocation = (brandId, locationId) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/locations/${encodeURIComponent(locationId)}`,
        { method: 'DELETE' },
    );

export const listStorageTransfers = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/transfers`);

export const listStorageSalesReps = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales-reps`);

export const createStorageSalesRep = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales-reps`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateStorageSalesRep = (brandId, salesRepId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/sales-reps/${encodeURIComponent(salesRepId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
    );

export const deleteStorageSalesRep = (brandId, salesRepId) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/sales-reps/${encodeURIComponent(salesRepId)}`,
        { method: 'DELETE' },
    );

export const listStorageSales = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales`);

export const getStorageSalesRepPerformance = (brandId, params = {}) =>
    apiFetch(
        withQuery(
            `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-performance`,
            params,
        ),
    );

export const listStorageSalesRepTargets = (brandId, salesRepId) =>
    apiFetch(
        withQuery(
            `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets`,
            salesRepId ? { salesRepId } : {},
        ),
    );

export const createStorageSalesRepTarget = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateStorageSalesRepTarget = (brandId, targetId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets/${encodeURIComponent(targetId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
    );

export const deleteStorageSalesRepTarget = (brandId, targetId) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/sales-rep-targets/${encodeURIComponent(targetId)}`,
        { method: 'DELETE' },
    );

export const listStorageInvoices = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/invoices`);

export const createStorageInvoice = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/invoices`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const postStorageInvoice = (brandId, invoiceId) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/invoices/${encodeURIComponent(invoiceId)}/post`,
        { method: 'POST' },
    );

export const recordStorageInvoicePayment = (brandId, invoiceId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/invoices/${encodeURIComponent(invoiceId)}/payments`,
        { method: 'POST', body: JSON.stringify(body) },
    );

export const getStorageBrandAr = (brandId) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/ar`);

export const listStorageCustomers = (brandId, params = {}) =>
    apiFetch(
        withQuery(`${base}/brands/${encodeURIComponent(brandId)}/customers`, params),
    );

export const createStorageCustomer = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/customers`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const updateStorageCustomer = (brandId, customerId, body) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/customers/${encodeURIComponent(customerId)}`,
        { method: 'PATCH', body: JSON.stringify(body) },
    );

export const getStorageCustomer = (brandId, customerId) =>
    apiFetch(
        `${base}/brands/${encodeURIComponent(brandId)}/customers/${encodeURIComponent(customerId)}`,
    );

export const createStorageTransfer = (brandId, body) =>
    apiFetch(`${base}/brands/${encodeURIComponent(brandId)}/transfers`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const searchWarehouseProductsForMap = (q) =>
    apiFetch(withQuery(`${base}/warehouse-products`, { q }));
