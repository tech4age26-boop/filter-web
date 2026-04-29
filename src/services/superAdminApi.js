import { apiFetch } from './api';

// Build query string — skips undefined/null/empty values
function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export const getStats = () =>
    apiFetch('/super-admin/stats');

// ─── Master Catalog: Duplication Review ───────────────────────────────────────

export const getDuplicates = ({ entityType } = {}) =>
    apiFetch(`/super-admin/master-catalog/duplicates${qs({ entityType })}`);

export const ignoreDuplicate = ({ entityType, nameKey }) =>
    apiFetch('/super-admin/master-catalog/duplicates/ignore', {
        method: 'POST',
        body: JSON.stringify({ entityType, nameKey }),
    });

export const unignoreDuplicate = ({ entityType, nameKey }) =>
    apiFetch(`/super-admin/master-catalog/duplicates/ignore${qs({ entityType, nameKey })}`, {
        method: 'DELETE',
    });

/** Deletes one record from a duplicate group (uses underlying entity delete logic). */
export const deleteDuplicateItem = (entityType, id) =>
    apiFetch(`/super-admin/master-catalog/duplicates/${entityType}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });

// ─── Master Catalog: Product Requests ─────────────────────────────────────────

export const getProductRequestKpis = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/master-catalog/product-requests/kpis${qs({ workshopId })}`);

export const getProductRequests = ({ status, workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/master-catalog/product-requests${qs({ status, workshopId, limit, offset })}`);

export const getProductRequest = (id) =>
    apiFetch(`/super-admin/master-catalog/product-requests/${encodeURIComponent(String(id))}`);

export const approveProductRequest = (id, payload) =>
    apiFetch(`/super-admin/master-catalog/product-requests/${encodeURIComponent(String(id))}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(payload && typeof payload === 'object' ? payload : {}),
    });

export const rejectProductRequest = (id, reason) =>
    apiFetch(`/super-admin/master-catalog/product-requests/${encodeURIComponent(String(id))}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
    });

// ─── Master Catalog KPIs ──────────────────────────────────────────────────────

/**
 * Combined KPIs for the master catalog landing.
 * Shape: { products: { total, active, inactive }, services: {...},
 *          departments: {...}, categories: { total, byType: { product, service, expense } } }
 */
export const getMasterCatalogKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis');

export const getMasterCatalogProductKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/products');

export const getMasterCatalogServiceKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/services');

export const getMasterCatalogDepartmentKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/departments');

export const getMasterCatalogCategoryKpis = () =>
    apiFetch('/super-admin/master-catalog/kpis/categories');

// ─── Workshops ────────────────────────────────────────────────────────────────

export const getWorkshops = ({ status, limit, offset } = {}) =>
    apiFetch(`/super-admin/workshops${qs({ status, limit, offset })}`);

export const getWorkshopOptions = () =>
    apiFetch('/super-admin/workshops/options');

export const getWorkshop = (id) =>
    apiFetch(`/super-admin/workshops/${id}`);

export const createWorkshop = (body) =>
    apiFetch('/super-admin/workshops', { method: 'POST', body: JSON.stringify(body) });

export const updateWorkshop = (id, body) =>
    apiFetch(`/super-admin/workshops/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Branches ─────────────────────────────────────────────────────────────────

export const getBranches = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/branches${qs({ workshopId })}`);

export const getBranch = (id) =>
    apiFetch(`/super-admin/branches/${id}`);

export const createBranch = (body) =>
    apiFetch('/super-admin/branches', { method: 'POST', body: JSON.stringify(body) });

export const updateBranch = (id, body) =>
    apiFetch(`/super-admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Users ────────────────────────────────────────────────────────────────────

export const getUsers = ({ userType, workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/users${qs({ userType, workshopId, limit, offset })}`);

export const getUser = (id) =>
    apiFetch(`/super-admin/users/${id}`);

export const updateUser = (id, body) =>
    apiFetch(`/super-admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const changeUserPassword = (id, newPassword) =>
    apiFetch(`/super-admin/users/${id}/password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
    });

export const setUserActive = (id, isActive) =>
    apiFetch(`/super-admin/users/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
    });

// ─── Technicians ──────────────────────────────────────────────────────────────

export const getTechnicians = ({ workshopId, branchId } = {}) =>
    apiFetch(`/super-admin/technicians${qs({ workshopId, branchId })}`);

export const getTechnician = (id) =>
    apiFetch(`/super-admin/technicians/${id}`);

export const createTechnician = (body) =>
    apiFetch('/super-admin/technicians', { method: 'POST', body: JSON.stringify(body) });

export const updateTechnician = (id, body) =>
    apiFetch(`/super-admin/technicians/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const getSuppliers = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/suppliers${qs({ workshopId })}`);

export const getSupplier = (id) =>
    apiFetch(`/super-admin/suppliers/${id}`);

export const createSupplier = (body) =>
    apiFetch('/super-admin/suppliers', { method: 'POST', body: JSON.stringify(body) });

export const updateSupplier = (id, body) =>
    apiFetch(`/super-admin/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Products ─────────────────────────────────────────────────────────────────

export const getProducts = ({ branchId, signal } = {}) =>
    apiFetch(`/super-admin/products${qs({ branchId })}`, { signal });

export const getProduct = (id) =>
    apiFetch(`/super-admin/products/${id}`);

export const createProduct = (body) =>
    apiFetch('/super-admin/products', { method: 'POST', body: JSON.stringify(body) });

/** PATCH body: flat fields only. `departmentId` is not supported (department fixed after create). 200 = flat product (same shape as list/get), not `{ product }`. */
export const updateProduct = (id, body) =>
    apiFetch(`/super-admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/** 200 `{ success, message }` when delete succeeds. 400 if in use — soft-delete with PATCH `{ isActive: false }`. */
export const deleteProduct = (id) =>
    apiFetch(`/super-admin/products/${id}`, { method: 'DELETE' });

/** Multipart CSV import; field name must be `file` (max 5MB, .csv). Logging lives in apiFetch. */
export const importProductsFromCsv = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/super-admin/products/import', {
        method: 'POST',
        body: formData,
    });
};

