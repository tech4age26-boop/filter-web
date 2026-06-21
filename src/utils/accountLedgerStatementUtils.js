/** Shared helpers for COA ledger statement pages (monitor + supplier). */

export function unwrapLedgerPayload(res) {
    if (!res || typeof res !== 'object') return {};
    if (res.data && typeof res.data === 'object' && (res.data.rows || res.data.lines)) {
        return res.data;
    }
    return res;
}

export function derivePartyFilterKey(party) {
    if (party?.externalPartyId) {
        return `external:${party.externalPartyId}`;
    }
    if (party?.partyType && party?.partyId) {
        return `${party.partyType}:${party.partyId}`;
    }
    return '';
}

export function partyQueryFromFilterKey(key) {
    if (!key) return {};
    if (key.startsWith('external:')) {
        return { externalPartyId: key.slice(9) };
    }
    const idx = key.indexOf(':');
    if (idx > 0) {
        return {
            partyType: key.slice(0, idx),
            partyId: key.slice(idx + 1),
        };
    }
    return {};
}

/** Cash/bank child accounts may not have isCashEquivalent set on the row itself. */
export function isBankCashLedgerAccount(account, accountsById) {
    if (!account) return false;
    if (account.isCashEquivalent) return true;
    if (account.seedKey === 'CASH' || account.seedKey === 'BANK') return true;
    let pid = account.parentId ? String(account.parentId) : '';
    const seen = new Set();
    while (pid && !seen.has(pid)) {
        seen.add(pid);
        const parent = accountsById?.get(pid);
        if (!parent) break;
        if (parent.isCashEquivalent) return true;
        if (parent.seedKey === 'CASH' || parent.seedKey === 'BANK') return true;
        pid = parent.parentId ? String(parent.parentId) : '';
    }
    return false;
}

export function accountNormalDebit(accountType) {
    return accountType === 'ASSET' || accountType === 'EXPENSE';
}

export function fmtMoneyPlain(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function fmtMoneySar(v) {
    return `SAR ${fmtMoneyPlain(v)}`;
}

/** Running balance with Dr / Cr suffix (statement style). */
export function fmtBalanceSide(amount, normalDebit = true) {
    const n = Number(amount ?? 0);
    const formatted = fmtMoneySar(Math.abs(n));
    if (Math.abs(n) < 0.005) return formatted;
    const debitSide = normalDebit ? n >= 0 : n < 0;
    return `${formatted} ${debitSide ? 'Dr' : 'Cr'}`;
}

export const LEDGER_ROWS_PER_PAGE = 25;
