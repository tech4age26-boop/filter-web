import React, { useState } from 'react';
import { CreditCard, Wallet, TrendingUp, Clock, AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  referrerGetWallet,
  referrerGetMyCommissions,
  referrerGetPayoutRequests,
  referrerGetPayoutDetails,
  referrerCreatePayoutRequest,
  formatSar,
  formatDate,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { EmptyState, ReferrerState } from './ReferrerStates';

const STATUS_LABEL = {
  paid: 'Paid',
  matured: 'Available',
  pending: 'Pending',
};

const PAYOUT_STATUS_LABEL = {
  pending: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
};

export default function ReferrerWallet() {
  // Inline request form rather than a modal: the balance, the request form and
  // the request history all belong on one screen, and a dialog hid the history
  // behind it at the moment the referrer most wanted to check it.
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const walletReq = useReferrerData(referrerGetWallet, []);
  const txReq = useReferrerData(() => referrerGetMyCommissions('all'), []);
  const payoutReq = useReferrerData(referrerGetPayoutRequests, []);
  const bankReq = useReferrerData(referrerGetPayoutDetails, []);

  const wallet = walletReq.data?.wallet;
  const commissions = txReq.data?.commissions ?? [];
  const payouts = payoutReq.data?.payouts ?? [];
  const bank = bankReq.data?.bank ?? null;

  const submitPayout = async () => {
    const value = Number(amount);
    const cap = Number(wallet?.available);

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
      setAmount('');
      setNotes('');
      // Both the history and what is still requestable change.
      await Promise.all([payoutReq.reload(), walletReq.reload()]);
    } catch (e) {
      // The backend re-checks balance, open requests and bank details, so its
      // message is the authoritative one.
      setSubmitError(e?.message || 'Could not submit your payout request.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setSubmitError('');
    setSubmitted(false);
  };

  // A React element is always truthy, so gate on the state itself.
  const showPlaceholder = walletReq.loading || walletReq.error || walletReq.notLinked;
  const placeholder = (
    <ReferrerState
      loading={walletReq.loading}
      error={walletReq.error}
      notLinked={walletReq.notLinked}
      onRetry={walletReq.reload}
      loadingLabel="Loading your wallet…"
    />
  );

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Wallet &amp; Earnings</h1>
          <p>Manage your commissions and payout requests.</p>
        </div>
      </header>

      {showPlaceholder ? placeholder : (
        <>
          <div className="rf-wallet-grid">
            <div className="rf-stat-card">
              <div className="rf-stat-header">
                <div
                  className="rf-stat-icon"
                  style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}
                >
                  <Wallet size={20} />
                </div>
                <span className="rf-stat-unit">SAR</span>
              </div>
              <div className="rf-stat-info">
                <p className="rf-stat-value">{formatSar(wallet?.available)}</p>
                <p className="rf-stat-label">Available Balance</p>
              </div>
            </div>

            <div className="rf-stat-card">
              <div className="rf-stat-header">
                <div
                  className="rf-stat-icon"
                  style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }}
                >
                  <Clock size={20} />
                </div>
                <span className="rf-stat-unit">SAR</span>
              </div>
              <div className="rf-stat-info">
                <p className="rf-stat-value">{formatSar(wallet?.pending)}</p>
                <p className="rf-stat-label">Pending Earnings</p>
              </div>
            </div>

            <div className="rf-stat-card">
              <div className="rf-stat-header">
                <div
                  className="rf-stat-icon"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-primary)' }}
                >
                  <TrendingUp size={20} />
                </div>
                <span className="rf-stat-unit">SAR</span>
              </div>
              <div className="rf-stat-info">
                <p className="rf-stat-value">{formatSar(wallet?.totalEarned)}</p>
                <p className="rf-stat-label">Total Earned</p>
              </div>
            </div>
          </div>

          {!formOpen && (
            <div className="rf-actions-bar">
              <button className="rf-btn-primary" onClick={() => setFormOpen(true)}>
                <CreditCard size={18} />
                Request Payout
              </button>
            </div>
          )}

          {formOpen && (
            <div className="rf-card" style={{ marginBottom: '2rem' }}>
              <div className="rf-card-header">
                <h3 className="rf-card-title">Request a Payout</h3>
                <button
                  onClick={closeForm}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {submitted ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                  <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
                  <p style={{ marginTop: '0.8rem', fontWeight: 600 }}>
                    Payout request submitted
                  </p>
                  <p style={{ marginTop: '0.3rem', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                    The marketing team will review it. Its status is in the table below.
                  </p>
                  <button className="rf-btn-outline" style={{ marginTop: '1.2rem' }} onClick={closeForm}>
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1.2rem', maxWidth: '520px' }}>
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
                    <p style={{ marginTop: '0.45rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      Available:{' '}
                      <span style={{ fontWeight: 600, color: '#16a34a' }}>
                        {formatSar(wallet?.available)} SAR
                      </span>
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
                    <label className="rf-label">Paid to</label>
                    <div
                      className="rf-input"
                      style={{
                        background: 'var(--color-bg-muted)',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.7rem',
                      }}
                    >
                      <CreditCard size={17} />
                      {bankReq.loading
                        ? 'Loading your bank details…'
                        : bank?.iban
                          ? `${bank.iban}${bank.bankName ? ` · ${bank.bankName}` : ''}`
                          : 'No bank account on file — contact the marketing team.'}
                    </div>
                  </div>

                  {submitError && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.55rem',
                        alignItems: 'flex-start',
                        color: '#dc2626',
                        fontSize: '0.86rem',
                      }}
                    >
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.7rem' }}>
                    <button
                      className="rf-btn-primary"
                      onClick={submitPayout}
                      disabled={submitting || !bank?.iban}
                    >
                      {submitting ? 'Submitting…' : 'Submit Request'}
                    </button>
                    <button className="rf-btn-outline" onClick={closeForm} disabled={submitting}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rf-card" style={{ marginBottom: '2rem' }}>
            <div className="rf-card-header">
              <h3 className="rf-card-title">Commission Transactions</h3>
            </div>

            {txReq.loading || txReq.error ? (
              <ReferrerState
                loading={txReq.loading}
                error={txReq.error}
                notLinked={txReq.notLinked}
                onRetry={txReq.reload}
                loadingLabel="Loading transactions…"
              />
            ) : commissions.length === 0 ? (
              <EmptyState message="No commissions recorded yet." />
            ) : (
              <div className="rf-table-container">
                <table className="rf-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Amount (SAR)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ color: 'var(--color-text-faint)' }}>
                          {formatDate(tx.createdAt)}
                        </td>
                        <td style={{ fontWeight: 600 }}>{tx.description || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatSar(tx.amount)}
                        </td>
                        <td>
                          <span className={`rf-badge rf-badge-${String(tx.status).toLowerCase()}`}>
                            {STATUS_LABEL[tx.status] || tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rf-card">
            <div className="rf-card-header">
              <h3 className="rf-card-title">Payout Requests</h3>
            </div>

            {payoutReq.loading || payoutReq.error ? (
              <ReferrerState
                loading={payoutReq.loading}
                error={payoutReq.error}
                notLinked={payoutReq.notLinked}
                onRetry={payoutReq.reload}
                loadingLabel="Loading payout requests…"
              />
            ) : payouts.length === 0 ? (
              <EmptyState message="You haven’t requested a payout yet." />
            ) : (
              <div className="rf-table-container">
                <table className="rf-table">
                  <thead>
                    <tr>
                      <th>Requested</th>
                      <th style={{ textAlign: 'right' }}>Amount (SAR)</th>
                      <th>Status</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((p) => (
                      <tr key={p.id}>
                        <td style={{ color: 'var(--color-text-faint)' }}>{formatDate(p.createdAt)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatSar(p.amount)}</td>
                        <td>
                          <span className={`rf-badge rf-badge-${String(p.status).toLowerCase()}`}>
                            {PAYOUT_STATUS_LABEL[p.status] || p.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          {p.status === 'rejected'
                            ? p.rejectionReason || 'No reason given'
                            : p.status === 'paid'
                              ? `Paid ${formatDate(p.paidAt)}`
                              : p.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
