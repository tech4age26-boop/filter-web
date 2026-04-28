import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Modal from '../../components/Modal';
import { AnimatePresence } from 'framer-motion';

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

    const [editingTier, setEditingTier] = useState(null);
    const isModalOpen = showAdd || !!editingTier;

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setEditingTier(null);
    };

    const handleSaveProgram = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        setProgram({ ...program, ...data });
        closeModal();
    };

    return (
        <div className="loyalty-view">
            <div className="tier-grid">
                {tiers.map(t => (
                    <div key={t.tier} className={`tier-card tier-${t.color}`}>
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
                                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button className="btn-submit" onClick={() => document.getElementById('loyalty-form').requestSubmit()}>Save Configuration</button>
                            </>
                        }
                    >
                        <form id="loyalty-form" onSubmit={handleSaveProgram}>
                            <div className="form-group">
                                <label className="form-label">Program Name *</label>
                                <input type="text" className="form-input-field" name="name" defaultValue={program.name} placeholder="e.g. FILTER Rewards" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea className="form-input-field" name="desc" defaultValue={program.desc} placeholder="Briefly describe the program..." rows={2}></textarea>
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
                            <div className="form-group" style={{ marginTop: '16px' }}>
                                <label className="form-label">Tier Configurations</label>
                                <div className="tier-config-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {tiers.map(tier => (
                                        <div key={tier.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#F9FAFB', padding: '12px', borderRadius: '12px' }}>
                                            <span style={{ fontWeight: 800, width: '80px' }}>{tier.tier}</span>
                                            <div style={{ flex: 1 }}>
                                                <input type="number" className="form-input-field" placeholder="Min Points" style={{ height: '32px', fontSize: '12px' }} defaultValue={tier.minPoints} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <input type="number" className="form-input-field" placeholder="Discount %" style={{ height: '32px', fontSize: '12px' }} defaultValue={tier.discount} />
                                            </div>
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
