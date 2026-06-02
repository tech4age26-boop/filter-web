import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RefreshCw, Eye, Printer, ExternalLink, Search } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import CreditNotePrintView from '../../components/workshop/CreditNotePrintView';
import { branchScopeParams } from '../../services/workshopStaffApi';
import {
    getWorkshopSalesReturns,
    getWorkshopSalesReturn,
} from '../../services/workshopStaffApi';
import { useAuth } from '../../context/AuthContext';
import './Workshop.css';

function statusTone(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return { label: 'Approved', bg: '#ECFDF5', fg: '#047857' };
    if (s === 'pending') return { label: 'Pending', bg: '#FEF3C7', fg: '#92400E' };
    if (s === 'rejected') return { label: 'Rejected', bg: '#FEE2E2', fg: '#B91C1C' };
    return { label: s || '—', bg: '#F3F4F6', fg: '#374151' };
}

function fmtDt(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

export default function WorkshopSalesReturns({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const canView = hasPermission('workshop.sales-returns.view') || hasPermission('workshop.approvals.view');

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [statusFilter, setStatusFilter] = useState('completed');

    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const printRef = useRef(null);

    const branchParams = useMemo(
        () => branchScopeParams(selectedBranchId),
        [selectedBranchId],
    );

    const load = useCallback(async () => {
        if (!canView) {
            setRows([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await getWorkshopSalesReturns({
                ...branchParams,
                status: statusFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                invoiceNo: invoiceNo.trim() || undefined,
                limit: 100,
                offset: 0,
            });
            setRows(Array.isArray(res?.salesReturns) ? res.salesReturns : []);
            setTotal(Number(res?.total) || 0);
        } catch (e) {
            setRows([]);
            setError(e.message || 'Failed to load sales returns.');
        } finally {
            setLoading(false);
        }
    }, [canView, branchParams, statusFilter, dateFrom, dateTo, invoiceNo]);

    useEffect(() => {
        load();
    }, [load]);

    const openDetail = async (row) => {
        setDetail(row);
        setDetailLoading(true);
        try {
            const res = await getWorkshopSalesReturn(row.id, branchParams);
            if (res?.salesReturn) setDetail(res.salesReturn);
        } catch {
            /* keep list row */
        } finally {
            setDetailLoading(false);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><title>Credit Note</title></head><body>${printRef.current.innerHTML}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
    };

    const digitalInvoiceUrl = detail?.invoicePublicToken
        ? `${window.location.origin}/public/pos-invoices/${detail.invoicePublicToken}`
        : null;

    if (!canView) {
        return (
            <div style={{ padding: 32 }}>
                <p>You do not have permission to view sales returns.</p>
            </div>
        );
    }

    return (
        <div className="ws-page" style={{ padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <RotateCcw size={24} />
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Sales Returns</h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Approved returns from POS — filter by date, invoice, branch, and cashier.
                    </p>
                </div>
                <button type="button" className="mc-btn-ghost" onClick={load} disabled={loading}>
                    <RefreshCw size={16} style={{ opacity: loading ? 0.5 : 1 }} /> Refresh
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
                <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>From</label>
                    <input type="datetime-local" className="mc-filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>To</label>
                    <input type="datetime-local" className="mc-filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
                    <select className="mc-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="completed">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                        <option value="">All</option>
                    </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Invoice #</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            className="mc-filter-select"
                            style={{ paddingLeft: 36, width: '100%' }}
                            placeholder="Search invoice number…"
                            value={invoiceNo}
                            onChange={(e) => setInvoiceNo(e.target.value)}
                        />
                    </div>
                </div>
                <button type="button" className="mc-btn-primary" onClick={load}>Apply filters</button>
            </div>

            {error ? <p style={{ color: '#B91C1C', marginBottom: 16 }}>{error}</p> : null}

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px' }}>Date / time</th>
                            <th style={{ padding: '12px 16px' }}>Credit note #</th>
                            <th style={{ padding: '12px 16px' }}>Invoice #</th>
                            <th style={{ padding: '12px 16px' }}>Customer</th>
                            <th style={{ padding: '12px 16px' }}>Vehicle</th>
                            <th style={{ padding: '12px 16px' }}>Cashier</th>
                            <th style={{ padding: '12px 16px' }}>Branch</th>
                            <th style={{ padding: '12px 16px' }}>Type</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <ShimmerTableBodyRows cols={11} rows={8} />
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    No sales returns found for these filters.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const st = statusTone(r.status);
                                return (
                                    <tr key={r.id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{fmtDt(r.returnDate || r.createdAt)}</td>
                                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.creditNoteNo || r.returnNo}</td>
                                        <td style={{ padding: '12px 16px' }}>{r.invoiceNo}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div>{r.customerName || '—'}</div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.customerPhone || ''}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>{r.vehicleNumber || '—'}</td>
                                        <td style={{ padding: '12px 16px' }}>{r.cashier?.name || '—'}</td>
                                        <td style={{ padding: '12px 16px' }}>{r.branchName || '—'}</td>
                                        <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{r.returnScope || '—'}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>SAR {Number(r.totalAmount || 0).toFixed(2)}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg, fontSize: '0.72rem', fontWeight: 800 }}>{st.label}</span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <button type="button" className="mc-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => openDetail(r)}>
                                                <Eye size={14} /> View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {!loading && total > rows.length ? (
                <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Showing {rows.length} of {total}</p>
            ) : null}

            <AnimatePresence>
                {detail ? (
                    <Modal onClose={() => { setDetail(null); setPrintOpen(false); }} title="Sales return detail" width="860px">
                        {detailLoading ? (
                            <p style={{ padding: 24, textAlign: 'center' }}>Loading…</p>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '0.875rem' }}>
                                    <div><strong>Credit note:</strong> {detail.creditNoteNo || detail.returnNo}</div>
                                    <div><strong>Invoice:</strong> {detail.invoiceNo}</div>
                                    <div><strong>Customer:</strong> {detail.customerName} · {detail.customerPhone || '—'}</div>
                                    <div><strong>Vehicle:</strong> {detail.vehicleNumber || '—'}</div>
                                    <div><strong>Cashier:</strong> {detail.cashier?.name || '—'}</div>
                                    <div><strong>Branch:</strong> {detail.branchName}</div>
                                    <div><strong>Return type:</strong> {detail.returnScope === 'full' ? 'Full return' : 'Partial return'}</div>
                                    <div><strong>Date:</strong> {fmtDt(detail.returnDate || detail.createdAt)}</div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', marginBottom: 16 }}>
                                    <thead>
                                        <tr style={{ background: '#F9FAFB' }}>
                                            <th style={{ padding: 10, textAlign: 'left' }}>Product / service</th>
                                            <th style={{ padding: 10, textAlign: 'right' }}>Return qty</th>
                                            <th style={{ padding: 10, textAlign: 'right' }}>Line total</th>
                                            <th style={{ padding: 10, textAlign: 'left' }}>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(detail.items || []).map((it) => (
                                            <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
                                                <td style={{ padding: 10 }}>{it.name}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>{it.qty}{it.originalQty != null ? ` / ${it.originalQty}` : ''}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>SAR {Number(it.lineTotal || 0).toFixed(2)}</td>
                                                <td style={{ padding: 10 }}>{it.reason || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    {digitalInvoiceUrl ? (
                                        <a href={digitalInvoiceUrl} target="_blank" rel="noopener noreferrer" className="mc-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                                            <ExternalLink size={16} /> View digital invoice
                                        </a>
                                    ) : null}
                                    <button type="button" className="mc-btn-primary" onClick={() => setPrintOpen(true)}>
                                        <Printer size={16} /> View credit note / Print
                                    </button>
                                </div>
                            </div>
                        )}
                    </Modal>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {printOpen && detail ? (
                    <Modal onClose={() => setPrintOpen(false)} title="Credit note" width="900px">
                        <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                            <CreditNotePrintView ref={printRef} data={detail} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                            <button type="button" className="mc-btn-ghost" onClick={() => setPrintOpen(false)}>Close</button>
                            <button type="button" className="mc-btn-primary" onClick={handlePrint}>
                                <Printer size={16} /> Print
                            </button>
                        </div>
                    </Modal>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