/** Same response shape as product import: created, skippedDuplicate, failed, vatWarningsCount, rowDetails, vatWarnings. Header must match Services.csv / SERVICE_CSV_CANONICAL_HEADERS. */
export const importServicesFromCsv = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/super-admin/services/import', {
        method: 'POST',
        body: formData,
    });
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const getCategories = ({ type, signal } = {}) =>
    apiFetch(`/super-admin/categories${qs({ type })}`, { signal });

export const createCategory = (body) =>
    apiFetch('/super-admin/categories', { method: 'POST', body: JSON.stringify(body) });

export const updateCategory = (id, body) =>
    apiFetch(`/super-admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteCategory = (id) =>
    apiFetch(`/super-admin/categories/${id}`, { method: 'DELETE' });

// ─── Cashiers ─────────────────────────────────────────────────────────────────

export const getCashiers = ({ workshopId, branchId } = {}) =>
    apiFetch(`/super-admin/cashiers${qs({ workshopId, branchId })}`);

export const getCashier = (id) =>
    apiFetch(`/super-admin/cashiers/${id}`);

export const createCashier = (body) =>
    apiFetch('/super-admin/cashiers', { method: 'POST', body: JSON.stringify(body) });

export const updateCashier = (id, body) =>
    apiFetch(`/super-admin/cashiers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Customers ────────────────────────────────────────────────────────────────

export const getCustomers = ({ workshopId, customerType } = {}) =>
    apiFetch(`/super-admin/customers${qs({ workshopId, customerType })}`);

export const getCustomerDetails = (id) =>
    apiFetch(`/super-admin/customers/${encodeURIComponent(String(id))}/details`);

// ─── Departments ──────────────────────────────────────────────────────────────

export const getDepartments = () =>
    apiFetch('/super-admin/departments');

export const createDepartment = (body) =>
    apiFetch('/super-admin/departments', { method: 'POST', body: JSON.stringify(body) });

export const updateDepartment = (id, body) =>
    apiFetch(`/super-admin/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteDepartment = (id) =>
    apiFetch(`/super-admin/departments/${id}`, { method: 'DELETE' });

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export const getSalesOrders = ({ workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/sales-orders${qs({ workshopId, limit, offset })}`);

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const getInvoices = ({ workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/invoices${qs({ workshopId, limit, offset })}`);

// ─── Services ─────────────────────────────────────────────────────────────────

export const getServices = () =>
    apiFetch('/super-admin/services');

export const createService = (body) =>
    apiFetch('/super-admin/services', { method: 'POST', body: JSON.stringify(body) });

export const updateService = (id, body) =>
    apiFetch(`/super-admin/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteService = (id) =>
    apiFetch(`/super-admin/services/${id}`, { method: 'DELETE' });

// ─── Corporate Registrations ──────────────────────────────────────────────────

export const getCorporateRegistrations = ({ status } = {}) =>
    apiFetch(`/super-admin/corporate-registrations${qs({ status })}`);

export const approveCorporateRegistration = (id) =>
    apiFetch(`/super-admin/corporate-registrations/${id}/approve`, { method: 'POST' });

export const rejectCorporateRegistration = (id, reason) =>
    apiFetch(`/super-admin/corporate-registrations/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });

// ─── Supplier Registrations ───────────────────────────────────────────────────

export const getSupplierRegistrations = () =>
    apiFetch('/super-admin/supplier/registrations');

export const approveSupplierRegistration = (requestId) =>
    apiFetch('/super-admin/supplier/registrations/approve', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
    });

export const rejectSupplierRegistration = () =>
    apiFetch('/super-admin/supplier/registrations/reject', { method: 'POST' });

// ─── Banners ──────────────────────────────────────────────────────────────────

export const getBanners = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/banners${qs({ workshopId })}`);

export const createBanner = (body) =>
    apiFetch('/super-admin/banners', { method: 'POST', body: JSON.stringify(body) });
