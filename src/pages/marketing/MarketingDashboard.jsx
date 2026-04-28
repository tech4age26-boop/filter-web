import { useOutletContext } from 'react-router-dom';
import { Percent, Gift, Users, TrendingUp, LineChart } from 'lucide-react';
import { StatCardMini } from './MarketingUtils';

export const MarketingDashboard = ({
    promotions: propsPromotions,
    promoCodes: propsPromoCodes,
    referrers: propsReferrers
}) => {
    const ctx = useOutletContext() || {};
    const promotions = propsPromotions || ctx.promotions || [];
    const promoCodes = propsPromoCodes || ctx.promoCodes || [];
    const referrers = propsReferrers || ctx.referrers || [];

    return (
        <div className="marketing-dashboard">
            <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
                <StatCardMini title="Active Promotions" value={promotions.filter(p => p.status === 'Active').length} icon={Percent} />
                <StatCardMini title="Active Promo Codes" value={promoCodes.filter(c => c.status === 'Active').length} icon={Gift} />
                <StatCardMini title="Total Referrers" value={referrers.length} icon={Users} trend={referrers.length > 0 ? `+${referrers.length}` : '0'} />
                <StatCardMini title="Total Revenue" value="SAR 125K" icon={TrendingUp} trend="+8.4%" />
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
                        <h4 className="marketing-card-title">Active Promotions List</h4>
                        <button className="panel-link">View All</button>
                    </div>
                    <div className="active-promos-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {promotions.slice(0, 3).map(p => (
                            <div key={p.id} className="recent-order-item" style={{ padding: '12px', border: '1px solid #F3F4F6', borderRadius: '12px' }}>
                                <div className="flex justify-between items-center" style={{ width: '100%' }}>
                                    <div>
                                        <div style={{ fontWeight: 800 }}>{p.name}</div>
                                        <div style={{ fontSize: '11px', color: '#6C757D' }}>{p.strategy}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{p.usage}</div>
                                        <div style={{ fontSize: '10px', color: '#6C757D' }}>redemptions</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {promotions.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontSize: '13px' }}>
                                No active promotions found
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
