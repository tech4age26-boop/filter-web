import React from 'react';
import { X, Printer, Check, QrCode, Download } from 'lucide-react';

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

/** DB/internal codes (snake_case) → readable labels for the invoice info grid. */
function formatPaymentMethodForDisplay(raw) {
    if (raw == null) return 'Unpaid';
    const s = String(raw).trim();
    if (!s) return 'Unpaid';
    const norm = s.toLowerCase();
    const map = {
        corporate_wallet: 'Corporate wallet',
        'corporate credit': 'Corporate credit',
        corporate_credit: 'Corporate credit',
        'pay monthly': 'Pay monthly',
        pay_monthly: 'Pay monthly',
        'monthly billing': 'Monthly billing',
        monthly_billing: 'Monthly billing',
        'bank transfer': 'Bank transfer',
        bank_transfer: 'Bank transfer',
        tabby: 'Tabby',
        tamara: 'Tamara',
        cash: 'Cash',
        card: 'Card',
    };
    if (map[norm]) return map[norm];
    if (s.includes('_')) {
        return s
            .split('_')
            .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
            .join(' ');
    }
    return s;
}

const CHECKLIST_LABELS = [
    ['Tire Pressure Check', 'فحص هواء الإطارات'],
    ['Brake Fluid Check', 'فحص سائل الفرامل'],
    ['Wipers Fluid Check', 'فحص سائل المساحات'],
    ['Power Steering Fluid Check', 'فحص سائل المقود'],
    ['Transmission Fluid Check', 'فحص سائل نقل الحركة'],
    ['Radiator Fluid Check', 'فحص سائل رديتر المحرك'],
];

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

