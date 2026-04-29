import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Wrench, Radio, Plus, Pencil, Trash2, Loader, Eye, EyeOff } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ROLE_OPTIONS, COMMISSION_TYPE_OPTIONS, normalizeCommissionType } from './constants';
import {
    loadWorkshopEmployeesCombined,
    createWorkshopTechnician,
    createWorkshopCashier,
    updateWorkshopTechnician,
    updateWorkshopCashier,
    deleteWorkshopTechnician,
    deleteWorkshopCashier,
    getWorkshopBranches,
} from '../../services/workshopStaffApi';
import { getMyDepartments } from '../../services/workshopCatalogApi';

const isTechnicianRole = (r) =>
    r === 'technician' ||
    r === 'senior_technician' ||
    r === 'junior_technician' ||
    r === 'specialist';

function parseWorkshopDepartmentsResponse(res) {
    return (
        (Array.isArray(res?.departments) && res.departments)
        || (Array.isArray(res?.data?.departments) && res.data.departments)
        || (Array.isArray(res?.data) && res.data)
        || (Array.isArray(res) && res)
        || []
    );
}

const EMPTY_FORM = {
    full_name: '',
    mobile: '',
    email: '',
    iqama: '',
    branchId: '',
    departmentIds: [],
    role: 'cashier',
    is_technician: false,
    workshop_duty: false,
    oncall_available: false,
    basic_salary: '',
    commission_percent: 0,
    commission_type: 'percent_of_revenue',
    status: 'active',
    password: '',
};

