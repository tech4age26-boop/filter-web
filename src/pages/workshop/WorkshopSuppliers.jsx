import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Plus, RefreshCw, Loader, AlertCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { PI_INVENTORY_ITEMS } from './constants';
import {
    getWorkshopSuppliers,
    getRegisteredWorkshopSuppliers,
    linkSuppliersToWorkshop,
    branchScopeParams,
} from '../../services/workshopStaffApi';

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

/** Top-level or nested pagination + workshop totals from GET /workshop-staff/suppliers. */
function pickListMeta(res) {
    if (!res || typeof res !== 'object') {
        return { total: null, limit: null, offset: null, outstanding: null, currencyCode: null };
    }
    const p = res.pagination;
    const total = res.total ?? p?.total ?? res.count ?? null;
    const limit = res.limit ?? p?.limit ?? null;
    const offset = res.offset ?? p?.offset ?? null;
    const outstanding = res.outstanding ?? res.totalOutstanding ?? null;
    const currencyCode = res.currencyCode ?? res.currency ?? null;
    return { total: total != null ? Number(total) : null, limit, offset, outstanding, currencyCode };
}

/** Align list rows with admin supplier screen + workshop API aliases. */
function normalizeSupplierRow(s) {
    const status =
        s.status === 'inactive' || s.status === 'active'
            ? s.status
            : s.isActive === false
              ? 'inactive'
              : 'active';
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.supplierName ?? s.name ?? '—',
        category: s.category ?? s.registrationType ?? s.type ?? '—',
        vatId: s.vatId ?? s.taxId ?? s.vat_id ?? '',
        crNumber: s.tradeLicenseNo ?? s.crNumber ?? s.cr_no ?? s.commercialRegistration ?? '',
        contactPerson: s.contactPerson ?? s.ownerName ?? '',
        phone: s.phone ?? s.mobile ?? s.contactPhone ?? '',
        email: s.email ?? '',
        status,
        raw: s,
    };
}

