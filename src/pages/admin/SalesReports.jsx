import React, { useState } from 'react';
import { 
    DollarSign, BarChart3, Calendar, Users, 
    Package, ShoppingCart, RefreshCw, ChevronRight, 
    Search, TrendingUp, UserCheck, BarChart2
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
    Legend
} from 'recharts';
import '../../styles/admin/SalesReports.css';

const DAILY_SALES_DATA = [
    { name: '10 Mar', invoices: 1, revenue: 212 },
    { name: '11 Mar', invoices: 0, revenue: 0 },
    { name: '12 Mar', invoices: 1, revenue: 92 },
    { name: '13 Mar', invoices: 0, revenue: 0 },
    { name: '14 Mar', invoices: 0, revenue: 0 },
    { name: '15 Mar', invoices: 1, revenue: 239 },
    { name: '16 Mar', invoices: 0, revenue: 0 },
    { name: '17 Mar', invoices: 0, revenue: 0 },
    { name: '18 Mar', invoices: 1, revenue: 79 },
    { name: '19 Mar', invoices: 0, revenue: 0 },
    { name: '25 Mar', invoices: 1, revenue: 78 },
];

const TECHNICIAN_DATA = [
    { name: 'Rayan Faisal Al-Harbi', orders: 1, revenue: 239, avg: 239 },
    { name: 'Saleh Nasser Al-Ghamdi', orders: 1, revenue: 212, avg: 212 },
    { name: 'Omar Khalid Al-Rashidi', orders: 1, revenue: 92, avg: 92 },
    { name: 'Youssef Ahmed Al-Dosari', orders: 1, revenue: 79, avg: 79 },
    { name: 'Shahid', orders: 1, revenue: 78, avg: 78 },
];

const CUSTOMER_DATA = [
    { name: 'Sara Al-Otaibi', visits: 1, revenue: 239 },
    { name: 'Fahad Al-Rashid', visits: 1, revenue: 212 },
    { name: 'Saudi Telecom Company', visits: 1, revenue: 92 },
    { name: 'Mansour Al-Dossari', visits: 1, revenue: 79 },
    { name: 'Safa Makkah', visits: 1, revenue: 78 },
];

const PRODUCT_DATA = [
    { name: 'Full Engine Oil Change — Castrol GTX', qty: 1, revenue: 149, color: '#3B82F6' },
    { name: 'Wheel Alignment — 4 Wheels', qty: 1, revenue: 129, color: '#F59E0B' },
    { name: 'Engine Diagnostic Scan', qty: 1, revenue: 80, color: '#10B981' },
    { name: 'Tire Rotation — 4 Tires', qty: 1, revenue: 79, color: '#EF4444' },
    { name: 'Premium Car Wash & Wax', qty: 1, revenue: 69, color: '#8B5CF6' },
    { name: 'Castrol 10W30', qty: 4, revenue: 68, color: '#EC4899' },
    { name: 'Oil Filter — Universal', qty: 1, revenue: 35, color: '#06B6D4' },
];

const DEPARTMENT_DATA = [
    { name: 'Tire & Wheel Center', orders: 1, revenue: 239, color: '#F59E0B', percent: 34 },
    { name: 'Lube & Quick Service', orders: 1, revenue: 212, color: '#3B82F6', percent: 30 },
    { name: 'Workshop & Mechanical', orders: 1, revenue: 92, color: '#10B981', percent: 13 },
    { name: 'Oil Change', orders: 1, revenue: 78, color: '#8B5CF6', percent: 11 },
    { name: 'Car Wash & Detailing', orders: 1, revenue: 79, color: '#EF4444', percent: 11 },
];

