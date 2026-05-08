import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    FileText,
    Plus,
    Eye,
    Download,
    Calendar,
    Search,
    Zap,
    Pencil,
    Trash2,
    ChevronDown,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/AccountingPage.css';
import {
    createSupplierInvoice,
    deleteSupplierInvoice,
    getSupplierInvoice,
    getSupplierInventoryStockBalances,
    getSupplierSalesInvoiceCustomerBranches,
    listSupplierInvoices,
    patchSupplierInvoicePaymentStatus,
    updateSupplierInvoice,
} from '../../services/supplierApi';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';

/** Session key: JSON line preset (legacy / fallback). Primary path is router state `salesInvoiceFromAlert`. */
const SI_PRESET_LINE_KEY = 'supplier_sales_invoice_preset_line';

const SALES_INVOICE_FROM_ALERT_KEY = 'salesInvoiceFromAlert';

/** Map GET `/supplier/invoices/:id` → WorkshopPurchaseInvoiceView detail (same bilingual layout as workshop PI). */
function mapSupplierSalesInvoiceToWorkshopDetail(inv) {
    if (!inv || typeof inv !== 'object') return {};
    const branchName = inv.branch?.name ?? inv.workshop?.name ?? '';
    const refLabel =
        inv.deliveryNoteUrl != null && String(inv.deliveryNoteUrl).trim() !== ''
            ? String(inv.deliveryNoteUrl).trim()
            : '';
    return {
        id: inv.id,
        invoiceNumber: inv.invoiceNo,
        invoiceNo: inv.invoiceNo,
        issueDate: inv.invoiceDate,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        status: inv.status,
        workshopName: branchName,
        branchName,
        branch: inv.branch,
        workshop: inv.workshop,
        vendorInvoiceRef: refLabel,
        vendorRef: refLabel,
        subtotalExVat: inv.subtotal,
        subtotal: inv.subtotal,
        vatAmount: inv.vatAmount,
        totalVat: inv.vatAmount,
        grandTotal: inv.grandTotal,
        total: inv.grandTotal,
        amountPaid: inv.paid,
        paidAmount: inv.paid,
        balanceDue: inv.outstanding,
        balance: inv.outstanding,
        paymentStatus:
            Number(inv.paid) >= Number(inv.grandTotal) && Number(inv.grandTotal) > 0 ? 'paid' : 'unpaid',
        notes: inv.internalNotes ?? inv.internal_notes ?? inv.notes ?? '',
        description: refLabel,
        items: (inv.items || []).map((it) => ({
            id: it.id,
            productName: it.productName,
            product_name: it.productName,
            qty: it.qty,
            quantity: it.qty,
            unit: 'piece',
            uom: 'piece',
            unitPrice: it.unitPrice,
            unit_price: it.unitPrice,
            unitPriceExVat: it.unitPrice,
            vatRate: it.vatRate,
            vat_rate: it.vatRate,
            lineTotal: it.lineTotal,
            line_total: it.lineTotal,
        })),
    };
}

function mapSupplierSalesInvoiceToWorkshopListRow(inv) {
    if (!inv || typeof inv !== 'object') return {};
    return {
        id: inv.id,
        invoice_number: inv.invoiceNo,
        invoiceNo: inv.invoiceNo,
        date: inv.invoiceDate,
        status: inv.status,
        grand_total: inv.grandTotal,
    };
}

/** AR list: unpaid vs paid only (backend PATCH .../payment-status). */
const SALES_INVOICE_PAYMENT_OPTIONS = [
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'paid', label: 'Paid' },
];

/** Align select value with balance (outstanding). */
function salesInvoicePaymentSelectValue(balance) {
    return Number(balance || 0) > 0 ? 'unpaid' : 'paid';
}

function mapSupplierInvoicesListFromResponse(invRes) {
    if (!invRes || !Array.isArray(invRes.invoices)) return [];
    return invRes.invoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        branch: inv.branch?.name || '-',
        branchId: inv.branch?.id,
        workshopName: inv.workshop?.name || inv.branch?.workshopName || '',
        date: inv.invoiceDate,
        dueDate: inv.dueDate || '—',
        amount: Number(inv.grandTotal || 0),
        paid: Number(inv.paid || 0),
        balance: Number(inv.outstanding || 0),
        status: inv.status || 'pending_payment',
        paymentStatus: salesInvoicePaymentSelectValue(inv.outstanding),
        vendorRef: inv.deliveryNoteUrl || '—',
        productLabel: inv.productLabel ?? '—',
        quantityLabel: inv.quantityLabel ?? '—',
        unitLabel: inv.unitLabel ?? '—',
    }));
}

const INVENTORY_ITEMS = [
    {
        id: 1,
        itemType: 'Product',
        name: 'Engine Oil — Full Synthetic 5W40',
        price: 45,
        unit: 'liter',
        lastPrice: 42,
    },
    {
        id: 2,
        itemType: 'Product',
        name: 'Oil Filter — Universal',
        price: 22,
        unit: 'pcs',
        lastPrice: 22,
    },
    {
        id: 3,
        itemType: 'Service',
        name: 'Car Wash Normal - Small',
        price: 20,
        unit: 'service',
        lastPrice: 18,
    },
    {
        id: 4,
        itemType: 'Product',
        name: 'Brake Fluid DOT4',
        price: 28,
        unit: 'liter',
        lastPrice: 28,
    },
];

const ACCOUNT_OPTIONS = [
    { code: '4100', name: 'Sales Revenue' },
    { code: '1410', name: 'Inventory Asset' },
];

const TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

const CASH_ACCOUNTS = ['Main Cash', 'Bank — Al Rajhi', 'Bank — SNB'];

const SEARCH_QUICK_PICK = 15;
const SEARCH_MAX_RESULTS = 50;

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Derive ex-VAT line amount, VAT, and VAT-inclusive grand total from user inputs.
 * @param {'percent'|'fixed_sar'} discountMode — % applies to line extension before discount; fixed SAR subtracts from that extension (inclusive or exclusive per flag).
 */
function computeLineFinancials(line, amountsTaxInclusive) {
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    const unitInput = parseFloat(String(line.price).replace(',', '.')) || 0;
    const discRaw = parseFloat(String(line.discount ?? 0).replace(',', '.')) || 0;
    const discMode = line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
    const rate =
        TAXES.find((t) => t.code === line.taxCode)?.rate ?? TAXES[0]?.rate ?? 0;

    let lineEx = 0;
    let taxAmt = 0;
    let grandIncl = 0;

    if (amountsTaxInclusive) {
        const grossInclBeforeDisc = roundMoney2(qty * unitInput);
        let netIncl = grossInclBeforeDisc;
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            netIncl = roundMoney2(grossInclBeforeDisc * (1 - pct / 100));
        } else {
            netIncl = roundMoney2(Math.max(0, grossInclBeforeDisc - discRaw));
        }
        lineEx =
            netIncl > 0 && rate > 0
                ? roundMoney2(netIncl / (1 + rate))
                : roundMoney2(netIncl);
        grandIncl = netIncl;
        taxAmt = roundMoney2(Math.max(0, grandIncl - lineEx));
    } else {
        const grossExBeforeDisc = roundMoney2(qty * unitInput);
        let lineExAdj = grossExBeforeDisc;
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            lineExAdj = roundMoney2(grossExBeforeDisc * (1 - pct / 100));
        } else {
            lineExAdj = roundMoney2(Math.max(0, grossExBeforeDisc - discRaw));
        }
        lineEx = lineExAdj;
        taxAmt = roundMoney2(lineEx * rate);
        grandIncl = roundMoney2(lineEx + taxAmt);
    }

    return {
        lineEx,
        taxAmt,
        grandIncl,
        taxAmtStr: taxAmt.toFixed(2),
        grandInclStr: grandIncl.toFixed(2),
        lineExStr: lineEx.toFixed(2),
    };
}

