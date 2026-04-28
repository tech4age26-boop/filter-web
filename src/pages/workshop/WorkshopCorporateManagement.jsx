import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Building2, FileText, Lock, Mail, Pencil, Phone, RefreshCw, Store, User, UserPlus, ToggleLeft,
} from 'lucide-react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const statusBadgeClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active') return 'ws-badge--green';
    if (normalized === 'pending') return 'ws-badge--yellow';
    if (normalized === 'rejected') return 'ws-badge--red';
    return 'ws-badge--gray';
};

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'rejected', label: 'Rejected' },
];

function buildEditForm(row) {
    const person = (row.contactPerson || row.customer?.name || '').trim() || (row.customer?.name || '');
    return {
        companyName: row.companyName || '',
        customerName: person,
        contactPerson: person,
        mobile: row.customer?.mobile || '',
        taxId: row.customer?.taxId || row.customer?.vatNumber || '',
        status: String(row.status || 'active').toLowerCase(),
        selectedBranchIds: (row.selectedBranchIds || []).map((id) => String(id)),
    };
}

function FieldRow({ icon: Icon, label, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F3F4F6', borderRadius: 10, padding: '10px 12px', border: '1px solid transparent' }}>
                {Icon && <Icon size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
            </div>
        </div>
    );
}

function sameIdSet(a, b) {
    const sa = [...a].map(String).sort().join(',');
    const sb = [...b].map(String).sort().join(',');
    return sa === sb;
}

function buildPatchBody(form, initial) {
    const body = {};
    if (form.companyName.trim() !== initial.companyName) body.companyName = form.companyName.trim();
    if (form.customerName.trim() !== initial.customerName) body.customerName = form.customerName.trim();
    if (form.contactPerson.trim() !== initial.contactPerson) body.contactPerson = form.contactPerson.trim();
    if (form.mobile.trim() !== initial.mobile) body.mobile = form.mobile.trim();
    if (form.taxId.trim() !== initial.taxId) body.taxId = form.taxId.trim();
    if (form.status !== initial.status) body.status = form.status;
    if (!sameIdSet(form.selectedBranchIds, initial.selectedBranchIds)) {
        body.selectedBranchIds = form.selectedBranchIds;
    }
    return body;
}

function EditCorporateAccountModal({ row, branches, onClose, onSaved }) {
    const [form, setForm] = useState(() => buildEditForm(row));
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const initialRef = useRef(buildEditForm(row));

    useEffect(() => {
        const next = buildEditForm(row);
        setForm(next);
        initialRef.current = next;
        setSaveError('');
    }, [row]);

    const setPersonName = (v) => {
        setForm((f) => ({ ...f, customerName: v, contactPerson: v }));
    };

    const toggleBranch = (branchId) => {
        const sid = String(branchId);
        setForm((f) => {
            const has = f.selectedBranchIds.includes(sid);
            return {
                ...f,
                selectedBranchIds: has
                    ? f.selectedBranchIds.filter((x) => x !== sid)
                    : [...f.selectedBranchIds, sid],
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');
        try {
            const body = buildPatchBody(form, initialRef.current);
            if (Object.keys(body).length === 0) {
                setSaveError('No changes to save.');
                return;
            }
            await apiFetch(`/workshop-staff/corporate-account/${row.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            onSaved?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title="Edit Corporate Account"
            onClose={onClose}
            width="520px"
            footer={
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" className="btn-portal" onClick={handleSave} disabled={saving || !form.companyName.trim()}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    Update the details below. Only changed fields will be sent.
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}

                <FieldRow icon={Building2} label="Company Name">
                    <input
                        type="text"
                        value={form.companyName}
                        onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={User} label="Customer Name">
                    <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setPersonName(e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Phone} label="Mobile">
                    <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={FileText} label="Tax ID (VAT)">
                    <input
                        type="text"
                        value={form.taxId}
                        onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={ToggleLeft} label="Status">
                    <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                        {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </FieldRow>

                <div style={{ marginTop: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.875rem' }}>
                        <Store size={18} style={{ color: 'var(--color-text-muted)' }} />
                        Select Branches
                    </div>
                    <span className="ws-nav-badge--yellow" style={{ fontSize: '0.6875rem' }}>
                        {form.selectedBranchIds.length} selected
                    </span>
                </div>
                <div
                    style={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 10,
                        padding: 8,
                        background: '#fff',
                    }}
                >
                    {branches.length === 0 ? (
                        <p style={{ margin: 12, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                            No branches loaded. Refresh the page or add branches first.
                        </p>
                    ) : (
                        branches.map((b) => {
                            const idStr = String(b.id);
                            const checked = form.selectedBranchIds.includes(idStr);
                            return (
                                <label
                                    key={idStr}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 10,
                                        padding: '10px 8px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        background: checked ? 'rgba(255,214,0,0.12)' : 'transparent',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleBranch(b.id)}
                                        style={{ marginTop: 3 }}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{b.name || idStr}</div>
                                        {b.address ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{b.address}</div>
                                        ) : null}
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
}

function AddCorporateUserModal({ row, onClose, onSuccess }) {
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    useEffect(() => {
        setForm({ name: '', email: '', password: '' });
        setSaveError('');
    }, [row?.id]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const handleCreate = async () => {
        const name = form.name.trim();
        const email = form.email.trim();
        const password = form.password;
        if (!name || !email || !password) {
            setSaveError('Name, email, and password are required.');
            return;
        }
        if (password.length < 8) {
            setSaveError('Password must be at least 8 characters.');
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            await apiFetch('/workshop-staff/corporate-user/create', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    corporateAccountId: String(row.id),
                }),
            });
            onSuccess?.();
            onClose();
        } catch (e) {
            setSaveError(e.message || 'Failed to create user.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title="Add corporate portal user"
            onClose={onClose}
            width="480px"
            footer={
                <>
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={handleCreate}
                        disabled={saving || !form.name.trim() || !form.email.trim() || !form.password}
                    >
                        {saving ? 'Creating...' : 'Create user'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ margin: '0 0 8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    Account: <strong>{row.companyName || row.customer?.name || '—'}</strong>
                </p>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                    Creates a corporate user linked to this corporate account ({String(row.id)}).
                </p>
                {saveError && (
                    <p style={{ margin: '0 0 12px', color: '#B91C1C', fontSize: '0.8125rem' }}>{saveError}</p>
                )}
                <FieldRow icon={User} label="Name">
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        autoComplete="name"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Mail} label="Email">
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) => set('email', e.target.value)}
                        autoComplete="email"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
                <FieldRow icon={Lock} label="Password">
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        autoComplete="new-password"
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem', outline: 'none' }}
                    />
                </FieldRow>
            </div>
        </Modal>
    );
}

export default function WorkshopCorporateManagement() {
    const [customers, setCustomers] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [branches, setBranches] = useState([]);
    const [editing, setEditing] = useState(null);
    const [addUserFor, setAddUserFor] = useState(null);

    const loadBranches = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/branches');
            if (response?.success && Array.isArray(response.branches)) {
                setBranches(response.branches);
            }
        } catch {
            setBranches([]);
        }
    }, []);

    const loadCorporateCustomers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch('/workshop-staff/corporate-customers');
            if (!(response?.success && Array.isArray(response.corporateCustomers))) {
                throw new Error('Invalid corporate customers response.');
            }
            setCustomers(response.corporateCustomers);
            setTotal(toNumber(response.total));
        } catch (err) {
            setError(err.message || 'Failed to load corporate customers.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCorporateCustomers();
    }, [loadCorporateCustomers]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Corporate Management</h2>
                    <p className="ws-page-sub">Corporate customers linked to your workshop</p>
                </div>
                <button className="btn-portal" onClick={loadCorporateCustomers} disabled={isLoading}>
                    <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Corporate Customers</p>
                        <p className="ws-kpi-value">{total}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">CORP</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <div style={{ overflowX: 'auto', padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th>Contact</th>
                                <th>Mobile</th>
                                <th>VAT</th>
                                <th>Credit Limit</th>
                                <th>Due Balance</th>
                                <th>Branches</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        {isLoading ? 'Loading corporate customers...' : 'No corporate customers found'}
                                    </td>
                                </tr>
                            ) : (
                                customers.map((row) => (
                                    <tr key={row.id}>
                                        <td><strong>{row.companyName || row.customer?.name || '—'}</strong></td>
                                        <td>{row.contactPerson || '—'}</td>
                                        <td>{row.customer?.mobile || '—'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            {row.customer?.vatNumber || row.customer?.taxId || '—'}
                                        </td>
                                        <td>SAR {toNumber(row.creditLimit).toLocaleString()}</td>
                                        <td>SAR {toNumber(row.dueBalance).toLocaleString()}</td>
                                        <td>{Array.isArray(row.selectedBranchIds) ? row.selectedBranchIds.length : 0}</td>
                                        <td>
                                            <span className={`ws-badge ${statusBadgeClass(row.status)}`}>
                                                {row.status || 'unknown'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => setAddUserFor(row)}
                                                >
                                                    <UserPlus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                    Add user
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => setEditing(row)}
                                                >
                                                    <Pencil size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                    Edit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editing && (
                <EditCorporateAccountModal
                    key={editing.id}
                    row={editing}
                    branches={branches}
                    onClose={() => setEditing(null)}
                    onSaved={loadCorporateCustomers}
                />
            )}
            {addUserFor && (
                <AddCorporateUserModal
                    key={addUserFor.id}
                    row={addUserFor}
                    onClose={() => setAddUserFor(null)}
                    onSuccess={loadCorporateCustomers}
                />
            )}
        </div>
    );
}
