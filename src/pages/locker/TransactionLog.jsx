import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowDownLeft, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
    FileSpreadsheet, FileText, RefreshCw, Wallet,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/tableExport';
import { LOCKER_EXPENSE_CATEGORIES } from './lockerExpenseCategories';
import { useLockerPortal } from './useLockerPortal';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const TX_TYPES = [
    'collection',
    'bank_deposit',
    'petty_cash',
    'expense',
    'payment',
    'receipt',
    'advance',
    'salary',
    'coa_adjust',
    'opening_balance',
    'manual_journal',
    'other',
];

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toDatetimeLocalValue(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultDateTimeRange() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return {
        from: toDatetimeLocalValue(start),
        to: toDatetimeLocalValue(end),
    };
}

function localToIso(local) {
    if (!local) return undefined;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

function buildQueryParams(active, { page, limit }) {
    return {
        from: localToIso(active.from),
        to: localToIso(active.to),
        branchId:
            active.branchId && active.branchId !== 'all' ? active.branchId : undefined,
        category:
            active.category && active.category !== 'all' ? active.category : undefined,
        paidTo: active.paidTo && active.paidTo !== 'all' ? active.paidTo : undefined,
        receivedFrom:
            active.receivedFrom && active.receivedFrom !== 'all'
                ? active.receivedFrom
                : undefined,
        type: active.type && active.type !== 'all' ? active.type : undefined,
        page,
        limit,
    };
}

/**
 * Complete locker vault register (IN / OUT) with running balance.
 * `allowHq` is false when the caller is limited to specific branches
 * (HQ-level expenses are outside a branch-scoped admin's view).
 */
function TransactionLog({
    selectedBranchId = 'all',
    branches: layoutBranches = null,
    branchLockedId = null,
    allowHq = true,
} = {}) {
    const { t, money, dateTime, isRtl } = useLockerPortal();
    const dash = t('emdash');
    const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
    const NextIcon = isRtl ? ChevronLeft : ChevronRight;
    const defaults = useMemo(() => defaultDateTimeRange(), []);
    const scopeBranch = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
    const [filters, setFilters] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        category: 'all',
        paidTo: 'all',
        receivedFrom: 'all',
        type: 'all',
        // Keep search text empty so closed field shows selectedLabel and open list shows all options
        branchText: '',
        categoryText: '',
        paidToText: '',
        receivedFromText: '',
        typeText: '',
    });
    const [applied, setApplied] = useState({
        from: defaults.from,
        to: defaults.to,
        branchId: scopeBranch,
        category: 'all',
        paidTo: 'all',
        receivedFrom: 'all',
        type: 'all',
    });
    const [branches, setBranches] = useState([]);
    const [partyOpts, setPartyOpts] = useState({ paidTo: [], receivedFrom: [] });
    const [rows, setRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    const typeLabel = useCallback(
        (r) => (TX_TYPES.includes(r?.type) ? t(`tl.label.${r.type}`) : r?.typeLabel || r?.type || ''),
        [t],
    );

    useEffect(() => {
        const next = branchLockedId || (selectedBranchId !== 'all' ? selectedBranchId : 'all');
        setFilters((f) => ({ ...f, branchId: next, branchText: '' }));
        setApplied((a) => ({ ...a, branchId: next }));
        setPage(1);
    }, [selectedBranchId, branchLockedId]);

    useEffect(() => {
        if (Array.isArray(layoutBranches) && layoutBranches.length) {
            setBranches(layoutBranches);
            return;
        }
        apiFetch('/locker/branches')
            .then((r) => setBranches(Array.isArray(r?.branches) ? r.branches : []))
            .catch(() => setBranches([]));
    }, [layoutBranches]);

    const branchOpts = useMemo(
        () => [
            ...(branchLockedId
                ? []
                : [
                    { id: 'all', label: t('common.allBranches'), searchText: t('common.allBranches') },
                    ...(allowHq
                        ? [{ id: 'hq', label: t('tl.hq'), searchText: `HQ Workshop ${t('tl.hq')}` }]
                        : []),
                ]),
            ...(branches || []).map((b) => ({
                id: String(b.id),
                label: b.name,
                searchText: b.name,
            })),
        ],
        [branches, branchLockedId, allowHq, t],
    );

    const categoryOpts = useMemo(
        () => [
            { id: 'all', label: t('common.allCategories'), searchText: t('common.allCategories') },
            ...LOCKER_EXPENSE_CATEGORIES.map((c) => ({
                id: c,
                label: c,
                searchText: c,
            })),
        ],
        [t],
    );

    const typeOpts = useMemo(
        () => [
            { id: 'all', label: t('tl.allTypes'), searchText: t('tl.allTypes') },
            ...TX_TYPES.map((id) => ({
                id,
                label: t(`tl.type.${id}`),
                searchText: `${id.replace(/_/g, ' ')} ${t(`tl.type.${id}`)}`,
            })),
        ],
        [t],
    );

    const paidToOpts = useMemo(
        () => [
            { id: 'all', label: t('tl.allPaidTo'), searchText: t('tl.allPaidTo') },
            ...(partyOpts.paidTo || []).map((name) => ({
                id: name,
                label: name,
                searchText: name,
            })),
        ],
        [partyOpts.paidTo, t],
    );

    const receivedFromOpts = useMemo(
        () => [
            { id: 'all', label: t('tl.allReceivedFrom'), searchText: t('tl.allReceivedFrom') },
            ...(partyOpts.receivedFrom || []).map((name) => ({
                id: name,
                label: name,
                searchText: name,
            })),
        ],
        [partyOpts.receivedFrom, t],
    );

    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    const load = useCallback(async (active = applied, pageNum = page, size = pageSize) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/vault/transactions${qs(buildQueryParams(active, { page: pageNum, limit: size }))}`,
            );
            setRows(Array.isArray(res?.transactions) ? res.transactions : []);
            setSummary(res?.summary || null);
            setTotal(Number(res?.total || 0));
            setPartyOpts({
                paidTo: res?.filterOptions?.paidTo || [],
                receivedFrom: res?.filterOptions?.receivedFrom || [],
            });
        } catch (e) {
            setError(e?.message || t('tl.loadError'));
            setRows([]);
            setSummary(null);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [applied, page, pageSize, t]);

    useEffect(() => {
        void load(applied, page, pageSize);
    }, [applied, page, pageSize, load]);

    const applyFilters = () => {
        setPage(1);
        setApplied({
            from: filters.from,
            to: filters.to,
            branchId: filters.branchId || 'all',
            category: filters.category || 'all',
            paidTo: filters.paidTo || 'all',
            receivedFrom: filters.receivedFrom || 'all',
            type: filters.type || 'all',
        });
    };

    const resetFilters = () => {
        const d = defaultDateTimeRange();
        const nextBranch = branchLockedId || 'all';
        setFilters({
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            category: 'all',
            paidTo: 'all',
            receivedFrom: 'all',
            type: 'all',
            branchText: '',
            categoryText: '',
            paidToText: '',
            receivedFromText: '',
            typeText: '',
        });
        setPage(1);
        setApplied({
            from: d.from,
            to: d.to,
            branchId: nextBranch,
            category: 'all',
            paidTo: 'all',
            receivedFrom: 'all',
            type: 'all',
        });
    };

    const fetchAllForExport = async () => {
        const batch = 500;
        let pageNum = 1;
        let all = [];
        let reportedTotal = Infinity;
        while (all.length < reportedTotal && pageNum <= 40) {
            const res = await apiFetch(
                `/locker/vault/transactions${qs(
                    buildQueryParams(applied, { page: pageNum, limit: batch }),
                )}`,
            );
            const chunk = Array.isArray(res?.transactions) ? res.transactions : [];
            reportedTotal = Number(res?.total ?? chunk.length);
            all = all.concat(chunk);
            if (!chunk.length || all.length >= reportedTotal) break;
            pageNum += 1;
        }
        return all;
    };

    const exportHeaders = () => [
        t('tl.dateTime'),
        t('tl.type'),
        t('common.branch'),
        t('tl.receivedFrom'),
        t('tl.paidTo'),
        t('common.category'),
        t('common.reference'),
        t('tl.in'),
        t('tl.out'),
        t('tl.running'),
        t('common.description'),
    ];

    const mapExportRows = (list) =>
        (list || []).map((r) => [
            r.at ? dateTime(r.at) : dash,
            typeLabel(r),
            r.branchName || '',
            r.receivedFrom || '',
            r.paidTo || '',
            r.expenseCategory || '',
            r.reference || r.journalEntryNumber || '',
            r.direction === 'IN' ? Number(r.amount || 0) : '',
            r.direction === 'OUT' ? Number(r.amount || 0) : '',
            Number(r.runningBalance || 0),
            r.description || '',
        ]);

    const exportData = async (kind) => {
        setExporting(true);
        setError('');
        try {
            const list = await fetchAllForExport();
            const body = mapExportRows(list);
            const subtitle = t('tl.exportSubtitle', {
                from: applied.from || dash,
                to: applied.to || dash,
                count: list.length,
            });
            if (kind === 'pdf') {
                exportRowsToPdf({
                    title: t('tl.exportTitle'),
                    subtitle,
                    headers: exportHeaders(),
                    rows: body,
                    filenameBase: 'locker-transaction-log',
                });
            } else {
                exportRowsToExcel({
                    sheetName: t('tl.sheet'),
                    headers: exportHeaders(),
                    rows: body,
                    filenameBase: 'locker-transaction-log',
                });
            }
        } catch (e) {
            setError(e?.message || t('tl.errExport'));
        } finally {
            setExporting(false);
        }
    };

    const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const toIdx = Math.min(page * pageSize, total);

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('tl.title')}</h2>
                    <p className="wlk-subtitle">{t('tl.sub')}</p>
                </div>
                <div className="wlk-topbar-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void exportData('pdf')}
                        disabled={loading || exporting || total === 0}
                    >
                        <FileText size={16} /> PDF
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void exportData('excel')}
                        disabled={loading || exporting || total === 0}
                    >
                        <FileSpreadsheet size={16} /> Excel
                    </button>
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void load(applied, page, pageSize)}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                    </button>
                </div>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><ArrowDownLeft size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.in')}</div>
                        <div className="wlk-stat-value">{money(summary?.totalIn)}</div>
                        <div className="wlk-stat-hint">{t('tl.inHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-icon"><ArrowUpRight size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.out')}</div>
                        <div className="wlk-stat-value">{money(summary?.totalOut)}</div>
                        <div className="wlk-stat-hint">{t('tl.outHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat wlk-stat--info">
                    <div className="wlk-stat-icon"><Wallet size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.available')}</div>
                        <div className="wlk-stat-value">{money(summary?.availableBalance)}</div>
                        <div className="wlk-stat-hint">{t('tl.availableHint')}</div>
                    </div>
                </div>
                <div className="wlk-stat">
                    <div className="wlk-stat-icon"><BookOpen size={18} /></div>
                    <div className="wlk-stat-body">
                        <div className="wlk-stat-label">{t('tl.openClose')}</div>
                        <div className="wlk-stat-value" style={{ fontSize: 16 }}>
                            {money(summary?.openingBalance)} {isRtl ? '←' : '→'} {money(summary?.closingBalance)}
                        </div>
                        <div className="wlk-stat-hint">{t('tl.openCloseHint')}</div>
                    </div>
                </div>
            </div>

            <div className="wlk-section">
                <div className="wlk-filter-bar" style={{ margin: '0 0 12px' }}>
                    <div className="wlk-filter-bar__head">
                        <span className="wlk-filter-bar__title">{t('common.filters')}</span>
                        <div className="wlk-filter-bar__actions">
                            <button type="button" className="btn-secondary" onClick={resetFilters} disabled={loading}>
                                {t('common.reset')}
                            </button>
                            <button type="button" className="btn-submit" onClick={applyFilters} disabled={loading}>
                                {t('common.apply')}
                            </button>
                        </div>
                    </div>
                    <div className="wlk-filter-grid">
                        <div className="ws-field">
                            <label>{t('tl.fromDt')}</label>
                            <input
                                type="datetime-local"
                                value={filters.from || ''}
                                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('tl.toDt')}</label>
                            <input
                                type="datetime-local"
                                value={filters.to || ''}
                                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('common.branch')}</label>
                            <SearchableEntityCombobox
                                id="tl-branch"
                                options={branchOpts}
                                value={branchLockedId || filters.branchId || 'all'}
                                displayText={filters.branchText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, branchText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    branchId: opt?.id || 'all',
                                    branchText: '',
                                }))}
                                placeholder={t('common.searchBranches')}
                                entityLabel="branch"
                                maxInitial={40}
                                maxFiltered={60}
                                disabled={Boolean(branchLockedId)}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('tl.type')}</label>
                            <SearchableEntityCombobox
                                id="tl-type"
                                options={typeOpts}
                                value={filters.type || 'all'}
                                displayText={filters.typeText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, typeText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    type: opt?.id || 'all',
                                    typeText: '',
                                }))}
                                placeholder={t('tl.searchTypes')}
                                entityLabel="type"
                                maxInitial={10}
                                maxFiltered={10}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('tl.expenseCategory')}</label>
                            <SearchableEntityCombobox
                                id="tl-category"
                                options={categoryOpts}
                                value={filters.category || 'all'}
                                displayText={filters.categoryText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, categoryText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    category: opt?.id || 'all',
                                    categoryText: '',
                                }))}
                                placeholder={t('common.searchCategories')}
                                entityLabel="category"
                                maxInitial={30}
                                maxFiltered={40}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('tl.paidTo')}</label>
                            <SearchableEntityCombobox
                                id="tl-paid-to"
                                options={paidToOpts}
                                value={filters.paidTo || 'all'}
                                displayText={filters.paidToText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, paidToText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    paidTo: opt?.id || 'all',
                                    paidToText: '',
                                }))}
                                placeholder={t('tl.searchPaidTo')}
                                entityLabel="payee"
                                maxInitial={40}
                                maxFiltered={60}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('tl.receivedFrom')}</label>
                            <SearchableEntityCombobox
                                id="tl-received-from"
                                options={receivedFromOpts}
                                value={filters.receivedFrom || 'all'}
                                displayText={filters.receivedFromText || ''}
                                onDisplayTextChange={(text) => setFilters((f) => ({ ...f, receivedFromText: text }))}
                                onSelect={(opt) => setFilters((f) => ({
                                    ...f,
                                    receivedFrom: opt?.id || 'all',
                                    receivedFromText: '',
                                }))}
                                placeholder={t('tl.searchReceivedFrom')}
                                entityLabel="payer"
                                maxInitial={40}
                                maxFiltered={60}
                            />
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div>
                ) : null}

                <div className="wlk-section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <h3>
                        {t('tl.register')}
                        <span className="wlk-count">{total}</span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                            {t('tl.perPage')}
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPage(1);
                                    setPageSize(Number(e.target.value) || 25);
                                }}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid #d1d5db',
                                    background: '#fff',
                                    fontSize: 13,
                                }}
                            >
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </label>
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                            {total === 0
                                ? t('tl.rangeOf', { from: 0, to: 0, total: 0 })
                                : t('tl.rangeOf', { from: fromIdx, to: toIdx, total })}
                        </span>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            title={t('tl.prevPage')}
                        >
                            <PrevIcon size={16} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 72, textAlign: 'center' }}>
                            {t('tl.page', { page: Math.min(page, totalPages), pages: totalPages })}
                        </span>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            title={t('tl.nextPage')}
                        >
                            <NextIcon size={16} />
                        </button>
                    </div>
                </div>

                <div className="wlk-table-wrap">
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('tl.dateTime')}</th>
                                <th>{t('tl.type')}</th>
                                <th>{t('common.branch')}</th>
                                <th>{t('tl.receivedFrom')}</th>
                                <th>{t('tl.paidTo')}</th>
                                <th>{t('common.category')}</th>
                                <th>{t('common.reference')}</th>
                                <th>{t('tl.in')}</th>
                                <th>{t('tl.out')}</th>
                                <th>{t('tl.running')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>{dateTime(r.at)}</td>
                                    <td>{typeLabel(r)}</td>
                                    <td>{r.branchName || dash}</td>
                                    <td>{r.receivedFrom || dash}</td>
                                    <td>{r.paidTo || dash}</td>
                                    <td>{r.expenseCategory || dash}</td>
                                    <td>
                                        <div style={{ fontSize: 12 }}>
                                            {r.reference || dash}
                                            {r.journalEntryNumber ? (
                                                <div style={{ color: '#64748b' }}>{r.journalEntryNumber}</div>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td style={{ color: r.direction === 'IN' ? '#15803d' : undefined, fontWeight: 600 }}>
                                        {r.direction === 'IN' ? money(r.amount) : dash}
                                    </td>
                                    <td style={{ color: r.direction === 'OUT' ? '#b91c1c' : undefined, fontWeight: 600 }}>
                                        {r.direction === 'OUT' ? money(r.amount) : dash}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{money(r.runningBalance)}</td>
                                </tr>
                            ))}
                            {!loading && !rows.length ? (
                                <tr>
                                    <td colSpan={10}>{t('tl.empty')}</td>
                                </tr>
                            ) : null}
                            {loading ? (
                                <tr>
                                    <td colSpan={10}>{t('common.loading')}</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>

                {total > 0 ? (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: 10,
                            marginTop: 12,
                            flexWrap: 'wrap',
                        }}
                    >
                        <span style={{ fontSize: 13, color: '#64748b' }}>
                            {t('tl.showing', { from: fromIdx, to: toIdx, total })}
                        </span>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <PrevIcon size={16} /> {t('tl.prev')}
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            disabled={loading || page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            {t('tl.next')} <NextIcon size={16} />
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default TransactionLog;