function applyLineTotals(line, amountsTaxInclusive) {
    const f = computeLineFinancials(line, amountsTaxInclusive);
    return {
        ...line,
        taxAmt: f.taxAmtStr,
        totalFinal: f.grandInclStr,
    };
}

function mergeInventoryLists(stockRows, fallback) {
    const map = new Map();
    (stockRows || []).forEach((entry) => {
        if (entry?.id == null || entry.id === '') return;
        map.set(String(entry.id), entry);
    });
    (fallback || []).forEach((inv) => {
        if (inv?.id == null || inv.id === '') return;
        const k = String(inv.id);
        if (!map.has(k)) map.set(k, inv);
    });
    return Array.from(map.values());
}

function normalizeStockCatalogRow(item) {
    const qtyWh = Number(item.currentBalanceWarehouse || 0);
    const unitCost =
        qtyWh > 0 ? Number(item.valueWarehouseSar || 0) / qtyWh : 0;
    const price = Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0;
    const stockHint =
        qtyWh > 0
            ? `Warehouse stock: ${qtyWh} • Unit cost SAR ${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            : qtyWh <= 0
              ? 'No warehouse qty — edit unit price manually'
              : '';
    /** Used for picker key / display only — not POSTed as `productId` (server validates IDs against PO/workshop links and returns "Invalid reference… poId"). */
    const catalogId =
        item.productId != null && item.productId !== ''
            ? item.productId
            : item.supplierProductId != null && item.supplierProductId !== ''
              ? item.supplierProductId
              : undefined;
    return {
        id: catalogId ?? `row-${item.productName}-${item.sku || ''}`,
        name: item.productName || 'Product',
        sku: String(item.sku ?? item.barcode ?? '').trim(),
        price,
        unit: item.workshopUnit || item.unitCode || item.unit || 'pcs',
        lastPrice: Number(item.lastWarehouseSalePrice || item.lastSalePrice || price || 0) || price,
        itemType: 'Product',
        stockHint,
        catalogProductResolved: catalogId != null && catalogId !== '',
    };
}

function nextLineId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatInvoicePayloadForPdf(payload) {
    const inv = payload?.invoice ?? payload;
    if (!inv) return '';
    const rows =
        Array.isArray(inv.items) && inv.items.length
            ? inv.items
                  .map(
                      (it) =>
                          `<tr><td>${escapeHtml(it.productName)}</td><td style="text-align:right">${Number(it.qty)}</td><td style="text-align:right">${Number(it.unitPrice).toFixed(2)}</td><td style="text-align:right">${Number(it.vatRate ?? 15)}%</td><td style="text-align:right">${Number(it.lineTotal).toFixed(2)}</td></tr>`
                  )
                  .join('')
            : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(inv.invoiceNo)}</title></head><body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:auto">
<h1 style="margin-bottom:4px">Sales Invoice</h1>
<p style="color:#64748b;margin-top:0">${escapeHtml(inv.invoiceNo)}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td><strong>Branch</strong></td><td>${escapeHtml(inv.branch?.name || '—')}</td></tr>
<tr><td><strong>Invoice date</strong></td><td>${escapeHtml(inv.invoiceDate || '')}</td></tr>
<tr><td><strong>Due date</strong></td><td>${escapeHtml(inv.dueDate || '')}</td></tr>
<tr><td><strong>Status</strong></td><td>${escapeHtml(inv.status || '')}</td></tr>
<tr><td><strong>Grand total</strong></td><td>SAR ${Number(inv.grandTotal ?? 0).toLocaleString()}</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid #e2e8f0;text-align:left"><th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">VAT%</th><th style="text-align:right">Line</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:16px;font-size:13px">Outstanding: SAR ${Number(inv.outstanding ?? 0).toLocaleString()} · Paid: SAR ${Number(inv.paid ?? 0).toLocaleString()}</p>
</body></html>`;
}

