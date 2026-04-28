import React, { useState } from 'react';
import { Users, Wrench, Radio, Plus, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MOCK_EMPLOYEES, MOCK_BRANCHES, ROLE_OPTIONS, COMMISSION_TYPE_OPTIONS } from './constants';

export default function WorkshopEmployees() {
    const [employees, setEmployees] = useState(MOCK_EMPLOYEES);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        full_name: '', mobile: '', email: '', iqama: '', branch: '', department: '', role: 'cashier',
        is_technician: false, technician_type: '', basic_salary: '', commission_percent: 0, commission_type: '% of Revenue',
        status: 'active',
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const openAdd = () => {
        setEditing(null);
        setForm({ full_name: '', mobile: '', email: '', iqama: '', branch: '', department: '', role: 'cashier', is_technician: false, technician_type: '', basic_salary: '', commission_percent: 0, commission_type: '% of Revenue', status: 'active' });
        setModalOpen(true);
    };
    const openEdit = (emp) => {
        setEditing(emp);
        const roleVal = (emp.role || '').toLowerCase().replace(/\s+/g, '_');
        const hasRole = ROLE_OPTIONS.includes(roleVal);
        setForm({
            full_name: emp.name, mobile: emp.phone || '', email: emp.email || '', iqama: emp.iqama || '', branch: emp.branch || '', department: emp.department || '',
            role: hasRole ? roleVal : 'technician',
            is_technician: !!emp.workshop_duty || (emp.role || '').toLowerCase().includes('technician') || (emp.role || '').toLowerCase().includes('specialist'),
            technician_type: emp.oncall_available ? 'on_call' : emp.workshop_duty ? 'workshop' : '',
            basic_salary: emp.basic_salary ?? '', commission_percent: emp.commission_percent ?? 0,
            commission_type: emp.commission_type || '% of Revenue',
            status: emp.status || 'active',
        });
        setModalOpen(true);
    };
    const handleSave = () => {
        if (!form.full_name || !form.mobile) return;
        const phone = form.mobile;
        const empData = {
            name: form.full_name, phone, email: form.email || undefined, iqama: form.iqama || undefined, branch: form.branch || undefined, department: form.department || undefined,
            role: form.role, workshop_duty: form.technician_type === 'workshop', oncall_available: form.technician_type === 'on_call',
            commission_percent: form.commission_percent || 0, commission_type: form.commission_type,
            basic_salary: form.basic_salary ? parseFloat(form.basic_salary) : undefined,
            status: form.status || 'active',
        };
        if (editing) {
            setEmployees(prev => prev.map(e => e.id === editing.id ? { ...e, ...empData } : e));
        } else {
            setEmployees(prev => [...prev, { id: Date.now(), ...empData }]);
        }
        setModalOpen(false);
    };
    const handleDelete = (id) => { if (confirm('Remove this employee?')) setEmployees(prev => prev.filter(e => e.id !== id)); };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Employees</h2><p className="ws-page-sub">Manage workshop technicians and staff</p></div>
                <button className="btn-portal" onClick={openAdd}><Plus size={15}/> Add New Employee</button>
            </div>
            <div className="ws-kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Total Staff</p><p className="ws-kpi-value">{employees.length}</p></div><div className="ws-kpi-icon ws-kpi-icon--blue"><Users size={22}/></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">On Workshop Duty</p><p className="ws-kpi-value">{employees.filter(e=>e.workshop_duty).length}</p></div><div className="ws-kpi-icon ws-kpi-icon--green"><Wrench size={22}/></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">On-Call</p><p className="ws-kpi-value">{employees.filter(e=>e.oncall_available).length}</p></div><div className="ws-kpi-icon ws-kpi-icon--purple"><Radio size={22}/></div></div>
            </div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Branch</th><th>Phone</th><th>Commission %</th><th>Workshop Duty</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{employees.map(emp => (
                        <tr key={emp.id}>
                            <td><strong>{emp.name}</strong></td><td>{emp.role}</td><td>{emp.department || '—'}</td><td>{emp.branch || '—'}</td><td>{emp.phone}</td>
                            <td>{emp.commission_percent}%</td>
                            <td><span className={`ws-badge ${emp.workshop_duty ? 'ws-badge--green' : 'ws-badge--gray'}`}>{emp.workshop_duty ? 'Active' : 'Off'}</span></td>
                            <td><span className={`ws-badge ${emp.status === 'active' ? 'ws-badge--green' : 'ws-badge--red'}`}>{emp.status}</span></td>
                            <td style={{display:'flex',gap:6}}>
                                <button onClick={() => openEdit(emp)} style={{padding:'5px 10px',background:'#EFF6FF',color:'#2563EB',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',fontSize:'0.75rem'}}><Pencil size={12}/></button>
                                <button onClick={() => handleDelete(emp.id)} style={{padding:'5px 10px',background:'#FEE2E2',color:'#DC2626',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',fontSize:'0.75rem'}}><Trash2 size={12}/></button>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <AnimatePresence>
                {modalOpen && (
                    <Modal title={editing ? 'Edit Employee' : 'Add New Employee'} onClose={() => setModalOpen(false)} footer={
                        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn-submit" onClick={handleSave}>Save</button>
                        </div>
                    }>
                        <div style={{display:'flex',flexDirection:'column',gap:14}}>
                            <div>
                                <div style={{fontSize:'0.75rem',fontWeight:800,color:'var(--color-text-muted)',letterSpacing:'0.08em'}}>BASIC INFORMATION</div>
                                <div className="ws-form-grid" style={{marginTop:10}}>
                                    <div className="ws-field"><label>Full Name *</label><input value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="Full Name" required/></div>
                                    <div className="ws-field"><label>Mobile *</label><input value={form.mobile} onChange={e=>set('mobile',e.target.value)} placeholder="05XXXXXXXX" required/></div>
                                    <div className="ws-field"><label>Email</label><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="Email"/></div>
                                    <div className="ws-field"><label>Iqama / CNIC</label><input value={form.iqama} onChange={e=>set('iqama',e.target.value)} placeholder="Iqama / CNIC"/></div>
                                    <div className="ws-field"><label>Branch</label><select value={form.branch} onChange={e=>set('branch',e.target.value)}><option value="">Select Branch</option>{MOCK_BRANCHES.map(b=><option key={b} value={b}>{b}</option>)}</select></div>
                                    <div className="ws-field"><label>Role</label><select value={form.role} onChange={e=>set('role',e.target.value)}>{ROLE_OPTIONS.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
                                    <div className="ws-field"><label>Department</label><select value={form.department} onChange={e=>set('department',e.target.value)}><option value="">Select Department</option><option value="HR">HR</option><option value="IT">IT</option><option value="Finance">Finance</option><option value="Operations">Operations</option><option value="Sales">Sales</option><option value="Marketing">Marketing</option></select></div>
                                </div>
                            </div>

                            <div style={{height:1,background:'var(--color-border-light)'}}/>

                            <div>
                                <div style={{fontSize:'0.75rem',fontWeight:800,color:'var(--color-text-muted)',letterSpacing:'0.08em'}}>TECHNICIAN SETTINGS</div>
                                <div style={{display:'flex',alignItems:'center',gap:10,marginTop:10,flexWrap:'wrap'}}>
                                    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:700,fontSize:'0.875rem'}}>
                                        <input type="checkbox" checked={form.is_technician} onChange={e=>set('is_technician',e.target.checked)}/>
                                        This employee is a Technician
                                    </label>
                                </div>
                                {form.is_technician && (
                                    <div style={{marginTop:10}}>
                                        <div style={{fontSize:'0.6875rem',fontWeight:800,color:'var(--color-text-muted)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>Technician Type</div>
                                        <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
                                            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600,fontSize:'0.875rem'}}>
                                                <input type="radio" name="technician_type" checked={form.technician_type==='workshop'} onChange={()=>set('technician_type','workshop')}/>
                                                Workshop
                                            </label>
                                            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600,fontSize:'0.875rem'}}>
                                                <input type="radio" name="technician_type" checked={form.technician_type==='on_call'} onChange={()=>set('technician_type','on_call')}/>
                                                On-Call
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{height:1,background:'var(--color-border-light)'}}/>

                            <div>
                                <div style={{fontSize:'0.75rem',fontWeight:800,color:'var(--color-text-muted)',letterSpacing:'0.08em'}}>FINANCIAL</div>
                                <div className="ws-form-grid" style={{marginTop:10}}>
                                    <div className="ws-field"><label>Basic Salary (SAR)</label><input type="number" value={form.basic_salary} onChange={e=>set('basic_salary',e.target.value)} placeholder="0"/></div>
                                    <div className="ws-field"><label>Commission %</label><input type="number" value={form.commission_percent} onChange={e=>set('commission_percent',parseFloat(e.target.value)||0)} placeholder="0"/></div>
                                    <div className="ws-field"><label>Commission Type</label><select value={form.commission_type} onChange={e=>set('commission_type',e.target.value)}>{COMMISSION_TYPE_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                                    <div className="ws-field"><label>Status</label><select value={form.status} onChange={e=>set('status',e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                                </div>
                            </div>

                            <div className="ws-section" style={{padding:'12px 14px',margin:0,background:'#FFFBEB',border:'1px solid #FDE68A',color:'#92400E',borderRadius:12,fontWeight:700,fontSize:'0.8125rem'}}>
                                Login credentials will be sent to the employee via SMS & Email on save.
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
