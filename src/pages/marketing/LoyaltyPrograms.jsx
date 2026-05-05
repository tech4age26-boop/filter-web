import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Modal from '../../components/Modal';
import { AnimatePresence } from 'framer-motion';
import {
    marketingCreateLoyaltyProgram,
    marketingListLoyaltyPrograms,
    marketingUpdateLoyaltyProgram,
} from '../../services/superAdminMarketingApi';
import { MarketingLoyaltySkeleton } from './MarketingShimmer';

function tierColorClass(tierName) {
    const t = String(tierName || '').toLowerCase();
    if (t.includes('platinum')) return 'platinum';
    if (t.includes('gold')) return 'gold';
    if (t.includes('silver')) return 'silver';
    return 'bronze';
}

function mapApiTiersToUi(tiers) {
    if (!Array.isArray(tiers)) return [];
    return tiers.map((t) => ({
        id: t.id,
        tier: t.tierName,
        color: tierColorClass(t.tierName),
        colorHex: t.colorHex || null,
        points: `${Number(t.minPoints).toLocaleString()}+`,
        perks: `${t.bonusPercent}% bonus on eligible spend`,
        minPoints: t.minPoints,
        discount: t.bonusPercent,
    }));
}

const DEFAULT_TIER_DTO_ROWS = [
    { tierName: 'Bronze', minPoints: 0, bonusPercent: 2, sortOrder: 0, colorHex: '#A65A21' },
    { tierName: 'Silver', minPoints: 1500, bonusPercent: 5, sortOrder: 1, colorHex: '#C0C0C0' },
];

function mapApiTiersToDtoRows(tiers) {
    if (!Array.isArray(tiers) || tiers.length === 0) return [];
    return tiers.map((t, idx) => ({
        tierName: String(t.tierName ?? '').trim(),
        minPoints: Math.max(0, Number(t.minPoints) || 0),
        bonusPercent: Math.max(0, Number(t.bonusPercent) || 0),
        sortOrder: t.sortOrder !== undefined && t.sortOrder !== null ? Number(t.sortOrder) : idx,
        colorHex: String(t.colorHex || '#64748b').trim(),
    }));
}

