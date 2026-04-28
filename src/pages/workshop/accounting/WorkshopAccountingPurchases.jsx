import React, { useState, useRef } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, Shield, X, Wallet, Landmark, Banknote, Settings, Trash2, Calendar, FileText, ArrowLeftRight, Search, Filter, CreditCard, DollarSign, Book, CheckCircle, Eye, Printer, AlertTriangle, ChevronDown, ShoppingCart, Zap, Users, UserPlus, Clock, Activity, Coins, BookOpen, Save, Percent, Calculator } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import '../../../styles/admin/AccountingPage.css';

const SUB_TABS = [
    { path: 'chart-of-accounts', label: 'Chart of Accounts' },
    { path: 'cash-bank', label: 'Cash & Bank' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'journal-entries', label: 'Journal Entries' },
    { path: 'purchases', label: 'Purchases' },
    { path: 'expenses', label: 'Expenses' },
    { path: 'receipts', label: 'Receipts' },
    { path: 'payments', label: 'Payments' },
    { path: 'advances', label: 'Advances' },
    { path: 'ledger', label: 'Ledger' },
];

const CASH_BANK_TABS = ['All Accounts', 'Cash', 'Bank', 'Petty Cash'];

const COA_TABS = ['Chart of Accounts', 'Trial Balance', 'P&L', 'Balance Sheet'];
const COA_SECTIONS = [
    { key: 'assets', label: 'Assets', labelPlural: 'Assets', balance: 'SAR 0.00', accounts: [{ code: 'AR-EAE767', name: 'Accounts Receivable — Safa Makkah', subtype: 'current asset', normalBal: 'debit', openingBal: 'SAR 0.00', currentBal: 'SAR 0.00', status: 'active', desc: 'Receivable from customer: Safa Makkah' }] },
    { key: 'liabilities', label: 'Liabilitys', labelPlural: 'Liabilitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'equity', label: 'Equitys', labelPlural: 'Equitys', balance: 'SAR 0.00', accounts: [] },
    { key: 'revenue', label: 'Revenues', labelPlural: 'Revenues', balance: 'SAR 0.00', accounts: [] },
    { key: 'expenses', label: 'Expenses', labelPlural: 'Expenses', balance: 'SAR 0.00', accounts: [] },
];


function PurchasesView({ taxes }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);

    // Dynamic Due Date State
    const [issueDate, setIssueDate] = useState('2026-03-08');
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('2026-04-07');

    // [NEW] Line Items State
    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim()) {
            const filtered = INVENTORY_ITEMS.filter(item =>
                item.name.toLowerCase().includes(query.toLowerCase())
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
        setLineItems(prev => prev.map(line => {
            if (line.id === id) {
                const updatedLine = { ...line, [field]: value };

                // Recalculate if qty, price, or taxCode changed
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
            }
            return line;
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
            totalFinal: (item.price * 1.15).toFixed(2)
        };
        setLineItems(prev => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;

        if (e.key === 'ArrowDown') {
            setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str) return '';
        // Only allow safe characters: digits, decimal, operators, spaces, parentheses
        if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(str)) return str;
        // If it's a plain number, return as-is
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            // eslint-disable-next-line no-new-func
            const result = Function('return (' + str + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return parseFloat(result.toFixed(6)).toString();
            }
        } catch {
            // invalid expression — return as-is
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
        if (evaluated !== e.target.value) {
            updateLineItem(lineId, field, evaluated);
        }
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';

        let due = new Date(issue);

        if (dueDateType === 'Net') {
            due.setDate(issue.getDate() + parseInt(netDays || 0));
        } else if (dueDateType === 'Custom') {
            return customDueDate;
        } else if (dueDateType === 'EOM') {
            // End of Month: Last day of the current month
            due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        }

        const year = due.getFullYear();
        const month = String(due.getMonth() + 1).padStart(2, '0');
        const day = String(due.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        let cols = [];
        if (showLineNum) cols.push("40px");
        cols.push("2fr", "1.5fr"); // Item, Account
        if (showDesc) cols.push("2fr");
        cols.push("0.8fr", "0.8fr", "1fr"); // UOM, Qty, Price
        if (showDiscount) cols.push("1fr");
        cols.push("1fr", "1fr", "1fr", "1fr"); // Total(pre), TaxCode, TaxAmt, Total(final)
        return cols.join(" ");
    };

    return (
        <div className="purchases-view">
            <header className="purchases-header-row">
                <div className="pi-header-left">
                    <h2 className="cash-bank-title">Purchases</h2>
                    <p className="cash-bank-desc">Track purchase orders and bills.</p>
                </div>
                <button className="btn-save-all" onClick={() => setModalOpen(true)}>
                    <Plus size={18} /> New Purchase Invoice
                </button>
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
                        <tr><td colSpan={6} className="table-cell table-empty">No purchase invoices found.</td></tr>
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">Purchase Invoices › <span className="pi-b-active">New</span></span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={24} />
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
                                    <button className="btn-pi-create" onClick={() => setModalOpen(false)}>Create Purchase Invoice</button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
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
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input
                                                    type="date"
                                                    value={customDueDate}
                                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input type="text" placeholder="Vendor inv #" />
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Supplier / Vendor *</label>
                                <input type="text" placeholder="Type or select vendor" />
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input type="text" placeholder="Invoice description (optional)" />
                            </div>

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
                                                autoFocus={idx === lineItems.length - 1}
                                            />
                                        </div>
                                        <div className="pi-col-acc">
                                            <select
                                                className="pi-row-input"
                                                value={line.account}
                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                            >
                                                {ACCOUNT_OPTIONS.map(opt => (
                                                    <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                        {opt.code} - {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {showDesc && <div className="pi-col-desc"><input type="text" defaultValue={line.description} className="pi-row-input" /></div>}
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
                                        {showDiscount && <div className="pi-col-disc"><input type="number" defaultValue={line.discount} className="pi-row-input-num" /></div>}
                                        <div className="pi-col-total">SAR {(parseFloat(line.qty) * parseFloat(line.price) || 0).toFixed(2)}</div>
                                        <div className="pi-col-tax">
                                            <select
                                                className="pi-row-input"
                                                value={line.taxCode}
                                                onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}
                                            >
                                                {taxes.map(t => (
                                                    <option key={t.code} value={t.code}>{t.code}</option>
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
                                    <button className="btn-add-line" onClick={() => (searchQuery ? handleSearch('') : null)}><Plus size={16} /> Add line</button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: Type to search, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 12*5)
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
                                        <textarea placeholder="Internal notes" rows={4}></textarea>
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
                                        <span>Creates <strong>Accounts Payable</strong>. After goods received, click "Update Stock" in the list.</span>
                                    </div>

                                    <label className="pi-checkbox pi-price-update">
                                        <input type="checkbox" defaultChecked />
                                        <span>Update last purchase price for all products on save</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

export default PurchasesView;
