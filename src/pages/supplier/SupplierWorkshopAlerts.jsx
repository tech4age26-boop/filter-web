import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupplierWorkshopCriticalStockAlerts } from '../../services/supplierApi';
import { ShimmerTable } from '../../components/supplier/Shimmer';

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(x).replace(/\.?0+$/, '');
}

export default function SupplierWorkshopAlerts() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [summaryMessage, setSummaryMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const data = await getSupplierWorkshopCriticalStockAlerts();
                const list = Array.isArray(data?.alerts) ? data.alerts : [];
                if (!cancelled) {
                    setRows(list);
                    setSummaryMessage(
                        typeof data?.message === 'string' ? data.message : '',
                    );
                }
            } catch (err) {
                console.error('Workshop critical stock alerts failed:', err);
                if (!cancelled) {
                    setRows([]);
                    setSummaryMessage('');
                    setApiError(err?.message || 'Failed to load alerts');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const groupedByWorkshop = useMemo(() => {
        const map = new Map();
        for (const r of rows) {
            const wid = String(r.workshopId ?? '');
            if (!map.has(wid)) {
                map.set(wid, {
                    workshopId: wid,
                    workshopName: r.workshopName || 'Workshop',
                    items: [],
                });
            }
            map.get(wid).items.push(r);
        }
        return [...map.values()].sort((a, b) =>
            a.workshopName.localeCompare(b.workshopName),
        );
    }, [rows]);

    const openSalesInvoiceForBranch = (branchId) => {
        try {
            sessionStorage.setItem('supplier_open_new_sales_invoice', '1');
            if (branchId != null && String(branchId) !== '') {
                sessionStorage.setItem(
                    'supplier_sales_invoice_preset_branch_id',
                    String(branchId),
                );
            } else {
                sessionStorage.removeItem('supplier_sales_invoice_preset_branch_id');
            }
        } catch {
            /* ignore */
        }
        navigate('/supplier/sales_invoices');
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Workshop Alerts</h2>
                    <p className="ws-page-sub">Low stock alerts from workshop branches</p>
                </div>
            </div>
            <div
                style={{
                    padding: 14,
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    borderRadius: 12,
                    marginBottom: 20,
                    fontSize: '0.875rem',
                    color: '#92400E',
                }}
            >
                <strong>Workshop Stock Alerts</strong> — when a linked workshop branch’s on-hand
                quantity is at or below the critical threshold, it appears below. Issue a{' '}
                <strong>Sales Invoice</strong> to send them stock.
            </div>
            {apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load alerts:</strong> {apiError}
                </div>
            ) : null}
            {!loading && summaryMessage ? (
                <p
                    style={{
                        margin: '0 0 14px',
                        fontSize: '0.875rem',
                        color: 'var(--color-text-muted)',
                    }}
                >
                    {summaryMessage}
                </p>
            ) : null}
            {loading ? (
                <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                    <ShimmerTable rows={8} columns={7} />
                </div>
            ) : rows.length === 0 ? (
                <div className="ws-empty">
                    <AlertTriangle size={56} className="ws-empty-icon" />
                    <p className="ws-empty-text">No active alerts</p>
                </div>
            ) : (
                groupedByWorkshop.map((g) => (
                    <div key={g.workshopId} className="ws-section" style={{ marginBottom: 16 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                flexWrap: 'wrap',
                                marginBottom: 12,
                            }}
                        >
                            <h3
                                style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    fontWeight: 800,
                                    color: '#EA580C',
                                }}
                            >
                                {g.workshopName}
                            </h3>
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {g.items.length} critical line{g.items.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>Branch</th>
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th style={{ textAlign: 'right' }}>Current</th>
                                        <th style={{ textAlign: 'right' }}>Critical</th>
                                        <th>Threshold</th>
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {g.items.map((a) => (
                                        <tr key={`${a.branchId}-${a.productId}`}>
                                            <td style={{ fontWeight: 600 }}>{a.branchName}</td>
                                            <td>
                                                <strong>{a.productName}</strong>
                                            </td>
                                            <td style={{ color: 'var(--color-text-muted)' }}>
                                                {a.sku || '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {fmtQty(a.currentQty)} {a.unit}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {fmtQty(a.criticalStockPoint)} {a.unit}
                                            </td>
                                            <td>
                                                <span
                                                    className={`ws-badge ${a.thresholdSource === 'workshop_branch' ? 'ws-badge--orange' : 'ws-badge--cyan'}`}
                                                >
                                                    {a.thresholdSource === 'workshop_branch'
                                                        ? 'Branch setting'
                                                        : 'Catalog'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    type="button"
                                                    className="ws-btn-approve"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    onClick={() =>
                                                        openSalesInvoiceForBranch(a.branchId)
                                                    }
                                                >
                                                    <FileText size={14} />
                                                    Sales invoice
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
