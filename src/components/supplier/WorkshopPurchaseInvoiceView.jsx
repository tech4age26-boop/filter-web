import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import './WorkshopPurchaseInvoiceView.css';

function money(n, currency = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return `—`;
    return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pick(inv, ...keys) {
    for (const k of keys) {
        if (inv && inv[k] != null && inv[k] !== '') return inv[k];
    }
    return null;
}

function lineDesc(line) {
    const nested = line?.product && typeof line.product === 'object' ? line.product : null;
    const candidates = [
        nested?.name,
        line?.itemName,
        line?.item_name,
        line?.productName,
        line?.product_name,
        line?.description,
        line?.productId,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    return '—';
}

function lineQty(line) {
    const q = line?.qty ?? line?.quantity;
    if (q == null || q === '') return '—';
    const n = Number(q);
    return Number.isFinite(n) ? String(n) : String(q);
}

function lineUom(line) {
    const u = line?.uom ?? line?.unit ?? line?.unitOfMeasure ?? line?.unit_of_measure;
    return u != null && String(u).trim() !== '' ? String(u).trim() : '—';
}

function lineUnitExVat(line) {
    const n = Number(
        line?.unitPriceExVat ?? line?.unit_price_ex_vat ?? line?.unitPrice ?? line?.unit_price ?? 0,
    );
    return Number.isFinite(n) ? n : 0;
}

function lineVatPct(line) {
    const r = line?.vatRate ?? line?.vat_rate ?? line?.taxRate;
    if (r == null) return null;
    const n = Number(r);
    if (!Number.isFinite(n)) return null;
    return n <= 1 ? n * 100 : n;
}

function lineVatAmount(line) {
    const v = Number(line?.vatAmount ?? line?.vat_amount ?? line?.lineVat ?? 0);
    return Number.isFinite(v) ? v : null;
}

function lineLineTotal(line) {
    const explicit = Number(line?.lineTotal ?? line?.line_total ?? line?.totalInclVat ?? line?.total ?? NaN);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const q = Number(line?.qty ?? line?.quantity ?? 0);
    const unit = lineUnitExVat(line);
    const ex = Number.isFinite(q) && Number.isFinite(unit) ? q * unit : 0;
    const vat = lineVatAmount(line);
    if (vat != null && Number.isFinite(vat)) return ex + vat;
    const pct = lineVatPct(line);
    if (pct != null && Number.isFinite(pct)) return ex * (1 + pct / 100);
    return ex;
}

function statusBadgeClass(s) {
    const x = String(s || '').toLowerCase();
    if (x === 'approved') return 'wpi-view__badge wpi-view__badge--approved';
    if (x === 'rejected') return 'wpi-view__badge wpi-view__badge--rejected';
    return 'wpi-view__badge wpi-view__badge--pending';
}

/**
 * Full invoice layout for supplier-side workshop purchase invoice view modal.
 * `detail`: GET invoice payload; `listRow`: normalized list row fallbacks.
 */
export default function WorkshopPurchaseInvoiceView({ detail, listRow }) {
    const inv = detail && typeof detail === 'object' ? detail : {};
    const row = listRow && typeof listRow === 'object' ? listRow : {};

    const invoiceNo =
        pick(inv, 'invoiceNumber', 'invoice_number', 'reference') ??
        row.invoice_number ??
        '—';

    const status = String(
        pick(inv, 'status', 'state') ?? row.status ?? '—',
    ).toLowerCase();

    const issueDate = (
        pick(inv, 'issueDate', 'issue_date', 'createdAt', 'created_at') ?? row.date ?? ''
    )
        .toString()
        .slice(0, 10);

    const dueDate = (
        pick(inv, 'dueDate', 'due_date') ?? row.due_date ?? ''
    )
        .toString()
        .slice(0, 10);

    const vendorRef =
        pick(inv, 'vendorInvoiceRef', 'vendor_invoice_ref', 'vendorRef', 'ref_number') ??
        row.vendor_invoice_ref ??
        '';

    const workshopLabel =
        pick(
            inv,
            'workshopName',
            'workshop_name',
            'branchName',
            'branch_name',
            'workshopBranchName',
        ) ??
        inv?.branch?.name ??
        inv?.workshop?.name ??
        inv?.workshop?.branchName ??
        '';

    const supplierLabel =
        pick(inv, 'supplierLegalName', 'supplier_name', 'supplierName', 'vendorName', 'vendor_name') ??
        inv?.supplier?.companyName ??
        inv?.supplier?.name ??
        row.vendor_name ??
        row.supplier ??
        '';

    const description = pick(inv, 'description', 'title') ?? '';
    const notes = pick(inv, 'notes', 'internalNotes', 'internal_notes') ?? row.notes ?? '';

    const items = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.lines) ? inv.lines : [];

    const subtotalEx = Number(
        pick(inv, 'subtotalExVat', 'subtotal_ex_vat', 'subtotalExcludingVat', 'subtotal') ??
            row.subtotal ??
            0,
    );
    const totalVat = Number(
        pick(inv, 'totalVat', 'total_vat', 'vatAmount', 'vat_amount') ?? row.vat_amount ?? 0,
    );
    const grand = Number(
        pick(inv, 'grandTotal', 'grand_total', 'totalInclVat', 'total') ?? row.grand_total ?? 0,
    );

    const paid = Number(pick(inv, 'amountPaid', 'amount_paid') ?? row.amount_paid ?? 0);
    const balance = Number(
        pick(inv, 'balanceDue', 'balance_due') ??
            row.balance_due ??
            Math.max(0, grand - paid),
    );

    const currency = pick(inv, 'currencyCode', 'currency') ?? 'SAR';

    /** Opens Filter public verify page — scanner opens browser URL (not raw JSON). */
    const verifyUrl = useMemo(() => {
        const internalId = pick(inv, 'id') ?? row.id;
        if (internalId == null || String(internalId).trim() === '') return '';
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/verify/wpi/${encodeURIComponent(String(internalId))}`;
    }, [inv, row.id]);

    const qrSrc = verifyUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=1&data=${encodeURIComponent(verifyUrl)}`
        : '';

    const [qrBroken, setQrBroken] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const printRootRef = useRef(null);

    const handleDownloadPdf = useCallback(async () => {
        const el = printRootRef.current;
        if (!el) return;
        setPdfBusy(true);
        try {
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ]);
            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('.wpi-view__btn-download').forEach((node) => node.remove());
                },
            });
            const imgData = canvas.toDataURL('image/png', 1);
            const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 36;
            const usableW = pageWidth - margin * 2;
            const usableH = pageHeight - margin * 2;
            const imgDisplayHeight = (canvas.height * usableW) / canvas.width;

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

            const safe = String(invoiceNo).replace(/[^\w.\-]+/g, '_').replace(/^_|_$/g, '').slice(0, 96) || 'invoice';
            pdf.save(`Filter-WPI-${safe}.pdf`);
        } catch (err) {
            console.error(err);
            window.alert('Could not create PDF. You can use your browser Print dialog and choose Save as PDF.');
        } finally {
            setPdfBusy(false);
        }
    }, [invoiceNo]);

    return (
        <div className="wpi-view" ref={printRootRef}>
            <div className="wpi-view__watermark-layer" aria-hidden="true">
                <span className="wpi-view__wm wpi-view__wm--primary">FILTER</span>
                <span className="wpi-view__wm wpi-view__wm--ring" />
            </div>
            <div className="wpi-view__surface">
                <header className="wpi-view__masthead">
                    <div className="wpi-view__masthead-text">
                        <p className="wpi-view__masthead-kicker">Filter</p>
                        <h3 className="wpi-view__masthead-title">Workshop purchase invoice</h3>
                        <p className="wpi-view__masthead-sub">Official workshop purchase document</p>
                    </div>
                    <div className="wpi-view__masthead-actions">
                        <button
                            type="button"
                            className="wpi-view__btn-download"
                            onClick={handleDownloadPdf}
                            disabled={pdfBusy}
                        >
                            <Download size={16} strokeWidth={2.5} aria-hidden />
                            {pdfBusy ? 'Preparing…' : 'Download PDF'}
                        </button>
                        <span className={statusBadgeClass(status)}>{status || '—'}</span>
                    </div>
                </header>

                <div className="wpi-view__doc-hero">
                    <p className="wpi-view__doc-label">Invoice no.</p>
                    <p className="wpi-view__doc-no">{invoiceNo}</p>
                    {description ? <p className="wpi-view__description">{description}</p> : null}
                </div>

                <div className="wpi-view__grid-2">
                <div className="wpi-view__box">
                    <h5>Issued by (workshop)</h5>
                    <div className="wpi-view__kv">
                        <div className="wpi-view__kv-row">
                            <span>Branch / workshop</span>
                            <span>{workshopLabel || '—'}</span>
                        </div>
                        {inv?.branch?.code || inv?.branchCode ? (
                            <div className="wpi-view__kv-row">
                                <span>Branch code</span>
                                <span>{inv.branch?.code ?? inv.branchCode}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="wpi-view__box">
                    <h5>Bill to (supplier)</h5>
                    <div className="wpi-view__kv">
                        <div className="wpi-view__kv-row">
                            <span>Supplier</span>
                            <span>{supplierLabel || '—'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="wpi-view__meta-row">
                <div className="wpi-view__meta-cell">
                    <label>Issue date</label>
                    <p>{issueDate || '—'}</p>
                </div>
                <div className="wpi-view__meta-cell">
                    <label>Due date</label>
                    <p>{dueDate || '—'}</p>
                </div>
                <div className="wpi-view__meta-cell">
                    <label>Vendor reference</label>
                    <p>{vendorRef || '—'}</p>
                </div>
                <div className="wpi-view__meta-cell">
                    <label>Payment</label>
                    <p className="wpi-view__payment-value">
                        {pick(inv, 'paymentStatus', 'payment_status') ?? row.payment_status ?? '—'}
                    </p>
                </div>
            </div>

            <div className="wpi-view__table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th className="wpi-view__num">Qty</th>
                            <th className="wpi-view__num">Unit</th>
                            <th className="wpi-view__num">Unit (ex VAT)</th>
                            <th className="wpi-view__num">VAT %</th>
                            <th className="wpi-view__num">Line total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="wpi-view__table-empty">
                                    No line items
                                </td>
                            </tr>
                        ) : (
                            items.map((line, i) => {
                                const vatPct = lineVatPct(line);
                                return (
                                    <tr
                                        key={line.id ?? line.lineId ?? i}
                                        className={i % 2 === 1 ? 'wpi-view__tr--stripe' : undefined}
                                    >
                                        <td>{i + 1}</td>
                                        <td>{lineDesc(line)}</td>
                                        <td className="wpi-view__num">{lineQty(line)}</td>
                                        <td className="wpi-view__num">{lineUom(line)}</td>
                                        <td className="wpi-view__num">{money(lineUnitExVat(line), currency)}</td>
                                        <td className="wpi-view__num">
                                            {vatPct != null ? `${vatPct.toFixed(0)}%` : '—'}
                                        </td>
                                        <td className="wpi-view__num">{money(lineLineTotal(line), currency)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="wpi-view__totals">
                <div className="wpi-view__totals-lines">
                    <div className="wpi-view__kv-row">
                        <span>Subtotal (ex VAT)</span>
                        <span>{money(subtotalEx, currency)}</span>
                    </div>
                    <div className="wpi-view__kv-row">
                        <span>VAT</span>
                        <span>{money(totalVat, currency)}</span>
                    </div>
                    <div className="wpi-view__kv-row wpi-view__grand">
                        <span>Grand total</span>
                        <span>{money(grand, currency)}</span>
                    </div>
                    {(paid > 0 || balance > 0) && (
                        <>
                            <div className="wpi-view__kv-row wpi-view__kv-row--spaced">
                                <span>Amount paid</span>
                                <span>{money(paid, currency)}</span>
                            </div>
                            <div className="wpi-view__kv-row">
                                <span>Balance due</span>
                                <span>{money(balance, currency)}</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="wpi-view__qr">
                    {verifyUrl && qrSrc && !qrBroken ? (
                        <img
                            src={qrSrc}
                            width={140}
                            height={140}
                            alt="Open Filter invoice verification page"
                            onError={() => setQrBroken(true)}
                        />
                    ) : verifyUrl && qrBroken ? (
                        <div className="wpi-view__qr-fallback">
                            QR image blocked — open the link manually below.
                        </div>
                    ) : (
                        <div className="wpi-view__qr-fallback wpi-view__qr-fallback--muted">
                            Invoice id missing — cannot build verify link.
                        </div>
                    )}
                    <p className="wpi-view__qr-caption">
                        Scan opens your browser on Filter&apos;s public verification page (live check against our
                        database — not a static JSON blob).
                    </p>
                    {verifyUrl ? (
                        <a className="wpi-view__verify-link" href={verifyUrl} target="_blank" rel="noopener noreferrer">
                            {verifyUrl}
                        </a>
                    ) : null}
                </div>
            </div>

                {notes ? (
                    <div className="wpi-view__notes">
                        <strong>Notes</strong>
                        <div className="wpi-view__notes-body">{notes}</div>
                    </div>
                ) : null}

                <footer className="wpi-view__footer">
                    <p className="wpi-view__footer-line">Thank you for your business.</p>
                    <p className="wpi-view__footer-meta">
                        Scan the QR code to verify this document on Filter — authenticity is checked against our live
                        records.
                    </p>
                </footer>
            </div>
        </div>
    );
}