export const LoyaltyPrograms = ({
    showAdd: propsShowAdd,
    setShowAdd: propsSetShowAdd,
    onCancel,
    loyaltyTiers: propsTiers,
    setLoyaltyTiers: propsSetTiers,
    loyaltyProgram: propsProgram,
    setLoyaltyProgram: propsSetProgram
}) => {
    const ctx = useOutletContext() || {};
    const tiers = propsTiers || ctx.loyaltyTiers || [];
    const setTiers = propsSetTiers || ctx.setLoyaltyTiers;
    const program = propsProgram || ctx.loyaltyProgram || {};
    const setProgram = propsSetProgram || ctx.setLoyaltyProgram;
    const showAdd = propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;
    const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;
    const marketingWorkshopId = ctx.marketingWorkshopId ?? '';

    const [apiProgram, setApiProgram] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [listLoading, setListLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    /** @type {[Array<{ tierName: string, minPoints: number, bonusPercent: number, sortOrder: number, colorHex: string }>, function]} */
    const [tierDtoRows, setTierDtoRows] = useState([]);

    const [editingTier, setEditingTier] = useState(null);
    const isModalOpen = showAdd || !!editingTier;

    useEffect(() => {
        if (!isModalOpen) return;
        if (apiProgram?.tiers?.length) {
            setTierDtoRows(mapApiTiersToDtoRows(apiProgram.tiers));
        } else if (!apiProgram) {
            setTierDtoRows(DEFAULT_TIER_DTO_ROWS.map((r) => ({ ...r })));
        } else {
            setTierDtoRows(DEFAULT_TIER_DTO_ROWS.map((r) => ({ ...r })));
        }
    }, [isModalOpen, apiProgram]);

    const load = useCallback(async () => {
        setListLoading(true);
        setLoadError('');
        try {
            const res = await marketingListLoyaltyPrograms({
                ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
                status: 'all',
            });
            const list = res?.loyaltyPrograms ?? res?.data?.loyaltyPrograms ?? [];
            const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
            setApiProgram(first);
            if (first) {
                setProgram({
                    id: first.id,
                    name: first.name,
                    desc: first.description || '',
                    pointsPerSpent: first.pointsPerSarSpent,
                    pointsPerDiscount: first.pointsPerSarDiscount,
                    minRedeem: first.minPointsToRedeem,
                    isActive: first.isActive !== false,
                });
                setTiers(mapApiTiersToUi(first.tiers));
            } else {
                setProgram({
                    name: '',
                    desc: '',
                    pointsPerSpent: 1,
                    pointsPerDiscount: 100,
                    minRedeem: 500,
                    isActive: true,
                });
                setTiers([]);
            }
        } catch (e) {
            setApiProgram(null);
            setTiers([]);
            setLoadError(e?.message || 'Failed to load loyalty programs.');
        } finally {
            setListLoading(false);
        }
    }, [marketingWorkshopId, setProgram, setTiers]);

    useEffect(() => {
        load();
    }, [load]);

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setEditingTier(null);
    };

    const updateTierRow = (index, patch) => {
        setTierDtoRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    };

    const addTierRow = () => {
        setTierDtoRows((rows) => [
            ...rows,
            {
                tierName: 'New tier',
                minPoints: 0,
                bonusPercent: 0,
                sortOrder: rows.length,
                colorHex: '#64748b',
            },
        ]);
    };

    const removeTierRow = (index) => {
        setTierDtoRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
    };

    const handleSaveProgram = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const name = String(data.name || '').trim();
        if (!name) {
            alert('Program name is required.');
            return;
        }
        const isActive = formData.get('isActive') === 'on';
        const tiersPayload = tierDtoRows
            .map((row, idx) => ({
                tierName: String(row.tierName || '').trim(),
                minPoints: Math.max(0, Number(row.minPoints) || 0),
                bonusPercent: Math.max(0, Number(row.bonusPercent) || 0),
                sortOrder: row.sortOrder !== '' && row.sortOrder != null ? Number(row.sortOrder) : idx,
                colorHex: String(row.colorHex || '').trim() || undefined,
            }))
            .filter((t) => t.tierName);
        if (!tiersPayload.length) {
            alert('Add at least one tier with a name.');
            return;
        }
        const workshopId = String(marketingWorkshopId || apiProgram?.workshopId || '').trim();
        const baseBody = {
            name,
            description: String(data.desc || '').trim() || undefined,
            pointsPerSarSpent: Number(data.pointsPerSpent) || 1,
            pointsPerSarDiscount: Number(data.pointsPerDiscount) || 100,
            minPointsToRedeem: Number(data.minRedeem) || 0,
            isActive,
            tiers: tiersPayload,
        };
        setSaving(true);
        try {
            if (apiProgram?.id) {
                await marketingUpdateLoyaltyProgram(apiProgram.id, baseBody);
            } else {
                if (!workshopId) {
                    alert('Select a workshop in “Workshop scope”, or open a workshop that already has a program.');
                    setSaving(false);
                    return;
                }
                await marketingCreateLoyaltyProgram({
                    workshopId,
                    ...baseBody,
                });
            }
            await load();
            closeModal();
        } catch (err) {
            alert(err?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (listLoading) {
        return (
            <div className="loyalty-view">
                {loadError ? <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 12 }}>{loadError}</p> : null}
                <MarketingLoyaltySkeleton />
            </div>
        );
    }

    return (
        <div className="loyalty-view">
            {loadError ? <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 12 }}>{loadError}</p> : null}
            {apiProgram ? (
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>
                    Showing <strong>{apiProgram.name}</strong>
                    {apiProgram.workshopName ? ` · ${apiProgram.workshopName}` : ''} (first match for filters).
                </p>
            ) : (
                !loadError && <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 16 }}>No loyalty programs returned.</p>
            )}
            <div className="tier-grid">
                {tiers.map((t) => (
                    <div
                        key={t.id || t.tier}
                        className={`tier-card tier-${t.color}`}
                        style={t.colorHex ? { borderLeft: `4px solid ${t.colorHex}` } : undefined}
                    >
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '4px' }}>{t.tier}</h3>
                        <p style={{ fontSize: '12px', opacity: 0.8 }}>{t.points} points</p>
                        <div style={{ marginTop: '24px', textAlign: 'left', background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px' }}>
                            <h4 style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>Tier Benefits</h4>
                            <p style={{ fontSize: '13px', lineHeight: 1.4 }}>{t.perks}</p>
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title="Configure Loyalty Program & Tiers"
                        onClose={closeModal}
                        footer={
                            <>
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="button" className="btn-submit" disabled={saving} onClick={() => document.getElementById('loyalty-form').requestSubmit()}>
                                    {saving ? 'Saving…' : 'Save Configuration'}
                                </button>
                            </>
                        }
                    >
                        <form id="loyalty-form" key={apiProgram?.id || 'none'} onSubmit={handleSaveProgram}>
                            <div className="form-group">
                                <label className="form-label">Program Name *</label>
                                <input type="text" className="form-input-field" name="name" defaultValue={program.name} placeholder="e.g. FILTER Rewards" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input-field" name="desc" defaultValue={program.desc} placeholder="Briefly describe the program..." rows={2} />
                            </div>
                            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px' }}>Points per SAR spent</label>
                                    <input type="number" className="form-input-field" name="pointsPerSpent" defaultValue={program.pointsPerSpent} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px' }}>Points per SAR discount</label>
                                    <input type="number" className="form-input-field" name="pointsPerDiscount" defaultValue={program.pointsPerDiscount} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px' }}>Min points to redeem</label>
                                    <input type="number" className="form-input-field" name="minRedeem" defaultValue={program.minRedeem} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input type="checkbox" name="isActive" defaultChecked={program.isActive !== false} />
                                    Program active
                                </label>
                            </div>
                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: 8 }}>
                                Tiers below are sent on save (same shape as the marketing API: tierName, minPoints, bonusPercent, sortOrder, colorHex).
                                {apiProgram?.id ? '' : ' New programs require a workshop in “Workshop scope”; `workshopId` is included on create.'}
                            </p>
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>Tiers</label>
                                    <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={addTierRow}>
                                        Add tier
                                    </button>
                                </div>
                                <div className="tier-config-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {tierDtoRows.map((row, index) => (
                                        <div
                                            key={`tier-row-${index}`}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 88px 88px 72px 100px 36px',
                                                gap: '8px',
                                                alignItems: 'center',
                                                background: '#F9FAFB',
                                                padding: '10px',
                                                borderRadius: '12px',
                                            }}
                                        >
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                style={{ minWidth: 0 }}
                                                placeholder="Tier name"
                                                value={row.tierName}
                                                onChange={(ev) => updateTierRow(index, { tierName: ev.target.value })}
                                            />
                                            <input
                                                type="number"
                                                className="form-input-field"
                                                title="Min points"
                                                placeholder="Min pts"
                                                value={row.minPoints}
                                                onChange={(ev) => updateTierRow(index, { minPoints: ev.target.value === '' ? '' : Number(ev.target.value) })}
                                            />
                                            <input
                                                type="number"
                                                className="form-input-field"
                                                title="Bonus %"
                                                placeholder="%"
                                                value={row.bonusPercent}
                                                onChange={(ev) => updateTierRow(index, { bonusPercent: ev.target.value === '' ? '' : Number(ev.target.value) })}
                                            />
                                            <input
                                                type="number"
                                                className="form-input-field"
                                                title="Sort order"
                                                placeholder="Ord"
                                                value={row.sortOrder}
                                                onChange={(ev) => updateTierRow(index, { sortOrder: ev.target.value === '' ? '' : Number(ev.target.value) })}
                                            />
                                            <input
                                                type="text"
                                                className="form-input-field"
                                                title="Color hex"
                                                placeholder="#hex"
                                                value={row.colorHex}
                                                onChange={(ev) => updateTierRow(index, { colorHex: ev.target.value })}
                                            />
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                style={{ padding: '6px', minWidth: 36 }}
                                                disabled={tierDtoRows.length <= 1}
                                                onClick={() => removeTierRow(index)}
                                                aria-label="Remove tier"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};
