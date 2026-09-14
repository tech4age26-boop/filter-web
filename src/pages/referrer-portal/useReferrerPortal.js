import { useOutletContext } from 'react-router-dom';

export function useReferrerPortal() {
    return (
        useOutletContext() || {
            locale: 'en',
            setLocale: () => {},
            displayName: '',
            overview: null,
            overviewError: '',
            overviewLoading: false,
            reloadOverview: () => {},
            isCommunity: false,
        }
    );
}

export function isCommunityReferrer(overview) {
    return Boolean(overview?.profile?.isCommunity);
}

export function formatRuleValue(rule, kind = 'commission') {
    if (!rule) return '';
    const type = kind === 'benefit' ? rule.discountType : rule.commissionType;
    const value = kind === 'benefit' ? rule.discountValue : rule.value;
    const n = Number(value);
    const amount = Number.isFinite(n) ? n : 0;
    if (String(type || '').toLowerCase().includes('fix')) {
        return `${amount.toFixed(2)} SAR`;
    }
    return `${amount}%`;
}

export function rfBadgeClass(status) {
    return `rf-badge rf-badge-${String(status || '').toLowerCase()}`;
}
