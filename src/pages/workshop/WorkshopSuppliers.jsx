import React, { useState } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MOCK_SUPPLIERS, PI_INVENTORY_ITEMS } from './constants';

export default function WorkshopSuppliers() {
    const [activeTab, setActiveTab] = useState('suppliers');
    const [search, setSearch] = useState('');
    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }]);
    const [notes, setNotes] = useState('');
    const [purchases, setPurchases] = useState([
        { id: '1', invoice_number: 'PI-2026-0041', vendor_name: 'Al-Jazeera Auto Parts', grand_total: 3200, vat_amount: 418, status: 'received', payment_status: 'unpaid' },
        { id: '2', invoice_number: 'PI-2026-0040', vendor_name: 'Gulf Lubricants Co.', grand_total: 1750, vat_amount: 228, status: 'draft', payment_status: 'unpaid' },
    ]);
    const suppliers = MOCK_SUPPLIERS;
    const products = PI_INVENTORY_ITEMS;

    const filteredSuppliers = suppliers.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

    const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
    const vat = subtotal * 0.15;
    const grandTotal = subtotal + vat;

    const updateItem = (idx, key, val) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const updated = { ...item, [key]: val };
            if (key === 'quantity' || key === 'unit_price') updated.total = (updated.quantity || 0) * (updated.unit_price || 0);
            if (key === 'product_id') {
                const prod = products.find(p => p.id === val);
                if (prod) { updated.product_name = prod.name; updated.unit_price = prod.price || 0; updated.unit = prod.unit || 'piece'; updated.total = (updated.quantity || 1) * (prod.price || 0); }
            }
            return updated;
        }));
    };

    const submitPurchase = () => {
        if (!selectedSupplier) return;
        setPurchases(prev => [{ id: String(Date.now()), invoice_number: `PI-${Date.now().toString().slice(-6)}`, vendor_name: selectedSupplier.name, grand_total: Math.round(grandTotal), vat_amount: Math.round(vat), status: 'draft', payment_status: 'unpaid' }, ...prev]);
        setShowPurchaseForm(false);
        setSelectedSupplier(null);
        setItems([{ product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }]);
        setNotes('');
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Suppliers & Purchases</h2><p className="ws-page-sub">Manage vendors and purchase invoices</p></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" onClick={() => setActiveTab('suppliers')} style={{ padding: '8px 16px', borderRadius: 8, background: activeTab === 'suppliers' ? 'var(--color-text-dark)' : '#fff', color: activeTab === 'suppliers' ? 'var(--color-primary)' : 'var(--color-text-body)', fontWeight: 700, cursor: 'pointer', border: activeTab === 'suppliers' ? 'none' : '1px solid var(--color-border)' }}>Suppliers</button>
                <button type="button" onClick={() => setActiveTab('purchases')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: activeTab === 'purchases' ? 'var(--color-text-dark)' : '#fff', color: activeTab === 'purchases' ? 'var(--color-primary)' : 'var(--color-text-body)', fontWeight: 600, cursor: 'pointer' }}>Purchase History</button>
            </div>
            {activeTab === 'suppliers' && (
                <>
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div style={{ padding: 16, display: 'flex', gap: 12 }}>
                    <input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 280, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}/>
                </div>
            </div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr><th>Supplier Name</th><th>Contact</th><th>CR No</th><th>VAT ID</th><th>Category</th><th>Actions</th></tr></thead>
                    <tbody>
                        {filteredSuppliers.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>No suppliers found</td></tr>
                        ) : filteredSuppliers.map(s => (
                            <tr key={s.id}>
                                <td><strong>{s.name}</strong></td>
                                <td>{s.phone || s.contactPerson || '—'}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{s.crNumber || '—'}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{s.vatId || '—'}</td>
                                <td><span className="ws-badge ws-badge--gray">{s.category}</span></td>
                                <td>
                                    <button type="button" className="btn-portal" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => { setSelectedSupplier(s); setShowPurchaseForm(true); }}>
                                        <ShoppingCart size={12} style={{ marginRight: 4 }}/>Add Purchase
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
                </>
            )}
            {activeTab === 'purchases' && (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead><tr><th>Invoice #</th><th>Vendor</th><th>Grand Total</th><th>VAT</th><th>Status</th><th>Payment</th></tr></thead>
                        <tbody>
                            {purchases.map(p => (
                                <tr key={p.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.invoice_number}</td>
                                    <td>{p.vendor_name}</td>
                                    <td><strong>SAR {(p.grand_total || 0).toLocaleString()}</strong></td>
                                    <td style={{ color: 'var(--color-text-muted)' }}>SAR {(p.vat_amount || 0).toLocaleString()}</td>
                                    <td><span className={`ws-badge ${p.status === 'received' ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{p.status}</span></td>
                                    <td><span className={`ws-badge ${p.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--red'}`}>{p.payment_status}</span></td>
                                </tr>
                            ))}
                            {purchases.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>No purchases yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {showPurchaseForm && selectedSupplier && (
                    <Modal title={`Add Purchase Invoice — ${selectedSupplier.name}`} onClose={() => { setShowPurchaseForm(false); setSelectedSupplier(null); }}
                        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn-secondary" onClick={() => setShowPurchaseForm(false)}>Cancel</button><button className="btn-submit" onClick={submitPurchase}>Submit Purchase Invoice</button></div>}>
                        <div style={{ padding: '8px 0' }}>
                            <div style={{ marginBottom: 16 }}><label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>Items</label>
                                {items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 80px 40px', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                        <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}>
                                            <option value="">Product</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/>
                                        <input type="number" placeholder="Unit Price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>SAR {(item.total || 0).toFixed(0)}</span>
                                        {items.length > 1 && <button type="button" onClick={() => setItems(i => i.filter((_, ii) => ii !== idx))} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>}
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setItems(i => [...i, { product_id: '', product_name: '', quantity: 1, unit: 'piece', unit_price: 0, total: 0 }])}><Plus size={14}/> Add Item</button>
                            </div>
                            <div style={{ background: 'var(--color-bg-muted)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span><span>SAR {subtotal.toFixed(2)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--color-text-muted)' }}>VAT 15%</span><span>SAR {vat.toFixed(2)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}><span>Grand Total</span><span>SAR {grandTotal.toFixed(2)}</span></div>
                            </div>
                            <div><label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
