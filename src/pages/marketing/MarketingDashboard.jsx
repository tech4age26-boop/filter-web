import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Percent, Gift, Users, TrendingUp, LineChart } from 'lucide-react';
import { StatCardMini } from './MarketingUtils';
import { MarketingDashboardSkeleton } from './MarketingShimmer';
import { marketingGetDashboard } from '../../services/superAdminMarketingApi';

function formatSar(n, currency = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    if (v >= 1_000_000) return `${currency} ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${currency} ${Math.round(v / 1_000)}K`;
    return `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export const MarketingDashboard = () => {
    const ctx = useOutletContext() || {};
    const marketingWorkshopId = ctx.marketingWorkshopId ?? '';

    const [dash, setDash] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await marketingGetDashboard({
                ...(marketingWorkshopId ? { workshopId: marketingWorkshopId } : {}),
                activePromotionsLimit: 8,
            });
            setDash(res?.success === false ? null : res);
        } catch (e) {
            setDash(null);
            setError(e?.message || 'Failed to load marketing dashboard.');
        } finally {
            setLoading(false);
        }
    }, [marketingWorkshopId]);

    useEffect(() => {
        load();
    }, [load]);

    const cards = dash?.cards;
    const activeList = Array.isArray(dash?.activePromotions) ? dash.activePromotions : [];
    const growth = cards?.revenue?.growthPercent;
    const trend =
        growth != null && Number.isFinite(Number(growth))
            ? `${Number(growth) >= 0 ? '+' : ''}${Number(growth).toFixed(1)}%`
            : undefined;

    if (loading) {
        return (
            <div className="marketing-dashboard">
                {error ? (
                    <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 16 }}>{error}</p>
                ) : null}
                <MarketingDashboardSkeleton />
            </div>
        );
    }

    return (
        <div className="marketing-dashboard">
            {error ? (
                <p style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 16 }}>{error}</p>
            ) : null}
            <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
                <StatCardMini
                    title="Active Promotions"
                    value={cards?.promotions ?? 0}
                    icon={Percent}
                />
                <StatCardMini
                    title="Active Promo Codes (incl. table)"
                    value={cards?.promoCodes ?? 0}
                    icon={Gift}
                />
                <StatCardMini
                    title="Total Referrers"
                    value={cards?.referrers?.total ?? 0}
                    icon={Users}
                    trend={
                        cards?.referrers?.addedThisMonth != null
                            ? `+${cards.referrers.addedThisMonth}`
                            : undefined
                    }
                />
                <StatCardMini
                    title="Revenue (this month)"
                    value={formatSar(cards?.revenue?.currentMonth ?? 0, cards?.revenue?.currencyCode || 'SAR')}
                    icon={TrendingUp}
                    trend={trend}
                />
            </div>

            <div className="marketing-dashboard-grid">
                <div className="marketing-card">
                    <div className="marketing-card-header">
                        <h4 className="marketing-card-title">New Customers Growth</h4>
                    </div>
                    <div className="chart-placeholder">
                        <LineChart size={48} color="var(--color-primary)" style={{ opacity: 0.2, marginBottom: '12px' }} />
                        <div style={{ color: '#6B7280', fontSize: '13px' }}>Customer Acquisition Analytics</div>
                    </div>
                </div>
                <div className="marketing-card">
                    <div className="marketing-card-header">
                        <h4 className="marketing-card-title">Active promo codes (usage)</h4>
                        <button type="button" className="panel-link" onClick={load} disabled={loading}>
                            Refresh
                        </button>
                    </div>
                    <div className="active-promos-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {activeList.map((p) => {
                            const lim = p.redemptions?.limit == null ? '∞' : p.redemptions.limit;
                            const used = p.redemptions?.used ?? 0;
                            return (
                                <div
                                    key={p.id}
                                    className="recent-order-item"
                                    style={{ padding: '12px', border: '1px solid #F3F4F6', borderRadius: '12px' }}
                                >
                                    <div className="flex justify-between items-center" style={{ width: '100%' }}>
                                        <div>
                                            <div style={{ fontWeight: 800 }}>{p.title}</div>
                                            <div style={{ fontSize: '11px', color: '#6C757D' }}>{p.typeLabel}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, fontSize: '13px' }}>
                                                {used} / {lim}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#6C757D' }}>usage</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {activeList.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '13px' }}>
                                No active promo codes in range
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
