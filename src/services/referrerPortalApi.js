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

export const referrerGetMyCommissions = (status) =>
  apiFetch(
    status && status !== 'all'
      ? `/referrer/me/commissions?status=${encodeURIComponent(status)}`
      : '/referrer/me/commissions',
  );

export const referrerGetWallet = () => apiFetch('/referrer/me/wallet');

export const referrerGetPayoutDetails = () => apiFetch('/referrer/me/payout-details');

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
