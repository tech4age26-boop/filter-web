import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, FileText, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import LockerFilterBar from './LockerFilterBar';
import { buildLockerFilterQuery, defaultHistoryDateRange } from './lockerFilterUtils';
import { useLockerPortal } from './useLockerPortal';

const EMPTY_FILTERS = {
    from: '',
    to: '',
    branchId: 'all',
    cashierId: 'all',
};

export default function DifferencesReport({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
} = {}) {
    const { t, money, dateTime, statusLabel } = useLockerPortal();
    const dash = t('emdash');
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [data, setData] = useState(null);
    const [filters, setFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to, branchId: scopeBranch };
    });
    const [appliedFilters, setAppliedFilters] = useState(() => {
        const d = defaultHistoryDateRange();
        return { ...EMPTY_FILTERS, from: d.from, to: d.to, branchId: scopeBranch };
    });
    const [branches, setBranches] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next }));
        setAppliedFilters((f) => ({ ...f, branchId: next }));
    }, [selectedBranchId, branchLockedId]);

    useEffect(() => {
        Promise.all([
            Array.isArray(layoutBranches) && layoutBranches.length
                ? Promise.resolve(layoutBranches)
                : apiFetch('/locker/branches').then((r) => r?.branches || []).catch(() => []),
            apiFetch('/locker/cashiers').then((r) => r?.cashiers || []).catch(() => []),
        ]).then(([b, c]) => {
            setBranches(b);
            setCashiers(c);
        });
    }, [layoutBranches]);

    const load = useCallback(async (activeFilters = appliedFilters) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/financial/analytics${qs(buildLockerFilterQuery(activeFilters))}`,
            );
            setData(res);
        } catch (e) {
            setError(e?.message || t('diff.loadError'));
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, t]);

    useEffect(() => {
        load(appliedFilters);
    }, [appliedFilters, load]);

    const applyFilters = () => setAppliedFilters({ ...filters });
    const resetFilters = () => {
        const d = defaultHistoryDateRange();
        const next = {
            ...EMPTY_FILTERS,
            from: d.from,
            to: d.to,
            branchId: branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all'),
        };
        setFilters(next);
        setAppliedFilters(next);
    };

    const summary = data?.differencesSummary || {};
    const short = Number(data?.totalShort ?? summary.totalShort ?? 0);
    const over = Number(data?.totalOver ?? summary.totalOver ?? 0);
    const net = Number(
        data?.netVariance ?? summary.netDifference ?? summary.netVariance ?? over - short,
    );
    const recent = data?.recentVariances || data?.items || data?.variances || [];

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">{t('diff.title')}</h2>
                    <p className="ws-page-sub">{t('diff.sub')}</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={() => load(appliedFilters)}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

            <LockerFilterBar
                filters={filters}
                onChange={setFilters}
                onApply={applyFilters}
                onReset={resetFilters}
                branches={branches}
                cashiers={cashiers}
                loading={loading}
                branchLockedId={branchLockedId}
            />

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('diff.short')}</p>
                        <p className="ws-kpi-value">{money(short)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--red">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('diff.over')}</p>
                        <p className="ws-kpi-value">{money(over)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <DollarSign size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{t('diff.net')}</p>
                        <p className="ws-kpi-value">{money(net)}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <FileText size={22} />
                    </div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>{t('common.date')}</th>
                            <th>{t('common.branch')}</th>
                            <th>{t('common.cashier')}</th>
                            <th>{t('common.expected')}</th>
                            <th>{t('common.received')}</th>
                            <th>{t('common.difference')}</th>
                            <th>{t('common.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    {t('diff.empty')}
                                </td>
                            </tr>
                        ) : (
                            recent.map((r, idx) => (
                                <tr key={r.id || idx}>
                                    <td>{dateTime(r.date || r.collectedAt)}</td>
                                    <td>{r.branchName || r.branch?.name || dash}</td>
                                    <td>{r.cashierName || dash}</td>
                                    <td>{money(r.expectedAmount)}</td>
                                    <td>{money(r.receivedAmount)}</td>
                                    <td>{money(r.difference)}</td>
                                    <td>
                                        <span className="ws-badge ws-badge--yellow">
                                            {statusLabel(r.status)}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
