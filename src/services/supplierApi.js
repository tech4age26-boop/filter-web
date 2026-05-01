import { apiFetch, BASE_URL } from './api';

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

// Dashboard
export const getSupplierDashboard = () => apiFetch('/supplier/dashboard');
export const getSupplierPurchaseOrders = (params = {}) =>
    apiFetch(withQuery('/supplier/purchase-orders', params));
export const getSupplierReceivables = () => apiFetch('/supplier/receivables');
export const getSupplierReportsQuickSummary = () =>
    apiFetch('/supplier/reports/quick-summary');
export const getSupplierProfile = () => apiFetch('/supplier/profile');

// Products / catalog
export const listSupplierProducts = (params = {}) =>
    apiFetch(withQuery('/supplier/products', params));
export const listSupplierMasterCatalogProducts = ({ branchId, signal } = {}) =>
    apiFetch(withQuery('/supplier/products/master-catalog', { branchId }), { signal });
export const createSupplierProductRequest = (body) =>
    apiFetch('/supplier/product-requests', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const listSupplierProductRequests = (params = {}) =>
    apiFetch(withQuery('/supplier/product-requests', params));
export const getSupplierProduct = (productId) =>
    apiFetch(`/supplier/products/${productId}`);
export const createSupplierProduct = (body) =>
    apiFetch('/supplier/products', { method: 'POST', body: JSON.stringify(body) });
export const updateSupplierProduct = (productId, body) =>
    apiFetch(`/supplier/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierProduct = (productId) =>
    apiFetch(`/supplier/products/${productId}`, {
        method: 'DELETE',
    });
export const getSupplierProductCategories = () =>
    apiFetch('/supplier/product-categories');
export const getSupplierUnits = () => apiFetch('/supplier/units');

// Locations / stock
export const getSupplierLocations = () => apiFetch('/supplier/locations');
export const createSupplierLocation = (body) =>
    apiFetch('/supplier/locations', { method: 'POST', body: JSON.stringify(body) });
export const getSupplierInventoryStockBalances = (params = {}) =>
    apiFetch(withQuery('/supplier/inventory/stock-balances', params));
export const getSupplierStockVisibilityScreen = (params = {}) =>
    apiFetch(withQuery('/supplier/stock-visibility/screen', params));
export const getSupplierCriticalStockSummary = () =>
    apiFetch('/supplier/stock-visibility/critical-summary');
export const getSupplierStockVisibility = (params = {}) =>
    apiFetch(withQuery('/supplier/stock-visibility', params));
export const setSupplierStock = (body) =>
    apiFetch('/supplier/stock', { method: 'POST', body: JSON.stringify(body) });
export const createSupplierStockOrder = (body) =>
    apiFetch('/supplier/stock/order', { method: 'POST', body: JSON.stringify(body) });

// Promo banners
export const getSupplierPromoBannersSummary = () =>
    apiFetch('/supplier/promo-banners/summary');
export const listSupplierPromoBanners = (params = {}) =>
    apiFetch(withQuery('/supplier/promo-banners', params));
export const getSupplierPromoBanner = (id) => apiFetch(`/supplier/promo-banners/${id}`);
export const createSupplierPromoBanner = (body) =>
    apiFetch('/supplier/promo-banners', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const updateSupplierPromoBannerStatus = (id, body) =>
    apiFetch(`/supplier/promo-banners/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const updateSupplierPromoBanner = (id, body) =>
    apiFetch(`/supplier/promo-banners/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

// Purchase orders
export const getSupplierPurchaseOrder = (id) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}`);
export const acceptSupplierPurchaseOrder = (id) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/accept`, { method: 'PATCH' });
export const rejectSupplierPurchaseOrder = (id, body) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deliverSupplierPurchaseOrder = (id, body) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/deliver`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const updateSupplierPurchaseOrderStatus = (id, body) =>
    apiFetch(`/supplier/purchase-orders/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

// Invoices / payments / payables
export const createSupplierInvoice = (body) =>
    apiFetch('/supplier/invoices', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierInvoices = (params = {}) =>
    apiFetch(withQuery('/supplier/invoices', params));
export const getSupplierInvoice = (id) => apiFetch(`/supplier/invoices/${id}`);
export const updateSupplierInvoice = (id, body) =>
    apiFetch(`/supplier/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierInvoice = (id) =>
    apiFetch(`/supplier/invoices/${id}`, { method: 'DELETE' });
export const getSupplierInvoicePdfData = (id) =>
    apiFetch(`/supplier/invoices/${id}/pdf`);
export const remindSupplierInvoice = (id) =>
    apiFetch(`/supplier/invoices/${id}/remind`, { method: 'POST' });
export const recordSupplierPayment = (body) =>
    apiFetch('/supplier/payments', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierPayments = (params = {}) =>
    apiFetch(withQuery('/supplier/payments', params));
export const createSupplierPayable = (body) =>
    apiFetch('/supplier/payables', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierPayables = (params = {}) =>
    apiFetch(withQuery('/supplier/payables', params));
export const getSupplierPayable = (id) => apiFetch(`/supplier/payables/${id}`);
export const updateSupplierPayable = (id, body) =>
    apiFetch(`/supplier/payables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierPayable = (id) =>
    apiFetch(`/supplier/payables/${id}`, { method: 'DELETE' });

// Super suppliers (upstream vendors you buy inventory from)
export const listSupplierSuperSuppliers = () => apiFetch('/supplier/super-suppliers');
export const createSupplierSuperSupplier = (body) =>
    apiFetch('/supplier/super-suppliers', { method: 'POST', body: JSON.stringify(body) });
export const updateSupplierSuperSupplier = (id, body) =>
    apiFetch(`/supplier/super-suppliers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const listSupplierSuperSupplierPurchases = (params = {}) =>
    apiFetch(withQuery('/supplier/super-supplier-purchases', params));
export const createSupplierSuperSupplierPurchase = (body) =>
    apiFetch('/supplier/super-supplier-purchases', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const getSupplierSuperSupplierPurchase = (id) =>
    apiFetch(`/supplier/super-supplier-purchases/${encodeURIComponent(String(id))}`);
export const updateSupplierSuperSupplierPurchase = (id, body) =>
    apiFetch(`/supplier/super-supplier-purchases/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const listSupplierSuperSupplierAudit = (params = {}) =>
    apiFetch(withQuery('/supplier/super-supplier-audit', params));

// Workshop purchase invoices (workshop submits → supplier reviews / stock on approve)
export const listSupplierWorkshopPurchaseInvoices = (params = {}) =>
    apiFetch(withQuery('/supplier/workshop-purchase-invoices', params));
export const getSupplierWorkshopPurchaseInvoice = (id) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}`);
export const updateSupplierWorkshopPurchaseInvoice = (id, body) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const approveSupplierWorkshopPurchaseInvoice = (id) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
export const rejectSupplierWorkshopPurchaseInvoice = (id, body) =>
    apiFetch(`/supplier/workshop-purchase-invoices/${encodeURIComponent(String(id))}/reject`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
    });

/** Download PDF for a payable (GET /supplier/payables/:id/pdf). Returns blob + suggested filename from Content-Disposition when present. */
export async function downloadSupplierPayablePdf(id) {
    const token = localStorage.getItem('filter_auth_token');
    const res = await fetch(`${BASE_URL}/supplier/payables/${encodeURIComponent(id)}/pdf`, {
        method: 'GET',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'application/pdf,*/*',
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `PDF request failed: ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
    const filename = m ? decodeURIComponent(m[1].trim()) : `payable-${id}.pdf`;
    return { blob, filename };
}

// Expenses
export const getSupplierExpenseCategories = () =>
    apiFetch('/supplier/expense-categories');
export const createSupplierExpenseCategory = (body) =>
    apiFetch('/supplier/expense-categories', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const createSupplierExpense = (body) =>
    apiFetch('/supplier/expenses', { method: 'POST', body: JSON.stringify(body) });
export const listSupplierExpenses = (params = {}) =>
    apiFetch(withQuery('/supplier/expenses', params));
export const getSupplierExpense = (id) => apiFetch(`/supplier/expenses/${id}`);
export const updateSupplierExpense = (id, body) =>
    apiFetch(`/supplier/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const deleteSupplierExpense = (id) =>
    apiFetch(`/supplier/expenses/${id}`, { method: 'DELETE' });
export const getSupplierExpensesSummary = () =>
    apiFetch('/supplier/expenses/summary');
export const getSupplierExpensesStats = () => apiFetch('/supplier/expenses/stats');
export const getSupplierAccountingReport = () =>
    apiFetch('/supplier/reports/accounting');
export const getSupplierAccountingScreen = (params = {}) =>
    apiFetch(withQuery('/supplier/reports/accounting/screen', params));

// Staff
export const listSupplierStaff = (params = {}) =>
    apiFetch(withQuery('/supplier/staff', params));
export const createSupplierStaff = (body) =>
    apiFetch('/supplier/staff', { method: 'POST', body: JSON.stringify(body) });
export const updateSupplierStaff = (id, body) =>
    apiFetch(`/supplier/staff/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteSupplierStaff = (id) =>
    apiFetch(`/supplier/staff/${id}`, { method: 'DELETE' });

// Cash/Bank accounts + ledger
export const listSupplierCashBankAccounts = () =>
    apiFetch('/supplier/cash-bank/accounts');
export const createSupplierCashBankAccount = (body) =>
    apiFetch('/supplier/cash-bank/accounts', {
        method: 'POST',
        body: JSON.stringify(body),
    });
export const updateSupplierCashBankAccount = (id, body) =>
    apiFetch(`/supplier/cash-bank/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
export const listSupplierCashBankLedger = (params = {}) =>
    apiFetch(withQuery('/supplier/cash-bank/ledger', params));
export const createSupplierCashBankLedgerEntry = (body) =>
    apiFetch('/supplier/cash-bank/ledger', {
        method: 'POST',
        body: JSON.stringify(body),
    });

// Profile / auth
export const updateSupplierProfile = (body) =>
    apiFetch('/supplier/profile', { method: 'PATCH', body: JSON.stringify(body) });
export const changeSupplierPassword = (body) =>
    apiFetch('/supplier/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
    });
