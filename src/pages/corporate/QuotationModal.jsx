import { useState, useEffect, useRef } from 'react';
import { Tag, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';

export default function QuotationModal({ branches = [], walletBalance, onClose, onSave }) {
    const [lines, setLines] = useState([]);
    const [branchId, setBranchId] = useState('');
    const [allItems, setAllItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (branches.length && !branchId) setBranchId(String(branches[0]?.id || ''));
    }, [branches]);

    useEffect(() => {
        if (!branchId) return;
        setLoadingItems(true);
        setAllItems([]);
        Promise.all([
            apiFetch(`/corporate/products?branchId=${branchId}`).catch(() => null),
            apiFetch(`/corporate/services?branchId=${branchId}`).catch(() => null),
        ]).then(([prodData, svcData]) => {
            const products = (prodData?.products || prodData?.data || prodData?.items || (Array.isArray(prodData) ? prodData : [])).map(p => ({ ...p, _type: 'product' }));
            const services = (svcData?.services || svcData?.data || svcData?.items || (Array.isArray(svcData) ? svcData : [])).map(s => ({ ...s, _type: 'service' }));
            setAllItems([...products, ...services]);
        }).finally(() => setLoadingItems(false));
    }, [branchId]);

    const filteredItems = allItems
        .filter(p => !lines.find(l => l.product_id === p.id))
        .filter(p => !search.trim() || p.name?.toLowerCase().includes(search.toLowerCase()));

    const addItem = (p) => {
        const price = parseFloat(p.sale_price ?? p.salePrice ?? p.price ?? p.corporatePrice ?? 0) || 0;
        const id = p.id ?? p.serviceId ?? p.service_id ?? p.productId ?? p.product_id;
        setLines(prev => [...prev, { product_id: id, name: p.name, unit: p.unit || (p._type === 'service' ? 'service' : 'unit'), sale_price: price, qty: 1, quoted_price: price, _type: p._type, _raw: p }]);
        setSearch(''); setShowDropdown(false);
    };
    const updateLine = (idx, key, val) => setLines(prev => prev.map((l, i) => i !== idx ? l : { ...l, [key]: val }));
    const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

    const totalNormal = lines.reduce((s, l) => s + (parseFloat(l.sale_price) || 0) * (parseFloat(l.qty) || 1), 0);
    const totalQuoted = lines.reduce((s, l) => s + (parseFloat(l.quoted_price) || 0) * (parseFloat(l.qty) || 1), 0);
    const totalSavings = totalNormal - totalQuoted;
    const savingsPct = totalNormal > 0 ? ((totalSavings / totalNormal) * 100).toFixed(1) : 0;

    const handleSubmit = async () => {
        if (lines.length === 0) return;
        setSubmitting(true); setError('');
        try {
            const payload = {
                branchId: branchId || undefined,
                items: lines.map(l => {
                    const item = {
                        qty: parseFloat(l.qty) || 1,
                        quotedPrice: parseFloat(l.quoted_price) || 0,
                    };
                    const id = l.product_id ?? l._raw?.id ?? l._raw?.serviceId ?? l._raw?.service_id ?? l._raw?.productId;
                    if (l._type === 'service') item.serviceId = String(id);
                    else item.productId = String(id);
                    return item;
                }),
            };
            console.log('[Quotation Submit Payload]', JSON.stringify(payload, null, 2));
            const data = await apiFetch('/corporate/quotations/submit', { method: 'POST', body: JSON.stringify(payload) });
            onSave(data.quotation || data.data || data);
            onClose();
        } catch (err) {
            const msg = err.message || '';
            setError(msg.includes('DecimalError') || msg.includes('500') || msg.startsWith('[')
                ? 'Server error while processing quotation. Please try with different items or contact support.'
                : msg || 'Failed to submit quotation');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={20}/> New Price Quotation</span>}
            onClose={onClose}
            width="520px"
            footer={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                    {error && <p style={{ color: '#DC2626', fontSize: '0.8125rem', margin: 0, textAlign: 'right' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="btn-portal-outline" onClick={onClose} disabled={submitting}>Cancel</button>
                        <button className="btn-portal" style={{ background: '#7C3AED', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                            disabled={lines.length === 0 || submitting} onClick={handleSubmit}>
                            {submitting && <Loader2 size={14} className="spin"/>}
                            {submitting ? 'Submitting…' : 'Submit Quotation for Approval'}
                        </button>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {branches.length > 0 && (
                    <div className="ws-field" style={{ marginBottom: 0 }}>
                        <label>Branch</label>
                        <select value={branchId} onChange={e => { setBranchId(e.target.value); setSearch(''); setLines([]); }}>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                )}

                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                        Search & Add Product / Service
                        {loadingItems && <Loader2 size={12} className="spin" style={{ marginLeft: 8, color: 'var(--color-text-muted)' }}/>}
                        {!loadingItems && allItems.length > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>({allItems.length} available)</span>}
                    </label>
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        placeholder={loadingItems ? 'Loading…' : allItems.length === 0 ? 'No items available for this branch' : 'Type to filter products & services…'}
                        disabled={loadingItems}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
                    />
                    {showDropdown && !loadingItems && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10 }}>
                            {filteredItems.length === 0 ? (
                                <p style={{ padding: '10px 12px', fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                    {allItems.length === 0 ? 'No products/services found for this branch' : 'No matches found'}
                                </p>
                            ) : filteredItems.slice(0, 30).map(p => (
                                <button key={p.id} type="button" onClick={() => addItem(p)}
                                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: p._type === 'service' ? '#EDE9FE' : '#DBEAFE', color: p._type === 'service' ? '#7C3AED' : '#1D4ED8', fontWeight: 700, textTransform: 'uppercase' }}>{p._type}</span>
                                        {p.name}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                                        SAR {Number(p.sale_price ?? p.salePrice ?? p.price ?? 0).toFixed(2)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {lines.length > 0 ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 80px 32px', gap: 8, fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            <span>Item</span><span style={{ textAlign: 'center' }}>Qty</span><span style={{ textAlign: 'center' }}>Market Price</span><span style={{ textAlign: 'center' }}>Your Price</span><span/>
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {lines.map((line, idx) => {
                                const qtyNum = parseFloat(line.qty) || 1;
                                return (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 80px 32px', gap: 8, alignItems: 'center', padding: 10, background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8125rem' }}>{line.name}</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{line.unit}</p>
                                        </div>
                                        <input type="number" value={line.qty} min="1" onChange={e => updateLine(idx, 'qty', e.target.value)}
                                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.75rem', textAlign: 'center' }}/>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>SAR {(line.sale_price * qtyNum).toFixed(2)}</span>
                                        <input type="number" value={line.quoted_price} placeholder="0" onChange={e => updateLine(idx, 'quoted_price', e.target.value)}
                                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.75rem', textAlign: 'center' }}/>
                                        <button type="button" onClick={() => removeLine(idx)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                                    </div>
                                );
                            })}
                        </div>
                        {totalQuoted > 0 && (
                            <div style={{ padding: 14, borderRadius: 12, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                                <p style={{ fontWeight: 700, color: '#047857', margin: '0 0 8px 0', fontSize: '0.875rem' }}>Savings Summary</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#065F46' }}><span>Normal Total:</span><span>SAR {totalNormal.toFixed(2)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#065F46' }}><span>Your Total:</span><span>SAR {totalQuoted.toFixed(2)}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.875rem', color: '#047857', marginTop: 6 }}><span>You Save:</span><span>SAR {totalSavings.toFixed(2)} ({savingsPct}%) ✓</span></div>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: 32, border: '2px dashed var(--color-border)', borderRadius: 12, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        {loadingItems ? 'Loading products & services…' : 'Search and add products above'}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#FAF5FF', borderRadius: 12, fontSize: '0.8125rem', color: 'var(--color-text-dark)' }}>
                    Wallet Balance: SAR {walletBalance?.toLocaleString?.() ?? walletBalance}
                </div>
            </div>
        </Modal>
    );
}
