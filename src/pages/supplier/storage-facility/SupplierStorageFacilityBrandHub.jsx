import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
import {
    createStorageBrandUser,
    getStorageBrandSummary,
    listStorageAuditLog,
    listStorageBrandUsers,
    listStorageCustomers,
    listStorageInvoices,
    listStorageProducts,
    postStorageInvoice,
    recordStorageInvoicePayment,
    searchWarehouseProductsForMap,
} from '../../../services/storageFacilityApi';
import StorageFacilityInvoicePrint from './StorageFacilityInvoicePrint';
import StorageFacilityCustomersTab from './StorageFacilityCustomersTab';
import StorageFacilityProductsTab from './StorageFacilityProductsTab';
import StorageFacilityMovementsTab from './StorageFacilityMovementsTab';
import StorageFacilityLocationsTab from './StorageFacilityLocationsTab';
import StorageFacilityTransfersTab from './StorageFacilityTransfersTab';
import StorageFacilitySalesRepsTab from './StorageFacilitySalesRepsTab';
import StorageFacilitySalesTab from './StorageFacilitySalesTab';
import StorageFacilityNewInvoiceModal from './StorageFacilityNewInvoiceModal';
import StorageBrandTransactionHub from './accounting/StorageBrandTransactionHub';
import StorageBrandCashBankTab from './accounting/StorageBrandCashBankTab';
import StorageBrandAccountsTab from './accounting/StorageBrandAccountsTab';
import StorageBrandJournalLogs from './accounting/StorageBrandJournalLogs';
import StorageFacilityPermissionsPicker from './StorageFacilityPermissionsPicker';
import { SF_DEFAULT_OPERATOR_PERMISSIONS } from './storageFacilityPermissions';
import '../../../styles/admin/AccountingPage.css';

function readPortalScope() {
    try {
        const u = JSON.parse(localStorage.getItem('filter_auth_user') || '{}');
        return u?.supplier?.portalScope ?? 'owner';
    } catch {
        return 'owner';
    }
}

const OPERATIONS_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'products', label: 'Products' },
    { id: 'movements', label: 'Stock movements' },
    { id: 'locations', label: 'Inventory locations' },
    { id: 'transfers', label: 'Transfers' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'ar', label: 'Customers (AR)' },
    { id: 'sales_reps', label: 'Sales reps & performance' },
    { id: 'sales', label: 'Sales' },
];

/** Brand-scoped accounting (same areas as supplier Finance → Accounting). */
const ACCOUNTING_TABS = [
    { id: 'acct_hub', label: 'Transaction Hub' },
    { id: 'acct_cash', label: 'Cash & Bank' },
    { id: 'acct_accounts', label: 'Account categories' },
    { id: 'acct_log_pay', label: 'Payments log' },
    { id: 'acct_log_rcpt', label: 'Receipts log' },
    { id: 'acct_log_je', label: 'Journal log' },
];

const ADMIN_TABS = [{ id: 'users', label: 'Brand users', ownerOnly: true }];

