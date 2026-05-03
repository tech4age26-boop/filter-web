/**
 * Corporate bookings (JWT) — list/detail/branches for the new booking UX.
 * Old GET /corporate/orders and POST /corporate/make_payment remain; prefer these routes.
 */
import { apiFetch } from './api';

function qs(params) {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v == null || v === '') return;
        u.set(k, String(v));
    });
    const s = u.toString();
    return s ? `?${s}` : '';
}

/** GET /corporate/branches — branch picker for booking step 2. */
export async function fetchCorporateBranches({ signal } = {}) {
    const data = await apiFetch('/corporate/branches', { signal });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.branches)) return data.branches;
    if (Array.isArray(data?.data?.branches)) return data.data.branches;
    if (Array.isArray(data?.data)) return data.data;
    return [];
}

/**
 * GET /corporate/bookings?status=&branchId=&startDate=&endDate=&limit=&offset=
 * @returns {{ bookings: unknown[], total?: number, limit?: number, offset?: number }}
 */
export async function fetchCorporateBookings(params = {}, { signal } = {}) {
    const data = await apiFetch(`/corporate/bookings${qs(params)}`, { signal });
    const root = data?.data && typeof data.data === 'object' ? data.data : data;
    const bookings = Array.isArray(root?.bookings)
        ? root.bookings
        : Array.isArray(root?.orders)
          ? root.orders
          : Array.isArray(data?.bookings)
            ? data.bookings
            : [];
    return {
        bookings,
        total: root?.total ?? data?.total,
        limit: root?.limit ?? data?.limit,
        offset: root?.offset ?? data?.offset,
    };
}

/** GET /corporate/bookings/:id — full booking detail; falls back to null on failure. */
export async function fetchCorporateBookingById(id, { signal } = {}) {
    const data = await apiFetch(`/corporate/bookings/${encodeURIComponent(String(id))}`, { signal });
    return data?.booking ?? data?.data?.booking ?? data?.data ?? data?.order ?? data;
}
