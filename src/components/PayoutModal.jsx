import React, { useState } from 'react';
import { X, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
    referrerGetPayoutDetails,
    referrerCreatePayoutRequest,
    formatSar,
} from '../services/referrerPortalApi';
import useReferrerData from '../pages/referrer-portal/useReferrerData';

/**
 * Request a payout of the available balance.
 *
 * Previously this showed one hardcoded IBAN to every referrer and its "Submit
 * Request" button was wired to onClose — it looked like it submitted and did
 * nothing at all. It now loads the signed-in referrer's own bank details and
 * posts a real request.
 *
 * @param {number} available  available balance in SAR, used to validate the amount
 * @param {() => void} onSubmitted  called after a successful request so the
 *                                  parent can refresh its payout list
 */
export default function PayoutModal({ isOpen, onClose, balance, available, onSubmitted }) {
    const { data, loading, error } = useReferrerData(referrerGetPayoutDetails, []);
    const bank = data?.bank ?? null;

    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const close = () => {
        // Reset so reopening does not show the previous result.
        setAmount('');
        setNotes('');
        setSubmitError('');
        setSubmitted(false);
        onClose?.();
    };

    const submit = async () => {
        const value = Number(amount);
        const cap = Number(available);

        if (!Number.isFinite(value) || value <= 0) {
            setSubmitError('Enter an amount greater than zero.');
            return;
        }
        if (Number.isFinite(cap) && value > cap) {
            setSubmitError(`Amount exceeds your available balance of ${formatSar(cap)} SAR.`);
            return;
        }

        setSubmitting(true);
        setSubmitError('');
        try {
            await referrerCreatePayoutRequest(value, notes.trim() || undefined);
            setSubmitted(true);
            onSubmitted?.();
        } catch (e) {
            // The backend re-checks the balance, open requests and bank details,
            // so its message is the authoritative one to show.
            setSubmitError(e?.message || 'Could not submit your payout request.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderBank = () => {
        if (loading) return <span style={{ opacity: 0.6 }}>Loading your bank details…</span>;
        if (error) return <span style={{ color: '#dc2626' }}>{error}</span>;
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
        <div className="rf-modal-overlay" onClick={close}>
            <div className="rf-modal-content" onClick={e => e.stopPropagation()}>
                <div className="rf-card-header" style={{ marginBottom: '2rem' }}>
                    <h3 className="rf-modal-title">Request Payout</h3>
                    <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                        <X size={20} />
                    </button>
                </div>

                {submitted ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0 2rem' }}>
                        <CheckCircle2 size={36} style={{ color: '#16a34a' }} />
                        <p style={{ marginTop: '1rem', fontWeight: 600 }}>Payout request submitted</p>
                        <p style={{ marginTop: '0.35rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                            The marketing team will review it. You can track its status in your wallet.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="rf-form-group">
                            <label className="rf-label">Amount (SAR)</label>
                            <input
                                className="rf-input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={submitting}
                                autoFocus
                            />
                            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                Available Balance: <span style={{ fontWeight: 600, color: '#16a34a' }}>{balance} SAR</span>
                            </p>
                        </div>

                        <div className="rf-form-group">
                            <label className="rf-label">Note (optional)</label>
                            <input
                                className="rf-input"
                                placeholder="Anything the marketing team should know"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        <div className="rf-form-group">
                            <label className="rf-label">Bank Account</label>
                            <div className="rf-input" style={{ background: 'var(--color-bg-muted)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <CreditCard size={18} />
                                {renderBank()}
                            </div>
                        </div>

                        {submitError && (
                            <div
                                className="rf-form-group"
                                style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: '#dc2626', fontSize: '0.85rem' }}
                            >
                                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>{submitError}</span>
                            </div>
                        )}
                    </>
                )}

                <div className="rf-modal-footer">
                    {submitted ? (
                        <button className="rf-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={close}>
                            Done
                        </button>
                    ) : (
                        <>
                            <button
                                className="rf-btn-primary"
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={submit}
                                disabled={submitting || !bank?.iban}
                            >
                                {submitting ? 'Submitting…' : 'Submit Request'}
                            </button>
                            <button className="rf-btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={close}>
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
