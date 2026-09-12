import React, { useState } from 'react';
import { CreditCard, Wallet, TrendingUp } from 'lucide-react';
import PayoutModal from '../../components/PayoutModal';
import { rfT, rfStatusKey } from '../../utils/referrerPortalI18n';
import { rfBadgeClass, useReferrerPortal } from './useReferrerPortal';
import { referrerPortalCreatePayout } from '../../services/referrerPortalApi';

export default function ReferrerWallet() {
    const { locale, overview, reloadOverview } = useReferrerPortal();
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutError, setPayoutError] = useState('');
    const [payoutSubmitting, setPayoutSubmitting] = useState(false);

    const payouts = Array.isArray(overview?.payouts) ? overview.payouts : [];
    const iban = overview?.profile?.iban || '';
    const pendingTotal = payouts
        .filter((p) => String(p.status).toLowerCase() === 'pending')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paidTotal = payouts
        .filter((p) => ['paid', 'approved'].includes(String(p.status).toLowerCase()))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const submitPayout = async () => {
        const amount = Number(payoutAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setPayoutError(rfT(locale, 'payout.amountRequired'));
            return;
        }
        setPayoutSubmitting(true);
        setPayoutError('');
        try {
            await referrerPortalCreatePayout({ amount, method: 'bank' });
            setIsPayoutModalOpen(false);
            setPayoutAmount('');
            await reloadOverview?.();
        } catch (err) {
            setPayoutError(err?.message || rfT(locale, 'payout.error'));
        } finally {
            setPayoutSubmitting(false);
        }
    };

    return (
        <div className="rf-page">
            <PayoutModal
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                balance="0"
                iban={iban}
                locale={locale}
                amount={payoutAmount}
                onAmountChange={setPayoutAmount}
                onSubmit={submitPayout}
                submitting={payoutSubmitting}
                error={payoutError}
            />
            <p className="rf-page-lead">{rfT(locale, 'wallet.subtitle')}</p>

            <div className="rf-wallet-grid">
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon is-green">
                            <Wallet size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">0</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.available')}</p>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon is-amber">
                            <TrendingUp size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">{pendingTotal.toFixed(0)}</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.pending')}</p>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon">
                            <TrendingUp size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <p className="rf-stat-value">{paidTotal.toFixed(0)}</p>
                    <p className="rf-stat-label">{rfT(locale, 'wallet.total')}</p>
                </div>
            </div>

            <div className="rf-actions-bar">
                <button
                    type="button"
                    className="rf-btn-primary"
                    onClick={() => {
                        setPayoutError('');
                        setIsPayoutModalOpen(true);
                    }}
                >
                    <CreditCard size={16} />
                    {rfT(locale, 'wallet.request')}
                </button>
            </div>

            <div className="rf-card">
                <div className="rf-card-header">
                    <h3 className="rf-card-title">{rfT(locale, 'wallet.payoutHistory')}</h3>
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>{rfT(locale, 'table.date')}</th>
                                <th className="rf-num">{rfT(locale, 'table.amount')}</th>
                                <th>{rfT(locale, 'table.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan="3">{rfT(locale, 'wallet.emptyPayouts')}</td>
                                </tr>
                            ) : (
                                payouts.map((p) => (
                                    <tr key={p.id}>
                                        <td className="rf-muted">
                                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="rf-num">{Number(p.amount || 0).toFixed(2)}</td>
                                        <td>
                                            <span className={rfBadgeClass(p.status)}>
                                                {rfT(locale, rfStatusKey(p.status) || p.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
