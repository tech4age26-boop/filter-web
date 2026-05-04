import { apiFetch } from './api';

// entityType (GET /super-admin/approvals/pending — same values in Swagger):
//   workshop_registration | branch_creation | cashier_registration | technician_registration
//   | workshop_portal_staff_registration | supplier_registration | corporate_registration
//   | corporate_price_quotation (approve/reject via POST …/corporate-price-quotations/:id/… — see ApprovalsPage)
// status: pending | approved | rejected
//
// Pending list (high level):
//   - workshop_registration: workshops with status pending (public signup); approve links the signup user to
//     workshop_admin (role created if needed; permissions copied from manager when possible). They still use
//     POST /auth/workshop/login — same workshop JWT portal as owners; there is no separate “branch login”.
//   - branch_creation: workshop-created branches until super-admin approve (branch is scope for POS/staff, not a login).
//   - cashier_registration: pending cashier_user rows (requestId = users.id).
//   - technician_registration: pending workshop_user + technician employee (requestId = users.id).
//   - workshop_portal_staff_registration: manager | supervisor | team_leader portal staff (requestId = users.id).
//   - supplier_registration | corporate_registration: registration queues as documented on the API.
// Approve/reject: PATCH /super-admin/approvals/:entityType/:id/approve|reject
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
