import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, ShoppingCart, BarChart3, AlertTriangle, Calendar, Zap, Eye } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    getWorkshopStaffBranchProducts,
    getWorkshopSuppliers,
    getRegisteredWorkshopSuppliers,
    branchScopeParams,
    createWorkshopSupplierPurchaseInvoice,
    getWorkshopSupplierPurchaseInvoice,
    listWorkshopSupplierPurchaseInvoices,
    unwrapWorkshopBranchListResponse,
} from '../../services/workshopStaffApi';
import { getBranchProducts } from '../../services/workshopCatalogApi';
import {
    buildCreateWorkshopSupplierPurchaseInvoiceBody,
    extractWorkshopPurchaseInvoiceUiFromPayload,
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopStaffSupplierPurchaseInvoiceGet,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import { PI_ACCOUNT_OPTIONS } from './constants';
import {
    PURCHASE_INVOICE_VAT_RATE as VAT_RATE,
    PURCHASE_INVOICE_TAX_LABEL as TAX_LABEL,
    computeLineAmounts,
    computePurchaseInvoiceTotals,
    buildPurchaseInvoicePayload,
    buildEnrichedLineItems,
} from './purchaseInvoicePayload';

const SUPPLIERS_PAGE_LIMIT = 500;

function unwrapSuppliersResponse(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    const keys = ['suppliers', 'data', 'items'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

/** Top-level or nested pagination from GET /workshop-staff/suppliers. */
function pickListMeta(res) {
    if (!res || typeof res !== 'object') {
        return { total: null, limit: null, offset: null };
    }
    const p = res.pagination;
    const total = res.total ?? p?.total ?? res.count ?? null;
    const limit = res.limit ?? p?.limit ?? null;
    const offset = res.offset ?? p?.offset ?? null;
    return { total: total != null ? Number(total) : null, limit, offset };
}

function normalizeSupplierRow(s) {
    const id = String(s.id ?? s._id ?? '');
    const name = s.supplierName ?? s.name ?? '';
    if (!id) return null;
    return { id, name: name || '—', raw: s };
}

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function firstNonEmptyString(...candidates) {
    for (const c of candidates) {
        if (c == null) continue;
        const s = String(c).trim();
        if (s !== '') return s;
    }
    return '';
}

function pickBranchCatalogItemId(row, nested) {
    const raw =
        nested?.id ??
        nested?.productId ??
        nested?.serviceId ??
        row?.productId ??
        row?.product_id ??
        row?.catalogProductId ??
        row?.catalog_product_id ??
        row?.branchProductId ??
        row?.branch_product_id ??
        row?.inventoryProductId ??
        row?.inventory_product_id ??
        row?.serviceId ??
        row?.service_id ??
        row?.id;
    if (raw == null || raw === '') return '';
    return String(raw);
}

/** Branch rows often put `name` on the row while `product` / `service` is a pricing snapshot without a label. */
function pickBranchCatalogItemName(row, nested) {
    return (
        firstNonEmptyString(
            row?.name,
            row?.productName,
            row?.serviceName,
            row?.title,
            row?.label,
            row?.nameEn,
            row?.name_en,
            row?.nameAr,
            row?.name_ar,
            nested?.name,
            nested?.productName,
            nested?.serviceName,
            nested?.title,
            nested?.label,
            nested?.nameEn,
            nested?.name_en,
            nested?.nameAr,
            nested?.name_ar,
            row?.sku,
            nested?.sku,
        ) || ''
    );
}

function pickBranchCatalogItemUnit(row, nested) {
    return firstNonEmptyString(nested?.unit, nested?.uom, row?.unit, row?.uom) || 'piece';
}

/**
 * Ex-VAT unit for purchase lines (UNIT PRICE column).
 * Prefer purchase price (treated as VAT-inclusive) ÷ (1 + VAT), then fallback to
 * explicit before-VAT sale/selling fields, then inclusive sale/selling fallback.
 */
function pickPriceExclusiveUnit(row) {
    const nested = row?.product ?? row?.service;
    const snap = nested != null && typeof nested === 'object' ? nested : null;

    const purchaseInclusiveCandidates = [
        snap?.purchasePrice,
        snap?.purchase_price,
        row?.purchasePrice,
        row?.purchase_price,
    ];
    for (const v of purchaseInclusiveCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            return roundMoney2(n / (1 + VAT_RATE));
        }
    }

    const beforeVatCandidates = [
        snap?.salePriceBeforeVat,
        snap?.sale_price_before_vat,
        snap?.sellingPriceBeforeVat,
        snap?.selling_price_before_vat,
        row?.salePriceBeforeVat,
        row?.sale_price_before_vat,
        row?.sellingPriceBeforeVat,
        row?.selling_price_before_vat,
    ];
    for (const v of beforeVatCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            return roundMoney2(n);
        }
    }

    const inclusiveRaw = Number(
        row?.salePriceOverride ??
            row?.sellingPriceOverride ??
            row?.salePrice ??
            row?.sellingPrice ??
            snap?.salePriceOverride ??
            snap?.sellingPriceOverride ??
            snap?.salePrice ??
            snap?.sellingPrice ??
            snap?.sale_price ??
            snap?.selling_price ??
            snap?.basePrice ??
            snap?.price ??
            0,
    );
    if (Number.isFinite(inclusiveRaw) && inclusiveRaw > 0) {
        return roundMoney2(inclusiveRaw / (1 + VAT_RATE));
    }

    return 0;
}

/** VAT-inclusive purchase unit (branch/catalog purchase price when set). */
function pickPriceInclusivePurchaseUnit(row) {
    const nested = row?.product ?? row?.service;
    const snap = nested != null && typeof nested === 'object' ? nested : null;
    const purchaseInclusiveCandidates = [
        snap?.purchasePrice,
        snap?.purchase_price,
        row?.purchasePrice,
        row?.purchase_price,
    ];
    for (const v of purchaseInclusiveCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            return roundMoney2(n);
        }
    }
    const ex = pickPriceExclusiveUnit(row);
    if (ex > 0) return roundMoney2(ex * (1 + VAT_RATE));
    return 0;
}

function normalizeBranchProductOption(row) {
    if (!row || typeof row !== 'object') return null;
    const nested = row?.product ?? row?.service;
    const id = pickBranchCatalogItemId(row, nested);
    if (!id) return null;
    const name =
        pickBranchCatalogItemName(row, nested) ||
        `Item ${id.slice(0, 8)}${id.length > 8 ? '…' : ''}`;
    const unit = pickBranchCatalogItemUnit(row, nested);
    const isService =
        row?.service != null ||
        row?.itemType === 'service' ||
        String(nested?.type || row?.type || '').toLowerCase() === 'service';
    const type = isService ? 'service' : 'Stock';
    const priceExcl = pickPriceExclusiveUnit(row);
    const priceIncl = pickPriceInclusivePurchaseUnit(row);
    return { id, name, unit, type, priceExcl, priceIncl };
}

function createEmptyLine() {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        productId: '',
        item: '',
        account: '1410 - Inventory Asset',
        description: '',
        uom: 'piece',
        qty: 1,
        price: 0,
        discount: 0,
        taxCode: TAX_LABEL,
        taxAmt: '0.00',
        totalFinal: '0.00',
    };
}