export default function InvoiceDetailsModal({ invoice, isOpen, onClose, onPrint, onDownload }) {
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
    const jobs = Array.isArray(invoice.salesOrder?.jobs)
        ? invoice.salesOrder.jobs
        : Array.isArray(invoice.jobs)
          ? invoice.jobs
          : [];
    const itemDiscount = jobs.reduce(
        (acc, j) =>
            acc +
            Math.max(
                0,
                (parseFloat(j.amountBeforeDiscount) || 0) -
                    (parseFloat(j.amountAfterDiscount) || parseFloat(j.amountAfterPromo) || 0),
            ),
        0,
    );
    const invoiceDiscount = jobs.reduce((acc, j) => {
        if (String(j.totalDiscountType || '').toLowerCase() === 'amount') return acc + (parseFloat(j.totalDiscountValue) || 0);
        return acc;
    }, 0);
    const promoDiscount = jobs.reduce((acc, j) => acc + (parseFloat(j.promoDiscountAmount) || 0), 0);
    const taxableAmount =
        parseFloat(invoice.taxableAmount) ||
        Math.max(0, subtotal - itemDiscount - invoiceDiscount - promoDiscount);
    const checklistChecks = Array.isArray(invoice.maintenanceChecklist?.checks)
        ? invoice.maintenanceChecklist.checks
        : [];

    const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
    const paymentMethodText =
        payments.length > 0
            ? payments.map((p) => formatPaymentMethodForDisplay(p.method)).join(', ') || 'Unpaid'
            : formatPaymentMethodForDisplay(invoice.paymentMethod);

    const customerName = invoice.customerName || invoice.customer?.name || 'Walk-in Customer';
    const customerPhone = invoice.customerMobile || invoice.customer?.mobile || '-';
    const customerTaxId = invoice.customerTaxId || invoice.customer?.taxId || '-';
    const vehicleMake = invoice.vehicleMake || invoice.vehicle?.make || '';
    const vehicleModel = invoice.vehicleModel || invoice.vehicle?.model || '';
    const plateNo = invoice.plateNo || invoice.vehicle?.plateNo || invoice.vehicle?.plateNumber || '-';
    const vehicleYear = String(invoice.vehicleYear || invoice.vehicle?.year || '').trim() || '-';
    const vehicleVin = String(invoice.vehicleVin || invoice.vehicle?.vin || '').trim() || '-';
    const odometer =
        invoice.odometerReading ??
        invoice.odometer ??
        invoice.salesOrder?.odometerReading ??
        invoice.order?.odometerReading ??
        '-';
    const nextOilChangeKm =
        invoice.nextOilChangeKm ??
        invoice.salesOrder?.nextOilChangeKm ??
        invoice.order?.nextOilChangeKm ??
        '-';

    const invoiceNo = invoice.invoiceNo || invoice.invoice_no || invoice.number || '—';
    const invoiceDate = formatInvoiceDate(invoice.invoiceDate || invoice.date || invoice.issuedAt);
    const invoiceTime = formatInvoiceTime(invoice.issuedAt || invoice.createdAt);
    const branchName = (invoice.branchName || invoice.branch?.name || 'Branch').toString().toUpperCase();

    const handlePrint = () => {
        if (onPrint) {
            onPrint(invoice);
            return;
        }
        // Use same-window print so popup blockers do not break invoice printing.
        setTimeout(() => window.print(), 50);
    };

    const handleDownload = async () => {
        if (onDownload) {
            onDownload(invoice);
            return;
        }
        const scrollEl = document.querySelector('.invoice-modal-card .invoice-scroll');
        if (!scrollEl) return;
        try {
            const [{ toPng }, { jsPDF }] = await Promise.all([
                import('html-to-image'),
                import('jspdf'),
            ]);
            const imgData = await toPng(scrollEl, {
                backgroundColor: '#ffffff',
                pixelRatio: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2),
                cacheBust: true,
            });
            const dims = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => reject(new Error('Invalid PNG from capture'));
                img.src = imgData;
            });
            const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 24;
            const usableW = pageWidth - margin * 2;
            const usableH = pageHeight - margin * 2;
            const imgDisplayHeight = (dims.h * usableW) / dims.w;

            if (imgDisplayHeight <= usableH) {
                pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgDisplayHeight);
            } else {
                let heightLeft = imgDisplayHeight;
                let position = 0;
                while (heightLeft > 0) {
                    pdf.addImage(imgData, 'PNG', margin, margin + position, usableW, imgDisplayHeight);
                    heightLeft -= usableH;
                    position -= usableH;
                    if (heightLeft > 0) pdf.addPage();
                }
            }

            const safe = String(invoiceNo || 'invoice').replace(/[^\w.\-]+/g, '_').replace(/^_|_$/g, '').slice(0, 96) || 'invoice';
            pdf.save(`${safe}.pdf`);
        } catch (err) {
            console.error(err);
            window.alert('Could not create PDF. Please try again.');
        }
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
                        <InfoPairRow left={['Next Oil Change KM', String(nextOilChangeKm)]} right={['Payment', paymentMethodText]} />
                        <InfoPairRow left={['Make', vehicleMake || '-']} right={['', '']} last />
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
                    <div className="invoice-total-section-title">Total Amount</div>
                    <div className="invoice-totals">
                        <TotalsRow label="Gross Amount (Excluding VAT)" value={fmt(subtotal)} />
                        <TotalsRow label="Item Discount" subLabel="خصم الأصناف" value={fmt(itemDiscount)} />
                        <TotalsRow label="Invoice Discount" subLabel="خصم الفاتورة" value={fmt(invoiceDiscount || discountTotal)} />
                        <TotalsRow label="Promo Code Discount" subLabel="خصم الرمز الترويجي" value={fmt(promoDiscount)} />
                        <TotalsRow label="Total Taxable Amount" value={fmt(taxableAmount)} />
                        <TotalsRow label="VAT 15%" value={fmt(vatTotal)} />
                        <TotalsRow label="Total Invoice Amount" value={fmt(grandTotal)} bold />
                    </div>
                    <div className="invoice-total-section-title" style={{ marginTop: 10 }}>Maintenance checklist</div>
                    <div className="invoice-checklist-grid">
                        {CHECKLIST_LABELS.map(([en, ar], idx) => {
                            const checked = !!checklistChecks[idx];
                            return (
                                <div key={en} className="invoice-check-item">
                                    <span className="invoice-check-box">{checked ? '☑' : '☐'}</span>
                                    <span>
                                        <span className="invoice-check-en">{en}</span>
                                        <span className="invoice-check-ar">{ar}</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="invoice-thanks">Thank you — شكراً لزيارتكم</div>
                </div>

                {/* Actions */}
                <div className="invoice-actions">
                    <button className="invoice-btn invoice-btn-tertiary" onClick={handleDownload}>
                        <Download size={16} /> Download
                    </button>
                    <button className="invoice-btn invoice-btn-secondary" onClick={handlePrint}>
                        <Printer size={16} /> Print
                    </button>
                    <button className="invoice-btn invoice-btn-primary" onClick={onClose}>
                        <Check size={16} /> Done
                    </button>
                    <button className="invoice-btn invoice-btn-secondary" onClick={onClose}>
                        <X size={16} /> Close
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
                .invoice-total-section-title {
                    margin-top: 12px;
                    background: #FCC247;
                    color: #1E2124;
                    font-weight: 800;
                    padding: 8px 10px;
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
                .invoice-totals-sub {
                    display: block;
                    margin-top: 2px;
                    font-size: 11px;
                    font-weight: 500;
                    color: #6b7280;
                }
                .invoice-totals-value {
                    flex: 2;
                    padding: 8px 10px;
                    text-align: right;
                    font-size: 12px;
                    font-weight: 700;
                }
                .invoice-totals-row.bold .invoice-totals-label { font-size: 14px; font-weight: 800; }
                .invoice-totals-row.bold .invoice-totals-value { font-size: 14px; font-weight: 900; }
                .invoice-checklist-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px 14px;
                    border: 1px solid #1E2124;
                    border-top: none;
                    border-bottom: 1px solid #1E2124;
                    padding: 10px;
                    font-size: 12px;
                }
                .invoice-check-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                }
                .invoice-check-box { font-size: 14px; line-height: 1.1; }
                .invoice-check-en { display: block; font-weight: 600; color: #1E2124; }
                .invoice-check-ar { display: block; margin-top: 2px; color: #6b7280; font-size: 11px; }
                .invoice-thanks {
                    text-align: center;
                    margin-top: 10px;
                    color: #4b5563;
                    font-size: 13px;
                    font-weight: 600;
                }
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
                .invoice-btn-tertiary { background: #e2e8f0; color: #0f172a; }

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
                    @page {
                        size: A4 portrait;
                        margin: 2mm 6mm 6mm 6mm;
                    }

                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide app UI without collapsing DOM ancestors */
                    body * { visibility: hidden !important; }

                    /* Show the invoice and all its children */
                    .invoice-modal-root,
                    .invoice-modal-root * {
                        visibility: visible !important;
                    }

                    /* Anchor invoice to page top-left for print preview (avoid fixed; it repeats every page) */
                    .invoice-modal-root {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        display: block !important;
                        background: #fff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        z-index: 2147483647 !important;
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
                        padding: 0 !important;
                        transform: none !important;
                        width: 100% !important;
                    }

                    /* Remove grey preview look and normalize all table/grid lines */
                    .invoice-modal-root,
                    .invoice-modal-card,
                    .invoice-scroll {
                        background: #fff !important;
                    }

                    .invoice-info-table,
                    .invoice-items,
                    .invoice-totals,
                    .invoice-checklist-grid {
                        border: 1px solid #1E2124 !important;
                    }

                    .invoice-items-head > span,
                    .invoice-items-row > span,
                    .info-cell,
                    .invoice-totals-row,
                    .invoice-totals-label,
                    .invoice-check-item {
                        border-color: #1E2124 !important;
                        border-width: 1px !important;
                    }

                    .invoice-items-row {
                        border-top: 1px solid #1E2124 !important;
                    }

                    .invoice-items-head > span,
                    .invoice-items-row > span {
                        border-right: 1px solid #1E2124 !important;
                    }

                    .invoice-items-head > span:last-child,
                    .invoice-items-row > span:last-child {
                        border-right: none !important;
                    }

                    /* Prevent awkward splits between printed sections/rows */
                    .invoice-header,
                    .invoice-branch-strip,
                    .invoice-info-table,
                    .invoice-items,
                    .invoice-total-section-title,
                    .invoice-totals,
                    .invoice-checklist-grid,
                    .invoice-thanks {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-items-row,
                    .invoice-totals-row,
                    .info-pair-row,
                    .invoice-check-item {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-items-head {
                        display: flex !important;
                    }
                    .invoice-items-row > span,
                    .invoice-items-head > span,
                    .info-cell {
                        white-space: nowrap !important;
                    }
                    .invoice-thanks {
                        margin-top: 6px !important;
                        margin-bottom: 0 !important;
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

function TotalsRow({ label, subLabel, value, bold }) {
    return (
        <div className={`invoice-totals-row${bold ? ' bold' : ''}`}>
            <div className="invoice-totals-label">
                {label}
                {subLabel ? <span className="invoice-totals-sub">{subLabel}</span> : null}
            </div>
            <div className="invoice-totals-value">{value}</div>
        </div>
    );
}
