import React, { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    createSupplierStaff,
    deleteSupplierStaff,
    listSupplierStaff,
    updateSupplierStaff,
} from '../../services/supplierApi';

const emptyForm = {
    name: '',
    phone: '',
    email: '',
    iqama: '',
    branch: '',
    department: '',
    role: '',
    isTechnician: false,
    basicSalary: '',
    commissionPercent: '0',
    commissionType: '% Revenue',
    status: 'active',
};

function mapStaffRow(r) {
    return {
        ...r,
        id: r.id ?? r.staffId ?? r.staff_id ?? r.employeeId ?? r.employee_id ?? null,
        name: r.name ?? r.fullName ?? r.full_name ?? r.n ?? '',
        phone: r.phone ?? r.mobile ?? r.m ?? '',
        email: r.email ?? '',
        iqama: r.iqama ?? r.nationalId ?? r.national_id ?? '',
        branch: r.branch ?? '',
        role: r.role ?? '',
        department: r.department ?? r.dept ?? '',
        isTechnician: !!(r.isTechnician ?? r.is_technician),
        basicSalary: r.basicSalary ?? r.basic_salary ?? '',
        commissionPercent: r.commissionPercent ?? r.commission_percent ?? '0',
        commissionType: r.commissionType ?? r.commission_type ?? '% Revenue',
        status: r.status ?? (r.isActive === false ? 'inactive' : 'active'),
    };
}

