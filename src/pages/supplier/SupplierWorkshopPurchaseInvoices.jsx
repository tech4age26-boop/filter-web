import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, CheckCircle, X, Eye, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    approveSupplierWorkshopPurchaseInvoice,
    getSupplierWorkshopPurchaseInvoice,
    listSupplierWorkshopPurchaseInvoices,
    rejectSupplierWorkshopPurchaseInvoice,
} from '../../services/supplierApi';
import {
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';

export default function SupplierWorkshopPurchaseInvoices() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [actionId, setActionId] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [viewDetail, setViewDetail] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listSupplierWorkshopPurchaseInvoices({
                limit: 100,
                offset: 0,
                ...(statusFilter ? { status: statusFilter } : {}),
            });
            const list = unwrapWorkshopSupplierPurchaseInvoiceList(res);
            setRows(list.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean));
        } catch (e) {
            setRows([]);
            setError(e.message || 'Failed to load workshop purchase invoices.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const openView = async (r) => {
        setViewRow(r);
        setViewDetail(null);
        setViewLoading(true);
        try {
            const d = await getSupplierWorkshopPurchaseInvoice(r.id);
            setViewDetail(d?.invoice ?? d?.data ?? d);
        } catch {
            setViewDetail(r._raw || r);
        } finally {
            setViewLoading(false);
        }
    };

    const handleApprove = async (id) => {
        setActionId(`ap-${id}`);
        setError('');
        try {
            await approveSupplierWorkshopPurchaseInvoice(id);
            await load();
        } catch (e) {
            setError(e.message || 'Approve failed.');
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectOpen || !rejectReason.trim()) return;
        const id = rejectOpen.id;
        setActionId(`rj-${id}`);
        setError('');
        try {
            await rejectSupplierWorkshopPurchaseInvoice(id, { rejectionReason: rejectReason.trim() });
            setRejectOpen(null);
            setRejectReason('');
            await load();
        } catch (e) {
            setError(e.message || 'Reject failed.');
        } finally {
            setActionId(null);
        }
    };

    const itemsForView = useMemo(() => {
        const inv = viewDetail;
        if (!inv) return [];
        return Array.isArray(inv.items) ? inv.items : Array.isArray(inv.lines) ? inv.lines : [];
    }, [viewDetail]);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Workshop purchases</h2>
                    <p className="ws-page-sub">
                        Invoices workshops send you. Stock updates when you approve (lines with a product).
                    </p>
                </div>
            </div>
            {error && (
                <div
                    style={{
                        marginBottom: 16,
                        color: '#B91C1C',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 10,
                        padding: 12,
                        fontSize: '0.875rem',
                    }}
                >
                    {error}
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            fontSize: '0.875rem',
                            minWidth: 180,
                        }}
                    >
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button type="button" className="btn-portal" onClick={load} disabled={loading}>
                        <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
            </div>
            <div className="ws-section">
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Vendor ref</th>
                                <th>Issue date</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                        <Loader2 className="spin" size={22} style={{ verticalAlign: 'middle' }} /> Loading…
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No workshop purchase invoices
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <strong style={{ color: '#EA580C' }}>{r.invoice_number}</strong>
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            {r.vendor_invoice_ref || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem' }}>{r.date || '—'}</td>
                                        <td>
                                            <strong>SAR {(r.grand_total || 0).toLocaleString()}</strong>
                                        </td>
                                        <td>
                                            <span className={`ws-badge ws-badge--${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'yellow'}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => openView(r)}
                                                    style={{
                                                        padding: 6,
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: '#F3F4F6',
                                                        cursor: 'pointer',
                                                    }}
                                                    title="View"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                {r.status === 'pending' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(r.id)}
                                                            disabled={actionId !== null}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: '#D1FAE5',
                                                                color: '#059669',
                                                                cursor: actionId ? 'not-allowed' : 'pointer',
                                                                opacity: actionId ? 0.6 : 1,
                                                            }}
                                                            title="Approve (apply stock for product lines)"
                                                        >
                                                            <CheckCircle size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setRejectOpen(r);
                                                                setRejectReason('');
                                                            }}
                                                            disabled={actionId !== null}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: '#FEE2E2',
                                                                color: '#DC2626',
                                                                cursor: actionId ? 'not-allowed' : 'pointer',
                                                                opacity: actionId ? 0.6 : 1,
                                                            }}
                                                            title="Reject"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {viewRow && (
                    <Modal title={`Invoice ${viewRow.invoice_number}`} onClose={() => { setViewRow(null); setViewDetail(null); }}>
                        {viewLoading ? (
                            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Loading details…</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
                                    <span>{viewDetail?.status ?? viewRow.status}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Grand total</span>
                                    <strong>SAR {(viewDetail?.grandTotal ?? viewDetail?.grand_total ?? viewRow.grand_total ?? 0).toLocaleString()}</strong>
                                </div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, margin: '12px 0 4px' }}>Lines</p>
                                <table className="ws-table" style={{ fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Unit (ex VAT)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsForView.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} style={{ textAlign: 'center', padding: 16 }}>
                                                    No line items
                                                </td>
                                            </tr>
                                        ) : (
                                            itemsForView.map((line, i) => (
                                                <tr key={line.id ?? i}>
                                                    <td>
                                                        {line.product?.name ??
                                                            line.productName ??
                                                            line.description ??
                                                            line.productId ??
                                                            '—'}
                                                    </td>
                                                    <td>{line.quantity ?? line.qty ?? '—'}</td>
                                                    <td>
                                                        SAR{' '}
                                                        {Number(
                                                            line.unitPriceExVat ??
                                                                line.unit_price_ex_vat ??
                                                                line.unitPrice ??
                                                                0,
                                                        ).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Modal>
                )}
                {rejectOpen && (
                    <Modal
                        title="Reject invoice"
                        onClose={() => { setRejectOpen(null); setRejectReason(''); }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => { setRejectOpen(null); setRejectReason(''); }} disabled={actionId !== null}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-submit"
                                    style={{ background: '#DC2626' }}
                                    disabled={!rejectReason.trim() || actionId !== null}
                                    onClick={handleReject}
                                >
                                    {actionId?.startsWith('rj-') ? 'Rejecting…' : 'Reject'}
                                </button>
                            </div>
                        }
                    >
                        <textarea
                            placeholder="Reason for rejection…"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                        />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
