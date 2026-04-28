import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, ShoppingCart, AlertTriangle, ClipboardCheck, Users, Package, Wrench, TrendingUp, Building2, RefreshCw } from 'lucide-react';
import { MOCK_EMPLOYEES } from './constants';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function WorkshopDashboard({ onTabChange }) {
    const { workshop } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

    const loadDashboard = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await apiFetch('/workshop-staff/dashboard');
            if (response?.success) {
                setDashboardData(response);
                return;
            }
            throw new Error('Workshop dashboard response was invalid.');
        } catch (error) {
            setLoadError(error.message || 'Failed to load workshop dashboard.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const loadLowStockProducts = useCallback(async () => {
        const workshopId = workshop?.id;
        if (!workshopId) return;

        try {
            const response = await apiFetch(`/workshop-staff/products?workshopId=${encodeURIComponent(workshopId)}`);
            if (!(response?.success && Array.isArray(response.categories))) {
                return;
            }

            const normalizedProducts = [];
            response.categories.forEach((category) => {
                (category.productsWithoutSub || []).forEach((product) => {
                    normalizedProducts.push({
                        id: product.id,
                        name: product.name || 'Unnamed',
                        stock_qty: Number(product.openingQty) || 0,
                        critical_level: Number(product.criticalStockPoint) || 0,
                    });
                });
                (category.subCategories || []).forEach((subCategory) => {
                    (subCategory.products || []).forEach((product) => {
                        normalizedProducts.push({
                            id: product.id,
                            name: product.name || 'Unnamed',
                            stock_qty: Number(product.openingQty) || 0,
                            critical_level: Number(product.criticalStockPoint) || 0,
                        });
                    });
                });
            });

            setLowStockProducts(
                normalizedProducts.filter((product) => product.critical_level > 0 && product.stock_qty <= product.critical_level)
            );
        } catch {
            setLowStockProducts([]);
        }
    }, [workshop?.id]);

    useEffect(() => {
        loadLowStockProducts();
    }, [loadLowStockProducts]);

    const loadPendingApprovalsCount = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/petty-cash/requests?limit=1&offset=0&queue=pending');
            if (response?.success) {
                setPendingApprovalsCount(Number(response.total) || 0);
            }
        } catch {
            setPendingApprovalsCount(0);
        }
    }, []);

    useEffect(() => {
        loadPendingApprovalsCount();
    }, [loadPendingApprovalsCount]);

    useEffect(() => {
        const handleApprovalsUpdated = () => {
            loadPendingApprovalsCount();
        };

        window.addEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        return () => {
            window.removeEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        };
    }, [loadPendingApprovalsCount]);

    const toNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const todaySales = useMemo(() => toNumber(dashboardData?.totalSalesToday), [dashboardData]);
    const pendingInvoices = useMemo(() => toNumber(dashboardData?.pendingInvoicesCount), [dashboardData]);
    const lowStockAlertsCount = useMemo(() => toNumber(dashboardData?.lowStockAlertsCount), [dashboardData]);
    const dataScopeLabel = dashboardData?.dataScopeLabel || 'All Branches';
    const branchPerformance = dashboardData?.branchPerformance || [];

    const technicians = MOCK_EMPLOYEES.filter(e => e.role === 'technician');
    const kpis = [
        { label: 'Total Sales Today', value: `SAR ${todaySales.toLocaleString()}`, iconClass: 'ws-kpi-icon--green', Icon: DollarSign },
        { label: 'Pending Invoices', value: pendingInvoices, iconClass: 'ws-kpi-icon--orange', Icon: ShoppingCart },
        { label: 'Low Stock Alerts', value: lowStockAlertsCount, sub: dataScopeLabel, iconClass: 'ws-kpi-icon--red', Icon: AlertTriangle },
        { label: 'Pending Approvals', value: pendingApprovalsCount, iconClass: 'ws-kpi-icon--purple', Icon: ClipboardCheck },
    ];
    const quickActions = [
        { label: 'Employee Management', tab: 'employees', Icon: Users },
        { label: 'Dept & Products', tab: 'departments', Icon: Package },
        { label: 'Approvals Queue', tab: 'approvals', badge: pendingApprovalsCount, Icon: ClipboardCheck },
        { label: 'Suppliers & Purchases', tab: 'suppliers', Icon: Wrench },
        { label: 'Reports & Analytics', tab: 'reports', Icon: TrendingUp },
        { label: 'Manage Branches', tab: 'branches', Icon: Building2 },
    ];
    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Workshop Dashboard</h2><p className="ws-page-sub">Live operational overview — Filter Car Services</p></div>
                <button
                    className="btn-portal"
                    onClick={() => {
                        loadDashboard();
                        loadLowStockProducts();
                        loadPendingApprovalsCount();
                    }}
                    disabled={isLoading}
                >
                    <RefreshCw size={15}/> {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            {loadError && (
                <div className="ws-section" style={{ marginBottom: 16, padding: 12, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                </div>
            )}
            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                {kpis.map(k => (
                    <div key={k.label} className="ws-kpi-card">
                        <div><p className="ws-kpi-label">{k.label}</p><p className="ws-kpi-value">{k.value}</p>{k.sub && <p className="ws-kpi-sub">{k.sub}</p>}</div>
                        <div className={`ws-kpi-icon ${k.iconClass}`}><k.Icon size={22}/></div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><p style={{ fontWeight: 700, margin: 0 }}>Active Technicians</p><span className="ws-badge ws-badge--blue">{technicians.length} total</span></div>
                    {technicians.length === 0 ? <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No technicians found</p> : (
                        <div style={{ padding: '0 16px 16px' }}>{technicians.slice(0, 4).map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{t.name?.[0] || 'T'}</div><div><p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{t.name}</p><p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{(t.workshop_duty ? 'Workshop' : '') + (t.oncall_available ? ' + On-Call' : '') || 'Workshop'}</p></div></div>
                                <span className="ws-badge ws-badge--green">Active</span>
                            </div>
                        ))}</div>
                    )}
                </div>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><p style={{ fontWeight: 700, margin: 0 }}>Low Stock Products</p><span className="ws-badge ws-badge--red">{lowStockProducts.length} alerts</span></div>
                    {lowStockProducts.length === 0 ? <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>All stock levels are healthy</p> : (
                        <div style={{ padding: '0 16px 16px' }}>{lowStockProducts.slice(0, 4).map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}>{p.name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.stock_qty} / {p.critical_level}</span><span className="ws-badge ws-badge--red">Low</span></div>
                            </div>
                        ))}</div>
                    )}
                </div>
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ fontWeight: 700, margin: 0 }}>All Branches</p>
                        <span className="ws-badge ws-badge--blue">{branchPerformance.length} branches</span>
                    </div>
                    {branchPerformance.length === 0 ? (
                        <p style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No branch performance available</p>
                    ) : (
                        <div style={{ padding: '0 16px 16px' }}>
                            {branchPerformance.slice(0, 5).map((branch) => (
                                <div key={branch.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{branch.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{branch.address || 'No address available'}</p>
                                    </div>
                                    <span className="ws-badge ws-badge--green">SAR {toNumber(branch.monthlySales).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="ws-section">
                <p style={{ padding: '16px 16px 12px', fontWeight: 700, margin: 0 }}>Quick Actions</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, padding: 16 }}>
                    {quickActions.map(a => (
                        <div key={a.tab} className="ws-quick-card" onClick={() => onTabChange(a.tab)} style={{ position: 'relative' }}>
                            {a.badge > 0 && <span style={{ position: 'absolute', top: 8, right: 8, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.badge}</span>}
                            <div className="ws-quick-icon"><a.Icon size={22}/></div>
                            <p className="ws-quick-label">{a.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
