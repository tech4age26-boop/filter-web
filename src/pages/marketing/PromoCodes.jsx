import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { generateCode } from './MarketingUtils';

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

    const [editingCode, setEditingCode] = useState(null);
    const [newCode, setNewCode] = useState('');
    const isModalOpen = showAdd || !!editingCode;

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

    const handleSave = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (editingCode) {
            setPromoCodes(promoCodes.map(c => c.id === editingCode.id ? { ...c, ...data, code: newCode, val: data.dType === 'Percentage (%)' ? `${data.dVal}%` : `SAR ${data.dVal}` } : c));
        } else {
            const newCodeObj = {
                id: Date.now(),
                ...data,
                code: newCode,
                val: data.dType === 'Percentage (%)' ? `${data.dVal}%` : `SAR ${data.dVal}`,
                usage: '0 / 100',
                status: 'Active'
            };
            setPromoCodes([newCodeObj, ...promoCodes]);
        }
        closeModal();
    };

    const openEdit = (c) => {
        setEditingCode(c);
        setNewCode(c.code);
        if (setShowAdd) setShowAdd(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this promo code?')) {
            setPromoCodes(promoCodes.filter(c => c.id !== id));
        }
    };

    return (
        <div className="promo-codes-view">
            <div className="marketing-grid">
                {promoCodes.map(c => (
                    <div key={c.id} className="marketing-card">
                        <div className="marketing-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: '10px', fontSize: '1.125rem', fontWeight: 900, fontFamily: 'monospace', border: '1px dashed #D1D5DB' }}>
                                    {c.code}
                                </div>
                                <button className="icon-btn-mini" onClick={() => handleCopy(c.code)} title="Copy Code">
                                    <Copy size={14} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span className="marketing-card-badge badge-active">{c.status}</span>
                                <button className="icon-btn-mini edit-btn" title="Edit Code" onClick={() => openEdit(c)}>
                                    <Pencil size={14} />
                                </button>
                                <button className="icon-btn-mini delete-btn" title="Delete Code" onClick={() => handleDelete(c.id)}>
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

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title={editingCode ? "Edit Promo Code" : "Generate Promo Code"}
                        onClose={closeModal}
                        footer={
                            <>
                                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button className="btn-submit" onClick={() => document.getElementById('promo-code-form').requestSubmit()}>
                                    {editingCode ? "Update Code" : "Generate Code"}
                                </button>
                            </>
                        }
                    >
                        <form id="promo-code-form" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Promo Code *</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        className="form-input-field"
                                        placeholder="JVJR44EH"
                                        value={newCode}
                                        onChange={(e) => setNewCode(e.target.value)}
                                        style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ whiteSpace: 'nowrap' }}
                                        onClick={() => setNewCode(generateCode())}
                                    >
                                        Auto
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Link to Promotion (optional)</label>
                                <select className="form-input-field" name="promo" defaultValue={editingCode?.promo || ''}>
                                    <option value="">Select promotion...</option>
                                    <option>Eid Mega Offer</option>
                                    <option>Seasonal Inspection</option>
                                </select>
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
                                        defaultValue={editingCode?.dVal || ''}
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
                                        defaultValue={editingCode?.minPurchase || 0}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Max Usage (0=unlimited)</label>
                                    <input
                                        type="number"
                                        name="maxUsage"
                                        className="form-input-field"
                                        defaultValue={editingCode?.maxUsage || 0}
                                    />
                                </div>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Valid From</label>
                                    <input type="datetime-local" name="startDate" className="form-input-field" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valid Until</label>
                                    <input type="datetime-local" name="endDate" className="form-input-field" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input-field" name="status" defaultValue={editingCode?.status || 'Active'}>
                                    <option value="Draft">Draft</option>
                                    <option value="Active">Active</option>
                                    <option value="Expired">Expired</option>
                                </select>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};