function escapeHtml(s) {
    if (s == null || s === '') return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function SupplierSalesInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [invoiceModalMode, setInvoiceModalMode] = useState('create');
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewPayload, setViewPayload] = useState(null);
    const [paymentStatusSavingId, setPaymentStatusSavingId] = useState(null);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [refNo, setRefNo] = useState('');
    const [branch, setBranch] = useState('');
    const [cashAccount, setCashAccount] = useState('');
    const [description, setDescription] = useState('');
    const [internalNotes, setInternalNotes] = useState('');

    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const [freightCharges, setFreightCharges] = useState('0');
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState('fixed_sar');

    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [inventoryItems, setInventoryItems] = useState(INVENTORY_ITEMS);
    const [inventoryInitialLoadDone, setInventoryInitialLoadDone] =
        useState(false);
    const [branches, setBranches] = useState([]);
    /** Set when GET /supplier/invoices/customer-branches fails (network, auth, server). */
    const [customerBranchesLoadError, setCustomerBranchesLoadError] =
        useState('');
    const invoiceLineSearchWrapRef = useRef(null);
    const lineItemPickerWrapRef = useRef(null);
    /** Current text in the line item field while picker is open — saved to the line on close. */
    const itemPickerInputRef = useRef('');
    const [itemPickerLineId, setItemPickerLineId] = useState(null);
    const [itemPickerInput, setItemPickerInput] = useState('');
    /** Filter passed to getSearchSuggestions — empty on open so list matches “Search product to add” with no query. */
    const [itemPickerFilter, setItemPickerFilter] = useState('');

    const location = useLocation();
    const navigate = useNavigate();
    /** Line preset from Workshop Alerts; applied after inventory load (avoids session + Strict Mode races). */
    const salesInvoiceAlertLinePresetRef = useRef(null);

    const getSearchSuggestions = (query) => {
        const items = [...inventoryItems].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                sensitivity: 'base',
            }),
        );
        const q = query.trim().toLowerCase();
        if (!q) return items.slice(0, SEARCH_QUICK_PICK);
        return items
            .filter((i) => String(i.name || '').toLowerCase().includes(q))
            .slice(0, SEARCH_MAX_RESULTS);
    };

    const applySearchQuery = (value) => {
        setSearchQuery(value);
        const results = getSearchSuggestions(value);
        setSearchResults(results);
        setShowDropdown(true);
        setSelectedIndex(results.length ? 0 : -1);
    };

    const openInvoiceLineSearch = () => {
        const results = getSearchSuggestions(searchQuery);
        setSearchResults(results);
        setShowDropdown(true);
        setSelectedIndex(results.length ? 0 : -1);
    };

    const updateLineItem = (id, field, value) => {
        const recalc = new Set(['qty', 'price', 'taxCode', 'discount', 'discountMode']);
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const updated = { ...line, [field]: value };
                return recalc.has(field)
                    ? applyLineTotals(updated, amountsTaxInclusive)
                    : updated;
            }),
        );
    };

    useEffect(() => {
        setLineItems((prev) =>
            prev.length
                ? prev.map((line) => applyLineTotals(line, amountsTaxInclusive))
                : prev,
        );
    }, [amountsTaxInclusive]);

    const getSummary = () => {
        let subtotalEx = 0;
        let totalTax = 0;
        let linesGrandSum = 0;
        for (const line of lineItems) {
            const f = computeLineFinancials(line, amountsTaxInclusive);
            subtotalEx += f.lineEx;
            totalTax += f.taxAmt;
            linesGrandSum += f.grandIncl;
        }
        subtotalEx = roundMoney2(subtotalEx);
        totalTax = roundMoney2(totalTax);
        const freightNum =
            parseFloat(String(freightCharges).replace(',', '.')) || 0;
        const grossBeforeInvDisc = roundMoney2(linesGrandSum + freightNum);

        let invDisc = 0;
        const invRaw =
            parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0;
        if (invoiceDiscountMode === 'percent') {
            invDisc = roundMoney2(
                (grossBeforeInvDisc * Math.min(100, Math.max(0, invRaw))) /
                    100,
            );
        } else {
            invDisc = roundMoney2(Math.min(invRaw, grossBeforeInvDisc));
        }
        const grandTotal = roundMoney2(Math.max(0, grossBeforeInvDisc - invDisc));

        return {
            subtotal: subtotalEx.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            totalTax: totalTax.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            grandTotal: grandTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            rawGrandTotal: grandTotal,
        };
    };
    const summary = getSummary();

    const addItemToLines = useCallback((item) => {
        const unitPrice = Number(item.price) || 0;
        const lastSale = Number(item.lastPrice ?? item.price ?? 0) || unitPrice;
        const rawLine = {
            id: nextLineId(),
            sku: item.sku || '',
            item: item.name,
            account: '4100 - Sales Revenue',
            description: '',
            uom: item.unit,
            qty: 1,
            price: unitPrice,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            lastSalePrice: lastSale,
        };
        const newLine = applyLineTotals(rawLine, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    }, [amountsTaxInclusive]);

    const removeLineItem = (lineId) => {
        setLineItems((prev) => prev.filter((l) => l.id !== lineId));
    };

    const addEmptyLine = () => {
        const rawLine = {
            id: nextLineId(),
            sku: '',
            item: '',
            account: '4100 - Sales Revenue',
            description: '',
            uom: 'pcs',
            qty: 1,
            price: 0,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            lastSalePrice: 0,
        };
        const newLine = applyLineTotals(rawLine, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') {
            setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        } else if (e.key === 'Enter' && selectedIndex >= 0 && searchResults[selectedIndex]) {
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str || !/^[\d\s+\-*/.()]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            // eslint-disable-next-line no-new-func
            const result = Function('return (' + str + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return parseFloat(result.toFixed(6)).toString();
            }
        } catch {
            // ignore
        }
        return str;
    };

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const evaluated = evalMath(e.target.value);
            updateLineItem(lineId, field, evaluated);
            e.target.value = evaluated;
        }
    };

    const handleMathBlur = (e, lineId, field) => {
        const evaluated = evalMath(e.target.value);
        if (evaluated !== e.target.value) {
            updateLineItem(lineId, field, evaluated);
        }
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') {
            due.setDate(issue.getDate() + parseInt(netDays || 0, 10));
        } else if (dueDateType === 'Custom') {
            return customDueDate || '—';
        } else if (dueDateType === 'EOM') {
            due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        }
        return due.toISOString().slice(0, 10);
    };
    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        const cols = [];
        if (showLineNum) cols.push('40px');
        cols.push('2fr', '1.5fr'); // Item, Account
        if (showDesc) cols.push('2fr');
        cols.push('0.8fr', '0.8fr', '1fr'); // UOM, Qty, Price
        if (showDiscount) cols.push('minmax(140px, 1.35fr)');
        cols.push('1fr', '1fr', '1fr', '1fr', '1fr'); // Total, TaxCode, TaxAmt, Total(final), Last Sale
        cols.push('48px'); // delete
        return cols.join(' ');
    };

    const resetInvoiceForm = () => {
        setIssueDate(new Date().toISOString().slice(0, 10));
        setDueDateType('Net');
        setNetDays(30);
        setCustomDueDate('');
        setRefNo('');
        setBranch('');
        setCashAccount('');
        setDescription('');
        setInternalNotes('');
        setLineItems([]);
        setSaveError('');
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
        setSelectedIndex(-1);
        setAmountsTaxInclusive(false);
        setFreightCharges('0');
        setInvoiceDiscountValue('0');
        setInvoiceDiscountMode('fixed_sar');
        setItemPickerLineId(null);
        setItemPickerInput('');
        setItemPickerFilter('');
    };

    const openNewInvoiceModal = () => {
        setInvoiceModalMode('create');
        setEditingInvoiceId(null);
        resetInvoiceForm();
        setModalOpen(true);
    };

    const closeInvoiceModal = () => {
        setModalOpen(false);
        setInvoiceModalMode('create');
        setEditingInvoiceId(null);
        resetInvoiceForm();
    };

    const loadInvoiceList = async (opts = {}) => {
        const silent = opts.silent === true;
        if (!silent) {
            setListLoading(true);
            setListError('');
        }
        try {
            const invRes = await listSupplierInvoices({ limit: 100 });
            setInvoices(mapSupplierInvoicesListFromResponse(invRes));
        } catch (err) {
            console.error('List supplier invoices failed:', err);
            if (!silent) {
                setListError(err?.message || 'Failed to load invoices.');
                setInvoices([]);
            } else {
                window.alert(err?.message || 'Failed to refresh invoices.');
            }
        } finally {
            if (!silent) setListLoading(false);
        }
    };

    const handleSaveInvoice = async () => {
        setSaveError('');
        if (!branch) {
            setSaveError('Select a workshop branch (customer).');
            return;
        }
        if (lineItems.length === 0) {
            setSaveError('Add at least one line item.');
            return;
        }
        const branchRef = branches.find((b) => String(b.id) === String(branch));
        if (!branchRef?.id) {
            setSaveError('Invalid branch selection. Refresh the page if branches are missing.');
            return;
        }
        const normalizedLines = lineItems.map((line, idx) => {
            const f = computeLineFinancials(line, amountsTaxInclusive);
            const qtyNum = parseFloat(String(line.qty).replace(',', '.')) || 0;
            const unitPriceExForApi =
                qtyNum > 0 ? roundMoney2(f.lineEx / qtyNum) : 0;
            return {
                index: idx,
                productName: String(line.item || '').trim(),
                qty: qtyNum,
                unitPrice: unitPriceExForApi,
                vatRate: Number(TAXES.find((t) => t.code === line.taxCode)?.percent || 0),
                unit: String(line.uom || 'pcs').trim() || 'pcs',
                sku: String(line.sku || '').trim(),
            };
        });
        const invalidLine = normalizedLines.find(
            (line) => !line.productName || !(line.qty > 0) || line.unitPrice < 0,
        );
        if (invalidLine) {
            setSaveError(
                `Line ${invalidLine.index + 1}: item name required, qty must be > 0, and price cannot be negative.`,
            );
            return;
        }
        setSaving(true);
        const due =
            calculatedDueDate === '—' ? issueDate : calculatedDueDate;
        const itemsPayload = normalizedLines.map((line) => ({
            productName: line.productName,
            qty: line.qty,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            unit: line.unit,
            ...(line.sku ? { sku: line.sku } : {}),
        }));
        try {
            if (invoiceModalMode === 'edit' && editingInvoiceId) {
                await updateSupplierInvoice(editingInvoiceId, {
                    invoiceDate: issueDate,
                    dueDate: due,
                    paymentTerms: dueDateType === 'Net' ? `Net ${netDays}` : dueDateType,
                    ...(description?.trim()
                        ? { deliveryNoteUrl: description.trim() }
                        : {}),
                    internalNotes: internalNotes.trim(),
                    items: itemsPayload,
                });
            } else {
                const invoiceNo = (refNo && String(refNo).trim()) || `INV-${Date.now()}`;
                await createSupplierInvoice({
                    invoiceNo,
                    invoiceDate: issueDate,
                    dueDate: due,
                    branchId: String(branchRef.id),
                    paymentTerms: dueDateType === 'Net' ? `Net ${netDays}` : dueDateType,
                    deliveryNoteUrl: description?.trim() || undefined,
                    ...(internalNotes.trim()
                        ? { internalNotes: internalNotes.trim() }
                        : {}),
                    items: itemsPayload,
                });
            }
            setModalOpen(false);
            setInvoiceModalMode('create');
            setEditingInvoiceId(null);
            resetInvoiceForm();
            await loadInvoiceList();
        } catch (err) {
            console.error('Save supplier invoice failed:', err);
            setSaveError(err?.message || 'Failed to save invoice.');
        } finally {
            setSaving(false);
        }
    };

    const openEditInvoice = async (row) => {
        setSaveError('');
        setInvoiceModalMode('edit');
        setEditingInvoiceId(row.id);
        setModalOpen(true);
        try {
            const res = await getSupplierInvoice(row.id);
            const inv = res?.invoice;
            if (!inv) return;
            setIssueDate(inv.invoiceDate || issueDate);
            setBranch(inv.branch?.id != null ? String(inv.branch.id) : '');
            setDescription(inv.deliveryNoteUrl || '');
            setInternalNotes(inv.internalNotes ?? inv.internal_notes ?? inv.notes ?? '');
            setRefNo(inv.invoiceNo || '');
            const due = inv.dueDate ? new Date(inv.dueDate) : new Date();
            const issue = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
            const diffDays = Math.round((due - issue) / (1000 * 60 * 60 * 24));
            if (!Number.isNaN(diffDays) && diffDays >= 0) {
                setDueDateType('Net');
                setNetDays(diffDays || 30);
            }
            setLineItems(
                (inv.items || []).map((it) =>
                    applyLineTotals(
                        {
                            id: nextLineId(),
                            sku: String(it.sku ?? '').trim(),
                            item: it.productName,
                            account: '4100 - Sales Revenue',
                            description: '',
                            uom: it.unit || 'pcs',
                            qty: String(it.qty),
                            price: String(it.unitPrice),
                            discount: 0,
                            discountMode: 'percent',
                            taxCode:
                                TAXES.find(
                                    (t) => Math.abs(t.percent - Number(it.vatRate)) < 0.01,
                                )?.code || 'VAT 15%',
                            taxAmt: '0.00',
                            totalFinal: '0.00',
                            lastSalePrice: Number(it.unitPrice),
                        },
                        false,
                    ),
                ),
            );
        } catch (err) {
            console.error('Load invoice for edit failed:', err);
            setSaveError(err?.message || 'Could not load invoice.');
        }
    };

    const handleViewInvoice = async (row) => {
        setViewOpen(true);
        setViewLoading(true);
        setViewPayload(null);
        try {
            const res = await getSupplierInvoice(row.id);
            setViewPayload(res);
        } catch (err) {
            console.error('View invoice failed:', err);
            setViewPayload({ error: err?.message || 'Failed to load invoice.' });
        } finally {
            setViewLoading(false);
        }
    };

    const handleDownloadInvoice = async (row) => {
        try {
            const res = await getSupplierInvoice(row.id);
            const html = formatInvoicePayloadForPdf(res);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${row.invoiceNo || 'invoice'}.html`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download invoice failed:', err);
            setListError(err?.message || 'Download failed.');
        }
    };

    const handleDeleteInvoice = async (row) => {
        if (row.status !== 'pending_payment') {
            window.alert('Only invoices with status pending_payment (no payments) can be deleted.');
            return;
        }
        if (!window.confirm(`Delete invoice ${row.invoiceNo}?`)) return;
        try {
            await deleteSupplierInvoice(row.id);
            await loadInvoiceList();
        } catch (err) {
            console.error('Delete invoice failed:', err);
            window.alert(err?.message || 'Delete failed.');
        }
    };

    const handlePaymentStatusChange = async (row, next) => {
        const current = salesInvoicePaymentSelectValue(row.balance);
        if (next === current) return;
        setPaymentStatusSavingId(row.id);
        try {
            await patchSupplierInvoicePaymentStatus(row.id, { paymentStatus: next });
            await loadInvoiceList({ silent: true });
        } catch (err) {
            console.error('Update payment status failed:', err);
            window.alert(err?.message || 'Could not update payment status.');
        } finally {
            setPaymentStatusSavingId(null);
        }
    };

    const list = invoices || [];

    useEffect(() => {
        if (!modalOpen || !showDropdown) return undefined;
        const onDocMouseDown = (e) => {
            const el = invoiceLineSearchWrapRef.current;
            if (el && !el.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [modalOpen, showDropdown]);

    useEffect(() => {
        itemPickerInputRef.current = itemPickerInput;
    }, [itemPickerInput]);

    useEffect(() => {
        if (!modalOpen || itemPickerLineId == null) return undefined;
        const openLineId = itemPickerLineId;
        const onDocMouseDown = (e) => {
            const el = lineItemPickerWrapRef.current;
            if (el && !el.contains(e.target)) {
                const text = String(itemPickerInputRef.current ?? '').trim();
                setLineItems((prev) =>
                    prev.map((l) =>
                        l.id === openLineId ? { ...l, item: text } : l,
                    ),
                );
                setItemPickerLineId(null);
                setItemPickerInput('');
                setItemPickerFilter('');
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [modalOpen, itemPickerLineId]);

    const applyCatalogItemToLine = (lineId, catalogItem) => {
        const unitPrice = Number(catalogItem.price) || 0;
        const lastSale =
            Number(catalogItem.lastPrice ?? catalogItem.price ?? 0) ||
            unitPrice;
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const raw = {
                    ...line,
                    sku: catalogItem.sku || '',
                    item: catalogItem.name,
                    uom: catalogItem.unit || line.uom || 'pcs',
                    price: unitPrice,
                    lastSalePrice: lastSale,
                };
                return applyLineTotals(raw, amountsTaxInclusive);
            }),
        );
        setItemPickerLineId(null);
        setItemPickerInput('');
        setItemPickerFilter('');
    };

    useEffect(() => {
        let cancelled = false;
        const branchesErrDefault =
            'Could not load workshop branches. Check that the app points at your backend (see api.js BASE_URL) and you are logged in as a supplier user.';

        const load = async () => {
            setListLoading(true);
            setListError('');
            try {
                const [stockRes, branchesRes, invRes] = await Promise.all([
                    getSupplierInventoryStockBalances({ limit: 200 }),
                    getSupplierSalesInvoiceCustomerBranches().catch((be) => {
                        console.error('Supplier customer-branches failed:', be);
                        return { __error: be, branches: [] };
                    }),
                    listSupplierInvoices({ limit: 100 }).catch((e) => {
                        console.error('List supplier invoices failed:', e);
                        return { __error: e };
                    }),
                ]);

                if (cancelled) return;

                const stockItems = Array.isArray(stockRes?.items)
                    ? stockRes.items.map((raw) => normalizeStockCatalogRow(raw))
                    : [];

                let branchesErr = '';
                let custBranches = [];
                if (branchesRes && branchesRes.__error) {
                    branchesErr =
                        branchesRes.__error?.message ||
                        (typeof branchesRes.__error === 'string'
                            ? branchesRes.__error
                            : branchesErrDefault);
                    custBranches = [];
                } else {
                    custBranches = Array.isArray(branchesRes?.branches) ? branchesRes.branches : [];
                }

                setCustomerBranchesLoadError(branchesErr);
                setInventoryItems(mergeInventoryLists(stockItems, INVENTORY_ITEMS));
                if (custBranches.length) {
                    setBranches(
                        custBranches.map((b) => {
                            const bid = b.branchId ?? b.branch_id ?? b.id;
                            return {
                                id: bid != null && bid !== '' ? String(bid) : '',
                                name: b.name,
                                label:
                                    b.label ||
                                    `${b.workshopName || ''} — ${b.name || ''}`.trim(),
                            };
                        }),
                    );
                } else {
                    setBranches([]);
                }

                if (invRes && invRes.__error) {
                    setListError(invRes.__error?.message || 'Failed to load invoices.');
                    setInvoices([]);
                } else {
                    setListError('');
                    setInvoices(mapSupplierInvoicesListFromResponse(invRes));
                }
            } catch (err) {
                console.error('Supplier sales invoices bootstrap failed:', err);
                if (!cancelled) {
                    setListError(err?.message || 'Failed to load.');
                    setInvoices([]);
                }
            } finally {
                if (!cancelled) {
                    setListLoading(false);
                    setInventoryInitialLoadDone(true);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const fromAlert = location.state?.[SALES_INVOICE_FROM_ALERT_KEY];
        if (fromAlert && typeof fromAlert === 'object') {
            navigate(location.pathname + location.search, { replace: true, state: {} });
            const line = fromAlert.line;
            salesInvoiceAlertLinePresetRef.current =
                line && typeof line === 'object' ? line : null;
            setInvoiceModalMode('create');
            setEditingInvoiceId(null);
            resetInvoiceForm();
            const bid = fromAlert.branchId;
            if (bid != null && String(bid).trim() !== '') {
                setBranch(String(bid));
            }
            setModalOpen(true);
            return;
        }
        try {
            if (sessionStorage.getItem('supplier_open_new_sales_invoice') === '1') {
                sessionStorage.removeItem('supplier_open_new_sales_invoice');
                const presetBranch = sessionStorage.getItem(
                    'supplier_sales_invoice_preset_branch_id',
                );
                if (presetBranch) {
                    sessionStorage.removeItem('supplier_sales_invoice_preset_branch_id');
                }
                let legacyLine = null;
                const rawLine = sessionStorage.getItem(SI_PRESET_LINE_KEY) || '';
                if (rawLine) {
                    sessionStorage.removeItem(SI_PRESET_LINE_KEY);
                    try {
                        legacyLine = JSON.parse(rawLine);
                    } catch {
                        legacyLine = null;
                    }
                }
                salesInvoiceAlertLinePresetRef.current =
                    legacyLine && typeof legacyLine === 'object' ? legacyLine : null;
                setInvoiceModalMode('create');
                setEditingInvoiceId(null);
                resetInvoiceForm();
                if (presetBranch) {
                    setBranch(String(presetBranch));
                }
                setModalOpen(true);
            }
        } catch {
            /* ignore */
        }
    }, [location.state, location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!modalOpen || !inventoryInitialLoadDone) return;
        if (invoiceModalMode !== 'create' || editingInvoiceId != null) return;

        let preset = null;
        if (salesInvoiceAlertLinePresetRef.current) {
            preset = salesInvoiceAlertLinePresetRef.current;
            salesInvoiceAlertLinePresetRef.current = null;
        } else {
            let raw = '';
            try {
                raw = sessionStorage.getItem(SI_PRESET_LINE_KEY) || '';
            } catch {
                return;
            }
            if (!raw) return;
            try {
                preset = JSON.parse(raw);
            } catch {
                sessionStorage.removeItem(SI_PRESET_LINE_KEY);
                return;
            }
            sessionStorage.removeItem(SI_PRESET_LINE_KEY);
        }

        if (!preset || typeof preset !== 'object') return;
        const nameTrim = String(preset.productName ?? preset.name ?? '').trim();
        if (!nameTrim) return;

        const sid =
            preset.supplierProductId != null &&
            String(preset.supplierProductId).trim() !== ''
                ? String(preset.supplierProductId).trim()
                : '';
        let match = sid
            ? inventoryItems.find((i) => String(i.id) === sid)
            : null;
        if (!match) {
            const pname = nameTrim.toLowerCase();
            const skuNorm = String(preset.sku || '').trim().toLowerCase();
            match = inventoryItems.find(
                (i) =>
                    String(i.name || '').trim().toLowerCase() === pname &&
                    (!skuNorm ||
                        String(i.sku || '').trim().toLowerCase() === skuNorm),
            );
        }
        if (!match) {
            match = inventoryItems.find(
                (i) =>
                    String(i.name || '').trim().toLowerCase() ===
                    nameTrim.toLowerCase(),
            );
        }
        if (match) {
            addItemToLines(match);
        } else {
            addItemToLines({
                name: nameTrim,
                sku: String(preset.sku || '').trim(),
                unit: String(preset.unit || 'pcs').trim() || 'pcs',
                price: 0,
                lastPrice: 0,
            });
        }
    }, [
        modalOpen,
        inventoryInitialLoadDone,
        invoiceModalMode,
        editingInvoiceId,
        inventoryItems,
        addItemToLines,
    ]);

    return (
        <div>
            <div
                style={{
                    padding: 14,
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 12,
                    marginBottom: 20,
                    fontSize: '0.875rem',
                    color: '#1E40AF',
                }}
            >
                <strong>Sales Invoices</strong> — issued when warehouse/supplier sends products TO a workshop. This
                creates an <strong>Accounts Receivable</strong> for you and auto-creates a{' '}
                <strong>Purchase Invoice</strong> on the workshop side. Stock is updated on both ends.
            </div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Sales Invoices (AR)</h2>
                    <p className="ws-page-sub">Warehouse → Workshop invoices</p>
                </div>
                <button
                    className="btn-portal"
                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                    onClick={openNewInvoiceModal}
                >
                    <Plus size={15} /> New Invoice
                </button>
            </div>
            {listError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        fontSize: '0.8125rem',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                    }}
                >
                    {listError}
                </div>
            ) : null}
            <div className="ws-section">
                <div style={{ overflowX: 'auto' }}>
                    {listLoading && list.length === 0 ? (
                        <ShimmerTable rows={8} columns={9} />
                    ) : (
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Workshop / Branch</th>
                                    <th>Date</th>
                                    <th>Due Date</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!listLoading && list.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            style={{
                                                textAlign: 'center',
                                                padding: 40,
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            <FileText
                                                size={40}
                                                style={{
                                                    opacity: 0.25,
                                                    margin: '0 auto 12px',
                                                    display: 'block',
                                                }}
                                            />
                                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                                No sales invoices yet
                                            </div>
                                            <div style={{ fontSize: '0.8125rem', marginBottom: 16 }}>
                                                Issue a warehouse → workshop invoice; it will appear in this table.
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-portal"
                                                style={{
                                                    background: '#2563EB',
                                                    color: '#fff',
                                                    border: 'none',
                                                }}
                                                onClick={openNewInvoiceModal}
                                            >
                                                <Plus size={15} /> Create first invoice
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    list.map((inv) => {
                                        const canMutate = inv.status === 'pending_payment';
                                        const statusLabel = String(inv.status || '')
                                            .replace(/_/g, ' ')
                                            .trim();
                                        return (
                                            <tr key={inv.id}>
                                                <td>
                                                    <strong style={{ color: '#2563EB' }}>
                                                        {inv.invoiceNo || inv.id}
                                                    </strong>
                                                </td>
                                                <td
                                                    style={{
                                                        fontSize: '0.8125rem',
                                                        color: 'var(--color-text-muted)',
                                                        maxWidth: 220,
                                                    }}
                                                    title={
                                                        inv.workshopName
                                                            ? `${inv.workshopName} — ${inv.branch}`
                                                            : inv.branch
                                                    }
                                                >
                                                    {inv.workshopName
                                                        ? `${inv.workshopName} — ${inv.branch}`
                                                        : inv.branch || '—'}
                                                </td>
                                                <td style={{ fontSize: '0.8125rem' }}>{inv.date || '—'}</td>
                                                <td style={{ fontSize: '0.8125rem' }}>{inv.dueDate || '—'}</td>
                                                <td
                                                    style={{
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    SAR {(inv.amount || 0).toLocaleString()}
                                                </td>
                                                <td style={{ color: '#0f766e', fontWeight: 600 }}>
                                                    SAR {(inv.paid || 0).toLocaleString()}
                                                </td>
                                                <td style={{ color: '#b91c1c', fontWeight: 700 }}>
                                                    SAR {(inv.balance || 0).toLocaleString()}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`ws-badge ws-badge--${
                                                            inv.status === 'paid'
                                                                ? 'green'
                                                                : inv.status === 'overdue'
                                                                  ? 'red'
                                                                  : inv.status === 'partially_paid'
                                                                    ? 'yellow'
                                                                    : 'yellow'
                                                        }`}
                                                    >
                                                        {statusLabel || 'pending payment'}
                                                    </span>
                                                </td>
                                                <td style={{ minWidth: 132 }}>
                                                    <select
                                                        aria-label={`Payment status for ${inv.invoiceNo || inv.id}`}
                                                        value={salesInvoicePaymentSelectValue(
                                                            inv.balance,
                                                        )}
                                                        disabled={paymentStatusSavingId === inv.id}
                                                        onChange={(e) =>
                                                            handlePaymentStatusChange(inv, e.target.value)
                                                        }
                                                        style={{
                                                            width: '100%',
                                                            maxWidth: 160,
                                                            fontSize: '0.8125rem',
                                                            padding: '6px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid #E5E7EB',
                                                            background: '#fff',
                                                            cursor:
                                                                paymentStatusSavingId === inv.id
                                                                    ? 'wait'
                                                                    : 'pointer',
                                                        }}
                                                    >
                                                        {SALES_INVOICE_PAYMENT_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: '#F3F4F6',
                                                                cursor: 'pointer',
                                                            }}
                                                            title="View"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: '#F3F4F6',
                                                                cursor: 'pointer',
                                                            }}
                                                            title="Download"
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={!canMutate}
                                                            onClick={() => openEditInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: canMutate ? '#E0E7FF' : '#F3F4F6',
                                                                color: canMutate ? '#4338CA' : '#94A3B8',
                                                                cursor: canMutate ? 'pointer' : 'not-allowed',
                                                                opacity: canMutate ? 1 : 0.6,
                                                            }}
                                                            title="Edit"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={!canMutate}
                                                            onClick={() => handleDeleteInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: canMutate ? '#FEE2E2' : '#F3F4F6',
                                                                color: canMutate ? '#DC2626' : '#94A3B8',
                                                                cursor: canMutate ? 'pointer' : 'not-allowed',
                                                                opacity: canMutate ? 1 : 0.6,
                                                            }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Sales Invoices ›{' '}
                                    <span className="pi-b-active">
                                        {invoiceModalMode === 'edit' ? 'Edit' : 'New'}
                                    </span>
                                </span>
                                <div className="pi-title-main">
                                    <FileText size={24} />
                                    <span>Sales Invoice (Warehouse — Workshop)</span>
                                </div>
                            </div>
                        }
                        onClose={closeInvoiceModal}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        className="btn-pi-cancel"
                                        onClick={closeInvoiceModal}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        className="btn-pi-create"
                                        onClick={handleSaveInvoice}
                                        disabled={
                                            saving ||
                                            !branch ||
                                            lineItems.length === 0 ||
                                            (invoiceModalMode === 'create' &&
                                                !inventoryInitialLoadDone)
                                        }
                                    >
                                        {saving
                                            ? 'Saving…'
                                            : invoiceModalMode === 'edit'
                                              ? 'Update Invoice'
                                              : 'Issue Sales Invoice'}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            {invoiceModalMode === 'create' && !inventoryInitialLoadDone ? (
                                <div style={{ padding: '12px 0 24px' }}>
                                    <ShimmerTextBlock lines={5} />
                                    <div style={{ marginTop: 18 }}>
                                        <ShimmerTable rows={6} columns={8} />
                                    </div>
                                    <p
                                        style={{
                                            marginTop: 16,
                                            fontSize: '0.8125rem',
                                            color: '#64748B',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Loading warehouse catalog and branches…
                                    </p>
                                </div>
                            ) : (
                                <>
                            {saveError ? (
                                <div
                                    style={{
                                        marginBottom: 12,
                                        padding: 10,
                                        borderRadius: 8,
                                        fontSize: '0.8125rem',
                                        color: '#B91C1C',
                                        border: '1px solid #FECACA',
                                        background: '#FEF2F2',
                                    }}
                                >
                                    {saveError}
                                </div>
                            ) : null}
                            <div
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: '#ECFEFF',
                                    border: '1px solid #A5F3FC',
                                    fontSize: '0.8125rem',
                                    color: '#0369A1',
                                    marginBottom: 16,
                                }}
                            >
                                This creates an <strong>Accounts Receivable</strong> for you (supplier). It will also
                                create a matching <strong>Purchase Invoice</strong> on the workshop side and update stock
                                levels on both ends.
                            </div>

                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div
                                        className={`pi-due-grid ${
                                            dueDateType === 'EOM' ? 'pi-due-eom' : ''
                                        }`}
                                    >
                                        <select
                                            value={dueDateType}
                                            onChange={(e) => setDueDateType(e.target.value)}
                                        >
                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input
                                                    type="date"
                                                    value={customDueDate}
                                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>
                                        {invoiceModalMode === 'edit' ? 'Invoice #' : 'Ref # (Optional)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ref #"
                                        value={refNo}
                                        readOnly={invoiceModalMode === 'edit'}
                                        onChange={(e) => setRefNo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Workshop Branch (Customer) *</label>
                                    <select
                                        value={branch}
                                        disabled={invoiceModalMode === 'edit'}
                                        onChange={(e) => setBranch(e.target.value)}
                                    >
                                        <option value="">Select workshop / branch</option>
                                        {(branches || []).map((b) => (
                                            <option key={b.id} value={String(b.id)}>
                                                {b.label || b.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!listLoading && customerBranchesLoadError ? (
                                        <span
                                            className="pi-sub-label"
                                            style={{ color: '#B91C1C', marginTop: 6, display: 'block' }}
                                        >
                                            {customerBranchesLoadError}
                                        </span>
                                    ) : null}
                                    {!listLoading &&
                                    !customerBranchesLoadError &&
                                    branches.length === 0 ? (
                                        <span
                                            className="pi-sub-label"
                                            style={{ color: '#B45309', marginTop: 6, display: 'block' }}
                                        >
                                            No workshop branches returned. In admin, link this supplier to a workshop
                                            (workshop_suppliers). Each linked workshop must have at least one branch
                                            that is not rejected.
                                        </span>
                                    ) : null}
                                </div>
                                <div className="pi-field">
                                    <label>Cash / Bank Account</label>
                                    <select
                                        value={cashAccount}
                                        onChange={(e) => setCashAccount(e.target.value)}
                                    >
                                        <option value="">Select account</option>
                                        {CASH_ACCOUNTS.map((a) => (
                                            <option key={a} value={a}>
                                                {a}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Invoice description (optional)"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <div className="pi-lines-section">
                                <div
                                    className="pi-lines-header"
                                    style={{ gridTemplateColumns: getGridColumns() }}
                                >
                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">Item</div>
                                    <div className="pi-col-acc">Account</div>
                                    {showDesc && <div className="pi-col-desc">Description</div>}
                                    <div className="pi-col-uom">UOM</div>
                                    <div className="pi-col-qty">Qty</div>
                                    <div className="pi-col-price">
                                        Unit price
                                        {amountsTaxInclusive ? (
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 400,
                                                    fontSize: 11,
                                                    color: '#64748b',
                                                }}
                                            >
                                                (incl. VAT)
                                            </span>
                                        ) : null}
                                    </div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div>
                                    <div className="pi-col-tax">Tax Code</div>
                                    <div className="pi-col-tamt">Tax Amt</div>
                                    <div className="pi-col-total">Grand Total</div>
                                    <div className="pi-col-total">Last Sale Price</div>
                                    <div aria-hidden />
                                </div>

                                {lineItems.map((line, idx) => (
                                    <div
                                        key={line.id}
                                        className="pi-lines-header pi-line-data-row"
                                        style={{ gridTemplateColumns: getGridColumns() }}
                                    >
                                        {showLineNum && (
                                            <div className="pi-col-hash">{idx + 1}</div>
                                        )}
                                        <div
                                            className="pi-col-item"
                                            style={{
                                                position: 'relative',
                                                minWidth: 0,
                                            }}
                                        >
                                            <div
                                                ref={
                                                    itemPickerLineId === line.id
                                                        ? lineItemPickerWrapRef
                                                        : null
                                                }
                                                style={{
                                                    position: 'relative',
                                                    width: '100%',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'stretch',
                                                        gap: 4,
                                                        width: '100%',
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        className="pi-row-input"
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                        }}
                                                        value={
                                                            itemPickerLineId ===
                                                            line.id
                                                                ? itemPickerInput
                                                                : (line.item ??
                                                                  '')
                                                        }
                                                        placeholder="Select item…"
                                                        onFocus={() => {
                                                            setItemPickerLineId(
                                                                line.id,
                                                            );
                                                            setItemPickerInput(
                                                                String(
                                                                    line.item ??
                                                                        '',
                                                                ),
                                                            );
                                                            setItemPickerFilter(
                                                                '',
                                                            );
                                                        }}
                                                        onChange={(e) => {
                                                            const v =
                                                                e.target.value;
                                                            setItemPickerLineId(
                                                                line.id,
                                                            );
                                                            setItemPickerInput(
                                                                v,
                                                            );
                                                            setItemPickerFilter(
                                                                v,
                                                            );
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    'Escape' ||
                                                                e.key === 'Enter'
                                                            ) {
                                                                e.preventDefault();
                                                                const text =
                                                                    String(
                                                                        itemPickerInputRef.current ??
                                                                            '',
                                                                    ).trim();
                                                                setLineItems(
                                                                    (prev) =>
                                                                        prev.map(
                                                                            (
                                                                                l,
                                                                            ) =>
                                                                                l.id ===
                                                                                line.id
                                                                                    ? {
                                                                                          ...l,
                                                                                          item: text,
                                                                                      }
                                                                                    : l,
                                                                        ),
                                                                );
                                                                setItemPickerLineId(
                                                                    null,
                                                                );
                                                                setItemPickerInput(
                                                                    '',
                                                                );
                                                                setItemPickerFilter(
                                                                    '',
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        title="Show item list"
                                                        aria-label="Open item list"
                                                        onMouseDown={(e) =>
                                                            e.preventDefault()
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                itemPickerLineId ===
                                                                line.id
                                                            ) {
                                                                const text =
                                                                    String(
                                                                        itemPickerInputRef.current ??
                                                                            '',
                                                                    ).trim();
                                                                setLineItems(
                                                                    (prev) =>
                                                                        prev.map(
                                                                            (
                                                                                l,
                                                                            ) =>
                                                                                l.id ===
                                                                                line.id
                                                                                    ? {
                                                                                          ...l,
                                                                                          item: text,
                                                                                      }
                                                                                    : l,
                                                                        ),
                                                                );
                                                                setItemPickerLineId(
                                                                    null,
                                                                );
                                                                setItemPickerInput(
                                                                    '',
                                                                );
                                                                setItemPickerFilter(
                                                                    '',
                                                                );
                                                            } else {
                                                                setItemPickerLineId(
                                                                    line.id,
                                                                );
                                                                setItemPickerInput(
                                                                    String(
                                                                        line.item ??
                                                                            '',
                                                                    ),
                                                                );
                                                                setItemPickerFilter(
                                                                    '',
                                                                );
                                                            }
                                                        }}
                                                        style={{
                                                            flex: '0 0 auto',
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            justifyContent:
                                                                'center',
                                                            padding: '0 8px',
                                                            borderRadius: 8,
                                                            border: '1px solid #e2e8f0',
                                                            background:
                                                                '#f8fafc',
                                                            cursor: 'pointer',
                                                            color: '#475569',
                                                        }}
                                                    >
                                                        <ChevronDown
                                                            size={16}
                                                        />
                                                    </button>
                                                </div>
                                                {itemPickerLineId ===
                                                line.id ? (
                                                    <div
                                                        className="pi-search-results"
                                                        style={{
                                                            position:
                                                                'absolute',
                                                            left: 0,
                                                            right: 0,
                                                            top: 'calc(100% + 4px)',
                                                            zIndex: 50,
                                                            maxHeight: 240,
                                                            overflowY: 'auto',
                                                            boxShadow:
                                                                '0 10px 25px rgba(15,23,42,0.12)',
                                                        }}
                                                    >
                                                        {(() => {
                                                            const pickerRows =
                                                                getSearchSuggestions(
                                                                    itemPickerFilter,
                                                                );
                                                            return pickerRows.length ? (
                                                                pickerRows.map(
                                                                    (
                                                                        invItem,
                                                                        i,
                                                                    ) => (
                                                                        <div
                                                                            key={`${line.id}-${String(invItem.id)}-${i}`}
                                                                            className="pi-result-item"
                                                                            onMouseDown={(
                                                                                ev,
                                                                            ) => {
                                                                                ev.preventDefault();
                                                                                applyCatalogItemToLine(
                                                                                    line.id,
                                                                                    invItem,
                                                                                );
                                                                            }}
                                                                        >
                                                                            <div className="pi-result-info">
                                                                                <div className="pi-item-name">
                                                                                    {
                                                                                        invItem.name
                                                                                    }
                                                                                </div>
                                                                                <div
                                                                                    className="pi-item-meta"
                                                                                    style={{
                                                                                        flexDirection:
                                                                                            'column',
                                                                                        alignItems:
                                                                                            'flex-start',
                                                                                        gap: 4,
                                                                                    }}
                                                                                >
                                                                                    <span
                                                                                        style={{
                                                                                            display:
                                                                                                'flex',
                                                                                            gap: 8,
                                                                                            flexWrap:
                                                                                                'wrap',
                                                                                        }}
                                                                                    >
                                                                                        <span className="pi-item-type">
                                                                                            {invItem.itemType ||
                                                                                                'Product'}
                                                                                        </span>
                                                                                        {invItem.unit ? (
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    invItem.unit
                                                                                                }
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </span>
                                                                                    {invItem.stockHint ? (
                                                                                        <span
                                                                                            style={{
                                                                                                fontSize: 11,
                                                                                                color: '#64748b',
                                                                                                lineHeight: 1.35,
                                                                                            }}
                                                                                        >
                                                                                            {
                                                                                                invItem.stockHint
                                                                                            }
                                                                                        </span>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                            <div className="pi-item-price">
                                                                                <div className="pi-price-val">
                                                                                    SAR{' '}
                                                                                    {Number(
                                                                                        invItem.price ||
                                                                                            0,
                                                                                    ).toLocaleString()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ),
                                                                )
                                                            ) : (
                                                                <div
                                                                    style={{
                                                                        padding: 14,
                                                                        fontSize: 13,
                                                                        color: '#64748b',
                                                                    }}
                                                                >
                                                                    {inventoryItems.length ===
                                                                    0
                                                                        ? 'No products loaded.'
                                                                        : 'No matching products.'}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="pi-col-acc">
                                            <select
                                                className="pi-row-input"
                                                value={line.account}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'account',
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                {ACCOUNT_OPTIONS.map((opt) => (
                                                    <option
                                                        key={opt.code}
                                                        value={`${opt.code} - ${opt.name}`}
                                                    >
                                                        {opt.code} - {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {showDesc && (
                                            <div className="pi-col-desc">
                                                <input
                                                    type="text"
                                                    defaultValue={line.description}
                                                    className="pi-row-input"
                                                />
                                            </div>
                                        )}
                                        <div className="pi-col-uom">
                                            <input
                                                type="text"
                                                className="pi-row-input"
                                                placeholder="UOM"
                                                value={line.uom ?? ''}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'uom',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                defaultValue={line.qty}
                                                key={`qty-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'qty',
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    handleMathKeyDown(
                                                        e,
                                                        line.id,
                                                        'qty'
                                                    )
                                                }
                                                onBlur={(e) =>
                                                    handleMathBlur(e, line.id, 'qty')
                                                }
                                            />
                                        </div>
                                        <div className="pi-col-price">
                                            <input
                                                type="text"
                                                defaultValue={line.price}
                                                key={`price-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'price',
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    handleMathKeyDown(
                                                        e,
                                                        line.id,
                                                        'price'
                                                    )
                                                }
                                                onBlur={(e) =>
                                                    handleMathBlur(e, line.id, 'price')
                                                }
                                            />
                                        </div>
                                        {showDiscount && (
                                            <div
                                                className="pi-col-disc"
                                                style={{
                                                    display: 'flex',
                                                    gap: 6,
                                                    alignItems: 'center',
                                                    minWidth: 0,
                                                }}
                                            >
                                                <input
                                                    type="text"
                                                    className="pi-row-input-num pi-math-input"
                                                    style={{ flex: 1, minWidth: 0 }}
                                                    value={
                                                        line.discount === undefined ||
                                                        line.discount === null
                                                            ? ''
                                                            : String(line.discount)
                                                    }
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'discount',
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(e) =>
                                                        handleMathKeyDown(
                                                            e,
                                                            line.id,
                                                            'discount',
                                                        )
                                                    }
                                                    onBlur={(e) =>
                                                        handleMathBlur(
                                                            e,
                                                            line.id,
                                                            'discount',
                                                        )
                                                    }
                                                />
                                                <select
                                                    className="pi-row-input"
                                                    style={{
                                                        flex: '0 0 auto',
                                                        maxWidth: 76,
                                                        padding: '6px 4px',
                                                        fontSize: 12,
                                                    }}
                                                    value={
                                                        line.discountMode ===
                                                        'fixed_sar'
                                                            ? 'fixed_sar'
                                                            : 'percent'
                                                    }
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'discountMode',
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="percent">
                                                        %
                                                    </option>
                                                    <option value="fixed_sar">
                                                        SAR
                                                    </option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="pi-col-total">
                                            SAR{' '}
                                            {
                                                computeLineFinancials(
                                                    line,
                                                    amountsTaxInclusive,
                                                ).lineExStr
                                            }
                                        </div>
                                        <div className="pi-col-tax">
                                            <select
                                                className="pi-row-input"
                                                value={line.taxCode}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'taxCode',
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                {TAXES.map((t) => (
                                                    <option
                                                        key={t.id}
                                                        value={t.code}
                                                    >
                                                        {t.code}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">
                                            SAR {line.taxAmt}
                                        </div>
                                        <div className="pi-col-total">
                                            SAR {line.totalFinal}
                                        </div>
                                        <div
                                            className="pi-col-total"
                                            style={{
                                                background: '#FFFBEB',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {line.lastSalePrice != null &&
                                            Number(line.lastSalePrice) > 0 ? (
                                                `SAR ${Number(line.lastSalePrice).toLocaleString()}`
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>—</span>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <button
                                                type="button"
                                                title="Remove line"
                                                aria-label="Remove line"
                                                onClick={() =>
                                                    removeLineItem(line.id)
                                                }
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 8,
                                                    border: '1px solid #fecaca',
                                                    background: '#fff',
                                                    color: '#b91c1c',
                                                    cursor: 'pointer',
                                                    lineHeight: 0,
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="pi-line-row">
                                    <div
                                        ref={invoiceLineSearchWrapRef}
                                        className="pi-search-box-wrapper"
                                        style={{ position: 'relative', flex: 1 }}
                                    >
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search product to add"
                                                value={searchQuery}
                                                onChange={(e) =>
                                                    applySearchQuery(e.target.value)
                                                }
                                                onKeyDown={handleKeyDown}
                                                onFocus={openInvoiceLineSearch}
                                            />
                                        </div>
                                        {showDropdown ? (
                                            <div className="pi-search-results">
                                                {searchResults.length > 0 ? (
                                                    searchResults.map((item, index) => (
                                                        <div
                                                            key={`${item.id}-${item.name}`}
                                                            className={`pi-result-item ${
                                                                selectedIndex === index
                                                                    ? 'selected'
                                                                    : ''
                                                            }`}
                                                            onClick={() =>
                                                                addItemToLines(item)
                                                            }
                                                            onMouseEnter={() =>
                                                                setSelectedIndex(index)
                                                            }
                                                        >
                                                            <div className="pi-result-info">
                                                                <div className="pi-item-name">
                                                                    {item.name}
                                                                </div>
                                                                <div
                                                                    className="pi-item-meta"
                                                                    style={{
                                                                        flexDirection: 'column',
                                                                        alignItems: 'flex-start',
                                                                        gap: 4,
                                                                    }}
                                                                >
                                                                    <span
                                                                        style={{
                                                                            display: 'flex',
                                                                            gap: 8,
                                                                            flexWrap: 'wrap',
                                                                        }}
                                                                    >
                                                                        <span className="pi-item-type">
                                                                            {item.itemType ||
                                                                                'Product'}
                                                                        </span>
                                                                        <span>
                                                                            {item.unit
                                                                                ? `• ${item.unit}`
                                                                                : null}
                                                                        </span>
                                                                    </span>
                                                                    {item.stockHint ? (
                                                                        <span
                                                                            style={{
                                                                                fontSize: 11,
                                                                                color: '#64748b',
                                                                                lineHeight: 1.35,
                                                                            }}
                                                                        >
                                                                            {item.stockHint}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <div className="pi-item-price">
                                                                <div className="pi-price-val">
                                                                    SAR{' '}
                                                                    {Number(
                                                                        item.price || 0,
                                                                    ).toLocaleString()}
                                                                </div>
                                                                <div className="pi-price-unit">
                                                                    {item.unit
                                                                        ? `per ${item.unit}`
                                                                        : ' '}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div
                                                        style={{
                                                            padding: 14,
                                                            fontSize: 13,
                                                            color: '#64748b',
                                                        }}
                                                    >
                                                        {inventoryItems.length === 0
                                                            ? 'No products loaded. Try again later or use “Add line” and type manually.'
                                                            : searchQuery.trim()
                                                              ? 'No matching products.'
                                                              : 'No products available.'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-add-line"
                                        onClick={addEmptyLine}
                                    >
                                        <Plus size={16} /> Add line
                                    </button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: ↑ ↓ arrows, Enter to select from
                                    search. Price fields support math (e.g. 120*2).
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showLineNum}
                                        onChange={(e) =>
                                            setShowLineNum(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Column — Line number</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showDesc}
                                        onChange={(e) =>
                                            setShowDesc(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showDiscount}
                                        onChange={(e) =>
                                            setShowDiscount(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={amountsTaxInclusive}
                                        onChange={(e) =>
                                            setAmountsTaxInclusive(
                                                e.target.checked,
                                            )
                                        }
                                    />{' '}
                                    <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight / Other Charges (SAR)</label>
                                        <input
                                            type="text"
                                            value={freightCharges}
                                            onChange={(e) =>
                                                setFreightCharges(e.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input
                                                type="text"
                                                value={invoiceDiscountValue}
                                                onChange={(e) =>
                                                    setInvoiceDiscountValue(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <select
                                                value={invoiceDiscountMode}
                                                onChange={(e) =>
                                                    setInvoiceDiscountMode(
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="fixed_sar">
                                                    Fixed (SAR)
                                                </option>
                                                <option value="percent">
                                                    %
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea
                                            placeholder="Internal notes (optional, printed on invoice)"
                                            rows={4}
                                            value={internalNotes}
                                            onChange={(e) => setInternalNotes(e.target.value)}
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
                                    <div
                                        className="pi-ap-alert"
                                        style={{ marginTop: 12 }}
                                    >
                                        <span>
                                            Creates <strong>Accounts Receivable</strong> for
                                            this workshop branch. A linked{' '}
                                            <strong>Purchase Invoice</strong> will appear in
                                            the workshop&apos;s Accounting module.
                                        </span>
                                    </div>
                                </div>
                            </div>
                                </>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {viewOpen && (
                    <Modal
                        title="Sales invoice"
                        width="min(980px, 99vw)"
                        contentClassName="wpi-invoice-preview-modal"
                        onClose={() => {
                            setViewOpen(false);
                            setViewPayload(null);
                        }}
                    >
                        {viewLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : viewPayload?.error ? (
                            <p style={{ margin: 0, color: '#B91C1C' }}>{viewPayload.error}</p>
                        ) : viewPayload?.invoice ? (
                            <WorkshopPurchaseInvoiceView
                                compact
                                variant="supplier_sales"
                                detail={mapSupplierSalesInvoiceToWorkshopDetail(viewPayload.invoice)}
                                listRow={mapSupplierSalesInvoiceToWorkshopListRow(viewPayload.invoice)}
                            />
                        ) : (
                            <p style={{ margin: 0 }}>No data.</p>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
