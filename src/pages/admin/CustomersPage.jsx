import { useMemo, useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Search, Plus, Users, Building, Pencil, FileText, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/CustomersPage.css';
import { getCustomerDetails, getCustomers } from '../../services/superAdminApi';

const SUB_TABS = [
    { path: 'all-customers', label: 'All Customers' },
    { path: 'corporate-billing', label: 'Corporate Billing' },
];

export default function CustomersPage() {
    const { subTab } = useParams();
    const activeSub = subTab || 'all-customers';
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsData, setDetailsData] = useState(null);

    useEffect(() => {
        setLoading(true);
        getCustomers({ customerType: typeFilter === 'all' ? undefined : typeFilter })
            .then((d) => {
                const rows = (Array.isArray(d) ? d : (d?.customers ?? [])).map((c) => ({
                    id: String(c.id ?? c._id ?? ''),
                    workshopId: c.workshopId != null ? String(c.workshopId) : '',
                    workshopName: c.workshopName ?? '—',
                    name: c.name ?? c.companyName ?? '—',
                    mobile: c.mobile ?? '—',
                    whatsapp: c.whatsapp ?? '—',
                    taxId: c.taxId ?? '-',
                    customerType: c.customerType === 'corporate' ? 'corporate' : 'regular',
                    isActive: c.isActive !== false,
                    vehiclesCount: Number(c.vehiclesCount ?? 0),
                    salesOrdersCount: Number(c.salesOrdersCount ?? 0),
                    orderStats: {
                        totalOrders: Number(c.orderStats?.totalOrders ?? 0),
                        completedOrders: Number(c.orderStats?.completedOrders ?? 0),
                        draftOrders: Number(c.orderStats?.draftOrders ?? 0),
                    },
                    corporateAccount: c.corporateAccount ?? null,
                }));
                setCustomers(rows);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [typeFilter]);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [billingTab, setBillingTab] = useState('All');

    const corporateCount = customers.filter((c) => c.customerType === 'corporate').length;
    const walkInCount = customers.filter((c) => c.customerType === 'regular').length;
    const filteredCustomers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return customers;
        return customers.filter((c) =>
            [c.name, c.mobile, c.whatsapp, c.taxId, c.workshopName]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q)));
    }, [customers, search]);
    const corporateRows = useMemo(
        () => customers.filter((c) => c.customerType === 'corporate' || !!c.corporateAccount),
        [customers],
    );
    const billingRows = useMemo(() => {
        if (billingTab === 'All') return corporateRows;
        return corporateRows.filter((c) => {
            const status = String(c.corporateAccount?.status ?? '').toLowerCase();
            if (billingTab === 'Pending') return status === 'pending';
            if (billingTab === 'Partial Paid') return status === 'partial_paid' || status === 'partial paid';
            if (billingTab === 'Overdue') return status === 'overdue';
            return true;
        });
    }, [corporateRows, billingTab]);
    const billingOutstanding = useMemo(
        () => corporateRows.reduce((sum, c) => sum + Number(c.corporateAccount?.dueBalance ?? 0), 0),
        [corporateRows],
    );
    const overdueCount = useMemo(
        () => corporateRows.filter((c) => String(c.corporateAccount?.status ?? '').toLowerCase() === 'overdue').length,
        [corporateRows],
    );

    const openEdit = (c) => {
        setEditingCustomer({ ...c });
        setEditOpen(true);
    };
    const openDetails = async (customerId) => {
        if (!customerId) return;
        setDetailsOpen(true);
        setDetailsLoading(true);
        setDetailsData(null);
        try {
            const d = await getCustomerDetails(String(customerId));
            setDetailsData(d?.data && typeof d.data === 'object' ? d.data : d);
        } catch {
            setDetailsData(null);
        } finally {
            setDetailsLoading(false);
        }
    };
    const handleSaveNew = () => {
        setCustomers((prev) => [...prev, { id: Date.now(), name: '', type: 'Walk-in', mobile: '', email: '', vat: '-', balance: 'SAR 0.00', status: 'Active' }]);
        setCreateOpen(false);
    };
    const handleSaveEdit = () => {
        if (!editingCustomer) return;
        setSaving(true);
        setCustomers((prev) => prev.map((c) => (c.id === editingCustomer.id ? { ...editingCustomer } : c)));
        setEditOpen(false);
        setEditingCustomer(null);
        setSaving(false);
    };

    return (
        <div className="customers-page module-container">
            <div className="customers-sub-nav">
                {SUB_TABS.map((t) => (
                    <NavLink key={t.path} to={`/admin/customers/${t.path}`} className={({ isActive }) => `customers-sub-tab ${isActive ? 'active' : ''}`}>
                        {t.label}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'all-customers' && (
            <>
            <div className="stats-mini-grid">
                <div className="stat-mini-card">
                    <Users size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Total Customers</p>
                        <h4 className="mini-val">{customers.length}</h4>
                    </div>
                </div>
                <div className="stat-mini-card">
                    <Building size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Corporate</p>
                        <h4 className="mini-val">{corporateCount}</h4>
                    </div>
                </div>
                <div className="stat-mini-card">
                    <Users size={20} color="var(--color-primary)" />
                    <div>
                        <p className="mini-label">Walk-in</p>
                        <h4 className="mini-val">{walkInCount}</h4>
                    </div>
                </div>
            </div>

            <div className="module-header-actions">
                <div className="search-bar-mini">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search customers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="billing-tabs" style={{ margin: 0 }}>
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'regular', label: 'Walk-in' },
                        { id: 'corporate', label: 'Corporate' },
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={`billing-tab ${typeFilter === t.id ? 'active' : ''}`}
                            onClick={() => setTypeFilter(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <button type="button" className="btn-portal" onClick={() => setCreateOpen(true)}><Plus size={16} /> ADD CUSTOMER</button>
            </div>

            <section className="premium-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">CUSTOMER</th>
                            <th className="table-th">TYPE</th>
                            <th className="table-th">MOBILE</th>
                            <th className="table-th">WORKSHOP</th>
                            <th className="table-th">ORDER STATS</th>
                            <th className="table-th">CORPORATE</th>
                            <th className="table-th">STATUS</th>
                            <th className="table-th">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : filteredCustomers.map((c) => (
                            <tr key={c.id} className="table-row">
                                <td className="table-cell">
                                    <div className="cell-main-text">{c.name}</div>
                                    <div className="cell-sub-text">{c.customerType === 'corporate' ? 'Business Account' : 'Walk-in'}</div>
                                </td>
                                <td className="table-cell">
                                    <span className={`type-badge ${c.customerType === 'corporate' ? 'corporate' : 'walk-in'}`}>
                                        {c.customerType === 'corporate' ? 'Corporate' : 'Walk-in'}
                                    </span>
                                </td>
                                <td className="table-cell">{c.mobile}</td>
                                <td className="table-cell">{c.workshopName}</td>
                                <td className="table-cell">
                                    <div className="cell-sub-text">Total: {c.orderStats.totalOrders}</div>
                                    <div className="cell-sub-text">Completed: {c.orderStats.completedOrders} | Draft: {c.orderStats.draftOrders}</div>
                                </td>
                                <td className="table-cell">
                                    {c.corporateAccount ? (
                                        <span className="type-badge corporate">{c.corporateAccount.companyName ?? 'Corporate'}</span>
                                    ) : (
                                        <span className="cell-sub-text">—</span>
                                    )}
                                </td>
                                <td className="table-cell">
                                    <span className={`status-badge ${c.isActive ? 'status-completed' : 'status-warning'}`}>
                                        {c.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit" onClick={() => openDetails(c.id)}><FileText size={14} /> Details</button>
                                    <button type="button" className="btn-edit" onClick={() => openEdit(c)} style={{ marginLeft: 8 }}><Pencil size={14} /> Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            </>
            )}

            {activeSub === 'corporate-billing' && (
                <>
                    <header className="corporate-billing-header">
                        <div>
                            <h1 className="corporate-billing-title">Corporate Billing</h1>
                            <p className="corporate-billing-subtitle">Manage monthly bills and payments</p>
                        </div>
                        <button type="button" className="btn-portal"><FileText size={16} /> Generate Bills</button>
                    </header>
                    <div className="billing-stats">
                        <div className="billing-stat-card"><span className="billing-stat-label">Total Billed</span><span className="billing-stat-val">Pending API</span></div>
                        <div className="billing-stat-card"><span className="billing-stat-label">Total Received</span><span className="billing-stat-val">Pending API</span></div>
                        <div className="billing-stat-card"><span className="billing-stat-label">Outstanding</span><span className="billing-stat-val">SAR {billingOutstanding.toFixed(2)}</span></div>
                        <div className="billing-stat-card"><span className="billing-stat-label">Overdue Bills</span><span className="billing-stat-val">{overdueCount}</span></div>
                    </div>
                    <div className="billing-tabs">
                        {['All', 'Pending', 'Partial Paid', 'Overdue'].map((t) => (
                            <button key={t} type="button" className={`billing-tab ${billingTab === t ? 'active' : ''}`} onClick={() => setBillingTab(t)}>{t}</button>
                        ))}
                    </div>
                    <div className="billing-empty" style={{ padding: '16px 20px', textAlign: 'left' }}>
                        Billing-specific endpoints (`/super-admin/corporate-billing/*`) pending. Using `/customers` + `/customers/:id/details` for now.
                    </div>
                    <section className="premium-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">COMPANY</th>
                                    <th className="table-th">CONTACT</th>
                                    <th className="table-th">CREDIT LIMIT</th>
                                    <th className="table-th">DUE BALANCE</th>
                                    <th className="table-th">STATUS</th>
                                    <th className="table-th">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                                ) : billingRows.length === 0 ? (
                                    <tr><td colSpan={6} className="table-cell table-empty">No corporate accounts.</td></tr>
                                ) : billingRows.map((c) => (
                                    <tr key={`bill-${c.id}`} className="table-row">
                                        <td className="table-cell">
                                            <div className="cell-main-text">{c.corporateAccount?.companyName ?? c.name}</div>
                                            <div className="cell-sub-text">{c.workshopName}</div>
                                        </td>
                                        <td className="table-cell">
                                            <div className="cell-main-text">{c.corporateAccount?.contactPerson ?? c.name}</div>
                                            <div className="cell-sub-text">{c.mobile}</div>
                                        </td>
                                        <td className="table-cell font-bold">SAR {Number(c.corporateAccount?.creditLimit ?? 0).toFixed(2)}</td>
                                        <td className="table-cell font-bold">SAR {Number(c.corporateAccount?.dueBalance ?? 0).toFixed(2)}</td>
                                        <td className="table-cell">
                                            <span className="status-badge status-warning">
                                                {String(c.corporateAccount?.status ?? 'unknown')}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <button type="button" className="btn-edit" onClick={() => openDetails(c.id)}><FileText size={14} /> View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </>
            )}

            <AnimatePresence>
                {createOpen && (
                    <Modal
                        title="Add Customer"
                        onClose={() => setCreateOpen(false)}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveNew}>Create Customer</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Customer Name</label>
                            <input type="text" className="form-input-field" placeholder="Full name or company" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-input-field"><option value="Walk-in">Walk-in</option><option value="Corporate">Corporate</option></select>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Mobile</label>
                                <input type="text" className="form-input-field" placeholder="+966..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input-field" placeholder="email@example.com" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">VAT Number</label>
                            <input type="text" className="form-input-field" placeholder="Optional for Walk-in" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-input-field"><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
                        </div>
                    </Modal>
                )}

                {editOpen && editingCustomer && (
                    <Modal
                        title="Edit Customer"
                        onClose={() => { setEditOpen(false); setEditingCustomer(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setEditOpen(false); setEditingCustomer(null); }}>Cancel</button>
                                <button type="button" className="btn-submit" onClick={handleSaveEdit} disabled={saving}>{saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Save Changes'}</button>
                            </>
                        }
                    >
                        <div className="form-group">
                            <label className="form-label">Customer Name</label>
                            <input type="text" className="form-input-field" value={editingCustomer.name} onChange={(e) => setEditingCustomer((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-input-field" value={editingCustomer.type} onChange={(e) => setEditingCustomer((p) => ({ ...p, type: e.target.value }))}>
                                <option value="Walk-in">Walk-in</option><option value="Corporate">Corporate</option>
                            </select>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Mobile</label>
                                <input type="text" className="form-input-field" value={editingCustomer.mobile} onChange={(e) => setEditingCustomer((p) => ({ ...p, mobile: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input-field" value={editingCustomer.email} onChange={(e) => setEditingCustomer((p) => ({ ...p, email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">VAT Number</label>
                            <input type="text" className="form-input-field" value={editingCustomer.vat} onChange={(e) => setEditingCustomer((p) => ({ ...p, vat: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-input-field" value={editingCustomer.status} onChange={(e) => setEditingCustomer((p) => ({ ...p, status: e.target.value }))}>
                                <option value="Active">Active</option><option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}

                {detailsOpen && (
                    <Modal
                        title="Customer Details"
                        onClose={() => { setDetailsOpen(false); setDetailsData(null); }}
                    >
                        {detailsLoading ? (
                            <div className="table-empty"><Loader size={18} className="spin" /> Loading details…</div>
                        ) : detailsData ? (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Customer</label>
                                    <div className="cell-main-text">{detailsData.name ?? detailsData.customer?.name ?? '—'}</div>
                                    <div className="cell-sub-text">{detailsData.mobile ?? detailsData.customer?.mobile ?? '—'}</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <div className="cell-main-text">{(detailsData.customerType ?? detailsData.customer?.customerType ?? 'regular') === 'corporate' ? 'Corporate' : 'Walk-in'}</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vehicles / Orders</label>
                                    <div className="cell-main-text">
                                        Vehicles: {Array.isArray(detailsData.vehicles) ? detailsData.vehicles.length : (detailsData.vehiclesCount ?? 0)}
                                    </div>
                                    <div className="cell-sub-text">
                                        Sales Orders: {Array.isArray(detailsData.salesOrders) ? detailsData.salesOrders.length : (detailsData.salesOrdersCount ?? 0)}
                                    </div>
                                </div>
                                {Array.isArray(detailsData.salesOrders) && detailsData.salesOrders.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Latest Orders</label>
                                        {detailsData.salesOrders.slice(0, 5).map((o, idx) => (
                                            <div key={String(o.id ?? o.orderNumber ?? idx)} className="cell-sub-text" style={{ marginBottom: 6 }}>
                                                {String(o.status ?? 'unknown')} | {String(o.source ?? '—')} | Invoice: {o.invoice?.invoiceNumber ?? '—'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {detailsData.corporateAccount && (
                                    <div className="form-group">
                                        <label className="form-label">Corporate Account</label>
                                        <div className="cell-main-text">{detailsData.corporateAccount.companyName ?? '—'}</div>
                                        <div className="cell-sub-text">
                                            Credit: SAR {Number(detailsData.corporateAccount.creditLimit ?? 0).toFixed(2)} | Due: SAR {Number(detailsData.corporateAccount.dueBalance ?? 0).toFixed(2)}
                                        </div>
                                    </div>
                                )}
                                {Array.isArray(detailsData.corporateAccount?.corporateOrders) && detailsData.corporateAccount.corporateOrders.length > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">Corporate Orders</label>
                                        {detailsData.corporateAccount.corporateOrders.slice(0, 5).map((co, idx) => (
                                            <div key={String(co.id ?? idx)} className="cell-sub-text" style={{ marginBottom: 6 }}>
                                                {co.status ?? '—'} | Linked SOs: {Array.isArray(co.linkedSalesOrders) ? co.linkedSalesOrders.length : 0}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="table-empty">No details found.</div>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