export default function WorkshopSuppliers({ selectedBranchId = 'all', branches = [] }) {
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);
    const [activeTab, setActiveTab] = useState('suppliers');
    const [searchInput, setSearchInput] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [listMeta, setListMeta] = useState({
        total: null,
        outstanding: null,
        currencyCode: null,
    });
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [usingRegisteredFallback, setUsingRegisteredFallback] = useState(false);
    const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
    const [registeredSearchInput, setRegisteredSearchInput] = useState('');
    const [registeredSuppliers, setRegisteredSuppliers] = useState([]);
    const [registeredLoading, setRegisteredLoading] = useState(false);
    const [registeredError, setRegisteredError] = useState('');
    const [linkingSuppliers, setLinkingSuppliers] = useState(false);
    const [selectedRegisteredIds, setSelectedRegisteredIds] = useState([]);

    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }]);
    const [notes, setNotes] = useState('');
    const [purchases, setPurchases] = useState([
        { id: '1', invoice_number: 'PI-2026-0041', vendor_name: 'Al-Jazeera Auto Parts', grand_total: 3200, vat_amount: 418, status: 'received', payment_status: 'unpaid' },
        { id: '2', invoice_number: 'PI-2026-0040', vendor_name: 'Gulf Lubricants Co.', grand_total: 1750, vat_amount: 228, status: 'draft', payment_status: 'unpaid' },
    ]);
    const products = PI_INVENTORY_ITEMS;

    const loadSuppliers = useCallback(async (queryForApi) => {
        setLoading(true);
        setListError('');
        setUsingRegisteredFallback(false);
        const q = String(queryForApi ?? '').trim();
        const baseParams = q ? { q } : {};
        try {
            let offset = 0;
            const merged = [];
            let lastMeta = { total: null, outstanding: null, currencyCode: null };
            let hardCap = 60;
            while (hardCap-- > 0) {
                const res = await getWorkshopSuppliers({
                    ...baseParams,
                    ...branchScopeParams(selectedBranchId),
                    limit: SUPPLIERS_PAGE_LIMIT,
                    offset,
                });
                const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter((r) => r.id);
                merged.push(...rows);
                lastMeta = pickListMeta(res);
                const total = lastMeta.total;
                if (total != null && merged.length >= total) break;
                if (rows.length < SUPPLIERS_PAGE_LIMIT) break;
                offset += SUPPLIERS_PAGE_LIMIT;
            }
            setSuppliers(merged);
            setListMeta({
                total: lastMeta.total != null ? lastMeta.total : merged.length,
                outstanding: lastMeta.outstanding,
                currencyCode: lastMeta.currencyCode,
            });
        } catch (e) {
            const msg = String(e?.message || '');
            const missingWorkshopIdColumn =
                msg.includes('suppliers.workshop_id') || msg.includes('workshop_id');
            const unauthorized =
                /unauthorized|401|forbidden|403|jwt|token/i.test(msg);
            if (missingWorkshopIdColumn || unauthorized) {
                try {
                    const res = await getRegisteredWorkshopSuppliers({
                        ...(q ? { q } : {}),
                        limit: SUPPLIERS_PAGE_LIMIT,
                        offset: 0,
                    });
                    const rows = unwrapSuppliersResponse(res)
                        .map(normalizeSupplierRow)
                        .filter((r) => r.id);
                    const linkedOnly = rows.filter(
                        (r) =>
                            r?.raw?.isLinkedToWorkshop === true ||
                            r?.raw?.is_linked_to_workshop === true ||
                            r?.raw?.linkedToWorkshop === true,
                    );
                    setSuppliers(linkedOnly);
                    setListMeta({
                        total: linkedOnly.length,
                        outstanding: null,
                        currencyCode: null,
                    });
                    setUsingRegisteredFallback(true);
                    setListError(
                        missingWorkshopIdColumn
                            ? 'Loaded via fallback: /workshop-staff/suppliers currently fails due backend schema (missing suppliers.workshop_id).'
                            : 'Loaded via fallback: /workshop-staff/suppliers is not authorized for this session/token.',
                    );
                    return;
                } catch {
                    // fallthrough to standard error below
                }
            }
            setListError(e.message || 'Could not load suppliers.');
            setSuppliers([]);
            setListMeta({ total: null, outstanding: null, currencyCode: null });
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        const t = setTimeout(() => {
            loadSuppliers(searchInput);
        }, 320);
        return () => clearTimeout(t);
    }, [searchInput, loadSuppliers]);

    const listSummaryLine = useMemo(() => {
        const parts = [];
        if (listMeta.total != null && suppliers.length > 0) {
            if (suppliers.length < listMeta.total) {
                parts.push(`${suppliers.length} of ${listMeta.total} suppliers`);
            } else {
                parts.push(`${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`);
            }
        }
        if (listMeta.outstanding != null && listMeta.currencyCode) {
            parts.push(`Outstanding: ${listMeta.outstanding} ${listMeta.currencyCode}`);
        } else if (listMeta.outstanding != null) {
            parts.push(`Outstanding: ${listMeta.outstanding}`);
        }
        return parts.join(' · ');
    }, [suppliers.length, listMeta.total, listMeta.outstanding, listMeta.currencyCode]);

    const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
    const vat = subtotal * 0.15;
    const grandTotal = subtotal + vat;

    const updateItem = (idx, key, val) => {
        setItems((prev) =>
            prev.map((item, i) => {
                if (i !== idx) return item;
                const updated = { ...item, [key]: val };
                if (key === 'quantity' || key === 'unit_price') {
                    updated.total = (updated.quantity || 0) * (updated.unit_price || 0);
                }
                if (key === 'product_id') {
                    const prod = products.find((p) => p.id === val);
                    if (prod) {
                        updated.product_name = prod.name;
                        updated.unit_price = prod.price || 0;
                        updated.unit = prod.unit || 'piece';
                        updated.total = (updated.quantity || 1) * (prod.price || 0);
                    }
                }
                return updated;
            }),
        );
    };

    const submitPurchase = () => {
        if (!selectedSupplier) return;
        setPurchases((prev) => [
            {
                id: String(Date.now()),
                invoice_number: `PI-${Date.now().toString().slice(-6)}`,
                vendor_name: selectedSupplier.name,
                grand_total: Math.round(grandTotal),
                vat_amount: Math.round(vat),
                status: 'draft',
                payment_status: 'unpaid',
            },
            ...prev,
        ]);
        setShowPurchaseForm(false);
        setSelectedSupplier(null);
        setItems([{ product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }]);
        setNotes('');
    };

    const loadRegisteredSuppliers = useCallback(async (queryForApi) => {
        setRegisteredLoading(true);
        setRegisteredError('');
        const q = String(queryForApi ?? '').trim();
        try {
            const res = await getRegisteredWorkshopSuppliers({
                ...(q ? { q } : {}),
                limit: SUPPLIERS_PAGE_LIMIT,
                offset: 0,
            });
            const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter((r) => r.id);
            setRegisteredSuppliers(rows);
        } catch (e) {
            setRegisteredSuppliers([]);
            setRegisteredError(e.message || 'Could not load registered suppliers.');
        } finally {
            setRegisteredLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!showAddSupplierModal) return undefined;
        const t = setTimeout(() => {
            loadRegisteredSuppliers(registeredSearchInput);
        }, 280);
        return () => clearTimeout(t);
    }, [showAddSupplierModal, registeredSearchInput, loadRegisteredSuppliers]);

    const toggleRegisteredSupplier = (supplierId) => {
        const sid = String(supplierId);
        setSelectedRegisteredIds((prev) =>
            prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid],
        );
    };

    const handleLinkSelectedSuppliers = async () => {
        if (selectedRegisteredIds.length === 0) return;
        setLinkingSuppliers(true);
        setRegisteredError('');
        try {
            await linkSuppliersToWorkshop(selectedRegisteredIds);
            setShowAddSupplierModal(false);
            setSelectedRegisteredIds([]);
            setRegisteredSearchInput('');
            await loadSuppliers(searchInput);
        } catch (e) {
            setRegisteredError(e.message || 'Failed to add selected suppliers to workshop.');
        } finally {
            setLinkingSuppliers(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Suppliers & Purchases</h2>
                    <p className="ws-page-sub">
                        Manage vendors and purchase invoices · <strong>{branchLabel}</strong>
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('suppliers')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: activeTab === 'suppliers' ? 'var(--color-text-dark)' : '#fff',
                        color: activeTab === 'suppliers' ? 'var(--color-primary)' : 'var(--color-text-body)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: activeTab === 'suppliers' ? 'none' : '1px solid var(--color-border)',
                    }}
                >
                    Suppliers
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('purchases')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: activeTab === 'purchases' ? 'var(--color-text-dark)' : '#fff',
                        color: activeTab === 'purchases' ? 'var(--color-primary)' : 'var(--color-text-body)',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Purchase History
                </button>
            </div>
            {activeTab === 'suppliers' && (
                <>
                    <div className="ws-section" style={{ marginBottom: 16 }}>
                        <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                placeholder="Search suppliers (name, phone, CR, VAT, category)…"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 200,
                                    maxWidth: 400,
                                    padding: '8px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.875rem',
                                }}
                            />
                            <button
                                type="button"
                                className="mc-btn-ghost"
                                onClick={() => loadSuppliers(searchInput)}
                                disabled={loading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                            </button>
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={() => {
                                    setShowAddSupplierModal(true);
                                    setSelectedRegisteredIds([]);
                                    setRegisteredSearchInput('');
                                    setRegisteredError('');
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                                <Plus size={14} /> Add Supplier
                            </button>
                        </div>
                        {listSummaryLine && !listError ? (
                            <div
                                style={{
                                    padding: '0 16px 12px',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-body)',
                                    opacity: 0.85,
                                }}
                            >
                                {listSummaryLine}
                            </div>
                        ) : null}
                    </div>
                    {listError && (
                        <div
                            className="ws-section"
                            style={{
                                padding: 14,
                                marginBottom: 16,
                                borderRadius: 10,
                                background: usingRegisteredFallback ? '#FEFCE8' : '#FEF2F2',
                                border: usingRegisteredFallback ? '1px solid #FDE68A' : '1px solid #FECACA',
                                color: usingRegisteredFallback ? '#854D0E' : '#991B1B',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                            }}
                        >
                            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <strong>{listError}</strong>
                                <p style={{ margin: '6px 0 0', opacity: 0.9 }}>
                                    {usingRegisteredFallback ? (
                                        <>
                                            Showing only rows with <code>isLinkedToWorkshop=true</code> from{' '}
                                            <code style={{ fontSize: '0.8rem' }}>
                                                GET /workshop-staff/suppliers/registered
                                            </code>{' '}
                                            until backend query is migrated to <code>workshop_suppliers</code>.
                                        </>
                                    ) : (
                                        <>
                                            The workshop portal expects{' '}
                                            <code style={{ fontSize: '0.8rem' }}>GET /workshop-staff/suppliers</code> with the
                                            workshop JWT. Optional: <code>q</code> or <code>search</code>, <code>limit</code> (≤500),{' '}
                                            <code>offset</code>.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="ws-section">
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Supplier Name</th>
                                    <th>Contact</th>
                                    <th>CR No</th>
                                    <th>VAT ID</th>
                                    <th>Category</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                            <Loader className="spin" size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
                                            Loading suppliers…
                                        </td>
                                    </tr>
                                ) : suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                            {listError
                                                ? 'Unable to load suppliers — see message above.'
                                                : searchInput.trim()
                                                  ? 'No suppliers match your search.'
                                                  : 'No suppliers registered yet.'}
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.map((s) => (
                                        <tr key={s.id}>
                                            <td>
                                                <strong>{s.name}</strong>
                                                {s.status === 'inactive' && (
                                                    <span className="ws-badge ws-badge--gray" style={{ marginLeft: 8 }}>
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td>{s.phone || s.contactPerson || '—'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                {s.crNumber || '—'}
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                                                {s.vatId || '—'}
                                            </td>
                                            <td>
                                                <span className="ws-badge ws-badge--gray">{s.category}</span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn-portal"
                                                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                                    onClick={() => {
                                                        setSelectedSupplier(s);
                                                        setShowPurchaseForm(true);
                                                    }}
                                                >
                                                    <ShoppingCart size={12} style={{ marginRight: 4 }} />
                                                    Add Purchase
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {activeTab === 'purchases' && (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Vendor</th>
                                <th>Grand Total</th>
                                <th>VAT</th>
                                <th>Status</th>
                                <th>Payment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((p) => (
                                <tr key={p.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.invoice_number}</td>
                                    <td>{p.vendor_name}</td>
                                    <td>
                                        <strong>SAR {(p.grand_total || 0).toLocaleString()}</strong>
                                    </td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>
                                        SAR {(p.vat_amount || 0).toLocaleString()}
                                    </td>
                                    <td>
                                        <span
                                            className={`ws-badge ${p.status === 'received' ? 'ws-badge--green' : 'ws-badge--yellow'}`}
                                        >
                                            {p.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className={`ws-badge ${p.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--red'}`}
                                        >
                                            {p.payment_status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {purchases.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                        No purchases yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {showAddSupplierModal && (
                    <Modal
                        title="Add Supplier to Workshop"
                        onClose={() => {
                            if (!linkingSuppliers) setShowAddSupplierModal(false);
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={linkingSuppliers}
                                    onClick={() => setShowAddSupplierModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-submit"
                                    disabled={linkingSuppliers || selectedRegisteredIds.length === 0}
                                    onClick={handleLinkSelectedSuppliers}
                                >
                                    {linkingSuppliers ? 'Adding...' : `Add Selected (${selectedRegisteredIds.length})`}
                                </button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <input
                                placeholder="Search all registered suppliers..."
                                value={registeredSearchInput}
                                onChange={(e) => setRegisteredSearchInput(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.875rem',
                                }}
                            />
                            {registeredError && (
                                <div
                                    style={{
                                        padding: 10,
                                        borderRadius: 8,
                                        border: '1px solid #FECACA',
                                        background: '#FEF2F2',
                                        color: '#991B1B',
                                        fontSize: '0.8125rem',
                                    }}
                                >
                                    {registeredError}
                                </div>
                            )}
                            {registeredLoading ? (
                                <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                                    Loading registered suppliers...
                                </div>
                            ) : registeredSuppliers.length === 0 ? (
                                <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                                    No registered suppliers found.
                                </div>
                            ) : (
                                <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                                    <table className="ws-table" style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Supplier</th>
                                                <th>Contact</th>
                                                <th>CR</th>
                                                <th>VAT</th>
                                                <th style={{ textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {registeredSuppliers.map((s) => {
                                                const selected = selectedRegisteredIds.includes(String(s.id));
                                                return (
                                                    <tr
                                                        key={s.id}
                                                        onClick={() => toggleRegisteredSupplier(s.id)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            background: selected ? '#EFF6FF' : 'transparent',
                                                        }}
                                                    >
                                                        <td>
                                                            <strong>{s.name}</strong>
                                                        </td>
                                                        <td>{s.phone || s.email || '—'}</td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.crNumber || '—'}</td>
                                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.vatId || '—'}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                className="btn-portal"
                                                                style={{
                                                                    padding: '5px 10px',
                                                                    fontSize: '0.75rem',
                                                                    background: selected ? '#0F172A' : undefined,
                                                                    color: selected ? '#fff' : undefined,
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleRegisteredSupplier(s.id);
                                                                }}
                                                            >
                                                                {selected ? 'Selected' : 'Select'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                Select suppliers from the table and click "Add Selected".
                            </p>
                        </div>
                    </Modal>
                )}
                {showPurchaseForm && selectedSupplier && (
                    <Modal
                        title={`Add Purchase Invoice — ${selectedSupplier.name}`}
                        onClose={() => {
                            setShowPurchaseForm(false);
                            setSelectedSupplier(null);
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-secondary" onClick={() => setShowPurchaseForm(false)}>
                                    Cancel
                                </button>
                                <button className="btn-submit" onClick={submitPurchase}>
                                    Submit Purchase Invoice
                                </button>
                            </div>
                        }
                    >
                        <div style={{ padding: '8px 0' }}>
                            <div style={{ marginBottom: 16 }}>
                                <label
                                    style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 6 }}
                                >
                                    Items
                                </label>
                                {items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 80px 100px 80px 40px',
                                            gap: 8,
                                            alignItems: 'center',
                                            marginBottom: 8,
                                        }}
                                    >
                                        <select
                                            value={item.product_id}
                                            onChange={(e) => updateItem(idx, 'product_id', e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                border: '1px solid var(--color-border)',
                                                fontSize: '0.8125rem',
                                            }}
                                        >
                                            <option value="">Product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            onChange={(e) =>
                                                updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                                            }
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                border: '1px solid var(--color-border)',
                                            }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Unit Price"
                                            value={item.unit_price}
                                            onChange={(e) =>
                                                updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                                            }
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: 8,
                                                border: '1px solid var(--color-border)',
                                            }}
                                        />
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                            SAR {(item.total || 0).toFixed(0)}
                                        </span>
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setItems((i) => i.filter((_, ii) => ii !== idx))}
                                                style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '6px 12px' }}
                                    onClick={() =>
                                        setItems((i) => [
                                            ...i,
                                            { product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 },
                                        ])
                                    }
                                >
                                    <Plus size={14} /> Add Item
                                </button>
                            </div>
                            <div
                                style={{
                                    background: 'var(--color-bg-muted)',
                                    borderRadius: 10,
                                    padding: 12,
                                    marginBottom: 12,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                                    <span>SAR {subtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>VAT 15%</span>
                                    <span>SAR {vat.toFixed(2)}</span>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontWeight: 800,
                                        paddingTop: 8,
                                        borderTop: '1px solid var(--color-border)',
                                    }}
                                >
                                    <span>Grand Total</span>
                                    <span>SAR {grandTotal.toFixed(2)}</span>
                                </div>
                            </div>
                            <div>
                                <label
                                    style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 6 }}
                                >
                                    Notes
                                </label>
                                <input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Optional notes…"
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                    }}
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
