import { useState, useEffect } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { Search, Plus, Users, Building, Pencil, FileText, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/CustomersPage.css';
import { getCustomers } from '../../services/superAdminApi';

const SUB_TABS = [
    { path: 'all-customers', label: 'All Customers' },
    { path: 'corporate-billing', label: 'Corporate Billing' },
];

export default function CustomersPage() {
    const { subTab } = useParams();
    const activeSub = subTab || 'all-customers';
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCustomers({})
            .then((d) => setCustomers((Array.isArray(d) ? d : (d?.customers ?? [])).map((c) => ({
                id: c.id ?? c._id,
                name: c.name ?? c.companyName ?? '—',
                type: c.type ?? (c.isCorporate ? 'Corporate' : 'Walk-in'),
                mobile: c.mobile ?? c.phone ?? '—',
                email: c.email ?? '—',
                vat: c.vatNumber ?? c.vatId ?? '-',
                balance: c.balance != null ? `SAR ${c.balance}` : 'SAR 0.00',
                status: c.isActive === false ? 'Inactive' : 'Active',
            }))))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [billingTab, setBillingTab] = useState('All');

    const corporateCount = customers.filter((c) => c.type === 'Corporate').length;
    const walkInCount = customers.filter((c) => c.type === 'Walk-in').length;

    const openEdit = (c) => {
        setEditingCustomer({ ...c });
        setEditOpen(true);
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
                    <input type="text" placeholder="Search customers..." />
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
                            <th className="table-th">EMAIL</th>
                            <th className="table-th">VAT NUMBER</th>
                            <th className="table-th">OUTSTANDING</th>
                            <th className="table-th">STATUS</th>
                            <th className="table-th">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : customers.map((c) => (
                            <tr key={c.id} className="table-row">
                                <td className="table-cell">
                                    <div className="cell-main-text">{c.name}</div>
                                    <div className="cell-sub-text">{c.type === 'Corporate' ? 'Business Account' : 'Retail Client'}</div>
                                </td>
                                <td className="table-cell">
                                    <span className={`type-badge ${c.type.toLowerCase()}`}>{c.type}</span>
                                </td>
                                <td className="table-cell">{c.mobile}</td>
                                <td className="table-cell">{c.email}</td>
                                <td className="table-cell">{c.vat}</td>
                                <td className="table-cell font-bold">{c.balance}</td>
                                <td className="table-cell">
                                    <span className="status-badge status-completed">{c.status}</span>
                                </td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit" onClick={() => openEdit(c)}><Pencil size={14} /> Edit</button>
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
                        <div className="billing-stat-card"><span className="billing-stat-label">Total Billed</span><span className="billing-stat-val">SAR 0</span></div>
                        <div className="billing-stat-card"><span className="billing-stat-label">Total Received</span><span className="billing-stat-val">SAR 0</span></div>
                        <div className="billing-stat-card"><span className="billing-stat-label">Outstanding</span><span className="billing-stat-val">SAR 0</span></div>
                        <div className="billing-stat-card"><span className="billing-stat-label">Overdue Bills</span><span className="billing-stat-val">0</span></div>
                    </div>
                    <div className="billing-tabs">
                        {['All', 'Pending', 'Partial Paid', 'Overdue'].map((t) => (
                            <button key={t} type="button" className={`billing-tab ${billingTab === t ? 'active' : ''}`} onClick={() => setBillingTab(t)}>{t}</button>
                        ))}
                    </div>
                    <div className="billing-empty">
                        <FileText size={40} className="billing-empty-icon" />
                        <p>No bills found</p>
                    </div>
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
            </AnimatePresence>
        </div>
    );
}