export default function SupplierStorageFacilityBrandHub({ brandId }) {
    const navigate = useNavigate();
    const isOwner = readPortalScope() !== 'storage_brand';
    const [tab, setTab] = useState('overview');
    const [summary, setSummary] = useState(null);
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [invoiceModal, setInvoiceModal] = useState(false);
    const [userModal, setUserModal] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: 'brand_operator',
        permissions: [...SF_DEFAULT_OPERATOR_PERMISSIONS],
    });
    const [whSearch, setWhSearch] = useState([]);
    const [busy, setBusy] = useState(false);
    const [auditEntries, setAuditEntries] = useState([]);
    const [printInvoice, setPrintInvoice] = useState(null);

    const visibleAdminTabs = ADMIN_TABS.filter((t) => !t.ownerOnly || isOwner);

    function renderTabButton(t) {
        const active = tab === t.id;
        return (
            <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={active ? 'sf-brand-tab sf-brand-tab--active' : 'sf-brand-tab'}
            >
                {t.label}
            </button>
        );
    }

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [sumRes, prodRes, invRes, custRes, auditRes] = await Promise.all([
                getStorageBrandSummary(brandId),
                listStorageProducts(brandId),
                listStorageInvoices(brandId),
                listStorageCustomers(brandId),
                listStorageAuditLog(brandId, { limit: 20 }),
            ]);
            setSummary(sumRes?.brand ?? null);
            setProducts(prodRes?.products ?? []);
            setInvoices(invRes?.invoices ?? []);
            setCustomers(custRes?.customers ?? []);
            setAuditEntries(auditRes?.entries ?? []);
            if (isOwner) {
                const uRes = await listStorageBrandUsers(brandId);
                setUsers(uRes?.users ?? []);
            }
        } catch (e) {
            setErr(e?.message || 'Failed to load brand');
        } finally {
            setLoading(false);
        }
    }, [brandId, isOwner]);

    useEffect(() => {
        reload();
    }, [reload]);

    const addUser = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await createStorageBrandUser(brandId, {
                name: newUser.name,
                email: newUser.email,
                password: newUser.password,
                role: newUser.role,
                permissions:
                    newUser.role === 'brand_admin' ? undefined : newUser.permissions,
            });
            setUserModal(false);
            setNewUser({
                name: '',
                email: '',
                password: '',
                role: 'brand_operator',
                permissions: [...SF_DEFAULT_OPERATOR_PERMISSIONS],
            });
            await reload();
        } catch (ex) {
            window.alert(ex?.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    const searchWh = async (q) => {
        try {
            const res = await searchWarehouseProductsForMap(q);
            setWhSearch(res?.products ?? []);
        } catch {
            setWhSearch([]);
        }
    };

    if (loading && !summary) {
        return (
            <div style={{ padding: 16 }}>
                <ShimmerTable rows={8} columns={5} />
            </div>
        );
    }

    return (
        <div className="mgr-si-page">
            <button
                type="button"
                className="btn-portal-outline"
                style={{ marginBottom: 12 }}
                onClick={() => navigate('/supplier/storage_facility')}
            >
                <ArrowLeft size={14} /> {isOwner ? 'All brands' : 'Back'}
            </button>

            <h2 className="mgr-si-title">{summary?.name ?? 'Storage brand'}</h2>
            {summary?.locationName ? (
                <p className="mgr-si-subtitle">Bin: {summary.locationName}</p>
            ) : null}

            {err ? <div className="mgr-si-error">{err}</div> : null}

            <div className="sf-brand-tab-panel">
                <div className="sf-brand-tab-row">
                    {OPERATIONS_TABS.map(renderTabButton)}
                    {visibleAdminTabs.map(renderTabButton)}
                </div>
                <div className="sf-brand-tab-row sf-brand-tab-row--accounting">
                    <span className="sf-brand-tab-row-label">Accounting</span>
                    {ACCOUNTING_TABS.map(renderTabButton)}
                </div>
            </div>

            {tab === 'overview' && summary ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 12,
                    }}
                >
                    <div className="ws-section" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Products</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary.productCount}</div>
                    </div>
                    <div className="ws-section" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Qty on hand</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary.totalQty}</div>
                    </div>
                    <div className="ws-section" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>AR balance</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
                            SAR {Number(summary.arBalance || 0).toLocaleString()}
                        </div>
                    </div>
                </div>
            ) : null}

            {tab === 'overview' && auditEntries.length > 0 ? (
                <div className="ws-section" style={{ marginTop: 16, padding: 16 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '0.9375rem' }}>Recent activity</h3>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.8125rem' }}>
                        {auditEntries.map((a) => (
                            <li
                                key={a.id}
                                style={{
                                    padding: '8px 0',
                                    borderBottom: '1px solid #e2e8f0',
                                }}
                            >
                                <span style={{ color: '#64748b' }}>
                                    {a.createdAt?.slice(0, 16).replace('T', ' ')}
                                </span>
                                {' · '}
                                <strong>{a.action}</strong> — {a.summary}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {tab === 'products' ? (
                <StorageFacilityProductsTab
                    brandId={brandId}
                    products={products}
                    onReload={reload}
                    whSearch={whSearch}
                    onLoadCatalog={() => searchWh('')}
                />
            ) : null}

            {tab === 'movements' ? (
                <StorageFacilityMovementsTab
                    brandId={brandId}
                    brandName={summary?.name}
                    products={products}
                    onReload={reload}
                />
            ) : null}

            {tab === 'locations' ? (
                <StorageFacilityLocationsTab brandId={brandId} />
            ) : null}

            {tab === 'sales_reps' ? (
                <StorageFacilitySalesRepsTab brandId={brandId} />
            ) : null}

            {tab === 'sales' ? <StorageFacilitySalesTab brandId={brandId} /> : null}

            {tab === 'transfers' ? (
                <StorageFacilityTransfersTab
                    brandId={brandId}
                    products={products}
                    onReload={reload}
                />
            ) : null}

            {tab === 'invoices' ? (
                <>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        style={{ marginBottom: 12 }}
                        onClick={() => setInvoiceModal(true)}
                    >
                        <Plus size={14} /> New invoice
                    </button>
                    <div className="premium-table mgr-si-table-wrap">
                        <table className="mgr-si-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Invoice #</th>
                                    <th className="table-th">Type</th>
                                    <th className="table-th">Date</th>
                                    <th className="table-th">Total</th>
                                    <th className="table-th">Balance</th>
                                    <th className="table-th">Status</th>
                                    <th className="table-th">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="table-row">
                                        <td className="table-cell">{inv.invoiceNo}</td>
                                        <td className="table-cell">{inv.invoiceType}</td>
                                        <td className="table-cell">{inv.issueDate}</td>
                                        <td className="table-cell">
                                            SAR {Number(inv.grandTotal).toLocaleString()}
                                        </td>
                                        <td className="table-cell mgr-si-cell-balance">
                                            SAR {Number(inv.balance).toLocaleString()}
                                        </td>
                                        <td className="table-cell">{inv.status}</td>
                                        <td className="table-cell">
                                            <button
                                                type="button"
                                                className="mgr-si-record-pay"
                                                style={{ marginRight: 6 }}
                                                onClick={() => setPrintInvoice(inv)}
                                            >
                                                Print
                                            </button>
                                            {inv.status === 'draft' ? (
                                                <button
                                                    type="button"
                                                    className="mgr-si-record-pay"
                                                    onClick={async () => {
                                                        await postStorageInvoice(brandId, inv.id);
                                                        await reload();
                                                    }}
                                                >
                                                    Post
                                                </button>
                                            ) : null}
                                            {inv.status === 'posted' && inv.balance > 0 ? (
                                                <button
                                                    type="button"
                                                    className="mgr-si-record-pay"
                                                    onClick={async () => {
                                                        const amt = prompt(
                                                            'Payment amount (SAR)',
                                                            String(inv.balance),
                                                        );
                                                        if (!amt) return;
                                                        await recordStorageInvoicePayment(
                                                            brandId,
                                                            inv.id,
                                                            { amount: Number(amt), method: 'cash' },
                                                        );
                                                        await reload();
                                                    }}
                                                >
                                                    Record payment
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}

            {tab === 'ar' ? <StorageFacilityCustomersTab brandId={brandId} /> : null}

            {tab === 'acct_hub' ? (
                <StorageBrandTransactionHub brandId={brandId} customers={customers} />
            ) : null}
            {tab === 'acct_cash' ? <StorageBrandCashBankTab brandId={brandId} /> : null}
            {tab === 'acct_accounts' ? <StorageBrandAccountsTab brandId={brandId} /> : null}
            {tab === 'acct_log_pay' ? (
                <StorageBrandJournalLogs brandId={brandId} kind="payments" />
            ) : null}
            {tab === 'acct_log_rcpt' ? (
                <StorageBrandJournalLogs brandId={brandId} kind="receipts" />
            ) : null}
            {tab === 'acct_log_je' ? (
                <StorageBrandJournalLogs brandId={brandId} kind="journals" />
            ) : null}

            {tab === 'users' && isOwner ? (
                <>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        style={{ marginBottom: 12 }}
                        onClick={() => setUserModal(true)}
                    >
                        <Plus size={14} /> Add brand user
                    </button>
                    <div className="premium-table mgr-si-table-wrap">
                        <table className="mgr-si-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Name</th>
                                    <th className="table-th">Email</th>
                                    <th className="table-th">Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="table-row">
                                        <td className="table-cell">{u.name}</td>
                                        <td className="table-cell">{u.email}</td>
                                        <td className="table-cell">{u.role}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}

            {invoiceModal ? (
                <StorageFacilityNewInvoiceModal
                    brandId={brandId}
                    brandName={summary?.name}
                    products={products}
                    customers={customers}
                    whSearch={whSearch}
                    onLoadCatalog={() => searchWh('')}
                    onClose={() => setInvoiceModal(false)}
                    onSaved={reload}
                />
            ) : null}

            {userModal ? (
                <Modal
                    title="Brand portal user"
                    width="560px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setUserModal(false)}
                >
                    <form className="sf-simple-form" onSubmit={addUser}>
                        <div className="sf-form-field">
                            <label htmlFor="sf-user-name">Full name *</label>
                            <input
                                id="sf-user-name"
                                value={newUser.name}
                                onChange={(e) =>
                                    setNewUser((u) => ({ ...u, name: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label htmlFor="sf-user-email">Email *</label>
                                <input
                                    id="sf-user-email"
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, email: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="sf-form-field">
                                <label htmlFor="sf-user-password">Password *</label>
                                <input
                                    id="sf-user-password"
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) =>
                                        setNewUser((u) => ({ ...u, password: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-user-role">Role</label>
                            <select
                                id="sf-user-role"
                                value={newUser.role}
                                onChange={(e) => {
                                    const role = e.target.value;
                                    setNewUser((u) => ({
                                        ...u,
                                        role,
                                        permissions:
                                            role === 'brand_admin'
                                                ? [...SF_DEFAULT_OPERATOR_PERMISSIONS]
                                                : u.permissions,
                                    }));
                                }}
                            >
                                <option value="brand_operator">Operator (custom permissions)</option>
                                <option value="brand_admin">Brand admin (full access)</option>
                            </select>
                            <p className="sf-form-field-hint">
                                Admins can perform all storage facility tasks for this brand.
                            </p>
                        </div>
                        {newUser.role === 'brand_operator' ? (
                            <StorageFacilityPermissionsPicker
                                value={newUser.permissions}
                                onChange={(permissions) =>
                                    setNewUser((u) => ({ ...u, permissions }))
                                }
                                disabled={busy}
                            />
                        ) : null}
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setUserModal(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? 'Creating…' : 'Create user'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {printInvoice ? (
                <Modal onClose={() => setPrintInvoice(null)} title="Invoice preview">
                    <StorageFacilityInvoicePrint
                        brandName={summary?.name}
                        invoice={printInvoice}
                        onClose={() => setPrintInvoice(null)}
                    />
                </Modal>
            ) : null}
        </div>
    );
}
