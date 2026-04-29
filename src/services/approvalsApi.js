import { apiFetch } from './api';

// entityType: workshop_registration | supplier_registration | corporate_registration | technician_registration
// status:     pending | approved | rejected
//
// Backend returns each list item enriched:
//   { requestId, entityType, status, title, submittedBy, reviewer, submittedAt, reviewedAt, meta: {...} }
// IDs are BigInt-safe — keep them as strings; never parseInt.

function buildQs(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
}

/**
 * Unified list. Pass `{ status, entityType }` in any combination.
 * - Omit `status` to fetch the "all" bucket.
 * - When a known status is given, the dedicated bucket endpoint is used
 *   (`/pending`, `/approved`, `/rejected`) — server enrich is identical.
 */
export function list({ status, entityType } = {}) {
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        return apiFetch(`/super-admin/approvals/${status}${buildQs({ entityType })}`);
    }
    return apiFetch(`/super-admin/approvals${buildQs({ entityType, status })}`);
}

/** Full joined object for a single request (entity row + meta + linked user + history). */
export function details(entityType, id) {
    return apiFetch(`/super-admin/approvals/${entityType}/${encodeURIComponent(id)}`);
}

/** Approve a request. `remarks` is optional. */
export function approve(entityType, id, remarks) {
    const body = remarks && remarks.trim() ? { remarks: remarks.trim() } : {};
    return apiFetch(`/super-admin/approvals/${entityType}/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

/** Reject a request. `reason` should be provided (UI marks it required). */
export function reject(entityType, id, reason) {
    const body = reason && reason.trim() ? { reason: reason.trim() } : {};
    return apiFetch(`/super-admin/approvals/${entityType}/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

/* ---------------------------------------------------------------------------
 * Backwards-compatible aliases. Older imports keep working.
 * ------------------------------------------------------------------------- */
export const getApprovals = ({ entityType, status } = {}) => list({ entityType, status });
export const getPendingApprovals = ({ entityType } = {}) => list({ status: 'pending', entityType });
export const getApprovedApprovals = ({ entityType } = {}) => list({ status: 'approved', entityType });
export const getRejectedApprovals = ({ entityType } = {}) => list({ status: 'rejected', entityType });
export const getApprovalDetails = (entityType, id) => details(entityType, id);
export const approveRequest = (entityType, id, body = {}) => approve(entityType, id, body?.remarks);
export const rejectRequest = (entityType, id, body = {}) => reject(entityType, id, body?.reason);
