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

export const getTechnicians = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/technicians${qs({ workshopId })}`);

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

export const getProducts = ({ workshopId, branchId } = {}) =>
    apiFetch(`/super-admin/products${qs({ workshopId, branchId })}`);

export const getProduct = (id) =>
    apiFetch(`/super-admin/products/${id}`);

export const createProduct = (body) =>
    apiFetch('/super-admin/products', { method: 'POST', body: JSON.stringify(body) });

export const updateProduct = (id, body) =>
    apiFetch(`/super-admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Categories ───────────────────────────────────────────────────────────────

export const getCategories = ({ workshopId, type } = {}) =>
    apiFetch(`/super-admin/categories${qs({ workshopId, type })}`);

// ─── Cashiers ─────────────────────────────────────────────────────────────────

export const getCashiers = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/cashiers${qs({ workshopId })}`);

export const getCashier = (id) =>
    apiFetch(`/super-admin/cashiers/${id}`);

export const createCashier = (body) =>
    apiFetch('/super-admin/cashiers', { method: 'POST', body: JSON.stringify(body) });

export const updateCashier = (id, body) =>
    apiFetch(`/super-admin/cashiers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// ─── Customers ────────────────────────────────────────────────────────────────

export const getCustomers = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/customers${qs({ workshopId })}`);

// ─── Departments ──────────────────────────────────────────────────────────────

export const getDepartments = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/departments${qs({ workshopId })}`);

// ─── Sales Orders ─────────────────────────────────────────────────────────────

export const getSalesOrders = ({ workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/sales-orders${qs({ workshopId, limit, offset })}`);

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const getInvoices = ({ workshopId, limit, offset } = {}) =>
    apiFetch(`/super-admin/invoices${qs({ workshopId, limit, offset })}`);

// ─── Services ─────────────────────────────────────────────────────────────────

export const getServices = ({ workshopId } = {}) =>
    apiFetch(`/super-admin/services${qs({ workshopId })}`);

export const createService = (body) =>
    apiFetch('/super-admin/services', { method: 'POST', body: JSON.stringify(body) });

export const updateService = (id, body) =>
    apiFetch(`/super-admin/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

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
