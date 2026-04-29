import React from 'react';
import { X, Printer, Check, QrCode } from 'lucide-react';

// Mirrors the Flutter reference InvoiceDialog (pos_widgets.dart:3418):
//   dark "FILTER / Simplified TAX Invoice" header with invoice no + date + time,
//   two-column customer/vehicle info grid, per-item tax table (unit price excl.
//   VAT → gross → discount → total before VAT → VAT → total with VAT), totals
//   block, and Print / Done actions.

const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;
const fmt = (v) => {
    const n = parseFloat(v);
    if (!isFinite(n)) return '-';
    return `SAR ${n.toFixed(2)}`;
};

const formatInvoiceDate = (raw) => {
    if (!raw) return '-';
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return String(raw);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return String(raw);
    }
};

const formatInvoiceTime = (raw) => {
    if (!raw) return null;
    try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return null;
    }
};

const pickItems = (invoice) => {
    if (!invoice) return [];

    // 1. departments[].items (department-grouped shape)
    const depts = Array.isArray(invoice.departments) ? invoice.departments : [];
    if (depts.length > 0) {
        const fromDepts = depts.flatMap(d => (d.items || []).map(it => ({ ...it, _deptName: d.departmentName || d.name })));
        if (fromDepts.length > 0) return fromDepts;
    }

    // 2. jobs[].items (order-like shape where invoice carries embedded jobs)
    const jobs = Array.isArray(invoice.jobs) ? invoice.jobs : [];
    if (jobs.length > 0) {
        const fromJobs = jobs.flatMap(j => (j.items || []).map(it => ({ ...it, _deptName: j.departmentName || j.department?.name || j.name })));
        if (fromJobs.length > 0) return fromJobs;
    }

    // 3. order.jobs[].items (nested order object)
    const orderJobs = Array.isArray(invoice.order?.jobs) ? invoice.order.jobs : [];
    if (orderJobs.length > 0) {
        const fromOrderJobs = orderJobs.flatMap(j => (j.items || []).map(it => ({ ...it, _deptName: j.departmentName || j.department?.name || j.name })));
        if (fromOrderJobs.length > 0) return fromOrderJobs;
    }

    // 4. Direct flat arrays: items, lineItems, invoiceItems, salesOrderItems
    if (Array.isArray(invoice.items) && invoice.items.length > 0) return invoice.items;
    if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) return invoice.lineItems;
    if (Array.isArray(invoice.invoiceItems) && invoice.invoiceItems.length > 0) return invoice.invoiceItems;
    if (Array.isArray(invoice.salesOrderItems) && invoice.salesOrderItems.length > 0) return invoice.salesOrderItems;

    return [];
};

const computeRow = (item) => {
    const unitIncl = parseFloat(item.unitPrice || item.price || 0) || 0;
    const qty = parseFloat(item.qty || item.quantity || 1) || 1;
    const unitExcl = r2(unitIncl / 1.15);
    const gross = r2(unitExcl * qty);
    let discount = 0;
    const dType = (item.discountType || '').toLowerCase();
    const dVal = parseFloat(item.discountValue || item.discount || 0) || 0;
    if (dType === 'percent' || dType === 'percentage') discount = r2(gross * (dVal / 100));
    else if (dVal > 0) discount = dVal;
    const totalBeforeVat = r2(gross - discount);
    const vat = r2(totalBeforeVat * 0.15);
    const totalWithVat = r2(totalBeforeVat + vat);
    return {
        name: item.productName || item.product?.name || item.name || item.service?.name || 'Item',
        unitExcl, qty, gross, discount, totalBeforeVat, vat, totalWithVat,
    };
};

