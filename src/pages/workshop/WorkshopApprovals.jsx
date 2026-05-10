import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, CheckCircle, X, Eye, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';

/** Petty-cash / approval request kinds → fixed UI buckets */
function requestKindKey(row) {
    return String(row?.kind ?? row?.type ?? '')
        .trim()
        .toLowerCase();
}

function isSupplierSalesInvoiceRow(row) {
    return row?._source === 'supplier_sales_invoice';
}

function isTopUpRequest(row) {
    if (isSupplierSalesInvoiceRow(row)) return false;
    const k = requestKindKey(row);
    return k === 'fund_request' || k === 'fund' || k === 'top_up' || k === 'topup' || k === 'reload';
}

function isExpenseRequest(row) {
    if (isSupplierSalesInvoiceRow(row)) return false;
    const k = requestKindKey(row);
    return k === 'expense' || k === 'expenses';
}

function formatRequestKindLabel(row) {
    if (isSupplierSalesInvoiceRow(row)) return 'Supplier invoice';
    const kind = row?.kind ?? row?.type;
    const k = String(kind || '')
        .trim()
        .toLowerCase();
    if (isTopUpRequest({ kind })) return 'Top up';
    if (isExpenseRequest({ kind })) return 'Expense';
    if (!kind) return '—';
    return String(kind).replace(/_/g, ' ');
}

function rowMatchesBranch(row, branchId, branchName = '') {
    if (branchId == null || branchId === '' || branchId === 'all') return true;
    const bid = String(branchId);
    const direct = row?.branchId ?? row?.branch_id;
    if (direct != null && String(direct) === bid) return true;
    const nested = row?.branch?.id;
    if (nested != null && String(nested) === bid) return true;
    if (branchName && String(row.branchName ?? row.branch_name ?? '').trim() === branchName) return true;
    return false;
}

/** Map UI queue filter → petty-cash API (queue + status). */
function pettyCashListQuery(queueFilter, branchSelected) {
    const branch = branchScopeParams(branchSelected);
    const base = { limit: 100, offset: 0, queue: 'all', ...branch };
    if (queueFilter === 'pending') return { ...base, status: 'pending' };
    if (queueFilter === 'approved') return { ...base, status: 'approved' };
    if (queueFilter === 'rejected') return { ...base, status: 'rejected' };
    return base;
}

