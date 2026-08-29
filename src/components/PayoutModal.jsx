import React from 'react';
import { X, CreditCard, AlertCircle } from 'lucide-react';
import { referrerGetPayoutDetails } from '../services/referrerPortalApi';
import useReferrerData from '../pages/referrer-portal/useReferrerData';

export default function PayoutModal({ isOpen, onClose, balance }) {
    // The bank account was previously a hardcoded IBAN shown to every referrer.
    // Load the signed-in referrer's own details instead. Fetched once on mount
    // rather than on open, so the details are ready when the modal appears.
    const { data, loading, error } = useReferrerData(referrerGetPayoutDetails, []);
    const bank = data?.bank ?? null;

    if (!isOpen) return null;

    const renderBank = () => {
        if (loading) {
            return <span style={{ opacity: 0.6 }}>Loading your bank details…</span>;
        }
        if (error) {
            return <span style={{ color: '#dc2626' }}>{error}</span>;
        }
        if (!bank?.iban) {
            return (
                <span style={{ opacity: 0.7 }}>
                    No bank account on file — contact the marketing team to add one.
                </span>
            );
        }
        return (
            <span>
                {bank.iban}
                {bank.bankName ? ` · ${bank.bankName}` : ''}
            </span>
        );
    };

    return (
        <div className="rf-modal-overlay" onClick={onClose}>
            <div className="rf-modal-content" onClick={e => e.stopPropagation()}>
                <div className="rf-card-header" style={{ marginBottom: '2rem' }}>
                    <h3 className="rf-modal-title">Request Payout</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="rf-form-group">
                    <label className="rf-label">Amount (SAR)</label>
                    <div style={{ position: 'relative' }}>
                        <input className="rf-input" type="number" placeholder="0.00" autoFocus />
                    </div>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Available Balance: <span style={{ fontWeight: 600, color: '#16a34a' }}>{balance} SAR</span>
                    </p>
                </div>

                <div className="rf-form-group">
                    <label className="rf-label">Bank Account</label>
                    <div className="rf-input" style={{ background: 'var(--color-bg-muted)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <CreditCard size={18} />
                        {renderBank()}
                    </div>
                </div>

                {/*
                  Submitting a payout is not implemented yet — there is no payout model
                  or endpoint. The button used to be wired to onClose, which looked like
                  it submitted and silently did nothing. Say so instead.
                */}
                <div
                    className="rf-form-group"
                    style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                        Payout requests aren’t available yet. Please contact the marketing
                        team to arrange a payout.
                    </span>
                </div>

                <div className="rf-modal-footer">
                    <button className="rf-btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
