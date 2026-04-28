import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, FileText, MousePointer2, Ticket, TrendingUp, DollarSign, Award, Star, ChevronRight, ChevronDown, Plus, Clock, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { StatCardMini } from './MarketingUtils';
import { ReferralTypeModal } from './ReferralTypeModal';

export const ReferralManagement = ({
    showAdd: propsShowAdd,
    setShowAdd: propsSetShowAdd,
    onCancel,
    referralCodes: propsReferrals,
    setReferralCodes: propsSetReferrals
}) => {
    const ctx = useOutletContext() || {};
    const referrals = propsReferrals || ctx.referralCodes || [];
    const setReferrals = propsSetReferrals || ctx.setReferralCodes;
    const showAdd = propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;
    const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;

    const [activeTab, setActiveTab] = useState('referrals');
    const [referralType, setReferralType] = useState(null);

    const isModalOpen = showAdd || !!referralType;

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setReferralType(null);
    };

    const handleSuccess = (newRef) => {
        setReferrals([newRef, ...referrals]);
    };

    const renderLedger = () => (
        <div className="commission-ledger">
            <div className="dashboard-stats-row" style={{ marginBottom: '24px' }}>
                <div className="dashboard-stat-card" style={{ background: 'white' }}>
                    <div className="flex items-center gap-3">
                        <div style={{ background: '#FFFBEB', padding: '10px', borderRadius: '10px', color: '#D97706' }}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Pending Commissions</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>SAR 0.00</h3>
                        </div>
                    </div>
                </div>
                <div className="dashboard-stat-card" style={{ background: 'white' }}>
                    <div className="flex items-center gap-3">
                        <div style={{ background: '#ECFDF5', padding: '10px', borderRadius: '10px', color: '#10B981' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={12} style={{ transform: 'rotate(45deg)' }} />
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Paid Commissions</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>SAR 0.00</h3>
                        </div>
                    </div>
                </div>
                <div className="dashboard-stat-card" style={{ background: 'white' }}>
                    <div className="flex items-center gap-3">
                        <div style={{ background: '#F3F4F6', padding: '10px', borderRadius: '10px', color: '#374151' }}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Total Referrals Tracked</p>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>0</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '13px',
                color: '#1E40AF'
            }}>
                <FileText size={16} />
                Payments are automatically posted to <strong>Chart of Accounts → Referral Commission Payables</strong>. Each payment creates a journal entry (Debit: Referral Commission Payables / Credit: Cash or Bank Account) and sends an email notification to the referrer.
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <div style={{ position: 'relative', width: '220px' }}>
                    <select className="form-input-field" style={{ paddingRight: '40px', height: '44px', fontWeight: 600 }}>
                        <option>All Types</option>
                        <option>Corporate</option>
                        <option>Franchise</option>
                        <option>Walk-in</option>
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280' }} />
                </div>
                <div style={{ position: 'relative', width: '220px' }}>
                    <select className="form-input-field" style={{ paddingRight: '40px', height: '44px', fontWeight: 600 }}>
                        <option>All Commissions</option>
                        <option>Pending</option>
                        <option>Paid</option>
                        <option>Failed</option>
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280' }} />
                </div>
            </div>

            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
                <DollarSign size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p style={{ fontSize: '16px', fontWeight: 500 }}>No commission records found</p>
            </div>
        </div>
    );

    return (
        <div className="referral-management-view">
            <div className="referral-header-tabs" style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
                <div
                    onClick={() => setActiveTab('referrals')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                        color: activeTab === 'referrals' ? 'var(--color-primary)' : '#6B7280',
                        fontWeight: activeTab === 'referrals' ? 800 : 500,
                        fontSize: '15px'
                    }}
                >
                    <Users size={18} /> Referrals
                </div>
                <div
                    onClick={() => setActiveTab('ledger')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                        color: activeTab === 'ledger' ? 'var(--color-primary)' : '#6B7280',
                        fontWeight: activeTab === 'ledger' ? 800 : 500,
                        fontSize: '15px'
                    }}
                >
                    <FileText size={18} /> Commission Ledger
                </div>
            </div>

            {activeTab === 'ledger' ? renderLedger() : (
                <>
                    <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
                        <StatCardMini title="Total Referrals" value={referrals.length} icon={MousePointer2} />
                        <StatCardMini title="Active Codes" value={referrals.filter(r => r.status === 'Active').length} icon={Ticket} />
                        <StatCardMini title="Sales Generated" value="SAR 850K" icon={TrendingUp} />
                        <StatCardMini title="Commission Due" value="SAR 4,200" icon={DollarSign} />
                    </div>
                    <div className="marketing-grid" style={{ marginBottom: '40px' }}>
                        {[
                            { id: 'corporate', type: 'Corporate Customer', icon: Award, desc: 'Partner with companies to refer employees.' },
                            { id: 'franchise', type: 'Franchise Partner', icon: Star, desc: 'Global referral network for franchise expansion.' },
                            { id: 'walk-in', type: 'Walk-in Customer Referral', icon: Users, desc: 'Individual customers referring friends.' }
                        ].map(t => (
                            <div
                                key={t.id}
                                className="marketing-card"
                                style={{ cursor: 'pointer', textAlign: 'center' }}
                                onClick={() => {
                                    setReferralType(t.id);
                                    if (setShowAdd) setShowAdd(true);
                                }}
                            >
                                <div style={{ background: 'rgba(255, 215, 0, 0.1)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-primary)' }}>
                                    <t.icon size={24} />
                                </div>
                                <h3 className="marketing-card-title">{t.type}</h3>
                                <p style={{ fontSize: '13px', color: '#6C757D', marginTop: '8px' }}>{t.desc}</p>
                                <button className="panel-link" style={{ marginTop: '16px' }}>CREATE CODE <ChevronRight size={14} /></button>
                            </div>
                        ))}
                    </div>

                    <h4 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px' }}>Recent Referral Codes</h4>
                    <section className="premium-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Type</th>
                                    <th className="table-th">Code</th>
                                    <th className="table-th">Referrer Name</th>
                                    <th className="table-th">Analytics</th>
                                    <th className="table-th">Status</th>
                                    <th className="table-th">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {referrals.map((r) => (
                                    <tr key={r.id} className="table-row">
                                        <td className="table-cell">
                                            <div className="cell-main-text">{r.typeLabel}</div>
                                        </td>
                                        <td className="table-cell">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <code style={{ background: '#F9FAFB', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>{r.code}</code>
                                            </div>
                                        </td>
                                        <td className="table-cell">{r.referrerName}</td>
                                        <td className="table-cell">
                                            <div style={{ fontSize: '11px', color: '#6B7280' }}>
                                                <div>Uses: 0</div>
                                                <div>Earnings: SAR 0</div>
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <span className="marketing-card-badge badge-active">{r.status}</span>
                                        </td>
                                        <td className="table-cell">
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="icon-btn-mini" title="Edit"><Pencil size={14} /></button>
                                                <button className="icon-btn-mini text-danger" title="Delete"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {referrals.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                                            No referral codes generated yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                </>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <ReferralTypeModal
                        type={referralType || 'walk-in'}
                        onClose={closeModal}
                        onSuccess={handleSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