export default function WorkshopApprovals({ selectedBranchId = 'all', branches = [] }) {
    const scopeBranchName = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return '';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || '';
    }, [branches, selectedBranchId]);
    const [approvals, setApprovals] = useState([]);
    /** all | topup | expenses | supplier_invoices */
    const [requestTypeFilter, setRequestTypeFilter] = useState('all');
    const [queueFilter, setQueueFilter] = useState('all');
    const [rejectDialog, setRejectDialog] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [viewDialog, setViewDialog] = useState(null);
    const [viewInvoiceDetail, setViewInvoiceDetail] = useState(null);
    const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
    const [currency, setCurrency] = useState('SAR');
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const loadApprovals = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const pettyQs = pettyCashListQuery(queueFilter, selectedBranchId);
            const loadSupplierInvoices =
                queueFilter === 'all' || queueFilter === 'pending';

            const [response, siRes] = await Promise.all([
                apiFetch(`/workshop-staff/petty-cash/requests${qs(pettyQs)}`),
                loadSupplierInvoices
                    ? apiFetch(
                          `/workshop-staff/supplier-sales-invoices${qs({
                              limit: 100,
                              offset: 0,
                              ...branchScopeParams(selectedBranchId),
                          })}`,
                      ).catch(() => null)
                    : Promise.resolve(null),
            ]);

            if (!(response?.success && Array.isArray(response.requests))) {
                throw new Error('Invalid approvals response.');
            }
            let list = response.requests;
            if (selectedBranchId && selectedBranchId !== 'all') {
                const anyHasBranch = list.some(
                    (a) =>
                        a.branchId != null ||
                        a.branch_id != null ||
                        a.branch?.id != null ||
                        (a.branchName ?? a.branch_name ?? '').toString().trim() !== '',
                );
                if (anyHasBranch) {
                    list = list.filter((a) => rowMatchesBranch(a, selectedBranchId, scopeBranchName));
                }
            }

            const siList = Array.isArray(siRes?.invoices) ? siRes.invoices : [];
            const siCurrency = siRes?.currency || response.currency || 'SAR';
            const supplierRows = siList.map((inv) => ({
                id: `supplier-invoice-${inv.id}`,
                _source: 'supplier_sales_invoice',
                supplierInvoiceId: inv.id,
                workshopReviewStatus: inv.workshopReviewStatus ?? 'pending',
                kind: 'supplier_invoice',
                amount: Number(inv.outstanding ?? inv.grandTotal ?? 0),
                grandTotal: Number(inv.grandTotal ?? 0),
                paid: Number(inv.paid ?? 0),
                outstanding: Number(inv.outstanding ?? 0),
                invoiceNo: inv.invoiceNo,
                productLabel: inv.productLabel,
                status: inv.status,
                requestedAt: inv.createdAt || inv.invoiceDate,
                invoiceDate: inv.invoiceDate,
                dueDate: inv.dueDate,
                supplier: inv.supplier ? { name: inv.supplier.name, id: inv.supplier.id } : null,
                branch: inv.branch || null,
                branchId: inv.branch?.id,
                reason: inv.productLabel ? `Lines: ${inv.productLabel}` : null,
            }));

            const merged = [...supplierRows, ...list].sort((a, b) => {
                const ta = new Date(a.requestedAt || a.createdAt || 0).getTime();
                const tb = new Date(b.requestedAt || b.createdAt || 0).getTime();
                return tb - ta;
            });

            setApprovals(merged);
            setCurrency(siCurrency || response.currency || 'SAR');
        } catch (error) {
            setApprovals([]);
            setLoadError(error.message || 'Failed to load approvals queue.');
        } finally {
            setIsLoading(false);
        }
    }, [queueFilter, selectedBranchId, scopeBranchName]);

    useEffect(() => {
        loadApprovals();
    }, [loadApprovals]);

    useEffect(() => {
        if (!viewDialog || !isSupplierSalesInvoiceRow(viewDialog)) {
            setViewInvoiceDetail(null);
            setViewInvoiceLoading(false);
            return;
        }
        const id = viewDialog.supplierInvoiceId;
        if (!id) return;
        let cancelled = false;
        setViewInvoiceLoading(true);
        setViewInvoiceDetail(null);
        (async () => {
            try {
                const res = await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(id))}`);
                if (!cancelled && res?.success && res.invoice) setViewInvoiceDetail(res.invoice);
            } catch {
                if (!cancelled) setViewInvoiceDetail(null);
            } finally {
                if (!cancelled) setViewInvoiceLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [viewDialog]);

    const filtered = useMemo(() => {
        return approvals.filter((a) => {
            if (requestTypeFilter === 'all') return true;
            if (requestTypeFilter === 'topup') return isTopUpRequest(a);
            if (requestTypeFilter === 'expenses') return isExpenseRequest(a);
            if (requestTypeFilter === 'supplier_invoices') return isSupplierSalesInvoiceRow(a);
            return true;
        });
    }, [approvals, requestTypeFilter]);
    const typeColors = {
        expense: 'ws-badge--yellow',
        fund_request: 'ws-badge--blue',
        payment: 'ws-badge--green',
        advance: 'ws-badge--purple',
        purchase: 'ws-badge--purple',
        supplier_invoice: 'ws-badge--purple',
    };
    const statusColors = { pending: 'ws-badge--yellow', approved: 'ws-badge--green', rejected: 'ws-badge--red' };

    const supplierRowCanAct = (row) =>
        isSupplierSalesInvoiceRow(row) &&
        (row.workshopReviewStatus === 'pending' || row.workshopReviewStatus == null);

    const handleApproveRow = async (row) => {
        setLoadError('');
        if (isSupplierSalesInvoiceRow(row)) {
            if (!supplierRowCanAct(row)) return;
            const sid = row.supplierInvoiceId;
            setActionLoadingId(`approve-si-${sid}`);
            try {
                await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approve`, {
                    method: 'POST',
                });
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
            } catch (error) {
                setLoadError(error.message || 'Failed to approve supplier invoice.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        const id = row.id;
        if (row.status !== 'pending') return;
        setActionLoadingId(`approve-${id}`);
        try {
            await apiFetch(`/workshop-staff/petty-cash/${id}/approve`, { method: 'POST' });
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setLoadError(error.message || 'Failed to approve request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectReason.trim() || !rejectDialog) return;
        setLoadError('');
        if (isSupplierSalesInvoiceRow(rejectDialog)) {
            if (!supplierRowCanAct(rejectDialog)) return;
            const sid = rejectDialog.supplierInvoiceId;
            setActionLoadingId(`reject-si-${sid}`);
            try {
                await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
                });
                setRejectDialog(null);
                setRejectReason('');
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
            } catch (error) {
                setLoadError(error.message || 'Failed to reject supplier invoice.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }
        const id = rejectDialog.id;
        setActionLoadingId(`reject-${id}`);
        try {
            await apiFetch(`/workshop-staff/petty-cash/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
            });
            setRejectDialog(null);
            setRejectReason('');
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setLoadError(error.message || 'Failed to reject request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');
    const formatDateFull = (d) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Approvals Queue</h2>
                    <p className="ws-page-sub">
                        Review and act on pending requests
                        {selectedBranchId && selectedBranchId !== 'all' ? (
                            <>
                                {' · '}
                                <strong>
                                    {branches.find((b) => String(b.id) === String(selectedBranchId))?.name ||
                                        `Branch ${selectedBranchId}`}
                                </strong>
                            </>
                        ) : (
                            ' · All branches'
                        )}
                    </p>
                </div>
            </div>
            {loadError && (
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
                    {loadError}
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={queueFilter}
                        onChange={(e) => setQueueFilter(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            fontSize: '0.875rem',
                            minWidth: 160,
                        }}
                    >
                        <option value="all">All Queue</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select
                        value={requestTypeFilter}
                        onChange={(e) => setRequestTypeFilter(e.target.value)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            fontSize: '0.875rem',
                            minWidth: 180,
                        }}
                        aria-label="Request type"
                    >
                        <option value="all">All types</option>
                        <option value="topup">Top up</option>
                        <option value="expenses">Expenses</option>
                        <option value="supplier_invoices">Supplier invoices</option>
                    </select>
                    <button className="btn-portal" onClick={loadApprovals} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <div
                        style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '0.875rem',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        <Clock size={16} />
                        {filtered.length} requests
                    </div>
                </div>
            </div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Requested By</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                    {isLoading ? 'Loading approvals...' : 'No approvals found'}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((a) => {
                                const isSupplier = isSupplierSalesInvoiceRow(a);
                                const kindKey = isSupplier ? 'supplier_invoice' : requestKindKey(a);
                                const pettyPending = !isSupplier && a.status === 'pending';
                                const canApproveReject =
                                    (isSupplier && supplierRowCanAct(a)) ||
                                    (!isSupplier && pettyPending);
                                return (
                                    <tr key={a.id}>
                                        <td>
                                            <span className={`ws-badge ${typeColors[kindKey] || 'ws-badge--gray'}`}>
                                                {formatRequestKindLabel(a)}
                                            </span>
                                            {isSupplier && a.invoiceNo ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {a.invoiceNo}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>
                                            <strong>
                                                {currency} {(a.amount || 0).toLocaleString()}
                                            </strong>
                                            {isSupplier && a.outstanding != null && a.grandTotal != null ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    Outstanding · {currency} {Number(a.outstanding).toLocaleString()} of{' '}
                                                    {Number(a.grandTotal).toLocaleString()}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td>
                                            {isSupplier
                                                ? a.supplier?.name || 'Supplier'
                                                : a.cashier?.name || a.employee?.name || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                            {formatDate(a.requestedAt)}
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${statusColors[a.status] || 'ws-badge--gray'}`}>
                                                {a.status || 'unknown'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleApproveRow(a)}
                                                    disabled={!canApproveReject || actionLoadingId !== null}
                                                    style={{
                                                        padding: 6,
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: '#D1FAE5',
                                                        color: '#059669',
                                                        cursor:
                                                            canApproveReject && actionLoadingId === null
                                                                ? 'pointer'
                                                                : 'not-allowed',
                                                        opacity:
                                                            canApproveReject && actionLoadingId === null ? 1 : 0.45,
                                                    }}
                                                    title={isSupplier ? 'Accept invoice (workshop)' : 'Approve'}
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRejectDialog(a);
                                                        setRejectReason('');
                                                    }}
                                                    disabled={!canApproveReject || actionLoadingId !== null}
                                                    style={{
                                                        padding: 6,
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: '#FEE2E2',
                                                        color: '#DC2626',
                                                        cursor:
                                                            canApproveReject && actionLoadingId === null
                                                                ? 'pointer'
                                                                : 'not-allowed',
                                                        opacity:
                                                            canApproveReject && actionLoadingId === null ? 1 : 0.45,
                                                    }}
                                                    title={isSupplier ? 'Reject supplier invoice' : 'Reject'}
                                                >
                                                    <X size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewDialog(a)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--color-border)',
                                                        background: '#F9FAFB',
                                                        color: '#374151',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8125rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                >
                                                    <Eye size={14} /> Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {rejectDialog && (
                    <Modal
                        title={
                            isSupplierSalesInvoiceRow(rejectDialog)
                                ? 'Reject supplier invoice'
                                : 'Reject approval'
                        }
                        onClose={() => {
                            setRejectDialog(null);
                            setRejectReason('');
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setRejectDialog(null);
                                        setRejectReason('');
                                    }}
                                    disabled={actionLoadingId !== null}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-submit"
                                    style={{ background: '#DC2626' }}
                                    disabled={!rejectReason.trim() || actionLoadingId !== null}
                                    onClick={handleRejectSubmit}
                                >
                                    {actionLoadingId != null && String(actionLoadingId).startsWith('reject-')
                                        ? 'Rejecting...'
                                        : 'Reject'}
                                </button>
                            </div>
                        }
                    >
                        <textarea
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: 12,
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                fontSize: '0.875rem',
                                resize: 'vertical',
                            }}
                        />
                    </Modal>
                )}
                {viewDialog && (
                    <Modal title="Approval Details" onClose={() => setViewDialog(null)}>
                        {isSupplierSalesInvoiceRow(viewDialog) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                                {viewInvoiceLoading ? (
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading invoice…</p>
                                ) : viewInvoiceDetail ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Invoice</span>
                                            <span>{viewInvoiceDetail.invoiceNo}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Supplier</span>
                                            <span>{viewInvoiceDetail.supplier?.name || '—'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Branch</span>
                                            <span>{viewInvoiceDetail.branch?.name || '—'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Status</span>
                                            <span>{viewInvoiceDetail.status}</span>
                                        </div>
                                        {viewInvoiceDetail.workshopReviewStatus != null && viewInvoiceDetail.workshopReviewStatus !== '' ? (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--color-text-muted)' }}>Workshop review</span>
                                                <span>{viewInvoiceDetail.workshopReviewStatus}</span>
                                            </div>
                                        ) : null}
                                        {viewInvoiceDetail.workshopRejectionReason ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ color: 'var(--color-text-muted)' }}>Workshop rejection reason</span>
                                                <span style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                                                    {viewInvoiceDetail.workshopRejectionReason}
                                                </span>
                                            </div>
                                        ) : null}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Issue / Due</span>
                                            <span>
                                                {viewInvoiceDetail.invoiceDate} → {viewInvoiceDetail.dueDate}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Subtotal / VAT</span>
                                            <span>
                                                {currency} {Number(viewInvoiceDetail.subtotal || 0).toLocaleString()} · VAT{' '}
                                                {currency} {Number(viewInvoiceDetail.vatAmount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Grand total</span>
                                            <strong>
                                                {currency} {Number(viewInvoiceDetail.grandTotal || 0).toLocaleString()}
                                            </strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--color-text-muted)' }}>Paid / Outstanding</span>
                                            <span>
                                                {currency} {Number(viewInvoiceDetail.paid || 0).toLocaleString()} ·{' '}
                                                <strong>{currency} {Number(viewInvoiceDetail.outstanding || 0).toLocaleString()}</strong>
                                            </span>
                                        </div>
                                        {viewInvoiceDetail.internalNotes ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ color: 'var(--color-text-muted)' }}>Notes</span>
                                                <span style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                                                    {viewInvoiceDetail.internalNotes}
                                                </span>
                                            </div>
                                        ) : null}
                                        {Array.isArray(viewInvoiceDetail.items) && viewInvoiceDetail.items.length > 0 ? (
                                            <div style={{ marginTop: 8 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Line items</div>
                                                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                                                    <table className="ws-table" style={{ fontSize: '0.8125rem' }}>
                                                        <thead>
                                                            <tr>
                                                                <th>Product</th>
                                                                <th>Qty</th>
                                                                <th>Unit</th>
                                                                <th>Line</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {viewInvoiceDetail.items.map((it) => (
                                                                <tr key={it.id}>
                                                                    <td>{it.productName}</td>
                                                                    <td>{Number(it.qty).toLocaleString()}</td>
                                                                    <td>
                                                                        {currency} {Number(it.unitPrice).toLocaleString()}
                                                                    </td>
                                                                    <td>
                                                                        {currency} {Number(it.lineTotal).toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    <p style={{ color: 'var(--color-text-muted)' }}>Could not load invoice details.</p>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Type</span>
                                    <span className="capitalize">{formatRequestKindLabel(viewDialog)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Amount</span>
                                    <strong>
                                        {currency} {(viewDialog.amount || 0).toLocaleString()}
                                    </strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Requested by</span>
                                    <span>{viewDialog.cashier?.name || viewDialog.employee?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Category</span>
                                    <span>{viewDialog.category?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Branch</span>
                                    <span>{viewDialog.branch?.name || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Reason</span>
                                    <span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.reason || '—'}</span>
                                </div>
                                {viewDialog.requestedAt && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Requested at</span>
                                        <span>{formatDateFull(viewDialog.requestedAt)}</span>
                                    </div>
                                )}
                                {viewDialog.approvedAt && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Approved at</span>
                                        <span>{formatDateFull(viewDialog.approvedAt)}</span>
                                    </div>
                                )}
                                {viewDialog.rejectionReason && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--color-text-muted)' }}>Rejection Reason</span>
                                        <span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.rejectionReason}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
