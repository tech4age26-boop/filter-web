import React, { useCallback, useMemo, useState } from 'react';
import {
  Users, Target, TrendingUp, DollarSign, Car, FileDown, Sheet, CalendarRange, Wallet, Clock,
} from 'lucide-react';
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
import { exportReferrerReportPdf, exportReferrerReportExcel } from './referrerReportExport';

const STATUS_COLOR = { paid: '#10b981', matured: '#3b82f6', pending: '#f59e0b' };
const STATUS_LABEL = { paid: 'Paid', matured: 'Available', pending: 'Pending' };

const iso = (d) => d.toISOString().slice(0, 10);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Presets covering what people actually ask for, plus a custom range. */
const PRESETS = [
  { id: 'all', label: 'All time', range: () => ({ from: '', to: '' }) },
  {
    id: '30d',
    label: 'Last 30 days',
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: iso(from), to: iso(to) };
    },
  },
  {
    id: 'month',
    label: 'This month',
    range: () => ({ from: iso(startOfMonth(new Date())), to: iso(new Date()) }),
  },
  {
    id: 'lastmonth',
    label: 'Last month',
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(first), to: iso(last) };
    },
  },
  {
    id: 'year',
    label: 'This year',
    range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: iso(new Date()) }),
  },
  { id: 'custom', label: 'Custom', range: null },
];

/**
 * Earnings per month across the selected window.
 *
 * Buckets come from the range itself rather than a fixed "last 6 months", so the
 * chart always describes the period actually asked for. Capped at 24 buckets,
 * beyond which monthly bars stop being readable.
 */
