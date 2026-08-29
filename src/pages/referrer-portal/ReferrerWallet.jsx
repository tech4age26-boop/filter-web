import React, { useState } from 'react';
import { CreditCard, Wallet, TrendingUp, Clock } from 'lucide-react';
import PayoutModal from '../../components/PayoutModal';
import {
  referrerGetWallet,
  referrerGetMyCommissions,
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

export default function ReferrerWallet() {
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  const walletReq = useReferrerData(referrerGetWallet, []);
  const txReq = useReferrerData(() => referrerGetMyCommissions('all'), []);

  const wallet = walletReq.data?.wallet;
  const commissions = txReq.data?.commissions ?? [];

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
      <PayoutModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        balance={formatSar(wallet?.available)}
      />

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

          <div className="rf-actions-bar">
            <button className="rf-btn-primary" onClick={() => setIsPayoutModalOpen(true)}>
              <CreditCard size={18} />
              Request Payout
            </button>
          </div>

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
              <h3 className="rf-card-title">Payout History</h3>
            </div>
            {/*
              Payout requests are not implemented yet — there is no payout model in
              the schema. Showing an honest note rather than invented history.
            */}
            <EmptyState message="Payout requests aren’t available yet." />
          </div>
        </>
      )}
    </div>
  );
}
