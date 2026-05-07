import React, { useEffect, useState } from 'react';
import { FileText, Plus, Eye, Download, Calendar, Search, Zap, Pencil, Trash2 } from 'lucide-react';
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
    updateSupplierInvoice,
} from '../../services/supplierApi';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';

const INVENTORY_ITEMS = [
    { id: 1, name: 'Engine Oil — Full Synthetic 5W40', price: 45, unit: 'liter', lastPrice: 42 },
    { id: 2, name: 'Oil Filter — Universal', price: 22, unit: 'pcs', lastPrice: 22 },
    { id: 3, name: 'Car Wash Normal - Small', price: 20, unit: 'service', lastPrice: 18 },
    { id: 4, name: 'Brake Fluid DOT4', price: 28, unit: 'liter', lastPrice: 28 },
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
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState('');
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewPayload, setViewPayload] = useState(null);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [refNo, setRefNo] = useState('');
    const [branch, setBranch] = useState('');
    const [cashAccount, setCashAccount] = useState('');
    const [description, setDescription] = useState('');

    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);

    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [inventoryItems, setInventoryItems] = useState(INVENTORY_ITEMS);
    const [branches, setBranches] = useState([]);

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            const filtered = inventoryItems.filter((item) =>
                item.name.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(filtered);
            setShowDropdown(true);
            setSelectedIndex(0);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    };

    const updateLineItem = (id, field, value) => {
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const updated = { ...line, [field]: value };
                if (field === 'qty' || field === 'price' || field === 'taxCode') {
                    const qty = parseFloat(field === 'qty' ? value : line.qty) || 0;
                    const price = parseFloat(field === 'price' ? value : line.price) || 0;
                    const taxRate =
                        TAXES.find((t) => t.code === (field === 'taxCode' ? value : line.taxCode))?.rate || 0;
                    const subtotal = qty * price;
                    const taxAmt = subtotal * taxRate;
                    updated.taxAmt = taxAmt.toFixed(2);
                    updated.totalFinal = (subtotal + taxAmt).toFixed(2);
                }
                return updated;
            })
        );
    };

    const getSummary = () => {
        const subtotal = lineItems.reduce(
            (acc, line) => acc + (parseFloat(line.qty) * parseFloat(line.price) || 0),
            0
        );
        const totalTax = lineItems.reduce((acc, line) => acc + parseFloat(line.taxAmt || 0), 0);
        const grandTotal = subtotal + totalTax;
        return {
            subtotal: subtotal.toLocaleString(undefined, {
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

    const addItemToLines = (item) => {
        const newLine = {
            id: Date.now(),
            productId: item.id != null && item.id !== '' ? String(item.id) : undefined,
            item: item.name,
            account: '4100 - Sales Revenue',
            description: '',
            uom: item.unit,
            qty: 1,
            price: item.price,
            discount: 0,
            taxCode: 'VAT 15%',
            taxAmt: (item.price * 0.15).toFixed(2),
            totalFinal: (item.price * 1.15).toFixed(2),
            lastSalePrice: item.lastPrice ?? item.price,
        };
        setLineItems((prev) => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const addEmptyLine = () => {
        const newLine = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            productId: undefined,
            item: '',
            account: '4100 - Sales Revenue',
            description: '',
            uom: 'pcs',
            qty: 1,
            price: 0,
            discount: 0,
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            lastSalePrice: 0,
        };
        setLineItems((prev) => [...prev, newLine]);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') {
            setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
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
        if (showDiscount) cols.push('1fr');
        cols.push('1fr', '1fr', '1fr', '1fr', '1fr'); // Total, TaxCode, TaxAmt, Total(final), Last Sale
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
        setLineItems([]);
        setSaveError('');
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

    const loadInvoiceList = async () => {
        setListLoading(true);
        setListError('');
        try {
            const invRes = await listSupplierInvoices({ limit: 100 });
            const invList = Array.isArray(invRes?.invoices)
                ? invRes.invoices.map((inv) => ({
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
                      paymentStatus:
                          inv.paymentStatus ||
                          (Number(inv.outstanding || 0) <= 0 ? 'paid' : 'unpaid'),
                      vendorRef: inv.deliveryNoteUrl || '—',
                      productLabel: inv.productLabel ?? '—',
                      quantityLabel: inv.quantityLabel ?? '—',
                      unitLabel: inv.unitLabel ?? '—',
                  }))
                : [];
            setInvoices(invList);
        } catch (err) {
            console.error('List supplier invoices failed:', err);
            setListError(err?.message || 'Failed to load invoices.');
            setInvoices([]);
        } finally {
            setListLoading(false);
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
        const normalizedLines = lineItems.map((line, idx) => ({
            index: idx,
            productName: String(line.item || '').trim(),
            qty: Number(line.qty) || 0,
            unitPrice: Number(line.price) || 0,
            vatRate: Number(TAXES.find((t) => t.code === line.taxCode)?.percent || 0),
            productId: line.productId ? String(line.productId) : undefined,
        }));
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
            ...(line.productId ? { productId: line.productId } : {}),
            productName: line.productName,
            qty: line.qty,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
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
            setRefNo(inv.invoiceNo || '');
            const due = inv.dueDate ? new Date(inv.dueDate) : new Date();
            const issue = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
            const diffDays = Math.round((due - issue) / (1000 * 60 * 60 * 24));
            if (!Number.isNaN(diffDays) && diffDays >= 0) {
                setDueDateType('Net');
                setNetDays(diffDays || 30);
            }
            setLineItems(
                (inv.items || []).map((it, idx) => ({
                    id: Date.now() + idx,
                    productId: it.productId != null ? String(it.productId) : undefined,
                    item: it.productName,
                    account: '4100 - Sales Revenue',
                    description: '',
                    uom: 'pcs',
                    qty: String(it.qty),
                    price: String(it.unitPrice),
                    discount: 0,
                    taxCode:
                        TAXES.find((t) => Math.abs(t.percent - Number(it.vatRate)) < 0.01)?.code ||
                        'VAT 15%',
                    taxAmt: (
                        Number(it.qty) *
                        Number(it.unitPrice) *
                        (Number(it.vatRate) / 100)
                    ).toFixed(2),
                    totalFinal: Number(it.lineTotal).toFixed(2),
                    lastSalePrice: Number(it.unitPrice),
                }))
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

    const list = invoices || [];

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [stockRes, branchesRes] = await Promise.all([
                    getSupplierInventoryStockBalances({ limit: 200 }),
                    getSupplierSalesInvoiceCustomerBranches().catch(() => null),
                ]);
                const stockItems = Array.isArray(stockRes?.items)
                    ? stockRes.items.map((item) => ({
                          id: item.productId,
                          name: item.productName,
                          price: Math.max(
                              0,
                              Number(item.currentBalanceWarehouse || 0) > 0
                                  ? Number(item.valueWarehouseSar || 0) /
                                        Number(item.currentBalanceWarehouse || 1)
                                  : 0,
                          ),
                          unit: item.workshopUnit || 'pcs',
                          lastPrice: 0,
                      }))
                    : [];
                const custBranches = Array.isArray(branchesRes?.branches)
                    ? branchesRes.branches
                    : [];
                if (!cancelled) {
                    if (stockItems.length) setInventoryItems(stockItems);
                    if (custBranches.length) {
                        setBranches(
                            custBranches.map((b) => ({
                                id: b.id,
                                name: b.name,
                                label: b.label || `${b.workshopName || ''} — ${b.name || ''}`.trim(),
                            })),
                        );
                    } else {
                        setBranches([]);
                    }
                }
                if (!cancelled) await loadInvoiceList();
            } catch (err) {
                console.error('Supplier sales invoices bootstrap failed:', err);
                if (!cancelled) await loadInvoiceList();
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        try {
            if (sessionStorage.getItem('supplier_open_new_sales_invoice') === '1') {
                sessionStorage.removeItem('supplier_open_new_sales_invoice');
                const presetBranch = sessionStorage.getItem(
                    'supplier_sales_invoice_preset_branch_id',
                );
                if (presetBranch) {
                    sessionStorage.removeItem('supplier_sales_invoice_preset_branch_id');
                }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from layout header
    }, []);

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
                                                <td>
                                                    <span
                                                        className={`ws-badge ws-badge--${
                                                            String(inv.paymentStatus).toLowerCase() === 'paid'
                                                                ? 'green'
                                                                : 'yellow'
                                                        }`}
                                                    >
                                                        {String(inv.paymentStatus || 'unpaid').replace(/_/g, ' ')}
                                                    </span>
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
                                    <button className="btn-pi-draft">Save as Draft</button>
                                    <button
                                        className="btn-pi-create"
                                        onClick={handleSaveInvoice}
                                        disabled={
                                            saving || !branch || lineItems.length === 0
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
                                    {!listLoading && branches.length === 0 ? (
                                        <span
                                            className="pi-sub-label"
                                            style={{ color: '#B45309', marginTop: 6, display: 'block' }}
                                        >
                                            No linked workshop branches. Your supplier account must be linked to a
                                            workshop (admin) before you can issue sales invoices.
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
                                    <div className="pi-col-price">Unit price</div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div>
                                    <div className="pi-col-tax">Tax Code</div>
                                    <div className="pi-col-tamt">Tax Amt</div>
                                    <div className="pi-col-total">Grand Total</div>
                                    <div className="pi-col-total">Last Sale Price</div>
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
                                        <div className="pi-col-item">
                                            <input
                                                type="text"
                                                value={line.item}
                                                className="pi-row-input"
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'item',
                                                        e.target.value
                                                    )
                                                }
                                            />
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
                                        <div className="pi-col-uom">{line.uom}</div>
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
                                            <div className="pi-col-disc">
                                                <input
                                                    type="number"
                                                    defaultValue={line.discount}
                                                    className="pi-row-input-num"
                                                />
                                            </div>
                                        )}
                                        <div className="pi-col-total">
                                            SAR{' '}
                                            {(
                                                parseFloat(line.qty) *
                                                    parseFloat(line.price) || 0
                                            ).toFixed(2)}
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
                                            SAR {line.lastSalePrice}
                                        </div>
                                    </div>
                                ))}

                                <div className="pi-line-row">
                                    <div
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
                                                    handleSearch(e.target.value)
                                                }
                                                onKeyDown={handleKeyDown}
                                                onFocus={() =>
                                                    searchQuery.trim() &&
                                                    setShowDropdown(true)
                                                }
                                            />
                                        </div>
                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="pi-search-results">
                                                {searchResults.map((item, index) => (
                                                    <div
                                                        key={item.id}
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
                                                            <div className="pi-item-meta">
                                                                <span className="pi-item-type">
                                                                    Service
                                                                </span>
                                                                <span>• {item.unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="pi-item-price">
                                                            <div className="pi-price-val">
                                                                SAR {item.price}
                                                            </div>
                                                            <div className="pi-price-unit">
                                                                per {item.unit}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
                                    <Zap size={14} /> Tip: Type to search, use ↑↓ arrows,
                                    Enter to select. Price fields support math (e.g. 120*2)
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
                                    <input type="checkbox" />{' '}
                                    <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight / Other Charges (SAR)</label>
                                        <input type="text" defaultValue="0" />
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input type="text" defaultValue="0" />
                                            <select>
                                                <option>Fixed (SAR)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea
                                            placeholder="Internal notes"
                                            rows={4}
                                        ></textarea>
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
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {viewOpen && (
                    <Modal
                        title="Invoice details"
                        width="680px"
                        onClose={() => {
                            setViewOpen(false);
                            setViewPayload(null);
                        }}
                        footer={
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => {
                                    setViewOpen(false);
                                    setViewPayload(null);
                                }}
                            >
                                Close
                            </button>
                        }
                    >
                        {viewLoading ? (
                            <ShimmerTextBlock lines={6} />
                        ) : viewPayload?.error ? (
                            <p style={{ margin: 0, color: '#B91C1C' }}>{viewPayload.error}</p>
                        ) : (
                            (() => {
                                const inv = viewPayload?.invoice;
                                if (!inv)
                                    return <p style={{ margin: 0 }}>No data.</p>;
                                return (
                                    <div style={{ fontSize: '0.875rem' }}>
                                        <p style={{ fontWeight: 800, margin: '0 0 8px 0', fontSize: '1rem' }}>
                                            {inv.invoiceNo}
                                        </p>
                                        <table className="ws-table" style={{ marginBottom: 12 }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>Branch</td>
                                                    <td>{inv.branch?.name ?? '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>Dates</td>
                                                    <td>
                                                        {inv.invoiceDate} → due {inv.dueDate}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>Status</td>
                                                    <td>{String(inv.status || '').replace(/_/g, ' ')}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ color: 'var(--color-text-muted)' }}>Totals</td>
                                                    <td>
                                                        SAR{' '}
                                                        {(Number(inv.grandTotal) || 0).toLocaleString()} (paid SAR{' '}
                                                        {(Number(inv.paid) || 0).toLocaleString()}, outstanding SAR{' '}
                                                        {(Number(inv.outstanding) || 0).toLocaleString()})
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <strong style={{ fontSize: '0.75rem' }}>Line items</strong>
                                        <table className="ws-table" style={{ marginTop: 8 }}>
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Qty</th>
                                                    <th>Unit</th>
                                                    <th>VAT %</th>
                                                    <th>Line total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(inv.items || []).map((it) => (
                                                    <tr key={it.id}>
                                                        <td>{it.productName}</td>
                                                        <td>{Number(it.qty)}</td>
                                                        <td>SAR {Number(it.unitPrice).toLocaleString()}</td>
                                                        <td>{Number(it.vatRate)}%</td>
                                                        <td>SAR {Number(it.lineTotal).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
