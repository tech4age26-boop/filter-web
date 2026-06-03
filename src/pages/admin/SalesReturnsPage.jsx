import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, FileText } from 'lucide-react';
import {
    getSuperAdminSalesReturns,
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
} from '../../services/superAdminApi';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';

const num = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** Normalize backend invoice payload into the shape InvoiceDetailsModal expects. */
function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs) ? invoice.jobs : [];
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

/**
 * Super-admin overview of sales returns originated from the cashier portal.
 * Workshop + Branch filters cascade. Each row links to the underlying invoice.
 */
export default function SalesReturnsPage() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSuperAdminSalesReturns({
                workshopId: selectedWorkshopId || undefined,
                branchId:   selectedBranchId   || undefined,
                limit: 200,
                offset: 0,
            });
            setRows(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setError(e?.message || 'Could not load sales returns');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [selectedWorkshopId, selectedBranchId]);

    useEffect(() => { void load(); }, [load]);

    // Workshop options (load once).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopOptions();
                const list = Array.isArray(res?.workshops)
                    ? res.workshops
                    : Array.isArray(res?.data?.workshops) ? res.data.workshops
                    : Array.isArray(res) ? res : [];
                if (!cancelled) {
                    setWorkshopOptions(list.map((w) => ({
                        id: String(w.id),
                        name: String(w.name || '').trim() || 'Workshop',
                    })));
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Branches for the selected workshop.
    useEffect(() => {
        if (!selectedWorkshopId) {
            setBranchOptions([]);
            setSelectedBranchId('');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getBranches({ workshopId: selectedWorkshopId });
                const list = Array.isArray(res?.branches)
                    ? res.branches
                    : Array.isArray(res?.data?.branches) ? res.data.branches : [];
                if (!cancelled) {
                    setBranchOptions(list.map((b) => ({
                        id: String(b.id),
                        name: String(b.name || '').trim() || 'Branch',
                    })));
                    setSelectedBranchId('');
                }
            } catch {
                if (!cancelled) {
                    setBranchOptions([]);
                    setSelectedBranchId('');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedWorkshopId]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            const hay = [
                r.returnNo,
                r.invoice?.invoiceNo,
                r.workshop?.name,
                r.branch?.name,
                r.reason,
                r.status,
                r.totalAmount,
                r.createdBy?.name,
            ].map((x) => String(x ?? '').toLowerCase()).join(' ');
            return hay.includes(q);
        });
    }, [rows, search]);

    const totalAmount = useMemo(
        () => filtered.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0),
        [filtered],
    );

    const openInvoice = async (invoiceId) => {
        if (!invoiceId) return;
        setInvoiceLoadingId(String(invoiceId));
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            alert(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    const cellTh = {
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#475569',
        textTransform: 'uppercase',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
    };
    const cellTd = { padding: '12px', verticalAlign: 'middle', fontSize: '0.8125rem' };

    return (
        <div style={{ padding: 20 }}>
            <header style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                        Sales Returns
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Returns recorded against invoices from the cashier portal — filtered by workshop &amp; branch.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => load()}
                    disabled={loading}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: loading ? 'wait' : 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                    }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </header>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Workshop</label>
                    <select
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.875rem', background: '#fff', minWidth: 200 }}
                    >
                        <option value="">All workshops</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Branch</label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            background: '#fff',
                            minWidth: 200,
                            opacity: selectedWorkshopId ? 1 : 0.6,
                        }}
                        title={selectedWorkshopId ? '' : 'Select a workshop first'}
                    >
                        <option value="">All branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search return no, invoice, reason…"
                    style={{ flex: 1, minWidth: 240, padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>Returns</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#7f1d1d' }}>{filtered.length}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>Total Returned</div>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#7f1d1d' }}>{num(totalAmount)}</div>
                    </div>
                </div>
            </div>

            {error ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12 }}>
                    {error}
                </div>
            ) : null}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr>
                            <th style={cellTh}>Date</th>
                            <th style={cellTh}>Return No</th>
                            <th style={cellTh}>Invoice</th>
                            <th style={cellTh}>Workshop / Branch</th>
                            <th style={cellTh}>Reason</th>
                            <th style={cellTh}>Status</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Total Returned</th>
                            <th style={{ ...cellTh, textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                <Loader2 size={18} className="spin" /> Loading…
                            </td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                                No sales returns for the selected filters.
                            </td></tr>
                        ) : filtered.map((r) => (
                            <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                                <td style={cellTd}>{formatDate(r.returnDate ?? r.createdAt)}</td>
                                <td style={cellTd}><span style={{ fontWeight: 700, color: '#0f172a' }}>{r.returnNo ?? '—'}</span></td>
                                <td style={cellTd}><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoice?.invoiceNo ?? '—'}</span></td>
                                <td style={cellTd}>
                                    <div>{r.workshop?.name ?? '—'}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.branch?.name ?? '—'}</div>
                                </td>
                                <td style={{ ...cellTd, color: '#475569', fontSize: '0.8rem' }}>
                                    {r.reason ? (r.reason.length > 40 ? `${r.reason.slice(0, 40)}…` : r.reason) : '—'}
                                </td>
                                <td style={{ ...cellTd, textTransform: 'capitalize' }}>{r.status ?? '—'}</td>
                                <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>{num(r.totalAmount)}</td>
                                <td style={{ ...cellTd, textAlign: 'right' }}>
                                    {r.invoice?.id ? (
                                        <button
                                            type="button"
                                            onClick={() => openInvoice(r.invoice.id)}
                                            disabled={invoiceLoadingId === String(r.invoice.id)}
                                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: invoiceLoadingId === String(r.invoice.id) ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                        >
                                            {invoiceLoadingId === String(r.invoice.id) ? <Loader2 size={12} className="spin" /> : <FileText size={12} />} View
                                        </button>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {total > rows.length ? (
                    <div style={{ padding: 10, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                        Showing first {rows.length} of {total}.
                    </div>
                ) : null}
            </div>

            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />
        </div>
    );
}