export default function SupplierStaff() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saveError, setSaveError] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    const [deleteLoadingId, setDeleteLoadingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [resolvedSupplierId, setResolvedSupplierId] = useState('default');

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        window.setTimeout(() => setToast(null), 2600);
    };
    const deriveSupplierId = () => {
        try {
            const raw = localStorage.getItem('filter_auth_user');
            if (!raw) return '';
            const u = JSON.parse(raw);
            return (
                u?.supplier?.supplierId ||
                u?.supplierId ||
                u?.supplier_id ||
                u?.supplier?.id ||
                ''
            );
        } catch {
            return '';
        }
    };

    const loadStaff = useCallback(async () => {
        setLoading(true);
        setApiError('');
        try {
            const supplierId = deriveSupplierId();
            if (!supplierId) {
                setResolvedSupplierId('');
                setList([]);
                setApiError('Supplier ID not found in login session. Please login again as supplier.');
                return [];
            }
            setResolvedSupplierId(String(supplierId));
            const res = await listSupplierStaff({ status: 'all', supplierId });
            const raw = Array.isArray(res?.staff)
                ? res.staff
                : Array.isArray(res?.data)
                  ? res.data
                  : Array.isArray(res?.items)
                    ? res.items
                    : Array.isArray(res?.supplierStaff)
                      ? res.supplierStaff
                      : [];
            let rows = raw.map(mapStaffRow).filter((x) => x && x.name);
            // Some backends do not support status=all and return empty on that filter.
            if (rows.length === 0) {
                const retry = await listSupplierStaff({ supplierId });
                const rawRetry = Array.isArray(retry?.staff)
                    ? retry.staff
                    : Array.isArray(retry?.data)
                      ? retry.data
                      : Array.isArray(retry?.items)
                        ? retry.items
                        : Array.isArray(retry?.supplierStaff)
                          ? retry.supplierStaff
                          : [];
                rows = rawRetry.map(mapStaffRow).filter((x) => x && x.name);
            }
            setList(rows);
            return rows;
        } catch (err) {
            console.error('Supplier staff API failed:', err);
            setList([]);
            setApiError(
                err?.message?.includes('401')
                    ? 'Unauthorized (401). Please sign in again.'
                    : err?.message || 'Failed to load staff',
            );
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStaff();
    }, [loadStaff]);

    const openAdd = () => {
        setEditItem(null);
        setForm(emptyForm);
        setSaveError('');
        setModalOpen(true);
    };

    const openEdit = (s) => {
        setEditItem(s);
        setForm({
            name: s.name || '',
            phone: s.phone || '',
            email: s.email || '',
            iqama: s.iqama || '',
            branch: s.branch || '',
            department: s.department || '',
            role: s.role || '',
            isTechnician: !!s.isTechnician,
            basicSalary: s.basicSalary || s.salary || '',
            commissionPercent: String(s.commissionPercent ?? '0'),
            commissionType: s.commissionType || '% Revenue',
            status: s.status || 'active',
        });
        setSaveError('');
        setModalOpen(true);
    };

    const buildPayload = () => ({
        supplierId: String(resolvedSupplierId || ''),
        branchId: form.branch?.trim() || undefined,
        name: form.name.trim(),
        mobile: form.phone.trim(),
        email: form.email.trim() || undefined,
        nationalId: form.iqama.trim() || undefined,
        branch: form.branch.trim() || undefined,
        department: form.department || undefined,
        role: form.role || 'Order Processor',
        isTechnician: !!form.isTechnician,
        basicSalary: form.basicSalary === '' ? undefined : Number(form.basicSalary),
        commissionPercent: Number(form.commissionPercent || 0),
        commissionType: form.commissionType || '% Revenue',
        status: form.status || 'active',
        isActive: form.status === 'active',
    });

    const handleSave = async () => {
        if (!form.name?.trim() || !form.phone?.trim()) return;
        if (!resolvedSupplierId) {
            setSaveError('Supplier ID missing. Please re-login.');
            showToast('Supplier ID missing. Please re-login.', 'error');
            return;
        }
        setSaveError('');
        setSaveLoading(true);
        try {
            const payload = buildPayload();
            console.log('[SupplierStaff] save payload', payload);
            let createdId = null;
            if (editItem) {
                const updated = await updateSupplierStaff(editItem.id, payload);
                console.log('[SupplierStaff] update response', updated);
                createdId = updated?.staff?.id ?? updated?.id ?? editItem.id;
            } else {
                const created = await createSupplierStaff(payload);
                console.log('[SupplierStaff] create response', created);
                createdId =
                    created?.staff?.id ??
                    created?.data?.id ??
                    created?.supplierStaff?.id ??
                    created?.id ??
                    null;
            }
            setModalOpen(false);
            setEditItem(null);
            setForm(emptyForm);
            const latestRows = await loadStaff();
            if (!editItem) {
                const matchedById = createdId ? latestRows.some((x) => x.id === createdId) : false;
                const matchedByIdentity = latestRows.some(
                    (x) =>
                        String(x.name || '').trim().toLowerCase() ===
                            String(form.name || '').trim().toLowerCase() &&
                        String(x.phone || '').trim() === String(form.phone || '').trim(),
                );
                if (!matchedById && !matchedByIdentity) {
                    console.error('[SupplierStaff] create mismatch: API returned success but staff not found in fresh GET /supplier/staff list', {
                        createdId,
                        submitted: { name: form.name, phone: form.phone },
                        latestRows,
                    });
                    showToast('Backend said success, but row not found in supplier_staff list.', 'error');
                    return;
                }
            }
            if (createdId && !latestRows.some((x) => x.id === createdId) && !editItem) {
                showToast('Supplier is added (matched by data).', 'success');
            } else {
                showToast(editItem ? 'Supplier staff updated successfully.' : 'Supplier is added.');
            }
        } catch (err) {
            console.error('Supplier staff save failed:', {
                error: err,
                message: err?.message,
                payload: buildPayload(),
                editingId: editItem?.id,
            });
            setSaveError(err?.message || 'Could not save employee');
            showToast(err?.message || 'Could not save employee', 'error');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Remove ${row.name || 'this employee'} from staff?`)) return;
        setDeleteLoadingId(row.id);
        try {
            await deleteSupplierStaff(row.id);
            await loadStaff();
            showToast('Supplier staff deleted.');
        } catch (err) {
            showToast(err?.message || 'Could not delete staff', 'error');
        } finally {
            setDeleteLoadingId(null);
        }
    };

    return (
        <div>
            {toast ? (
                <div
                    style={{
                        position: 'fixed',
                        top: 18,
                        right: 18,
                        zIndex: 1200,
                        padding: '10px 14px',
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        background:
                            toast.type === 'error'
                                ? '#B91C1C'
                                : toast.type === 'warning'
                                  ? '#B45309'
                                  : '#059669',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                    }}
                >
                    {toast.message}
                </div>
            ) : null}
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">
                        Staff & Roles ({loading ? '…' : list.length})
                    </h2>
                    <p className="ws-page-sub">Warehouse staff management</p>
                </div>
                <button
                    type="button"
                    className="btn-portal"
                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                    onClick={openAdd}
                >
                    <Plus size={15} /> Add Staff
                </button>
            </div>
            {apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load staff:</strong> {apiError}
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem' }}>
                        Supplier scope: <strong>{resolvedSupplierId}</strong>
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem' }}>
                        Run the local API from the repo root: <code>npm run server</code> (needs{' '}
                        <code>cd server &amp;&amp; npm install</code> once).
                    </p>
                </div>
            ) : null}
            {loading ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Users size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>Loading staff…</p>
                </div>
            ) : apiError ? null : list.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Users size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No staff added yet</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Add warehouse staff and roles
                    </p>
                    <button
                        type="button"
                        className="btn-portal"
                        style={{ marginTop: 16, background: '#2563EB', color: '#fff', border: 'none' }}
                        onClick={openAdd}
                    >
                        <Plus size={15} /> Add First Staff
                    </button>
                </div>
            ) : (
                <div className="ws-section">
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Phone</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        <strong>{s.name}</strong>
                                    </td>
                                    <td>{s.role}</td>
                                    <td>{s.department || '—'}</td>
                                    <td>{s.phone}</td>
                                    <td>
                                        <span className={`ws-badge ${s.status === 'active' ? 'ws-badge--green' : 'ws-badge--gray'}`}>{s.status}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(s)}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 6,
                                                    border: '1px solid var(--color-border)',
                                                    background: '#fff',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                }}
                                            >
                                                <Pencil size={14} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(s)}
                                                disabled={deleteLoadingId === s.id}
                                                style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 6,
                                                    border: '1px solid #FECACA',
                                                    background: '#fff',
                                                    color: '#B91C1C',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                }}
                                            >
                                                <Trash2 size={14} /> {deleteLoadingId === s.id ? '…' : 'Delete'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={editItem ? 'Edit Employee' : 'Add New Employee'}
                        onClose={() => {
                            if (!saveLoading) {
                                setModalOpen(false);
                                setEditItem(null);
                                setSaveError('');
                            }
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-portal-outline" disabled={saveLoading} onClick={() => setModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-portal" disabled={!form.name || !form.phone || saveLoading} onClick={handleSave}>
                                    {saveLoading ? 'Saving…' : editItem ? 'Save Changes' : 'Create Employee'}
                                </button>
                            </div>
                        }
                    >
                        {saveError ? (
                            <p style={{ margin: '0 0 12px 0', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {saveError}
                            </p>
                        ) : null}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
                                    BASIC INFORMATION
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field">
                                        <label>Full Name *</label>
                                        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full Name" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Mobile *</label>
                                        <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05XXXXXXXX" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Email</label>
                                        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Iqama / CNIC</label>
                                        <input value={form.iqama} onChange={(e) => set('iqama', e.target.value)} placeholder="Iqama / CNIC" />
                                    </div>
                                    {/* <div className="ws-field">
                                        <label>Branch</label>
                                        <input value={form.branch} onChange={(e) => set('branch', e.target.value)} placeholder="Branch" />
                                    </div> */}
                                    <div className="ws-field">
                                        <label>Role</label>
                                        <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                                            <option value="">Select role</option>
                                            <option value="Order Processor">Order Processor</option>
                                            <option value="Warehouse Manager">Warehouse Manager</option>
                                            <option value="Picker / Packer">Picker / Packer</option>
                                            <option value="Driver">Driver</option>
                                        </select>
                                    </div>
                                    <div className="ws-field">
                                        <label>Department</label>
                                        <select value={form.department} onChange={(e) => set('department', e.target.value)}>
                                            <option value="">Select Department</option>
                                            <option value="HR">HR</option>
                                            <option value="IT">IT</option>
                                            <option value="Finance">Finance</option>
                                            <option value="Operations">Operations</option>
                                            <option value="Sales">Sales</option>
                                            <option value="Marketing">Marketing</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
                                    TECHNICIAN SETTINGS
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}>
                                        <input type="checkbox" checked={form.isTechnician} onChange={(e) => set('isTechnician', e.target.checked)} />
                                        This employee is a Technician
                                    </label>
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: '0.08em' }}>
                                    FINANCIAL
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field">
                                        <label>Basic Salary (SAR)</label>
                                        <input type="number" value={form.basicSalary} onChange={(e) => set('basicSalary', e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Commission %</label>
                                        <input value={form.commissionPercent} onChange={(e) => set('commissionPercent', e.target.value)} placeholder="0" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Commission Type</label>
                                        <select value={form.commissionType} onChange={(e) => set('commissionType', e.target.value)}>
                                            <option>% Revenue</option>
                                            <option>Fixed Amount</option>
                                        </select>
                                    </div>
                                    <div className="ws-field">
                                        <label>Status</label>
                                        <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div
                                className="ws-section"
                                style={{
                                    padding: '12px 14px',
                                    margin: 0,
                                    background: '#FFFBEB',
                                    border: '1px solid #FDE68A',
                                    color: '#92400E',
                                    borderRadius: 12,
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                }}
                            >
                                Login credentials will be sent to the employee via SMS & Email when your auth service is configured.
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
