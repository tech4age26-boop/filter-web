import { apiFetch } from './api';

/**
 * Referrer portal — the signed-in referrer's own data.
 *
 * None of these take a referrer id: the backend resolves the profile from the
 * caller's JWT, so a referrer can only ever read their own records.
 *
 * Responses include `linked: false` when the login has not been matched to a
 * marketing referrer profile. Callers should surface that as "not linked yet"
 * rather than as an empty account.
 */

export const referrerGetMe = () => apiFetch('/referrer/me');

export const referrerGetMyReferrals = () => apiFetch('/referrer/me/referrals');

/** Build a query string from defined, non-empty params. */
function qs(params = {}) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all',
  );
  const s = new URLSearchParams(entries).toString();
  return s ? `?${s}` : '';
}

export const referrerGetMyCommissions = (status, range = {}) =>
  apiFetch(`/referrer/me/commissions${qs({ status, from: range.from, to: range.to })}`);

export const referrerGetWallet = () => apiFetch('/referrer/me/wallet');

export const referrerGetPayoutDetails = () => apiFetch('/referrer/me/payout-details');

export const referrerGetMySubmissions = () => apiFetch('/referrer/me/submissions');

export const referrerCreateSubmission = (body) =>
  apiFetch('/referrer/me/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const referrerGetPayoutRequests = () => apiFetch('/referrer/me/payout-requests');

export const referrerCreatePayoutRequest = (amount, notes) =>
  apiFetch('/referrer/me/payout-requests', {
    method: 'POST',
    body: JSON.stringify({ amount, notes }),
  });

export const referrerGetMyRedemptions = (range = {}) =>
  apiFetch(`/referrer/me/redemptions${qs({ from: range.from, to: range.to })}`);

export const referrerGetSubmissionRedemptions = (id) =>
  apiFetch(`/referrer/me/submissions/${id}/redemptions`);

export const referrerUpdateSubmission = (id, body) =>
  apiFetch(`/referrer/me/submissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const referrerCancelSubmission = (id) =>
  apiFetch(`/referrer/me/submissions/${id}/cancel`, { method: 'POST', body: '{}' });

export const referrerRegenerateOwnCode = () =>
  apiFetch('/referrer/me/regenerate-code', { method: 'POST', body: '{}' });

export const referrerGetNotifications = (unreadOnly) =>
  apiFetch(
    unreadOnly ? '/referrer/me/notifications?unreadOnly=true' : '/referrer/me/notifications',
  );

export const referrerMarkNotificationRead = (id) =>
  apiFetch(`/referrer/me/notifications/${id}/read`, { method: 'PATCH', body: '{}' });

export const referrerMarkAllNotificationsRead = () =>
  apiFetch('/referrer/me/notifications/read-all', { method: 'PATCH', body: '{}' });

/** Format a number as SAR for display, e.g. 9600 -> "9,600.00". */
export function formatSar(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Short date for tables, e.g. "2026-08-29". Returns '—' for null. */
export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}
