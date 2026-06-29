import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    approveAffiliatedPurchaseReturn,
    confirmAffiliatedPurchaseReturnQr,
    createAffiliatedPurchaseReturn,
    getAffiliatedPurchaseReturn,
    getWorkshopSupplierPurchaseInvoice,
    listAffiliatedPurchaseReturns,
    listWorkshopSupplierPurchaseInvoices,
} from '../../services/workshopStaffApi';

function money(value) {
    return Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function WorkshopPurchaseReturns({ selectedBranchId = 'all' }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [rows, setRows] = useState([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(
        location.state?.prefillInvoiceId ? String(location.state.prefillInvoiceId) : '',
    );
    const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
    const [lineQty, setLineQty] = useState({});
    const [lineReason, setLineReason] = useState({});
    const [detail, setDetail] = useState(null);

    const branchParams = useMemo(
        () => (selectedBranchId && selectedBranchId !== 'all' ? { branchId: String(selectedBranchId) } : {}),
        [selectedBranchId],
    );

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [returnsRes, invoicesRes] = await Promise.all([
                listAffiliatedPurchaseReturns(branchParams),
                listWorkshopSupplierPurchaseInvoices({ ...branchParams, limit: 100, offset: 0 }),
            ]);
            setRows(Array.isArray(returnsRes?.items) ? returnsRes.items : []);
            setPurchaseInvoices(Array.isArray(invoicesRes?.invoices) ? invoicesRes.invoices : []);
        } catch (err) {
            setError(err.message || 'Failed to load purchase returns.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [selectedBranchId]);

    useEffect(() => {
        if (!selectedInvoiceId) {
            setSelectedInvoiceDetail(null);
            setLineQty({});
            return;
        }
        let active = true;
        getWorkshopSupplierPurchaseInvoice(selectedInvoiceId)
            .then((res) => {
                if (!active) return;
                const invoice = res?.purchaseInvoice || res?.invoice || res;
                setSelectedInvoiceDetail(invoice);
                const next = {};
                (invoice?.items || []).forEach((item) => {
                    next[String(item.id)] = '';
                });
                setLineQty(next);
            })
            .catch((err) => {
                if (active) setError(err.message || 'Failed to load purchase invoice detail.');
            });
        return () => {
            active = false;
        };
    }, [selectedInvoiceId]);

    const totalSelected = useMemo(() => {
        return (selectedInvoiceDetail?.items || []).reduce((sum, item) => {
            const qty = Number(lineQty[String(item.id)] || 0);
            if (!(qty > 0)) return sum;
            return sum + qty * Number(item.unitPrice || 0);
        }, 0);
    }, [selectedInvoiceDetail, lineQty]);

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!selectedInvoiceId) {
            setError('Select a source purchase invoice.');
            return;
        }
        const lines = (selectedInvoiceDetail?.items || [])
            .map((item) => ({
                sourcePurchaseInvoiceItemId: String(item.id),
                qty: Number(lineQty[String(item.id)] || 0),
                reason: lineReason[String(item.id)] || '',
            }))
            .filter((item) => item.qty > 0);
        if (!lines.length) {
            setError('Enter at least one return quantity.');
            return;
        }
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const res = await createAffiliatedPurchaseReturn({
                sourcePurchaseInvoiceId: selectedInvoiceId,
                lines,
            });
            setSuccess(`Purchase return created: ${res?.purchaseReturnNo || ''}`);
            await load();
        } catch (err) {
            setError(err.message || 'Failed to create purchase return.');
        } finally {
            setSaving(false);
        }
    };

    const openDetail = async (row) => {
        setDetail(row);
        try {
            const res = await getAffiliatedPurchaseReturn(row.id);
            setDetail(res?.purchaseReturn || row);
        } catch {
            // keep row fallback
        }
    };

    const handleApprove = async (row) => {
        setSaving(true);
        setError('');
        try {
            await approveAffiliatedPurchaseReturn(row.id);
            setSuccess(`Approved ${row.returnNumber}`);
            await load();
            if (detail?.id === row.id) {
                const res = await getAffiliatedPurchaseReturn(row.id);
                setDetail(res?.purchaseReturn || null);
            }
        } catch (err) {
            setError(err.message || 'Failed to approve purchase return.');
        } finally {
            setSaving(false);
        }
    };

    const handleQr = async (row) => {
        setSaving(true);
        setError('');
        try {
            await confirmAffiliatedPurchaseReturnQr(row.id);
            setSuccess(`QR confirmation completed for ${row.returnNumber}`);
            await load();
        } catch (err) {
            setError(err.message || 'Failed to QR-confirm purchase return.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="ws-page" style={{ padding: 20 }}>
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <h1 style={{ margin: 0 }}>Purchase Returns</h1>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)' }}>
                    Review linked supplier returns, approve them, or finalize through QR-confirmed flow.
                </p>
            </div>

            {error ? <div className="ws-alert ws-alert--error" style={{ marginBottom: 12 }}>{error}</div> : null}
            {success ? <div className="ws-alert ws-alert--success" style={{ marginBottom: 12 }}>{success}</div> : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
                <div className="ws-section" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <h2 style={{ margin: 0 }}>Linked Purchase Returns</h2>
                        <button type="button" className="mc-btn-ghost" onClick={() => navigate('/workshop/purchases')}>
                            Back to Purchase Invoices
                        </button>
                    </div>
                    {loading ? (
                        <p>Loading…</p>
                    ) : (
                        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                            {rows.map((row) => (
                                <div key={row.id} style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{row.returnNumber}</div>
                                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                                {row.supplierName} · {row.sourcePurchaseInvoiceNumber || 'No source invoice'}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12 }}>{row.status}</div>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: 13 }}>Total: SAR {money(row.grandTotal)}</div>
                                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button type="button" className="mc-btn-ghost" onClick={() => openDetail(row)}>
                                            View
                                        </button>
                                        <button type="button" className="mc-btn-primary" onClick={() => handleApprove(row)} disabled={saving || row.status !== 'pending'}>
                                            Approve
                                        </button>
                                        <button type="button" className="mc-btn-ghost" onClick={() => handleQr(row)} disabled={saving || row.status !== 'pending'}>
                                            QR finalize
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {!rows.length ? <p style={{ margin: 0 }}>No purchase returns found.</p> : null}
                        </div>
                    )}
                </div>

                <div className="ws-section" style={{ padding: 16 }}>
                    <h2 style={{ marginTop: 0 }}>Create From Purchase Invoice</h2>
                    <form onSubmit={handleCreate}>
                        <label className="field" style={{ display: 'block', marginBottom: 12 }}>
                            <div>Purchase invoice</div>
                            <select value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)}>
                                <option value="">Select purchase invoice</option>
                                {purchaseInvoices.map((invoice) => (
                                    <option key={invoice.id} value={invoice.id}>
                                        {invoice.invoiceNumber || invoice.invoiceNo} · {invoice.supplier?.name || invoice.supplierName || 'Supplier'}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="premium-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Invoice qty</th>
                                        <th>Return qty</th>
                                        <th>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedInvoiceDetail?.items || []).map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.itemName || item.productName}</td>
                                            <td>{item.qty}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    value={lineQty[String(item.id)] ?? ''}
                                                    onChange={(e) =>
                                                        setLineQty((prev) => ({
                                                            ...prev,
                                                            [String(item.id)]: e.target.value,
                                                        }))
                                                    }
                                                    style={{ width: 110 }}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    value={lineReason[String(item.id)] ?? ''}
                                                    onChange={(e) =>
                                                        setLineReason((prev) => ({
                                                            ...prev,
                                                            [String(item.id)]: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Reason"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {!selectedInvoiceDetail?.items?.length ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: 16 }}>
                                                Select a purchase invoice to prefill return lines.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><strong>Estimated value:</strong> SAR {money(totalSelected)}</div>
                            <button type="submit" className="mc-btn-primary" disabled={saving}>
                                {saving ? 'Creating…' : 'Create purchase return'}
                            </button>
                        </div>
                    </form>

                    {detail ? (
                        <div style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
                            <h3 style={{ marginTop: 0 }}>{detail.returnNumber}</h3>
                            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                                QR token: {detail.qrToken || '—'}
                                {detail.qrToken ? (
                                    <>
                                        {' · '}
                                        <a
                                            href={`/verify/apr/${encodeURIComponent(detail.qrToken)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Open public verify page
                                        </a>
                                    </>
                                ) : null}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 13 }}>
                                Status: {detail.status} · Total: SAR {money(detail.grandTotal)}
                            </div>
                            <div style={{ marginTop: 12 }}>
                                {(detail.items || []).map((item) => (
                                    <div key={item.id} style={{ padding: '6px 0', borderBottom: '1px dashed #E5E7EB' }}>
                                        {item.itemName} · {item.qty} · SAR {money(item.total)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
