import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Calendar, ShoppingCart, Search, Zap, Eye, Download, Building2, History, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import SupplierSuperSupplierPurchasesPanel from './SupplierSuperSupplierPurchasesPanel';
import '../../styles/admin/AccountingPage.css';
import {
    createSupplierPayable,
    downloadSupplierPayablePdf,
    getSupplierPayable,
    listSupplierPayables,
    listSupplierProducts,
    listSupplierSuperSuppliers,
    createSupplierSuperSupplier,
    listSupplierSuperSupplierAudit,
} from '../../services/supplierApi';

const ACCOUNT_OPTIONS = [
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Rent Expense' },
    { code: '6200', name: 'Utilities Expense' },
    { code: '6300', name: 'Salaries & Wages' },
    { code: '1410', name: 'Inventory Asset' },
    { code: '4100', name: 'Sales Revenue' },
];

const TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

function extractArray(res, keys) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
    }
    return [];
}

function mapPayableToRow(p) {
    const statusRaw = (p.status ?? p.state ?? 'pending').toString();
    const status =
        statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1).toLowerCase();
    return {
        id: p.id,
        ref: p.vatNumber ?? p.reference ?? p.invoiceRef ?? '-',
        date: (p.openingBalanceDate ?? p.date ?? p.invoiceDate ?? '-').toString().slice(0, 10),
        description: p.companyName ?? p.vendorName ?? p.name ?? '-',
        amount: Number(p.openingBalance ?? p.amount ?? p.total ?? p.balance ?? 0),
        status,
    };
}

function statusBadgeClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('paid') || s.includes('approved') || s.includes('closed')) return 'status-completed';
    if (s.includes('overdue') || s.includes('cancel')) return 'status-badge'; // use red style if exists
    return 'status-completed';
}

