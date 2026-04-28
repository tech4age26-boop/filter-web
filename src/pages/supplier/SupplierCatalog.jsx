import React, { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    createSupplierProduct,
    deleteSupplierProduct,
    listSupplierProducts,
    updateSupplierProduct,
} from '../../services/supplierApi';

export default function SupplierCatalog() {
    const [products, setProducts] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [form, setForm] = useState({ sku: '', name: '', category: '', unit: 'pcs', price: '', reorder: '' });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState('');
    const [saveError, setSaveError] = useState('');

    const mapProduct = (p) => ({
        id: p?.id,
        sku: p?.sku || '-',
        name: p?.productName || p?.name || p?.product || '',
        category: p?.categoryName || p?.category?.name || 'General',
        unit: p?.workshopUnit || p?.warehouseUnit || 'pcs',
        price: Number(p?.pricePerWarehouseUnit || 0),
        reorder: Number(p?.reorderLevel || 0),
        qty: Number(p?.currentStock || 0),
    });

    const loadProducts = async () => {
        setLoading(true);
        setApiError('');
        try {
            const res = await listSupplierProducts({ status: 'active', limit: 200 });
            const list = Array.isArray(res?.products)
                ? res.products.map(mapProduct)
                : [];
            setProducts(list);
        } catch (err) {
            console.error('Supplier catalog API failed:', err);
            setApiError(err?.message || 'Failed to load products.');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts().catch(() => undefined);
        return undefined;
    }, []);

    const openAdd = () => {
        setEditProduct(null);
        setSaveError('');
        setForm({ sku: '', name: '', category: '', unit: 'pcs', price: '', reorder: '' });
        setModalOpen(true);
    };
    const openEdit = (p) => {
        setEditProduct(p);
        setSaveError('');
        setForm({ sku: p.sku || '', name: p.name || '', category: p.category || '', unit: p.unit || 'pcs', price: String(p.price ?? ''), reorder: String(p.reorder ?? '') });
        setModalOpen(true);
    };
    const handleSave = async () => {
        if (!form.name) return;
        setSaveError('');
        const data = {
            sku: form.sku || `PRD-${Date.now()}`,
            name: form.name,
            category: form.category || 'General',
            unit: form.unit || 'pcs',
            price: Number(form.price) || 0,
            reorder: Number(form.reorder) || 0,
            qty: editProduct?.qty ?? 0,
        };
        setSaving(true);
        try {
            if (editProduct) {
                const updated = await updateSupplierProduct(editProduct.id, {
                    productName: data.name,
                    sku: data.sku,
                    workshopUnit: data.unit,
                    warehouseUnit: data.unit,
                    pricePerWarehouseUnit: Number(data.price) || 0,
                    reorderLevel: Number(data.reorder) || 0,
                });
                const normalized = mapProduct(updated?.product || {});
                setProducts((prev) =>
                    prev.map((p) => (p.id === editProduct.id ? { ...p, ...normalized } : p)),
                );
            } else {
                const created = await createSupplierProduct({
                    productName: data.name,
                    sku: data.sku,
                    workshopUnit: data.unit,
                    warehouseUnit: data.unit,
                    pricePerWarehouseUnit: Number(data.price) || 0,
                    reorderLevel: Number(data.reorder) || 0,
                });
                setProducts((prev) => [...prev, mapProduct(created?.product || {})]);
            }
        } catch (err) {
            console.error('Supplier catalog save failed:', err);
            setSaveError(err?.message || 'Failed to save product.');
            return;
        } finally {
            setSaving(false);
        }
        setModalOpen(false);
        setEditProduct(null);
        setForm({ sku: '', name: '', category: '', unit: 'pcs', price: '', reorder: '' });
    };

    const handleDelete = async (product) => {
        const ok = window.confirm(`Delete "${product.name}"?\n\nThis will permanently delete from database.`);
        if (!ok) return;
        try {
            await deleteSupplierProduct(product.id);
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
        } catch (err) {
            console.error('Delete product failed:', err);
            setApiError(err?.message || 'Failed to delete product.');
        }
    };

    const list = products || [];
    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Product Catalog ({list.length})</h2><p className="ws-page-sub">Supplier product listings</p></div>
                <button className="btn-portal" style={{ background: '#2563EB', color: '#fff', border: 'none' }} onClick={openAdd}><Plus size={15} /> Add Product</button>
            </div>
            {loading && (
                <div className="ws-section" style={{ marginBottom: 12, padding: 12, fontSize: '0.8125rem' }}>
                    Loading products from `/supplier/products`...
                </div>
            )}
            {apiError && (
                <div className="ws-section" style={{ marginBottom: 12, padding: 12, fontSize: '0.8125rem', color: '#B91C1C', border: '1px solid #FECACA', background: '#FEF2F2' }}>
                    API error: {apiError}. Ensure supplier login token is available as Bearer token.
                </div>
            )}
            {list.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Package size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No products in catalog yet</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Add products to sell to workshop branches</p>
                    <button className="btn-portal" style={{ marginTop: 16, background: '#2563EB', color: '#fff', border: 'none' }} onClick={openAdd}><Plus size={15} /> Add First Product</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {list.map(p => (
                        <div key={p.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--color-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={20} style={{ color: 'var(--color-text-muted)' }} /></div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>{p.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0', fontFamily: 'monospace' }}>{p.sku} · {p.category}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.unit}</span>
                                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>SAR {Number(p.price).toLocaleString()}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => openEdit(p)}><Pencil size={14} /> Edit</button>
                                <button
                                    type="button"
                                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    onClick={() => handleDelete(p)}
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={editProduct ? 'Edit Product' : 'Add Product'}
                        onClose={() => { setModalOpen(false); setEditProduct(null); }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button className="btn-portal-outline" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button className="btn-portal" disabled={!form.name || saving} onClick={handleSave}>{saving ? 'Saving...' : (editProduct ? 'Update Product' : 'Add Product')}</button>
                            </div>
                        }
                        width="420px"
                    >
                        {saveError ? (
                            <div style={{ marginBottom: 10, fontSize: '0.75rem', color: '#B91C1C' }}>
                                {saveError}
                            </div>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field"><label>SKU</label><input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="LUB-001" /></div>
                            <div className="ws-field"><label>Product Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Engine Oil 5W40" /></div>
                            <div className="ws-field"><label>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} placeholder="Lubricants" /></div>
                            <div className="ws-field"><label>Unit</label><select value={form.unit} onChange={e => set('unit', e.target.value)}><option value="pcs">pcs</option><option value="liter">liter</option><option value="set">set</option><option value="box">box</option></select></div>
                            <div className="ws-field"><label>Price (SAR)</label><input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="45" /></div>
                            <div className="ws-field"><label>Reorder level</label><input type="number" value={form.reorder} onChange={e => set('reorder', e.target.value)} placeholder="20" /></div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
