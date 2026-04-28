import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign, Users, ArrowUpRight, LineChart } from 'lucide-react';
import { StatCardMini } from './MarketingUtils';

export const CustomerInsights = () => {
    const ctx = useOutletContext() || {};

    return (
        <div className="insights-view">
            <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
                <StatCardMini title="Customer Retention" value="68%" icon={TrendingUp} />
                <StatCardMini title="Avg Spend / Order" value="SAR 450" icon={DollarSign} />
                <StatCardMini title="Returning Customers" value="842" icon={Users} />
                <StatCardMini title="New This Month" value="124" icon={ArrowUpRight} />
            </div>
            <div className="marketing-card" style={{ marginBottom: '32px' }}>
                <div className="marketing-card-header">
                    <h4 className="marketing-card-title">Customer Lifetime Value (LTV) Distribution</h4>
                </div>
                <div className="chart-placeholder">
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
                            <th className="table-th">Customer Name</th>
                            <th className="table-th">Total Visits</th>
                            <th className="table-th">Last Visit</th>
                            <th className="table-th">Total Spend</th>
                            <th className="table-th">Avg Order</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            { rank: 1, name: 'Aramco Logistics Fleet', visits: 124, last: 'Yesterday', spend: '142,500', avg: '1,149' },
                            { rank: 2, name: 'SABIC Industrial', visits: 85, last: '3 days ago', spend: '98,200', avg: '1,155' },
                            { rank: 3, name: 'Riyadh Taxi Fleet', visits: 42, last: 'Today', spend: '15,600', avg: '371' }
                        ].map((c, i) => (
                            <tr key={i} className="table-row">
                                <td className="table-cell" style={{ fontWeight: 900 }}>#{c.rank}</td>
                                <td className="table-cell">
                                    <div className="cell-main-text">{c.name}</div>
                                </td>
                                <td className="table-cell">{c.visits}</td>
                                <td className="table-cell">{c.last}</td>
                                <td className="table-cell font-bold">SAR {c.spend}</td>
                                <td className="table-cell">SAR {c.avg}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
};
