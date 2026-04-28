import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Key, Plus, MapPin, Phone, Mail, Users, Edit, RefreshCw } from 'lucide-react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';
import {
    BRANCH_PERMISSIONS,
    MOCK_ROLE_PERMISSIONS,
    MOCK_EMPLOYEES,
} from './constants';

function BranchFormModal({ branch, onClose, onSave }) {
    const [form, setForm] = useState({
        name: branch?.name || '', code: branch?.code || '', address: branch?.address || '', phone: branch?.phone || '',
        email: branch?.email || '', vat_id: branch?.vat_id || '', cr_no: branch?.cr_no || '', contact_person: branch?.contact_person || '', status: branch?.status || 'active',
        gpsLat: branch?.gpsLat || '', gpsLng: branch?.gpsLng || '',
    });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const handleSave = () => { onSave?.({ ...form, id: branch?.id }); onClose(); };
    return (
        <Modal title={branch?.id ? 'Edit Branch' : 'New Branch Portal'} onClose={onClose} width="520px"
            footer={<>
                <button className="btn-portal-outline" onClick={onClose}>Cancel</button>
                <button className="btn-portal" disabled={!form.name} onClick={handleSave}>{branch?.id ? 'Update Branch' : 'Create Branch'}</button>
            </>}>
            <div style={{ fontSize: '0.875rem' }}>
                <p style={{ padding: '12px 14px', background: '#EFF6FF', borderRadius: 10, color: '#1E40AF', margin: '0 0 16px', fontSize: '0.75rem' }}>
                    Each branch gets its own <strong>Branch Portal</strong> and <strong>POS</strong>. The Workshop Owner Admin can grant Branch Admins access to permitted sections only.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch Name *</label>
                        <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Riyadh Main Branch" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/>
                    </div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch Code</label><input type="text" value={form.code} onChange={e => set('code', e.target.value)} placeholder="e.g. RYD-001" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Phone</label><input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+966..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>GPS Latitude</label><input type="number" value={form.gpsLat} onChange={e => set('gpsLat', e.target.value)} placeholder="e.g. 24.7136" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>GPS Longitude</label><input type="number" value={form.gpsLng} onChange={e => set('gpsLng', e.target.value)} placeholder="e.g. 46.6753" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>VAT ID</label><input type="text" value={form.vat_id} onChange={e => set('vat_id', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CR Number</label><input type="text" value={form.cr_no} onChange={e => set('cr_no', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Contact Person</label><input type="text" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Address</label><textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', resize: 'vertical' }}/></div>
                </div>
            </div>
        </Modal>
    );
}

function AccessPermissionFormModal({ branches, onClose, onSave }) {
    const [form, setForm] = useState({ branch_id: '', admin_name: '', admin_email: '', permissions: [] });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const togglePerm = (key) => setForm(f => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key] }));
    const handleSave = () => {
        const branch = branches?.find(b => b.id === form.branch_id);
        onSave?.({ branch_id: form.branch_id, admin_name: form.admin_name, admin_email: form.admin_email, permissions: form.permissions, branchName: branch?.name });
        onClose();
    };
    return (
        <Modal title="Grant Branch Admin Access" onClose={onClose} width="420px"
            footer={<>
                <button className="btn-portal-outline" onClick={onClose}>Cancel</button>
                <button className="btn-portal" disabled={!form.branch_id || form.permissions.length === 0} onClick={handleSave}>Grant Access</button>
            </>}>
            <div style={{ fontSize: '0.875rem' }}>
                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch *</label>
                    <select value={form.branch_id} onChange={e => set('branch_id', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                        <option value="">Select branch</option>
                        {branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Admin Name</label><input type="text" value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Full name" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                    <div><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Admin Email</label><input type="email" value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@branch.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}/></div>
                </div>
                <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Permitted Sections</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {BRANCH_PERMISSIONS.map(p => {
                            const Icon = p.icon;
                            const checked = form.permissions.includes(p.key);
                            return (
                                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${checked ? '#3B82F6' : 'var(--color-border)'}`, background: checked ? '#EFF6FF' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePerm(p.key)}/>
                                    <Icon size={16} style={{ color: checked ? '#2563EB' : 'var(--color-text-muted)' }}/>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: checked ? 600 : 500, color: checked ? '#1E40AF' : 'var(--color-text-body)' }}>{p.label}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default function WorkshopBranches() {
    const [branches, setBranches] = useState([]);
    const [rolePermissions, setRolePermissions] = useState(MOCK_ROLE_PERMISSIONS);
    const [activeTab, setActiveTab] = useState('branches');
    const [showBranchForm, setShowBranchForm] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const [showAccessForm, setShowAccessForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [isSavingBranch, setIsSavingBranch] = useState(false);
    const getBranchPerm = (branchId) => rolePermissions.find(r => r.role_name === `branch_admin_${branchId}`);
    const countEmployees = (branch) => MOCK_EMPLOYEES.filter(e => e.branch === branch.name).length;

    const loadBranches = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await apiFetch('/workshop-staff/branches');
            if (!(response?.success && Array.isArray(response.branches))) {
                throw new Error('Invalid branches response.');
            }
            setBranches(response.branches.map((branch) => ({
                ...branch,
                status: branch.isActive ? 'active' : 'inactive',
            })));
        } catch (error) {
            setLoadError(error.message || 'Failed to load branches.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    const handleBranchSave = async (data) => {
        if (data.id) {
            // Edit endpoint is not wired yet; keep local update for now.
            setBranches(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
            return;
        }

        setIsSavingBranch(true);
        setLoadError('');
        try {
            await apiFetch('/workshop-staff/branch/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: data.name,
                    address: data.address || '',
                    gpsLat: Number(data.gpsLat) || 0,
                    gpsLng: Number(data.gpsLng) || 0,
                    isActive: data.status !== 'inactive',
                }),
            });
            await loadBranches();
        } catch (error) {
            setLoadError(error.message || 'Failed to create branch.');
        } finally {
            setIsSavingBranch(false);
        }
    };
    const handleAccessSave = (data) => {
        setRolePermissions(prev => [...prev, {
            id: Date.now(), role_name: `branch_admin_${data.branch_id}`,
            permissions: data.permissions,
            description: `Branch Admin: ${data.admin_name || '—'} (${data.admin_email || '—'}) — ${data.branchName || '—'}`,
        }]);
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Branches & Access Control</h2><p className="ws-page-sub">Manage branch portals and grant Branch Admin permissions</p></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-portal-outline" onClick={loadBranches} disabled={isLoading}><RefreshCw size={15}/>{isLoading ? 'Refreshing...' : 'Refresh'}</button>
                    <button className="btn-portal-outline" onClick={() => setShowAccessForm(true)}><Key size={15}/> Grant Access</button>
                    <button className="btn-portal" onClick={() => { setEditBranch(null); setShowBranchForm(true); }} disabled={isSavingBranch}>
                        <Plus size={15}/> {isSavingBranch ? 'Creating...' : 'New Branch'}
                    </button>
                </div>
            </div>
            {loadError && (
                <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                    {loadError}
                </div>
            )}
            <div className="ws-branches-tabs">
                <button className={`ws-branches-tab ${activeTab === 'branches' ? 'active' : ''}`} onClick={() => setActiveTab('branches')}>Branch Portals</button>
                <button className={`ws-branches-tab ${activeTab === 'access' ? 'active' : ''}`} onClick={() => setActiveTab('access')}>Access Permissions</button>
            </div>

            {activeTab === 'branches' && (
                branches.length === 0 ? (
                    <div className="ws-empty">
                        <Building2 size={48} className="ws-empty-icon"/>
                        <p className="ws-empty-text" style={{ fontWeight: 600 }}>No branches yet. Create your first branch portal.</p>
                    </div>
                ) : (
                    <div className="ws-branches-grid">
                        {branches.map(branch => {
                            const perm = getBranchPerm(branch.id);
                            const empCount = countEmployees(branch);
                            return (
                                <div key={branch.id} className="ws-branch-card">
                                    <div className="ws-branch-card-body">
                                        <div className="ws-branch-header">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div className="ws-branch-icon-wrap"><Building2 size={20}/></div>
                                                <div>
                                                    <p className="ws-branch-name">{branch.name}</p>
                                                    {branch.code && <p className="ws-branch-code">{branch.code}</p>}
                                                </div>
                                            </div>
                                            <span className="ws-branch-badge-active">{branch.status}</span>
                                        </div>
                                        <div className="ws-branch-contact">
                                            {branch.address && <div className="ws-branch-contact-row"><MapPin size={14}/><span>{branch.address}</span></div>}
                                            {branch.phone && <div className="ws-branch-contact-row"><Phone size={14}/><span>{branch.phone}</span></div>}
                                            {branch.email && <div className="ws-branch-contact-row"><Mail size={14}/><span>{branch.email}</span></div>}
                                        </div>
                                        <div className="ws-branch-emp-row">
                                            <Users size={16}/>
                                            <span>{empCount} employees</span>
                                            <span className={`ws-branch-admin-badge ${perm ? 'set' : 'none'}`}>{perm ? 'Admin set' : 'No admin'}</span>
                                        </div>
                                        {perm && (perm.permissions || []).length > 0 && (
                                            <div className="ws-branch-perms">
                                                {(perm.permissions || []).map(p => <span key={p} className="ws-branch-perm-tag">{p}</span>)}
                                            </div>
                                        )}
                                        <div className="ws-branch-actions">
                                            <button type="button" className="ws-branch-btn-edit" onClick={() => { setEditBranch(branch); setShowBranchForm(true); }}><Edit size={14}/> Edit</button>
                                            <button type="button" className="ws-branch-btn-access" onClick={() => setShowAccessForm(true)}><Key size={14}/> Set Access</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'access' && (
                <div className="ws-section">
                    {rolePermissions.filter(r => r.role_name?.startsWith('branch_admin_')).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                            <Key size={48} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }}/>
                            <p style={{ margin: '0 0 16px', fontWeight: 600 }}>No branch admin access configured yet.</p>
                            <button className="btn-portal" style={{ background: '#D97706', color: '#fff' }} onClick={() => setShowAccessForm(true)}><Key size={15}/> Grant Branch Access</button>
                        </div>
                    ) : (
                        <table className="ws-table">
                            <thead><tr><th>Branch</th><th>Permitted Sections</th><th>Description</th></tr></thead>
                            <tbody>
                                {rolePermissions.filter(r => r.role_name?.startsWith('branch_admin_')).map(rp => {
                                    const branchId = rp.role_name.replace('branch_admin_', '');
                                    const branch = branches.find(b => b.id === branchId);
                                    return (
                                        <tr key={rp.id}><td style={{ fontWeight: 700 }}>{branch?.name || branchId}</td>
                                            <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(rp.permissions || []).map(p => <span key={p} className="ws-badge ws-badge--blue">{p}</span>)}</div></td>
                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{rp.description}</td></tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {showBranchForm && <BranchFormModal branch={editBranch} onClose={() => { setShowBranchForm(false); setEditBranch(null); }} onSave={handleBranchSave}/>}
            {showAccessForm && <AccessPermissionFormModal branches={branches} onClose={() => setShowAccessForm(false)} onSave={handleAccessSave}/>}
        </div>
    );
}
