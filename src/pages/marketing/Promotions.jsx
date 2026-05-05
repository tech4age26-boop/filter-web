import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Clock } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MultiSelectDropdown } from './MarketingUtils';
import {
    marketingCreatePromotion,
    marketingDeletePromotion,
    marketingListPromotions,
    marketingUpdatePromotion,
} from '../../services/superAdminMarketingApi';
import { MarketingCardGridSkeleton } from './MarketingShimmer';
import {
    apiPromotionStatusToUiClass,
    datetimeLocalToIso,
    mapPromotionRowToCard,
    uiDiscountTypeToApi,
    uiPromotionStatusToApi,
    uiPromoTypeToApi,
    uiStrategyToApi,
} from './marketingFormMappers';

function badgeClassFromPromotion(p) {
    const slug = apiPromotionStatusToUiClass(p.statusApi || p.status);
    if (slug === 'active') return 'marketing-card-badge badge-active';
    if (slug === 'inactive') return 'marketing-card-badge badge-inactive';
    if (slug === 'scheduled') return 'marketing-card-badge badge-pending';
    return 'marketing-card-badge badge-scheduled';
}

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
    const marketingWorkshopId = ctx.marketingWorkshopId ?? '';
    const workshops = ctx.workshops || [];

    const [editingPromo, setEditingPromo] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [listLoading, setListLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const isModalOpen = showAdd || !!editingPromo;

    const [selectedSources, setSelectedSources] = useState([]);
    const [selectedTargets, setSelectedTargets] = useState([]);
    const [selectedZones, setSelectedZones] = useState([]);
    const [selectedTriggers, setSelectedTriggers] = useState([]);
    const [selectedRewards, setSelectedRewards] = useState([]);

    const loadList = useCallback(async () => {
        setListLoading(true);
        setLoadError('');
        try {
            const res = await marketingListPromotions({
                ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
                status: 'all',
                limit: 100,
                offset: 0,
            });
            const rows = res?.promotions ?? res?.data?.promotions ?? [];
            const mapped = Array.isArray(rows) ? rows.map(mapPromotionRowToCard) : [];
            setPromotions(mapped);
        } catch (e) {
            setPromotions([]);
            setLoadError(e?.message || 'Failed to load promotions.');
        } finally {
            setListLoading(false);
        }
    }, [marketingWorkshopId, setPromotions]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const defaultWorkshopId = () => {
        if (marketingWorkshopId) return String(marketingWorkshopId);
        const w0 = workshops[0];
        const id = w0?.id ?? w0?._id ?? w0?.workshopId;
        return id != null ? String(id) : '';
    };

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setEditingPromo(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const sourceWorkshopId = String(data.sourceWorkshopId || '').trim() || defaultWorkshopId();
        if (!sourceWorkshopId) {
            alert('Select a source workshop.');
            return;
        }
        const startAt = datetimeLocalToIso(data.startDate);
        const endAt = datetimeLocalToIso(data.endDate);
        if (!startAt || !endAt) {
            alert('Start and end date/time are required.');
            return;
        }
        const body = {
            name: String(data.name || '').trim(),
            marketingStrategy: uiStrategyToApi(data.strategy),
            promotionType: uiPromoTypeToApi(data.pType),
            discountType: uiDiscountTypeToApi(data.dType),
            discountValue: Number(data.dVal),
            minPurchaseAmount: Number(data.minPurchase || 0),
            maxUsageCount: Number(data.maxUsage || 0),
            sourceWorkshopId,
            targetWorkshopId: sourceWorkshopId,
            startAt,
            endAt,
            status: uiPromotionStatusToApi(data.status),
            invoiceBannerText: data.banner?.trim() || undefined,
            description: data.desc?.trim() || undefined,
            termsConditions: data.terms?.trim() || undefined,
            autoCloseOnEndDate: !!formData.get('autoClose'),
            showOnPosInvoice: !!formData.get('showPOS'),
            showOnCustomerPortal: !!formData.get('showPortal'),
            customerSegment: String(data.segment || 'All Customers')
                .toLowerCase()
                .replace(/\s+/g, '_'),
            targetZones: selectedZones.filter((z) => z && !/^all/i.test(z)),
            triggerProductIds: [],
            rewardItemIds: [],
        };
        if (!body.name) {
            alert('Promotion name is required.');
            return;
        }
        setSaving(true);
        try {
            if (editingPromo?._raw?.id) {
                await marketingUpdatePromotion(editingPromo._raw.id, body);
            } else {
                await marketingCreatePromotion(body);
            }
            await loadList();
            closeModal();
        } catch (err) {
            alert(err?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (p) => {
        setEditingPromo(p);
        if (setShowAdd) setShowAdd(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this promotion?')) return;
        try {
            await marketingDeletePromotion(id);
            await loadList();
        } catch (e) {
            alert(e?.message || 'Delete failed');
        }
    };

    const branchOptions = ['All Branches', 'Riyadh Main', 'Jeddah North', 'Dammam Hub'];

    return (
        <div className="promotions-view">
            {loadError ? <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 12 }}>{loadError}</p> : null}
            {listLoading ? (
                <MarketingCardGridSkeleton cards={6} />
            ) : (
            <div className="marketing-grid">
                {promotions.map((p) => (
                    <div key={p.id} className="marketing-card">
                        <div className="marketing-card-header">
                            <div>
                                <h3 className="marketing-card-title">{p.name}</h3>
                                <p style={{ fontSize: '12px', color: '#6C757D' }}>{p.type}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className={badgeClassFromPromotion(p)}>{p.status}</span>
                                <button type="button" className="icon-btn-mini edit-btn" title="Edit Promotion" onClick={() => openEdit(p)}>
                                    <Pencil size={14} />
                                </button>
                                <button type="button" className="icon-btn-mini delete-btn" title="Delete Promotion" onClick={() => handleDelete(p.id)}>
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
                            <Clock size={12} /> Valid to: {p.expiry}
                        </div>
                    </div>
                ))}
            </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title={editingPromo ? "Edit Promotion" : "New Promotion"}
                        onClose={closeModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="button" className="btn-submit" disabled={saving} onClick={() => document.getElementById('promo-form').requestSubmit()}>
                                    {saving ? 'Saving…' : editingPromo ? "Update Promotion" : "Submit for Approval"}
                                </button>
                            </>
                        }
                    >
                        <form id="promo-form" key={editingPromo?.id || 'new'} onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Source workshop *</label>
                                <select
                                    name="sourceWorkshopId"
                                    className="form-input-field"
                                    required
                                    defaultValue={editingPromo?._raw?.sourceWorkshopId || defaultWorkshopId()}
                                >
                                    <option value="" disabled>Select workshop…</option>
                                    {workshops.map((w) => {
                                        const id = w.id ?? w._id ?? w.workshopId;
                                        if (id == null) return null;
                                        return (
                                            <option key={String(id)} value={String(id)}>
                                                {w.name || `Workshop ${id}`}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Promotion Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-input-field"
                                    placeholder="e.g. Ramadan Special Offer"
                                    defaultValue={editingPromo?.name || ''}
                                    required
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
                                        defaultValue={editingPromo?.dVal ?? ''}
                                        required
                                    />
                                </div>
                            </div>

                            <MultiSelectDropdown
                                label="Source Branch / Store — Created From (UI only)"
                                options={branchOptions}
                                selected={selectedSources}
                                onChange={setSelectedSources}
                                placeholder="Select options..."
                            />

                            <MultiSelectDropdown
                                label="Target Branches (UI only)"
                                options={branchOptions}
                                selected={selectedTargets}
                                onChange={setSelectedTargets}
                                placeholder="Select options..."
                            />

                            <MultiSelectDropdown
                                label="Target Zones (optional — sent to API)"
                                options={['All Zones', 'Central Zone', 'North Zone', 'South Zone', 'East Zone', 'West Zone']}
                                selected={selectedZones}
                                onChange={setSelectedZones}
                                placeholder="Select zones..."
                            />

                            <div className="form-grid">
                                <MultiSelectDropdown
                                    label="Trigger Products (UI only)"
                                    options={['Full Wash', 'Oil Change', 'Buffing', 'Tire Service']}
                                    selected={selectedTriggers}
                                    onChange={setSelectedTriggers}
                                    placeholder="Select products..."
                                />
                                <MultiSelectDropdown
                                    label="Reward Products / Services (UI only)"
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
                                    <select
                                        className="form-input-field"
                                        name="status"
                                        defaultValue={
                                            editingPromo
                                                ? ['active', 'approved'].includes(
                                                      String(editingPromo.statusApi || '').toLowerCase(),
                                                  )
                                                    ? 'Active'
                                                    : String(editingPromo.statusApi || '').toLowerCase() ===
                                                          'pending_approval'
                                                      ? 'Scheduled'
                                                      : 'Draft'
                                                : 'Draft'
                                        }
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Scheduled">Scheduled</option>
                                        <option value="Active">Active</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Start Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        name="startDate"
                                        className="form-input-field"
                                        defaultValue={
                                            editingPromo?._raw?.startAt
                                                ? String(editingPromo._raw.startAt).slice(0, 16)
                                                : ''
                                        }
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        name="endDate"
                                        className="form-input-field"
                                        defaultValue={
                                            editingPromo?._raw?.endAt
                                                ? String(editingPromo._raw.endAt).slice(0, 16)
                                                : ''
                                        }
                                        required
                                    />
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
                                <textarea className="form-input-field" name="desc" placeholder="Internal description..." rows={2} defaultValue={editingPromo?._raw?.description || ''} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Terms & Conditions</label>
                                <textarea className="form-input-field" name="terms" placeholder="T&Cs printed on invoice..." rows={2} defaultValue={editingPromo?._raw?.termsConditions || ''} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Advertising / Marketing Banners</label>
                                <div style={{ border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 8px' }}>Upload is not wired to API yet</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="autoClose" id="autoClose" defaultChecked={!!editingPromo?._raw?.autoCloseOnEndDate} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                                    <label htmlFor="autoClose" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Auto-close on end date</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="showPOS" id="showPOS" defaultChecked={!!editingPromo?._raw?.showOnPosInvoice} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                                    <label htmlFor="showPOS" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Show on POS Invoice</label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="checkbox" name="showPortal" id="showPortal" defaultChecked={!!editingPromo?._raw?.showOnCustomerPortal} style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }} />
                                    <label htmlFor="showPortal" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Show on Customer Portal</label>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '12px' }}>
                                <p style={{ fontSize: '12px', color: '#1E40AF', margin: 0 }}>
                                    {editingPromo ? "Updates are sent to the API (PATCH)." : "Creates a promotion record (POST). Approval rules follow backend configuration."}
                                </p>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};
