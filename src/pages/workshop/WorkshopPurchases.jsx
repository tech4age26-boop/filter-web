import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart, BarChart3, AlertTriangle, Calendar, Zap } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    getWorkshopStaffBranchProducts,
    getWorkshopSuppliers,
    getRegisteredWorkshopSuppliers,
    branchScopeParams,
    createWorkshopSupplierPurchaseInvoice,
    listWorkshopSupplierPurchaseInvoices,
    unwrapWorkshopBranchListResponse,
} from '../../services/workshopStaffApi';
import { getBranchProducts } from '../../services/workshopCatalogApi';
import {
    buildCreateWorkshopSupplierPurchaseInvoiceBody,
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import { PI_INVENTORY_ITEMS, PI_ACCOUNT_OPTIONS } from './constants';
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
    return { id, name, unit, type, priceExcl };
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
    const [updateLastPurchasePrice, setUpdateLastPurchasePrice] = useState(true);
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

    const effectiveBranchId = useMemo(() => {
        if (selectedBranchId && selectedBranchId !== 'all') return selectedBranchId;
        return branches[0]?.id ?? null;
    }, [selectedBranchId, branches]);

    const [branchProductOptions, setBranchProductOptions] = useState([]);
    const [branchProductsLoading, setBranchProductsLoading] = useState(false);
    const [branchProductsError, setBranchProductsError] = useState('');

    const loadBranchProducts = useCallback(async () => {
        if (!effectiveBranchId) {
            setBranchProductOptions([]);
            return;
        }
        setBranchProductsLoading(true);
        setBranchProductsError('');
        try {
            const prodRes = await getWorkshopStaffBranchProducts(effectiveBranchId);
            let prodRows = unwrapWorkshopBranchListResponse(prodRes, 'products');
            if (prodRows.length === 0) {
                try {
                    prodRows = unwrapWorkshopBranchListResponse(
                        await getBranchProducts(effectiveBranchId),
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
    }, [effectiveBranchId]);

    const loadLinkedSuppliers = useCallback(async () => {
        setLinkedSuppliersLoading(true);
        setLinkedSuppliersError('');
        setLinkedSuppliersUsingRegisteredFallback(false);
        try {
            let offset = 0;
            const merged = [];
            let hardCap = 60;
            while (hardCap-- > 0) {
                const res = await getWorkshopSuppliers({
                    ...branchScopeParams(effectiveBranchId ?? 'all'),
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
    }, [effectiveBranchId]);

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

    useEffect(() => {
        loadPurchaseInvoices();
    }, [loadPurchaseInvoices]);

    useEffect(() => {
        if (!modalOpen) return;
        loadBranchProducts();
        loadLinkedSuppliers();
    }, [modalOpen, effectiveBranchId, loadBranchProducts, loadLinkedSuppliers]);

    useEffect(() => {
        if (!tabState?.autoOpenModal) return;
        setModalOpen(true);
        if (tabState.prefillSupplier?.name) {
            setSelectedVendor(String(tabState.prefillSupplier.name));
        }
        if (tabState.selectedItem) {
            const item = tabState.selectedItem;
            const priceExcl = pickPriceExclusiveUnit(item);
            const taxAmt = priceExcl * VAT_RATE;
            const totalFinal = priceExcl * (1 + VAT_RATE);
            const newLine = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                productId: String(item.id ?? ''),
                item: item.name,
                account: '1410 - Inventory Asset',
                description: '',
                uom: item.unit || 'piece',
                qty: 1,
                price: priceExcl,
                discount: 0,
                taxCode: TAX_LABEL,
                taxAmt: taxAmt.toFixed(2),
                totalFinal: totalFinal.toFixed(2),
            };
            setLineItems([newLine]);
        }
        if (clearTabState) clearTabState();
    }, [tabState, clearTabState]);

    const applyDiscountForCalc = showDiscount;

    const recalcStoredLineTotals = (line) => {
        const { taxAmt, totalIncl } = computeLineAmounts(line, applyDiscountForCalc, discountIsPercent);
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
                const { taxAmt, totalIncl } = computeLineAmounts(line, showDiscount, discountIsPercent);
                return {
                    ...line,
                    taxCode: TAX_LABEL,
                    taxAmt: taxAmt.toFixed(2),
                    totalFinal: totalIncl.toFixed(2),
                };
            }),
        );
    }, [showDiscount, discountIsPercent]);

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
                    price: opt.priceExcl,
                };
                return recalcStoredLineTotals(next);
            }),
        );
    };

    const invoiceTotals = useMemo(
        () =>
            computePurchaseInvoiceTotals({
                lineItems,
                applyLineDiscount: applyDiscountForCalc,
                lineDiscountIsPercent: discountIsPercent,
                invoiceDiscountMode,
                invoiceDiscountValue,
                vatRate: VAT_RATE,
            }),
        [
            lineItems,
            applyDiscountForCalc,
            discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue,
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
    const priceHistory = invoices.flatMap((inv) =>
        (inv.items || []).map((item) => ({
            ...item,
            invoice_number: inv.invoice_number || inv.id,
            vendor_name: inv.vendor_name || inv.supplier,
            invoice_date: inv.date,
            invoice_id: inv.id,
        })),
    );
    const filteredHistory = priceHistory.filter((r) => {
        const matchSupplier = filterSupplier === 'all' || r.vendor_name === filterSupplier;
        const matchProduct = filterProduct === 'all' || r.product_id === filterProduct;
        return matchSupplier && matchProduct;
    });
    const uniqueVendors = [...new Set(invoices.map((i) => i.vendor_name || i.supplier).filter(Boolean))];
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
        Boolean(effectiveBranchId) &&
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
        const totals = computePurchaseInvoiceTotals({
            lineItems,
            applyLineDiscount: applyDiscountForCalc,
            lineDiscountIsPercent: discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue,
            vatRate: VAT_RATE,
        });
        const enrichedLines = buildEnrichedLineItems(
            lineItems,
            applyDiscountForCalc,
            discountIsPercent,
            VAT_RATE,
            TAX_LABEL,
        );
        const dueComputed = calculateDueDate();
        const purchaseInvoicePayload = buildPurchaseInvoicePayload({
            status: 'pending',
            branch_id: effectiveBranchId,
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
            branchId: effectiveBranchId,
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
                                    <th>Subtotal</th>
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
                                        <td colSpan={14} style={{ textAlign: 'center', padding: 40 }}>
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
                                        <td>SAR {(inv.subtotal || 0).toLocaleString()}</td>
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
                                            <button type="button" className="btn-portal" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!invoicesLoading && invoices.length === 0 && (
                                    <tr>
                                        <td colSpan={14} style={{ textAlign: 'center', padding: 40 }}>
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
                                {uniqueVendors.map((v) => (
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
                                {PI_INVENTORY_ITEMS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
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
                                                ? 'Need branch, linked supplier with ID, at least one line with a branch product, and loaded suppliers.'
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
                            {!effectiveBranchId && (
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
                                    Select a branch in the workshop header (or add a branch) to load products for line items.
                                </p>
                            )}
                            {branchProductsError && (
                                <p style={{ color: '#B45309', fontSize: '0.875rem', marginBottom: 8 }}>{branchProductsError}</p>
                            )}
                            {!branchProductsLoading &&
                                effectiveBranchId &&
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
                                                    Unit price
                                                </th>
                                                {showDiscount ? (
                                                    <th scope="col" className="ws-pi-th-num">
                                                        Discount{discountIsPercent ? ' %' : ' (SAR)'}
                                                    </th>
                                                ) : null}
                                                <th scope="col" className="ws-pi-th-num">
                                                    Total
                                                </th>
                                                <th scope="col">Tax Code</th>
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
                                                );
                                                const priceExcl = parseFloat(line.price) || 0;
                                                return (
                                                    <tr key={line.id}>
                                                        <td className="ws-pi-td-hash">{idx + 1}</td>
                                                        <td>
                                                            <select
                                                                className="pi-row-input ws-pi-select"
                                                                value={line.productId}
                                                                disabled={!effectiveBranchId || branchProductsLoading}
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
                                                            title="Prefilled from purchase price ÷ 1.15. You can edit this value."
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
                                                        <td className="ws-pi-td-tax">{TAX_LABEL}</td>
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
                                    <Zap size={14} /> Tip: Choose a branch product to prefill unit price from purchase
                                    price ÷ 1.15 (editable). VAT is 15% after discount. Qty, unit price, and discount
                                    support math (e.g. 12*5). At least one line must include a product so your supplier
                                    can approve and receive stock.
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
            </AnimatePresence>
        </div>
    );
}
