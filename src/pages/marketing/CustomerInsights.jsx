import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign, Users, ArrowUpRight, LineChart } from 'lucide-react';
import { StatCardMini } from './MarketingUtils';
import { MarketingCustomerInsightsSkeleton } from './MarketingShimmer';
import { marketingGetCustomerInsights } from '../../services/superAdminMarketingApi';

function formatSar(n, currency = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export const CustomerInsights = () => {
    const ctx = useOutletContext() || {};
    const marketingWorkshopId = ctx.marketingWorkshopId ?? '';

    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await marketingGetCustomerInsights({
                ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
                topLimit: 15,
            });
            setData(res?.summary ? res : null);
        } catch (e) {
            setData(null);
            setError(e?.message || 'Failed to load customer insights.');
        } finally {
            setLoading(false);
        }
    }, [marketingWorkshopId]);

    useEffect(() => {
        load();
    }, [load]);

    const s = data?.summary;
    const cur = s?.currencyCode || 'SAR';
    const top = Array.isArray(data?.topReturningCustomers) ? data.topReturningCustomers : [];
    const ltv = data?.ltvDistribution;

    if (loading) {
        return (
            <div className="insights-view">
                {error ? <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 16 }}>{error}</p> : null}
                <MarketingCustomerInsightsSkeleton />
            </div>
        );
    }

    return (
        <div className="insights-view">
            {error ? <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 16 }}>{error}</p> : null}
            <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
                <StatCardMini
                    title="Customer Retention"
                    value={`${s?.customerRetention ?? 0}%`}
                    icon={TrendingUp}
                />
                <StatCardMini
                    title="Avg Spend / Order"
                    value={formatSar(s?.avgSpendPerOrder, cur)}
                    icon={DollarSign}
                />
                <StatCardMini
                    title="Returning Customers"
                    value={s?.returningCustomers ?? 0}
                    icon={Users}
                />
                <StatCardMini
                    title="New This Month"
                    value={s?.newThisMonth ?? 0}
                    icon={ArrowUpRight}
                />
            </div>
            <div className="marketing-card" style={{ marginBottom: '32px' }}>
                <div className="marketing-card-header">
                    <h4 className="marketing-card-title">Customer Lifetime Value (LTV) Distribution</h4>
                </div>
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>High</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{ltv?.highValue ?? '—'}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ltv?.legend?.highValue}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Mid</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{ltv?.midValue ?? '—'}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ltv?.legend?.midValue}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Low</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{ltv?.lowValue ?? '—'}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{ltv?.legend?.lowValue}</div>
                    </div>
                </div>
                <div className="chart-placeholder" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <LineChart size={48} color="var(--color-primary)" style={{ opacity: 0.2, marginBottom: '12px' }} />
                    <div style={{ color: '#6B7280', fontSize: '13px' }}>Customer LTV Segment Analysis</div>
                </div>
            </div>
            <section className="premium-table">
                <h4 style={{ marginBottom: '16px', fontWeight: 800 }}>Top Returning Customers</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Rank</th>
                            <th className="table-th">Customer</th>
                            <th className="table-th">Visits</th>
                            <th className="table-th">Last visit</th>
                            <th className="table-th">Total spend</th>
                            <th className="table-th">Avg order</th>
                        </tr>
                    </thead>
                    <tbody>
                        {top.map((c) => (
                            <tr key={c.customerId} className="table-row">
                                <td className="table-cell" style={{ fontWeight: 900 }}>#{c.rank}</td>
                                <td className="table-cell">
                                    <div className="cell-main-text">{c.customerName || '—'}</div>
                                </td>
                                <td className="table-cell">{c.visits ?? '—'}</td>
                                <td className="table-cell">{c.lastVisit || '—'}</td>
                                <td className="table-cell font-bold">{formatSar(c.spend, cur)}</td>
                                <td className="table-cell">{formatSar(c.avg, cur)}</td>
                            </tr>
                        ))}
                        {top.length === 0 && (
                            <tr>
                                <td colSpan={6} className="table-cell" style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                                    No rows returned
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
};
