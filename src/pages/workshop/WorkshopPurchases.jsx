import React, { useState } from 'react';
import { Plus, ShoppingCart, BarChart3, AlertTriangle, Calendar, Search, Zap } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { PI_INVENTORY_ITEMS, PI_ACCOUNT_OPTIONS, PI_TAXES } from './constants';

export default function WorkshopPurchases({ tabState, clearTabState }) {
    const [activeTab, setActiveTab] = useState('invoices');
    const [filterSupplier, setFilterSupplier] = useState('all');
    const [filterProduct, setFilterProduct] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);

    React.useEffect(() => {
        if (tabState?.autoOpenModal) {
            setModalOpen(true);
            
            // If a product was passed, pre-fill it in the lines
            if (tabState.selectedItem) {
                const item = tabState.selectedItem;
                const newLine = {
                    id: Date.now(),
                    item: item.name,
                    account: '1410 - Inventory Asset',
                    description: '',
                    uom: 'piece',
                    qty: 1,
                    price: item.basePrice || 0,
                    discount: 0,
                    taxCode: 'VAT 15%',
                    taxAmt: ((item.basePrice || 0) * 0.15).toFixed(2),
                    totalFinal: ((item.basePrice || 0) * 1.15).toFixed(2)
                };
                setLineItems([newLine]);
            }

            // Clear state so it doesn't reopen on every render/tab change
            if (clearTabState) clearTabState();
        }
    }, [tabState, clearTabState]);

    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);
    const [issueDate, setIssueDate] = useState('2026-03-08');
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('2026-04-07');
    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [invoices, setInvoices] = useState([
        { id: 'PI-2026-0041', invoice_number: 'PI-2026-0041', supplier: 'Al-Jazeera Auto Parts', vendor_name: 'Al-Jazeera Auto Parts', date: '2026-03-08', subtotal: 2783, vat_amount: 418, grand_total: 3200, amount_paid: 0, balance_due: 3200, payment_status: 'unpaid', status: 'approved', stock_updated: false, items: [{ product_id: 1, product_name: 'Engine Oil 5W-30', quantity: 20, unit: 'piece', unit_price: 85, total: 1700 }] },
        { id: 'PI-2026-0040', invoice_number: 'PI-2026-0040', supplier: 'Gulf Lubricants Co.', vendor_name: 'Gulf Lubricants Co.', date: '2026-03-07', subtotal: 1522, vat_amount: 228, grand_total: 1750, amount_paid: 0, balance_due: 1750, payment_status: 'unpaid', status: 'pending', stock_updated: false, items: [{ product_id: 2, product_name: 'Brake Pads Set', quantity: 2, unit: 'set', unit_price: 220, total: 440 }] },
        { id: 'PI-2026-0039', invoice_number: 'PI-2026-0039', supplier: 'Saudi Tire Trading', vendor_name: 'Saudi Tire Trading', date: '2026-03-05', subtotal: 7304, vat_amount: 1096, grand_total: 8400, amount_paid: 8400, balance_due: 0, payment_status: 'paid', status: 'approved', stock_updated: true, items: [{ product_id: 5, product_name: 'Car Battery 12V', quantity: 10, unit: 'piece', unit_price: 280, total: 2800 }] },
    ]);

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            const filtered = PI_INVENTORY_ITEMS.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
            setSearchResults(filtered);
            setShowDropdown(true);
            setSelectedIndex(0);
        } else {
            setSearchResults([]);
            setShowDropdown(false);
        }
    };

    const updateLineItem = (id, field, value) => {
        const taxes = PI_TAXES;
        setLineItems(prev => prev.map(line => {
            if (line.id !== id) return line;
            const updatedLine = { ...line, [field]: value };
            if (field === 'qty' || field === 'price' || field === 'taxCode') {
                const qty = parseFloat(field === 'qty' ? value : line.qty) || 0;
                const price = parseFloat(field === 'price' ? value : line.price) || 0;
                const taxCodeStr = field === 'taxCode' ? value : line.taxCode;
                const subtotal = qty * price;
                const taxRate = taxes.find(t => (t.code === taxCodeStr || t.name === taxCodeStr))?.rate || 0;
                const taxAmt = subtotal * taxRate;
                updatedLine.taxAmt = taxAmt.toFixed(2);
                updatedLine.totalFinal = (subtotal + taxAmt).toFixed(2);
            }
            return updatedLine;
        }));
    };

    const getSummary = () => {
        const subtotal = lineItems.reduce((acc, line) => acc + (parseFloat(line.qty) * parseFloat(line.price) || 0), 0);
        const totalTax = lineItems.reduce((acc, line) => acc + parseFloat(line.taxAmt || 0), 0);
        const grandTotal = subtotal + totalTax;
        return {
            subtotal: subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            totalTax: totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            grandTotal: grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        };
    };

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
            totalFinal: (item.price * 1.15).toFixed(2)
        };
        setLineItems(prev => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        else if (e.key === 'ArrowUp') setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        else if (e.key === 'Enter' && selectedIndex >= 0) addItemToLines(searchResults[selectedIndex]);
        else if (e.key === 'Escape') setShowDropdown(false);
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str) return '';
        if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            const result = Function('return (' + str + ')')();
            if (typeof result === 'number' && isFinite(result)) return parseFloat(result.toFixed(6)).toString();
        } catch { /* invalid */ }
        return str;
    };

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') { e.preventDefault(); const v = evalMath(e.target.value); updateLineItem(lineId, field, v); e.target.value = v; }
    };
    const handleMathBlur = (e, lineId, field) => {
        const v = evalMath(e.target.value);
        if (v !== e.target.value) updateLineItem(lineId, field, v);
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') due.setDate(issue.getDate() + parseInt(netDays || 0));
        else if (dueDateType === 'Custom') return customDueDate;
        else if (dueDateType === 'EOM') due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
    };

    const getGridColumns = () => {
        let cols = [];
        if (showLineNum) cols.push('40px');
        cols.push('2fr', '1.5fr');
        if (showDesc) cols.push('2fr');
        cols.push('0.8fr', '0.8fr', '1fr');
        if (showDiscount) cols.push('1fr');
        cols.push('1fr', '1fr', '1fr', '1fr');
        return cols.join(' ');
    };

    const summary = getSummary();

    const totalPayables = invoices.filter(i => i.payment_status !== 'paid').reduce((s, i) => s + (i.balance_due || i.grand_total || 0), 0);
    const overduePayables = 0;
    const priceHistory = invoices.flatMap(inv => (inv.items || []).map(item => ({
        ...item, invoice_number: inv.invoice_number || inv.id, vendor_name: inv.vendor_name || inv.supplier, invoice_date: inv.date, invoice_id: inv.id,
    })));
    const filteredHistory = priceHistory.filter(r => {
        const matchSupplier = filterSupplier === 'all' || r.vendor_name === filterSupplier;
        const matchProduct = filterProduct === 'all' || r.product_id === filterProduct;
        return matchSupplier && matchProduct;
    });
    const uniqueVendors = [...new Set(invoices.map(i => i.vendor_name || i.supplier).filter(Boolean))];

    const handleCreateInvoice = () => {
        const amt = parseFloat(summary.grandTotal.replace(/,/g, '')) || 0;
        const vatAmt = amt * 0.15 / 1.15;
        const subAmt = amt - vatAmt;
        setInvoices(prev => [{
            id: `pi-${Date.now()}`, invoice_number: `PI-${Date.now().toString().slice(-6)}`, supplier: 'Gulf Lubricants Co.', vendor_name: 'Gulf Lubricants Co.',
            date: issueDate, subtotal: subAmt, vat_amount: vatAmt, grand_total: amt, amount_paid: 0, balance_due: amt,
            payment_status: 'unpaid', status: 'draft', stock_updated: false, items: lineItems.map(l => ({ product_id: l.id, product_name: l.item, quantity: parseFloat(l.qty) || 0, unit: l.uom, unit_price: parseFloat(l.price) || 0, total: (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0) })),
        }, ...prev]);
        setModalOpen(false);
        setLineItems([]); setIssueDate('2026-03-08'); setDueDateType('Net'); setNetDays(30);
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Accounts Payable</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991B1B', margin: '4px 0 0' }}>SAR {totalPayables.toLocaleString()}</p>
                    <p style={{ fontSize: '0.75rem', color: '#DC2626', margin: '4px 0 0' }}>Owed to vendors</p>
                </div>
                {overduePayables > 0 && (
                    <div style={{ padding: 16, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={20} style={{ color: '#EA580C' }}/>
                        <div><p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#EA580C' }}>Overdue</p><p style={{ fontSize: '1.25rem', fontWeight: 800 }}>SAR {overduePayables.toLocaleString()}</p></div>
                    </div>
                )}
                <div style={{ padding: 16, background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', borderRadius: 16 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Total Purchase Invoices</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0 0' }}>{invoices.length}</p>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setActiveTab('invoices')} style={{ padding: '8px 16px', borderRadius: 8, background: activeTab === 'invoices' ? 'var(--color-text-dark)' : '#fff', color: activeTab === 'invoices' ? 'var(--color-primary)' : 'var(--color-text-body)', fontWeight: 700, cursor: 'pointer', border: activeTab === 'invoices' ? 'none' : '1px solid var(--color-border)' }}>Purchase Invoices</button>
                    <button onClick={() => setActiveTab('price_report')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: activeTab === 'price_report' ? 'var(--color-text-dark)' : '#fff', color: activeTab === 'price_report' ? 'var(--color-primary)' : 'var(--color-text-body)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14}/>Purchase Price Report</button>
                </div>
                <button className="btn-portal" onClick={() => setModalOpen(true)}><Plus size={16}/> New Purchase Invoice</button>
            </div>
            {activeTab === 'invoices' && (
            <div className="ws-section">
                <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr><th>Invoice #</th><th>Vendor</th><th>Ref</th><th>Issue Date</th><th>Due Date</th><th>Subtotal</th><th>Tax</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment</th><th>Stock</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {invoices.map(inv => (
                            <tr key={inv.id}>
                                <td><strong style={{ color: '#EA580C' }}>{inv.invoice_number || inv.id}</strong></td>
                                <td>{inv.vendor_name || inv.supplier || '–'}</td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>–</td>
                                <td style={{ fontSize: '0.75rem' }}>{inv.date || '–'}</td>
                                <td style={{ fontSize: '0.75rem' }}>–</td>
                                <td>SAR {(inv.subtotal || 0).toLocaleString()}</td>
                                <td style={{ fontSize: '0.75rem' }}>SAR {(inv.vat_amount || 0).toLocaleString()}</td>
                                <td><strong>SAR {(inv.grand_total || 0).toLocaleString()}</strong></td>
                                <td style={{ color: '#059669' }}>SAR {(inv.amount_paid || 0).toLocaleString()}</td>
                                <td style={{ color: '#DC2626', fontWeight: 700 }}>SAR {(inv.balance_due || 0).toLocaleString()}</td>
                                <td><span className={`ws-badge ${inv.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{inv.payment_status}</span></td>
                                <td><span className={`ws-badge ${inv.stock_updated ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{inv.stock_updated ? 'Updated' : 'Pending'}</span></td>
                                <td><button className="btn-portal" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>View</button></td>
                            </tr>
                        ))}
                        {invoices.length === 0 && <tr><td colSpan={13} style={{ textAlign: 'center', padding: 40 }}>No purchase invoices yet</td></tr>}
                    </tbody>
                </table>
                </div>
            </div>
            )}
            {activeTab === 'price_report' && (
            <div className="ws-section">
                <div style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div><label style={{ fontSize: '0.6875rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Filter by Vendor</label>
                        <select value={filterSupplier} onChange={e=>setFilterSupplier(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }}><option value="all">All Vendors</option>{uniqueVendors.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
                    <div><label style={{ fontSize: '0.6875rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Filter by Product</label>
                        <select value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }}><option value="all">All Products</option>{PI_INVENTORY_ITEMS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                </div>
                <table className="ws-table">
                    <thead><tr><th>Product</th><th>Vendor</th><th>Invoice #</th><th>Date</th><th>Qty</th><th>Unit</th><th>Unit Price (SAR)</th><th>Line Total</th><th>Tax</th><th>Grand Total</th></tr></thead>
                    <tbody>
                        {filteredHistory.map((r, idx) => (
                            <tr key={idx}><td><strong>{r.product_name}</strong></td><td>{r.vendor_name}</td><td style={{ color: '#EA580C' }}>{r.invoice_number}</td><td style={{ fontSize: '0.75rem' }}>{r.invoice_date || '–'}</td><td>{r.quantity}</td><td style={{ fontSize: '0.75rem' }}>{r.unit}</td><td><strong style={{ color: '#2563EB' }}>SAR {parseFloat(r.unit_price || 0).toFixed(2)}</strong></td><td>SAR {parseFloat(r.total || 0).toFixed(2)}</td><td style={{ fontSize: '0.75rem' }}>VAT 15%</td><td><strong>SAR {(parseFloat(r.total || 0) * 1.15).toFixed(2)}</strong></td></tr>
                        ))}
                        {filteredHistory.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>No price history found</td></tr>}
                    </tbody>
                </table>
            </div>
            )}

            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">Purchase Invoices › <span className="pi-b-active">New</span></span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={24}/>
                                    <span>Purchase Invoice</span>
                                </div>
                            </div>
                        }
                        onClose={() => setModalOpen(false)}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button className="btn-pi-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                                </div>
                                <div className="pi-footer-right">
                                    <button className="btn-pi-draft">Save as Draft</button>
                                    <button className="btn-pi-create" onClick={handleCreateInvoice}>Create Purchase Invoice</button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/>
                                        <Calendar size={16}/>
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}>
                                        <select value={dueDateType} onChange={e=>setDueDateType(e.target.value)}>
                                            <option value="Net">Net</option><option value="Custom">Custom</option><option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && <div className="pi-days-input"><input type="number" value={netDays} onChange={e=>setNetDays(e.target.value)}/><span>days</span></div>}
                                        {dueDateType === 'Custom' && <div className="pi-date-input-small"><input type="date" value={customDueDate} onChange={e=>setCustomDueDate(e.target.value)}/></div>}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculateDueDate()}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input type="text" placeholder="Vendor inv #"/>
                                </div>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Supplier / Vendor *</label>
                                <select style={{width:'100%',padding:'10px 14px',border:'1px solid #e2e8f0',borderRadius:10,fontSize:'0.9375rem',background:'#f8fafc'}}>
                                    <option>Gulf Lubricants Co.</option>
                                    <option>Al-Jazeera Auto Parts</option>
                                    <option>Saudi Tire Trading</option>
                                </select>
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input type="text" placeholder="Invoice description (optional)"/>
                            </div>

                            <div className="pi-lines-section">
                                <div className="pi-lines-header" style={{ gridTemplateColumns: getGridColumns() }}>
                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">Item</div><div className="pi-col-acc">Account</div>
                                    {showDesc && <div className="pi-col-desc">Description</div>}
                                    <div className="pi-col-uom">UOM</div><div className="pi-col-qty">Qty</div><div className="pi-col-price">Unit price</div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div><div className="pi-col-tax">Tax Code</div><div className="pi-col-tamt">Tax Amt</div><div className="pi-col-total">Total</div>
                                </div>
                                {lineItems.map((line, idx) => (
                                    <div key={line.id} className="pi-lines-header pi-line-data-row" style={{ gridTemplateColumns: getGridColumns() }}>
                                        {showLineNum && <div className="pi-col-hash">{idx + 1}</div>}
                                        <div className="pi-col-item"><input type="text" value={line.item} className="pi-row-input" onChange={e=>updateLineItem(line.id,'item',e.target.value)}/></div>
                                        <div className="pi-col-acc">
                                            <select className="pi-row-input" value={line.account} onChange={e=>updateLineItem(line.id,'account',e.target.value)}>
                                                {PI_ACCOUNT_OPTIONS.map(opt => <option key={opt.code} value={`${opt.code} - ${opt.name}`}>{opt.code} - {opt.name}</option>)}
                                            </select>
                                        </div>
                                        {showDesc && <div className="pi-col-desc"><input type="text" defaultValue={line.description} className="pi-row-input"/></div>}
                                        <div className="pi-col-uom">{line.uom}</div>
                                        <div className="pi-col-qty">
                                            <input type="text" defaultValue={line.qty} key={`qty-${line.id}`} className="pi-row-input-num pi-math-input"
                                                onChange={e=>updateLineItem(line.id,'qty',e.target.value)} onKeyDown={e=>handleMathKeyDown(e,line.id,'qty')} onBlur={e=>handleMathBlur(e,line.id,'qty')}/>
                                        </div>
                                        <div className="pi-col-price">
                                            <input type="text" defaultValue={line.price} key={`price-${line.id}`} className="pi-row-input-num pi-math-input"
                                                onChange={e=>updateLineItem(line.id,'price',e.target.value)} onKeyDown={e=>handleMathKeyDown(e,line.id,'price')} onBlur={e=>handleMathBlur(e,line.id,'price')}/>
                                        </div>
                                        {showDiscount && <div className="pi-col-disc"><input type="number" defaultValue={line.discount} className="pi-row-input-num"/></div>}
                                        <div className="pi-col-total">SAR {(parseFloat(line.qty) * parseFloat(line.price) || 0).toFixed(2)}</div>
                                        <div className="pi-col-tax">
                                            <select className="pi-row-input" value={line.taxCode} onChange={e=>updateLineItem(line.id,'taxCode',e.target.value)}>
                                                {PI_TAXES.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">SAR {line.taxAmt}</div>
                                        <div className="pi-col-total">SAR {line.totalFinal}</div>
                                    </div>
                                ))}
                                <div className="pi-line-row">
                                    <div className="pi-search-box-wrapper" style={{ position: 'relative', flex: 1 }}>
                                        <div className="pi-search-box">
                                            <Search size={16}/>
                                            <input type="text" placeholder="Search product to add" value={searchQuery}
                                                onChange={e=>handleSearch(e.target.value)} onKeyDown={handleKeyDown} onFocus={()=>searchQuery.trim()&&setShowDropdown(true)}/>
                                        </div>
                                        {showDropdown && searchResults.length > 0 && (
                                            <div className="pi-search-results">
                                                {searchResults.map((item, index) => (
                                                    <div key={item.id} className={`pi-result-item ${selectedIndex===index?'selected':''}`}
                                                        onClick={()=>addItemToLines(item)} onMouseEnter={()=>setSelectedIndex(index)}>
                                                        <div className="pi-result-info">
                                                            <div className="pi-item-name">{item.name}</div>
                                                            <div className="pi-item-meta"><span className="pi-item-type">{item.type}</span><span>• {item.unit}</span></div>
                                                        </div>
                                                        <div className="pi-item-price"><div className="pi-price-val">SAR {item.price}</div><div className="pi-price-unit">per {item.unit}</div></div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button className="btn-add-line" onClick={() => searchQuery && handleSearch('')}><Plus size={16}/> Add line</button>
                                </div>
                                <div className="pi-hint"><Zap size={14}/> Tip: Type to search, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 12*5)</div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox"><input type="checkbox" checked={showLineNum} onChange={e=>setShowLineNum(e.target.checked)}/><span>Column — Line number</span></label>
                                <label className="pi-checkbox"><input type="checkbox" checked={showDesc} onChange={e=>setShowDesc(e.target.checked)}/><span>Column — Description</span></label>
                                <label className="pi-checkbox"><input type="checkbox" checked={showDiscount} onChange={e=>setShowDiscount(e.target.checked)}/><span>Column — Discount</span></label>
                                <label className="pi-checkbox"><input type="checkbox"/><span>Amounts are tax inclusive</span></label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline"><label>Freight-in (SAR)</label><input type="text" defaultValue="0"/></div>
                                    <div className="pi-field-inline"><label>Invoice Discount</label><div className="pi-discount-group"><input type="text" defaultValue="0"/><select><option>Fixed (S.. )</option></select></div></div>
                                    <div className="pi-field pi-full-width"><label>Notes</label><textarea placeholder="Internal notes" rows={4}></textarea></div>
                                </div>
                                <div className="pi-footer-column pi-summary-column">
                                    <div className="pi-summary-card">
                                        <div className="pi-summary-row"><span>Subtotal:</span><span>SAR {summary.subtotal}</span></div>
                                        <div className="pi-summary-row"><span>Total Tax (VAT):</span><span>SAR {summary.totalTax}</span></div>
                                        <div className="pi-summary-row pi-grand-total"><span>Grand Total:</span><span>SAR {summary.grandTotal}</span></div>
                                    </div>
                                    <div className="pi-ap-alert"><span>Creates <strong>Accounts Payable</strong>. After goods received, click &quot;Update Stock&quot; in the list.</span></div>
                                    <label className="pi-checkbox pi-price-update"><input type="checkbox" defaultChecked/><span>Update last purchase price for all products on save</span></label>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