export default function SalesReports() {
    const [dateFrom, setDateFrom] = useState('2026-03-01');
    const [dateTo, setDateTo] = useState('2026-03-27');
    const [activeTab, setActiveTab] = useState('daily_sales');

    const kpis = [
        { label: 'Total Revenue', value: 'SAR 700', icon: TrendingUp, iconClass: 'bg-orange' },
        { label: 'Total Orders', value: '5', sub: 'completed', icon: ShoppingCart, iconClass: 'bg-blue' },
        { label: 'Avg Ticket Size', value: 'SAR 140', icon: TrendingUp, iconClass: 'bg-green' },
        { label: 'Repeat Customers', value: '0', sub: 'visited more than once', icon: Users, iconClass: 'bg-purple' },
    ];

    const tabs = [
        { id: 'daily_sales', label: 'Daily Sales' },
        { id: 'by_technician', label: 'By Technician' },
        { id: 'by_customer', label: 'By Customer' },
        { id: 'by_product', label: 'By Product' },
        { id: 'by_department', label: 'By Department' },
    ];

    return (
        <div className="sales-reports-page">
            <div className="sales-reports-header">
                <div>
                    <h2 className="sales-page-title"><BarChart2 /> Sales Reports</h2>
                    <p className="sales-page-sub">Comprehensive sales analytics and performance metrics</p>
                </div>
                <div className="sales-completed-badge">
                    5 completed orders in range
                </div>
            </div>

            {/* Filter Bar */}
            <div className="sales-reports-filters">
                <div className="sales-filter-group">
                    <div className="sales-filter-label"><RefreshCw size={16} /> Filters:</div>
                    <div className="sales-date-input-group">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        <span className="sales-text-dim">to</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>
                    <select className="sales-branch-select">
                        <option>All Branches</option>
                    </select>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="sales-kpi-grid">
                {kpis.map(k => (
                    <div key={k.label} className="sales-kpi-card">
                        <p className="sales-kpi-label">{k.label}</p>
                        <h3 className="sales-kpi-value">{k.value}</h3>
                        {k.sub && <p className="sales-kpi-sub">{k.sub}</p>}
                        <div className={`sales-kpi-icon ${k.iconClass}`}>
                            <k.icon size={18} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="sales-tabs">
                {tabs.map(tab => (
                    <button 
                        key={tab.id} 
                        className={`sales-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="sales-tab-content">
                {activeTab === 'daily_sales' && (
                    <div className="sales-report-view">
                        <div className="sales-chart-section">
                            <h4 className="sales-chart-title">Daily Revenue Trend</h4>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={DAILY_SALES_DATA}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#718096' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#718096' }} />
                                        <Tooltip cursor={{ fill: '#F7FAFC' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                        <Bar dataKey="revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="sales-table-wrapper">
                            <table className="sales-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Invoices</th>
                                        <th>Revenue (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DAILY_SALES_DATA.filter(d => d.revenue > 0).map((d, i) => (
                                        <tr key={i}>
                                            <td>{d.name}</td>
                                            <td>{d.invoices}</td>
                                            <td className="sales-text-amber">SAR {d.revenue}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_technician' && (
                    <div className="sales-report-view">
                        <div className="sales-chart-section">
                            <h4 className="sales-chart-title">Revenue by Technician</h4>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={TECHNICIAN_DATA} layout="vertical" margin={{ left: 40, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EDF2F7" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#718096' }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#718096' }} width={120} />
                                        <Tooltip cursor={{ fill: '#F7FAFC' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                        <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="sales-table-wrapper">
                            <table className="sales-table">
                                <thead>
                                    <tr>
                                        <th>Technician</th>
                                        <th>Orders</th>
                                        <th>Revenue (SAR)</th>
                                        <th>Avg / Order</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {TECHNICIAN_DATA.map((t, i) => (
                                        <tr key={i}>
                                            <td><strong>{t.name}</strong></td>
                                            <td>{t.orders}</td>
                                            <td className="sales-text-amber">SAR {t.revenue}</td>
                                            <td>SAR {t.avg}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_customer' && (
                    <div className="sales-report-view">
                        <div className="sales-chart-section">
                            <h4 className="sales-chart-title">Top Customers by Revenue</h4>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={CUSTOMER_DATA}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#718096' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#718096' }} />
                                        <Tooltip cursor={{ fill: '#F7FAFC' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                        <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} barSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="sales-table-wrapper">
                            <table className="sales-table">
                                <thead>
                                    <tr>
                                        <th>Customer</th>
                                        <th>Visits</th>
                                        <th>Total Revenue (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {CUSTOMER_DATA.map((c, i) => (
                                        <tr key={i}>
                                            <td><strong>{c.name}</strong></td>
                                            <td>{c.visits}</td>
                                            <td className="sales-text-amber">SAR {c.revenue}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_product' && (
                    <div className="sales-report-view">
                        <div className="sales-chart-section">
                            <h4 className="sales-chart-title">Product / Service Performance</h4>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={PRODUCT_DATA}
                                            innerRadius={60}
                                            outerRadius={100}
                                            dataKey="revenue"
                                            label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {PRODUCT_DATA.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="sales-table-wrapper">
                            <table className="sales-table">
                                <thead>
                                    <tr>
                                        <th>Product / Service</th>
                                        <th>Qty Sold</th>
                                        <th>Revenue (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PRODUCT_DATA.map((p, i) => (
                                        <tr key={i}>
                                            <td className="sales-text-dim">{p.name}</td>
                                            <td>{p.qty}</td>
                                            <td className="sales-text-amber">SAR {p.revenue}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_department' && (
                    <div className="sales-report-view">
                        <div className="sales-chart-section">
                            <h4 className="sales-chart-title">Revenue by Department</h4>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={DEPARTMENT_DATA}
                                            innerRadius={0}
                                            outerRadius={100}
                                            dataKey="revenue"
                                            label={({ name, percent }) => `${name} ${percent}%`}
                                        >
                                            {DEPARTMENT_DATA.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="sales-table-wrapper">
                            <table className="sales-table">
                                <thead>
                                    <tr>
                                        <th>Department</th>
                                        <th>Orders</th>
                                        <th>Revenue (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DEPARTMENT_DATA.map((d, i) => (
                                        <tr key={i}>
                                            <td>{d.name}</td>
                                            <td>{d.orders}</td>
                                            <td className="sales-text-amber">SAR {d.revenue}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
