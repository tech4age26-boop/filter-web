import { useState, useEffect, useMemo } from 'react';
import { Package, Search, LayoutGrid, ShoppingCart, Plus, Minus, Trash2, Tag, Receipt, PlusCircle, CheckCircle2 } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

const VAT_RATE = 0.15;

export default function ProductsScreen() {
    const { catalog, catalogLoading, refreshCatalog, cart, addToCart, updateCartQuantity, removeFromCart, clearCart } = usePOS();
    
    // Filtering states
    const [selectedDeptId, setSelectedDeptId] = useState('All');
    const [selectedType, setSelectedType] = useState('All'); // 'All', 'Products', 'Services'
    const [selectedCat, setSelectedCat] = useState('All');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (catalog.length === 0) {
            refreshCatalog();
        }
    }, [catalog.length, refreshCatalog]);

    // Reset filters when department changes
    useEffect(() => {
        setSelectedCat('All');
    }, [selectedDeptId]);

    const { departments, categories, flatProducts } = useMemo(() => {
        const depts = [{ id: 'All', name: 'All Departments' }, ...catalog];
        const cats = new Set(['All']);
        const products = [];

        catalog.forEach(dept => {
            const isMatchDept = selectedDeptId === 'All' || selectedDeptId === dept.id;
            
            const processProduct = (p, cName = '') => {
                const type = p.type === 'service' ? 'Services' : 'Products';
                const matchesType = selectedType === 'All' || selectedType === type;
                
                if (isMatchDept) {
                    if (cName) cats.add(cName);
                    products.push({ ...p, deptId: dept.id, deptName: dept.name, categoryName: cName, typeLabel: type });
                }
            };

            (dept.categories || []).forEach(cat => {
                (cat.products || []).forEach(p => processProduct(p, cat.name));
                (cat.services || []).forEach(s => processProduct({ ...s, type: 'service' }, cat.name));
                
                (cat.subCategories || []).forEach(sub => {
                    (sub.products || []).forEach(p => processProduct(p, cat.name));
                    (sub.services || []).forEach(s => processProduct({ ...s, type: 'service' }, cat.name));
                });
            });

            (dept.uncategorizedProducts || []).forEach(p => processProduct(p));
            (dept.uncategorizedServices || []).forEach(s => processProduct({ ...s, type: 'service' }));
        });

        return { 
            departments: depts, 
            categories: Array.from(cats), 
            flatProducts: products 
        };
    }, [catalog, selectedDeptId, selectedType]);

    const filteredProducts = useMemo(() => {
        let list = flatProducts;
        
        // Category Filter
        if (selectedCat !== 'All') {
            list = list.filter(p => p.categoryName === selectedCat);
        }

        // Search Filter
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p => 
                (p.name || '').toLowerCase().includes(q) || 
                (p.categoryName || '').toLowerCase().includes(q)
            );
        }

        return list;
    }, [flatProducts, selectedCat, search]);

    // Cart calculations
    const subtotal = cart.reduce((s, item) => s + (parseFloat(item.product.salePrice ?? item.product.price ?? 0) * item.quantity), 0);
    const vat = subtotal * VAT_RATE;
    const total = subtotal + vat;

    const getItemQty = (id) => cart.find(item => item.product.id === id)?.quantity || 0;

    if (catalogLoading && catalog.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
                <p style={{ color: '#64748b', fontWeight: 600 }}>Loading catalog...</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
            {/* Products Column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                
                {/* Search & Type Toggle */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="text" placeholder="Search by name or category..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }} />
                    </div>

                    <div style={{ display: 'flex', background: '#fff', padding: 4, borderRadius: 12, border: '1.5px solid #e5e7eb' }}>
                        {['All', 'Products', 'Services'].map(type => (
                            <button key={type} onClick={() => setSelectedType(type)}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, border: 'none',
                                    background: selectedType === type ? '#FCC247' : 'transparent',
                                    color: selectedType === type ? '#23262D' : '#64748b',
                                    fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit'
                                }}>
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Horizontal Depts */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }} className="no-scrollbar">
                    {departments.map(d => (
                        <button key={d.id} onClick={() => setSelectedDeptId(d.id)}
                            style={{
                                padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${selectedDeptId === d.id ? '#23262D' : '#e5e7eb'}`,
                                background: selectedDeptId === d.id ? '#23262D' : '#fff',
                                color: selectedDeptId === d.id ? '#FCC247' : '#64748b',
                                fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit'
                            }}>
                            {d.name}
                        </button>
                    ))}
                </div>

                {/* Horizontal Categories */}
                {categories.length > 2 && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }} className="no-scrollbar">
                        {categories.map(c => (
                            <button key={c} onClick={() => setSelectedCat(c)}
                                style={{
                                    padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${selectedCat === c ? '#FCC247' : '#e5e7eb'}`,
                                    background: selectedCat === c ? '#FFFBF0' : '#fff',
                                    color: selectedCat === c ? '#92400e' : '#64748b',
                                    fontWeight: selectedCat === c ? 800 : 600, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit'
                                }}>
                                {c}
                            </button>
                        ))}
                    </div>
                )}

                {/* Grid */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '100px 0', color: '#94a3b8' }}>
                            <Package size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <p style={{ fontWeight: 600 }}>No items match your search</p>
                        </div>
                    ) : (
                        <div className="pos-product-grid">
                            {filteredProducts.map(p => {
                                const qty = getItemQty(p.id);
                                const stock = p.qtyOnHand ?? p.stock ?? 0;
                                const rawPrice = parseFloat(p.salePrice ?? p.price ?? 0);
                                const priceInc = (rawPrice * (1 + VAT_RATE)).toFixed(2);
                                const isService = p.typeLabel === 'Services';
                                
                                const stockStatus = isService ? 'Service' : stock <= 0 ? 'Out of Stock' : stock <= 10 ? `Low: ${stock}` : `In Stock: ${stock}`;
                                const stockColor = isService ? '#22c55e' : stock <= 0 ? '#ef4444' : stock <= 10 ? '#f97316' : '#22c55e';

                                return (
                                    <div key={p.id} style={{ 
                                        background: '#fff', borderRadius: 16, padding: '14px', border: `2px solid ${qty > 0 ? '#FCC247' : '#f1f5f9'}`, 
                                        boxShadow: qty > 0 ? '0 8px 20px rgba(252,194,71,0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                                        display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s ease', position: 'relative'
                                    }}>
                                        {qty > 0 && <CheckCircle2 size={18} color="#FCC247" fill="#23262D" style={{ position: 'absolute', top: -8, right: -8 }} />}
                                        
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1E2124', lineHeight: 1.3, height: 38, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {p.name}
                                        </p>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ padding: '3px 8px', borderRadius: 6, background: `${stockColor}12`, color: stockColor, fontSize: '0.65rem', fontWeight: 800 }}>
                                                {stockStatus}
                                            </span>
                                            {p.unit && <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>{p.unit}</span>}
                                        </div>

                                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#1E2124' }}>SAR</span>
                                                <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1E2124' }}>{priceInc}</span>
                                            </div>

                                            {qty > 0 ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '4px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                                    <button onClick={() => updateCartQuantity(p.id, -1)} style={qtyBtn}><Minus size={12} /></button>
                                                    <span style={{ fontWeight: 900, fontSize: '0.85rem', minWidth: 16, textAlign: 'center' }}>{qty}</span>
                                                    <button onClick={() => updateCartQuantity(p.id, 1)} style={qtyBtn} disabled={!isService && qty >= stock}><Plus size={12} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => addToCart(p)} disabled={!isService && stock <= 0}
                                                    style={{ background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', opacity: (!isService && stock <= 0) ? 0.3 : 1 }}>
                                                    <Plus size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Live Invoice Column */}
            <div style={{ width: 340, background: '#fff', borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                <div style={{ padding: '20px', background: '#23262D', color: '#FCC247', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Receipt size={22} />
                    <span style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: '0.02em' }}>LIVE INVOICE</span>
                    {cart.length > 0 && <span style={{ marginLeft: 'auto', background: '#FCC247', color: '#23262D', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 900 }}>{cart.length}</span>}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="custom-scrollbar">
                    {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                            <ShoppingCart size={48} style={{ opacity: 0.1, marginBottom: 12 }} />
                            <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cart is empty</p>
                            <p style={{ fontSize: '0.75rem' }}>Select products to start building an invoice</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {cart.map(item => {
                                const p = item.product;
                                const unit = parseFloat(p.salePrice ?? p.price ?? 0);
                                return (
                                    <div key={p.id} style={{ display: 'flex', gap: 10, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: '#1E2124', marginBottom: 4 }}>{p.name}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '2px 6px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                                    <button onClick={() => updateCartQuantity(p.id, -1)} style={qtyBtnSm}><Minus size={10} /></button>
                                                    <span style={{ fontWeight: 800, fontSize: '0.75rem', minWidth: 14, textAlign: 'center' }}>{item.quantity}</span>
                                                    <button onClick={() => updateCartQuantity(p.id, 1)} style={qtyBtnSm}><Plus size={10} /></button>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                                    × {unit.toFixed(2)} = <b>{(unit * item.quantity).toFixed(2)}</b>
                                                </span>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', padding: 4, cursor: 'pointer', alignSelf: 'flex-start' }}><Trash2 size={14} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {cart.length > 0 && (
                    <div style={{ padding: '20px', background: '#FBFBFD', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Subtotal</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E2124' }}>SAR {subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>VAT (15%)</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E2124' }}>SAR {vat.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px dashed #e2e8f0' }}>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#23262D' }}>GRAND TOTAL</span>
                            <span style={{ fontWeight: 900, fontSize: '1.2rem', color: '#23262D' }}>SAR {total.toFixed(2)}</span>
                        </div>
                        
                        <button onClick={() => alert('Proceeding to checkout workflow...')}
                            style={{ width: '100%', marginTop: 20, padding: '14px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 14, fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                            Generate Invoice
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
            `}</style>
        </div>
    );
}

const qtyBtn = {
    width: 24, height: 24, borderRadius: 6, border: 'none',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
};

const qtyBtnSm = {
    padding: 0, width: 20, height: 20, borderRadius: 4, border: 'none',
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
};
