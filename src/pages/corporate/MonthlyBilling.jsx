import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Wallet,
    Loader2,
    Eye,
    Download,
    X,
    ChevronLeft,
    ChevronRight,
    Receipt,
    CalendarRange,
    CircleDollarSign,
    Scale,
    CalendarClock,
} from 'lucide-react';
import { apiFetch, BASE_URL } from '../../services/api';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';

const SETTLEMENT_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'partial', label: 'Partially paid' },
    { value: 'paid', label: 'Fully paid' },
];

const MONTHS = [
    { v: 1, label: 'January' },
    { v: 2, label: 'February' },
    { v: 3, label: 'March' },
    { v: 4, label: 'April' },
    { v: 5, label: 'May' },
    { v: 6, label: 'June' },
    { v: 7, label: 'July' },
    { v: 8, label: 'August' },
    { v: 9, label: 'September' },
    { v: 10, label: 'October' },
    { v: 11, label: 'November' },
    { v: 12, label: 'December' },
];

function statusLabel(s) {
    if (s === 'paid') return 'Fully paid';
    if (s === 'partial') return 'Partially paid';
    return 'Unpaid';
}

function badgeClass(s) {
    if (s === 'paid') return 'ws-badge ws-badge--green';
    if (s === 'partial') return 'ws-badge ws-badge--yellow';
    return 'ws-badge ws-badge--gray';
}

/** Read `?month=&year=` from corporate navigation (e.g. from My Bookings after invoice). */
function parseMonthYearFromSearch(sp) {
    const m = parseInt(sp.get('month') || '', 10);
    const y = parseInt(sp.get('year') || '', 10);
    const now = new Date();
    return {
        month: !Number.isNaN(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1,
        year: !Number.isNaN(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear(),
    };
}

function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs) ? srcOrder.jobs : Array.isArray(invoice.jobs) ? invoice.jobs : [];
    return {
        ...invoice,
        order: { ...srcOrder, jobs: srcJobs },
        jobs: srcJobs,
        customer: srcCustomer,
        vehicle: srcVehicle,
        branch: invoice.branch || srcOrder.branch,
        workshop: invoice.workshop || srcOrder.workshop,
        paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
    };
}

