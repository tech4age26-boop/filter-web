import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, RotateCcw, User, Package, Check } from 'lucide-react';
import { apiFetch } from '../../services/api';

const RETURN_REASONS = [
    'Defective Product/Service',
    'Wrong Item Delivered',
    'Customer Changed Mind',
    'Not As Described',
    'Duplicate Order',
    'Other',
];

export default function SalesReturnScreen({ onBack }) {
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [returnRows, setReturnRows] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (!search.trim()) { setCustomers([]); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearching(true);
            apiFetch('/cashier/customers/search', { method: 'POST', body: JSON.stringify({ name: search, limit: '8' }) })
                .then(d => setCustomers(d.customers || d.data || []))
                .catch(() => setCustomers([]))
                .finally(() => setSearching(false));
        }, 350);
        return () => clearTimeout(debounceRef.current);
    }, [search]);

    const selectCustomer = (c) => {
        setSelectedCustomer(c);
        setSearch('');
        setCustomers([]);
        setOrdersLoading(true);
        apiFetch(`/cashier/orders/invoiced/${c.id}`)
            .then(d => setOrders(d.orders || d.data || []))
            .catch(() => setOrders([]))
            .finally(() => setOrdersLoading(false));
    };

    const openOrder = async (order) => {
        setSelectedOrder(order);
        setInvoice(null);
        setReturnRows({});
        setInvoiceLoading(true);
        try {
            const inv = await apiFetch('/cashier/invoice/by-order', {
                method: 'POST',
                body: JSON.stringify({ orderId: order.id }),
            });
            const invData = inv.invoice || inv.data || inv;
            setInvoice(invData);
        } catch (e) {
            alert(e.message || 'Failed to load invoice');
            setSelectedOrder(null);
        } finally {
            setInvoiceLoading(false);
        }
    };

    const toggleItem = (item) => {
        const key = item.salesOrderItemId || item.id;
        setReturnRows(prev => {
            const next = { ...prev };
            if (next[key]) delete next[key];
            else next[key] = { qty: parseFloat(item.qty ?? item.quantity ?? 1), reason: RETURN_REASONS[0] };
            return next;
        });
    };

    const setQty = (key, qty) => setReturnRows(prev => ({ ...prev, [key]: { ...prev[key], qty } }));
    const setReason = (key, reason) => setReturnRows(prev => ({ ...prev, [key]: { ...prev[key], reason } }));

    const handleSubmit = async () => {
        const items = Object.entries(returnRows).map(([salesOrderItemId, v]) => ({
            salesOrderItemId,
            qty: parseFloat(v.qty) || 0,
            reason: v.reason,
        })).filter(x => x.qty > 0);
        if (items.length === 0) { alert('Select at least one item to return'); return; }
        const invoiceId = invoice?.id || invoice?.invoiceId;
        if (!invoiceId) { alert('Invoice ID missing'); return; }
        if (!window.confirm(`Submit return for ${items.length} item(s)?`)) return;
        setSubmitting(true);
        try {
            await apiFetch('/cashier/return/submit', {
                method: 'POST',
                body: JSON.stringify({ invoiceId, proofUrl: null, items }),
            });
            setDone(true);
        } catch (e) {
            alert(e.message || 'Failed to submit return');
        } finally {
            setSubmitting(false);
        }
    };

    const resetAll = () => {
        setSelectedCustomer(null);
        setOrders([]);
        setSelectedOrder(null);
        setInvoice(null);
        setReturnRows({});
        setDone(false);
    };

    if (done) {
        return (
            <div style={{ width: '100%', textAlign: 'center', paddingTop: 80, minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
                <div style={{ width: 100, height: 100, borderRadius: '50%', background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: '0 20px 40px rgba(252,194,71,0.2)' }}>
                    <Check size={50} color="#23262D" strokeWidth={3} />
                </div>
                <h2 style={{ margin: '0 0 12px', fontSize: '2.4rem', fontWeight: 900, color: '#1E2124' }}>Return Recorded</h2>
                <p style={{ margin: '0 0 40px', color: '#64748b', fontSize: '1.2rem', fontWeight: 600 }}>The sales return has been successfully submitted.</p>
                <button onClick={resetAll}
                    style={{ padding: '16px 48px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 18, fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 10px 20px rgba(35,38,45,0.1)' }}>
                    Process Another Return
                </button>
            </div>
        );
    }

    const items = invoice?.items || invoice?.lineItems || [];

    return (
        <div style={{ width: '100%', minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                {onBack && <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>}
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1E2124' }}>Sales Return</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Locate invoices and process product returns efficiently</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 2fr)', gap: 32 }}>
                {/* LEFT: Selection Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* CUSTOMER SEARCH / INFO */}
                    <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1.5px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#23262D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={20} color="#FCC247" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1E2124' }}>Customer Selection</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Identify the account for the return</p>
                            </div>
                        </div>

                        {!selectedCustomer ? (
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input style={{ ...fieldInput, paddingLeft: 44 }} placeholder="Name or mobile..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                                {searching && <div style={{ ...spinner, right: 14 }} />}

                                {customers.length > 0 && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', borderRadius: 16, marginTop: 8, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', border: '1.5px solid #f1f5f9', overflow: 'hidden' }}>
                                        {customers.map(c => (
                                            <div key={c.id} onClick={() => selectCustomer(c)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: '0.15s' }} className="hover-row">
                                                <div style={avatar}><User size={18} color="#94a3b8" /></div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: '#1E2124' }}>{c.name || c.fullName}</p>
                                                    <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>{c.mobile || c.phone}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAF9', padding: '16px', borderRadius: 16, border: '1.5px dashed #cbd5e1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ ...avatar, background: '#23262D' }}><User size={18} color="#FCC247" /></div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: '#1E2124' }}>{selectedCustomer.name || selectedCustomer.fullName}</p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{selectedCustomer.mobile || selectedCustomer.phone}</p>
                                    </div>
                                </div>
                                <button onClick={resetAll} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>Change</button>
                            </div>
                        )}
                    </div>

                    {/* RECENT INVOICED ORDERS */}
                    {selectedCustomer && !selectedOrder && (
                        <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1.5px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', flex: 1, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1E2124' }}>Invoiced Orders</h3>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{orders.length} TOTAL</span>
                            </div>

                            {ordersLoading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[1, 2, 3].map(i => <div key={i} style={{ height: 90, borderRadius: 18, background: '#F8FAF9', animation: 'pulse 1.5s infinite' }} />)}
                                </div>
                            ) : orders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.4 }}>
                                    <RotateCcw size={32} style={{ marginBottom: 12 }} />
                                    <p style={{ fontWeight: 800, fontSize: '0.85rem' }}>No invoiced orders found</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {orders.map(o => (
                                        <div key={o.id} onClick={() => openOrder(o)}
                                            style={{ padding: 16, background: '#fff', borderRadius: 18, border: '1.5px solid #f1f5f9', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }} className="order-pill">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span style={{ fontWeight: 900, color: '#23262D', fontSize: '0.9rem' }}>#{o.orderNumber || o.id?.slice(-8)}</span>
                                                <span style={{ fontWeight: 900, color: '#1E2124', fontSize: '0.9rem' }}>SAR {(parseFloat(o.grandTotal ?? o.total ?? 0)).toFixed(2)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                                <span style={{ padding: '4px 10px', borderRadius: 8, background: '#23262D', color: '#FCC247', fontSize: '0.65rem', fontWeight: 900 }}>PICK ITEMS</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT: Main Processing Area */}
                <div style={{ flex: 1 }}>
                    {!selectedOrder ? (
                        <div style={{ height: '100%', background: '#fff', borderRadius: 32, border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center' }}>
                            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F8FAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                                <RotateCcw size={40} color="#cbd5e1" />
                            </div>
                            <h3 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 900, color: '#23262D' }}>Ready to Process</h3>
                            <p style={{ margin: 0, maxWidth: 300, color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, fontWeight: 600 }}>Select a customer and one of their previous orders to start the return process.</p>
                        </div>
                    ) : (
                        <div style={{ background: '#fff', borderRadius: 32, padding: 32, border: '1.5px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            {/* Order Info Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 24, borderBottom: '1.5px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 50, height: 50, borderRadius: 16, background: '#FFF9EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Package size={24} color="#D4A017" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1E2124' }}>Order #{selectedOrder.orderNumber || selectedOrder.id?.slice(-8)}</h3>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{items.length} total items in this invoice</p>
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedOrder(null); setInvoice(null); setReturnRows({}); }}
                                    style={{ padding: '10px 20px', borderRadius: 12, border: '1.5px solid #f1f5f9', background: '#F8FAF9', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', cursor: 'pointer' }}>
                                    Change Order
                                </button>
                            </div>

                            {/* Items List */}
                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24 }} className="hide-scroll">
                                {invoiceLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 20, background: '#F8FAF9', animation: 'pulse 1.5s infinite' }} />)}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {items.map(it => {
                                            const key = it.salesOrderItemId || it.id;
                                            const maxQty = parseFloat(it.qty ?? it.quantity ?? 1);
                                            const row = returnRows[key];
                                            const selected = !!row;
                                            return (
                                                <div key={key} style={{ background: selected ? '#FFF9EC' : '#fff', borderRadius: 20, padding: 20, border: `2.5px solid ${selected ? '#FCC247' : '#f1f5f9'}`, position: 'relative', transition: '0.2s' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                        <div onClick={() => toggleItem(it)} style={{ width: 28, height: 28, borderRadius: 8, border: `2.5px solid ${selected ? '#23262D' : '#cbd5e1'}`, background: selected ? '#23262D' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                                            {selected && <Check size={16} color="#FCC247" strokeWidth={4} />}
                                                        </div>
                                                        
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: '0.95rem', color: '#1E2124' }}>{it.name || it.productName || it.description}</p>
                                                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>SAR {(parseFloat(it.unitPrice ?? it.price ?? 0)).toFixed(2)} / unit</p>
                                                        </div>

                                                        <div style={{ textAlign: 'right' }}>
                                                            <p style={{ margin: 0, fontWeight: 900, fontSize: '0.95rem', color: '#1E2124' }}>SAR {(maxQty * parseFloat(it.unitPrice ?? it.price ?? 0)).toFixed(2)}</p>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Purchased: {maxQty}</p>
                                                        </div>
                                                    </div>

                                                    {selected && (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 20, paddingTop: 20, borderTop: '1.5px dashed #FCC247' }}>
                                                            <div>
                                                                <label style={{ ...fieldLabel, fontSize: '0.75rem', color: '#c2921d' }}>RETURN QTY (MAX {maxQty})</label>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                    <button onClick={() => setQty(key, Math.max(1, row.qty - 1))} style={qtyBtn}>-</button>
                                                                    <input type="number" readOnly value={row.qty} style={{ width: 44, border: 'none', background: 'transparent', textAlign: 'center', fontSize: '1.1rem', fontWeight: 900, color: '#23262D' }} />
                                                                    <button onClick={() => setQty(key, Math.min(maxQty, row.qty + 1))} style={qtyBtn}>+</button>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label style={{ ...fieldLabel, fontSize: '0.75rem', color: '#c2921d' }}>REASON FOR RETURN</label>
                                                                <select value={row.reason} onChange={e => setReason(key, e.target.value)}
                                                                    style={{ width: '100%', height: 44, borderRadius: 12, border: '2.5px solid #FCC247', background: '#fff', padding: '0 12px', fontSize: '0.85rem', fontWeight: 800, outline: 'none' }}>
                                                                    {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Action Bar */}
                            <div style={{ display: 'flex', gap: 16 }}>
                                <button onClick={() => { setSelectedOrder(null); setInvoice(null); setReturnRows({}); }}
                                    style={{ flex: 1, height: 60, borderRadius: 20, border: '2.5px solid #f1f5f9', background: '#fff', fontWeight: 900, fontSize: '1rem', color: '#94a3b8', cursor: 'pointer' }}>
                                    CANCEL
                                </button>
                                <button onClick={handleSubmit} disabled={submitting || Object.keys(returnRows).length === 0}
                                    style={{ flex: 2, height: 60, borderRadius: 20, border: 'none', background: Object.keys(returnRows).length === 0 ? '#f1f5f9' : '#FCC247', color: '#23262D', fontWeight: 900, fontSize: '1rem', cursor: Object.keys(returnRows).length === 0 ? 'not-allowed' : 'pointer', boxShadow: '0 10px 20px rgba(252,194,71,0.2)' }}>
                                    {submitting ? 'PROCESSING...' : `SUBMIT RETURN (${Object.keys(returnRows).length} ITEMS)`}
                                </button>
                            </div>
                        </div>
                    )
                    }
                </div>
            </div>

            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                .hover-row:hover { background: #F8FAF9 !important; }
                .order-pill:hover { border-color: #FCC247 !important; transform: translateY(-2px); }
            `}</style>
        </div>
    );
}

const iconBtn = { width: 44, height: 44, background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
const avatar = { width: 36, height: 36, borderRadius: 12, background: '#F8FAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const spinner = { width: 20, height: 20, border: '3px solid #f1f5f9', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite' };
const fieldInput = { width: '100%', height: 48, padding: '0 16px', border: '1.5px solid #e5e7eb', borderRadius: 14, fontSize: '0.9rem', fontWeight: 700, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const fieldLabel = { display: 'block', margin: '0 0 6px', fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', letterSpacing: 0.5 };
const qtyBtn = { width: 32, height: 32, borderRadius: 10, border: 'none', background: '#23262D', color: '#FCC247', fontWeight: 900, fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
