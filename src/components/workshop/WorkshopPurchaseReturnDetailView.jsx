import React from 'react';

function fmtDate(value) {
    if (!value) return '—';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function fmtMoney(value, currency = 'SAR') {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return `${currency} ${safe.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function lineAmountExVat(item) {
    const total = Number(item?.total ?? 0);
    const tax = Number(item?.taxAmount ?? 0);
    if (total > 0 && tax >= 0) return Math.max(0, total - tax);
    return Number(item?.qty ?? 0) * Number(item?.unitPrice ?? 0);
}

/**
 * Credit-note style purchase return detail (affiliated supplier return).
 */
export default function WorkshopPurchaseReturnDetailView({ detail, currency = 'SAR' }) {
    const d = detail || {};
    const items = Array.isArray(d.items) ? d.items : [];
    const ccy = d.workshop?.currencyCode || currency || 'SAR';
    const subtotal = Number(d.subtotal ?? items.reduce((sum, item) => sum + lineAmountExVat(item), 0));
    const taxAmount = Number(d.taxAmount ?? items.reduce((sum, item) => sum + Number(item.taxAmount ?? 0), 0));
    const grandTotal = Number(d.grandTotal ?? subtotal + taxAmount);
    const workshopName = d.workshop?.name || 'FILTER';
    const branchName = d.branch?.name || '—';
    const supplierName = d.supplier?.name || '—';
    const vatNumber = d.branch?.vatId || d.workshop?.vatId || d.supplier?.vatId || '—';

    return (
        <div
            className="ws-purchase-return-detail"
            style={{
                fontFamily: "'Poppins', sans-serif",
                color: '#111827',
                background: '#fff',
            }}
        >
            <style>{`
              .ws-pr-cn-table { width: 100%; border-collapse: collapse; }
              .ws-pr-cn-table th, .ws-pr-cn-table td {
                border: 1px solid #cbd5e1;
                padding: 8px 10px;
                font-size: 12px;
                vertical-align: top;
              }
              .ws-pr-cn-table th { background: #e5e7eb; font-weight: 700; }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 28, letterSpacing: 0.5 }}>Credit Note</h2>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                        <div><strong>{workshopName}</strong></div>
                        <div>{branchName}</div>
                        <div>VAT: {vatNumber}</div>
                    </div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#FCC247', lineHeight: 1 }}>FILTER</div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    border: '1px solid #cbd5e1',
                    marginBottom: 18,
                    fontSize: 12,
                }}
            >
                <div style={{ padding: 12, borderRight: '1px solid #e2e8f0' }}>
                    <div><strong>Supplier:</strong> {supplierName}</div>
                    {d.supplier?.vatId ? (
                        <div style={{ marginTop: 6 }}><strong>Supplier VAT:</strong> {d.supplier.vatId}</div>
                    ) : null}
                    <div style={{ marginTop: 6 }}><strong>Branch:</strong> {branchName}</div>
                </div>
                <div style={{ padding: 12, borderRight: '1px solid #e2e8f0' }}>
                    <div><strong>Issue date:</strong> {fmtDate(d.issueDate)}</div>
                    <div style={{ marginTop: 6 }}><strong>Return #:</strong> {d.returnNumber || '—'}</div>
                    <div style={{ marginTop: 6 }}><strong>Reference:</strong> {d.reference || d.sourcePurchaseInvoiceNumber || '—'}</div>
                </div>
                <div style={{ padding: 12 }}>
                    <div><strong>Source PI:</strong> {d.sourcePurchaseInvoiceNumber || '—'}</div>
                    <div style={{ marginTop: 6 }}>
                        <strong>Linked supplier return:</strong> {d.supplierSalesReturnNo || '—'}
                    </div>
                    <div style={{ marginTop: 6 }}>
                        <strong>Status:</strong>{' '}
                        <span style={{ textTransform: 'capitalize' }}>{d.status || 'pending'}</span>
                    </div>
                </div>
            </div>

            {d.description ? (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#475569' }}>
                    <strong>Description:</strong> {d.description}
                </div>
            ) : null}

            <table className="ws-pr-cn-table">
                <thead>
                    <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>#</th>
                        <th style={{ textAlign: 'left' }}>Item</th>
                        <th style={{ textAlign: 'right' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit price</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th style={{ textAlign: 'right' }}>Tax</th>
                        <th style={{ textAlign: 'right' }}>Tax amount</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: 16, color: '#64748b' }}>
                                No return line items.
                            </td>
                        </tr>
                    ) : (
                        items.map((item, index) => {
                            const amount = lineAmountExVat(item);
                            return (
                                <tr key={item.id || `${item.itemName}-${index}`}>
                                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{item.itemName || '—'}</div>
                                        {item.uom ? (
                                            <div style={{ fontSize: 11, color: '#64748b' }}>UOM: {item.uom}</div>
                                        ) : null}
                                        {item.reason ? (
                                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                                Reason: {item.reason}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {Number(item.qty ?? 0).toLocaleString()}
                                        {item.uom ? ` ${item.uom}` : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{fmtMoney(item.unitPrice, ccy)}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtMoney(amount, ccy)}</td>
                                    <td style={{ textAlign: 'right' }}>{item.taxCode || 'VAT 15%'}</td>
                                    <td style={{ textAlign: 'right' }}>{fmtMoney(item.taxAmount, ccy)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(item.total, ccy)}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 16,
                }}
            >
                <div style={{ minWidth: 260, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
                        <span>Sub-total</span>
                        <strong>{fmtMoney(subtotal, ccy)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '4px 0' }}>
                        <span>Tax (15%)</span>
                        <strong>{fmtMoney(taxAmount, ccy)}</strong>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            padding: '8px 0 0',
                            marginTop: 6,
                            borderTop: '1px solid #cbd5e1',
                            fontSize: 15,
                        }}
                    >
                        <span>Total</span>
                        <strong>{fmtMoney(grandTotal, ccy)}</strong>
                    </div>
                </div>
            </div>

            {(d.qrToken || d.approvedAt || d.qrConfirmedAt || d.finalizedAt) && (
                <div
                    style={{
                        marginTop: 18,
                        paddingTop: 14,
                        borderTop: '1px dashed #cbd5e1',
                        fontSize: 12,
                        color: '#64748b',
                        display: 'grid',
                        gap: 4,
                    }}
                >
                    {d.qrToken ? (
                        <div>
                            QR token: {d.qrToken}{' '}
                            <a
                                href={`/verify/apr/${encodeURIComponent(d.qrToken)}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Open verify page
                            </a>
                        </div>
                    ) : null}
                    {d.approvedAt ? <div>Approved: {fmtDate(d.approvedAt)}</div> : null}
                    {d.qrConfirmedAt ? <div>QR confirmed: {fmtDate(d.qrConfirmedAt)}</div> : null}
                    {d.finalizedAt ? <div>Finalized: {fmtDate(d.finalizedAt)}</div> : null}
                </div>
            )}
        </div>
    );
}