export default function SupplierPurchaseInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [refNo, setRefNo] = useState('');
    const [vendor, setVendor] = useState('');
    const [description, setDescription] = useState('');

    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const [viewOpen, setViewOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState('');
    const [viewDetail, setViewDetail] = useState(null);

    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState('');
    const [downloadingId, setDownloadingId] = useState(null);

    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [ssLoading, setSsLoading] = useState(true);
    const [addSsOpen, setAddSsOpen] = useState(false);
    const [ssForm, setSsForm] = useState({
        name: '',
        mobile: '',
        email: '',
        vatNumber: '',
        address: '',
        notes: '',
    });
    const [ssSaving, setSsSaving] = useState(false);
    const [ssErr, setSsErr] = useState('');
    const [createSspPurchaseForId, setCreateSspPurchaseForId] = useState(null);
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditSsFilter, setAuditSsFilter] = useState('');
    const [auditItems, setAuditItems] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const loadPayables = useCallback(async () => {
        setListLoading(true);
        setListError('');
        try {
            const res = await listSupplierPayables({ limit: 200 });
            const raw = extractArray(res, ['payables', 'list', 'items', 'data']);
            const list = raw.map(mapPayableToRow).filter((row) => row.id != null);
            setInvoices(list);
        } catch (err) {
            console.error('Supplier purchase invoices API failed:', err);
            setInvoices([]);
            setListError(err?.message || 'Failed to load payables');
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPayables();
    }, [loadPayables]);

    const loadSuperSuppliers = useCallback(async () => {
        setSsLoading(true);
        try {
            const res = await listSupplierSuperSuppliers();
            const list = res?.superSuppliers ?? [];
            setSuperSuppliers(Array.isArray(list) ? list : []);
        } catch {
            setSuperSuppliers([]);
        } finally {
            setSsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSuperSuppliers();
    }, [loadSuperSuppliers]);

    const openAuditModal = async (superSupplierId = '') => {
        setAuditOpen(true);
        setAuditSsFilter(superSupplierId);
        setAuditLoading(true);
        try {
            const res = await listSupplierSuperSupplierAudit({
                ...(superSupplierId ? { superSupplierId } : {}),
                limit: 200,
            });
            setAuditItems(res?.items ?? []);
        } catch {
            setAuditItems([]);
        } finally {
            setAuditLoading(false);
        }
    };

    const handleSaveSuperSupplier = async () => {
        if (!ssForm.name?.trim()) {
            setSsErr('Name is required');
            return;
        }
        setSsSaving(true);
        setSsErr('');
        try {
            await createSupplierSuperSupplier({
                name: ssForm.name.trim(),
                mobile: ssForm.mobile?.trim() || undefined,
                email: ssForm.email?.trim() || undefined,
                vatNumber: ssForm.vatNumber?.trim() || undefined,
                address: ssForm.address?.trim() || undefined,
                notes: ssForm.notes?.trim() || undefined,
            });
            setAddSsOpen(false);
            setSsForm({
                name: '',
                mobile: '',
                email: '',
                vatNumber: '',
                address: '',
                notes: '',
            });
            await loadSuperSuppliers();
        } catch (e) {
            setSsErr(e?.message || 'Could not save super supplier');
        } finally {
            setSsSaving(false);
        }
    };

    useEffect(() => {
        if (!modalOpen) return undefined;
        let cancelled = false;
        setCatalogLoading(true);
        listSupplierProducts({ limit: 300 })
            .then((res) => {
                const raw = extractArray(res, ['products', 'items', 'list']);
                const mapped = raw.map((p) => ({
                    id: p.id ?? p.supplierProductId ?? String(Math.random()),
                    name: p.name ?? p.productName ?? 'Item',
                    price: Number(p.price ?? p.unitPrice ?? p.sellingPrice ?? 0),
                    unit: p.unit ?? p.uom ?? 'pcs',
                    type: String(p.type ?? '').toLowerCase().includes('service') ? 'Service' : 'Stock',
                }));
                if (!cancelled) setCatalogItems(mapped);
            })
            .catch(() => {
                if (!cancelled) setCatalogItems([]);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen]);

    const catalogForSearch = catalogItems.length ? catalogItems : [];

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            const filtered = catalogForSearch.filter((item) =>
                item.name.toLowerCase().includes(query.toLowerCase()),
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
                    const taxRate = TAXES.find((t) => t.code === (field === 'taxCode' ? value : line.taxCode))?.rate || 0;
                    const subtotal = qty * price;
                    const taxAmt = subtotal * taxRate;
                    updated.taxAmt = taxAmt.toFixed(2);
                    updated.totalFinal = (subtotal + taxAmt).toFixed(2);
                }
                return updated;
            }),
        );
    };

    const getSummary = () => {
        const subtotal = lineItems.reduce((acc, line) => acc + (parseFloat(line.qty) * parseFloat(line.price) || 0), 0);
        const totalTax = lineItems.reduce((acc, line) => acc + parseFloat(line.taxAmt || 0), 0);
        const grandTotal = subtotal + totalTax;
        return {
            subtotal: subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalTax: totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            grandTotal: grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        };
    };
    const summary = getSummary();

    const addItemToLines = (item) => {
        const newLine = {
            id: Date.now(),
            item: item.name,
            account: item.type === 'Stock' ? '1410 - Inventory Asset' : '5100 - Cost of Goods Sold',
            description: '',
            uom: item.unit,
            qty: 1,
            price: item.price,
            discount: 0,
            taxCode: 'VAT 15%',
            taxAmt: (item.price * 0.15).toFixed(2),
            totalFinal: (item.price * 1.15).toFixed(2),
        };
        setLineItems((prev) => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        else if (e.key === 'ArrowUp') setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        else if (e.key === 'Enter' && selectedIndex >= 0) addItemToLines(searchResults[selectedIndex]);
        else if (e.key === 'Escape') setShowDropdown(false);
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str || !/^[\d\s+*/().\-*]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            const result = Function(`return (${str})`)();
            if (typeof result === 'number' && isFinite(result)) return parseFloat(result.toFixed(6)).toString();
        } catch {
            /* ignore */
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
        if (evaluated !== e.target.value) updateLineItem(lineId, field, evaluated);
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') due.setDate(issue.getDate() + parseInt(netDays || 0, 10));
        else if (dueDateType === 'Custom') return customDueDate || '—';
        else if (dueDateType === 'EOM') due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return due.toISOString().slice(0, 10);
    };
    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        const cols = [];
        if (showLineNum) cols.push('40px');
        cols.push('2fr', '1.5fr');
        if (showDesc) cols.push('2fr');
        cols.push('0.8fr', '0.8fr', '1fr');
        if (showDiscount) cols.push('1fr');
        cols.push('1fr', '1fr', '1fr', '1fr');
        return cols.join(' ');
    };

    const resetCreateForm = () => {
        setLineItems([]);
        setRefNo('');
        setVendor('');
        setDescription('');
        setIssueDate(new Date().toISOString().slice(0, 10));
        setSearchQuery('');
        setCreateError('');
    };

    const handleCreateInvoice = async () => {
        setCreateError('');
        const companyName = vendor.trim();
        if (!companyName) {
            setCreateError('Supplier / vendor name is required.');
            return;
        }
        const amount = lineItems.reduce((acc, line) => acc + parseFloat(line.totalFinal || 0), 0);
        if (!lineItems.length || !(amount > 0)) {
            setCreateError('Add at least one line item with a positive total.');
            return;
        }

        setCreateSubmitting(true);
        try {
            await createSupplierPayable({
                companyName,
                openingBalance: Math.round(amount * 100) / 100,
                openingBalanceDate: issueDate,
                vatNumber: refNo.trim() || undefined,
                contactPerson: '',
                contactNumber: '',
                notes: description.trim() || undefined,
            });
            setModalOpen(false);
            resetCreateForm();
            await loadPayables();
        } catch (err) {
            console.error('Create supplier payable failed:', err);
            setCreateError(err?.message || 'Could not create purchase invoice');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const openView = async (id) => {
        setViewOpen(true);
        setViewDetail(null);
        setViewError('');
        setViewLoading(true);
        try {
            const res = await getSupplierPayable(id);
            const detail = res?.payable ?? res?.data ?? res;
            setViewDetail(detail);
        } catch (err) {
            setViewError(err?.message || 'Could not load payable');
        } finally {
            setViewLoading(false);
        }
    };

    const triggerBlobDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownload = async (id) => {
        setDownloadingId(id);
        try {
            const { blob, filename } = await downloadSupplierPayablePdf(id);
            triggerBlobDownload(blob, filename);
        } catch (pdfErr) {
            try {
                const res = await getSupplierPayable(id);
                const detail = res?.payable ?? res?.data ?? res;
                const text = typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail);
                const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
                triggerBlobDownload(blob, `payable-${id}.json`);
            } catch (err) {
                window.alert(err?.message || pdfErr?.message || 'Download failed');
            }
        } finally {
            setDownloadingId(null);
        }
    };

    const renderViewFields = (p) => {
        if (!p || typeof p !== 'object') return <p style={{ color: 'var(--color-text-muted)' }}>No detail returned.</p>;
        const rows = [
            ['ID', p.id],
            ['Vendor', p.companyName ?? p.vendorName],
            ['VAT / Ref', p.vatNumber ?? p.reference],
            ['Date', p.openingBalanceDate ?? p.date],
            ['Amount (SAR)', p.openingBalance ?? p.amount ?? p.total],
            ['Status', p.status ?? p.state],
            ['Contact', p.contactPerson],
            ['Phone', p.contactNumber],
            ['Notes', p.notes],
        ].filter(([, v]) => v !== undefined && v !== null && v !== '');
        return (
            <table className="ws-table" style={{ marginTop: 8 }}>
                <tbody>
                    {rows.map(([k, v]) => (
                        <tr key={k}>
                            <td style={{ fontWeight: 600, width: '35%', verticalAlign: 'top' }}>{k}</td>
                            <td>{String(v)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="purchases-view">
            {listError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load purchase invoices:</strong> {listError}
                </div>
            ) : null}

            <header className="purchases-header-row">
                <div className="pi-header-left">
                    <h2 className="cash-bank-title">Purchases</h2>
                    <p className="cash-bank-desc">Track purchase orders and bills.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="btn-save-all"
                        onClick={() => {
                            setSsErr('');
                            setAddSsOpen(true);
                        }}
                    >
                        <Building2 size={18} /> Add Super Supplier
                    </button>
                    <button
                        type="button"
                        className="btn-save-all"
                        onClick={() => {
                            setCreateError('');
                            setModalOpen(true);
                        }}
                    >
                        <Plus size={18} /> New Purchase Invoice
                    </button>
                </div>
            </header>

            <section className="premium-table cash-bank-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {listLoading ? (
                            <tr>
                                <td colSpan={6} className="table-cell table-empty">
                                    Loading purchase invoices…
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="table-cell table-empty">
                                    {listError ? 'No data loaded.' : 'No purchase invoices found.'}
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={String(inv.id)} className="table-row">
                                    <td className="table-cell">{inv.date}</td>
                                    <td className="table-cell">{inv.ref}</td>
                                    <td className="table-cell">{inv.description}</td>
                                    <td className="table-cell">
                                        SAR {(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${statusBadgeClass(inv.status)}`}>{inv.status}</span>
                                    </td>
                                    <td className="table-cell">
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="btn-pi-cancel"
                                                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                onClick={() => openView(inv.id)}
                                            >
                                                <Eye size={14} /> View
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-pi-cancel"
                                                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                disabled={downloadingId === inv.id}
                                                onClick={() => handleDownload(inv.id)}
                                            >
                                                <Download size={14} /> {downloadingId === inv.id ? '…' : 'Download'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <section className="ws-section" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Building2 size={18} /> Super suppliers
                    </h3>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Vendors you buy inventory from. Record purchases here; all actions are stored in the audit log.
                    </p>
                    <div style={{ marginTop: 10 }}>
                        <button type="button" className="btn-pi-cancel" onClick={() => openAuditModal('')}>
                            <History size={14} /> View full audit log
                        </button>
                    </div>
                </div>
                <div className="premium-table cash-bank-table" style={{ border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">Name</th>
                                <th className="table-th">VAT / Contact</th>
                                <th className="table-th">Purchases</th>
                                <th className="table-th">Status</th>
                                <th className="table-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ssLoading ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">
                                        <Loader2 size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                        Loading super suppliers…
                                    </td>
                                </tr>
                            ) : superSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">
                                        No super suppliers yet. Use &quot;Add Super Supplier&quot; above.
                                    </td>
                                </tr>
                            ) : (
                                superSuppliers.map((ss) => (
                                    <tr key={String(ss.id)} className="table-row">
                                        <td className="table-cell">
                                            <strong>{ss.name}</strong>
                                            {ss.notes ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    {ss.notes}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="table-cell">
                                            <div>{ss.vatNumber || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                {[ss.mobile, ss.email].filter(Boolean).join(' · ') || '—'}
                                            </div>
                                        </td>
                                        <td className="table-cell">{ss.purchaseCount ?? 0}</td>
                                        <td className="table-cell">
                                            <span className={`status-badge ${ss.isActive ? 'status-completed' : 'status-badge'}`}>
                                                {ss.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className="btn-pi-cancel"
                                                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                    disabled={!ss.isActive}
                                                    onClick={() => setCreateSspPurchaseForId(String(ss.id))}
                                                >
                                                    <Plus size={14} /> Record purchase
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-pi-cancel"
                                                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                    onClick={() => openAuditModal(String(ss.id))}
                                                >
                                                    <History size={14} /> Audit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <SupplierSuperSupplierPurchasesPanel
                superSuppliers={superSuppliers}
                createIntentSupplierId={createSspPurchaseForId}
                onConsumeCreateIntent={() => setCreateSspPurchaseForId(null)}
                onPurchasesMutated={loadSuperSuppliers}
            />

            <AnimatePresence>
                {addSsOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Building2 size={20} /> Add Super Supplier
                            </span>
                        }
                        onClose={() => !ssSaving && setAddSsOpen(false)}
                        width="520px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" className="btn-portal-outline" disabled={ssSaving} onClick={() => setAddSsOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-pi-create" disabled={ssSaving} onClick={handleSaveSuperSupplier}>
                                    {ssSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        }
                    >
                        {ssErr ? (
                            <p style={{ margin: '0 0 12px', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {ssErr}
                            </p>
                        ) : null}
                        <div className="pi-field pi-full-width">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={ssForm.name}
                                onChange={(e) => setSsForm((s) => ({ ...s, name: e.target.value }))}
                                placeholder="Company name"
                            />
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>VAT number</label>
                            <input
                                type="text"
                                value={ssForm.vatNumber}
                                onChange={(e) => setSsForm((s) => ({ ...s, vatNumber: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="pi-field">
                                <label>Mobile</label>
                                <input
                                    type="text"
                                    value={ssForm.mobile}
                                    onChange={(e) => setSsForm((s) => ({ ...s, mobile: e.target.value }))}
                                />
                            </div>
                            <div className="pi-field">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={ssForm.email}
                                    onChange={(e) => setSsForm((s) => ({ ...s, email: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Address</label>
                            <input
                                type="text"
                                value={ssForm.address}
                                onChange={(e) => setSsForm((s) => ({ ...s, address: e.target.value }))}
                            />
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Notes</label>
                            <textarea
                                rows={3}
                                value={ssForm.notes}
                                onChange={(e) => setSsForm((s) => ({ ...s, notes: e.target.value }))}
                            />
                        </div>
                    </Modal>
                )}

                {auditOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <History size={20} /> Super supplier audit {auditSsFilter ? '(filtered)' : ''}
                            </span>
                        }
                        onClose={() => setAuditOpen(false)}
                        width="720px"
                        footer={
                            <button type="button" className="btn-portal-outline" onClick={() => setAuditOpen(false)}>
                                Close
                            </button>
                        }
                    >
                        {auditLoading ? (
                            <p style={{ margin: 0 }}>
                                <Loader2 size={18} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
                                Loading…
                            </p>
                        ) : (
                            <div style={{ maxHeight: 420, overflow: 'auto' }}>
                                <table className="ws-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: 8 }}>When</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Action</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Summary</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                                                    No audit entries yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditItems.map((a) => (
                                                <tr key={a.id}>
                                                    <td style={{ padding: 8, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                        {a.createdAt?.slice(0, 19)?.replace('T', ' ') ?? '—'}
                                                    </td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{a.action}</td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{a.summary || '—'}</td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{a.actorName || '—'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Modal>
                )}

                {viewOpen && (
                    <Modal
                        title="Purchase invoice (payable)"
                        onClose={() => {
                            setViewOpen(false);
                            setViewDetail(null);
                            setViewError('');
                        }}
                        width="560px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-portal-outline" onClick={() => setViewOpen(false)}>
                                    Close
                                </button>
                            </div>
                        }
                    >
                        {viewLoading ? (
                            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Loading…</p>
                        ) : viewError ? (
                            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{viewError}</p>
                        ) : (
                            renderViewFields(viewDetail)
                        )}
                    </Modal>
                )}

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
                            if (!createSubmitting) {
                                setModalOpen(false);
                                resetCreateForm();
                            }
                        }}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button type="button" className="btn-pi-cancel" disabled={createSubmitting} onClick={() => { setModalOpen(false); resetCreateForm(); }}>
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button type="button" className="btn-pi-create" disabled={createSubmitting} onClick={handleCreateInvoice}>
                                        {createSubmitting ? 'Creating…' : 'Create Purchase Invoice'}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        {createError ? (
                            <p style={{ margin: '0 0 12px 0', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {createError}
                            </p>
                        ) : null}
                        <div className="pi-form-container">
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
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input type="text" placeholder="Vendor inv #" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Supplier / Vendor *</label>
                                <input type="text" placeholder="Type or select vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input type="text" placeholder="Invoice description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>

                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>
                                {catalogLoading ? 'Loading catalog…' : catalogForSearch.length ? 'Search products from your catalog to add lines.' : 'Add catalog products in Product Catalog, or type search will be empty.'}
                            </p>

                            <div className="pi-lines-section">
                                <div className="pi-lines-header" style={{ gridTemplateColumns: getGridColumns() }}>
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
                                    <div className="pi-col-total">Total</div>
                                </div>

                                {lineItems.map((line, idx) => (
                                    <div key={line.id} className="pi-lines-header pi-line-data-row" style={{ gridTemplateColumns: getGridColumns() }}>
                                        {showLineNum && <div className="pi-col-hash">{idx + 1}</div>}
                                        <div className="pi-col-item">
                                            <input
                                                type="text"
                                                value={line.item}
                                                className="pi-row-input"
                                                onChange={(e) => updateLineItem(line.id, 'item', e.target.value)}
                                            />
                                        </div>
                                        <div className="pi-col-acc">
                                            <select
                                                className="pi-row-input"
                                                value={line.account}
                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                            >
                                                {ACCOUNT_OPTIONS.map((opt) => (
                                                    <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                        {opt.code} - {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {showDesc && (
                                            <div className="pi-col-desc">
                                                <input type="text" defaultValue={line.description} className="pi-row-input" />
                                            </div>
                                        )}
                                        <div className="pi-col-uom">{line.uom}</div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                defaultValue={line.qty}
                                                key={`qty-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'qty')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                            />
                                        </div>
                                        <div className="pi-col-price">
                                            <input
                                                type="text"
                                                defaultValue={line.price}
                                                key={`price-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'price')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'price')}
                                            />
                                        </div>
                                        {showDiscount && (
                                            <div className="pi-col-disc">
                                                <input type="number" defaultValue={line.discount} className="pi-row-input-num" />
                                            </div>
                                        )}
                                        <div className="pi-col-total">SAR {(parseFloat(line.qty) * parseFloat(line.price) || 0).toFixed(2)}</div>
                                        <div className="pi-col-tax">
                                            <select className="pi-row-input" value={line.taxCode} onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}>
                                                {TAXES.map((t) => (
                                                    <option key={t.id} value={t.code}>
                                                        {t.code}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">SAR {line.taxAmt}</div>
                                        <div className="pi-col-total">SAR {line.totalFinal}</div>
                                    </div>
                                ))}

                                <div className="pi-line-row">
                                    <div className="pi-search-box-wrapper" style={{ position: 'relative', flex: 1 }}>
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search product to add"
                                                value={searchQuery}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                                            />
                                        </div>
                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="pi-search-results">
                                                {searchResults.map((item, index) => (
                                                    <div
                                                        key={item.id}
                                                        className={`pi-result-item ${selectedIndex === index ? 'selected' : ''}`}
                                                        onClick={() => addItemToLines(item)}
                                                        onMouseEnter={() => setSelectedIndex(index)}
                                                        role="presentation"
                                                    >
                                                        <div className="pi-result-info">
                                                            <div className="pi-item-name">{item.name}</div>
                                                            <div className="pi-item-meta">
                                                                <span className="pi-item-type">{item.type}</span>
                                                                <span>• {item.unit}</span>
                                                            </div>
                                                        </div>
                                                        <div className="pi-item-price">
                                                            <div className="pi-price-val">SAR {item.price}</div>
                                                            <div className="pi-price-unit">per {item.unit}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" className="btn-add-line">
                                        <Plus size={16} /> Add line
                                    </button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: Type to search catalog, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 12*5)
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showLineNum} onChange={(e) => setShowLineNum(e.target.checked)} /> <span>Column — Line number</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDesc} onChange={(e) => setShowDesc(e.target.checked)} /> <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} /> <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" /> <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight-in (SAR)</label>
                                        <input type="text" defaultValue="0" />
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input type="text" defaultValue="0" />
                                            <select>
                                                <option>Fixed (S.. )</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea placeholder="Internal notes" rows={4} />
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
                                            Creates <strong>Accounts Payable</strong> via the supplier API. Line items are used to calculate the total sent to the server.
                                        </span>
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
