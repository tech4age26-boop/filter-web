import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { generateCode } from './MarketingUtils';
import {
    marketingCreatePromoCode,
    marketingDeletePromoCode,
    marketingGeneratePromoAutoCode,
    marketingListPromoCodes,
    marketingUpdatePromoCode,
} from '../../services/superAdminMarketingApi';
import { datetimeLocalToYmd, mapPromoCodeRowToCard } from './marketingFormMappers';
import { MarketingCardGridSkeleton } from './MarketingShimmer';

function badgeClass(statusLabel) {
    const s = String(statusLabel || '').toLowerCase();
    if (s === 'active') return 'marketing-card-badge badge-active';
    if (s === 'expired') return 'marketing-card-badge badge-expired';
    return 'marketing-card-badge badge-inactive';
}

export const PromoCodes = ({
    showAdd: propsShowAdd,
    setShowAdd: propsSetShowAdd,
    onCancel,
    promoCodes: propsPromoCodes,
    setPromoCodes: propsSetPromoCodes
}) => {
    const ctx = useOutletContext() || {};
    const promoCodes = propsPromoCodes || ctx.promoCodes || [];
    const setPromoCodes = propsSetPromoCodes || ctx.setPromoCodes;
    const showAdd = propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;
    const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;
    const marketingWorkshopId = ctx.marketingWorkshopId ?? '';
    const workshops = ctx.workshops || [];

    const [editingCode, setEditingCode] = useState(null);
    const [newCode, setNewCode] = useState('');
    const [loadError, setLoadError] = useState('');
    const [listLoading, setListLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const isModalOpen = showAdd || !!editingCode;

    const resolveWorkshopIdForAuto = () => {
        if (marketingWorkshopId) return String(marketingWorkshopId);
        const w0 = workshops[0];
        const id = w0?.id ?? w0?._id ?? w0?.workshopId;
        return id != null ? String(id) : '';
    };

    const loadList = useCallback(async () => {
        setListLoading(true);
        setLoadError('');
        try {
            const res = await marketingListPromoCodes({
                ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
                status: 'all',
                limit: 100,
                offset: 0,
            });
            const rows = res?.promoCodes ?? res?.data?.promoCodes ?? [];
            const mapped = Array.isArray(rows) ? rows.map(mapPromoCodeRowToCard) : [];
            setPromoCodes(mapped);
        } catch (e) {
            setPromoCodes([]);
            setLoadError(e?.message || 'Failed to load promo codes.');
        } finally {
            setListLoading(false);
        }
    }, [marketingWorkshopId, setPromoCodes]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setEditingCode(null);
        setNewCode('');
    };

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code);
        alert('Code copied to clipboard!');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const code = String(newCode || '').trim().toUpperCase();
        if (!code) {
            alert('Promo code is required.');
            return;
        }
        const discountType = data.dType === 'Fixed (SAR)' ? 'amount' : 'percentage';
        const discountValue = Number(data.dVal);
        if (!Number.isFinite(discountValue) || discountValue < 0) {
            alert('Invalid discount value.');
            return;
        }
        const validFrom = datetimeLocalToYmd(data.startDate);
        const validTo = datetimeLocalToYmd(data.endDate);
        if (!validFrom || !validTo) {
            alert('Valid from and valid until (dates) are required.');
            return;
        }
        const maxU = Number(data.maxUsage);
        const usageLimit = Number.isFinite(maxU) && maxU > 0 ? maxU : 0;
        const minOrderAmount = Number(data.minPurchase) || 0;
        const st = String(data.status || '').toLowerCase();
        const isActive = st === 'active';
        const description = String(data.description || '').trim() || undefined;

        setSaving(true);
        try {
            if (editingCode) {
                await marketingUpdatePromoCode(editingCode.id, {
                    code,
                    discountType,
                    discountValue,
                    validFrom,
                    validTo,
                    usageLimit: usageLimit || undefined,
                    minOrderAmount,
                    description,
                    isActive,
                });
            } else {
                await marketingCreatePromoCode({
                    ...(marketingWorkshopId ? { workshopId: String(marketingWorkshopId) } : {}),
                    code,
                    discountType,
                    discountValue,
                    validFrom,
                    validTo,
                    usageLimit: usageLimit || undefined,
                    minOrderAmount,
                    description,
                    isActive,
                });
            }
            await loadList();
            closeModal();
        } catch (err) {
            alert(err?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (c) => {
        setEditingCode(c);
        setNewCode(c.code);
        if (setShowAdd) setShowAdd(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this promo code?')) return;
        try {
            await marketingDeletePromoCode(id);
            await loadList();
        } catch (e) {
            alert(e?.message || 'Delete failed');
        }
    };

    const handleAutoServerCode = async () => {
        const wid = resolveWorkshopIdForAuto();
        if (!wid) {
            alert('Pick a workshop in the header scope (or create a workshop) to generate a code.');
            return;
        }
        try {
            const res = await marketingGeneratePromoAutoCode({ workshopId: wid });
            const c = res?.code ?? res?.data?.code;
            if (c) setNewCode(String(c));
        } catch (e) {
            alert(e?.message || 'Could not generate code');
        }
    };

    return (
        <div className="promo-codes-view">
            {loadError ? <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 12 }}>{loadError}</p> : null}
            {listLoading ? (
                <MarketingCardGridSkeleton cards={6} />
            ) : (
            <div className="marketing-grid">
                {promoCodes.map((c) => (
                    <div key={c.id} className="marketing-card">
                        <div className="marketing-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '10px', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace', border: '1px dashed #D1D5DB' }}>
                                    {c.code}
                                </div>
                                <button type="button" className="icon-btn-mini" onClick={() => handleCopy(c.code)} title="Copy Code">
                                    <Copy size={14} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span className={badgeClass(c.status)}>{c.status}</span>
                                <button type="button" className="icon-btn-mini edit-btn" title="Edit Code" onClick={() => openEdit(c)}>
                                    <Pencil size={14} />
                                </button>
                                <button type="button" className="icon-btn-mini delete-btn" title="Delete Code" onClick={() => handleDelete(c.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 600, marginTop: '12px' }}>{c.promo}</p>
                        <div className="marketing-card-stats">
                            <div className="m-stat-item">
                                <span className="m-stat-label">Value / Min Order</span>
                                <span className="m-stat-val">{c.val} <span style={{ fontSize: '10px', color: '#6C757D' }}>({c.minPurchase || c.min || 0}+)</span></span>
                            </div>
                            <div className="m-stat-item">
                                <span className="m-stat-label">Usage Rate</span>
                                <span className="m-stat-val">{c.usage}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title={editingCode ? "Edit Promo Code" : "Generate Promo Code"}
                        onClose={closeModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="button" className="btn-submit" disabled={saving} onClick={() => document.getElementById('promo-code-form').requestSubmit()}>
                                    {saving ? 'Saving…' : editingCode ? "Update Code" : "Create Code"}
                                </button>
                            </>
                        }
                    >
                        <form id="promo-code-form" key={editingCode?.id || 'new'} onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Promo Code *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="SUMMER20"
                                        value={newCode}
                                        onChange={(e) => setNewCode(e.target.value)}
                                        style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                    <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => setNewCode(generateCode())}>
                                        Random
                                    </button>
                                    <button type="button" className="btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={handleAutoServerCode}>
                                        Server
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (optional)</label>
                                <input type="text" className="form-input-field" name="description" placeholder="Internal label" defaultValue={editingCode?.description || editingCode?.promo || ''} />
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Discount Type</label>
                                    <select className="form-input-field" name="dType" defaultValue={editingCode?.dType || 'Percentage (%)'}>
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
                                        placeholder="0"
                                        defaultValue={editingCode?.dVal ?? ''}
                                    />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Min. Purchase (SAR)</label>
                                    <input
                                        type="number"
                                        name="minPurchase"
                                        className="form-input-field"
                                        defaultValue={editingCode?.minPurchase ?? 0}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Max Usage (0=unlimited)</label>
                                    <input
                                        type="number"
                                        name="maxUsage"
                                        className="form-input-field"
                                        defaultValue={editingCode?.maxUsage ?? 0}
                                    />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Valid From</label>
                                    <input type="datetime-local" name="startDate" className="form-input-field" defaultValue={editingCode?.startDate || ''} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valid Until</label>
                                    <input type="datetime-local" name="endDate" className="form-input-field" defaultValue={editingCode?.endDate || ''} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select
                                    className="form-input-field"
                                    name="status"
                                    defaultValue={
                                        editingCode?.status === 'Expired'
                                            ? 'expired'
                                            : editingCode?.status === 'Active'
                                              ? 'active'
                                              : 'inactive'
                                    }
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="expired">Expired (inactive)</option>
                                </select>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};
