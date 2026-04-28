import React, { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Plus, ChevronDown, Calendar, Search, Lightbulb, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import SalesReports from './SalesReports';
import SalesOrders from './SalesOrders';
import '../../styles/admin/SalesPage.css';

const SUB_TABS = [
    { path: 'sales-reports', label: 'Sales Reports' },
    { path: 'sales-orders', label: 'Sales Orders' },
    { path: 'workshop-sales', label: 'Workshop Sales' },
    { path: 'suppliers-warehouse-sales', label: 'Suppliers & Warehouse Sales' },
    { path: 'receipts', label: 'Receipts' },
];

const MOCK_INVOICES = [
    { id: 1, invNo: 'INV-82453822', dateTime: '28/02/2026 00:00', workshop: 'Petromin Services', customer: 'Safa Makkah', vehicle: 'ZSA-8030', items: 'Castrol 10W30, Car Wash Normal…', total: 'SAR 128.51', status: 'paid' },
];

const MOCK_WAREHOUSE_SALES = [
    { id: 1, ref: 'WH-001', date: '28/02/2026', supplier: 'Gulf Oil', warehouse: 'Main', total: 'SAR 5,200.00', status: 'Completed' },
];

const EMPTY_INVOICE = {
    invNo: 'INV-' + Math.floor(Math.random() * 100000000),
    invDate: new Date().toISOString().split('T')[0],
    dueDateType: 'Net',
    dueDateValue: '30',
    branch: 'Select branch',
    customer: 'Select customer',
    customerMobile: '',
    vehiclePlate: '',
    paymentMethod: 'Cash',
    paymentStatus: 'Unpaid',
    lineItems: [
        { id: 1, item: '', uom: 'pcs', qty: 1, unitPrice: 0, total: 0, taxCode: '15%', taxAmt: 0, grandTotal: 0, lastSalePrice: 0 }
    ],
    freightCharges: 0,
    discountValue: 0,
    discountType: 'Fixed (S..',
    notes: '',
    showLineNo: false,
    showDesc: false,
    showDiscount: false,
    isTaxInclusive: false
};

export default function SalesPage() {
    const { subTab } = useParams();
    const activeSub = subTab || 'sales-reports';
    const [invoices, setInvoices] = useState(MOCK_INVOICES);
    const [warehouseSales] = useState(MOCK_WAREHOUSE_SALES);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [invoiceData, setInvoiceData] = useState(EMPTY_INVOICE);

    const totalIssued = invoices.reduce((s, i) => s + parseFloat((i.total || '0').replace(/[^0-9.]/g, '')) || 0, 0);
    const totalCollected = totalIssued;
    const outstanding = 0;

    // Calculation logic
    const calculateTotals = () => {
        let subtotal = 0;
        let totalTax = 0;

        const updatedItems = invoiceData.lineItems.map(item => {
            const rowTotal = item.qty * item.unitPrice;
            const rowTax = rowTotal * 0.15; // Assuming 15% VAT for demo
            subtotal += rowTotal;
            totalTax += rowTax;
            return { ...item, total: rowTotal, taxAmt: rowTax, grandTotal: rowTotal + rowTax };
        });

        const grandTotal = subtotal + totalTax + parseFloat(invoiceData.freightCharges || 0) - parseFloat(invoiceData.discountValue || 0);

        return { subtotal, totalTax, grandTotal };
    };

    const totals = calculateTotals();

    const addLine = () => {
        setInvoiceData({
            ...invoiceData,
            lineItems: [...invoiceData.lineItems, { id: Date.now(), item: '', uom: 'pcs', qty: 1, unitPrice: 0, total: 0, taxCode: '15%', taxAmt: 0, grandTotal: 0, lastSalePrice: 0 }]
        });
    };

    const updateItem = (id, field, value) => {
        setInvoiceData({
            ...invoiceData,
            lineItems: invoiceData.lineItems.map(item => item.id === id ? { ...item, [field]: value } : item)
        });
    };

    const removeItem = (id) => {
        if (invoiceData.lineItems.length > 1) {
            setInvoiceData({
                ...invoiceData,
                lineItems: invoiceData.lineItems.filter(item => item.id !== id)
            });
        }
    };

    const handleCreateInvoice = () => {
        // demo functionality
        setIsModalOpen(false);
        setInvoiceData(EMPTY_INVOICE);
    };

    const InvoiceModalContent = () => (
        <div className="invoice-form-container">
            {/* Header Row 1 */}
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">Invoice Number</label>
                    <input type="text" className="form-input-inv" value={invoiceData.invNo} readOnly style={{ borderColor: '#FFD700', backgroundColor: '#FBFBFE' }} />
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Invoice Date</label>
                    <div className="input-with-icon">
                        <input type="date" className="form-input-inv" value={invoiceData.invDate} onChange={(e) => setInvoiceData({ ...invoiceData, invDate: e.target.value })} />
                        <Calendar size={16} className="input-icon-right" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Due Date</label>
                    <div className="due-date-row">
                        <div className="select-wrapper-inv" style={{ width: '80px' }}>
                            <select className="form-input-inv" value={invoiceData.dueDateType} onChange={(e) => setInvoiceData({ ...invoiceData, dueDateType: e.target.value })}>
                                <option>Net</option>
                                <option>Fixed</option>
                            </select>
                            <ChevronDown size={14} className="select-icon-inv" />
                        </div>
                        <input type="text" className="form-input-inv" style={{ width: '60px' }} value={invoiceData.dueDateValue} onChange={(e) => setInvoiceData({ ...invoiceData, dueDateValue: e.target.value })} />
                        <span className="unit-label">days</span>
                    </div>
                    <span className="due-date-hint">Due: 2026-04-05</span>
                </div>
            </div>

            {/* Header Row 2 */}
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">Workshop Branch *</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.branch} onChange={(e) => setInvoiceData({ ...invoiceData, branch: e.target.value })}>
                            <option>Select branch</option>
                            <option>Petromin Services</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Customer</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.customer} onChange={(e) => setInvoiceData({ ...invoiceData, customer: e.target.value })}>
                            <option>Select customer</option>
                            <option>Safa Makkah</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Customer Mobile</label>
                    <input type="text" className="form-input-inv" placeholder="05XXXXXXXX" value={invoiceData.customerMobile} onChange={(e) => setInvoiceData({ ...invoiceData, customerMobile: e.target.value })} />
                </div>
            </div>

            {/* Header Row 3 */}
            <div className="form-grid-three">
                <div className="form-group">
                    <label className="form-label-inv">Vehicle Plate</label>
                    <input type="text" className="form-input-inv" placeholder="ABC 1234" value={invoiceData.vehiclePlate} onChange={(e) => setInvoiceData({ ...invoiceData, vehiclePlate: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Payment Method</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.paymentMethod} onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })}>
                            <option>Cash</option>
                            <option>Bank Card</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label-inv">Payment Status</label>
                    <div className="select-wrapper-inv">
                        <select className="form-input-inv" value={invoiceData.paymentStatus} onChange={(e) => setInvoiceData({ ...invoiceData, paymentStatus: e.target.value })}>
                            <option>Unpaid</option>
                            <option>Paid</option>
                        </select>
                        <ChevronDown size={14} className="select-icon-inv" />
                    </div>
                </div>
            </div>

            <div className="line-items-label">Line Items (Services & Products)</div>

            <div className="line-items-table-wrapper">
                <table className="line-items-table">
                    <thead>
                        <tr>
                            <th style={{ width: '25%' }}>Item</th>
                            <th>UOM</th>
                            <th>Qty</th>
                            <th>Unit price</th>
                            <th>Total</th>
                            <th>Tax Code</th>
                            <th>Tax Amt</th>
                            <th>Grand Total</th>
                            <th>Last Sale Price</th>
                            <th style={{ width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoiceData.lineItems.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <div className="item-search-box">
                                        <Search size={14} className="search-inline-icon" />
                                        <input type="text" className="table-input" placeholder="Search product to add" value={item.item} onChange={(e) => updateItem(item.id, 'item', e.target.value)} />
                                    </div>
                                </td>
                                <td><input type="text" className="table-input" value={item.uom} onChange={(e) => updateItem(item.id, 'uom', e.target.value)} /></td>
                                <td><input type="number" className="table-input" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} /></td>
                                <td><input type="number" className="table-input" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} /></td>
                                <td className="font-mono-inv">{item.total.toFixed(2)}</td>
                                <td>
                                    <div className="select-wrapper-inv">
                                        <select className="table-input" value={item.taxCode} onChange={(e) => updateItem(item.id, 'taxCode', e.target.value)}>
                                            <option>15%</option>
                                            <option>0%</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="font-mono-inv">{item.taxAmt.toFixed(2)}</td>
                                <td className="font-mono-inv">{item.grandTotal.toFixed(2)}</td>
                                <td className="last-sale-price-cell">{item.lastSalePrice.toFixed(2)}</td>
                                <td>
                                    <button type="button" className="btn-delete-row" onClick={() => removeItem(item.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="table-actions-row">
                    <button type="button" className="btn-add-line" onClick={addLine}>+ Add line</button>
                </div>
            </div>

            <div className="tip-box">
                <Lightbulb size={14} className="tip-icon" />
                <span>Tip: Type to search, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 120*2)</span>
            </div>

            <div className="options-row">
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showLineNo} onChange={(e) => setInvoiceData({ ...invoiceData, showLineNo: e.target.checked })} />
                    <span>Column — Line number</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showDesc} onChange={(e) => setInvoiceData({ ...invoiceData, showDesc: e.target.checked })} />
                    <span>Column — Description</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.showDiscount} onChange={(e) => setInvoiceData({ ...invoiceData, showDiscount: e.target.checked })} />
                    <span>Column — Discount</span>
                </label>
                <label className="checkbox-item">
                    <input type="checkbox" checked={invoiceData.isTaxInclusive} onChange={(e) => setInvoiceData({ ...invoiceData, isTaxInclusive: e.target.checked })} />
                    <span>Amounts are tax inclusive</span>
                </label>
            </div>

            <div className="invoice-footer-grid">
                <div className="footer-left">
                    <div className="form-group-horiz">
                        <label>Freight / Other Charges (SAR)</label>
                        <input type="number" className="form-input-inv small-input" value={invoiceData.freightCharges} onChange={(e) => setInvoiceData({ ...invoiceData, freightCharges: e.target.value })} />
                    </div>
                    <div className="form-group-horiz mt-20">
                        <label>Invoice Discount:</label>
                        <div className="discount-group">
                            <input type="number" className="form-input-inv small-input" value={invoiceData.discountValue} onChange={(e) => setInvoiceData({ ...invoiceData, discountValue: e.target.value })} />
                            <div className="select-wrapper-inv" style={{ width: '100px' }}>
                                <select className="form-input-inv" value={invoiceData.discountType} onChange={(e) => setInvoiceData({ ...invoiceData, discountType: e.target.value })}>
                                    <option>Fixed (S..</option>
                                    <option>Percentage</option>
                                </select>
                                <ChevronDown size={14} className="select-icon-inv" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="footer-right">
                    <div className="summary-card">
                        <div className="summary-row">
                            <span>Subtotal:</span>
                            <span>SAR {totals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Total Tax (VAT):</span>
                            <span>SAR {totals.totalTax.toFixed(2)}</span>
                        </div>
                        <div className="summary-row grand-total-row">
                            <span>Grand Total:</span>
                            <span className="grand-total-val">SAR {totals.grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="notes-section">
                <label className="form-label-inv">Notes</label>
                <textarea className="form-input-inv notes-area" placeholder="Internal notes" value={invoiceData.notes} onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })} />
            </div>
        </div>
    );

    return (
        <div className="sales-page module-container">
            <div className="sales-sub-nav">
                {SUB_TABS.map((t) => (
                    <NavLink key={t.path} to={`/admin/sales/${t.path}`} className={({ isActive }) => `sales-sub-tab ${isActive ? 'active' : ''}`}>
                        {t.label}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'workshop-sales' && (
                <>
                    <header className="sales-invoices-header">
                        <div>
                            <h1 className="sales-invoices-title">Workshop Sales</h1>
                            <p className="sales-invoices-count">{invoices.length} of {invoices.length} invoices across all workshops (POS)</p>
                        </div>
                        <button type="button" className="btn-portal" onClick={() => setIsModalOpen(true)}><Plus size={16} /> New Invoice</button>
                    </header>
                    <div className="sales-invoices-stats">
                        <div className="sales-stat-card"><span className="sales-stat-label">Total Issued</span><span className="sales-stat-val">SAR {totalIssued.toFixed(3)}</span></div>
                        <div className="sales-stat-card"><span className="sales-stat-label">Total Collected</span><span className="sales-stat-val">SAR {totalCollected.toFixed(3)}</span></div>
                        <div className="sales-stat-card"><span className="sales-stat-label">Outstanding</span><span className="sales-stat-val">SAR {outstanding.toFixed(2)}</span></div>
                    </div>
                    <div className="sales-invoices-filters">
                        <button type="button" className="sales-filter-pill active">All Workshops</button>
                        <button type="button" className="sales-filter-pill">All Status</button>
                        <button type="button" className="sales-filter-pill">More Filters</button>
                    </div>
                    <section className="premium-table sales-invoices-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Invoice #</th>
                                    <th className="table-th">Date & Time</th>
                                    <th className="table-th">Workshop</th>
                                    <th className="table-th">Customer</th>
                                    <th className="table-th">Vehicle</th>
                                    <th className="table-th">Items</th>
                                    <th className="table-th">Total</th>
                                    <th className="table-th">Status</th>
                                    <th className="table-th">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="table-row">
                                        <td className="table-cell cell-main-text">{inv.invNo}</td>
                                        <td className="table-cell">{inv.dateTime}</td>
                                        <td className="table-cell">{inv.workshop}</td>
                                        <td className="table-cell">{inv.customer}</td>
                                        <td className="table-cell">{inv.vehicle}</td>
                                        <td className="table-cell">{inv.items}</td>
                                        <td className="table-cell">{inv.total}</td>
                                        <td className="table-cell"><span className="status-badge status-completed">{inv.status}</span></td>
                                        <td className="table-cell"><button type="button" className="btn-edit">View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <p className="sales-showing">Showing {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
                </>
            )}

            {activeSub === 'suppliers-warehouse-sales' && (
                <>
                    <header className="sales-invoices-header">
                        <div>
                            <h1 className="sales-invoices-title">Suppliers & Warehouse Sales</h1>
                            <p className="sales-invoices-count">Supplier and warehouse sales orders</p>
                        </div>
                        <button type="button" className="btn-portal"><Plus size={16} /> New Sale</button>
                    </header>
                    <div className="sales-invoices-filters">
                        <button type="button" className="sales-filter-pill active">All</button>
                        <button type="button" className="sales-filter-pill">Pending</button>
                        <button type="button" className="sales-filter-pill">Completed</button>
                    </div>
                    <section className="premium-table sales-invoices-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Reference</th>
                                    <th className="table-th">Date</th>
                                    <th className="table-th">Supplier</th>
                                    <th className="table-th">Warehouse</th>
                                    <th className="table-th">Total</th>
                                    <th className="table-th">Status</th>
                                    <th className="table-th">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {warehouseSales.map((row) => (
                                    <tr key={row.id} className="table-row">
                                        <td className="table-cell cell-main-text">{row.ref}</td>
                                        <td className="table-cell">{row.date}</td>
                                        <td className="table-cell">{row.supplier}</td>
                                        <td className="table-cell">{row.warehouse}</td>
                                        <td className="table-cell">{row.total}</td>
                                        <td className="table-cell"><span className="status-badge status-completed">{row.status}</span></td>
                                        <td className="table-cell"><button type="button" className="btn-edit">View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </>
            )}

            {activeSub === 'receipts' && (
                <>
                    <header className="sales-invoices-header">
                        <div>
                            <h1 className="sales-invoices-title">Receipts</h1>
                            <p className="sales-invoices-count">Payment receipts and records</p>
                        </div>
                        <button type="button" className="btn-portal"><Plus size={16} /> New Receipt</button>
                    </header>
                    <div className="sales-empty">
                        <p>No receipts found. Create a receipt from a sale or payment.</p>
                    </div>
                </>
            )}

            {activeSub === 'sales-reports' && <SalesReports />}
            {activeSub === 'sales-orders' && <SalesOrders />}

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title="New Sales Invoice"
                        onClose={() => setIsModalOpen(false)}
                        className="invoice-modal-mega"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit-inv" onClick={handleCreateInvoice}>Create Invoice</button>
                            </div>
                        }
                    >
                        <InvoiceModalContent />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
