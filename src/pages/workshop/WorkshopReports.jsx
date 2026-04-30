import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
    RefreshCw, ChevronRight
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer
} from 'recharts';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => `SAR ${toNumber(value).toLocaleString()}`;

function TechDropdown({ value, options, onChange }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="ws-custom-dropdown" ref={containerRef}>
            <button className="ws-dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
                {value}
                <ChevronRight size={14} className={isOpen ? 'rotate-90' : ''} style={{ transition: 'transform 0.2s', transform: `rotate(${isOpen ? '90deg' : '0deg'})` }} />
            </button>
            {isOpen && (
                <div className="ws-dropdown-menu">
                    {options.map((opt) => (
                        <div 
                            key={opt} 
                            className={`ws-dropdown-item ${value === opt ? 'active' : ''}`}
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                        >
                            {opt}
                            {value === opt && <span className="ws-check">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function WorkshopReports({ selectedBranchId = 'all', branches = [] }) {
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);
    const [dateFrom, setDateFrom] = useState('2026-03-01');
    const [dateTo, setDateTo] = useState('2026-03-27');
    const [activeTab, setActiveTab] = useState('daily_sales');
    const [techFilter, setTechFilter] = useState('All Technicians');
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    const loadReports = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await apiFetch(`/workshop-staff/reports-analytics${qs(branchScopeParams(selectedBranchId))}`);
            if (!response?.success) {
                throw new Error('Invalid reports response.');
            }
            setReportData(response);
        } catch (error) {
            setLoadError(error.message || 'Failed to load reports analytics.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const dailyRevenueData = useMemo(() => {
        return (reportData?.financialOverview?.dailyRevenue || []).map((entry) => ({
            day: entry.day,
            date: entry.date,
            amount: toNumber(entry.amount),
        }));
    }, [reportData]);

    const technicianData = useMemo(() => {
        return (reportData?.operationalPerformance || []).map((entry) => ({
            id: entry.employeeId,
            name: entry.name || 'Unknown',
            orders: toNumber(entry.totalJobs),
            commission: toNumber(entry.commission),
        }));
    }, [reportData]);

    const filteredTechnicians = useMemo(() => {
        if (techFilter === 'All Technicians') return technicianData;
        return technicianData.filter((entry) => entry.name === techFilter);
    }, [technicianData, techFilter]);

    const totalOrders = useMemo(() => {
        return technicianData.reduce((sum, entry) => sum + entry.orders, 0);
    }, [technicianData]);

    const kpis = [
        { label: 'Total Revenue', value: formatCurrency(reportData?.financialOverview?.totalRevenue), color: 'text-green' },
        { label: 'Revenue Change', value: `${toNumber(reportData?.financialOverview?.revenueChangePercent).toFixed(1)}%`, sub: 'vs previous period', color: 'text-blue' },
        { label: 'Stock Value (Cost)', value: formatCurrency(reportData?.inventoryValuation?.stockValueCost), color: 'text-orange' },
        { label: 'Potential Profit', value: formatCurrency(reportData?.inventoryValuation?.potentialProfit), sub: `${toNumber(reportData?.inventoryValuation?.activeSkus)} active SKUs`, color: 'text-purple' },
    ];

    const tabs = [
        { id: 'daily_sales', label: 'Daily Sales' },
        { id: 'by_technician', label: 'By Technician' },
        { id: 'by_customer', label: 'By Customer' },
        { id: 'by_product', label: 'By Product' },
        { id: 'by_department', label: 'By Department' },
        { id: 'by_branch', label: 'By Branch' },
    ];

    return (
        <div className="ws-reports-page">
            <div className="ws-reports-header">
                <div>
                    <h2 className="ws-page-title">Reports & Analytics</h2>
                    <p className="ws-page-sub">Scope · <strong>{branchLabel}</strong></p>
                </div>
                <div className="ws-online-badge">
                    <div className="ws-online-dot" /> Online
                </div>
            </div>

            {/* Filter Bar */}
            <div className="ws-reports-filters">
                <div className="ws-filter-group">
                    <div className="ws-date-input-group">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        <span className="ws-text-dim">to</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    {/* Custom Technician Dropdown */}
                    <TechDropdown 
                        value={techFilter} 
                        options={['All Technicians', ...technicianData.map(t => t.name)]} 
                        onChange={setTechFilter} 
                    />
                    <button className="ws-btn-refresh" onClick={loadReports} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <div className="ws-order-count">
                    <span>{totalOrders} completed orders</span>
                </div>
            </div>
            {loadError && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                </div>
            )}

            {/* KPI Grid */}
            <div className="ws-reports-kpi-grid">
                {kpis.map(k => (
                    <div key={k.label} className="ws-kpi-card">
                        <p className="ws-kpi-label">{k.label}</p>
                        <h3 className={`ws-kpi-value ${k.color}`}>{k.value}</h3>
                        {k.sub && <p className="ws-kpi-sub">{k.sub}</p>}
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="ws-reports-tabs">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        className={`ws-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="ws-tab-content">
                {activeTab === 'daily_sales' && (
                    <div className="ws-report-view">
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">Daily Revenue</h4>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={dailyRevenueData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="amount" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="ws-report-table-wrapper">
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>DAY</th>
                                        <th>DATE</th>
                                        <th>REVENUE (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dailyRevenueData.length === 0 ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No daily revenue data</td></tr>
                                    ) : dailyRevenueData.map((d, i) => (
                                        <tr key={i}>
                                            <td>{d.day}</td>
                                            <td>{d.date}</td>
                                            <td className="ws-font-bold">SAR {d.amount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_technician' && (
                    <div className="ws-report-view">
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">Revenue by Technician</h4>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={filteredTechnicians} layout="vertical" margin={{ left: 40, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={120} />
                                        <Tooltip cursor={{ fill: '#F9FAFB' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="orders" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="ws-report-table-wrapper">
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>TECHNICIAN</th>
                                        <th>TOTAL JOBS</th>
                                        <th>COMMISSION (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTechnicians.length === 0 ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No technician performance data</td></tr>
                                    ) : filteredTechnicians.map((t, i) => (
                                        <tr key={i}>
                                            <td><strong>{t.name}</strong></td>
                                            <td>{t.orders}</td>
                                            <td className="ws-font-bold">SAR {t.commission.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_customer' && (
                    <div className="ws-section">
                        <div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Customer-wise report is not available in current API response.</div>
                    </div>
                )}

                {activeTab === 'by_product' && (
                    <div className="ws-section"><div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Product-wise report is not available in current API response.</div></div>
                )}

                {activeTab === 'by_department' && (
                    <div className="ws-section"><div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Department-wise report is not available in current API response.</div></div>
                )}

                {activeTab === 'by_branch' && (
                    <div className="ws-section">
                        <div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Branch-wise report is not available in current API response.</div>
                    </div>
                )}
            </div>
        </div>
    );
}
