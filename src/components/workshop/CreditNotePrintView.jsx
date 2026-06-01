import React, { forwardRef } from 'react';

function fmtDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '—';
    }
}

function fmtMoney(n) {
    const v = Number(n);
    return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

/**
 * Printable credit note layout (matches workshop credit note PDF sample).
 * ZATCA Phase 2 QR placeholder — wire API later.
 */
const CreditNotePrintView = forwardRef(function CreditNotePrintView({ data }, ref) {
    const d = data || {};
    const items = Array.isArray(d.items) ? d.items : [];
    const total = Number(d.totalAmount) || items.reduce((s, it) => s + Number(it.lineTotal || 0), 0);
    const branchVat = d.branchVatId || d.branch?.vatId || d.workshopVatId || '—';
    const branchName = d.branchName || d.branch?.name || '—';
    const workshopName = d.workshopName || d.workshop?.name || 'FILTER';

    return (
        <div ref={ref} className="credit-note-print-root" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111', background: '#fff', padding: 24, maxWidth: 820, margin: '0 auto' }}>
            <style>{`
              @media print {
                .credit-note-print-root { padding: 0 !important; max-width: none !important; }
                .credit-note-no-print { display: none !important; }
              }
              .cn-table { width: 100%; border-collapse: collapse; }
              .cn-table th, .cn-table td { border: 1px solid #ccc; padding: 8px 10px; font-size: 12px; }
              .cn-table th { background: #e5e7eb; font-weight: 700; }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 28, letterSpacing: 1 }}>CREDIT NOTE</h1>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#FCC247', marginTop: 4 }}>{workshopName}</div>
                </div>
                <div style={{ width: 96, height: 96, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748b', textAlign: 'center', padding: 8 }}>
                    ZATCA Phase 2<br />QR Code<br />(coming soon)
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, border: '1px solid #ccc', marginBottom: 20, fontSize: 12 }}>
                <div style={{ padding: 12, borderRight: '1px solid #ccc' }}>
                    <div><strong>Phone No.:</strong> {d.customerPhone || '—'}</div>
                    <div style={{ marginTop: 8 }}><strong>Vehicle No.:</strong> {d.vehicleNumber || '—'}</div>
                    <div style={{ marginTop: 8 }}><strong>Customer:</strong> {d.customerName || '—'}</div>
                </div>
                <div style={{ padding: 12, borderRight: '1px solid #ccc' }}>
                    <div><strong>Return Date:</strong> {fmtDate(d.returnDate || d.reviewedAt || d.createdAt)}</div>
                    <div style={{ marginTop: 8 }}><strong>Invoice Number:</strong> {d.invoiceNo || '—'}</div>
                    <div style={{ marginTop: 8 }}><strong>Return By:</strong> {d.cashier?.name || '—'}</div>
                    <div style={{ marginTop: 8 }}><strong>Credit Note No:</strong> {d.creditNoteNo || d.returnNo || '—'}</div>
                </div>
                <div style={{ padding: 12 }}>
                    <div><strong>Branch Name:</strong> {branchName}</div>
                    <div style={{ marginTop: 8 }}><strong>VAT Number:</strong> {branchVat}</div>
                    <div style={{ marginTop: 8 }}><strong>Return type:</strong> {d.returnScope === 'full' ? 'Full return' : 'Partial return'}</div>
                </div>
            </div>

            <table className="cn-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Nature of goods or services<br /><span style={{ fontWeight: 400 }}>تفاصيل السلع او الخدمات</span></th>
                        <th style={{ textAlign: 'right' }}>Unit price<br /><span style={{ fontWeight: 400 }}>سعر الوحدة</span></th>
                        <th style={{ textAlign: 'right' }}>Return Qty<br /><span style={{ fontWeight: 400 }}>الكمية</span></th>
                        <th style={{ textAlign: 'right' }}>Item Subtotal (Incl. VAT)<br /><span style={{ fontWeight: 400 }}>المجموع (شامل ضريبة القيمة المضافة)</span></th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((it) => (
                        <tr key={it.id || `${it.name}-${it.qty}`}>
                            <td>{it.name || '—'}</td>
                            <td style={{ textAlign: 'right' }}>{fmtMoney(it.unitPrice)} SAR</td>
                            <td style={{ textAlign: 'right' }}>{it.qty}</td>
                            <td style={{ textAlign: 'right' }}>{fmtMoney(it.lineTotal)} SAR</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <p style={{ textAlign: 'center', margin: '24px 0', fontWeight: 700, fontSize: 14 }}>
                CREDIT NOTE — THIS IS A VALID TENDER FOR THE AMOUNT <strong>{fmtMoney(total)} SR</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 32, fontSize: 12 }}>
                {['Supervisor Signature', 'Accountant Signature', 'Customer Signature'].map((label) => (
                    <div key={label}>
                        <div style={{ borderBottom: '1px dotted #64748b', height: 40, marginBottom: 6 }} />
                        <div>{label}</div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 40, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                VALID ONLY IN {branchName}
            </div>
        </div>
    );
});

export default CreditNotePrintView;
