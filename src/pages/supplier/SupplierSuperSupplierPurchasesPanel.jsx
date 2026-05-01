import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Eye, Pencil, Plus, Loader2, ShoppingCart, Building2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/AccountingPage.css';
import {
    listSupplierSuperSupplierPurchases,
    getSupplierSuperSupplierPurchase,
    createSupplierSuperSupplierPurchase,
    updateSupplierSuperSupplierPurchase,
    listSupplierProducts,
} from '../../services/supplierApi';

function unwrapProducts(res) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    const raw = res.products ?? res.items ?? res.list ?? [];
    return Array.isArray(raw) ? raw : [];
}

function newLineRow() {
    return {
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productName: '',
        sku: '',
        qty: '1',
        unit: 'pcs',
        unitPrice: '',
    };
}

function parseNum(v) {
    const n = parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
}

/**
 * Supplier-side list + detail + full line-item composer for upstream (super supplier) purchases.
 */
export default function SupplierSuperSupplierPurchasesPanel({
    superSuppliers = [],
    createIntentSupplierId = null,
    onConsumeCreateIntent,
    onPurchasesMutated,
}) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [viewRow, setViewRow] = useState(null);
    const [viewDetail, setViewDetail] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const [composer, setComposer] = useState(null);
    /** { open, mode, purchaseId?, superSupplierId, purchaseDate, vendorRef, description, notes, vatAmount, lines } */

    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const [saving, setSaving] = useState(false);
    const [composerErr, setComposerErr] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listSupplierSuperSupplierPurchases({ limit: 200, offset: 0 });
            setRows(Array.isArray(res?.purchases) ? res.purchases : []);
        } catch (e) {
            setRows([]);
            setErr(e?.message || 'Failed to load super supplier purchases.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!createIntentSupplierId) return;
        const sid = String(createIntentSupplierId);
        setComposer({
            mode: 'create',
            purchaseId: null,
            superSupplierId: sid,
            purchaseDate: new Date().toISOString().slice(0, 10),
            vendorRef: '',
            description: '',
            notes: '',
            vatAmount: '0',
            lines: [newLineRow()],
        });
        setComposerErr('');
        onConsumeCreateIntent?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createIntentSupplierId]);

    useEffect(() => {
        if (!composer) return undefined;
        let cancelled = false;
        setCatalogLoading(true);
        listSupplierProducts({ limit: 350 })
            .then((res) => {
                if (cancelled) return;
                setCatalog(
                    unwrapProducts(res).map((p) => ({
                        id: String(p.id ?? p.supplierProductId ?? ''),
                        name: p.name ?? p.productName ?? 'Item',
                        sku: (p.sku || '').trim(),
                        unit: (p.unit || p.uom || 'pcs').trim() || 'pcs',
                        price: Number(p.price ?? p.unitPrice ?? p.sellingPrice ?? 0),
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setCatalog([]);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [composer]);

    const catalogOptions = useMemo(
        () => catalog.filter((c) => c.id && (c.name || '').trim()),
        [catalog],
    );

    const openView = async (r) => {
        setViewRow(r);
        setViewDetail(null);
        setViewLoading(true);
        try {
            const d = await getSupplierSuperSupplierPurchase(r.id);
            setViewDetail(d?.purchase ?? d?.data ?? d);
        } catch {
            setViewDetail(null);
            setErr('Could not load purchase detail.');
        } finally {
            setViewLoading(false);
        }
    };

    const openEdit = async (r) => {
        setComposerErr('');
        setViewLoading(false);
        setComposer(null);
        setSaving(true);
        try {
            const d = await getSupplierSuperSupplierPurchase(r.id);
            const p = d?.purchase ?? d?.data ?? d;
            if (!p?.id) {
                setComposerErr('Could not load purchase for editing.');
                return;
            }
            const linesSrc = Array.isArray(p.items) && p.items.length ? p.items : [];
            const lines =
                linesSrc.length > 0
                    ? linesSrc.map((it) => ({
                          uid: `${it.id}-${Math.random().toString(36).slice(2)}`,
                          productName: it.productName || '',
                          sku: it.sku || '',
                          qty: String(it.qty ?? 1),
                          unit: it.unit || 'pcs',
                          unitPrice: String(it.unitPrice ?? ''),
                      }))
                    : [newLineRow()];
            setComposer({
                mode: 'edit',
                purchaseId: String(p.id),
                superSupplierId: String(p.superSupplierId ?? r.superSupplierId),
                purchaseDate:
                    (p.purchaseDate || '').toString().slice(0, 10) ||
                    new Date().toISOString().slice(0, 10),
                vendorRef:
                    String(p.vendorRef ?? p.referenceNo ?? '').trim(),
                description: String(p.description ?? '').trim(),
                notes: String(p.notes ?? '').trim(),
                vatAmount: String(p.vatAmount ?? '0'),
                lines,
            });
        } catch (e) {
            setComposerErr(e?.message || 'Could not load for edit.');
        } finally {
            setSaving(false);
        }
    };

    const summary = useMemo(() => {
        if (!composer?.lines?.length)
            return { subtotal: 0, vat: 0, grand: 0 };
        const subtotal = composer.lines.reduce((acc, ln) => {
            const qty = parseNum(ln.qty);
            const up = parseNum(ln.unitPrice);
            return acc + qty * up;
        }, 0);
        const vat = parseNum(composer.vatAmount);
        return {
            subtotal,
            vat,
            grand: subtotal + vat,
        };
    }, [composer]);

    const persistComposer = async () => {
        if (!composer?.superSupplierId) {
            setComposerErr('Select a super supplier.');
            return;
        }
        const items = composer.lines
            .filter((l) => (l.productName || '').trim())
            .map((l) => ({
                productName: (l.productName || '').trim(),
                sku: (l.sku || '').trim() || undefined,
                qty: parseNum(l.qty) || 0,
                unit: (l.unit || 'pcs').trim() || 'pcs',
                unitPrice: parseNum(l.unitPrice),
            }))
            .filter((l) => l.qty > 0 && l.unitPrice >= 0);
        if (!items.length) {
            setComposerErr('Add at least one product line with name, qty and unit price.');
            return;
        }
        setSaving(true);
        setComposerErr('');
        const payload = {
            superSupplierId: String(composer.superSupplierId),
            purchaseDate: composer.purchaseDate,
            vendorRef: (composer.vendorRef || '').trim() || undefined,
            referenceNo: (composer.vendorRef || '').trim() || undefined,
            description: (composer.description || '').trim() || undefined,
            notes: (composer.notes || '').trim() || undefined,
            vatAmount: parseNum(composer.vatAmount),
            items,
        };
        try {
            if (composer.mode === 'edit' && composer.purchaseId) {
                await updateSupplierSuperSupplierPurchase(composer.purchaseId, payload);
            } else {
                await createSupplierSuperSupplierPurchase(payload);
            }
            setComposer(null);
            await load();
            onPurchasesMutated?.();
        } catch (e) {
            setComposerErr(e?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    const addCatalogLine = (productId) => {
        if (!productId || !composer) return;
        const p = catalogOptions.find((c) => c.id === productId);
        if (!p) return;
        setComposer((prev) =>
            prev
                ? {
                      ...prev,
                      lines: [
                          ...prev.lines,
                          {
                              uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                              productName: p.name,
                              sku: p.sku || '',
                              qty: '1',
                              unit: p.unit || 'pcs',
                              unitPrice: String(p.price ?? ''),
                          },
                      ],
                  }
                : prev,
        );
    };

    const statusTone = (s) => {
        const x = (s || '').toLowerCase();
        if (x === 'cancelled') return 'ws-badge--red';
        if (x === 'draft') return 'ws-badge--yellow';
        return 'ws-badge--green';
    };

    const itemsDetail = Array.isArray(viewDetail?.items) ? viewDetail.items : [];

    return (
        <div className="ws-section" style={{ marginTop: 24, overflow: 'hidden' }}>
            <div
                style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--color-border-light)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                }}
            >
                <div>
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
                        <ShoppingCart size={18} /> Super supplier purchase invoices
                    </h3>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Bills from your upstream vendors — line items stored in database; edit anytime.
                    </p>
                </div>
                <button type="button" className="btn-portal" onClick={() => load()} disabled={loading}>
                    <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {err ? (
                <div
                    style={{
                        margin: 12,
                        padding: 12,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 10,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    {err}
                </div>
            ) : null}

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Vendor</th>
                            <th>Vendor ref</th>
                            <th>Issue date</th>
                            <th>Product</th>
                            <th>Qty / Unit</th>
                            <th>Lines</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: 36 }}>
                                    <Loader2 size={22} className="spin" style={{ verticalAlign: 'middle', marginRight: 10 }} />{' '}
                                    Loading…
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: 36, color: 'var(--color-text-muted)' }}>
                                    No purchases yet — use{' '}
                                    <strong>&quot;Record purchase&quot;</strong> beside a vendor.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => openView(r)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                fontWeight: 800,
                                                color: '#EA580C',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                fontSize: '0.9375rem',
                                            }}
                                            title="View invoice"
                                        >
                                            {r.invoiceNo ?? `SSP-${r.id}`}
                                        </button>
                                    </td>
                                    <td style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Building2 size={14} style={{ opacity: 0.5 }} aria-hidden />{' '}
                                            {r.superSupplierName ?? '—'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                        {r.vendorRef || '—'}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem' }}>{r.purchaseDate || '—'}</td>
                                    <td style={{ fontSize: '0.8125rem', maxWidth: 220 }} title={r.primaryProductName}>
                                        {r.primaryProductName ?? '—'}
                                        {r.moreLines > 0 ? (
                                            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                + {r.moreLines} more…
                                            </div>
                                        ) : null}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                                        {r.primaryQty != null && r.primaryQty !== ''
                                            ? `${r.primaryQty} ${r.primaryUnit || ''}`
                                            : '—'}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem' }}>{r.itemCount ?? 0}</td>
                                    <td>
                                        <strong>SAR {(r.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                    <td>
                                        <span className={`ws-badge ${statusTone(r.status)}`}>{r.status ?? 'posted'}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                title="View"
                                                onClick={() => openView(r)}
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    background: '#F3F4F6',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                title="Edit purchase & lines"
                                                onClick={() => openEdit(r)}
                                                disabled={saving}
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 6,
                                                    border: 'none',
                                                    background: '#E0E7FF',
                                                    color: '#4338CA',
                                                    cursor: saving ? 'not-allowed' : 'pointer',
                                                    opacity: saving ? 0.6 : 1,
                                                }}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {viewRow && (
                    <Modal
                        title={`Invoice ${viewRow.invoiceNo ?? `SSP-${viewRow.id}`}`}
                        width="760px"
                        onClose={() => {
                            setViewRow(null);
                            setViewDetail(null);
                        }}
                        footer={
                            <button type="button" className="btn-portal-outline" onClick={() => setViewRow(null)}>
                                Close
                            </button>
                        }
                    >
                        {viewLoading ? (
                            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                                <Loader2 className="spin" size={18} /> Loading…
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Vendor</span>
                                    <strong>{viewDetail?.superSupplierName ?? viewRow.superSupplierName}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Vendor ref #</span>
                                    <span>{viewDetail?.vendorRef || viewDetail?.referenceNo || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Issue date</span>
                                    <span>{viewDetail?.purchaseDate ?? viewRow.purchaseDate}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Description</span>
                                    <span style={{ textAlign: 'right', maxWidth: '70%' }}>{viewDetail?.description || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Notes</span>
                                    <span style={{ textAlign: 'right', maxWidth: '70%', whiteSpace: 'pre-wrap' }}>
                                        {viewDetail?.notes || '—'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Subtotal (lines)</span>
                                    <span>
                                        SAR{' '}
                                        {(viewDetail?.subtotalLines ?? viewDetail?.amount ?? 0).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                        })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>VAT</span>
                                    <span>
                                        SAR{' '}
                                        {(viewDetail?.vatAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Grand total</span>
                                    <strong>
                                        SAR{' '}
                                        {(viewDetail?.total ?? viewRow.total ?? 0).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                        })}
                                    </strong>
                                </div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, margin: '8px 0 4px' }}>Lines</p>
                                <table className="ws-table" style={{ fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Product name</th>
                                            <th>SKU</th>
                                            <th>Qty</th>
                                            <th>Unit</th>
                                            <th>Unit price</th>
                                            <th>Line total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {itemsDetail.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} style={{ padding: 16 }}>
                                                    No line breakdown (legacy total only).
                                                </td>
                                            </tr>
                                        ) : (
                                            itemsDetail.map((it, i) => (
                                                <tr key={String(it.id || i)}>
                                                    <td>{i + 1}</td>
                                                    <td>{it.productName}</td>
                                                    <td>{it.sku || '—'}</td>
                                                    <td>{Number(it.qty ?? 0).toLocaleString()}</td>
                                                    <td>{it.unit ?? 'pcs'}</td>
                                                    <td>SAR {(it.unitPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    <td>
                                                        <strong>
                                                            SAR{' '}
                                                            {(it.lineTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </strong>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Modal>
                )}

                {composer && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Super supplier ›{' '}
                                    <span className="pi-b-active">{composer.mode === 'edit' ? 'Edit' : 'New'}</span>
                                </span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={22} /> Purchase Invoice
                                </div>
                            </div>
                        }
                        onClose={() => !saving && setComposer(null)}
                        width="1200px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <button type="button" className="btn-pi-cancel" disabled={saving} onClick={() => setComposer(null)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-pi-create" disabled={saving} onClick={() => persistComposer()}>
                                    {saving ? 'Saving…' : composer.mode === 'edit' ? 'Save changes' : 'Create invoice'}
                                </button>
                            </div>
                        }
                    >
                        {composerErr ? (
                            <p
                                style={{
                                    margin: '0 0 12px',
                                    padding: 10,
                                    background: '#FEF2F2',
                                    borderRadius: 8,
                                    color: '#B91C1C',
                                    fontSize: '0.8125rem',
                                }}
                            >
                                {composerErr}
                            </p>
                        ) : null}
                        <div className="pi-form-container">
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Quick add line from catalog</label>
                                <select
                                    className=""
                                    disabled={catalogLoading || !catalogOptions.length}
                                    value=""
                                    onChange={(e) => addCatalogLine(e.target.value)}
                                    style={{
                                        width: '100%',
                                        marginTop: 6,
                                        padding: 10,
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                    }}
                                >
                                    <option value="">
                                        {catalogLoading ? 'Loading catalog…' : catalogOptions.length ? 'Select product…' : 'No catalog'}
                                    </option>
                                    {catalogOptions.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — SAR {Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date *</label>
                                    <input
                                        type="date"
                                        value={composer.purchaseDate}
                                        onChange={(e) =>
                                            setComposer((c) => (c ? { ...c, purchaseDate: e.target.value } : c))
                                        }
                                    />
                                </div>
                                <div className="pi-field">
                                    <label>Super supplier *</label>
                                    <select
                                        value={composer.superSupplierId}
                                        onChange={(e) =>
                                            setComposer((c) => (c ? { ...c, superSupplierId: e.target.value } : c))
                                        }
                                        style={{
                                            padding: 10,
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            width: '100%',
                                        }}
                                    >
                                        <option value="">Select…</option>
                                        {(superSuppliers || []).filter((s) => s.isActive !== false).map((s) => (
                                            <option key={String(s.id)} value={String(s.id)}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pi-field">
                                    <label>Vendor ref #</label>
                                    <input
                                        type="text"
                                        placeholder="Vendor invoice #"
                                        value={composer.vendorRef}
                                        onChange={(e) =>
                                            setComposer((c) => (c ? { ...c, vendorRef: e.target.value } : c))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input
                                    type="text"
                                    value={composer.description}
                                    onChange={(e) =>
                                        setComposer((c) => (c ? { ...c, description: e.target.value } : c))
                                    }
                                />
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Notes</label>
                                <textarea
                                    rows={2}
                                    value={composer.notes}
                                    onChange={(e) =>
                                        setComposer((c) => (c ? { ...c, notes: e.target.value } : c))
                                    }
                                />
                            </div>

                            <div style={{ marginTop: 16 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Product name</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>SKU</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Qty</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit price</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Line total</th>
                                            <th style={{ padding: '6px 8px', width: 48 }} aria-label="Actions" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {composer.lines.map((ln, idx) => {
                                            const qty = parseNum(ln.qty);
                                            const up = parseNum(ln.unitPrice);
                                            const lt = qty * up;
                                            return (
                                                <tr key={ln.uid}>
                                                    <td style={{ padding: 6 }}>{idx + 1}</td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Product"
                                                            style={{ width: '100%', minWidth: 160 }}
                                                            value={ln.productName}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, productName: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="SKU"
                                                            style={{ width: 92 }}
                                                            value={ln.sku}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, sku: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            style={{ width: 76 }}
                                                            value={ln.qty}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, qty: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="text"
                                                            placeholder="pcs"
                                                            style={{ width: 76 }}
                                                            value={ln.unit}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, unit: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            style={{ width: 100 }}
                                                            value={ln.unitPrice}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setComposer((c) =>
                                                                    c
                                                                        ? {
                                                                              ...c,
                                                                              lines: c.lines.map((x) =>
                                                                                  x.uid === ln.uid ? { ...x, unitPrice: v } : x,
                                                                              ),
                                                                          }
                                                                        : c,
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 6, textAlign: 'right', fontWeight: 700 }}>
                                                        SAR{' '}
                                                        {lt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td style={{ padding: 6 }}>
                                                        <button
                                                            type="button"
                                                            aria-label="Remove line"
                                                            className="btn-pi-cancel"
                                                            style={{ padding: '4px 8px' }}
                                                            onClick={() =>
                                                                setComposer((c) =>
                                                                    c?.lines?.length <= 1
                                                                        ? c
                                                                        : {
                                                                              ...c,
                                                                              lines: c.lines.filter((x) => x.uid !== ln.uid),
                                                                          },
                                                                )
                                                            }
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <button
                                    type="button"
                                    style={{
                                        marginTop: 12,
                                        width: '100%',
                                        padding: 12,
                                        borderRadius: 8,
                                        borderStyle: 'dashed',
                                        borderWidth: 1,
                                        borderColor: 'var(--color-border)',
                                        background: 'rgba(249,250,251,0.95)',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                    onClick={() =>
                                        setComposer((c) => (c ? { ...c, lines: [...c.lines, newLineRow()] } : c))
                                    }
                                >
                                    <Plus size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Add line
                                </button>
                            </div>

                            <div
                                style={{
                                    marginTop: 20,
                                    display: 'flex',
                                    gap: 20,
                                    flexWrap: 'wrap',
                                    justifyContent: 'flex-end',
                                    alignItems: 'flex-end',
                                }}
                            >
                                <div className="pi-field" style={{ minWidth: 140 }}>
                                    <label>VAT (SAR)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={composer.vatAmount}
                                        onChange={(e) =>
                                            setComposer((c) =>
                                                c ? { ...c, vatAmount: e.target.value } : c,
                                            )
                                        }
                                    />
                                </div>
                                <div className="pi-summary-card" style={{ minWidth: 240 }}>
                                    <div className="pi-summary-row">
                                        <span>Subtotal:</span>{' '}
                                        <span>
                                            SAR{' '}
                                            {summary.subtotal.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row">
                                        <span>Total Tax (VAT):</span>{' '}
                                        <span>
                                            SAR{' '}
                                            {summary.vat.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row pi-grand-total">
                                        <span>Grand Total:</span>{' '}
                                        <span>
                                            SAR{' '}
                                            {summary.grand.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-ap-alert" style={{ marginTop: 12 }}>
                                        <span>Line totals = Qty × unit price before VAT.</span>
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
