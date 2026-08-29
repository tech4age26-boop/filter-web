import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, CreditCard, ChevronRight, TrendingUp, Wallet, Clock, CheckCircle, Users,
} from 'lucide-react';
import {
  CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
} from 'recharts';
import PayoutModal from '../../components/PayoutModal';
import {
  referrerGetMe,
  referrerGetMyCommissions,
  formatSar,
  formatDate,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { EmptyState, ReferrerState } from './ReferrerStates';

const STATUS_LABEL = { paid: 'Paid', matured: 'Available', pending: 'Pending' };

/**
 * Monthly earnings from real commission rows.
 * Buckets the last 6 months so the chart reflects this referrer, not a fixed series.
 */
function buildTrend(commissions) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      name: d.toLocaleString('en-US', { month: 'short' }),
      earnings: 0,
    });
  }

  const index = new Map(months.map((m) => [m.key, m]));
  for (const c of commissions) {
    if (!c.createdAt) continue;
    const d = new Date(c.createdAt);
    const bucket = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.earnings += Number(c.amount) || 0;
  }

  return months;
}

export default function ReferrerDashboard() {
  const navigate = useNavigate();
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);

  const meReq = useReferrerData(referrerGetMe, []);
  const commReq = useReferrerData(() => referrerGetMyCommissions('all'), []);

  const referrer = meReq.data?.referrer;
  const stats = meReq.data?.stats;
  const commissions = useMemo(() => commReq.data?.commissions ?? [], [commReq.data]);

  const trend = useMemo(() => buildTrend(commissions), [commissions]);

  const statCards = [
    { label: 'Total Earned', value: formatSar(stats?.totalEarned), unit: 'SAR', icon: TrendingUp },
    { label: 'Available Balance', value: formatSar(stats?.available), unit: 'SAR', icon: Wallet },
    { label: 'Pending Commission', value: formatSar(stats?.pending), unit: 'SAR', icon: Clock },
    { label: 'Paid Commission', value: formatSar(stats?.paid), unit: 'SAR', icon: CheckCircle },
    { label: 'Total Referrals', value: String(stats?.totalReferrals ?? 0), unit: '', icon: Users },
  ];

  // A React element is always truthy, so gate on the state itself.
  const showPlaceholder = meReq.loading || meReq.error || meReq.notLinked;
  const placeholder = (
    <ReferrerState
      loading={meReq.loading}
      error={meReq.error}
      notLinked={meReq.notLinked}
      onRetry={meReq.reload}
      loadingLabel="Loading your dashboard…"
    />
  );

  return (
    <div className="rf-dashboard">
      <PayoutModal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        balance={formatSar(stats?.available)}
        available={stats?.available}
        onSubmitted={() => meReq.reload()}
      />

      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Welcome back{referrer?.name ? `, ${referrer.name}` : ''}!</h1>
          <p>
            {referrer
              ? `${referrer.referralCode} • ${
                  referrer.commissionType === 'fixed'
                    ? `${formatSar(referrer.commissionValue)} SAR per referral`
                    : `${referrer.commissionValue}% commission`
                }`
              : ''}
          </p>
        </div>
      </header>

      {showPlaceholder ? placeholder : (
        <>
          <div className="rf-stats-grid">
            {statCards.map((stat) => (
              <div key={stat.label} className="rf-stat-card">
                <div className="rf-stat-header">
                  <div className="rf-stat-icon">
                    <stat.icon size={20} />
                  </div>
                  {stat.unit && <span className="rf-stat-unit">{stat.unit}</span>}
                </div>
                <div className="rf-stat-info">
                  <p className="rf-stat-value">{stat.value}</p>
                  <p className="rf-stat-label">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rf-actions-bar">
            <button
              className="rf-btn-primary"
              onClick={() => navigate('/referrer-portal/add_referral')}
            >
              <Plus size={18} />
              Add Referral
            </button>
            <button className="rf-btn-outline" onClick={() => setIsPayoutModalOpen(true)}>
              <CreditCard size={18} />
              Request Payout
            </button>
          </div>

          <div className="rf-split-grid">
            <div className="rf-card">
              <div className="rf-card-header">
                <h3 className="rf-card-title">Earnings Trend</h3>
              </div>
              <div className="rf-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="colorGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--color-text-faint)' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: 'var(--color-text-faint)' }}
                    />
                    <Tooltip
                      formatter={(v) => [`${formatSar(v)} SAR`, 'Earnings']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-premium)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="earnings"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorGold)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="rf-card"
              onClick={() => navigate('/referrer-portal/notifications')}
              style={{ cursor: 'pointer' }}
            >
              <div className="rf-card-header">
                <h3 className="rf-card-title">Recent Notifications</h3>
                <ChevronRight size={18} className="rf-icon-dim" />
              </div>
              {/*
                No notification feed exists for referrers yet — an honest empty state
                rather than the invented "you earned SAR 5,000" messages this showed before.
              */}
              <EmptyState message="No notifications yet." />
            </div>
          </div>

          <div
            className="rf-card"
            onClick={() => navigate('/referrer-portal/wallet')}
            style={{ cursor: 'pointer' }}
          >
            <div className="rf-card-header">
              <h3 className="rf-card-title">Recent Commissions</h3>
              <ChevronRight size={18} className="rf-icon-dim" />
            </div>

            {commReq.loading || commReq.error ? (
              <ReferrerState
                loading={commReq.loading}
                error={commReq.error}
                notLinked={commReq.notLinked}
                onRetry={commReq.reload}
                loadingLabel="Loading commissions…"
              />
            ) : commissions.length === 0 ? (
              <EmptyState message="No commissions recorded yet." />
            ) : (
              <div className="rf-table-container">
                <table className="rf-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Amount (SAR)</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.slice(0, 4).map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.description || '—'}</td>
                        <td>
                          <span className={`rf-badge rf-badge-${String(c.status).toLowerCase()}`}>
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatSar(c.amount)}</td>
                        <td>{formatDate(c.createdAt)}</td>
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