export default function MonthlyBilling({ onTabChange, onWalletBalanceChange }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [year, setYear] = useState(() => parseMonthYearFromSearch(searchParams).year);
    const [month, setMonth] = useState(() => parseMonthYearFromSearch(searchParams).month);
    const [settlementFilter, setSettlementFilter] = useState('all');
    const [offset, setOffset] = useState(0);
    const limit = 50;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selected, setSelected] = useState(() => new Set());
    const [singleModal, setSingleModal] = useState(null);
    const [bulkModal, setBulkModal] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [bulkAmounts, setBulkAmounts] = useState({});
    const [paySubmitting, setPaySubmitting] = useState(false);
    const [payError, setPayError] = useState('');

    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [activeInvoice, setActiveInvoice] = useState(null);
    const [invoiceViewLoadingId, setInvoiceViewLoadingId] = useState(null);
    const [invoiceViewError, setInvoiceViewError] = useState('');

    const qs = useMemo(() => {
        const p = new URLSearchParams();
        p.set('year', String(year));
        p.set('month', String(month));
        p.set('settlementStatus', settlementFilter);
        p.set('limit', String(limit));
        p.set('offset', String(offset));
        return p.toString();
    }, [year, month, settlementFilter, offset]);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        apiFetch(`/corporate/billing/monthly-settlement?${qs}`)
            .then((d) => setData(d))
            .catch((e) => setError(e?.message || 'Could not load billing'))
            .finally(() => setLoading(false));
    }, [qs]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const onSocket = () => load();
        window.addEventListener('corporate-portal-billing-refresh', onSocket);
        return () => window.removeEventListener('corporate-portal-billing-refresh', onSocket);
    }, [load]);

    useEffect(() => {
        setOffset(0);
        setSelected(new Set());
    }, [year, month, settlementFilter]);

    useEffect(() => {
        if (searchParams.get('month') == null && searchParams.get('year') == null) return;
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams]);

    const walletBal = data?.walletBalance ?? 0;
    const items = data?.items ?? [];
    const total = data?.total ?? 0;
    const summary = data?.summary;
    const hasNext = offset + items.length < total;

    const toggleRow = (id) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    const toggleAllOnPage = () => {
        const pageIds = items.map((r) => r.id);
        const allOn = pageIds.length && pageIds.every((id) => selected.has(id));
        setSelected((prev) => {
            const n = new Set(prev);
            if (allOn) pageIds.forEach((id) => n.delete(id));
            else pageIds.forEach((id) => n.add(id));
            return n;
        });
    };

    const handleDownload = (id) => {
        const token = localStorage.getItem('filter_auth_token');
        window.open(`${BASE_URL}/corporate/invoices/${id}/download?token=${token}`, '_blank');
    };

    const openInvoiceView = async (row) => {
        setInvoiceViewError('');
        setInvoiceViewLoadingId(row.id);
        try {
            const raw = await apiFetch(`/corporate/invoices/${row.id}/view`);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setActiveInvoice(normalizeInvoiceForModal(inv));
            setInvoiceModalOpen(true);
        } catch (e) {
            setInvoiceViewError(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceViewLoadingId(null);
        }
    };

    const openSinglePay = (row) => {
        if (row.balanceDue <= 0.05) return;
        setPayError('');
        setPayAmount(String(Number(row.balanceDue).toFixed(2)));
        setSingleModal(row);
    };

    const openBulkPay = () => {
        const rows = items.filter((r) => selected.has(r.id) && r.balanceDue > 0.05);
        if (!rows.length) return;
        setPayError('');
        const init = {};
        rows.forEach((r) => {
            init[r.id] = String(Number(r.balanceDue).toFixed(2));
        });
        setBulkAmounts(init);
        setBulkModal(true);
    };

    const bulkTotal = useMemo(() => {
        if (!bulkModal) return 0;
        return Object.values(bulkAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    }, [bulkModal, bulkAmounts]);

    const submitWalletPay = async (itemsPayload) => {
        setPaySubmitting(true);
        setPayError('');
        try {
            await apiFetch('/corporate/billing/wallet-pay', {
                method: 'POST',
                body: JSON.stringify({ items: itemsPayload }),
            });
            onWalletBalanceChange?.();
            setSingleModal(null);
            setBulkModal(false);
            setPayAmount('');
            setBulkAmounts({});
            setSelected(new Set());
            load();
        } catch (e) {
            setPayError(e?.message || 'Payment failed');
        } finally {
            setPaySubmitting(false);
        }
    };

    const confirmSinglePay = () => {
        const amt = parseFloat(payAmount);
        if (!singleModal || !Number.isFinite(amt) || amt <= 0) {
            setPayError('Enter a valid amount');
            return;
        }
        submitWalletPay([{ invoiceId: singleModal.id, amount: amt }]);
    };

    const confirmBulkPay = () => {
        const payload = Object.entries(bulkAmounts).map(([invoiceId, v]) => ({
            invoiceId,
            amount: parseFloat(v),
        }));
        for (const p of payload) {
            if (!Number.isFinite(p.amount) || p.amount <= 0) {
                setPayError('Each selected invoice needs a valid amount');
                return;
            }
        }
        if (payload.reduce((s, p) => s + p.amount, 0) - walletBal > 0.05) {
            setPayError('Total exceeds wallet balance');
            return;
        }
        submitWalletPay(payload);
    };

    const modalBackdrop = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
    };

    const modalCard = {
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 480,
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 24px 48px rgba(15,23,42,0.2)',
    };

    const num = (v) =>
        `SAR ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const statTiles =
        summary && !loading
            ? [
                  {
                      label: 'Billed this month',
                      value: num(summary.totalBilled),
                      icon: Receipt,
                      bg: '#eff6ff',
                      border: '#bfdbfe',
                      iconColor: '#1d4ed8',
                  },
                  {
                      label: 'Paid toward bills',
                      value: num(summary.totalPaid),
                      icon: CircleDollarSign,
                      bg: '#ecfdf5',
                      border: '#a7f3d0',
                      iconColor: '#047857',
                  },
                  {
                      label: 'Outstanding',
                      value: num(summary.outstandingBalance),
                      icon: Scale,
                      bg:
                          Number(summary.outstandingBalance) > 0.05
                              ? '#fff7ed'
                              : '#f8fafc',
                      border:
                          Number(summary.outstandingBalance) > 0.05
                              ? '#fed7aa'
                              : '#e2e8f0',
                      iconColor:
                          Number(summary.outstandingBalance) > 0.05 ? '#c2410c' : '#64748b',
                  },
                  {
                      label: 'Payment due',
                      value: data?.dueDate || '—',
                      icon: CalendarClock,
                      bg: '#f1f5f9',
                      border: '#e2e8f0',
                      iconColor: '#475569',
                      isDate: true,
                  },
              ]
            : [];

    const payEnabled = items.some((r) => selected.has(r.id) && r.balanceDue > 0.05) && !paySubmitting;

    return (
        <div style={{ width: '100%', maxWidth: 'none', margin: 0, paddingBottom: 32 }}>
            <header
                style={{
                    marginBottom: 20,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                }}
            >
                <div style={{ flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span
                            style={{
                                width: 4,
                                height: 28,
                                borderRadius: 4,
                                background: 'linear-gradient(180deg,#0d9488,#115e59)',
                                flexShrink: 0,
                            }}
                        />
                        <h2
                            className="ws-page-title"
                            style={{
                                margin: 0,
                                fontSize: '1.65rem',
                                fontWeight: 800,
                                color: '#0f172a',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Monthly billing
                        </h2>
                    </div>
                    <p
                        className="ws-page-sub"
                        style={{
                            margin: 0,
                            maxWidth: 'min(720px, 100%)',
                            lineHeight: 1.55,
                            color: '#64748b',
                            fontSize: '0.9rem',
                        }}
                    >
                        Review Pay Monthly invoices, filter by settlement status, and settle balances from your
                        corporate wallet.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onTabChange?.('wallet')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#0f172a',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                    }}
                >
                    <Wallet size={18} style={{ color: '#0d9488' }} />
                    Manage wallet
                </button>
            </header>

            <section
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'stretch',
                    gap: 14,
                    marginBottom: 16,
                    padding: '16px 18px',
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <label style={{ display: 'block' }}>
                        <span
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginBottom: 6,
                            }}
                        >
                            <CalendarRange size={13} />
                            Period
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select
                                value={month}
                                onChange={(e) => setMonth(Number(e.target.value))}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid #cbd5e1',
                                    minWidth: 150,
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    color: '#0f172a',
                                    background: '#fff',
                                }}
                            >
                                {MONTHS.map((m) => (
                                    <option key={m.v} value={m.v}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                value={year}
                                min={2020}
                                max={2100}
                                onChange={(e) => setYear(Number(e.target.value) || year)}
                                style={{
                                    width: 88,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid #cbd5e1',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    color: '#0f172a',
                                }}
                            />
                        </div>
                    </label>
                </div>
                <div style={{ flex: 1, minWidth: 12 }} />
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)',
                        border: '1px solid #99f6e4',
                        minWidth: 200,
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(15,118,110,0.12)',
                        }}
                    >
                        <Wallet size={22} style={{ color: '#0f766e' }} />
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: '#0f766e', opacity: 0.9 }}>
                            Available balance
                        </p>
                        <p
                            style={{
                                margin: '2px 0 0',
                                fontSize: '1.2rem',
                                fontWeight: 800,
                                color: '#134e4a',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {num(walletBal)}
                        </p>
                    </div>
                </div>
            </section>

            {statTiles.length > 0 && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: 12,
                        marginBottom: 16,
                    }}
                    className="mb-stat-grid"
                >
                    {statTiles.map((k) => (
                        <div
                            key={k.label}
                            style={{
                                padding: '14px 16px',
                                borderRadius: 12,
                                background: k.bg,
                                border: `1px solid ${k.border}`,
                                minWidth: 0,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                                    }}
                                >
                                    <k.icon size={18} style={{ color: k.iconColor }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: '0.68rem',
                                            color: '#64748b',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.03em',
                                        }}
                                    >
                                        {k.label}
                                    </p>
                                    <p
                                        style={{
                                            margin: '6px 0 0',
                                            fontSize: k.isDate ? '0.95rem' : '1.05rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            fontVariantNumeric: 'tabular-nums',
                                            lineHeight: 1.25,
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {k.value}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#b91c1c',
                        fontSize: '0.875rem',
                    }}
                >
                    {error}
                </div>
            ) : null}

            {invoiceViewError ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#b91c1c',
                        fontSize: '0.875rem',
                    }}
                >
                    {invoiceViewError}
                </div>
            ) : null}

            {loading ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '72px 24px',
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <Loader2 className="spin" size={36} style={{ color: '#0d9488' }} />
                    <p style={{ marginTop: 12, color: '#64748b', fontSize: '0.875rem' }}>Loading invoices…</p>
                </div>
            ) : (
                <div
                    style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid #e2e8f0',
                            background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 12,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <Receipt size={18} style={{ color: '#0d9488', flexShrink: 0 }} />
                                <div>
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                        }}
                                    >
                                        {data?.month || 'Invoices'}
                                    </h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                        {total} invoice{total === 1 ? '' : 's'} · select rows to pay in one go
                                    </p>
                                </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 8 }} />
                            <button
                                type="button"
                                disabled={!payEnabled}
                                onClick={openBulkPay}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '10px 16px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: payEnabled ? 'linear-gradient(135deg,#059669,#047857)' : '#cbd5e1',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    cursor: payEnabled ? 'pointer' : 'not-allowed',
                                    boxShadow: payEnabled ? '0 4px 14px rgba(5,150,105,0.35)' : 'none',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Wallet size={16} />
                                Pay selected
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            {SETTLEMENT_FILTERS.map((f) => {
                                const active = settlementFilter === f.value;
                                const count =
                                    f.value === 'paid'
                                        ? summary?.countPaid
                                        : f.value === 'partial'
                                          ? summary?.countPartial
                                          : f.value === 'unpaid'
                                            ? summary?.countUnpaid
                                            : null;
                                return (
                                    <button
                                        key={f.value}
                                        type="button"
                                        onClick={() => setSettlementFilter(f.value)}
                                        style={{
                                            padding: '7px 12px',
                                            borderRadius: 8,
                                            border: active ? '1px solid #0d9488' : '1px solid #e2e8f0',
                                            background: active ? '#f0fdfa' : '#fff',
                                            color: active ? '#115e59' : '#475569',
                                            fontWeight: 600,
                                            fontSize: '0.78rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {f.label}
                                        {f.value !== 'all' && summary != null && count != null ? (
                                            <span style={{ opacity: 0.85, marginLeft: 4 }}>({count})</span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {items.length === 0 ? (
                        <p
                            style={{
                                textAlign: 'center',
                                padding: '48px 20px',
                                color: '#64748b',
                                margin: 0,
                                fontSize: '0.875rem',
                            }}
                        >
                            No invoices match this period and filter.
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table
                                style={{
                                    width: '100%',
                                    minWidth: 640,
                                    borderCollapse: 'collapse',
                                    fontSize: '0.8125rem',
                                    tableLayout: 'fixed',
                                }}
                            >
                                <colgroup>
                                    <col style={{ width: 40 }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '16%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '14%' }} />
                                    <col style={{ width: 88 }} />
                                </colgroup>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>
                                            <input
                                                type="checkbox"
                                                aria-label="Select all on page"
                                                checked={
                                                    items.length > 0 && items.every((r) => selected.has(r.id))
                                                }
                                                onChange={toggleAllOnPage}
                                            />
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'left',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Invoice
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'left',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Date
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'left',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Vehicle
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Total
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Paid
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Due
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'left',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Status
                                        </th>
                                        <th
                                            style={{
                                                padding: '10px 12px',
                                                textAlign: 'right',
                                                fontWeight: 700,
                                                color: '#475569',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((row) => (
                                        <tr
                                            key={row.id}
                                            style={{
                                                borderBottom: '1px solid #f1f5f9',
                                                cursor: row.balanceDue > 0.05 ? 'pointer' : 'default',
                                                transition: 'background 0.12s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#fafafa';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                            onClick={() => openSinglePay(row)}
                                        >
                                            <td
                                                style={{ padding: '10px 12px', verticalAlign: 'middle' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(row.id)}
                                                    onChange={() => toggleRow(row.id)}
                                                    aria-label={`Select invoice ${row.invoiceNo}`}
                                                />
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    fontWeight: 700,
                                                    color: '#0f172a',
                                                    verticalAlign: 'middle',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {row.invoiceNo}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    color: '#64748b',
                                                    verticalAlign: 'middle',
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {row.date}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    verticalAlign: 'middle',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {row.vehicle}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    textAlign: 'right',
                                                    fontWeight: 600,
                                                    verticalAlign: 'middle',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    color: '#0f172a',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                {num(row.totalAmount)}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    textAlign: 'right',
                                                    color: '#047857',
                                                    fontWeight: 600,
                                                    verticalAlign: 'middle',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                {num(row.amountPaid)}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    textAlign: 'right',
                                                    fontWeight: 700,
                                                    verticalAlign: 'middle',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    color: '#0f172a',
                                                    fontSize: '0.78rem',
                                                }}
                                            >
                                                {num(row.balanceDue)}
                                            </td>
                                            <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                                                <span className={badgeClass(row.settlementStatus)}>
                                                    {statusLabel(row.settlementStatus)}
                                                </span>
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 8px',
                                                    textAlign: 'right',
                                                    verticalAlign: 'middle',
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    title="View invoice"
                                                    disabled={invoiceViewLoadingId === row.id}
                                                    style={{
                                                        padding: '8px 10px',
                                                        background: '#eff6ff',
                                                        border: '1px solid #bfdbfe',
                                                        borderRadius: 8,
                                                        cursor:
                                                            invoiceViewLoadingId === row.id
                                                                ? 'wait'
                                                                : 'pointer',
                                                        color: '#1d4ed8',
                                                        marginRight: 6,
                                                        opacity: invoiceViewLoadingId === row.id ? 0.65 : 1,
                                                    }}
                                                    onClick={() => openInvoiceView(row)}
                                                >
                                                    {invoiceViewLoadingId === row.id ? (
                                                        <Loader2 size={15} className="spin" />
                                                    ) : (
                                                        <Eye size={15} />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Download PDF"
                                                    style={{
                                                        padding: '8px 10px',
                                                        background: '#ecfdf5',
                                                        border: '1px solid #a7f3d0',
                                                        borderRadius: 8,
                                                        cursor: 'pointer',
                                                        color: '#047857',
                                                    }}
                                                    onClick={() => handleDownload(row.id)}
                                                >
                                                    <Download size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {total > limit ? (
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 16px',
                                borderTop: '1px solid #e2e8f0',
                                background: '#fafafa',
                            }}
                        >
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={offset === 0}
                                onClick={() => setOffset((o) => Math.max(0, o - limit))}
                            >
                                <ChevronLeft size={16} /> Prev
                            </button>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {offset + 1}–{offset + items.length} of {total}
                            </span>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={!hasNext}
                                onClick={() => setOffset((o) => o + limit)}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : null}
                </div>
            )}

            <style>{`
                @media (max-width: 900px) {
                    .mb-stat-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }
                }
                @media (max-width: 520px) {
                    .mb-stat-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>

            {singleModal ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mb-single-title"
                    style={modalBackdrop}
                    onClick={() => !paySubmitting && setSingleModal(null)}
                >
                    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                padding: '20px 22px 0',
                            }}
                        >
                            <div>
                                <p
                                    id="mb-single-title"
                                    style={{
                                        margin: 0,
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: '#64748b',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Pay from wallet
                                </p>
                                <h3 style={{ margin: '6px 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                                    {singleModal.invoiceNo}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                                    {singleModal.date} · {singleModal.vehicle}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                disabled={paySubmitting}
                                onClick={() => setSingleModal(null)}
                                style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    borderRadius: 10,
                                    padding: 8,
                                    cursor: paySubmitting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '18px 22px' }}>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 12,
                                    marginBottom: 18,
                                }}
                            >
                                <div
                                    style={{
                                        padding: 14,
                                        borderRadius: 12,
                                        background: '#f0fdfa',
                                        border: '1px solid #99f6e4',
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#0f766e', fontWeight: 600 }}>
                                        Wallet balance
                                    </p>
                                    <p
                                        style={{
                                            margin: '6px 0 0',
                                            fontSize: '1.15rem',
                                            fontWeight: 800,
                                            color: '#134e4a',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        SAR {Number(walletBal).toFixed(2)}
                                    </p>
                                </div>
                                <div
                                    style={{
                                        padding: 14,
                                        borderRadius: 12,
                                        background: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#1e40af', fontWeight: 600 }}>
                                        Balance due
                                    </p>
                                    <p
                                        style={{
                                            margin: '6px 0 0',
                                            fontSize: '1.15rem',
                                            fontWeight: 800,
                                            color: '#1e3a8a',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        SAR {Number(singleModal.balanceDue).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <label
                                htmlFor="mb-pay-amt"
                                style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}
                            >
                                Amount to pay (SAR)
                            </label>
                            <input
                                id="mb-pay-amt"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={Math.min(walletBal, singleModal.balanceDue)}
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                disabled={paySubmitting}
                                style={{
                                    width: '100%',
                                    marginTop: 6,
                                    marginBottom: 10,
                                    padding: '12px 14px',
                                    borderRadius: 10,
                                    border: '1px solid #cbd5e1',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                }}
                            />
                            <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#64748b' }}>
                                Paying the full balance due marks this invoice as fully paid; otherwise it will show as
                                partially paid.
                            </p>
                            {payError ? (
                                <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginBottom: 10 }}>{payError}</p>
                            ) : null}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={paySubmitting}
                                    onClick={() => setSingleModal(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    disabled={paySubmitting}
                                    onClick={confirmSinglePay}
                                    style={{ background: '#059669', border: 'none', minWidth: 120 }}
                                >
                                    {paySubmitting ? 'Processing…' : 'Confirm payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {bulkModal ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mb-bulk-title"
                    style={modalBackdrop}
                    onClick={() => !paySubmitting && setBulkModal(false)}
                >
                    <div
                        style={{ ...modalCard, maxWidth: 560 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                padding: '20px 22px 0',
                            }}
                        >
                            <div>
                                <p
                                    id="mb-bulk-title"
                                    style={{
                                        margin: 0,
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: '#64748b',
                                        letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Pay multiple from wallet
                                </p>
                                <h3 style={{ margin: '6px 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                                    Selected invoices
                                </h3>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                disabled={paySubmitting}
                                onClick={() => setBulkModal(false)}
                                style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    borderRadius: 10,
                                    padding: 8,
                                    cursor: paySubmitting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '14px 22px 20px' }}>
                            <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#64748b' }}>
                                Wallet: <strong>SAR {Number(walletBal).toFixed(2)}</strong> · Total to pay:{' '}
                                <strong>SAR {bulkTotal.toFixed(2)}</strong>
                            </p>
                            <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 14 }}>
                                {Object.keys(bulkAmounts).map((id) => {
                                    const row = items.find((r) => r.id === id);
                                    if (!row) return null;
                                    return (
                                        <div
                                            key={id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 120px',
                                                gap: 10,
                                                alignItems: 'center',
                                                padding: '10px 0',
                                                borderBottom: '1px solid #f1f5f9',
                                            }}
                                        >
                                            <div>
                                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>
                                                    {row.invoiceNo}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                                                    Due SAR {Number(row.balanceDue).toFixed(2)}
                                                </p>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={bulkAmounts[id]}
                                                onChange={(e) =>
                                                    setBulkAmounts((m) => ({ ...m, [id]: e.target.value }))
                                                }
                                                disabled={paySubmitting}
                                                style={{
                                                    padding: '8px 10px',
                                                    borderRadius: 8,
                                                    border: '1px solid #cbd5e1',
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            {payError ? (
                                <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginBottom: 10 }}>{payError}</p>
                            ) : null}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={paySubmitting}
                                    onClick={() => setBulkModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    disabled={paySubmitting || bulkTotal <= 0 || bulkTotal - walletBal > 0.05}
                                    onClick={confirmBulkPay}
                                    style={{ background: '#059669', border: 'none', minWidth: 120 }}
                                >
                                    {paySubmitting ? 'Processing…' : 'Pay all'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <InvoiceDetailsModal
                invoice={activeInvoice}
                isOpen={invoiceModalOpen && !!activeInvoice}
                onClose={() => {
                    setInvoiceModalOpen(false);
                    setActiveInvoice(null);
                }}
                onDownload={
                    activeInvoice?.id
                        ? () => handleDownload(String(activeInvoice.id))
                        : undefined
                }
            />
        </div>
    );
}
