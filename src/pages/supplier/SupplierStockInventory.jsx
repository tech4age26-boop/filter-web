import React, { useEffect, useState, useMemo } from 'react';
import { Warehouse, AlertTriangle, Package, TrendingUp, Pencil } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    getSupplierInventoryStockBalances,
    setSupplierStock,
} from '../../services/supplierApi';

export default function SupplierStockInventory() {
    const [stock, setStock] = useState([]);
    const [activeTab, setActiveTab] = useState('inventory');
    const [search, setSearch] = useState('');
    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [adjustItem, setAdjustItem] = useState(null);
    const [adjustmentType, setAdjustmentType] = useState('remove');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('');
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    const filteredList = useMemo(() => {
        const list = stock || [];
        if (!search.trim()) return list;
        const q = search.toLowerCase().trim();
        return list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.sku || '').toLowerCase().includes(q));
    }, [stock, search]);

    const totalSKUs = stock.length;
    const criticalCount = stock.filter(s => s.qty <= (s.criticalLevel ?? 0)).length;
    const reorderNeededCount = stock.filter(s => s.reorder != null && s.qty <= s.reorder && s.qty > (s.criticalLevel ?? 0)).length;
    const inventoryValue = stock.reduce((sum, s) => sum + (s.qty || 0) * (s.price || 0), 0);
    const criticalItems = stock.filter(s => s.qty <= (s.criticalLevel ?? 0));

    const openEdit = (s) => {
        // For now, only allow quantity adjustments via Adjust modal
        openAdjust(s);
    };
    const openAdjust = (s) => {
        setAdjustItem(s);
        setAdjustmentType('remove');
        setAdjustQty('');
        setAdjustNotes('');
        setAdjustModalOpen(true);
    };
    const handleConfirmAdjustment = () => {
        if (!adjustItem) return;
        const qtyDelta = parseInt(adjustQty, 10) || 0;
        if (qtyDelta <= 0) return;
        const currentQty = adjustItem.qty || 0;
        const newQty = adjustmentType === 'add' ? currentQty + qtyDelta : Math.max(0, currentQty - qtyDelta);
        setSupplierStock({
            supplierProductId: String(adjustItem.id),
            supplierLocationId: String(adjustItem.locationId || adjustItem.byLocation?.[0]?.supplierLocationId || ''),
            currentQuantity: newQty,
        }).catch((err) => {
            console.error('Set supplier stock failed:', err);
        });
        setStock(prev => prev.map(s => s.id === adjustItem.id ? { ...s, qty: newQty } : s));
        setAdjustModalOpen(false);
        setAdjustItem(null);
        setAdjustQty('');
        setAdjustNotes('');
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const res = await getSupplierInventoryStockBalances({ limit: 200, historyLimit: 100 });
                const items = Array.isArray(res?.items)
                    ? res.items.map((item) => ({
                          id: item.productId,
                          sku: item.sku || '-',
                          name: item.productName,
                          unit: item.workshopUnit || 'pcs',
                          qty: Number(item.currentBalanceWorkshop || 0),
                          criticalLevel: item.criticalAt != null ? Number(item.criticalAt) : 0,
                          reorder: item.reorderAt != null ? Number(item.reorderAt) : 0,
                          price: Number(item.valueWarehouseSar || 0) > 0 && Number(item.currentBalanceWarehouse || 0) > 0
                              ? Number(item.valueWarehouseSar) / Number(item.currentBalanceWarehouse)
                              : 0,
                          byLocation: item.byLocation || [],
                          locationId: item.byLocation?.[0]?.supplierLocationId,
                      }))
                    : [];
                const history = Array.isArray(res?.transactionHistory)
                    ? res.transactionHistory.slice(0, 100).map((h, idx) => ({
                          id: h.id || idx,
                          date: h.createdAt?.slice(0, 10) || '-',
                          product: h.productName || '-',
                          type: (h.transactionType || '').toLowerCase().includes('stock_out') ? 'stock out' : 'stock in',
                          qty: Number(h.quantity || h.amount || 0),
                          unit: h.unit || 'pcs',
                          before: '-',
                          after: '-',
                          reference: h.referenceId || h.supplierInvoiceId || h.purchaseOrderId || '-',
                          notes: h.description || '-',
                      }))
                    : [];
                if (!cancelled) {
                    setStock(items);
                    setMovements(history);
                }
            } catch (err) {
                console.error('Supplier stock API failed:', err);
                if (!cancelled) {
                    setStock([]);
                    setMovements([]);
                    setApiError(err?.message || 'Failed to load stock');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);
    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Stock Inventory</h2>
                    <p className="ws-page-sub">Warehouse stock levels and management</p>
                </div>
            </div>

            {apiError ? (
                <div className="ws-section" style={{ marginBottom: 16, padding: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#B91C1C', fontSize: '0.875rem' }}>
                    <strong>Could not load stock:</strong> {apiError}
                </div>
            ) : loading ? (
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Loading inventory…</p>
            ) : null}

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div className="ws-section" style={{ marginBottom: 0, padding: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase' }}>Total SKUs</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-dark)', margin: '4px 0 0 0' }}>{totalSKUs}</p>
                </div>
                <div className="ws-section" style={{ marginBottom: 0, padding: 16, textAlign: 'center', borderLeft: '4px solid #DC2626' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#B91C1C', margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><AlertTriangle size={14} /> Critical</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', margin: '4px 0 0 0' }}>{criticalCount}</p>
                </div>
                <div className="ws-section" style={{ marginBottom: 0, padding: 16, textAlign: 'center', background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#B45309', margin: 0, textTransform: 'uppercase' }}>Reorder Needed</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#B45309', margin: '4px 0 0 0' }}>{reorderNeededCount}</p>
                </div>
                <div className="ws-section" style={{ marginBottom: 0, padding: 16, textAlign: 'center', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1D4ED8', margin: 0, textTransform: 'uppercase' }}>Inventory Value</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1D4ED8', margin: '4px 0 0 0' }}>SAR {inventoryValue.toLocaleString()}</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 16 }}>
                <button type="button" onClick={() => setActiveTab('inventory')} style={{ padding: '10px 20px', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderBottom: activeTab === 'inventory' ? '2px solid #2563EB' : '2px solid transparent', marginBottom: -2, background: 'none', color: activeTab === 'inventory' ? '#2563EB' : 'var(--color-text-muted)', cursor: 'pointer' }}>Stock Inventory</button>
                <button type="button" onClick={() => setActiveTab('movements')} style={{ padding: '10px 20px', fontSize: '0.875rem', fontWeight: 600, border: 'none', borderBottom: activeTab === 'movements' ? '2px solid #2563EB' : '2px solid transparent', marginBottom: -2, background: 'none', color: activeTab === 'movements' ? '#2563EB' : 'var(--color-text-muted)', cursor: 'pointer' }}>Stock Movements</button>
            </div>

            {activeTab === 'inventory' && (
                <>
                    {/* Search */}
                    <div style={{ marginBottom: 16 }}>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name or SKU..." style={{ width: '100%', maxWidth: 400, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
                    </div>

                    {/* Critical Stock Alert */}
                    {criticalItems.length > 0 && (
                        <div style={{ marginBottom: 16, padding: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, borderLeft: '4px solid #DC2626' }}>
                            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#B91C1C', margin: 0 }}>Critical Stock Alert ({criticalItems.length} item{criticalItems.length !== 1 ? 's' : ''})</p>
                            <div style={{ marginTop: 8 }}>
                                {criticalItems.map(s => (
                                    <p key={s.id} style={{ fontSize: '0.8125rem', color: '#B91C1C', margin: '2px 0 0 0' }}><strong>{s.name}</strong>: {s.qty} {s.unit}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="ws-section">
                        <table className="ws-table">
                            <thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Stock Qty</th><th>Critical Level</th><th>Reorder Level</th><th>Purchase Price</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {filteredList.map(s => {
                                    const value = (s.qty || 0) * (s.price || 0);
                                    const isCritical = s.qty <= (s.criticalLevel ?? 0);
                                    return (
                                        <tr key={s.id} style={{ background: isCritical ? '#FEF2F2' : undefined }}>
                                            <td><strong>{s.name}</strong></td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.sku || '-'}</td>
                                            <td>{s.unit}</td>
                                            <td><strong>{s.qty}</strong></td>
                                            <td>{s.criticalLevel != null ? s.criticalLevel : '-'}</td>
                                            <td>{s.reorder != null ? s.reorder : '-'}</td>
                                            <td>SAR {Number(s.price).toLocaleString()}</td>
                                            <td>SAR {value.toLocaleString()}</td>
                                            <td><span className={`ws-badge ${isCritical ? 'ws-badge--red' : 'ws-badge--green'}`}>{isCritical ? 'Critical' : 'OK'}</span></td>
                                            <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <button type="button" onClick={() => openAdjust(s)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Adjust</button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(s)}
                                                    style={{
                                                        padding: '6px 10px',
                                                        borderRadius: 6,
                                                        border: '1px solid var(--color-border)',
                                                        background: '#fff',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                    }}
                                                >
                                                    <Pencil size={12} /> Adjust via Purchase
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {filteredList.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <Package size={40} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{search ? 'No products match your search' : 'No stock items yet'}</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'movements' && (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Unit</th><th>Before</th><th>After</th><th>Reference</th><th>Notes</th></tr></thead>
                        <tbody>
                            {movements.map(m => (
                                <tr key={m.id}>
                                    <td>{m.date}</td>
                                    <td>{m.product}</td>
                                    <td>
                                        <span style={{ background: m.type === 'stock out' ? '#FEF2F2' : '#ECFDF5', color: m.type === 'stock out' ? '#B91C1C' : '#047857', padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, border: m.type === 'stock out' ? '1px solid #FECACA' : '1px solid #A7F3D0' }}>{m.type}</span>
                                    </td>
                                    <td><strong>{m.qty}</strong></td>
                                    <td>{m.unit}</td>
                                    <td>{m.before}</td>
                                    <td>{m.after}</td>
                                    <td>{m.reference}</td>
                                    <td>{m.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {movements.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 48 }}>
                            <TrendingUp size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No movements yet</p>
                        </div>
                    )}
                </div>
            )}

            {/* Stock Adjustment modal (Adjust button) */}
            <AnimatePresence>
                {adjustModalOpen && adjustItem && (
                    <Modal
                        title={`Stock Adjustment — ${adjustItem.name}`}
                        onClose={() => { setAdjustModalOpen(false); setAdjustItem(null); }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => setAdjustModalOpen(false)}>Cancel</button>
                                <button className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }} disabled={!adjustQty || parseInt(adjustQty, 10) <= 0} onClick={handleConfirmAdjustment}>Confirm Adjustment</button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Current Stock</label>
                                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-dark)', margin: 0 }}>{adjustItem.qty ?? 0} {adjustItem.unit || 'unit'}</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8 }}>Adjustment Type</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={() => setAdjustmentType('add')} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: adjustmentType === 'add' ? 'var(--color-text-dark)' : 'var(--color-bg-muted)', color: adjustmentType === 'add' ? '#fff' : 'var(--color-text-body)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>+ Add Stock</button>
                                    <button type="button" onClick={() => setAdjustmentType('remove')} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none', background: adjustmentType === 'remove' ? '#DC2626' : '#FEE2E2', color: adjustmentType === 'remove' ? '#fff' : '#B91C1C', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>- Remove Stock</button>
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Quantity *</label>
                                <input type="number" min="1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder={`in ${adjustItem.unit || 'unit'}`} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>Notes / Reason</label>
                                <textarea value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} rows={3} placeholder="Optional reason for adjustment" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem', resize: 'vertical' }} />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

        </div>
    );
}
