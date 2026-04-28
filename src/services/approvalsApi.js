import { apiFetch } from './api';

// entityType: workshop_registration | supplier_registration | corporate_registration | technician_registration
// status: pending | approved | rejected

export function getApprovals({ entityType, status } = {}) {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiFetch(`/super-admin/approvals${qs ? `?${qs}` : ''}`);
}

export function getPendingApprovals({ entityType } = {}) {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    const qs = params.toString();
    return apiFetch(`/super-admin/approvals/pending${qs ? `?${qs}` : ''}`);
}

export function getApprovedApprovals({ entityType } = {}) {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    const qs = params.toString();
    return apiFetch(`/super-admin/approvals/approved${qs ? `?${qs}` : ''}`);
}

export function getRejectedApprovals({ entityType } = {}) {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    const qs = params.toString();
    return apiFetch(`/super-admin/approvals/rejected${qs ? `?${qs}` : ''}`);
}

export function getApprovalDetails(entityType, id) {
    return apiFetch(`/super-admin/approvals/${entityType}/${id}`);
}

export function approveRequest(entityType, id, body = {}) {
    return apiFetch(`/super-admin/approvals/${entityType}/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function rejectRequest(entityType, id, body = {}) {
    return apiFetch(`/super-admin/approvals/${entityType}/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}