export default function InvoiceDetailsModal({ invoice, isOpen, onClose, onPrint }) {
    if (!isOpen || !invoice) return null;

    const items = pickItems(invoice);
    const rows = items.map(computeRow);

    // Totals — prefer backend-provided values, fall back to the per-row sums.
    const sumGross = rows.reduce((s, r) => s + r.gross, 0);
    const sumDiscount = rows.reduce((s, r) => s + r.discount, 0);
    const sumVat = rows.reduce((s, r) => s + r.vat, 0);
    const sumTotal = rows.reduce((s, r) => s + r.totalWithVat, 0);

    const subtotal = parseFloat(invoice.subtotal ?? sumGross) || sumGross;
    const discountTotal = parseFloat(invoice.discountAmount ?? sumDiscount) || sumDiscount;
    const vatTotal = parseFloat(invoice.vatAmount ?? sumVat) || sumVat;
    const grandTotal = parseFloat(invoice.totalAmount ?? invoice.grandTotal ?? sumTotal) || sumTotal;

    const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
    const paymentMethodText = payments.length > 0
        ? payments.map(p => p.method).filter(Boolean).join(', ')
        : (invoice.paymentMethod || 'Unpaid');

    const customerName = invoice.customerName || invoice.customer?.name || 'Walk-in Customer';
    const customerPhone = invoice.customerMobile || invoice.customer?.mobile || '-';
    const customerTaxId = invoice.customerTaxId || invoice.customer?.taxId || '-';
    const vehicleMake = invoice.vehicleMake || invoice.vehicle?.make || '';
    const vehicleModel = invoice.vehicleModel || invoice.vehicle?.model || '';
    const plateNo = invoice.plateNo || invoice.vehicle?.plateNo || invoice.vehicle?.plateNumber || '-';
    const vehicleYear = String(invoice.vehicleYear || invoice.vehicle?.year || '').trim() || '-';
    const vehicleVin = String(invoice.vehicleVin || invoice.vehicle?.vin || '').trim() || '-';
    const odometer = invoice.odometerReading || invoice.odometer || '-';

    const invoiceNo = invoice.invoiceNo || invoice.invoice_no || invoice.number || '—';
    const invoiceDate = formatInvoiceDate(invoice.invoiceDate || invoice.date || invoice.issuedAt);
    const invoiceTime = formatInvoiceTime(invoice.issuedAt || invoice.createdAt);
    const branchName = (invoice.branchName || invoice.branch?.name || 'Branch').toString().toUpperCase();

    const handlePrint = () => {
        if (onPrint) { onPrint(invoice); return; }

        const scrollEl = document.querySelector('.invoice-modal-card .invoice-scroll');
        if (!scrollEl) { window.print(); return; }

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) { alert('Please allow pop-ups to print.'); return; }

        // Extract style text from modal but strip @media print blocks that hide content
        const modalRoot = document.querySelector('.invoice-modal-root');
        let cssText = '';
        if (modalRoot) {
            modalRoot.querySelectorAll('style').forEach(s => {
                // Remove @media print { ... } blocks so they don't interfere
                cssText += s.textContent.replace(/@media\s+print\s*\{[^}]*(\{[^}]*\}[^}]*)*\}/g, '') + '\n';
            });
        }

        printWin.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${invoiceNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #fff;
    padding: 20px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  .invoice-scroll { overflow: visible; padding: 0; }
  .no-print { margin-top: 24px; text-align: center; }
  @media print {
    .no-print { display: none !important; }
    body { padding: 8px; }
  }
  ${cssText}
</style>
</head><body>
${scrollEl.innerHTML}
<div class="no-print">
  <button onclick="window.print()" style="padding:12px 40px;background:#1E2124;color:#FCC247;border:none;border-radius:10px;font-weight:800;font-size:1rem;cursor:pointer;">Print</button>
  <button onclick="window.close()" style="padding:12px 40px;margin-left:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-weight:800;font-size:1rem;cursor:pointer;">Close</button>
</div>
</body></html>`);
        printWin.document.close();
        setTimeout(() => printWin.print(), 500);
    };

    return (
        <div className="modal-overlay-modern invoice-modal-root" onClick={onClose}>
            <div
                className="invoice-modal-card"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-label="Simplified Tax Invoice"
            >
                {/* Scrollable receipt body */}
                <div className="invoice-scroll">
                    {/* Header banner */}
                    <div className="invoice-header">
                        <div className="invoice-header-left">
                            <div className="invoice-brand">FILTER</div>
                            <div className="invoice-brand-sub">Car Services</div>
                            <div className="invoice-title">Simplified TAX Invoice</div>
                            <div className="invoice-meta-line">Invoice No: <b>{invoiceNo}</b></div>
                            <div className="invoice-meta-line">Date: <b>{invoiceDate}</b></div>
                            {invoiceTime && <div className="invoice-meta-line">Time: <b>{invoiceTime}</b></div>}
                        </div>
                        <div className="invoice-qr">
                            <QrCode size={120} strokeWidth={1.2} />
                        </div>
                        <button
                            className="invoice-close"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Branch strip */}
                    <div className="invoice-branch-strip">{branchName}</div>

                    {/* Info grid (two pairs per row) */}
                    <div className="invoice-info-table">
                        <InfoPairRow left={['Customer', customerName]} right={['Phone', customerPhone]} />
                        <InfoPairRow left={['Tax ID', customerTaxId]} right={['Model', vehicleModel || '-']} />
                        <InfoPairRow left={['Plate', plateNo]} right={['Year', vehicleYear]} />
                        <InfoPairRow left={['VIN', vehicleVin]} right={['Mileage', String(odometer)]} />
                        <InfoPairRow left={['Make', vehicleMake || '-']} right={['Payment', paymentMethodText]} last />
                    </div>

                    {/* Items table */}
                    <div className="invoice-items">
                        <div className="invoice-items-head">
                            <span style={{ flex: 4 }}>Goods / Services</span>
                            <span style={{ flex: 2 }}>Unit (Excl VAT)</span>
                            <span style={{ flex: 1 }}>Qty</span>
                            <span style={{ flex: 2 }}>Gross</span>
                            <span style={{ flex: 2 }}>Discount</span>
                            <span style={{ flex: 2 }}>Before VAT</span>
                            <span style={{ flex: 2 }}>VAT</span>
                            <span style={{ flex: 2 }}>With VAT</span>
                        </div>
                        {rows.length === 0 ? (
                            <div className="invoice-empty-row">No line items on this invoice.</div>
                        ) : (
                            rows.map((r, i) => (
                                <div key={i} className="invoice-items-row">
                                    <span style={{ flex: 4 }}>{r.name}</span>
                                    <span style={{ flex: 2 }}>{fmt(r.unitExcl)}</span>
                                    <span style={{ flex: 1 }}>{r.qty % 1 === 0 ? r.qty : r.qty.toFixed(2)}</span>
                                    <span style={{ flex: 2 }}>{fmt(r.gross)}</span>
                                    <span style={{ flex: 2 }}>{fmt(r.discount)}</span>
                                    <span style={{ flex: 2 }}>{fmt(r.totalBeforeVat)}</span>
                                    <span style={{ flex: 2 }}>{fmt(r.vat)}</span>
                                    <span style={{ flex: 2, fontWeight: 800 }}>{fmt(r.totalWithVat)}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals */}
                    <div className="invoice-totals">
                        <TotalsRow label="Subtotal (Excl VAT)" value={fmt(subtotal)} />
                        {discountTotal > 0 && <TotalsRow label="Total Discount" value={`- ${fmt(discountTotal)}`} />}
                        <TotalsRow label="VAT (15%)" value={fmt(vatTotal)} />
                        <TotalsRow label="Grand Total" value={fmt(grandTotal)} bold />
                    </div>
                </div>

                {/* Actions */}
                <div className="invoice-actions">
                    <button className="invoice-btn invoice-btn-secondary" onClick={handlePrint}>
                        <Printer size={16} /> Print
                    </button>
                    <button className="invoice-btn invoice-btn-primary" onClick={onClose}>
                        <Check size={16} /> Done
                    </button>
                </div>
            </div>

            <style>{`
                .invoice-modal-root {
                    padding: 16px;
                    align-items: flex-start;
                }
                .invoice-modal-card {
                    width: 100%;
                    max-width: 940px;
                    max-height: calc(100vh - 32px);
                    background: #ffffff;
                    border: 1px solid #1E2124;
                    border-radius: 14px;
                    box-shadow: 0 14px 40px rgba(0,0,0,0.18);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    margin: auto;
                }
                .invoice-scroll {
                    overflow-y: auto;
                    padding: 14px;
                }
                .invoice-header {
                    position: relative;
                    display: flex;
                    gap: 14px;
                    background: #5B5B5B;
                    color: #fff;
                    padding: 14px 14px 12px;
                    border-radius: 6px;
                }
                .invoice-header-left { flex: 1; min-width: 0; }
                .invoice-brand { color: #FCC247; font-size: 30px; font-weight: 900; letter-spacing: 1.2px; line-height: 1; }
                .invoice-brand-sub { font-size: 15px; font-weight: 700; margin-top: 2px; }
                .invoice-title { font-size: 13px; font-weight: 700; margin-top: 10px; }
                .invoice-meta-line { font-size: 12px; font-weight: 600; margin-top: 2px; }
                .invoice-qr {
                    width: 140px;
                    height: 140px;
                    background: #fff;
                    color: #111;
                    border: 0.9px solid #111;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .invoice-close {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(255,255,255,0.15);
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    padding: 6px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .invoice-close:hover { background: rgba(255,255,255,0.3); }
                .invoice-branch-strip {
                    background: #FCC247;
                    color: #1E2124;
                    font-weight: 800;
                    letter-spacing: 0.8px;
                    padding: 8px 12px;
                    margin-top: 10px;
                }
                .invoice-info-table {
                    border: 1px solid #1E2124;
                    border-top: none;
                }
                .invoice-items {
                    margin-top: 12px;
                    border: 1px solid #1E2124;
                }
                .invoice-items-head {
                    display: flex;
                    background: #FCC247;
                    color: #1E2124;
                    font-weight: 700;
                    font-size: 9.5px;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                .invoice-items-head > span {
                    padding: 6px 4px;
                    border-right: 0.5px solid #1E2124;
                }
                .invoice-items-head > span:last-child { border-right: none; }
                .invoice-items-row {
                    display: flex;
                    font-size: 11px;
                    color: #1E2124;
                    border-top: 0.5px solid #1E2124;
                }
                .invoice-items-row > span {
                    padding: 6px 4px;
                    border-right: 0.5px solid #1E2124;
                    font-weight: 500;
                }
                .invoice-items-row > span:last-child { border-right: none; }
                .invoice-empty-row {
                    padding: 14px;
                    font-size: 12px;
                    color: #64748b;
                    text-align: center;
                }
                .invoice-totals {
                    margin-top: 12px;
                    border: 1px solid #1E2124;
                }
                .invoice-totals-row {
                    display: flex;
                    border-bottom: 1px solid #1E2124;
                }
                .invoice-totals-row:last-child { border-bottom: none; }
                .invoice-totals-label {
                    flex: 6;
                    padding: 8px 10px;
                    border-right: 1px solid #1E2124;
                    font-size: 12px;
                    font-weight: 600;
                }
                .invoice-totals-value {
                    flex: 2;
                    padding: 8px 10px;
                    text-align: right;
                    font-size: 12px;
                    font-weight: 700;
                }
                .invoice-totals-row.bold .invoice-totals-label { font-size: 14px; font-weight: 800; }
                .invoice-totals-row.bold .invoice-totals-value { font-size: 14px; font-weight: 900; color: #FCC247; background: #1E2124; }
                .invoice-actions {
                    display: flex;
                    gap: 10px;
                    padding: 12px 14px;
                    border-top: 1px solid #e5e7eb;
                    background: #fafafa;
                }
                .invoice-btn {
                    flex: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: none;
                    border-radius: 10px;
                    padding: 12px 14px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: transform 0.1s ease, opacity 0.1s ease;
                }
                .invoice-btn:active { transform: translateY(1px); }
                .invoice-btn-secondary { background: #1E2124; color: #fff; }
                .invoice-btn-primary { background: #FCC247; color: #1E2124; }

                /* Two-pair info row cells */
                .info-pair-row { display: flex; }
                .info-cell {
                    padding: 7px 10px;
                    font-size: 12px;
                    color: #1E2124;
                }
                .info-cell.label { font-weight: 700; background: #F8FAFC; }
                .info-cell.value { font-weight: 600; background: #fff; }
                .info-cell.brd-r { border-right: 1px solid #1E2124; }
                .info-cell.brd-b { border-bottom: 1px solid #1E2124; }

                /* Print-only: strip overlay chrome, render receipt as a normal page */
                @media print {
                    /* Hide everything in the app */
                    body > *:not(.invoice-modal-root) { display: none !important; }
                    body * { visibility: hidden !important; }

                    /* Show the invoice and all its children */
                    .invoice-modal-root,
                    .invoice-modal-root * {
                        visibility: visible !important;
                    }

                    /* Strip fixed/absolute overlay so it flows as a normal document */
                    .invoice-modal-root {
                        position: static !important;
                        display: block !important;
                        background: #fff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        z-index: auto !important;
                    }

                    .invoice-modal-card {
                        position: static !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        max-height: none !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        overflow: visible !important;
                    }

                    .invoice-scroll {
                        overflow: visible !important;
                        padding: 8px !important;
                    }

                    /* Hide non-printable UI elements */
                    .invoice-actions,
                    .invoice-close { display: none !important; }

                    /* Ensure the header banner prints its background */
                    .invoice-header {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .invoice-branch-strip {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .invoice-items-head {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .invoice-totals-row.bold .invoice-totals-value {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
}

function InfoPairRow({ left, right, last }) {
    const br = last ? '' : ' brd-b';
    return (
        <div className="info-pair-row">
            <div className={`info-cell label brd-r${br}`} style={{ flex: 2 }}>{left[0]}</div>
            <div className={`info-cell value brd-r${br}`} style={{ flex: 3 }}>{left[1]}</div>
            <div className={`info-cell label brd-r${br}`} style={{ flex: 2 }}>{right[0]}</div>
            <div className={`info-cell value${br}`} style={{ flex: 3 }}>{right[1]}</div>
        </div>
    );
}

function TotalsRow({ label, value, bold }) {
    return (
        <div className={`invoice-totals-row${bold ? ' bold' : ''}`}>
            <div className="invoice-totals-label">{label}</div>
            <div className="invoice-totals-value">{value}</div>
        </div>
    );
}
