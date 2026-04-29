import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

// ─── Browse super-admin catalog ──────────────────────────────────────────────
// Rows include `inWorkshop` always, and `inBranch` when a `branchId` query is
// supplied. When `branchId` is omitted, the legacy behavior is preserved.

export const getCatalogDepartments = ({ branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/departments${qs({ branchId })}`, { signal });

export const getCatalogCategories = ({ departmentId, type, branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/categories${qs({ departmentId, type, branchId })}`, { signal });

export const getCatalogProducts = ({ departmentId, categoryId, q, page, pageSize, branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/products${qs({ departmentId, categoryId, q, page, pageSize, branchId })}`, { signal });

export const getCatalogServices = ({ departmentId, categoryId, q, page, pageSize, branchId, signal } = {}) =>
    apiFetch(`/workshop-catalog/catalog/services${qs({ departmentId, categoryId, q, page, pageSize, branchId })}`, { signal });

// ─── Browse what's already adopted in my workshop ────────────────────────────
// Every row now includes `branches: [{ id, name }]` and `branchNames: string[]`
// listing every branch in the workshop that's currently holding the item.

export const getMyDepartments = ({ signal } = {}) =>
    apiFetch('/workshop-catalog/my/departments', { signal });

export const getMyCategories = ({ departmentId, type, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/categories${qs({ departmentId, type })}`, { signal });

export const getMyProducts = ({ departmentId, categoryId, isActive, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/products${qs({ departmentId, categoryId, isActive })}`, { signal });

export const getMyServices = ({ departmentId, categoryId, isActive, signal } = {}) =>
    apiFetch(`/workshop-catalog/my/services${qs({ departmentId, categoryId, isActive })}`, { signal });

// ─── Adopt (auto-adds missing parents) ───────────────────────────────────────

/** body: { departmentIds, categorySelections?: [{ departmentId, categoryIds: string[] | "all" }] } */
export const adoptDepartments = (body) =>
    apiFetch('/workshop-catalog/departments', { method: 'POST', body: JSON.stringify(body) });

/** body: { categoryIds }  — parent departments auto-added. */
export const adoptCategories = (body) =>
    apiFetch('/workshop-catalog/categories', { method: 'POST', body: JSON.stringify(body) });

/** body: { items: [{ productId, openingQty?, criticalStockPoint?, salePriceOverride? }] } */
export const adoptProducts = (body) =>
    apiFetch('/workshop-catalog/products', { method: 'POST', body: JSON.stringify(body) });

/** body: { items: [{ serviceId, sellingPriceOverride?, isPriceEditable? }] } */
export const adoptServices = (body) =>
    apiFetch('/workshop-catalog/services', { method: 'POST', body: JSON.stringify(body) });

// ─── Preview (no writes) ─────────────────────────────────────────────────────

/** body: { productIds }  → { missing: { departments, categories } } */
export const previewProductDeps = (body) =>
    apiFetch('/workshop-catalog/products/preview-dependencies', { method: 'POST', body: JSON.stringify(body) });

/** body: { serviceIds } → { missing: { departments, categories } } */
export const previewServiceDeps = (body) =>
    apiFetch('/workshop-catalog/services/preview-dependencies', { method: 'POST', body: JSON.stringify(body) });

// ─── Per-branch adoption ─────────────────────────────────────────────────────
// `branchIds` is optional in every body. If omitted, the backend resolves it
// to every active branch in the workshop. Adopting a category auto-adopts the
// parent department; adopting a product/service auto-adopts both parent
// department and category — all to the same branches.
//
// Response shape:
// {
//   success,
//   added: {
//     departments: [{ branchId, branchName, itemId, itemName, kind: 'department' }],
//     categories:  [...],
//     products:    [...],
//     services:    [...],
//   },
//   skipped: [{ kind, branchId, itemId, reason }]
// }

/** body: { branchIds?, departmentIds, categorySelections? } */
export const adoptDepartmentsToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/departments', { method: 'POST', body: JSON.stringify(body) });

/** body: { branchIds?, categoryIds } */
export const adoptCategoriesToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/categories', { method: 'POST', body: JSON.stringify(body) });

/** body: { branchIds?, items: [{ productId, openingQty?, criticalStockPoint?, salePriceOverride? }] } */
export const adoptProductsToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/products', { method: 'POST', body: JSON.stringify(body) });

/** body: { branchIds?, items: [{ serviceId, sellingPriceOverride?, isPriceEditable? }] } */
export const adoptServicesToBranches = (body) =>
    apiFetch('/workshop-catalog/branches/services', { method: 'POST', body: JSON.stringify(body) });

// ─── Per-branch listing ──────────────────────────────────────────────────────

export const getBranchDepartments = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/departments`, { signal });

export const getBranchCategories = (branchId, { type, departmentId, signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/categories${qs({ type, departmentId })}`, { signal });

export const getBranchProducts = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/products`, { signal });

export const getBranchServices = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/services`, { signal });

// ─── Per-branch removal ──────────────────────────────────────────────────────
// Returns `{ success, message, removedFromWorkshop }`. `removedFromWorkshop`
// is true if this branch was the last one holding the item, in which case the
// row is also dropped from the workshop union.

export const removeBranchDepartment = (branchId, departmentId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/departments/${departmentId}`, { method: 'DELETE' });

export const removeBranchCategory = (branchId, categoryId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/categories/${categoryId}`, { method: 'DELETE' });

export const removeBranchProduct = (branchId, productId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/products/${productId}`, { method: 'DELETE' });

export const removeBranchService = (branchId, serviceId) =>
    apiFetch(`/workshop-catalog/branches/${branchId}/services/${serviceId}`, { method: 'DELETE' });
