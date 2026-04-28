import { useState, useEffect } from 'react';
import { Plus, Pencil, ChevronDown, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/EmployeesPage.css';
import { getTechnicians, getCashiers, createTechnician, createCashier, updateUser } from '../../services/superAdminApi';

const EMPTY_EMPLOYEE = {
    name: '',
    mobile: '',
    email: '',
    iqama: '',
    branch: 'Select branch',
    department: '',
    role: 'cashier',
    isTechnician: false,
    basicSalary: '',
    commissionPercent: '0',
    commissionType: '% Revenue',
    status: 'Active'
};

export default function EmployeesPage() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE);
    const [editingId, setEditingId] = useState(null);
    const [roleFilter, setRoleFilter] = useState('All Roles');
    const [statusFilter, setStatusFilter] = useState('All Status');

    const normalizeEmployee = (u, role) => ({
        id: u.id ?? u._id,
        name: u.name ?? u.fullName ?? '—',
        mobile: u.mobile ?? u.phone ?? '—',
        email: u.email ?? '',
        role: role ?? u.role ?? u.userType ?? 'cashier',
        technicianType: u.technicianType ?? u.type ?? null,
        branch: u.branchName ?? u.branch?.name ?? '—',
        commission: u.commissionPercent != null ? `${u.commissionPercent}%` : '—',
        status: u.isActive === false ? 'inactive' : 'active',
    });

    useEffect(() => {
        Promise.all([
            getTechnicians({}),
            getCashiers({}),
        ]).then(([techs, cashiers]) => {
            const techList = (Array.isArray(techs) ? techs : (techs?.technicians ?? [])).map((u) => normalizeEmployee(u, 'technician'));
            const cashierList = (Array.isArray(cashiers) ? cashiers : (cashiers?.cashiers ?? [])).map((u) => normalizeEmployee(u, 'cashier'));
            setEmployees([...techList, ...cashierList]);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const total = employees.length;
    const activeCount = employees.filter((e) => e.status.toLowerCase() === 'active').length;
    const technicianCount = employees.filter((e) => e.role === 'technician').length;
    const onDutyCount = activeCount; // demo

    const openCreate = () => {
        setEmployeeForm(EMPTY_EMPLOYEE);
        setCreateOpen(true);
    };

    const openEdit = (emp) => {
        setEmployeeForm({ ...emp, isTechnician: emp.role === 'technician' });
        setEditingId(emp.id);
        setEditOpen(true);
    };

    const reloadEmployees = () =>
        Promise.all([getTechnicians({}), getCashiers({})]).then(([techs, cashiers]) => {
            const t = (Array.isArray(techs) ? techs : (techs?.data ?? [])).map((u) => normalizeEmployee(u, 'technician'));
            const c = (Array.isArray(cashiers) ? cashiers : (cashiers?.data ?? [])).map((u) => normalizeEmployee(u, 'cashier'));
            setEmployees([...t, ...c]);
        });

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editOpen) {
                await updateUser(editingId, {
                    name: employeeForm.name,
                    email: employeeForm.email,
                    mobile: employeeForm.mobile,
                });
            } else if (employeeForm.role === 'technician') {
                await createTechnician({
                    name: employeeForm.name,
                    mobile: employeeForm.mobile,
                    email: employeeForm.email,
                    password: `Pass@${Date.now()}`,
                    technicianType: 'workshop',
                    commissionPercent: parseFloat(employeeForm.commissionPercent) || 0,
                });
            } else {
                await createCashier({
                    name: employeeForm.name,
                    mobile: employeeForm.mobile,
                    email: employeeForm.email,
                    password: `Pass@${Date.now()}`,
                });
            }
            await reloadEmployees();
            setCreateOpen(false);
            setEditOpen(false);
            setEmployeeForm(EMPTY_EMPLOYEE);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const filtered = employees.filter((e) => {
        if (roleFilter !== 'All Roles' && e.role !== roleFilter.toLowerCase()) return false;
        if (statusFilter !== 'All Status' && e.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
        return true;
    });

    const EmployeeForm = () => (
        <div className="employee-form-container">
            <section className="form-section">
                <h4 className="form-section-title">BASIC INFORMATION</h4>
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                        type="text"
                        className="form-input-field"
                        placeholder="e.g. Al-Fahd Trading"
                        style={{ borderColor: '#FFD700' }}
                        value={employeeForm.name}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    />
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Mobile *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="05XXXXXXXX"
                            value={employeeForm.mobile}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, mobile: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder="email@example.com"
                            value={employeeForm.email}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                        />
                    </div>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Iqama / CNIC</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="Enter Iqama / CNIC"
                            value={employeeForm.iqama}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, iqama: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Branch</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.branch}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, branch: e.target.value })}
                            >
                                <option>Select branch</option>
                                <option>Petromin Services</option>
                                <option>Main Branch</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.role}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                            >
                                <option value="cashier">cashier</option>
                                <option value="technician">technician</option>
                                <option value="manager">manager</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Department</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.department || ''}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                            >
                                <option value="">Select department</option>
                                <option value="HR">HR</option>
                                <option value="IT">IT</option>
                                <option value="Finance">Finance</option>
                                <option value="Operations">Operations</option>
                                <option value="Sales">Sales</option>
                                <option value="Marketing">Marketing</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                </div>
            </section>

            <div className="section-divider" />

            <section className="form-section">
                <h4 className="form-section-title">TECHNICIAN SETTINGS</h4>
                <div className="technician-toggle-row">
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={employeeForm.isTechnician}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, isTechnician: e.target.checked })}
                        />
                        <span className="slider round"></span>
                    </label>
                    <span className="toggle-label">This employee is a Technician</span>
                </div>
            </section>

            <div className="section-divider" />

            <section className="form-section">
                <h4 className="form-section-title">FINANCIAL</h4>
                <div className="form-grid-three">
                    <div className="form-group">
                        <label className="form-label">Basic Salary (SAR)</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="0"
                            value={employeeForm.basicSalary}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, basicSalary: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Commission %</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="0"
                            value={employeeForm.commissionPercent}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, commissionPercent: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Commission Type</label>
                        <div className="select-wrapper">
                            <select
                                className="form-input-field"
                                value={employeeForm.commissionType}
                                onChange={(e) => setEmployeeForm({ ...employeeForm, commissionType: e.target.value })}
                            >
                                <option>% Revenue</option>
                                <option>Fixed Amount</option>
                            </select>
                            <ChevronDown size={16} className="select-icon" />
                        </div>
                    </div>
                </div>
                <div className="form-group" style={{ maxWidth: '240px' }}>
                    <label className="form-label">Status</label>
                    <div className="select-wrapper">
                        <select
                            className="form-input-field"
                            value={employeeForm.status}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}
                        >
                            <option>Active</option>
                            <option>Inactive</option>
                        </select>
                        <ChevronDown size={16} className="select-icon" />
                    </div>
                </div>
            </section>

            <div className="info-notice-box">
                Login credentials will be sent to the employee via SMS & Email on save.
            </div>
        </div>
    );

    return (
        <div className="employees-page module-container">
            <header className="employees-page-header">
                <div>
                    <h1 className="employees-title">Employees & Technicians</h1>
                    <p className="employees-subtitle">{total} total · {technicianCount} technicians · {activeCount} active</p>
                </div>
                <button type="button" className="btn-portal" onClick={openCreate}><Plus size={16} /> Add Employee</button>
            </header>

            <div className="employees-stats">
                <div className="employees-stat-card"><span className="employees-stat-label">Total</span><span className="employees-stat-val">{total}</span></div>
                <div className="employees-stat-card"><span className="employees-stat-label">Active</span><span className="employees-stat-val">{activeCount}</span></div>
                <div className="employees-stat-card"><span className="employees-stat-label">Technicians</span><span className="employees-stat-val">{technicianCount}</span></div>
                <div className="employees-stat-card"><span className="employees-stat-label">On Duty</span><span className="employees-stat-val">{onDutyCount}</span></div>
            </div>

            <div className="employees-filters">
                <button type="button" className={`employees-filter-pill ${roleFilter === 'All Roles' ? 'active' : ''}`} onClick={() => setRoleFilter('All Roles')}>All Roles</button>
                <button type="button" className={`employees-filter-pill ${roleFilter === 'cashier' ? 'active' : ''}`} onClick={() => setRoleFilter('cashier')}>Cashier</button>
                <button type="button" className={`employees-filter-pill ${roleFilter === 'technician' ? 'active' : ''}`} onClick={() => setRoleFilter('technician')}>Technician</button>
                <button type="button" className={`employees-filter-pill ${statusFilter === 'All Status' ? 'active' : ''}`} onClick={() => setStatusFilter('All Status')}>All Status</button>
                <button type="button" className={`employees-filter-pill ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
            </div>

            <section className="premium-table employees-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Employee</th>
                            <th className="table-th">Mobile</th>
                            <th className="table-th">Role</th>
                            <th className="table-th">Department</th>
                            <th className="table-th">Technician Type</th>
                            <th className="table-th">Branch</th>
                            <th className="table-th">Commission</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : filtered.map((emp) => (
                            <tr key={emp.id} className="table-row">
                                <td className="table-cell">
                                    <div className="employee-cell">
                                        <span className="employee-avatar">{emp.name.charAt(0)}</span>
                                        <div>
                                            <span className="cell-main-text">{emp.name}</span>
                                            {emp.role === 'technician' && <span className="employee-tech-badge">Tech</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="table-cell">{emp.mobile || '–'}</td>
                                <td className="table-cell" style={{ textTransform: 'capitalize' }}>{emp.role}</td>
                                <td className="table-cell">{emp.department || '–'}</td>
                                <td className="table-cell">{emp.technicianType || '–'}</td>
                                <td className="table-cell">{emp.branch}</td>
                                <td className="table-cell">{emp.commission}</td>
                                <td className="table-cell"><span className={`status-badge ${emp.status.toLowerCase() === 'active' ? 'status-completed' : 'status-warning'}`}>{emp.status}</span></td>
                                <td className="table-cell">
                                    <button type="button" className="btn-edit" onClick={() => openEdit(emp)}>
                                        <Pencil size={14} /> Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {(createOpen || editOpen) && (
                    <Modal
                        title={editOpen ? "Edit Employee" : "Add New Employee"}
                        onClose={() => { setCreateOpen(false); setEditOpen(false); }}
                        className="employee-modal-wide"
                        footer={
                            <div className="modal-footer-actions">
                                <button type="button" className="btn-secondary" onClick={() => { setCreateOpen(false); setEditOpen(false); }}>Cancel</button>
                                <button type="button" className="btn-portal btn-black" onClick={handleSave} disabled={saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Saving…</> : editOpen ? 'Save Changes' : 'Create Employee'}
                                </button>
                            </div>
                        }
                    >
                        <EmployeeForm />
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
