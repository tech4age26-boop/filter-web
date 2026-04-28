import { useMemo, useState, useEffect } from 'react';
import { Plus, Building2, MapPin, Phone, Mail, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/BranchesPage.css';
import { getBranches, createBranch, updateBranch, getWorkshops } from '../../services/superAdminApi';

export default function BranchesPage() {
    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Promise.all([
            getBranches({}),
            getWorkshops({ limit: '100', offset: '0' }),
        ]).then(([branchData, workshopData]) => {
            setBranches(Array.isArray(branchData) ? branchData : (branchData?.branches ?? []));
            setWorkshops(Array.isArray(workshopData) ? workshopData : (workshopData?.workshops ?? []));
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [newBranch, setNewBranch] = useState({
        name: '',
        code: '',
        address: '',
        gps: '',
        contactPerson: '',
        phone: '',
        email: '',
        vatId: '',
        crNo: '',
        status: 'active',
        primaryWorkshop: '',
        workshops: [],
    });
    const [editingBranch, setEditingBranch] = useState(null);

    const openEdit = (b) => {
        setEditingBranch({ ...b });
        setEditOpen(true);
    };
    const refreshBranches = () =>
        getBranches({}).then((d) => setBranches(Array.isArray(d) ? d : (d?.branches ?? [])));

    const handleSaveNew = async () => {
        setSaving(true);
        try {
            const ws = workshops.find((w) => w.name === newBranch.primaryWorkshop);
            await createBranch({
                workshopId: ws?.id ?? ws?._id,
                name: newBranch.name,
                branchCode: newBranch.code,
                address: newBranch.address,
                gpsLat: newBranch.gps ? parseFloat(newBranch.gps.split(',')[0]) : undefined,
                gpsLng: newBranch.gps ? parseFloat(newBranch.gps.split(',')[1]) : undefined,
                contactPerson: newBranch.contactPerson,
                phone: newBranch.phone,
                email: newBranch.email,
                vatId: newBranch.vatId,
                crNumber: newBranch.crNo,
                isActive: newBranch.status === 'active',
            });
            await refreshBranches();
            setCreateOpen(false);
            setNewBranch({ name: '', code: '', address: '', gps: '', contactPerson: '', phone: '', email: '', vatId: '', crNo: '', status: 'active', primaryWorkshop: '', workshops: [] });
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingBranch) return;
        setSaving(true);
        try {
            await updateBranch(editingBranch.id ?? editingBranch._id, {
                name: editingBranch.name,
                branchCode: editingBranch.code,
                address: editingBranch.address,
                contactPerson: editingBranch.contactPerson,
                phone: editingBranch.phone,
                email: editingBranch.email,
                vatId: editingBranch.vatId,
                crNumber: editingBranch.crNo,
                isActive: editingBranch.status === 'active',
            });
            await refreshBranches();
            setEditOpen(false);
            setEditingBranch(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const WorkshopMultiSelect = ({ value = [], onChange, options = [] }) => {
        const [open, setOpen] = useState(false);
        const [q, setQ] = useState('');
        const filtered = useMemo(() => options.filter(o => o.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);
        const selected = Array.isArray(value) ? value : [];

        const toggle = (opt) => {
            const next = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt];
            onChange(next);
        };

        return (
            <div className="wsms">
                <button type="button" className="wsms-trigger" onClick={() => setOpen(v => !v)}>
                    <div className="wsms-chips">
                        {selected.length === 0 ? (
                            <span className="wsms-placeholder">Select workshops…</span>
                        ) : (
                            selected.slice(0, 3).map((s) => (
                                <span key={s} className="wsms-chip">
                                    {s}
                                    <span
                                        className="wsms-chip-x"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(s); }}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        ×
                                    </span>
                                </span>
                            ))
                        )}
                        {selected.length > 3 && <span className="wsms-more">+{selected.length - 3} more</span>}
                    </div>
                    <span className="wsms-caret">{open ? '▴' : '▾'}</span>
                </button>

                {open && (
                    <div className="wsms-pop">
                        <input
                            className="wsms-search"
                            placeholder="Search workshops…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            autoFocus
                        />
                        <div className="wsms-list">
                            {filtered.length === 0 ? (
                                <div className="wsms-empty">No results</div>
                            ) : (
                                filtered.map((opt) => {
                                    const checked = selected.includes(opt);
                                    return (
                                        <button
                                            key={opt}
                                            type="button"
                                            className={`wsms-item ${checked ? 'checked' : ''}`}
                                            onClick={() => toggle(opt)}
                                        >
                                            <span className={`wsms-box ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</span>
                                            <span className="wsms-label">{opt}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        <div className="wsms-footer">
                            <button type="button" className="wsms-clear" onClick={() => onChange([])} disabled={selected.length === 0}>Clear</button>
                            <button type="button" className="wsms-done" onClick={() => setOpen(false)}>Done</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="branches-page module-container">
            <header className="branches-page-header">
                <div>
                    <h1 className="branches-title">Branches</h1>
                    <p className="branches-count">{branches.length} branches</p>
                </div>
                <button type="button" className="btn-portal" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add Branch</button>
            </header>
            <section className="premium-table branches-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Branch</th>
                            <th className="table-th">Address</th>
                            <th className="table-th">Main Workshop</th>
                            <th className="table-th">Contact</th>
                            <th className="table-th">VAT ID</th>
                            <th className="table-th">CR No</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : branches.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="table-cell table-empty">No branches yet. Add your first branch.</td>
                            </tr>
                        ) : (
                            branches.map((b) => (
                                <tr key={b.id} className="table-row">
                                    <td className="table-cell">
                                        <div className="branch-info-cell">
                                            <div className="branch-icon-box">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <p className="branch-name">{b.name}</p>
                                                <p className="branch-code-sub">{b.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="address-info-cell">
                                            <MapPin size={14} className="info-icon" />
                                            <span className="address-text">{b.address}</span>
                                        </div>
                                    </td>
                                    <td className="table-cell">{b.primaryWorkshop || '—'}</td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            <div className="contact-item">
                                                <Phone size={14} className="info-icon" />
                                                <span>{b.phone}</span>
                                            </div>
                                            <div className="contact-item">
                                                <Mail size={14} className="info-icon" />
                                                <span>{b.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">{b.vatId}</td>
                                    <td className="table-cell">{b.crNo}</td>
                                    <td className="table-cell"><span className="status-badge status-completed">{b.status}</span></td>
                                    <td className="table-cell"><button type="button" className="btn-edit" onClick={() => openEdit(b)}>Edit</button></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {createOpen && (
                    <Modal
                        title="Add New Branch"
                        onClose={() => setCreateOpen(false)}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
                                <button type="button" className="btn-submit-branch" onClick={handleSaveNew} disabled={saving}>
                            {saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Create Branch'}
                        </button>
                            </>
                        }
                    >
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Branch Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Enter branch name"
                                    value={newBranch.name}
                                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch Code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g., RYD-01"
                                    value={newBranch.code}
                                    onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Main Workshop</label>
                                <select
                                    className="form-input-field"
                                    value={newBranch.primaryWorkshop}
                                    onChange={(e) => setNewBranch({ ...newBranch, primaryWorkshop: e.target.value })}
                                >
                                    <option value="">Select workshop</option>
                                    {workshops.map((w) => <option key={w.id ?? w._id} value={w.name}>{w.name}</option>)}
                                </select>
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Single selection (default workshop).</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Workshops (Multiple)</label>
                                <WorkshopMultiSelect
                                    options={workshops.map((w) => w.name)}
                                    value={newBranch.workshops}
                                    onChange={(next) => setNewBranch({ ...newBranch, workshops: next })}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Select multiple workshops linked to this branch.</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input
                                type="text"
                                className="form-input-field"
                                placeholder="Full address"
                                value={newBranch.address}
                                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                            />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">GPS Location</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="lat,lng"
                                    value={newBranch.gps}
                                    onChange={(e) => setNewBranch({ ...newBranch, gps: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contact Person</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Name"
                                    value={newBranch.contactPerson}
                                    onChange={(e) => setNewBranch({ ...newBranch, contactPerson: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Phone number"
                                    value={newBranch.phone}
                                    onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input-field"
                                    placeholder="Email address"
                                    value={newBranch.email}
                                    onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">VAT ID</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="VAT number"
                                    value={newBranch.vatId}
                                    onChange={(e) => setNewBranch({ ...newBranch, vatId: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CR Number</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="Commercial registration"
                                    value={newBranch.crNo}
                                    onChange={(e) => setNewBranch({ ...newBranch, crNo: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={newBranch.status}
                                onChange={(e) => setNewBranch({ ...newBranch, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}

                {editOpen && editingBranch && (
                    <Modal
                        title="Edit Branch"
                        onClose={() => { setEditOpen(false); setEditingBranch(null); }}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={() => { setEditOpen(false); setEditingBranch(null); }}>Cancel</button>
                                <button type="button" className="btn-submit-branch" onClick={handleSaveEdit} disabled={saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Update Branch'}
                                </button>
                            </>
                        }
                    >
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Branch Name *</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.name}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Branch Code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.code}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Main Workshop</label>
                                <select
                                    className="form-input-field"
                                    value={editingBranch.primaryWorkshop || ''}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, primaryWorkshop: e.target.value })}
                                >
                                    <option value="">Select workshop</option>
                                    {workshops.map((w) => <option key={w.id ?? w._id} value={w.name}>{w.name}</option>)}
                                </select>
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Single selection (default workshop).</p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Workshops (Multiple)</label>
                                <WorkshopMultiSelect
                                    options={workshops.map((w) => w.name)}
                                    value={editingBranch.workshops}
                                    onChange={(next) => setEditingBranch({ ...editingBranch, workshops: next })}
                                />
                                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Select multiple workshops linked to this branch.</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input
                                type="text"
                                className="form-input-field"
                                value={editingBranch.address}
                                onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                            />
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">GPS Location</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.gps}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, gps: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contact Person</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.contactPerson}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, contactPerson: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.phone}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-input-field"
                                    value={editingBranch.email}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">VAT ID</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.vatId}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, vatId: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CR Number</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editingBranch.crNo}
                                    onChange={(e) => setEditingBranch({ ...editingBranch, crNo: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={editingBranch.status}
                                onChange={(e) => setEditingBranch({ ...editingBranch, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
