import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MultiSelectDropdown } from './MarketingUtils';

export const Promotions = ({
    showAdd: propsShowAdd,
    setShowAdd: propsSetShowAdd,
    onCancel,
    promotions: propsPromotions,
    setPromotions: propsSetPromotions
}) => {
    const ctx = useOutletContext() || {};
    const promotions = propsPromotions || ctx.promotions || [];
    const setPromotions = propsSetPromotions || ctx.setPromotions;
    const showAdd = propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;
    const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;

    const [editingPromo, setEditingPromo] = useState(null);
    const isModalOpen = showAdd || !!editingPromo;

    const [selectedSources, setSelectedSources] = useState([]);
    const [selectedTargets, setSelectedTargets] = useState([]);
    const [selectedZones, setSelectedZones] = useState(['Central Zone', 'North Zone']);
    const [selectedTriggers, setSelectedTriggers] = useState([]);
    const [selectedRewards, setSelectedRewards] = useState([]);

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setEditingPromo(null);
    };

    const handleSave = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (editingPromo) {
            setPromotions(promotions.map(p => p.id === editingPromo.id ? { ...p, ...data, val: data.dType === 'Percentage (%)' ? `${data.dVal}%` : `SAR ${data.dVal}`, type: `${data.strategy} · ${data.pType}` } : p));
        } else {
            const newPromo = {
                id: Date.now(),
                ...data,
                val: data.dType === 'Percentage (%)' ? `${data.dVal}%` : `SAR ${data.dVal}`,
                type: `${data.strategy} · ${data.pType}`,
                usage: '0 / 100',
                status: 'Active',
                expiry: 'Dec 31, 2026'
            };
            setPromotions([newPromo, ...promotions]);
        }
        closeModal();
    };

    const openEdit = (p) => {
        setEditingPromo(p);
        if (setShowAdd) setShowAdd(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this promotion?')) {
            setPromotions(promotions.filter(p => p.id !== id));
        }
    };

    return (
        <div className="promotions-view">
            <div className="marketing-grid">
                {promotions.map(p => (
                    <div key={p.id} className="marketing-card">
                        <div className="marketing-card-header">
                            <div>
                                <h3 className="marketing-card-title">{p.name}</h3>
                                <p style={{ fontSize: '12px', color: '#6C757D' }}>{p.type}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className={`marketing-card-badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                                <button className="icon-btn-mini edit-btn" title="Edit Promotion" onClick={() => openEdit(p)}>
                                    <Pencil size={14} />
                                </button>
                                <button className="icon-btn-mini delete-btn" title="Delete Promotion" onClick={() => handleDelete(p.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="marketing-card-stats">
                            <div className="m-stat-item">
                                <span className="m-stat-label">Discount Value</span>
                                <span className="m-stat-val" style={{ color: 'var(--color-primary)' }}>{p.val}</span>
                            </div>
                            <div className="m-stat-item">
                                <span className="m-stat-label">Redemptions</span>
                                <span className="m-stat-val">{p.usage}</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '16px', fontSize: '11px', color: '#6C757D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> Expires: {p.expiry}
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title={editingPromo ? "Edit Promotion" : "New Promotion"}
                        onClose={closeModal}
                        footer={
                            <>
                                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button className="btn-submit" onClick={() => document.getElementById('promo-form').requestSubmit()}>
                                    {editingPromo ? "Update Promotion" : "Submit for Approval"}
                                </button>
                            </>
                        }
                    >
                        <form id="promo-form" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Promotion Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-input-field"
                                    placeholder="e.g. Ramadan Special Offer"
                                    defaultValue={editingPromo?.name || ''}
                                />
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Marketing Strategy</label>
                                    <select className="form-input-field" name="strategy" defaultValue={editingPromo?.strategy || 'Standard Promotion'}>
                                        <option>Standard Promotion</option>
                                        <option>Cross-Platform Promotion</option>
                                        <option>Zone-Wise Offer</option>
                                        <option>Loyalty Reward</option>
                                        <option>Seasonal Campaign</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Promotion Type</label>
                                    <select className="form-input-field" name="pType" defaultValue={editingPromo?.pType || 'Percentage Discount'}>
                                        <option>Percentage Discount</option>
                                        <option>Fixed Amount Discount</option>
                                        <option>Buy X Get Y Free</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Discount Type</label>
                                    <select className="form-input-field" name="dType" defaultValue={editingPromo?.dType || 'Percentage (%)'}>
                                        <option>Percentage (%)</option>
                                        <option>Fixed (SAR)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Discount Value</label>
                                    <input
                                        type="number"
                                        name="dVal"
                                        className="form-input-field"
                                        placeholder="e.g. 15"
                                        defaultValue={editingPromo?.dVal || ''}
                                    />
                                </div>
                            </div>

                            <MultiSelectDropdown
                                label="Source Branch / Store — Created From"
                                options={['All Branches', 'Riyadh Main', 'Jeddah North', 'Dammam Hub']}
                                selected={selectedSources}
                                onChange={setSelectedSources}
                                placeholder="Select options..."
                            />

                            <MultiSelectDropdown
                                label="Target Branches (Where Applicable)"
                                options={['All Branches', 'Riyadh Main', 'Jeddah North', 'Dammam Hub']}
                                selected={selectedTargets}
                                onChange={setSelectedTargets}
                                placeholder="Select options..."
                            />

                            <MultiSelectDropdown
                                label="Target Zones"
                                options={['All Zones', 'Central Zone', 'North Zone', 'South Zone', 'East Zone', 'West Zone']}
                                selected={selectedZones}
                                onChange={setSelectedZones}
                                placeholder="Select zones..."
                            />

                            <div className="form-grid">
                                <MultiSelectDropdown
                                    label="Trigger Products"
                                    options={['Full Wash', 'Oil Change', 'Buffing', 'Tire Service']}
                                    selected={selectedTriggers}
                                    onChange={setSelectedTriggers}
                                    placeholder="Select products..."
                                />
                                <MultiSelectDropdown
                                    label="Reward Products / Services"
                                    options={['Interior Sanitization', 'Waxing', 'Tire Polish', 'Air Filter']}
                                    selected={selectedRewards}
                                    onChange={setSelectedRewards}
                                    placeholder="Select products..."
                                />
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Customer Segment</label>
                                    <select className="form-input-field" name="segment" defaultValue={editingPromo?.segment || 'All Customers'}>
                                        <option>All Customers</option>
                                        <option>New Customers Only</option>
                                        <option>Returning Customers</option>
                                        <option>VIP Customers</option>
                                        <option>Corporate Customers</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Min. Purchase Amount (SAR)</label>
                                    <input
                                        type="number"
                                        name="minPurchase"
                                        className="form-input-field"
                                        defaultValue={editingPromo?.minPurchase ?? 0}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Max Usage Count (0 = unlimited)</label>
                                    <input
                                        type="number"
                                        name="maxUsage"
                                        className="form-input-field"
                                        defaultValue={editingPromo?.maxUsage ?? 0}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field" name="status" defaultValue={editingPromo?.status || 'Active'}>
                                        <option value="Draft">Draft</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Active">Active</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Start Date & Time</label>
                                    <input type="datetime-local" name="startDate" className="form-input-field" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Date & Time</label>
                                    <input type="datetime-local" name="endDate" className="form-input-field" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Invoice Banner Text</label>
                                <input
                                    type="text"
                                    name="banner"
                                    className="form-input-field"
                                    placeholder="e.g. You saved SAR 50 with Ramadan Offer!"
                                    defaultValue={editingPromo?.banner || ''}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input-field" name="desc" placeholder="Internal description..." rows={2}></textarea>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Terms & Conditions</label>
                                <textarea className="form-input-field" name="terms" placeholder="T&Cs printed on invoice..." rows={2}></textarea>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Advertising / Marketing Banners</label>
                                <div style={{ border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 8px' }}>Upload PNG, JPG, or WebP</p>
                                    <button className="btn-secondary" style={{ fontSize: '12px' }}>Upload</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="autoClose" id="autoClose" style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                                    <label htmlFor="autoClose" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Auto-close on end date</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="showPOS" id="showPOS" style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                                    <label htmlFor="showPOS" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Show on POS Invoice</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="showPortal" id="showPortal" style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                                    <label htmlFor="showPortal" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Show on Customer Portal</label>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '12px', color: '#1E40AF', margin: 0 }}>
                                    ℹ️ {editingPromo ? "Changes will be submitted for review." : "After creating, this will be sent to the Super Admin for approval before it goes live."}
                                </p>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};
