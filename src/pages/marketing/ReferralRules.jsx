import React, { useEffect, useState } from 'react';
import { motion as m, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Edit2, Trash2, X, AlertCircle, 
    User, Building, Shield, CheckCircle2, Info
} from 'lucide-react';
import { MOCK_RULES } from '../referral-management/RM_Rules';
import { MarketingReferralRulesSkeleton } from './MarketingShimmer';

export default function ReferralRules() {
    const [layoutBooting, setLayoutBooting] = useState(true);
    useEffect(() => {
        const id = window.setTimeout(() => setLayoutBooting(false), 100);
        return () => window.clearTimeout(id);
    }, []);

    // Main layout state
    const [activeTab, setActiveTab] = useState('rules'); // 'types' or 'rules'
    const [activeType, setActiveType] = useState('Individual');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Data state
    const [rules, setRules] = useState(MOCK_RULES);
    const [referralTypes, setReferralTypes] = useState([
        { id: 1, name: 'Individual', status: 'Active', icon: User },
        { id: 2, name: 'Corporate', status: 'Active', icon: Building },
        { id: 3, name: 'Franchise', status: 'Active', icon: Shield },
    ]);

    // Modal & Form state
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [newTypeName, setNewTypeName] = useState('');

    // Rule Form state
    const [ruleTitle, setRuleTitle] = useState('');
    const [logicType, setLogicType] = useState('One-Time Activation');
    const [targetType, setTargetType] = useState('New Customers');
    const [limit, setLimit] = useState('');
    const [plateLimit, setPlateLimit] = useState('');
    const [discount, setDiscount] = useState('');
    const [perks, setPerks] = useState('');

    const filteredRules = rules.filter(rule => 
        rule.type === activeType && 
        (searchQuery === '' || 
         rule.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
         (rule.title && rule.title.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    const resetRuleForm = () => {
        setRuleTitle('');
        setLogicType('One-Time Activation');
        setTargetType('New Customers');
        setLimit('');
        setPlateLimit('');
        setDiscount('');
        setPerks('');
        setEditingRule(null);
    };

    const handleSaveRule = () => {
        if (!ruleTitle.trim()) return;

        const ruleData = {
            id: editingRule ? editingRule.id : Date.now(),
            type: activeType,
            title: ruleTitle,
            logic: logicType,
            target: targetType,
            limit: Number(limit) || 0,
            plateLimit: Number(plateLimit) || 0,
            discount: Number(discount) || 0,
            perks: perks,
            status: 'Active'
        };

        if (editingRule) {
            setRules(rules.map(r => r.id === editingRule.id ? ruleData : r));
        } else {
            setRules([...rules, ruleData]);
        }

        setIsRulesModalOpen(false);
        resetRuleForm();
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setRuleTitle(rule.title || '');
        setLogicType(rule.logic || 'One-Time Activation');
        setTargetType(rule.target || 'New Customers');
        setLimit(rule.limit || '');
        setPlateLimit(rule.plateLimit || '');
        setDiscount(rule.discount || '');
        setPerks(rule.perks || '');
        setActiveType(rule.type);
        setIsRulesModalOpen(true);
    };

    const handleDeleteRule = (id) => {
        if (window.confirm('Are you sure you want to delete this rule?')) {
            setRules(rules.filter(r => r.id !== id));
        }
    };

    const toggleTypeStatus = (id) => {
        setReferralTypes(prev => prev.map(t => 
            t.id === id ? { ...t, status: t.status === 'Active' ? 'Inactive' : 'Active' } : t
        ));
    };

    const handleAddType = () => {
        if (!newTypeName.trim()) return;
        const newType = {
            id: Date.now(),
            name: newTypeName,
            status: 'Active',
            icon: Shield
        };
        setReferralTypes([...referralTypes, newType]);
        setNewTypeName('');
        setIsTypeModalOpen(false);
    };

    if (layoutBooting) {
        return <MarketingReferralRulesSkeleton />;
    }

    return (
        <div className="module-container" style={{ padding: '2rem' }}>
            {/* Main Tabs Switcher */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem' }}>
                <button
                    onClick={() => setActiveTab('types')}
                    style={{
                        padding: '0.75rem 2rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: activeTab === 'types' ? 'var(--color-primary)' : 'transparent',
                        color: activeTab === 'types' ? '#000' : 'var(--color-text-muted)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: '0.9rem',
                        boxShadow: activeTab === 'types' ? '0 8px 16px rgba(255,214,0,0.2)' : 'none'
                    }}
                >
                    Referral Types
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    style={{
                        padding: '0.75rem 2rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: activeTab === 'rules' ? 'var(--color-primary)' : 'transparent',
                        color: activeTab === 'rules' ? '#000' : 'var(--color-text-muted)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: '0.9rem',
                        boxShadow: activeTab === 'rules' ? '0 8px 16px rgba(255,214,0,0.2)' : 'none'
                    }}
                >
                    Referral Rules
                </button>
            </div>

            {activeTab === 'types' ? (
                /* REFERRAL TYPES VIEW */
                <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="module-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Manage Referral Types</h2>
                            <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Configure and toggle active referral categories.</p>
                        </div>
                        <button 
                            className="btn-portal" 
                            onClick={() => setIsTypeModalOpen(true)}
                            style={{ background: 'var(--gradient-gold)', color: '#000', fontWeight: 800, padding: '0.75rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer' }}
                        >
                            <Plus size={20} />
                            CREATE REFERRAL TYPE
                        </button>
                    </div>

                    <div className="rf-card" style={{ background: '#fff', borderRadius: '24px', padding: '1.5rem', boxShadow: 'var(--shadow-premium)' }}>
                        <div className="premium-table-wrapper">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border-light)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>TYPE ID</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>REFERRAL TYPE NAME</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>STATUS</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {referralTypes.map((type) => (
                                        <tr key={type.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                            <td style={{ padding: '1.25rem 1rem', fontWeight: 700 }}>#RT-0{type.id}</td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
                                                        <type.icon size={18} />
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{type.name}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div 
                                                    onClick={() => toggleTypeStatus(type.id)}
                                                    style={{ 
                                                        width: '44px', 
                                                        height: '24px', 
                                                        background: type.status === 'Active' ? 'var(--color-primary)' : '#E5E7EB',
                                                        borderRadius: '20px',
                                                        position: 'relative',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    <div style={{ 
                                                        width: '18px', 
                                                        height: '18px', 
                                                        background: '#fff', 
                                                        borderRadius: '50%',
                                                        position: 'absolute',
                                                        top: '3px',
                                                        left: type.status === 'Active' ? '23px' : '3px',
                                                        transition: 'all 0.3s ease',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                    }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button style={{ border: 'none', background: 'rgba(0,0,0,0.05)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </m.div>
            ) : (
                /* REFERRAL RULES VIEW */
                <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="module-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {referralTypes.filter(t => t.status === 'Active').map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setActiveType(type.name)}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: activeType === type.name ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                                        color: activeType === type.name ? '#000' : 'var(--color-text-muted)',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: activeType === type.name ? '0 8px 16px rgba(255,214,0,0.2)' : 'none'
                                    }}
                                >
                                    <type.icon size={18} />
                                    {type.name}
                                </button>
                            ))}
                        </div>
                        <button 
                            className="btn-portal" 
                            onClick={() => {
                                resetRuleForm();
                                setIsRulesModalOpen(true);
                            }}
                            style={{ background: 'var(--gradient-gold)', color: '#000', fontWeight: 800, padding: '0.75rem 1.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', cursor: 'pointer' }}
                        >
                            <Plus size={20} />
                            CREATE RULE
                        </button>
                    </div>

                    <div className="rf-card" style={{ background: '#fff', borderRadius: '24px', padding: '1.5rem', boxShadow: 'var(--shadow-premium)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{activeType} Referral Rules</h3>
                            <div className="search-bar-mini" style={{ width: '300px' }}>
                                <Search size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search by target..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="premium-table-wrapper">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border-light)' }}>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>RULE ID</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>RULE NAME</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>LOGIC TYPE</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>TARGET</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>LIMITS</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>DISCOUNT</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>SPECIAL PERKS</th>
                                        <th style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRules.length > 0 ? filteredRules.map((rule) => (
                                        <tr key={rule.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                            <td style={{ padding: '1.25rem 1rem', fontWeight: 700 }}>#R00{rule.id}</td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ fontWeight: 800 }}>{rule.title || 'Standard Rule'}</div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 700 }}>{rule.logic || 'Generic'}</span>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                    {rule.target}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ fontSize: '0.85rem' }}>
                                                    <div>Total: <strong>{rule.limit}</strong></div>
                                                    <div>Per Plate: <strong>{rule.plateLimit}</strong></div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{rule.discount}%</span>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', maxWidth: '200px', fontStyle: 'italic' }}>
                                                    {rule.perks || 'None'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.25rem 1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button 
                                                        onClick={() => handleEditRule(rule)}
                                                        style={{ border: 'none', background: 'rgba(0,0,0,0.05)', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRule(rule.id)}
                                                        style={{ border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                                                <AlertCircle size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                                <p>No rules found for {activeType}</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </m.div>
            )}

            {/* CREATE RULE MODAL */}
            <AnimatePresence>
                {isRulesModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsRulesModalOpen(false)}>
                        <m.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="modal-content"
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: '500px' }}
                        >
                            <div className="modal-header-content">
                                <h3>{editingRule ? 'Edit' : 'Create'} Referral Rule</h3>
                                <button className="close-btn" onClick={() => setIsRulesModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body-content">
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label">Rule Title</label>
                                    <input 
                                        type="text" 
                                        className="form-input-field" 
                                        placeholder="e.g. Fleet Volume Discount, Welcome Promo..."
                                        value={ruleTitle}
                                        onChange={(e) => setRuleTitle(e.target.value)}
                                    />
                                </div>
                                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Referrer Type</label>
                                        <select 
                                            className="form-input-field" 
                                            value={activeType}
                                            onChange={(e) => setActiveType(e.target.value)}
                                        >
                                            {referralTypes.filter(t => t.status === 'Active').map(t => (
                                                <option key={t.id} value={t.name}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Rule Logic Type</label>
                                        <select 
                                            className="form-input-field"
                                            value={logicType}
                                            onChange={(e) => setLogicType(e.target.value)}
                                        >
                                            <option>One-Time Activation</option>
                                            <option>Plate Loyalty (X visits)</option>
                                            <option>Volume Tier (Fleet)</option>
                                            <option>Fixed Commission</option>
                                            <option>Partner Warranty Expansion</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label">Target Customer Type</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <label style={{ flex: 1, cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                name="target" 
                                                checked={targetType === 'New Customers'} 
                                                onChange={() => setTargetType('New Customers')}
                                                style={{ display: 'none' }} 
                                            />
                                            <div 
                                                style={{ 
                                                    padding: '0.75rem', 
                                                    border: targetType === 'New Customers' ? '2px solid var(--color-primary)' : '1px solid var(--color-border-light)', 
                                                    borderRadius: '12px', 
                                                    textAlign: 'center', 
                                                    fontWeight: 700,
                                                    transition: 'all 0.2s ease',
                                                    color: targetType === 'New Customers' ? 'var(--color-text-main)' : 'var(--color-text-muted)'
                                                }}
                                            >
                                                New Customers
                                            </div>
                                        </label>
                                        <label style={{ flex: 1, cursor: 'pointer' }}>
                                            <input 
                                                type="radio" 
                                                name="target" 
                                                checked={targetType === 'Ongoing'} 
                                                onChange={() => setTargetType('Ongoing')}
                                                style={{ display: 'none' }} 
                                            />
                                            <div 
                                                style={{ 
                                                    padding: '0.75rem', 
                                                    border: targetType === 'Ongoing' ? '2px solid var(--color-primary)' : '1px solid var(--color-border-light)', 
                                                    borderRadius: '12px', 
                                                    textAlign: 'center', 
                                                    fontWeight: 700,
                                                    transition: 'all 0.2s ease',
                                                    color: targetType === 'Ongoing' ? 'var(--color-text-main)' : 'var(--color-text-muted)'
                                                }}
                                            >
                                                Ongoing
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Total Limit</label>
                                        <input 
                                            type="number" 
                                            className="form-input-field" 
                                            placeholder="e.g. 500" 
                                            value={limit}
                                            onChange={(e) => setLimit(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Limit Per Plate</label>
                                        <input 
                                            type="number" 
                                            className="form-input-field" 
                                            placeholder="e.g. 5" 
                                            value={plateLimit}
                                            onChange={(e) => setPlateLimit(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Discount (%)</label>
                                        <input 
                                            type="number" 
                                            className="form-input-field" 
                                            placeholder="e.g. 10" 
                                            value={discount}
                                            onChange={(e) => setDiscount(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.25rem', marginTop: '1.25rem' }}>
                                    <label className="form-label">Special Perks & Benefits Description</label>
                                    <textarea 
                                        className="form-input-field" 
                                        placeholder="e.g. Free generic car wash, Priority express lane access, 5th plate free..."
                                        style={{ height: '80px', paddingTop: '10px' }}
                                        value={perks}
                                        onChange={(e) => setPerks(e.target.value)}
                                    ></textarea>
                                </div>
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <Info size={18} color="var(--color-primary)" />
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        Rules apply to the selected {activeType.toLowerCase()} category and are tracked per number plate.
                                    </p>
                                </div>
                            </div>
                            <div className="modal-footer-content" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsRulesModalOpen(false)}>Cancel</button>
                                <button 
                                    className="btn-submit" 
                                    style={{ flex: 1, background: 'var(--gradient-gold)', color: '#000' }}
                                    onClick={handleSaveRule}
                                >
                                    {editingRule ? 'Update Rule' : 'Save Rule'}
                                </button>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>

            {/* CREATE TYPE MODAL */}
            <AnimatePresence>
                {isTypeModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsTypeModalOpen(false)}>
                        <m.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="modal-content"
                            onClick={e => e.stopPropagation()}
                            style={{ maxWidth: '400px' }}
                        >
                            <div className="modal-header-content">
                                <h3>Create Referral Type</h3>
                                <button className="close-btn" onClick={() => setIsTypeModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body-content">
                                <div className="form-group">
                                    <label className="form-label">Type Name</label>
                                    <input 
                                        type="text" 
                                        className="form-input-field" 
                                        placeholder="e.g. Corporate, Influencer..."
                                        value={newTypeName}
                                        onChange={(e) => setNewTypeName(e.target.value)}
                                    />
                                </div>
                                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,214,0,0.1)', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <CheckCircle2 size={18} color="var(--color-primary)" />
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        New types are active by default and can have custom rules assigned.
                                    </p>
                                </div>
                            </div>
                            <div className="modal-footer-content" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsTypeModalOpen(false)}>Cancel</button>
                                <button className="btn-submit" style={{ flex: 1, background: 'var(--gradient-gold)', color: '#000' }} onClick={handleAddType}>Create Type</button>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
