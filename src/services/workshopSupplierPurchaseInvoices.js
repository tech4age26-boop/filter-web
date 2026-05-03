/**
 * Helpers for workshop ↔ supplier purchase invoices
 * (POST/GET /workshop-staff/supplier-purchase-invoices, /supplier/workshop-purchase-invoices).
 *
 * POST body matches CreateWorkshopSupplierPurchaseInvoiceDto (nested fields; server may expect
 * snake_case `branch_id`, `issue_date`, `due_date`, and string `supplier.id`). Also sends camelCase
 * aliases. Nested `dueDate` is kept for compatibility. lines[].branchCatalogProductId, etc.
 */

function money2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/** Trimmed string id — used for `supplier.id` (`.trim()` on server) and `branch_id`. */
function toTrimmedIdString(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    return s === '' ? null : s;
}

/** `YYYY-MM-DD` for API (server expects `issue_date` / ISO date string). */
function normalizeIssueDateForApi(raw) {
    if (raw == null || raw === '') return undefined;
    const s = String(raw).trim();
    const head = s.length >= 10 ? s.slice(0, 10) : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
    const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
    if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const yr = parseInt(m[3], 10);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && yr >= 1900 && yr <= 2100) {
            return `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }
    return undefined;
}

/**
 * dueDate: object for server parseWorkshopPurchaseDueDate (camelCase — Nest DTO).
 * Maps payment_terms / net_days / custom / computed from the invoice UI.
 */
function buildDueDatePayload({
    dueDateType,
    netDays,
    customDueDate,
    issueDate,
    computedDueDate,
}) {
    const issue = normalizeIssueDateForApi(issueDate);
    const computed =
        computedDueDate && computedDueDate !== '—' && String(computedDueDate).trim() !== ''
            ? normalizeIssueDateForApi(computedDueDate)
            : undefined;
    if (dueDateType === 'Custom') {
        const custom = normalizeIssueDateForApi(customDueDate);
        return {
            type: 'Custom',
            customDate: custom,
            computedDueDate: computed || custom,
            netDays: undefined,
            issueDate: issue,
            issue_date: issue,
        };
    }
    if (dueDateType === 'EOM') {
        return {
            type: 'EOM',
            computedDueDate: computed,
            issueDate: issue,
            issue_date: issue,
        };
    }
    return {
        type: 'Net',
        netDays: Number(netDays) || 0,
        issueDate: issue,
        issue_date: issue,
        computedDueDate: computed,
    };
}

/**
 * Flat `YYYY-MM-DD` due date for APIs that require `due_date` (matches WorkshopPurchases due logic).
 */
function resolveFlatDueDateIso(p, duePayload, issueNorm) {
    const fromNested =
        normalizeIssueDateForApi(duePayload?.computedDueDate) ??
        normalizeIssueDateForApi(duePayload?.customDate);
    if (fromNested) return fromNested;

    const fromParam = normalizeIssueDateForApi(p.computedDueDate);
    if (fromParam) return fromParam;

    const issueStr = issueNorm ?? normalizeIssueDateForApi(p.issueDate);
    if (!issueStr) return undefined;

    const issue = new Date(`${issueStr}T12:00:00`);
    if (Number.isNaN(issue.getTime())) return undefined;

    const type = String(p.dueDateType || 'Net');
    if (type === 'Custom') {
        return normalizeIssueDateForApi(p.customDueDate);
    }
    if (type === 'EOM') {
        const eom = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return `${eom.getFullYear()}-${String(eom.getMonth() + 1).padStart(2, '0')}-${String(eom.getDate()).padStart(2, '0')}`;
    }
    const net = parseInt(p.netDays, 10) || 0;
    const due = new Date(issue);
    due.setDate(issue.getDate() + net);
    return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

/**
 * GET /workshop-staff/supplier-purchase-invoices/:id — unwrap nested invoice object from various API envelopes.
 * Workshop Nest handler returns `{ success: true, purchaseInvoice: formatWorkshopSupplierPurchaseInvoice(...) }`.
 */
export function unwrapWorkshopStaffSupplierPurchaseInvoiceGet(res) {
    if (!res || typeof res !== 'object') return null;
    if (res.purchaseInvoice != null && typeof res.purchaseInvoice === 'object') {
        return res.purchaseInvoice;
    }
    const inner =
        res.invoice ??
        res.purchaseInvoice ??
        res.purchase_invoice ??
        res.data?.invoice ??
        res.data?.purchaseInvoice ??
        res.data?.purchase_invoice ??
        (res.data && typeof res.data === 'object' && !Array.isArray(res.data) && (res.data.id ?? res.data._id) != null
            ? res.data
            : null);
    if (inner && typeof inner === 'object') return inner;
    if (res.id != null || res._id != null) return res;
    return null;
}

export function unwrapWorkshopSupplierPurchaseInvoiceList(res) {
    if (!res || typeof res !== 'object') return [];
    /** Primary: `invoices`. Legacy: `purchaseInvoices` / workshop `purchaseInvoices`. */
    const keys = ['invoices', 'purchaseInvoices', 'purchase_invoices', 'data', 'items', 'rows', 'results'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

function formatInvoiceQtyDisplay(n) {
    if (n == null || !Number.isFinite(n)) return null;
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function invoiceLineQty(line) {
    if (!line || typeof line !== 'object') return null;
    const raw = line.qty ?? line.quantity;
    if (raw == null || raw === '') return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

/** Non-empty trimmed UOM/unit string, or null if absent. */
function invoiceLineUomRaw(line) {
    if (!line || typeof line !== 'object') return null;
    const u = line.uom ?? line.unit ?? line.unitOfMeasure ?? line.unit_of_measure;
    const s = u != null ? String(u).trim() : '';
    return s === '' ? null : s;
}

/** Best-effort display name for a catalog / free-text invoice line */
function invoiceLineDisplayName(line) {
    if (!line || typeof line !== 'object') return '';
    const nested = line.product != null && typeof line.product === 'object' ? line.product : null;
    const candidates = [
        line.itemName,
        line.item_name,
        line.productName,
        line.product_name,
        nested?.name,
        line.description,
    ];
    for (const v of candidates) {
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== '') return s;
    }
    return '';
}

/**
 * Compact product column: first distinct line label; “(+N more)” when several products.
 */
export function workshopInvoiceProductNameSummary(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { product_label: '—' };
    }
    const distinct = [];
    for (const it of items) {
        const n = invoiceLineDisplayName(it);
        if (!n) continue;
        if (!distinct.includes(n)) distinct.push(n);
    }
    if (distinct.length === 0) return { product_label: '—' };
    if (distinct.length === 1) return { product_label: distinct[0] };
    return { product_label: `${distinct[0]} (+${distinct.length - 1} more)` };
}

/**
 * Labels for workshop purchase invoice list rows: aggregates qty when every line shares the same UOM;
 * otherwise shows first line qty with (+N).
 */
export function workshopInvoiceQtyUnitSummary(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { quantity_label: '—', unit_label: '—' };
    }
    const parsed = items.map((it) => ({
        qty: invoiceLineQty(it),
        uom: invoiceLineUomRaw(it),
    }));
    if (parsed.length === 1) {
        const p = parsed[0];
        return {
            quantity_label: p.qty != null ? formatInvoiceQtyDisplay(p.qty) : '—',
            unit_label: p.uom ?? '—',
        };
    }
    const distinctUoms = [...new Set(parsed.map((p) => p.uom).filter(Boolean))];
    const allSameUnit = distinctUoms.length <= 1;
    if (allSameUnit) {
        const sum = parsed.reduce((s, p) => s + (p.qty ?? 0), 0);
        const uomLabel = distinctUoms[0] ?? '—';
        return { quantity_label: formatInvoiceQtyDisplay(sum), unit_label: uomLabel };
    }
    const first = parsed[0];
    const extra = parsed.length - 1;
    return {
        quantity_label:
            first.qty != null ? `${formatInvoiceQtyDisplay(first.qty)} (+${extra})` : '—',
        unit_label: 'mixed',
    };
}

/** Map API invoice → WorkshopPurchases table row shape */
export function normalizeWorkshopSupplierPurchaseInvoiceRow(inv) {
    if (!inv || typeof inv !== 'object') return null;
    const id = inv.id ?? inv._id;
    if (id == null) return null;
    const supplier = inv.supplier && typeof inv.supplier === 'object' ? inv.supplier : null;
    const topVendor =
        [inv.vendor_name, inv.vendorName, inv.supplier_name, inv.supplierName].find(
            (v) => v != null && String(v).trim() !== '',
        ) ?? '';
    const vendorFallback =
        supplier?.supplierName ?? supplier?.name ?? inv.supplierName ?? inv.supplier_name ?? inv.vendorName ?? '';
    const vendorName = String(topVendor || vendorFallback).trim();
    const status = String(inv.status ?? inv.state ?? 'pending').toLowerCase();
    const sub = money2(
        inv.subtotalExVat ?? inv.subtotal_ex_vat ?? inv.subtotalExcludingVat ?? inv.subtotal ?? 0,
    );
    const items = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.lines) ? inv.lines : [];
    let vat = money2(
        inv.taxAmount ??
            inv.tax_amount ??
            inv.totalVat ??
            inv.total_vat ??
            inv.taxTotal ??
            inv.tax_total ??
            inv.vatAmount ??
            inv.vat_amount ??
            0,
    );
    if (vat === 0 && items.length > 0) {
        const sumLineTax = items.reduce(
            (s, line) =>
                s +
                money2(
                    line?.taxAmount ??
                        line?.tax_amount ??
                        line?.vatAmount ??
                        line?.vat_amount ??
                        line?.lineVat ??
                        line?.line_vat ??
                        0,
                ),
            0,
        );
        if (sumLineTax > 0) vat = sumLineTax;
    }
    const grand = money2(inv.grandTotal ?? inv.grand_total ?? inv.totalInclVat ?? inv.total ?? 0);
    const paid = money2(inv.paidAmount ?? inv.amountPaid ?? inv.amount_paid ?? 0);
    const balance = money2(
        inv.balance ?? inv.balanceDue ?? inv.balance_due ?? Math.max(0, grand - paid),
    );
    const stockUpdated =
        Boolean(
            inv.stockAppliedAt ??
                inv.stock_applied_at ??
                inv.stockUpdated ??
                inv.stock_updated ??
                inv.stockReceived ??
                inv.stock_received,
        ) || status === 'approved';
    const { quantity_label, unit_label } = workshopInvoiceQtyUnitSummary(items);
    const { product_label } = workshopInvoiceProductNameSummary(items);
    return {
        id: String(id),
        invoice_number:
            inv.invoiceNumber ?? inv.invoice_number ?? inv.reference ?? inv.ref ?? String(id).slice(0, 12),
        supplier: vendorName,
        vendor_name: vendorName,
        date: (inv.issueDate ?? inv.issue_date ?? inv.createdAt ?? inv.created_at ?? '').toString().slice(0, 10),
        due_date: (inv.dueDate ?? inv.due_date ?? '').toString().slice(0, 10) || null,
        vendor_invoice_ref:
            inv.vendorInvoiceRef ??
            inv.vendor_invoice_ref ??
            inv.vendorRef ??
            inv.refNumber ??
            inv.ref_number ??
            '',
        description: inv.description ?? inv.title ?? '',
        notes: inv.notes ?? inv.internalNotes ?? inv.internal_notes ?? '',
        subtotal: sub,
        vat_amount: vat,
        grand_total: grand,
        amount_paid: paid,
        balance_due: balance,
        payment_status: (inv.paymentStatus ?? inv.payment_status ?? (paid >= grand ? 'paid' : 'unpaid'))
            .toString()
            .toLowerCase(),
        status,
        stock_updated: stockUpdated,
        quantity_label,
        unit_label,
        product_label,
        items,
        _raw: inv,
    };
}

/**
 * POST /workshop-staff/supplier-purchase-invoices — CreateWorkshopSupplierPurchaseInvoiceDto (nested, camelCase).
 *
 * @param {object} p
 * @param {string|number} p.supplierId — linked supplier (numeric preferred)
 * @param {string|number} p.branchId — branch PK
 * @param {string} p.issueDate — YYYY-MM-DD
 * @param {'Net'|'Custom'|'EOM'} p.dueDateType
 * @param {number|string} p.netDays
 * @param {string} p.customDueDate — YYYY-MM-DD when Custom
 * @param {string} p.computedDueDate — YYYY-MM-DD from UI (no "—")
 * @param {string} [p.vendorInvoiceRef] → ref_number
 * @param {string} [p.description]
 * @param {string} [p.notes]
 * @param {string} [p.currency]
 * @param {string} [p.status] — e.g. draft (server still creates pending workflow)
 * @param {boolean} p.updateLastPurchasePriceOnSave
 * @param {boolean} p.showLineDescriptionColumn
 * @param {boolean} p.showLineDiscountColumn
 * @param {boolean} p.lineDiscountIsPercent — ui.line_discount_is_percent
 * @param {'fixed_sar'|'percent'|string} p.invoiceDiscountMode
 * @param {number} p.invoiceDiscountValue
 * @param {Array<object>} p.lines — from buildEnrichedLineItems
 * @param {object} p.totals — from computePurchaseInvoiceTotals (snake_case keys)
 */
export function buildCreateWorkshopSupplierPurchaseInvoiceBody(p) {
    const t = p.totals || {};
    const invMode = String(p.invoiceDiscountMode || 'fixed_sar');
    const discountType = invMode === 'percent' || invMode.toLowerCase().includes('percent') ? 'percent' : 'fixed';

    const lines = (p.lines || []).map((l) => {
        const pid = l.branch_catalog_product_id;
        const incl = money2(l.line_total_incl_vat);
        const branchPid = pid != null && String(pid).trim() !== '' ? String(pid) : null;
        const itemNameStr = String(l.item_name ?? l.itemName ?? l.item ?? '').trim();
        const desc = l.description || undefined;
        const acctCode = l.account_code || undefined;
        const acctName = l.account_name || undefined;
        const uom = l.uom || 'piece';
        const qty = money2(l.qty);
        const unitEx = money2(l.unit_price_ex_vat);
        const grossEx = money2(l.gross_ex_vat);
        const taxableEx = money2(l.taxable_ex_vat);
        const lineDiscRaw = l.line_discount_raw ?? 0;
        const lineDiscAmt = money2(l.line_discount_amount);
        const taxCd = l.tax_code || 'VAT 15%';
        const taxRt = l.tax_rate;
        const taxAmt = money2(l.tax_amount);
        const unitPurchaseIncl = money2(l.unit_purchase_price_incl_vat ?? l.unitPurchasePriceInclVat);
        return {
            branchCatalogProductId: branchPid,
            branch_catalog_product_id: branchPid,
            itemName: itemNameStr,
            item_name: itemNameStr,
            description: desc,
            accountCode: acctCode,
            account_code: acctCode,
            accountName: acctName,
            account_name: acctName,
            uom,
            quantity: qty,
            unitPriceExVat: unitEx,
            unit_price_ex_vat: unitEx,
            unitPurchasePriceInclVat: unitPurchaseIncl,
            unit_purchase_price_incl_vat: unitPurchaseIncl,
            grossExVat: grossEx,
            gross_ex_vat: grossEx,
            taxableExVat: taxableEx,
            taxable_ex_vat: taxableEx,
            lineDiscountRaw: lineDiscRaw,
            line_discount_raw: lineDiscRaw,
            lineDiscountAmount: lineDiscAmt,
            line_discount_amount: lineDiscAmt,
            taxCode: taxCd,
            tax_code: taxCd,
            taxRate: taxRt,
            tax_rate: taxRt,
            taxAmount: taxAmt,
            tax_amount: taxAmt,
            lineTotalInclVat: incl,
            line_total_incl_vat: incl,
            /** Line incl. VAT → DB `total` when present */
            total: incl,
        };
    });

    const issueNorm = normalizeIssueDateForApi(p.issueDate);

    const dueDatePayload = buildDueDatePayload({
        dueDateType: p.dueDateType || 'Net',
        netDays: p.netDays,
        customDueDate: p.customDueDate,
        issueDate: p.issueDate,
        computedDueDate: p.computedDueDate,
    });

    const dueNorm = resolveFlatDueDateIso(p, dueDatePayload, issueNorm);

    const branchIdStr = toTrimmedIdString(p.branchId);
    return {
        supplier: { id: toTrimmedIdString(p.supplierId) },
        branch_id: branchIdStr,
        branchId: branchIdStr,
        issueDate: issueNorm,
        issue_date: issueNorm,
        dueDate: dueDatePayload,
        due_date: dueNorm,
        vendorInvoiceRef: p.vendorInvoiceRef || undefined,
        description: p.description || undefined,
        notes: p.notes || undefined,
        currency: p.currency || 'SAR',
        status: p.status ?? 'draft',
        updateLastPurchasePriceOnSave: Boolean(p.updateLastPurchasePriceOnSave),
        ui: {
            showLineDescriptionColumn: Boolean(p.showLineDescriptionColumn),
            showLineDiscountColumn: Boolean(p.showLineDiscountColumn),
            lineDiscountIsPercent: Boolean(p.lineDiscountIsPercent),
        },
        invoiceDiscount: {
            mode: invMode,
            value: money2(p.invoiceDiscountValue ?? 0),
            discountType,
        },
        lines,
        totals: {
            lineGrossExVat: money2(t.line_gross_ex_vat),
            lineDiscountAmount: money2(t.line_discount_amount),
            linesTaxableExVat: money2(t.lines_taxable_ex_vat),
            linesTotalVat: money2(t.lines_total_vat),
            linesGrandTotalInclVat: money2(t.lines_grand_total_incl_vat),
            invoiceDiscountAppliedExVat: money2(t.invoice_discount_applied_ex_vat),
            subtotalExVat: money2(t.subtotal_ex_vat),
            totalVat: money2(t.total_vat),
            grandTotal: money2(t.grand_total),
        },
    };
}