export default function WorkshopEmployees({ selectedBranchId = 'all', branches: branchesProp = [] }) {
    const [employees, setEmployees] = useState([]);
    const [branchList, setBranchList] = useState([]);
    const [workshopDepartments, setWorkshopDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [listError, setListError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggleDepartmentId = (id) =>
        setForm((f) => {
            const s = String(id);
            const has = f.departmentIds.includes(s);
            return { ...f, departmentIds: has ? f.departmentIds.filter((d) => d !== s) : [...f.departmentIds, s] };
        });

    useEffect(() => {
        if (branchesProp?.length) {
            setBranchList(branchesProp);
            return;
        }
        let cancelled = false;
        getWorkshopBranches()
            .then((r) => {
                if (cancelled) return;
                if (r?.success && Array.isArray(r.branches)) setBranchList(r.branches);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [branchesProp]);

    const loadEmployees = useCallback(async () => {
        setListError('');
        setLoading(true);
        try {
            // Push the branch filter to the server when the sidebar selector
            // points at a specific branch. With "all" we get the workshop-wide
            // list and the table-level filter takes over.
            const { employees: rows } = await loadWorkshopEmployeesCombined({
                branchId: selectedBranchId,
            });
            setEmployees(rows);
        } catch (e) {
            setEmployees([]);
            setListError(e.message || 'Failed to load employees.');
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const selectedBranchName = useMemo(
        () => branchList.find((b) => String(b.id) === String(selectedBranchId))?.name,
        [branchList, selectedBranchId],
    );

    const displayedEmployees = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return employees;
        return employees.filter(
            (e) =>
                String(e.branchId) === String(selectedBranchId) ||
                (selectedBranchName && e.branch === selectedBranchName),
        );
    }, [employees, selectedBranchId, selectedBranchName]);

    const loadWorkshopDepartmentCatalog = useCallback(async () => {
        try {
            const res = await getMyDepartments();
            setWorkshopDepartments(parseWorkshopDepartmentsResponse(res));
        } catch {
            setWorkshopDepartments([]);
        }
    }, []);

    useEffect(() => {
        loadWorkshopDepartmentCatalog();
    }, [loadWorkshopDepartmentCatalog]);

    const ensureDepartmentsLoaded = useCallback(async () => {
        if (workshopDepartments.length > 0) return;
        await loadWorkshopDepartmentCatalog();
    }, [workshopDepartments.length, loadWorkshopDepartmentCatalog]);

    const formatEmployeeDepartments = useCallback(
        (emp) => {
            const direct = emp.department && String(emp.department).trim();
            if (direct) return direct;
            const ids = Array.isArray(emp.departmentIds) ? emp.departmentIds : [];
            if (!ids.length || !workshopDepartments.length) return null;
            const names = ids
                .map((id) => {
                    const row = workshopDepartments.find(
                        (d) => String(d.id ?? d._id) === String(id),
                    );
                    return row?.name ?? row?.departmentName ?? '';
                })
                .filter(Boolean);
            return names.length ? names.join(', ') : null;
        },
        [workshopDepartments],
    );

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowPassword(false);
        setModalOpen(true);
        ensureDepartmentsLoaded();
    };

    const openEdit = (emp) => {
        setEditing(emp);
        const roleVal = (emp.role || '').toLowerCase().replace(/\s+/g, '_');
        const hasRole = ROLE_OPTIONS.includes(roleVal);
        setForm({
            full_name: emp.name,
            mobile: emp.phone || '',
            email: emp.email || '',
            iqama: emp.iqama || '',
            branchId: emp.branchId || '',
            departmentIds: Array.isArray(emp.departmentIds) ? emp.departmentIds.map(String) : [],
            role: hasRole ? roleVal : 'technician',
            is_technician:
                !!emp.workshop_duty ||
                !!emp.oncall_available ||
                (emp.role || '').toLowerCase().includes('technician') ||
                (emp.role || '').toLowerCase().includes('specialist'),
            workshop_duty: !!emp.workshop_duty,
            oncall_available: !!emp.oncall_available,
            basic_salary: emp.basic_salary ?? '',
            commission_percent: emp.commission_percent ?? 0,
            commission_type: normalizeCommissionType(emp.commission_type),
            status: emp.status || 'active',
            password: '',
        });
        setShowPassword(false);
        setModalOpen(true);
        ensureDepartmentsLoaded();
    };

    /**
     * Build the body for the staff endpoints. The mapping mirrors what the BE
     * wires up: name/mobile/email/iqama/branchId/basicSalary/commissionPercent/
     * commissionType/isActive on both routes, plus departmentIds +
     * workshopDuty/oncallAvailable/technicianType for technicians. Empty optional strings are coerced to `undefined` so
     * they're left out of the JSON instead of overwriting columns with "".
     */
    const buildStaffPayload = ({ asTechnician, isEdit }) => {
        const optStr = (v) => {
            const t = typeof v === 'string' ? v.trim() : v;
            return t === '' || t == null ? undefined : t;
        };
        const optNum = (v) => {
            if (v === '' || v == null) return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };

        const body = {
            name: form.full_name.trim(),
            mobile: form.mobile.trim(),
            email: optStr(form.email),
            iqama: optStr(form.iqama),
            branchId: form.branchId ? String(form.branchId) : undefined,
            basicSalary: optNum(form.basic_salary),
            commissionPercent: Number(form.commission_percent) || 0,
            commissionType: optStr(form.commission_type),
            isActive: form.status === 'active',
        };

        if (asTechnician) {
            body.workshopDuty = !!form.workshop_duty;
            body.oncallAvailable = !!form.oncall_available;
            if (form.workshop_duty && !form.oncall_available) {
                body.technicianType = 'workshop';
            } else if (!form.workshop_duty && form.oncall_available) {
                body.technicianType = 'on_call';
            }
            // When both are true, rely on workshopDuty + oncallAvailable; omit technicianType so BE can persist both flags.
            // Always send the array on technician requests so the BE can
            // diff/replace links cleanly. Empty array means "no departments".
            body.departmentIds = form.departmentIds.map(String);
        }

        if (isEdit) {
            // Optional password reset on edit. Send only when the user has
            // typed something — empty input means "leave the password alone".
            const newPwd = optStr(form.password);
            if (newPwd) body.password = newPwd;
        } else {
            // Create flow: BE expects a password to seed the User row. We
            // generate a temporary one if the admin didn't provide one.
            body.password = optStr(form.password) || `Temp@${Date.now()}`;
        }

        return body;
    };

    const handleSave = async () => {
        if (!form.full_name?.trim() || !form.mobile?.trim()) return;
        const asTechnician = form.is_technician || isTechnicianRole(form.role);
        // Cashiers must have a branch — backend enforces this with a 400, we
        // surface the error early to avoid a confusing network round-trip.
        const isCashierCreate = !editing && !asTechnician;
        const isCashierEdit = editing && editing._source !== 'technician';
        if ((isCashierCreate || isCashierEdit) && !form.branchId) {
            alert('Cashiers must be assigned to a branch.');
            return;
        }
        if (asTechnician && !form.workshop_duty && !form.oncall_available) {
            alert('Select at least one technician type: Workshop and/or On-Call.');
            return;
        }
        setSaving(true);
        try {
            const isEdit = !!editing;
            // The "kind" follows the existing record on edit (you can't flip a
            // cashier into a technician via PATCH) and the form intent on
            // create.
            const isTech = isEdit ? editing._source === 'technician' : asTechnician;
            const body = buildStaffPayload({ asTechnician: isTech, isEdit });

            if (isEdit) {
                if (isTech) {
                    await updateWorkshopTechnician(editing.id, body);
                } else {
                    await updateWorkshopCashier(editing.id, body);
                }
            } else if (isTech) {
                await createWorkshopTechnician(body);
            } else {
                await createWorkshopCashier(body);
            }
            setModalOpen(false);
            setEditing(null);
            await loadEmployees();
        } catch (e) {
            alert(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, source) => {
        if (!confirm('Remove this employee?')) return;
        setSaving(true);
        try {
            if (source === 'technician') await deleteWorkshopTechnician(id);
            else await deleteWorkshopCashier(id);
            await loadEmployees();
        } catch (e) {
            alert(e.message || 'Delete failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Employees</h2>
                    <p className="ws-page-sub">Manage workshop technicians and staff</p>
                </div>
                <button className="btn-portal" onClick={openAdd} disabled={saving}>
                    <Plus size={15} /> Add New Employee
                </button>
            </div>
            {listError && (
                <div className="ws-section" style={{ marginBottom: 12, padding: 12, color: '#B91C1C', fontSize: '0.875rem' }}>
                    {listError}
                </div>
            )}
            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Staff</p>
                        <p className="ws-kpi-value">{displayedEmployees.length}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <Users size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">On Workshop Duty</p>
                        <p className="ws-kpi-value">{displayedEmployees.filter((e) => e.workshop_duty).length}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <Wrench size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">On-Call</p>
                        <p className="ws-kpi-value">{displayedEmployees.filter((e) => e.oncall_available).length}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">
                        <Radio size={22} />
                    </div>
                </div>
            </div>
            <div className="ws-section" style={{ position: 'relative' }}>
                {loading && (
                    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Loader size={20} style={{ animation: 'ws-spin 0.8s linear infinite' }} />
                        <span style={{ fontSize: '0.875rem' }}>Loading employees…</span>
                    </div>
                )}
                {!loading && displayedEmployees.length === 0 ? (
                    <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No employees in this view.</p>
                ) : (
                    !loading && (
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>Branch</th>
                                    <th>Phone</th>
                                    <th>Commission %</th>
                                    <th>Workshop Duty</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedEmployees.map((emp) => (
                                    <tr key={`${emp._source}-${emp.id}`}>
                                        <td>
                                            <strong>{emp.name}</strong>
                                        </td>
                                        <td>{emp.role}</td>
                                        <td>{formatEmployeeDepartments(emp) ?? '—'}</td>
                                        <td>{emp.branch || '—'}</td>
                                        <td>{emp.phone}</td>
                                        <td>{emp.commission_percent}%</td>
                                        <td>
                                            <span className={`ws-badge ${emp.workshop_duty ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                {emp.workshop_duty ? 'Active' : 'Off'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${emp.status === 'active' ? 'ws-badge--green' : 'ws-badge--red'}`}>
                                                {emp.status}
                                            </span>
                                        </td>
                                        <td style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                type="button"
                                                onClick={() => openEdit(emp)}
                                                style={{
                                                    padding: '5px 10px',
                                                    background: '#EFF6FF',
                                                    color: '#2563EB',
                                                    border: 'none',
                                                    borderRadius: 6,
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                }}
                                                disabled={saving}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(emp.id, emp._source)}
                                                style={{
                                                    padding: '5px 10px',
                                                    background: '#FEE2E2',
                                                    color: '#DC2626',
                                                    border: 'none',
                                                    borderRadius: 6,
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '0.75rem',
                                                }}
                                                disabled={saving}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )
                )}
            </div>
            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={editing ? 'Edit Employee' : 'Add New Employee'}
                        onClose={() => setModalOpen(false)}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-submit" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    BASIC INFORMATION
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field">
                                        <label>Full Name *</label>
                                        <input
                                            value={form.full_name}
                                            onChange={(e) => set('full_name', e.target.value)}
                                            placeholder="Full Name"
                                            required
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Mobile *</label>
                                        <input
                                            value={form.mobile}
                                            onChange={(e) => set('mobile', e.target.value)}
                                            placeholder="05XXXXXXXX"
                                            required
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Email</label>
                                        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" />
                                    </div>
                                    <div className="ws-field">
                                        <label>Iqama / CNIC</label>
                                        <input value={form.iqama} onChange={(e) => set('iqama', e.target.value)} placeholder="Iqama / CNIC" />
                                    </div>
                                    <div className="ws-field">
                                        {(() => {
                                            const asTechnician = form.is_technician || isTechnicianRole(form.role);
                                            const cashierEdit = editing && editing._source !== 'technician';
                                            const branchRequired = !asTechnician || cashierEdit;
                                            return (
                                                <label>
                                                    Branch {branchRequired ? '*' : <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>(optional for technicians)</span>}
                                                </label>
                                            );
                                        })()}
                                        <select value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
                                            <option value="">Select Branch</option>
                                            {branchList.map((b) => (
                                                <option key={b.id} value={String(b.id)}>
                                                    {b.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ws-field">
                                        <label>Role</label>
                                        <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                                            {ROLE_OPTIONS.map((r) => (
                                                <option key={r} value={r}>
                                                    {r.replace(/_/g, ' ')}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {(form.is_technician || isTechnicianRole(form.role)) && (
                                        <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                            <label>
                                                Departments{' '}
                                                <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                    (workshop departments this technician can work in)
                                                </span>
                                            </label>
                                            {workshopDepartments.length === 0 ? (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                                                    No departments adopted yet. Add some from the Master Catalog first.
                                                </p>
                                            ) : (
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                                        gap: 8,
                                                        marginTop: 6,
                                                        padding: 10,
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: 8,
                                                        maxHeight: 160,
                                                        overflow: 'auto',
                                                    }}
                                                >
                                                    {workshopDepartments.map((d) => {
                                                        const id = String(d.id);
                                                        const checked = form.departmentIds.includes(id);
                                                        return (
                                                            <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleDepartmentId(id)}
                                                                />
                                                                {d.name}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    TECHNICIAN SETTINGS
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.is_technician}
                                            onChange={(e) => {
                                                const v = e.target.checked;
                                                setForm((f) => ({
                                                    ...f,
                                                    is_technician: v,
                                                    ...(!v ? { workshop_duty: false, oncall_available: false } : {}),
                                                    ...(v && !f.workshop_duty && !f.oncall_available ? { workshop_duty: true } : {}),
                                                }));
                                            }}
                                        />
                                        This employee is a Technician
                                    </label>
                                </div>
                                {(form.is_technician || isTechnicianRole(form.role)) && (
                                    <div style={{ marginTop: 10 }}>
                                        <div
                                            style={{
                                                fontSize: '0.6875rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.07em',
                                                marginBottom: 10,
                                            }}
                                        >
                                            Technician type
                                        </div>
                                        <p style={{ margin: '0 0 10px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                                            Select one or both. Workshop covers in-house assignment; On-Call covers mobile / after-hours eligibility.
                                        </p>
                                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                                            <label
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '0.875rem',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.workshop_duty}
                                                    onChange={(e) => set('workshop_duty', e.target.checked)}
                                                />
                                                Workshop
                                            </label>
                                            <label
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '0.875rem',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.oncall_available}
                                                    onChange={(e) => set('oncall_available', e.target.checked)}
                                                />
                                                On-Call
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    FINANCIAL
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field">
                                        <label>Basic Salary (SAR)</label>
                                        <input
                                            type="number"
                                            value={form.basic_salary}
                                            onChange={(e) => set('basic_salary', e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Commission %</label>
                                        <input
                                            type="number"
                                            value={form.commission_percent}
                                            onChange={(e) => set('commission_percent', parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="ws-field">
                                        <label>Commission Type</label>
                                        <select value={form.commission_type} onChange={(e) => set('commission_type', e.target.value)}>
                                            {COMMISSION_TYPE_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
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

                            <div style={{ height: 1, background: 'var(--color-border-light)' }} />

                            <div>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        color: 'var(--color-text-muted)',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    {editing ? 'RESET PASSWORD' : 'INITIAL PASSWORD'}
                                </div>
                                <div className="ws-form-grid" style={{ marginTop: 10 }}>
                                    <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                        <label>
                                            {editing ? 'New Password' : 'Password'}{' '}
                                            <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                                {editing
                                                    ? '(leave blank to keep the current password)'
                                                    : '(optional — a temporary password is generated if blank)'}
                                            </span>
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={form.password}
                                                onChange={(e) => set('password', e.target.value)}
                                                placeholder={editing ? 'New password' : 'Leave blank to auto-generate'}
                                                autoComplete="new-password"
                                                style={{ paddingRight: 40, width: '100%' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                style={{
                                                    position: 'absolute',
                                                    right: 8,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: 4,
                                                    color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