function mapPurchaseInvoiceLineForView(line, idx) {
    if (!line || typeof line !== 'object') {
        return {
            key: `line-${idx}`,
            item: '—',
            account: '—',
            desc: '',
            uom: 'piece',
            qty: 0,
            unitEx: 0,
            lineDisc: 0,
            taxAmt: 0,
            totalIncl: 0,
            taxCode: TAX_LABEL,
            taxableFromApi: null,
        };
    }
    const nested = line.product && typeof line.product === 'object' ? line.product : null;
    const item =
        line.itemName ??
        line.item_name ??
        line.productName ??
        line.product_name ??
        nested?.name ??
        line.description ??
        '—';
    const acct =
        [
            line.accountName,
            line.account_name,
            line.accountCode,
            line.account_code,
            nested?.accountName,
            nested?.account_name,
            line.account?.name,
            line.account?.code,
        ]
            .map((x) => (x != null ? String(x).trim() : ''))
            .find((s) => s !== '') ?? '—';
    const desc = String(
        line.lineDescription ?? line.line_description ?? line.description ?? line.notes ?? '',
    ).trim();
    const uom = String(line.uom ?? line.unit ?? 'piece').trim() || 'piece';
    const qty = Number(line.quantity ?? line.qty ?? 0);
    let unitEx = roundMoney2(
        line.unitPriceExVat ??
            line.unit_price_ex_vat ??
            line.unitPrice ??
            line.unit_price ??
            line.priceExVat ??
            line.price_ex_vat ??
            0,
    );
    const lineDisc = roundMoney2(
        line.discount ?? line.lineDiscountAmount ?? line.line_discount_amount ?? line.lineDiscountRaw ?? 0,
    );
    const taxAmt = roundMoney2(line.taxAmount ?? line.tax_amount ?? 0);
    /** Workshop GET formatter: `total` = incl. VAT; `lineTotal` = ex-VAT line base (taxable), not incl. total. */
    const totalIncl = roundMoney2(line.total ?? line.lineTotalInclVat ?? line.line_total_incl_vat ?? 0);
    const taxCode = String(line.taxCode ?? line.tax_code ?? TAX_LABEL).trim() || TAX_LABEL;
    const ltRaw = line.lineTotal ?? line.line_total;
    const taxableFromLineTotal =
        ltRaw != null && ltRaw !== '' && Number.isFinite(Number(ltRaw)) ? roundMoney2(ltRaw) : null;
    const taxableRaw = line.taxableExVat ?? line.taxable_ex_vat ?? line.grossExVat ?? line.gross_ex_vat;
    const taxableFromNamed =
        taxableRaw != null && taxableRaw !== '' && Number.isFinite(Number(taxableRaw))
            ? roundMoney2(taxableRaw)
            : null;
    const taxableFromApi = taxableFromLineTotal ?? taxableFromNamed;
    if (unitEx === 0 && qty > 0 && totalIncl > 0) {
        const impliedEx = roundMoney2(totalIncl - taxAmt);
        if (impliedEx > 0) unitEx = roundMoney2(impliedEx / qty);
    }
    return {
        key: String(line.id ?? line._id ?? `line-${idx}`),
        item,
        account: acct,
        desc,
        uom,
        qty: Number.isFinite(qty) ? qty : 0,
        unitEx,
        lineDisc,
        taxAmt,
        totalIncl,
        taxCode,
        taxableFromApi,
    };
}

function pickViewInvoiceUi(raw, items = []) {
    const ui = extractWorkshopPurchaseInvoiceUiFromPayload(raw);
    const list = Array.isArray(items) ? items : [];
    const lineHasDisc = list.some((it) => {
        const d = Number(it?.discount ?? it?.lineDiscountAmount ?? it?.line_discount_amount ?? 0);
        return Number.isFinite(d) && d !== 0;
    });
    const headerDiscAmt = Number(raw?.discountAmount ?? raw?.discount_amount ?? 0);
    const headerHasDisc = Number.isFinite(headerDiscAmt) && headerDiscAmt !== 0;
    const rawDiscType = String(raw?.discountType ?? raw?.discount_type ?? '').toLowerCase();
    const line0DiscType = list.length
        ? String(list[0]?.discountType ?? list[0]?.discount_type ?? '').toLowerCase()
        : '';
    const anyLineDesc = list.some((it) => String(it?.description ?? '').trim().length > 0);
    return {
        showDesc:
            Boolean(ui.showLineDescriptionColumn ?? ui.show_line_description_column ?? true) || anyLineDesc,
        showDiscount:
            Boolean(ui.showLineDiscountColumn ?? ui.show_line_discount_column) ||
            lineHasDisc ||
            headerHasDisc,
        discountIsPercent:
            Boolean(ui.lineDiscountIsPercent ?? ui.line_discount_is_percent) ||
            rawDiscType === 'percent' ||
            (lineHasDisc && line0DiscType === 'percent'),
        amountsTaxInclusive: Boolean(ui.amountsTaxInclusive ?? ui.amounts_tax_inclusive),
    };
}

