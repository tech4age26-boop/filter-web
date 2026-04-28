import { useState, useEffect } from 'react';
import { Plus, Wrench, MessageSquare, Phone, Mail, Save, Loader } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/BranchesPage.css';
import '../../styles/admin/WorkshopManagementPage.css';
import { getWorkshops, createWorkshop } from '../../services/superAdminApi';

const STORAGE_KEY_TEMPLATE = 'workshop-welcome-template';
const DEFAULT_TEMPLATE = `Hey {{name}},

Please log in to your Workshop Portal using the credentials we've shared. You can change your password after your first login.

Best regards`;

function formatPhoneForWhatsApp(phone) {
    if (!phone || !String(phone).trim()) return '';
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '966' + p.slice(1);
    else if (!p.startsWith('966')) p = '966' + p;
    return p;
}

function buildMessage(template, workshop) {
    return template
        .replace(/\{\{name\}\}/gi, workshop.contactName || workshop.name || '')
        .replace(/\{\{email\}\}/gi, workshop.email || '')
        .replace(/\{\{password\}\}/gi, workshop.password || '')
        .replace(/\{\{login_url\}\}/gi, window.location.origin + '/workshop')
        .trim();
}

export default function WorkshopManagementPage() {
    const [workshops, setWorkshops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [detailWorkshop, setDetailWorkshop] = useState(null);

    useEffect(() => {
        getWorkshops({ limit: '100', offset: '0' })
            .then((data) => setWorkshops(Array.isArray(data) ? data : (data?.workshops ?? [])))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);
    const [template, setTemplate] = useState(() => localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE);
    const [templateEdit, setTemplateEdit] = useState(template);
    const [templateSaved, setTemplateSaved] = useState(false);
    const [newWorkshop, setNewWorkshop] = useState({
        name: '',
        workshopCode: '',
        branchName: '',
        vatId: '',
        crNumber: '',
        street: '',
        city: '',
        postalCode: '',
        gpsLat: null,
        gpsLng: null,
        contactName: '',
        phone: '',
        email: '',
        ownerUserEmail: '',
        password: '',
        referralPerson: '',
        investmentAmount: '',
        status: 'active',
    });

    const [isDetectingLocation, setIsDetectingLocation] = useState(false);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_TEMPLATE, template);
    }, [template]);

    const handleSaveTemplate = () => {
        setTemplate(templateEdit);
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 2000);
    };

    const handleAddWorkshop = async () => {
        if (!newWorkshop.name || !newWorkshop.phone) return;
        setSaving(true);
        try {
            await createWorkshop({
                name: newWorkshop.name,
                workshopCode: newWorkshop.workshopCode || undefined,
                ownerName: newWorkshop.contactName,
                mobile: newWorkshop.phone,
                email: newWorkshop.email,
                taxId: newWorkshop.vatId || undefined,
                crNumber: newWorkshop.crNumber || undefined,
                address: [newWorkshop.street, newWorkshop.city, newWorkshop.postalCode].filter(Boolean).join(', '),
                gpsLat: newWorkshop.gpsLat || undefined,
                gpsLng: newWorkshop.gpsLng || undefined,
                ownerUserEmail: newWorkshop.ownerUserEmail || newWorkshop.email,
                ownerUserPassword: newWorkshop.password,
                createDefaultBranch: !!newWorkshop.branchName,
                defaultBranchName: newWorkshop.branchName || undefined,
            });
            const fresh = await getWorkshops({ limit: '100', offset: '0' });
            setWorkshops(Array.isArray(fresh) ? fresh : (fresh?.workshops ?? []));
            setAddOpen(false);
            setNewWorkshop({ name: '', workshopCode: '', branchName: '', vatId: '', crNumber: '', street: '', city: '', postalCode: '', gpsLat: null, gpsLng: null, contactName: '', phone: '', email: '', ownerUserEmail: '', password: '', referralPerson: '', investmentAmount: '', status: 'active' });
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDetectGPS = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                
                if (data && data.address) {
                    setNewWorkshop(prev => ({
                        ...prev,
                        gpsLat: latitude,
                        gpsLng: longitude,
                        street: data.address.road || data.address.suburb || `${latitude}, ${longitude}`,
                        city: data.address.city || data.address.town || data.address.state || '',
                        postalCode: data.address.postcode || ''
                    }));
                } else {
                    setNewWorkshop(prev => ({ ...prev, gpsLat: latitude, gpsLng: longitude, street: `${latitude}, ${longitude}` }));
                }
            } catch (error) {
                console.error('Error fetching location:', error);
                setNewWorkshop(prev => ({ ...prev, street: `${latitude}, ${longitude}` }));
            } finally {
                setIsDetectingLocation(false);
            }
        }, (error) => {
            alert('Unable to retrieve your location. Please verify your browser permissions.');
            setIsDetectingLocation(false);
        }, { timeout: 10000 });
    };

    const openWhatsApp = (workshop) => {
        const phone = formatPhoneForWhatsApp(workshop.phone);
        if (!phone) return;
        const text = buildMessage(template, workshop);
        const url = `https://wa.me/${phone}${text ? '?text=' + encodeURIComponent(text) : ''}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="workshop-mgmt-page module-container">
            <header className="branches-page-header">
                <div>
                    <h1 className="branches-title">Workshop</h1>
                    <p className="branches-count">Add workshops and send login details via WhatsApp</p>
                </div>
                <button type="button" className="btn-portal" onClick={() => setAddOpen(true)}>
                    <Plus size={16} /> Add Workshop
                </button>
            </header>

            {/* Message template section */}
            <section className="workshop-mgmt-template-section">
                <div className="workshop-mgmt-template-header">
                    <MessageSquare size={20} className="workshop-mgmt-template-icon" />
                    <div>
                        <h2 className="workshop-mgmt-template-title">WhatsApp welcome message template</h2>
                        <p className="workshop-mgmt-template-desc">Use <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{password}}'}</code>, <code>{'{{login_url}}'}</code> as placeholders.</p>
                    </div>
                    <button type="button" className="btn-save-template" onClick={handleSaveTemplate}>
                        <Save size={16} /> {templateSaved ? 'Saved!' : 'Save template'}
                    </button>
                </div>
                <textarea
                    className="workshop-mgmt-template-textarea"
                    value={templateEdit}
                    onChange={(e) => setTemplateEdit(e.target.value)}
                    placeholder="Hey {{name}}, ..."
                    rows={5}
                />
            </section>

            <section className="premium-table branches-table workshop-mgmt-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Workshop</th>
                            <th className="table-th">Contact</th>
                            <th className="table-th">Phone</th>
                            <th className="table-th">Email</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : workshops.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="table-cell table-empty">No workshops yet. Add your first workshop.</td>
                            </tr>
                        ) : (
                            workshops.map((w) => (
                                <tr key={w.id} className="table-row" style={{ cursor: 'pointer' }} onClick={() => setDetailWorkshop(w)}>
                                    <td className="table-cell">
                                        <div className="branch-info-cell">
                                            <div className="branch-icon-box workshop-icon-box">
                                                <Wrench size={18} />
                                            </div>
                                            <div>
                                                <p className="branch-name">{w.name}</p>
                                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{w.address || '—'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">{w.ownerName || '—'}</td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            <div className="contact-item">
                                                <Phone size={14} className="info-icon" />
                                                <span>{w.mobile || '—'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            <div className="contact-item">
                                                <Mail size={14} className="info-icon" />
                                                <span>{w.email || '—'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${w.status === 'active' ? 'status-completed' : 'status-warning'}`}>{w.status}</span>
                                    </td>
                                    <td className="table-cell">
                                        <div className="workshop-mgmt-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="btn-whatsapp"
                                                onClick={() => openWhatsApp(w)}
                                                title="Send login message via WhatsApp"
                                            >
                                                <WhatsAppIcon />
                                                <span>WhatsApp</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            {/* Workshop Detail Modal */}
            <AnimatePresence>
                {detailWorkshop && (
                    <Modal
                        title={detailWorkshop.name}
                        onClose={() => setDetailWorkshop(null)}
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <button type="button" className="btn-whatsapp" onClick={() => openWhatsApp(detailWorkshop)}>
                                        <WhatsAppIcon /> <span>WhatsApp</span>
                                    </button>
                                </div>
                                <button type="button" className="btn-secondary" onClick={() => setDetailWorkshop(null)}>Close</button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Basic Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { label: 'Owner Name', value: detailWorkshop.ownerName },
                                    { label: 'Mobile', value: detailWorkshop.mobile },
                                    { label: 'Email', value: detailWorkshop.email },
                                    { label: 'Tax ID', value: detailWorkshop.taxId },
                                    { label: 'Currency', value: `${detailWorkshop.currencyCode} (VAT ${detailWorkshop.vatPercent}%)` },
                                    { label: 'Status', value: detailWorkshop.status },
                                    { label: 'Address', value: detailWorkshop.address },
                                    { label: 'Registered', value: detailWorkshop.createdAt ? new Date(detailWorkshop.createdAt).toLocaleDateString() : '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                                        <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                        <p style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{value || '—'}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Stats */}
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>Platform Stats</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                    {[
                                        { label: 'Branches', value: detailWorkshop.branchesCount },
                                        { label: 'Employees', value: detailWorkshop.employeesCount },
                                        { label: 'Technicians', value: detailWorkshop.techniciansCount },
                                        { label: 'Cashiers', value: detailWorkshop.cashiersCount },
                                        { label: 'Customers', value: detailWorkshop.customersCount },
                                        { label: 'Products', value: detailWorkshop.productsCount },
                                        { label: 'Services', value: detailWorkshop.servicesCount },
                                        { label: 'Sales Orders', value: detailWorkshop.salesOrdersCount },
                                    ].map(({ label, value }) => (
                                        <div key={label} style={{ textAlign: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '10px 6px' }}>
                                            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{value ?? 0}</p>
                                            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Branches */}
                            {detailWorkshop.branches?.length > 0 && (
                                <div>
                                    <p style={{ fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>Branches</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {detailWorkshop.branches.map((b) => (
                                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '8px', padding: '8px 14px' }}>
                                                <span style={{ fontWeight: 500 }}>{b.name}</span>
                                                <span className={`status-badge ${b.isActive ? 'status-completed' : 'status-cancelled'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {addOpen && (
                    <Modal
                        title="Add Workshop"
                        onClose={() => setAddOpen(false)}
                        className="add-workshop-modal"
                        footer={
                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '15px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                                    <strong>Note:</strong> After submitting, your request will be reviewed by the Super Admin. Once approved, sign in using your mobile number and the password you set above.
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                                    <button type="button" className="btn-submit-branch" onClick={handleAddWorkshop} disabled={!newWorkshop.name || !newWorkshop.phone || saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Submit Registration'}
                                </button>
                                </div>
                            </div>
                        }
                    >
                        <div className="workshop-form-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '10px' }}>
                            {/* Workshop Details */}
                            <div className="form-section-header" style={{ marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Workshop Details
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Workshop Name*</label>
                                    <input type="text" className="form-input-field" placeholder="Workshop Name"
                                        value={newWorkshop.name} onChange={(e) => setNewWorkshop({ ...newWorkshop, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Workshop Code</label>
                                    <input type="text" className="form-input-field" placeholder="e.g. PETROM3567"
                                        value={newWorkshop.workshopCode} onChange={(e) => setNewWorkshop({ ...newWorkshop, workshopCode: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">Default Branch Name</label>
                                    <input type="text" className="form-input-field" placeholder="Main Branch"
                                        value={newWorkshop.branchName} onChange={(e) => setNewWorkshop({ ...newWorkshop, branchName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">VAT ID</label>
                                    <input type="text" className="form-input-field" placeholder="VAT ID"
                                        value={newWorkshop.vatId} onChange={(e) => setNewWorkshop({ ...newWorkshop, vatId: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">CR Number</label>
                                    <input type="text" className="form-input-field" placeholder="CR Number"
                                        value={newWorkshop.crNumber} onChange={(e) => setNewWorkshop({ ...newWorkshop, crNumber: e.target.value })} />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>Address (GPS + Manual)</span>
                                <button type="button" onClick={handleDetectGPS} disabled={isDetectingLocation} style={{ 
                                    flex: 1, 
                                    padding: '8px', 
                                    borderRadius: '8px', 
                                    border: '1px solid #cbd5e1', 
                                    backgroundColor: 'transparent', 
                                    color: isDetectingLocation ? '#94a3b8' : '#0284c7', 
                                    fontSize: '0.9rem', 
                                    fontWeight: 500,
                                    cursor: isDetectingLocation ? 'not-allowed' : 'pointer'
                                }}>{isDetectingLocation ? 'Detecting Location...' : 'Detect GPS Location'}</button>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Street</label>
                                <input type="text" className="form-input-field" placeholder="Street"
                                    value={newWorkshop.street} onChange={(e) => setNewWorkshop({ ...newWorkshop, street: e.target.value })} />
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">City / District</label>
                                    <input type="text" className="form-input-field" placeholder="City / District"
                                        value={newWorkshop.city} onChange={(e) => setNewWorkshop({ ...newWorkshop, city: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Postal Code</label>
                                    <input type="text" className="form-input-field" placeholder="Postal Code"
                                        value={newWorkshop.postalCode} onChange={(e) => setNewWorkshop({ ...newWorkshop, postalCode: e.target.value })} />
                                </div>
                            </div>

                            {/* Uploads */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Uploads <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#64748b' }}>(Optional — can be added after login)</span>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Workshop Logo</label>
                                    <input type="file" className="form-input-field" style={{ padding: '8px' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Front Photo of Workshop</label>
                                    <input type="file" className="form-input-field" style={{ padding: '8px' }} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '15px' }}>
                                <label className="form-label">CR Document (PDF / Image)</label>
                                <input type="file" className="form-input-field" style={{ padding: '8px' }} />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Max 5 MB each · JPG, PNG, or PDF</p>

                            {/* Owner / Contact Person Details */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Owner / Contact Person Details
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Owner / Contact Person Name*</label>
                                    <input type="text" className="form-input-field" placeholder="Full Name"
                                        value={newWorkshop.contactName} onChange={(e) => setNewWorkshop({ ...newWorkshop, contactName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mobile Number (your username)*</label>
                                    <input type="text" className="form-input-field" placeholder="05XXXXXXXX"
                                        value={newWorkshop.phone} onChange={(e) => setNewWorkshop({ ...newWorkshop, phone: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Saudi format e.g. 05XXXXXXXX</p>
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">Workshop Email</label>
                                    <input type="email" className="form-input-field" placeholder="workshop@example.com"
                                        value={newWorkshop.email} onChange={(e) => setNewWorkshop({ ...newWorkshop, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Owner Login Email*</label>
                                    <input type="email" className="form-input-field" placeholder="owner@example.com"
                                        value={newWorkshop.ownerUserEmail} onChange={(e) => setNewWorkshop({ ...newWorkshop, ownerUserEmail: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Used to login to workshop portal</p>
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">Set Password*</label>
                                    <input type="password" className="form-input-field" placeholder="Set a password"
                                        value={newWorkshop.password} onChange={(e) => setNewWorkshop({ ...newWorkshop, password: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Owner will use this to sign in</p>
                                </div>
                            </div>

                            {/* Referral & Investment */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Referral & Investment
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Referral Person (optional)</label>
                                    <select className="form-input-field" value={newWorkshop.referralPerson} onChange={(e) => setNewWorkshop({ ...newWorkshop, referralPerson: e.target.value })}>
                                        <option value="">None — Select referral person</option>
                                        <option value="Agent A">Agent A</option>
                                        <option value="Agent B">Agent B</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Investment Amount (SAR)*</label>
                                    <input type="number" className="form-input-field" placeholder="e.g. 75000"
                                        value={newWorkshop.investmentAmount} onChange={(e) => setNewWorkshop({ ...newWorkshop, investmentAmount: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Minimum: SAR 50,000</p>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function WhatsAppIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}
