import { apiFetch } from './api';

function buildQs(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const s = qs.toString();
    return s ? `?${s}` : '';
}

/** List platform admins with wallet assignment + balance. */
export function listAdminWallets({ search, walletOnly, limit, offset } = {}) {
    return apiFetch(
        `/super-admin/admin-wallets${buildQs({ search, walletOnly, limit, offset })}`,
    );
}

/** Wallet detail for one platform admin. */
export function getAdminWallet(userId) {
    return apiFetch(`/super-admin/admin-wallets/${encodeURIComponent(userId)}`);
}

/** HQ cash/bank registers for admin wallet fund approval. */
export function listAdminWalletCashAccounts() {
    return apiFetch('/super-admin/admin-wallets/cash-accounts');
}

/** Paginated transaction history for one platform admin wallet. */
export function listAdminWalletTransactions(userId, { limit, offset } = {}) {
    return apiFetch(
        `/super-admin/admin-wallets/${encodeURIComponent(userId)}/transactions${buildQs({ limit, offset })}`,
    );
}

// ───────── My Wallet (wallet-enabled platform admin) ─────────

export function getMyWallet() {
    return apiFetch('/super-admin/my-wallet');
}

export function getMyWalletChatContact() {
    return apiFetch('/super-admin/my-wallet/chat-contact');
}

export function listMyWalletTransactions({ limit, offset } = {}) {
    return apiFetch(`/super-admin/my-wallet/transactions${buildQs({ limit, offset })}`);
}

export function listMyFundRequests() {
    return apiFetch('/super-admin/my-wallet/fund-requests');
}

/** payload = { amount, purpose } */
export function createMyFundRequest(payload) {
    return apiFetch('/super-admin/my-wallet/fund-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function shareFundRequestInChat(fundRequestId) {
    return apiFetch(
        `/super-admin/my-wallet/fund-requests/${encodeURIComponent(String(fundRequestId))}/share-in-chat`,
        { method: 'POST' },
    );
}

/** payload = { amount, description, vendorName?, expenseCategory, proofUrl } */
export function recordMyWalletExpense(payload) {
    return apiFetch('/super-admin/my-wallet/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
