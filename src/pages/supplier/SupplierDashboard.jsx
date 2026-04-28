import React, { useState, useEffect } from 'react';
import { Package, FileText, BarChart3, DollarSign, Warehouse, AlertTriangle, Eye, ShoppingCart, ChevronRight } from 'lucide-react';
import {
    getSupplierDashboard,
    getSupplierPurchaseOrders,
    getSupplierReportsQuickSummary,
    listSupplierCashBankAccounts,
} from '../../services/supplierApi';

const ORDER_SUMMARY_STAGES = [
    { id: 'pending_acceptance', label: 'Pending Acceptance', c: 'ws-badge--yellow' },
    { id: 'accepted', label: 'Accepted', c: 'ws-badge--blue' },
    { id: 'processing', label: 'Processing', c: 'ws-badge--blue' },
    { id: 'ready_to_dispatch', label: 'Ready to Dispatch', c: 'ws-badge--purple' },
    { id: 'dispatched', label: 'Dispatched / On Way', c: 'ws-badge--yellow' },
    { id: 'delivered', label: 'Delivered', c: 'ws-badge--green' },
];

export default function SupplierDashboard({ onTabChange }) {
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [dashboardData, setDashboardData] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [cashTotal, setCashTotal] = useState(null);

    const formatCurrency = (amount, currency = 'SAR') =>
        `${currency} ${Number(amount || 0).toLocaleString()}`;

    const mapApiStatusToUiStatus = (status) => {
        if (!status) return 'pending';
        if (status === 'ready_to_deliver') return 'ready_to_dispatch';
        if (status === 'on_the_way') return 'dispatched';
        return status;
    };

    const dataReady = !loading && !apiError && dashboardData != null;
    const currency = dashboardData?.currency || dashboardData?.reports?.summary?.currencyCode || 'SAR';
    const pendingPOs = dataReady ? (dashboardData.pendingDeliveries ?? 0) : null;
    const totalAR = dataReady ? (dashboardData.receivables?.total ?? 0) : null;
    const totalAP = dataReady ? (dashboardData.reports?.summary?.totalPayables ?? 0) : null;
    const totalCash =
        dataReady && cashTotal != null ? cashTotal : dataReady ? 0 : null;

    const orderSummary = ORDER_SUMMARY_STAGES.map((s) => {
        if (!dataReady || !dashboardData?.orderStatusSummary) {
            return { ...s, count: loading ? '…' : apiError ? '—' : 0 };
        }
        const source = dashboardData.orderStatusSummary;
        const countMap = {
            pending_acceptance: source.pending ?? 0,
            accepted: source.accepted ?? 0,
            processing: source.processing ?? 0,
            ready_to_dispatch: source.readyToDeliver ?? 0,
            dispatched: source.onTheWay ?? 0,
            delivered: source.delivered ?? 0,
        };
        return { ...s, count: countMap[s.id] ?? 0 };
    });

    const criticalStock =
        dataReady && Array.isArray(dashboardData?.criticalStockAlerts?.alerts)
            ? dashboardData.criticalStockAlerts.alerts.map((alert) => ({
                  id: `${alert.supplierProductId}-${alert.supplierLocationId}`,
                  name: alert.productName,
                  qty: alert.current,
                  unit: alert.unit,
                  reorder: alert.critical,
              }))
            : [];

    const formatKpiValue = (val) => {
        if (loading) return '…';
        if (apiError) return '—';
        if (val == null) return '—';
        return typeof val === 'number' ? formatCurrency(val, currency) : String(val);
    };

    const kpis = [
        {
            label: 'New POs',
            value: loading ? '…' : apiError ? '—' : String(pendingPOs ?? 0),
            sub: 'In pipeline (non-delivered)',
            icon: Package,
            c: 'ws-kpi-icon--blue',
        },
        {
            label: 'Accounts Receivable',
            value: formatKpiValue(totalAR),
            sub: 'View AR',
            subAction: () => onTabChange('sales_invoices'),
            icon: FileText,
            c: 'ws-kpi-icon--yellow',
        },
        {
            label: 'Outstanding invoices (AP-style)',
            value: formatKpiValue(totalAP),
            sub: 'Open invoice balance',
            icon: BarChart3,
            c: 'ws-kpi-icon--purple',
        },
        {
            label: 'Cash & Bank',
            value: formatKpiValue(totalCash),
            sub: 'Ledger cash + bank',
            icon: DollarSign,
            c: 'ws-kpi-icon--green',
        },
    ];

    useEffect(() => {
        let cancelled = false;
        const loadDashboard = async () => {
            setLoading(true);
            setApiError('');
            try {
                const [dashboardRes, ordersRes, reportsRes, cashRes] = await Promise.all([
                    getSupplierDashboard(),
                    getSupplierPurchaseOrders({ limit: 5 }),
                    getSupplierReportsQuickSummary(),
                    listSupplierCashBankAccounts(),
                ]);
                if (cancelled) return;
                const accounts = Array.isArray(cashRes?.accounts) ? cashRes.accounts : [];
                const cashSum = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);
                setCashTotal(cashSum);
                setDashboardData({
                    ...dashboardRes,
                    reports: reportsRes,
                });
                setRecentOrders(Array.isArray(ordersRes?.purchaseOrders) ? ordersRes.purchaseOrders : []);
            } catch (err) {
                if (!cancelled) {
                    console.error('Supplier dashboard API failed:', err);
                    setApiError(err?.message || 'Failed to load dashboard from server.');
                    setDashboardData(null);
                    setRecentOrders([]);
                    setCashTotal(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadDashboard();
        return () => {
            cancelled = true;
        };
    }, []);
    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Supplier & Warehouse Dashboard</h2>
                    <p className="ws-page-sub">Overview of POs, AR, AP & cash</p>
                </div>
            </div>
            {apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 12,
                        fontSize: '0.8125rem',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                    }}
                >
                    <strong>Backend error:</strong> {apiError}
                </div>
            ) : null}
            <div className="ws-kpi-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', marginBottom:20}}>
                {kpis.map(k => (
                    <div key={k.label} className="ws-kpi-card">
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value">{k.value}</p>
                            {k.subAction ? (
                                <button type="button" onClick={k.subAction} style={{ fontSize: '0.75rem', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: 4 }}>{k.sub}</button>
                            ) : (
                                <p className="ws-kpi-sub">{k.sub}</p>
                            )}
                        </div>
                        <div className={`ws-kpi-icon ${k.c}`}><k.icon size={22}/></div>
                    </div>
                ))}
            </div>
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: '#FFFFFF',
                        border: '1px solid var(--color-border-light)',
                        overflowX: 'auto',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                    }}
                >
                    <p
                        style={{
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            color: 'var(--color-text-muted)',
                            margin: 0,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Order Status Summary
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {orderSummary.map((s) => (
                            <span
                                key={s.label}
                                className={`ws-badge ${s.c}`}
                                style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}
                            >
                                {s.label}: <strong>{s.count}</strong>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            {criticalStock.length > 0 && (
                <div
                    style={{
                        marginBottom: 20,
                        background: '#FEF2F2',
                        borderRadius: 12,
                        borderLeft: '4px solid #DC2626',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(220,38,38,0.12)' }}>
                        <AlertTriangle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#B91C1C', margin: 0 }}>
                            Critical Stock Alerts ({criticalStock.length})
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {criticalStock.slice(0, 5).map((p, i) => (
                            <div
                                key={p.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 16px',
                                    fontSize: '0.8125rem',
                                    borderBottom: i < Math.min(5, criticalStock.length) - 1 ? '1px solid rgba(220,38,38,0.1)' : 'none',
                                }}
                            >
                                <span style={{ color: '#B91C1C' }}>
                                    {p.name} below critical level ({p.qty} {p.unit} &lt; {p.reorder} {p.unit})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onTabChange('order_queue')}
                                    style={{
                                        padding: '6px 14px',
                                        background: '#DC2626',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        fontSize: '0.8125rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                    }}
                                >
                                    Quick Order
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 0, padding: 12, borderRadius: 16 }}>
                <p
                    style={{
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-muted)',
                        margin: '0 0 8px 4px',
                    }}
                >
                    Quick Actions
                </p>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                        gap: 8,
                    }}
                >
                    {[
                        { label: 'Order Queue', tab: 'order_queue', icon: Package },
                        { label: 'Stock Inventory', tab: 'stock', icon: Warehouse },
                        { label: 'Sales Invoices (AR)', tab: 'sales_invoices', icon: FileText },
                        { label: 'Purchase Invoices (AP)', tab: 'purchase_invoices', icon: ShoppingCart },
                        { label: 'Cash & Bank', tab: 'cash_bank', icon: DollarSign },
                        { label: 'Expenses', tab: 'expenses', icon: AlertTriangle },
                        { label: 'Staff & Roles', tab: 'employees', icon: Eye },
                        { label: 'Accounting', tab: 'accounting', icon: BarChart3 },
                    ].map((a) => (
                        <button
                            key={a.tab}
                            type="button"
                            onClick={() => onTabChange(a.tab)}
                            className="btn-portal-outline"
                            style={{
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                fontSize: '0.8125rem',
                                padding: '10px 18px',
                                height: 44,
                                borderRadius: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <a.icon size={18} />
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="ws-section" style={{marginTop:20}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--color-border-light)'}}>
                    <p style={{fontWeight:700,color:'var(--color-text-dark)',margin:0}}>Recent Orders</p>
                    <button
                        type="button"
                        onClick={() => onTabChange('order_queue')}
                        style={{fontSize:'0.75rem',color:'#2563EB',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}
                    >
                        View all <ChevronRight size={14}/>
                    </button>
                </div>
                <div>
                    {loading ? (
                        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', padding: 32, margin: 0 }}>
                            Loading recent orders…
                        </p>
                    ) : apiError ? (
                        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#B91C1C', padding: 32, margin: 0 }}>
                            Unable to load recent orders ({apiError})
                        </p>
                    ) : recentOrders.length === 0 ? (
                        <p style={{ textAlign:'center',fontSize:'0.875rem',color:'var(--color-text-muted)',padding:32,margin:0}}>
                            No purchase orders yet
                        </p>
                    ) : (
                        recentOrders.map((o, i) => (
                        <div
                            key={o.id}
                            style={{
                                display:'flex',
                                alignItems:'center',
                                justifyContent:'space-between',
                                padding:'12px 20px',
                                borderBottom: i < recentOrders.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                            }}
                        >
                            <div>
                                <p style={{fontWeight:600,fontSize:'0.875rem',margin:0}}>{o.id}</p>
                                <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'2px 0 0 0'}}>{o.branch?.name || o.branch || '-'}</p>
                            </div>
                            <div style={{textAlign:'right'}}>
                                <p style={{fontWeight:700,fontSize:'0.875rem',margin:0}}>
                                    {o.total || formatCurrency((o.items || []).reduce((sum, item) => sum + Number(item.lineTotal || 0), 0), currency)}
                                </p>
                                <span className={`ws-badge ${mapApiStatusToUiStatus(o.status)==='pending_acceptance'?'ws-badge--yellow':mapApiStatusToUiStatus(o.status)==='processing'?'ws-badge--blue':'ws-badge--green'}`}>
                                    {mapApiStatusToUiStatus(o.status)}
                                </span>
                            </div>
                        </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
