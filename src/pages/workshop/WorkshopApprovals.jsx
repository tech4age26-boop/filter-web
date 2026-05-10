import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, CheckCircle, X, Eye, RefreshCw, FileText } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';

/**
 * Map a supplier sales invoice (as returned by GET
 * /workshop-staff/supplier-sales-invoices/:id) to the field shape consumed by
 * `WorkshopPurchaseInvoiceView` so we can render the same printable invoice
 * the workshop sees in Purchases. Field aliases are duplicated (snake + camel)
 * so the template's `pick(...)` helper finds them regardless of casing.
 */
function mapSupplierInvoiceToPrintableDetail(inv) {
    if (!inv || typeof inv !== 'object') return {};
    const items = Array.isArray(inv.items) ? inv.items : [];
    const branchName = inv.branch?.name ?? '';
    const supplierName = inv.supplier?.name ?? '';
    return {
        id: inv.id,
        invoiceNumber: inv.invoiceNo,
        invoiceNo: inv.invoiceNo,
        issueDate: inv.invoiceDate,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        status: inv.status,
        workshopName: branchName,
        branchName,
        branch: inv.branch,
        workshop: inv.workshop,
        supplierName,
        supplierLegalName: supplierName,
        vendorName: supplierName,
        vendor_name: supplierName,
        supplier: inv.supplier,
        vendorInvoiceRef: inv.deliveryNoteUrl ?? '',
        vendorRef: inv.deliveryNoteUrl ?? '',
        subtotalExVat: inv.subtotal,
        subtotal: inv.subtotal,
        vatAmount: inv.vatAmount,
        totalVat: inv.vatAmount,
        grandTotal: inv.grandTotal,
        total: inv.grandTotal,
        amountPaid: inv.paid,
        paidAmount: inv.paid,
        balanceDue: inv.outstanding,
        balance: inv.outstanding,
        paymentStatus:
            Number(inv.paid) >= Number(inv.grandTotal) && Number(inv.grandTotal) > 0
                ? 'paid'
                : 'unpaid',
        notes: inv.internalNotes ?? '',
        description: inv.deliveryNoteUrl ?? '',
        items: items.map((it) => ({
            id: it.id,
            productName: it.productName,
            product_name: it.productName,
            qty: it.qty,
            quantity: it.qty,
            unit: 'piece',
            uom: 'piece',
            unitPrice: it.unitPrice,
            unit_price: it.unitPrice,
            unitPriceExVat: it.unitPrice,
            vatRate: it.vatRate,
            vat_rate: it.vatRate,
            lineTotal: it.lineTotal,
            line_total: it.lineTotal,
        })),
    };
}

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
    /** Imperative handle for the printable invoice template (Download PDF). */
    const printableInvoiceRef = useRef(null);
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
            const branchLabel = row.branchName || row.branch_name || 'this branch';
            const ok = window.confirm(
                `Approve supplier invoice ${row.invoiceNo || ''}?\n\nApproving will increase inventory on hand for "${branchLabel}" by the quantities on this invoice. This action cannot be undone.`,
            );
            if (!ok) return;
            setActionLoadingId(`approve-si-${sid}`);
            try {
                await apiFetch(`/workshop-staff/supplier-sales-invoices/${encodeURIComponent(String(sid))}/approve`, {
                    method: 'POST',
                });
                await loadApprovals();
                window.dispatchEvent(new Event('workshop-approvals-updated'));
                window.dispatchEvent(
                    new CustomEvent('workshop-inventory-updated', {
                        detail: { branchId: row.branchId ?? row.branch_id ?? null, source: 'approve_supplier_invoice' },
                    }),
                );
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
                        {isLoading && filtered.length === 0 ? (
                            <ShimmerTableBodyRows rows={6} columns={6} />
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                    No approvals found
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
                                                        background: isSupplier ? '#EFF6FF' : '#F9FAFB',
                                                        color: isSupplier ? '#1D4ED8' : '#374151',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8125rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                    title={
                                                        isSupplier
                                                            ? 'Open the printable supplier invoice'
                                                            : 'View request details'
                                                    }
                                                >
                                                    {isSupplier ? (
                                                        <>
                                                            <FileText size={14} /> View Invoice
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye size={14} /> Details
                                                        </>
                                                    )}
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
                    <Modal
                        title={isSupplierSalesInvoiceRow(viewDialog) ? 'Supplier invoice' : 'Approval Details'}
                        onClose={() => setViewDialog(null)}
                        width={isSupplierSalesInvoiceRow(viewDialog) ? '1100px' : undefined}
                    >
                        {isSupplierSalesInvoiceRow(viewDialog) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 8,
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        onClick={() => printableInvoiceRef.current?.downloadPdf?.()}
                                        disabled={viewInvoiceLoading || !viewInvoiceDetail}
                                    >
                                        Download PDF
                                    </button>
                                </div>
                                {viewInvoiceLoading ? (
                                    <ShimmerTextBlock lines={10} />
                                ) : viewInvoiceDetail ? (
                                    <WorkshopPurchaseInvoiceView
                                        ref={printableInvoiceRef}
                                        compact
                                        variant="supplier_sales"
                                        detail={mapSupplierInvoiceToPrintableDetail(viewInvoiceDetail)}
                                        listRow={{
                                            id: viewInvoiceDetail.id,
                                            invoice_number: viewInvoiceDetail.invoiceNo,
                                            invoiceNo: viewInvoiceDetail.invoiceNo,
                                            date: viewInvoiceDetail.invoiceDate,
                                            status: viewInvoiceDetail.status,
                                            grand_total: viewInvoiceDetail.grandTotal,
                                            vendor_name: viewInvoiceDetail.supplier?.name,
                                            branch_name: viewInvoiceDetail.branch?.name,
                                        }}
                                    />
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