function buildMonthly(commissions, range) {
  const dates = commissions
    .map((c) => new Date(c.createdAt))
    .filter((d) => !Number.isNaN(d.getTime()));

  let start = range.from ? new Date(range.from) : null;
  let end = range.to ? new Date(range.to) : null;
  if (!start) start = dates.length ? new Date(Math.min(...dates)) : new Date();
  if (!end) end = dates.length ? new Date(Math.max(...dates)) : new Date();

  const months = [];
  const cursor = startOfMonth(start);
  const stop = startOfMonth(end);
  while (cursor <= stop && months.length < 24) {
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      name: cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      earnings: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (months.length === 0) {
    months.push({
      key: 'none',
      name: startOfMonth(end).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      earnings: 0,
    });
  }

  const index = new Map(months.map((m) => [m.key, m]));
  for (const c of commissions) {
    const d = new Date(c.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.earnings += Number(c.amount) || 0;
  }
  return months;
}

/** Breakdown by value, not count — what was earned matters more than how many rows. */
function buildBreakdown(commissions) {
  const totals = {};
  for (const c of commissions) {
    const s = String(c.status || 'unknown').toLowerCase();
    totals[s] = (totals[s] || 0) + (Number(c.amount) || 0);
  }
  return Object.entries(totals).map(([status, value]) => ({
    name: STATUS_LABEL[status] || status,
    value: Math.round(value * 100) / 100,
    color: STATUS_COLOR[status] || '#9ca3af',
  }));
}

export default function ReferrerReports() {
  const [preset, setPreset] = useState('all');
  const [range, setRange] = useState({ from: '', to: '' });
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [rangeError, setRangeError] = useState('');

  const meReq = useReferrerData(referrerGetMe, []);
  // Both re-query when the range changes, so the figures, the charts and anything
  // exported all describe the same server-side window.
  const commReq = useReferrerData(
    useCallback(() => referrerGetMyCommissions('all', range), [range]),
    [range],
  );
  const redReq = useReferrerData(
    useCallback(() => referrerGetMyRedemptions(range), [range]),
    [range],
  );

  const referrer = meReq.data?.referrer;
  const commissions = useMemo(() => commReq.data?.commissions ?? [], [commReq.data]);
  const redemptions = useMemo(() => redReq.data?.redemptions ?? [], [redReq.data]);

  const applyPreset = (id) => {
    setRangeError('');
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p?.range) {
      const r = p.range();
      setRange(r);
      setDraft(r);
    }
  };

  const applyCustom = () => {
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeError('The "from" date must be on or before the "to" date.');
      return;
    }
    setRangeError('');
    setRange({ from: draft.from, to: draft.to });
  };

  // Totals come from the rows in range, not the account-wide stats, so a filtered
  // report adds up to exactly what its own tables show.
  const summary = useMemo(() => {
    const byStatus = { paid: 0, matured: 0, pending: 0 };
    let total = 0;
    for (const c of commissions) {
      const amt = Number(c.amount) || 0;
      total += amt;
      const s = String(c.status).toLowerCase();
      if (byStatus[s] !== undefined) byStatus[s] += amt;
    }
    const round = (n) => Math.round(n * 100) / 100;
    return {
      totalEarned: round(total),
      paid: round(byStatus.paid),
      available: round(byStatus.matured),
      pending: round(byStatus.pending),
      commissionCount: commissions.length,
      redemptionCount: redemptions.length,
      uniquePlates: new Set(redemptions.map((r) => r.plate)).size,
      averageCommission: commissions.length ? round(total / commissions.length) : 0,
    };
  }, [commissions, redemptions]);

  const monthly = useMemo(() => buildMonthly(commissions, range), [commissions, range]);
  const breakdown = useMemo(() => buildBreakdown(commissions), [commissions]);

  const exportPayload = () => ({ referrer, range, summary, commissions, redemptions });

  const statCards = [
    { label: 'Total Earned', value: formatSar(summary.totalEarned), icon: TrendingUp, color: '#f59e0b' },
    { label: 'Paid', value: formatSar(summary.paid), icon: DollarSign, color: '#10b981' },
    { label: 'Available', value: formatSar(summary.available), icon: Wallet, color: '#3b82f6' },
    { label: 'Pending', value: formatSar(summary.pending), icon: Clock, color: '#eab308' },
    { label: 'Code Uses', value: String(summary.redemptionCount), icon: Target, color: '#0ea5e9' },
    { label: 'Vehicles Reached', value: String(summary.uniquePlates), icon: Car, color: '#8b5cf6' },
    { label: 'Commission Lines', value: String(summary.commissionCount), icon: Users, color: '#6366f1' },
    { label: 'Average Commission', value: formatSar(summary.averageCommission), icon: DollarSign, color: '#ec4899' },
  ];

  const loading = meReq.loading || commReq.loading || redReq.loading;
  const error = commReq.error || redReq.error;
  const showPlaceholder = meReq.loading || meReq.error || meReq.notLinked;

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Reports &amp; Analytics</h1>
          <p>Performance and commission data for a period you choose.</p>
        </div>
      </header>

      {showPlaceholder ? (
        <ReferrerState
          loading={meReq.loading}
          error={meReq.error}
          notLinked={meReq.notLinked}
          onRetry={meReq.reload}
          loadingLabel="Loading your reports…"
        />
      ) : (
        <>
          <div className="rf-card" style={{ marginBottom: '1.5rem', padding: '1.2rem 1.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <CalendarRange size={18} style={{ color: 'var(--color-primary)' }} />
              <strong style={{ fontSize: '0.95rem' }}>Reporting Period</strong>
              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                {range.from || range.to
                  ? `${range.from || 'start'} → ${range.to || 'today'}`
                  : 'All time'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: preset === 'custom' ? '1rem' : 0,
              }}
            >
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={preset === p.id ? 'rf-btn-primary' : 'rf-btn-outline'}
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="rf-form-group" style={{ margin: 0 }}>
                  <label className="rf-label">From</label>
                  <input
                    className="rf-input"
                    type="date"
                    value={draft.from}
                    onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  />
                </div>
                <div className="rf-form-group" style={{ margin: 0 }}>
                  <label className="rf-label">To</label>
                  <input
                    className="rf-input"
                    type="date"
                    value={draft.to}
                    onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  />
                </div>
                <button className="rf-btn-primary" onClick={applyCustom}>
                  Apply
                </button>
                {rangeError && (
                  <span style={{ color: '#dc2626', fontSize: '0.85rem' }}>{rangeError}</span>
                )}
              </div>
            )}
          </div>

          {/* Disabled while loading, so an export can never capture a half-loaded view. */}
          <div className="rf-actions-bar" style={{ marginBottom: '1.5rem' }}>
            <button
              className="rf-btn-primary"
              onClick={() => exportReferrerReportPdf(exportPayload())}
              disabled={loading}
            >
              <FileDown size={18} />
              Export PDF
            </button>
            <button
              className="rf-btn-outline"
              onClick={() => exportReferrerReportExcel(exportPayload())}
              disabled={loading}
            >
              <Sheet size={18} />
              Export Excel
            </button>
          </div>

          {error && (
            <div
              className="rf-card"
              style={{ padding: '0.9rem 1.2rem', marginBottom: '1.5rem', color: '#dc2626' }}
            >
              {error}
            </div>
          )}

          {!loading && commissions.length === 0 && (
            <div className="rf-card" style={{ marginBottom: '1.5rem', padding: '0.9rem 1.2rem' }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                No commissions in this period, so the figures below read zero. Widen the
                period, or wait for your code to be used.
              </p>
            </div>
          )}

          <div
            className="rf-stats-grid"
            style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '2.5rem' }}
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

          <div className="rf-split-grid">
            <div className="rf-card">
              <div className="rf-card-header">
                <h3 className="rf-card-title">Earnings by Month</h3>
              </div>
              <div className="rf-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
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
                <h3 className="rf-card-title">Earnings by Status</h3>
              </div>
              <div className="rf-chart-container">
                {breakdown.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.9rem',
                    }}
                  >
                    Nothing to break down in this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {breakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${formatSar(v)} SAR`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="rf-card" style={{ marginTop: '2rem' }}>
            <div className="rf-card-header">
              <h3 className="rf-card-title">Commission Detail</h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                {commissions.length} line{commissions.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="rf-table-container">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Amount (SAR)</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, fontStyle: 'italic' }}>
                        No commissions in this period.
                      </td>
                    </tr>
                  ) : (
                    commissions.map((c) => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--color-text-faint)' }}>{formatDate(c.createdAt)}</td>
                        <td style={{ fontWeight: 600 }}>{c.description || '—'}</td>
                        <td>
                          <span className={`rf-badge rf-badge-${String(c.status).toLowerCase()}`}>
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatSar(c.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rf-card" style={{ marginTop: '2rem' }}>
            <div className="rf-card-header">
              <h3 className="rf-card-title">Code Usage by Vehicle</h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                {summary.uniquePlates} vehicle{summary.uniquePlates === 1 ? '' : 's'}
              </span>
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
                  {redemptions.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, fontStyle: 'italic' }}>
                        Your code wasn’t used in this period.
                      </td>
                    </tr>
                  ) : (
                    redemptions.map((r) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
