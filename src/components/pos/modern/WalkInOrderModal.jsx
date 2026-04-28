import React, { useState } from 'react';
import { X, Car, Hash, Gauge, Plus, Check, RefreshCw } from 'lucide-react';

export default function WalkInOrderModal({ isOpen, onClose, onSubmit, departments, loading }) {
    const [formData, setFormData] = useState({
        vehicleNumber: '',
        make: '',
        model: '',
        odometerReading: '',
        departmentIds: []
    });

    if (!isOpen) return null;

    const toggleDept = (id) => {
        setFormData(prev => {
            const exists = prev.departmentIds.includes(String(id));
            const next = exists 
                ? prev.departmentIds.filter(d => d !== String(id))
                : [...prev.departmentIds, String(id)];
            return { ...prev, departmentIds: next };
        });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.vehicleNumber || formData.departmentIds.length === 0) {
            alert('Please enter Plate Number and select at least one Department.');
            return;
        }
        onSubmit({
            ...formData,
            odometerReading: parseInt(formData.odometerReading) || 0
        });
    };

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-medium" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <div className="modal-header-premium">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="header-icon-box"><Car size={24} /></div>
                        <div>
                            <h2 className="modal-title">New Walk-in Order</h2>
                            <p className="modal-subtitle">Enter vehicle details to start a job</p>
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit}>
                    <div className="modal-body-simple">
                        <div className="walkin-form-grid">
                            <div className="form-group">
                                <label><Hash size={14} /> Plate Number</label>
                                <input 
                                    className="modern-input"
                                    type="text" 
                                    placeholder="ABC-123"
                                    value={formData.vehicleNumber}
                                    onChange={e => setFormData({...formData, vehicleNumber: e.target.value.toUpperCase()})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label><Gauge size={14} /> Odometer Reading</label>
                                <input 
                                    className="modern-input"
                                    type="number" 
                                    placeholder="50000"
                                    value={formData.odometerReading}
                                    onChange={e => setFormData({...formData, odometerReading: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input 
                                    className="modern-input"
                                    type="text" 
                                    placeholder="Toyota"
                                    value={formData.make}
                                    onChange={e => setFormData({...formData, make: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input 
                                    className="modern-input"
                                    type="text" 
                                    placeholder="Camry"
                                    value={formData.model}
                                    onChange={e => setFormData({...formData, model: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="dept-selection-area" style={{ marginTop: 24 }}>
                            <label className="section-label" style={{ display: 'block', marginBottom: 12, fontSize: '0.7rem', fontWeight: 900, color: 'var(--pos-text-muted)', letterSpacing: 1 }}>SELECT DEPARTMENTS</label>
                            <div className="dept-grid-small" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {departments.map(dept => (
                                    <button 
                                        key={dept.id}
                                        type="button"
                                        className={`dept-pill-btn ${formData.departmentIds.includes(String(dept.id)) ? 'active' : ''}`}
                                        onClick={() => toggleDept(dept.id)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: 12,
                                            border: '1.5px solid var(--pos-border)',
                                            background: formData.departmentIds.includes(String(dept.id)) ? 'var(--pos-dark)' : '#fff',
                                            color: formData.departmentIds.includes(String(dept.id)) ? 'var(--pos-gold)' : 'var(--pos-text-muted)',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {formData.departmentIds.includes(String(dept.id)) && <Check size={14} />}
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-premium">
                        <button type="button" className="btn-modal btn-clear" onClick={onClose}>Cancel</button>
                        <button 
                            type="submit" 
                            className="btn-modal btn-confirm" 
                            style={{ flex: 1 }}
                            disabled={loading}
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Submit Walk-in Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

