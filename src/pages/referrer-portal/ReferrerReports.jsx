import React, { useMemo } from 'react';
import { Users, Target, TrendingUp, DollarSign, Car } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  referrerGetMe,
  referrerGetMyCommissions,
  referrerGetMyRedemptions,
  formatSar,
  formatDate,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { ReferrerState } from './ReferrerStates';

const STATUS_COLOR = {
  paid: '#10b981',
  matured: '#3b82f6',
  pending: '#f59e0b',
};

const STATUS_LABEL = {
  paid: 'Paid',
  matured: 'Available',
  pending: 'Pending',
};

/** Last 6 months of earnings, bucketed from this referrer's own commission rows. */
function buildMonthly(commissions) {
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

/** Commission count by status, for the breakdown pie. */
function buildBreakdown(commissions) {
  const counts = {};
  for (const c of commissions) {
    const s = String(c.status || 'unknown').toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).map(([status, value]) => ({
    name: STATUS_LABEL[status] || status,
    value,
    color: STATUS_COLOR[status] || '#9ca3af',
  }));
}

export default function ReferrerReports() {
  const meReq = useReferrerData(referrerGetMe, []);
  const commReq = useReferrerData(() => referrerGetMyCommissions('all'), []);
  const redReq = useReferrerData(referrerGetMyRedemptions, []);

  const stats = meReq.data?.stats;
  const commissions = useMemo(() => commReq.data?.commissions ?? [], [commReq.data]);
  const redemptions = useMemo(() => redReq.data?.redemptions ?? [], [redReq.data]);
  const uniquePlates = useMemo(
    () => new Set(redemptions.map((r) => r.plate)).size,
    [redemptions],
  );

  const monthly = useMemo(() => buildMonthly(commissions), [commissions]);
  const breakdown = useMemo(() => buildBreakdown(commissions), [commissions]);

  const paidCount = commissions.filter((c) => String(c.status).toLowerCase() === 'paid').length;
  const averageCommission = commissions.length
    ? commissions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) / commissions.length
    : 0;

  const statCards = [
    {
      label: 'Referred Accounts',
      value: String(stats?.totalReferrals ?? 0),
      icon: Users,
      color: '#3b82f6',
    },
    {
      label: 'Commission Lines',
      value: String(commissions.length),
      icon: Target,
      color: '#8b5cf6',
    },
    {
      label: 'Paid Commissions',
      value: String(paidCount),
      icon: TrendingUp,
      color: '#10b981',
    },
    {
      label: 'Average Commission',
      value: `${formatSar(averageCommission)} SAR`,
      icon: DollarSign,
      color: '#f59e0b',
    },
    {
      label: 'Code Uses',
      value: String(redemptions.length),
      icon: Target,
      color: '#0ea5e9',
    },
    {
      label: 'Vehicles Reached',
      value: String(uniquePlates),
      icon: Car,
      color: '#8b5cf6',
    },
  ];

  // A React element is always truthy, so gate on the state itself.
  // Only genuine load failures suppress the report. A referrer with no activity
  // still gets a report — one that legitimately reads zero — rather than a blank
  // screen, which is indistinguishable from something being broken.
  const showPlaceholder =
    meReq.loading || commReq.loading || meReq.error || commReq.error || meReq.notLinked;
  const placeholder = (
    <ReferrerState
      loading={meReq.loading || commReq.loading}
      error={meReq.error || commReq.error}
      notLinked={meReq.notLinked}
      onRetry={() => {
        meReq.reload();
        commReq.reload();
      }}
      loadingLabel="Loading your reports…"
    />
  );

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Reports &amp; Analytics</h1>
          <p>Detailed performance metrics and commission data.</p>
        </div>
      </header>

      {showPlaceholder ? placeholder : (
        <>
          <div
            className="rf-stats-grid"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2.5rem' }}
          >
            {statCards.map((stat) => (
              <div key={stat.label} className="rf-stat-card">
                <div className="rf-stat-header">
                  <div
                    className="rf-stat-icon"
                    style={{ background: `${stat.color}15`, color: stat.color }}
                  >
                    <stat.icon size={20} />
                  </div>
                </div>
                <div className="rf-stat-info">
                  <p className="rf-stat-value">{stat.value}</p>
                  <p className="rf-stat-label">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {commissions.length === 0 && (
            <div className="rf-card" style={{ marginBottom: '1.5rem', padding: '0.9rem 1.2rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                No commissions recorded yet, so the figures below read zero. They will
                fill in as your code is used.
              </p>
            </div>
          )}

          <div className="rf-split-grid">
              <div className="rf-card">
                <div className="rf-card-header">
                  <h3 className="rf-card-title">Monthly Earnings</h3>
                </div>
                <div className="rf-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly}>
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
                      <Bar dataKey="earnings" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rf-card">
                <div className="rf-card-header">
                  <h3 className="rf-card-title">Commission Status</h3>
                </div>
                <div className="rf-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        {breakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
          </div>

          {/* Which vehicles actually used the code — only meaningful once there
              are redemptions, so it appears rather than showing an empty table. */}
          {redemptions.length > 0 && (
            <div className="rf-card" style={{ marginTop: '2rem' }}>
              <div className="rf-card-header">
                <h3 className="rf-card-title">Code Usage by Vehicle</h3>
              </div>
              <div className="rf-table-container">
                <table className="rf-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th style={{ textAlign: 'right' }}>Customer Spend</th>
                      <th style={{ textAlign: 'right' }}>You Earned</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redemptions.map((r) => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--color-text-faint)' }}>{formatDate(r.createdAt)}</td>
                        <td style={{ fontWeight: 600 }}>{r.plate}</td>
                        <td style={{ textAlign: 'right' }}>
                          {r.amount === null ? '—' : formatSar(r.amount)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {r.commissionAmount === null ? '—' : formatSar(r.commissionAmount)}
                        </td>
                        <td>
                          {r.commissionStatus ? (
                            <span className={`rf-badge rf-badge-${r.commissionStatus}`}>
                              {r.commissionStatus}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