function formatViewInvoiceDiscount(raw) {
    if (!raw || typeof raw !== 'object') return '—';
    const disc = raw.invoiceDiscount ?? raw.invoice_discount;
    if (disc && typeof disc === 'object') {
        const mode = String(disc.mode ?? disc.type ?? 'fixed_sar');
        const val = Number(disc.value ?? disc.amount ?? 0);
        if (Number.isFinite(val) && val !== 0) {
            if (/percent/i.test(mode)) return `${val}%`;
            return `SAR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }
    const flatAmt = Number(raw.discountAmount ?? raw.discount_amount ?? 0);
    if (Number.isFinite(flatAmt) && flatAmt !== 0) {
        const dt = String(raw.discountType ?? raw.discount_type ?? 'fixed');
        if (/percent/i.test(dt)) return `${flatAmt}%`;
        return `SAR ${flatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return '—';
}

export default function WorkshopPurchases({ tabState, clearTabState, selectedBranchId, branches = [] }) {
    const [activeTab, setActiveTab] = useState('invoices');
    const [filterSupplier, setFilterSupplier] = useState('all');
    const [filterProduct, setFilterProduct] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [showDesc, setShowDesc] = useState(true);
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountIsPercent, setDiscountIsPercent] = useState(false);
    const [issueDate, setIssueDate] = useState('2026-03-08');
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('2026-04-07');
    const [selectedVendor, setSelectedVendor] = useState('');
    const [vendorInvoiceRef, setVendorInvoiceRef] = useState('');
    const [invoiceDescription, setInvoiceDescription] = useState('');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState('fixed_sar');
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const [freightSar, setFreightSar] = useState('0');
    const [updateLastPurchasePrice, setUpdateLastPurchasePrice] = useState(true);
    const amountsInclusivePrevRef = useRef(false);
    const amountsInclusiveInitRef = useRef(false);
    const [linkedSuppliers, setLinkedSuppliers] = useState([]);
    const [linkedSuppliersLoading, setLinkedSuppliersLoading] = useState(false);
    const [linkedSuppliersError, setLinkedSuppliersError] = useState('');
    const [linkedSuppliersUsingRegisteredFallback, setLinkedSuppliersUsingRegisteredFallback] = useState(false);
    const [lineItems, setLineItems] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [invoicesError, setInvoicesError] = useState('');
    const [submitInvoiceError, setSubmitInvoiceError] = useState('');
    const [submittingInvoice, setSubmittingInvoice] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewInvoiceRow, setViewInvoiceRow] = useState(null);
    const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
    const [viewInvoiceError, setViewInvoiceError] = useState('');
    /** Branch that receives stock for this invoice (modal); independent of sidebar when user picks another branch. */
    const [invoiceBranchId, setInvoiceBranchId] = useState('');

    const effectiveBranchId = useMemo(() => {
        if (selectedBranchId && selectedBranchId !== 'all') return selectedBranchId;
        return branches[0]?.id ?? null;
    }, [selectedBranchId, branches]);

    const [branchProductOptions, setBranchProductOptions] = useState([]);
    const [branchProductsLoading, setBranchProductsLoading] = useState(false);
    const [branchProductsError, setBranchProductsError] = useState('');

    const loadBranchProducts = useCallback(async () => {
        if (!invoiceBranchId) {
            setBranchProductOptions([]);
            return;
        }
        setBranchProductsLoading(true);
        setBranchProductsError('');
        try {
            const prodRes = await getWorkshopStaffBranchProducts(invoiceBranchId);
            let prodRows = unwrapWorkshopBranchListResponse(prodRes, 'products');
            if (prodRows.length === 0) {
                try {
                    prodRows = unwrapWorkshopBranchListResponse(
                        await getBranchProducts(invoiceBranchId),
                        'products',
                    );
                } catch {
                    /* keep empty */
                }
            }
            const opts = prodRows.map(normalizeBranchProductOption).filter((o) => o && o.type !== 'service');
            opts.sort((a, b) => a.name.localeCompare(b.name));
            setBranchProductOptions(opts);
        } catch (e) {
            setBranchProductsError(e.message || 'Could not load branch products.');
            setBranchProductOptions([]);
        } finally {
            setBranchProductsLoading(false);
        }
    }, [invoiceBranchId]);

    const loadLinkedSuppliers = useCallback(async () => {
        setLinkedSuppliersLoading(true);
        setLinkedSuppliersError('');
        setLinkedSuppliersUsingRegisteredFallback(false);
        try {
            let offset = 0;
            const merged = [];
            let hardCap = 60;
            while (hardCap-- > 0) {
                const scopeBranch = modalOpen && invoiceBranchId ? invoiceBranchId : effectiveBranchId;
                const res = await getWorkshopSuppliers({
                    ...branchScopeParams(scopeBranch ?? 'all'),
                    limit: SUPPLIERS_PAGE_LIMIT,
                    offset,
                });
                const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter(Boolean);
                merged.push(...rows);
                const { total } = pickListMeta(res);
                if (total != null && merged.length >= total) break;
                if (rows.length < SUPPLIERS_PAGE_LIMIT) break;
                offset += SUPPLIERS_PAGE_LIMIT;
            }
            setLinkedSuppliers(merged);
        } catch (e) {
            const msg = String(e?.message || '');
            const missingWorkshopIdColumn =
                msg.includes('suppliers.workshop_id') || msg.includes('workshop_id');
            const unauthorized = /unauthorized|401|forbidden|403|jwt|token/i.test(msg);
            if (missingWorkshopIdColumn || unauthorized) {
                try {
                    const res = await getRegisteredWorkshopSuppliers({
                        limit: SUPPLIERS_PAGE_LIMIT,
                        offset: 0,
                    });
                    const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter(Boolean);
                    const linkedOnly = rows.filter(
                        (r) =>
                            r?.raw?.isLinkedToWorkshop === true ||
                            r?.raw?.is_linked_to_workshop === true ||
                            r?.raw?.linkedToWorkshop === true,
                    );
                    setLinkedSuppliers(linkedOnly);
                    setLinkedSuppliersUsingRegisteredFallback(true);
                    setLinkedSuppliersError(
                        missingWorkshopIdColumn
                            ? 'Loaded via fallback: workshop suppliers list is unavailable (backend schema). Showing linked suppliers only.'
                            : 'Loaded via fallback: workshop suppliers endpoint is not authorized. Showing linked suppliers only.',
                    );
                    return;
                } catch {
                    // fallthrough
                }
            }
            setLinkedSuppliers([]);
            setLinkedSuppliersError(e.message || 'Could not load workshop suppliers.');
        } finally {
            setLinkedSuppliersLoading(false);
        }
    }, [effectiveBranchId, modalOpen, invoiceBranchId]);

    const loadPurchaseInvoices = useCallback(async () => {
        if (!effectiveBranchId) {
            setInvoices([]);
            return;
        }
        setInvoicesLoading(true);
        setInvoicesError('');
        try {
            const res = await listWorkshopSupplierPurchaseInvoices({
                limit: 100,
                offset: 0,
                ...branchScopeParams(effectiveBranchId),
            });
            const list = unwrapWorkshopSupplierPurchaseInvoiceList(res);
            setInvoices(list.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean));
        } catch (e) {
            setInvoices([]);
            setInvoicesError(e.message || 'Could not load purchase invoices.');
        } finally {
            setInvoicesLoading(false);
        }
    }, [effectiveBranchId]);

    const closeViewInvoiceModal = useCallback(() => {
        setViewModalOpen(false);
        setViewInvoiceRow(null);
        setViewInvoiceError('');
        setViewInvoiceLoading(false);
    }, []);

    const openViewInvoiceModal = useCallback(async (listRow) => {
        if (!listRow?.id) return;
        setViewModalOpen(true);
        setViewInvoiceLoading(true);
        setViewInvoiceError('');
        setViewInvoiceRow(listRow);
        try {
            const res = await getWorkshopSupplierPurchaseInvoice(listRow.id);
            const inv = unwrapWorkshopStaffSupplierPurchaseInvoiceGet(res) ?? (res && typeof res === 'object' ? res : null);
            const normalized = normalizeWorkshopSupplierPurchaseInvoiceRow(inv);
            if (normalized) {
                setViewInvoiceRow(normalized);
            } else {
                setViewInvoiceError('Invoice response was empty.');
            }
        } catch (e) {
            setViewInvoiceError(e.message || 'Could not load invoice details.');
        } finally {
            setViewInvoiceLoading(false);
        }
    }, []);

    const viewLineRows = useMemo(() => {
        if (!viewInvoiceRow?.items?.length) return [];
        return viewInvoiceRow.items.map((line, idx) => mapPurchaseInvoiceLineForView(line, idx));
    }, [viewInvoiceRow]);

    const viewUi = useMemo(
        () => pickViewInvoiceUi(viewInvoiceRow?._raw, viewInvoiceRow?.items),
        [viewInvoiceRow],
    );

    const viewDiscountLabel = useMemo(() => formatViewInvoiceDiscount(viewInvoiceRow?._raw), [viewInvoiceRow]);

    useEffect(() => {
        loadPurchaseInvoices();
    }, [loadPurchaseInvoices]);

    /** When opening the composer, default invoice branch from sidebar / first branch (before paint). */
    useLayoutEffect(() => {
        if (!modalOpen) return;
        if (branches.length === 0) {
            setInvoiceBranchId('');
            return;
        }
        const next =
            selectedBranchId && selectedBranchId !== 'all'
                ? String(selectedBranchId)
                : String(branches[0].id);
        setInvoiceBranchId((prev) => (prev === next ? prev : next));
    }, [modalOpen, selectedBranchId, branches]);

    useEffect(() => {
        if (!modalOpen || !invoiceBranchId) return;
        loadBranchProducts();
        loadLinkedSuppliers();
    }, [modalOpen, invoiceBranchId, loadBranchProducts, loadLinkedSuppliers]);

    const handleInvoiceBranchChange = (branchId) => {
        const id = String(branchId ?? '');
        if (!id || id === invoiceBranchId) return;
        setInvoiceBranchId(id);
        setLineItems([createEmptyLine()]);
    };

    useEffect(() => {
        if (activeTab !== 'price_report') return;
        loadLinkedSuppliers();
    }, [activeTab, loadLinkedSuppliers]);

    useEffect(() => {
        if (!tabState?.autoOpenModal) return;
        setModalOpen(true);
        if (tabState.prefillSupplier?.name) {
            setSelectedVendor(String(tabState.prefillSupplier.name));
        }
        if (tabState.selectedItem) {
            const item = tabState.selectedItem;
            const unit = amountsTaxInclusive ? pickPriceInclusivePurchaseUnit(item) : pickPriceExclusiveUnit(item);
            const priceExclForTax = amountsTaxInclusive ? roundMoney2(unit / (1 + VAT_RATE)) : unit;
            const taxAmt = priceExclForTax * VAT_RATE;
            const totalFinal = priceExclForTax * (1 + VAT_RATE);
            const newLine = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                productId: String(item.id ?? ''),
                item: item.name,
                account: '1410 - Inventory Asset',
                description: '',
                uom: item.unit || 'piece',
                qty: 1,
                price: unit,
                discount: 0,
                taxCode: TAX_LABEL,
                taxAmt: taxAmt.toFixed(2),
                totalFinal: totalFinal.toFixed(2),
            };
            setLineItems([newLine]);
        }
        if (clearTabState) clearTabState();
    }, [tabState, clearTabState, amountsTaxInclusive]);

    const applyDiscountForCalc = showDiscount;

    const lineAmountOpts = useMemo(
        () => ({ unitPriceTaxInclusive: amountsTaxInclusive }),
        [amountsTaxInclusive],
    );

    const recalcStoredLineTotals = (line) => {
        const { taxAmt, totalIncl } = computeLineAmounts(
            line,
            applyDiscountForCalc,
            discountIsPercent,
            VAT_RATE,
            lineAmountOpts,
        );
        return {
            ...line,
            taxCode: TAX_LABEL,
            taxAmt: taxAmt.toFixed(2),
            totalFinal: totalIncl.toFixed(2),
        };
    };

    const updateLineItem = (id, field, value) => {
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const updatedLine = { ...line, [field]: value };
                return recalcStoredLineTotals(updatedLine);
            }),
        );
    };

    useEffect(() => {
        setLineItems((prev) =>
            prev.map((line) => {
                const { taxAmt, totalIncl } = computeLineAmounts(
                    line,
                    showDiscount,
                    discountIsPercent,
                    VAT_RATE,
                    lineAmountOpts,
                );
                return {
                    ...line,
                    taxCode: TAX_LABEL,
                    taxAmt: taxAmt.toFixed(2),
                    totalFinal: totalIncl.toFixed(2),
                };
            }),
        );
    }, [showDiscount, discountIsPercent, lineAmountOpts]);

    /** When toggling tax-inclusive mode, convert stored unit prices between ex-VAT and VAT-inclusive. */
    useEffect(() => {
        if (!amountsInclusiveInitRef.current) {
            amountsInclusiveInitRef.current = true;
            amountsInclusivePrevRef.current = amountsTaxInclusive;
            return;
        }
        const prev = amountsInclusivePrevRef.current;
        amountsInclusivePrevRef.current = amountsTaxInclusive;
        if (prev === amountsTaxInclusive) return;
        setLineItems((prevLines) =>
            prevLines.map((line) => {
                const p = parseFloat(line.price) || 0;
                if (p === 0) return line;
                if (amountsTaxInclusive && !prev) {
                    return { ...line, price: roundMoney2(p * (1 + VAT_RATE)) };
                }
                if (!amountsTaxInclusive && prev) {
                    return { ...line, price: roundMoney2(p / (1 + VAT_RATE)) };
                }
                return line;
            }),
        );
    }, [amountsTaxInclusive]);

    const handleLineProductChange = (lineId, productId) => {
        if (!productId) {
            setLineItems((prev) =>
                prev.map((line) => {
                    if (line.id !== lineId) return line;
                    const cleared = {
                        ...line,
                        productId: '',
                        item: '',
                        price: 0,
                        uom: 'piece',
                        account: '1410 - Inventory Asset',
                    };
                    return recalcStoredLineTotals(cleared);
                }),
            );
            return;
        }
        const opt = branchProductOptions.find((o) => o.id === productId);
        if (!opt) return;
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const next = {
                    ...line,
                    productId: opt.id,
                    item: opt.name,
                    uom: opt.unit,
                    account:
                        opt.type === 'Stock'
                            ? '1410 - Inventory Asset'
                            : '5100 - Cost of Goods Sold',
                    price: amountsTaxInclusive ? opt.priceIncl || opt.priceExcl : opt.priceExcl,
                };
                return recalcStoredLineTotals(next);
            }),
        );
    };

    const freightNum = useMemo(
        () => parseFloat(String(freightSar).replace(',', '.')) || 0,
        [freightSar],
    );

    const invoiceTotals = useMemo(
        () =>
            computePurchaseInvoiceTotals({
                lineItems,
                applyLineDiscount: applyDiscountForCalc,
                lineDiscountIsPercent: discountIsPercent,
                invoiceDiscountMode,
                invoiceDiscountValue,
                vatRate: VAT_RATE,
                unitPriceTaxInclusive: amountsTaxInclusive,
                freightIn: freightNum,
            }),
        [
            lineItems,
            applyDiscountForCalc,
            discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue,
            amountsTaxInclusive,
            freightNum,
        ],
    );

    const getSummary = () => ({
        subtotal: invoiceTotals.subtotal_ex_vat.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }),
        totalTax: invoiceTotals.total_vat.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }),
        freight: (invoiceTotals.freight_in ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }),
        grandTotal: invoiceTotals.grand_total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }),
    });

    const addEmptyLine = () => {
        setLineItems((prev) => [...prev, createEmptyLine()]);
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str) return '';
        if (!/^[\d\s+\-*/.()]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            const result = Function(`return (${str})`)();
            if (typeof result === 'number' && isFinite(result)) return parseFloat(result.toFixed(6)).toString();
        } catch {
            /* invalid */
        }
        return str;
    };

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const v = evalMath(e.target.value);
            updateLineItem(lineId, field, v);
            e.target.value = v;
        }
    };
    const handleMathBlur = (e, lineId, field) => {
        const v = evalMath(e.target.value);
        if (v !== e.target.value) updateLineItem(lineId, field, v);
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') due.setDate(issue.getDate() + parseInt(netDays || 0, 10));
        else if (dueDateType === 'Custom') return customDueDate;
        else if (dueDateType === 'EOM') due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    };

    const summary = getSummary();

    const totalPayables = invoices
        .filter((i) => i.payment_status !== 'paid')
        .reduce((s, i) => s + (i.balance_due || i.grand_total || 0), 0);
    const overduePayables = 0;
    const priceHistory = useMemo(
        () =>
            invoices.flatMap((inv) =>
                (inv.items || []).map((item) => ({
                    ...item,
                    invoice_number: inv.invoice_number || inv.id,
                    vendor_name: inv.vendor_name || inv.supplier,
                    invoice_date: inv.date,
                    invoice_id: inv.id,
                })),
            ),
        [invoices],
    );

    /** Vendors from invoices plus linked workshop suppliers (so new links appear before first invoice). */
    const priceReportVendorOptions = useMemo(() => {
        const set = new Set();
        for (const v of invoices.map((i) => i.vendor_name || i.supplier).filter(Boolean)) {
            set.add(String(v).trim());
        }
        for (const s of linkedSuppliers) {
            if (s?.name && String(s.name).trim()) set.add(String(s.name).trim());
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [invoices, linkedSuppliers]);

    /** Products that actually appear on at least one invoice line (not static catalog). */
    const invoicedProductOptions = useMemo(() => {
        const seen = new Set();
        const opts = [];
        for (const r of priceHistory) {
            const pid =
                r.product_id ??
                r.productId ??
                r.branchCatalogProductId ??
                r.branch_catalog_product_id;
            const pname = String(r.product_name ?? r.productName ?? r.itemName ?? r.item_name ?? '').trim();
            if (pid != null && String(pid).trim() !== '') {
                const key = String(pid);
                if (seen.has(key)) continue;
                seen.add(key);
                opts.push({ value: key, label: pname || `Product ${key}` });
            } else if (pname) {
                const key = `name:${pname}`;
                if (seen.has(key)) continue;
                seen.add(key);
                opts.push({ value: key, label: pname });
            }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label));
        return opts;
    }, [priceHistory]);

    const filteredHistory = useMemo(() => {
        return priceHistory.filter((r) => {
            const matchSupplier = filterSupplier === 'all' || r.vendor_name === filterSupplier;
            const rowPid = String(
                r.product_id ?? r.productId ?? r.branchCatalogProductId ?? r.branch_catalog_product_id ?? '',
            );
            const rowName = String(r.product_name ?? r.productName ?? '').trim();
            let matchProduct = filterProduct === 'all';
            if (!matchProduct && filterProduct.startsWith('name:')) {
                matchProduct = rowName === filterProduct.slice(5);
            } else if (!matchProduct) {
                matchProduct = rowPid === filterProduct;
            }
            return matchSupplier && matchProduct;
        });
    }, [priceHistory, filterSupplier, filterProduct]);

    useEffect(() => {
        if (filterProduct === 'all') return;
        if (!invoicedProductOptions.some((o) => o.value === filterProduct)) {
            setFilterProduct('all');
        }
    }, [invoicedProductOptions, filterProduct]);

    useEffect(() => {
        if (filterSupplier === 'all') return;
        if (!priceReportVendorOptions.includes(filterSupplier)) {
            setFilterSupplier('all');
        }
    }, [priceReportVendorOptions, filterSupplier]);
    const invoiceSupplierOptions = useMemo(() => {
        const names = linkedSuppliers.map((s) => s.name).filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }, [linkedSuppliers]);

    const selectedSupplierRow = useMemo(
        () => linkedSuppliers.find((s) => s.name === selectedVendor) ?? null,
        [linkedSuppliers, selectedVendor],
    );

    const hasProductLine = useMemo(
        () => lineItems.some((l) => l.productId != null && String(l.productId).trim() !== ''),
        [lineItems],
    );

    useEffect(() => {
        if (!modalOpen || linkedSuppliersLoading) return;
        if (invoiceSupplierOptions.length === 0) {
            setSelectedVendor('');
            return;
        }
        if (selectedVendor && invoiceSupplierOptions.includes(selectedVendor)) return;
        setSelectedVendor(invoiceSupplierOptions[0]);
    }, [modalOpen, linkedSuppliersLoading, invoiceSupplierOptions, selectedVendor]);

    const canSubmitPurchaseInvoice =
        Boolean(invoiceBranchId) &&
        !linkedSuppliersLoading &&
        !submittingInvoice &&
        invoiceSupplierOptions.length > 0 &&
        Boolean(selectedVendor) &&
        invoiceSupplierOptions.includes(selectedVendor) &&
        Boolean(selectedSupplierRow?.id) &&
        lineItems.length > 0 &&
        hasProductLine;

    const handleCreateInvoice = async () => {
        if (!canSubmitPurchaseInvoice) return;
        setSubmitInvoiceError('');
        const totals = invoiceTotals;
        const enrichedLines = buildEnrichedLineItems(
            lineItems,
            applyDiscountForCalc,
            discountIsPercent,
            VAT_RATE,
            TAX_LABEL,
            { unitPriceTaxInclusive: amountsTaxInclusive },
        );
        const dueComputed = calculateDueDate();
        const purchaseInvoicePayload = buildPurchaseInvoicePayload({
            status: 'pending',
            branch_id: invoiceBranchId,
            selected_branch_filter: selectedBranchId ?? null,
            issue_date: issueDate,
            due_date_type: dueDateType,
            due_net_days: netDays,
            due_date_custom: customDueDate,
            due_date_computed: dueComputed === '—' ? '' : dueComputed,
            vendor_invoice_ref: vendorInvoiceRef,
            supplier: { id: selectedSupplierRow?.id ?? null, name: selectedVendor || '' },
            invoice_description: invoiceDescription,
            notes: invoiceNotes,
            currency: 'SAR',
            vat_rate: VAT_RATE,
            vat_label: TAX_LABEL,
            ui: {
                show_line_description_column: showDesc,
                show_line_discount_column: showDiscount,
                line_discount_is_percent: discountIsPercent,
                amounts_tax_inclusive: amountsTaxInclusive,
            },
            invoice_discount: {
                mode: invoiceDiscountMode,
                value: parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
            },
            update_last_purchase_price_on_save: updateLastPurchasePrice,
            lines: enrichedLines,
            totals,
        });
        const createBody = buildCreateWorkshopSupplierPurchaseInvoiceBody({
            supplierId: selectedSupplierRow.id,
            branchId: invoiceBranchId,
            issueDate,
            dueDateType,
            netDays,
            customDueDate,
            computedDueDate: dueComputed === '—' ? '' : dueComputed,
            vendorInvoiceRef: vendorInvoiceRef,
            description: invoiceDescription,
            notes: invoiceNotes,
            currency: 'SAR',
            status: 'draft',
            showLineDescriptionColumn: showDesc,
            showLineDiscountColumn: showDiscount,
            lineDiscountIsPercent: discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue: parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
            updateLastPurchasePriceOnSave: updateLastPurchasePrice,
            freightIn: freightNum,
            showAmountsTaxInclusive: amountsTaxInclusive,
            lines: enrichedLines,
            totals,
        });
        if (import.meta.env.DEV) void console.info('[purchase_invoice_payload]', purchaseInvoicePayload);
        setSubmittingInvoice(true);
        try {
            await createWorkshopSupplierPurchaseInvoice(createBody);
            await loadPurchaseInvoices();
            setModalOpen(false);
            setLineItems([]);
            setIssueDate('2026-03-08');
            setDueDateType('Net');
            setNetDays(30);
            setVendorInvoiceRef('');
            setInvoiceDescription('');
            setInvoiceNotes('');
            setInvoiceDiscountValue('0');
            setInvoiceDiscountMode('fixed_sar');
            setFreightSar('0');
            setAmountsTaxInclusive(false);
            setInvoiceBranchId('');
            amountsInclusiveInitRef.current = false;
            amountsInclusivePrevRef.current = false;
            setUpdateLastPurchasePrice(true);
        } catch (e) {
            setSubmitInvoiceError(e.message || 'Could not create purchase invoice.');
        } finally {
            setSubmittingInvoice(false);
        }
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Accounts Payable</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991B1B', margin: '4px 0 0' }}>SAR {totalPayables.toLocaleString()}</p>
                    <p style={{ fontSize: '0.75rem', color: '#DC2626', margin: '4px 0 0' }}>Owed to vendors</p>
                </div>
                {overduePayables > 0 && (
                    <div style={{ padding: 16, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={20} style={{ color: '#EA580C' }} />
                        <div>
                            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#EA580C' }}>Overdue</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800 }}>SAR {overduePayables.toLocaleString()}</p>
                        </div>
                    </div>
                )}
                <div style={{ padding: 16, background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', borderRadius: 16 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Total Purchase Invoices</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0 0' }}>{invoices.length}</p>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('invoices')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            background: activeTab === 'invoices' ? 'var(--color-text-dark)' : '#fff',
                            color: activeTab === 'invoices' ? 'var(--color-primary)' : 'var(--color-text-body)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: activeTab === 'invoices' ? 'none' : '1px solid var(--color-border)',
                        }}
                    >
                        Purchase Invoices
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('price_report')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            background: activeTab === 'price_report' ? 'var(--color-text-dark)' : '#fff',
                            color: activeTab === 'price_report' ? 'var(--color-primary)' : 'var(--color-text-body)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <BarChart3 size={14} />
                        Purchase Price Report
                    </button>
                </div>
                <button type="button" className="btn-portal" onClick={() => setModalOpen(true)}>
                    <Plus size={16} /> New Purchase Invoice
                </button>
            </div>
            {activeTab === 'invoices' && (
                <div className="ws-section">
                    {invoicesError && (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: 12,
                                borderRadius: 10,
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#B91C1C',
                                fontSize: '0.875rem',
                            }}
                        >
                            {invoicesError}
                        </div>
                    )}
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Vendor</th>
                                    <th>Ref</th>
                                    <th>Issue Date</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                    <th>Payment</th>
                                    <th>Stock</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoicesLoading && invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} style={{ textAlign: 'center', padding: 40 }}>
                                            Loading purchase invoices…
                                        </td>
                                    </tr>
                                ) : null}
                                {invoices.map((inv) => (
                                    <tr key={inv.id}>
                                        <td>
                                            <strong style={{ color: '#EA580C' }}>{inv.invoice_number || inv.id}</strong>
                                        </td>
                                        <td>{inv.vendor_name || inv.supplier || '–'}</td>
                                        <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {inv.vendor_invoice_ref || '–'}
                                        </td>
                                        <td style={{ fontSize: '0.75rem' }}>{inv.date || '–'}</td>
                                        <td style={{ fontSize: '0.75rem' }}>{inv.due_date || '–'}</td>
                                        <td>
                                            <span className={`ws-badge ws-badge--${inv.status === 'approved' ? 'green' : inv.status === 'rejected' ? 'red' : 'yellow'}`}>
                                                {inv.status || '—'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.75rem' }}>SAR {(inv.vat_amount || 0).toLocaleString()}</td>
                                        <td>
                                            <strong>SAR {(inv.grand_total || 0).toLocaleString()}</strong>
                                        </td>
                                        <td style={{ color: '#059669' }}>SAR {(inv.amount_paid || 0).toLocaleString()}</td>
                                        <td style={{ color: '#DC2626', fontWeight: 700 }}>SAR {(inv.balance_due || 0).toLocaleString()}</td>
                                        <td>
                                            <span
                                                className={`ws-badge ${inv.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}
                                            >
                                                {inv.payment_status}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${inv.stock_updated ? 'ws-badge--green' : 'ws-badge--yellow'}`}>
                                                {inv.stock_updated ? 'Updated' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-portal"
                                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    void openViewInvoiceModal(inv);
                                                }}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!invoicesLoading && invoices.length === 0 && (
                                    <tr>
                                        <td colSpan={13} style={{ textAlign: 'center', padding: 40 }}>
                                            No purchase invoices yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {activeTab === 'price_report' && (
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: '0.6875rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                Filter by Vendor
                            </label>
                            <select
                                value={filterSupplier}
                                onChange={(e) => setFilterSupplier(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }}
                            >
                                <option value="all">All Vendors</option>
                                {priceReportVendorOptions.map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.6875rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                Filter by Product
                            </label>
                            <select
                                value={filterProduct}
                                onChange={(e) => setFilterProduct(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }}
                            >
                                <option value="all">All Products</option>
                                {invoicedProductOptions.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Vendor</th>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Unit Price (SAR)</th>
                                <th>Line Total</th>
                                <th>Tax</th>
                                <th>Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((r, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <strong>{r.product_name}</strong>
                                    </td>
                                    <td>{r.vendor_name}</td>
                                    <td style={{ color: '#EA580C' }}>{r.invoice_number}</td>
                                    <td style={{ fontSize: '0.75rem' }}>{r.invoice_date || '–'}</td>
                                    <td>{r.quantity}</td>
                                    <td style={{ fontSize: '0.75rem' }}>{r.unit}</td>
                                    <td>
                                        <strong style={{ color: '#2563EB' }}>SAR {parseFloat(r.unit_price || 0).toFixed(2)}</strong>
                                    </td>
                                    <td>SAR {parseFloat(r.total || 0).toFixed(2)}</td>
                                    <td style={{ fontSize: '0.75rem' }}>VAT 15%</td>
                                    <td>
                                        <strong>SAR {(parseFloat(r.total || 0) * 1.15).toFixed(2)}</strong>
                                    </td>
                                </tr>
                            ))}
                            {filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>
                                        No price history found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Purchase Invoices › <span className="pi-b-active">New</span>
                                </span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={24} />
                                    <span>Purchase Invoice</span>
                                </div>
                            </div>
                        }
                        onClose={() => {
                            setModalOpen(false);
                            setSubmitInvoiceError('');
                            setFreightSar('0');
                            setAmountsTaxInclusive(false);
                            setInvoiceBranchId('');
                            amountsInclusiveInitRef.current = false;
                            amountsInclusivePrevRef.current = false;
                        }}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        onClick={() => {
                                            setModalOpen(false);
                                            setSubmitInvoiceError('');
                                            setFreightSar('0');
                                            setAmountsTaxInclusive(false);
                                            setInvoiceBranchId('');
                                            amountsInclusiveInitRef.current = false;
                                            amountsInclusivePrevRef.current = false;
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                    {submitInvoiceError && (
                                        <p style={{ margin: 0, fontSize: '0.8125rem', color: '#B91C1C', maxWidth: 420, textAlign: 'right' }}>
                                            {submitInvoiceError}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <button type="button" className="btn-pi-draft">
                                        Save as Draft
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={handleCreateInvoice}
                                        disabled={!canSubmitPurchaseInvoice}
                                        title={
                                            !canSubmitPurchaseInvoice
                                                ? 'Need invoice branch, linked supplier with ID, at least one line with a branch product, and loaded suppliers.'
                                                : undefined
                                        }
                                    >
                                        {submittingInvoice ? 'Creating…' : 'Create Purchase Invoice'}
                                    </button>
                                    </div>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            {branches.length === 0 && (
                                <p
                                    style={{
                                        padding: '10px 14px',
                                        marginBottom: 12,
                                        borderRadius: 8,
                                        background: '#FFF7ED',
                                        border: '1px solid #FED7AA',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    Add a workshop branch before creating purchase invoices.
                                </p>
                            )}
                            {branches.length > 0 && (
                                <div className="pi-field pi-full-width" style={{ marginBottom: 16 }}>
                                    <label>Branch for this invoice *</label>
                                    <select
                                        value={invoiceBranchId}
                                        onChange={(e) => handleInvoiceBranchChange(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            fontSize: '0.9375rem',
                                            background: '#f8fafc',
                                        }}
                                    >
                                        {branches.map((b) => (
                                            <option key={b.id} value={String(b.id)}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="pi-sub-label" style={{ marginTop: 6 }}>
                                        Products and quantities apply to this branch only. When the supplier approves and
                                        stock is updated, inventory changes on this branch.
                                    </p>
                                </div>
                            )}
                            {!invoiceBranchId && branches.length > 0 && (
                                <p
                                    style={{
                                        padding: '10px 14px',
                                        marginBottom: 12,
                                        borderRadius: 8,
                                        background: '#FFF7ED',
                                        border: '1px solid #FED7AA',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    Choose a branch above to load branch products for line items.
                                </p>
                            )}
                            {branchProductsError && (
                                <p style={{ color: '#B45309', fontSize: '0.875rem', marginBottom: 8 }}>{branchProductsError}</p>
                            )}
                            {!branchProductsLoading &&
                                invoiceBranchId &&
                                branchProductOptions.length === 0 &&
                                !branchProductsError && (
                                    <p
                                        style={{
                                            color: '#92400E',
                                            fontSize: '0.875rem',
                                            marginBottom: 8,
                                            padding: '8px 12px',
                                            background: '#FFFBEB',
                                            border: '1px solid #FDE68A',
                                            borderRadius: 8,
                                        }}
                                    >
                                        No branch products were returned. Check that this branch has products in catalog
                                        / inventory, or that the workshop-staff / workshop-catalog APIs are reachable.
                                    </p>
                                )}
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}>
                                        <select value={dueDateType} onChange={(e) => setDueDateType(e.target.value)}>
                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input type="number" value={netDays} onChange={(e) => setNetDays(e.target.value)} />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input type="date" value={customDueDate} onChange={(e) => setCustomDueDate(e.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculateDueDate()}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="Vendor inv #"
                                        value={vendorInvoiceRef}
                                        onChange={(e) => setVendorInvoiceRef(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Supplier / Vendor *</label>
                                <select
                                    value={selectedVendor}
                                    onChange={(e) => setSelectedVendor(e.target.value)}
                                    disabled={linkedSuppliersLoading || invoiceSupplierOptions.length === 0}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        fontSize: '0.9375rem',
                                        background: '#f8fafc',
                                    }}
                                >
                                    {linkedSuppliersLoading && (
                                        <option value="">Loading suppliers…</option>
                                    )}
                                    {!linkedSuppliersLoading && invoiceSupplierOptions.length === 0 && (
                                        <option value="">No suppliers linked to this workshop</option>
                                    )}
                                    {!linkedSuppliersLoading &&
                                        invoiceSupplierOptions.map((v) => (
                                            <option key={v} value={v}>
                                                {v}
                                            </option>
                                        ))}
                                </select>
                                {linkedSuppliersUsingRegisteredFallback && (
                                    <p className="pi-sub-label" style={{ color: '#B45309', marginTop: 6 }}>
                                        Supplier list is using the registered-suppliers fallback (same as Suppliers tab
                                        when the main endpoint fails).
                                    </p>
                                )}
                                {linkedSuppliersError && (
                                    <p className="pi-sub-label" style={{ color: '#B45309', marginTop: 6 }}>
                                        {linkedSuppliersError}
                                    </p>
                                )}
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Invoice description (optional)"
                                    value={invoiceDescription}
                                    onChange={(e) => setInvoiceDescription(e.target.value)}
                                />
                            </div>

                            <div className="pi-lines-section ws-pi-lines-section">
                                <div className="ws-pi-lines-scroll">
                                    <table className="ws-pi-lines-table">
                                        <colgroup>
                                            <col style={{ width: 44 }} />
                                            <col style={{ width: showDesc ? '20%' : '26%' }} />
                                            <col style={{ width: showDesc ? '16%' : '20%' }} />
                                            {showDesc ? <col style={{ width: '14%' }} /> : null}
                                            <col style={{ width: 72 }} />
                                            <col style={{ width: 72 }} />
                                            <col style={{ width: 96 }} />
                                            {showDiscount ? <col style={{ width: 88 }} /> : null}
                                            <col style={{ width: showDiscount ? '9%' : '11%' }} />
                                            <col style={{ width: 88 }} />
                                            <col style={{ width: 88 }} />
                                            <col style={{ width: showDiscount ? '9%' : '11%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th scope="col" className="ws-pi-th-hash">
                                                    #
                                                </th>
                                                <th scope="col">Item</th>
                                                <th scope="col">Account</th>
                                                {showDesc ? <th scope="col">Description</th> : null}
                                                <th scope="col">UOM</th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Qty
                                                </th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Unit price {amountsTaxInclusive ? '(incl. VAT)' : '(ex VAT)'}
                                                </th>
                                                {showDiscount ? (
                                                    <th scope="col" className="ws-pi-th-num">
                                                        Discount{discountIsPercent ? ' %' : ' (SAR)'}
                                                    </th>
                                                ) : null}
                                                <th scope="col" className="ws-pi-th-num">
                                                    Total
                                                </th>
                                                <th scope="col" title="Fixed VAT 15% for workshop supplier purchase invoices">
                                                    Tax code
                                                </th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Tax Amt
                                                </th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Total
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lineItems.map((line, idx) => {
                                                const amounts = computeLineAmounts(
                                                    line,
                                                    applyDiscountForCalc,
                                                    discountIsPercent,
                                                    VAT_RATE,
                                                    lineAmountOpts,
                                                );
                                                return (
                                                    <tr key={line.id}>
                                                        <td className="ws-pi-td-hash">{idx + 1}</td>
                                                        <td>
                                                            <select
                                                                className="pi-row-input ws-pi-select"
                                                                value={line.productId}
                                                                disabled={!invoiceBranchId || branchProductsLoading}
                                                                onChange={(e) => handleLineProductChange(line.id, e.target.value)}
                                                            >
                                                                <option value="">
                                                                    {branchProductsLoading ? 'Loading products…' : '— Select product —'}
                                                                </option>
                                                                {branchProductOptions.map((p) => (
                                                                    <option key={p.id} value={p.id}>
                                                                        {p.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="pi-row-input ws-pi-select"
                                                                value={line.account}
                                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                                            >
                                                                {PI_ACCOUNT_OPTIONS.map((opt) => (
                                                                    <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                                        {opt.code} - {opt.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        {showDesc ? (
                                                            <td>
                                                                <input
                                                                    type="text"
                                                                    value={line.description}
                                                                    className="pi-row-input"
                                                                    onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                                                                />
                                                            </td>
                                                        ) : null}
                                                        <td className="ws-pi-td-muted">{line.uom}</td>
                                                        <td className="ws-pi-td-num">
                                                            <input
                                                                type="text"
                                                                defaultValue={line.qty}
                                                                key={`qty-${line.id}-${line.qty}`}
                                                                className="pi-row-input-num pi-math-input"
                                                                onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'qty')}
                                                                onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                                            />
                                                        </td>
                                                        <td
                                                            className="ws-pi-td-num ws-pi-price-cell"
                                                            title={
                                                                amountsTaxInclusive
                                                                    ? 'Prefilled from catalog purchase price (VAT-inclusive). Editable.'
                                                                    : 'Prefilled from purchase price ÷ 1.15 (ex VAT). Editable.'
                                                            }
                                                        >
                                                            <input
                                                                type="text"
                                                                value={line.productId ? line.price : ''}
                                                                className="pi-row-input-num pi-math-input"
                                                                placeholder={line.productId ? '' : '—'}
                                                                onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'price')}
                                                                onBlur={(e) => handleMathBlur(e, line.id, 'price')}
                                                                disabled={!line.productId}
                                                            />
                                                        </td>
                                                        {showDiscount ? (
                                                            <td className="ws-pi-td-num">
                                                                <input
                                                                    type="text"
                                                                    className="pi-row-input-num pi-math-input"
                                                                    defaultValue={line.discount}
                                                                    key={`disc-${line.id}-${line.discount}`}
                                                                    onChange={(e) => updateLineItem(line.id, 'discount', e.target.value)}
                                                                    onKeyDown={(e) => handleMathKeyDown(e, line.id, 'discount')}
                                                                    onBlur={(e) => handleMathBlur(e, line.id, 'discount')}
                                                                />
                                                            </td>
                                                        ) : null}
                                                        <td className="ws-pi-td-num">SAR {amounts.taxableExcl.toFixed(2)}</td>
                                                        <td className="ws-pi-td-tax" title="Tax code is fixed at VAT 15% for this flow.">
                                                            {TAX_LABEL}
                                                        </td>
                                                        <td className="ws-pi-td-num">SAR {amounts.taxAmt.toFixed(2)}</td>
                                                        <td className="ws-pi-td-num ws-pi-td-strong">SAR {amounts.totalIncl.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="pi-line-row">
                                    <div style={{ flex: 1 }} />
                                    <button type="button" className="btn-add-line" onClick={addEmptyLine}>
                                        <Plus size={16} /> Add line
                                    </button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: Choose a branch product to prefill unit price from the
                                    catalog purchase price ({amountsTaxInclusive ? 'VAT-inclusive amount' : 'ex VAT, i.e. purchase price ÷ 1.15'}).
                                    VAT is 15% after discount (unless you use tax-inclusive unit prices — amounts still
                                    split for tax in the grid). Qty, unit price, and discount support math (e.g. 12*5).
                                    At least one line must include a product so your supplier can approve and receive
                                    stock.
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showDesc}
                                        onChange={(e) => setShowDesc(e.target.checked)}
                                    />
                                    <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showDiscount}
                                        onChange={(e) => setShowDiscount(e.target.checked)}
                                    />
                                    <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={amountsTaxInclusive}
                                        onChange={(e) => setAmountsTaxInclusive(e.target.checked)}
                                    />
                                    <span>Unit prices include VAT ({TAX_LABEL})</span>
                                </label>
                                {showDiscount && (
                                    <span className="pi-discount-kind" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Discount type:</span>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="pi-discount-kind"
                                                checked={!discountIsPercent}
                                                onChange={() => setDiscountIsPercent(false)}
                                            />
                                            SAR
                                        </label>
                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="pi-discount-kind"
                                                checked={discountIsPercent}
                                                onChange={() => setDiscountIsPercent(true)}
                                            />
                                            %
                                        </label>
                                    </span>
                                )}
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input
                                                type="text"
                                                value={invoiceDiscountValue}
                                                onChange={(e) => setInvoiceDiscountValue(e.target.value)}
                                            />
                                            <select
                                                value={invoiceDiscountMode}
                                                onChange={(e) => setInvoiceDiscountMode(e.target.value)}
                                            >
                                                <option value="fixed_sar">Fixed (SAR)</option>
                                                <option value="percent">Percent (%)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Freight (SAR)</label>
                                        <input
                                            type="text"
                                            value={freightSar}
                                            onChange={(e) => setFreightSar(e.target.value)}
                                            placeholder="0"
                                            style={{ maxWidth: 140 }}
                                        />
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea
                                            placeholder="Internal notes"
                                            rows={4}
                                            value={invoiceNotes}
                                            onChange={(e) => setInvoiceNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="pi-footer-column pi-summary-column">
                                    <div className="pi-summary-card">
                                        <div className="pi-summary-row">
                                            <span>Subtotal:</span>
                                            <span>SAR {summary.subtotal}</span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Total Tax (VAT):</span>
                                            <span>SAR {summary.totalTax}</span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Freight:</span>
                                            <span>SAR {summary.freight}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>Grand Total:</span>
                                            <span>SAR {summary.grandTotal}</span>
                                        </div>
                                    </div>
                                    <div className="pi-ap-alert">
                                        <span>
                                            Creates <strong>Accounts Payable</strong>. After goods received, click &quot;Update Stock&quot; in the
                                            list.
                                        </span>
                                    </div>
                                    <label className="pi-checkbox pi-price-update">
                                        <input
                                            type="checkbox"
                                            checked={updateLastPurchasePrice}
                                            onChange={(e) => setUpdateLastPurchasePrice(e.target.checked)}
                                        />
                                        <span>Update last purchase price for all products on save</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
                {viewModalOpen && viewInvoiceRow && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Purchase Invoices › <span className="pi-b-active">View</span>
                                </span>
                                <div className="pi-title-main">
                                    <Eye className="pi-icon-orange" size={24} />
                                    <span>Purchase Invoice</span>
                                </div>
                            </div>
                        }
                        onClose={closeViewInvoiceModal}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button type="button" className="btn-pi-cancel" onClick={closeViewInvoiceModal}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            {viewInvoiceError && (
                                <p
                                    style={{
                                        marginBottom: 12,
                                        padding: '10px 14px',
                                        borderRadius: 8,
                                        background: '#FEF2F2',
                                        border: '1px solid #FECACA',
                                        color: '#B91C1C',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    {viewInvoiceError}
                                </p>
                            )}
                            {viewInvoiceLoading && (
                                <p style={{ marginBottom: 12, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                    Loading full invoice…
                                </p>
                            )}
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 12,
                                    marginBottom: 16,
                                    alignItems: 'center',
                                }}
                            >
                                <span className={`ws-badge ws-badge--${viewInvoiceRow.status === 'approved' ? 'green' : viewInvoiceRow.status === 'rejected' ? 'red' : 'yellow'}`}>
                                    {viewInvoiceRow.status || '—'}
                                </span>
                                <span
                                    className={`ws-badge ${viewInvoiceRow.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}
                                >
                                    {viewInvoiceRow.payment_status}
                                </span>
                                <span className={`ws-badge ${viewInvoiceRow.stock_updated ? 'ws-badge--green' : 'ws-badge--yellow'}`}>
                                    Stock: {viewInvoiceRow.stock_updated ? 'Updated' : 'Pending'}
                                </span>
                                {viewUi.amountsTaxInclusive ? (
                                    <span className="ws-badge ws-badge--yellow" title="Unit prices were entered VAT-inclusive on create">
                                        Unit prices: VAT-inclusive
                                    </span>
                                ) : null}
                            </div>
                            <div className="pi-field pi-full-width" style={{ marginBottom: 16 }}>
                                <label>Receiving branch</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                    }}
                                >
                                    {viewInvoiceRow.branch_name || viewInvoiceRow.branch_id ? (
                                        <>
                                            <strong>{viewInvoiceRow.branch_name || '—'}</strong>
                                            {viewInvoiceRow.branch_id ? (
                                                <span
                                                    style={{
                                                        marginLeft: 10,
                                                        fontSize: '0.8125rem',
                                                        color: 'var(--color-text-muted)',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    ID: {viewInvoiceRow.branch_id}
                                                </span>
                                            ) : null}
                                        </>
                                    ) : (
                                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                    )}
                                </div>
                                {!(viewInvoiceRow.branch_id || viewInvoiceRow.branch_name) ? (
                                    <p className="pi-sub-label" style={{ marginTop: 6, color: '#B45309' }}>
                                        Branch not returned on this invoice yet. Ask backend to include branch (id +
                                        name) on GET workshop purchase invoice detail so receiving location shows
                                        here.
                                    </p>
                                ) : (
                                    <p className="pi-sub-label" style={{ marginTop: 6 }}>
                                        Inventory updates on supplier approval apply to this branch.
                                    </p>
                                )}
                            </div>
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Invoice #</label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            background: '#f8fafc',
                                            fontWeight: 700,
                                            color: '#EA580C',
                                        }}
                                    >
                                        {viewInvoiceRow.invoice_number || viewInvoiceRow.id}
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            background: '#f8fafc',
                                        }}
                                    >
                                        {viewInvoiceRow.date || '—'}
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            background: '#f8fafc',
                                        }}
                                    >
                                        {viewInvoiceRow.due_date || '—'}
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Vendor ref</label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            background: '#f8fafc',
                                        }}
                                    >
                                        {viewInvoiceRow.vendor_invoice_ref || '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Vendor</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                    }}
                                >
                                    {viewInvoiceRow.vendor_name || viewInvoiceRow.supplier || '—'}
                                </div>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                        minHeight: 44,
                                    }}
                                >
                                    {viewInvoiceRow.description || '—'}
                                </div>
                            </div>
                            <div className="pi-lines-section ws-pi-lines-section">
                                <div className="ws-pi-lines-scroll">
                                    <table className="ws-pi-lines-table">
                                        <colgroup>
                                            <col style={{ width: 44 }} />
                                            <col style={{ width: viewUi.showDesc ? '20%' : '28%' }} />
                                            <col style={{ width: viewUi.showDesc ? '16%' : '22%' }} />
                                            {viewUi.showDesc ? <col style={{ width: '14%' }} /> : null}
                                            <col style={{ width: 72 }} />
                                            <col style={{ width: 72 }} />
                                            <col style={{ width: 96 }} />
                                            {viewUi.showDiscount ? <col style={{ width: 88 }} /> : null}
                                            <col style={{ width: viewUi.showDiscount ? '9%' : '11%' }} />
                                            <col style={{ width: 88 }} />
                                            <col style={{ width: 88 }} />
                                            <col style={{ width: viewUi.showDiscount ? '9%' : '11%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th scope="col" className="ws-pi-th-hash">
                                                    #
                                                </th>
                                                <th scope="col">Item</th>
                                                <th scope="col">Account</th>
                                                {viewUi.showDesc ? <th scope="col">Description</th> : null}
                                                <th scope="col">UOM</th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Qty
                                                </th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Unit price (ex VAT)
                                                </th>
                                                {viewUi.showDiscount ? (
                                                    <th scope="col" className="ws-pi-th-num">
                                                        Discount{viewUi.discountIsPercent ? ' %' : ' (SAR)'}
                                                    </th>
                                                ) : null}
                                                <th scope="col" className="ws-pi-th-num">
                                                    Taxable (ex VAT)
                                                </th>
                                                <th scope="col">Tax</th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Tax Amt
                                                </th>
                                                <th scope="col" className="ws-pi-th-num">
                                                    Line total (incl VAT)
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewLineRows.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={
                                                            10 +
                                                            (viewUi.showDesc ? 1 : 0) +
                                                            (viewUi.showDiscount ? 1 : 0)
                                                        }
                                                        style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}
                                                    >
                                                        No line items on this invoice
                                                    </td>
                                                </tr>
                                            ) : (
                                                viewLineRows.map((row, idx) => {
                                                    const fallbackTaxable = roundMoney2(
                                                        row.unitEx * row.qty - (viewUi.showDiscount ? row.lineDisc : 0),
                                                    );
                                                    const displayTaxable =
                                                        row.taxableFromApi != null ? row.taxableFromApi : Math.max(0, fallbackTaxable);
                                                    return (
                                                        <tr key={row.key}>
                                                            <td className="ws-pi-td-hash">{idx + 1}</td>
                                                            <td className="ws-pi-td-strong">{row.item}</td>
                                                            <td style={{ fontSize: '0.8125rem' }}>{row.account}</td>
                                                            {viewUi.showDesc ? (
                                                                <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                                    {row.desc || '—'}
                                                                </td>
                                                            ) : null}
                                                            <td className="ws-pi-td-muted">{row.uom}</td>
                                                            <td className="ws-pi-td-num">{row.qty}</td>
                                                            <td className="ws-pi-td-num">SAR {row.unitEx.toFixed(2)}</td>
                                                            {viewUi.showDiscount ? (
                                                                <td className="ws-pi-td-num">SAR {row.lineDisc.toFixed(2)}</td>
                                                            ) : null}
                                                            <td className="ws-pi-td-num">SAR {displayTaxable.toFixed(2)}</td>
                                                            <td className="ws-pi-td-tax">{row.taxCode}</td>
                                                            <td className="ws-pi-td-num">SAR {row.taxAmt.toFixed(2)}</td>
                                                            <td className="ws-pi-td-num ws-pi-td-strong">SAR {row.totalIncl.toFixed(2)}</td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="pi-footer-grid" style={{ marginTop: 16 }}>
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Invoice discount</label>
                                        <div
                                            style={{
                                                padding: '10px 14px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 10,
                                                background: '#f8fafc',
                                            }}
                                        >
                                            {viewDiscountLabel}
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <div
                                            style={{
                                                padding: '10px 14px',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 10,
                                                background: '#f8fafc',
                                                whiteSpace: 'pre-wrap',
                                                minHeight: 80,
                                            }}
                                        >
                                            {viewInvoiceRow.notes || '—'}
                                        </div>
                                    </div>
                                </div>
                                <div className="pi-footer-column pi-summary-column">
                                    <div className="pi-summary-card">
                                        <div className="pi-summary-row">
                                            <span>Subtotal (ex VAT):</span>
                                            <span>
                                                SAR{' '}
                                                {viewInvoiceRow.subtotal.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Total tax ({TAX_LABEL}):</span>
                                            <span>
                                                SAR{' '}
                                                {viewInvoiceRow.vat_amount.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Freight:</span>
                                            <span>
                                                SAR{' '}
                                                {(viewInvoiceRow.freight_in ?? 0).toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>Grand total:</span>
                                            <span>
                                                SAR{' '}
                                                {viewInvoiceRow.grand_total.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Paid:</span>
                                            <span style={{ color: '#059669' }}>
                                                SAR{' '}
                                                {viewInvoiceRow.amount_paid.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <div className="pi-summary-row">
                                            <span>Balance due:</span>
                                            <span style={{ color: '#DC2626', fontWeight: 700 }}>
                                                SAR{' '}
                                                {viewInvoiceRow.balance_due.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
