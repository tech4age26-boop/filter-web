import React, { useState, useEffect } from 'react';
import {
    Package,
    FileText,
    BarChart3,
    DollarSign,
    Warehouse,
    AlertTriangle,
    Eye,
    ShoppingCart,
    ChevronRight,
    Users,
    LayoutGrid,
    MapPin,
    ClipboardList,
} from 'lucide-react';
import {
    getSupplierDashboard,
    getSupplierReportsQuickSummary,
    listSupplierCashBankAccounts,
    listSupplierWorkshopPurchaseInvoices,
} from '../../services/supplierApi';
import {
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import { ShimmerKpiGrid, ShimmerOrderStatusBar, ShimmerListRows } from '../../components/supplier/Shimmer';

const ORDER_SUMMARY_STAGES = [
    { id: 'pending_acceptance', label: 'Pending Acceptance', c: 'ws-badge--yellow' },
    { id: 'accepted', label: 'Accepted', c: 'ws-badge--blue' },
    { id: 'processing', label: 'Processing', c: 'ws-badge--blue' },
    { id: 'ready_to_dispatch', label: 'Ready to Dispatch', c: 'ws-badge--purple' },
    { id: 'dispatched', label: 'Dispatched / On Way', c: 'ws-badge--yellow' },
    { id: 'delivered', label: 'Delivered', c: 'ws-badge--green' },
];

/** Workshop PI `status` → same pipeline bucket as branch POs (Order Queue). */
function wpiStatusToPipelineId(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'pending') return 'pending_acceptance';
    if (s === 'approved') return 'accepted';
    if (s === 'processing') return 'processing';
    if (s === 'ready_to_dispatch') return 'ready_to_dispatch';
    if (s === 'on_the_way') return 'dispatched';
    if (s === 'delivered') return 'delivered';
    return null;
}

function workshopInvoiceStatusBadge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'ws-badge--green';
    if (s === 'rejected') return 'ws-badge--red';
    return 'ws-badge--yellow';
}

export default function SupplierDashboard({ onTabChange }) {
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const [dashboardData, setDashboardData] = useState(null);
    const [recentWorkshopInvoices, setRecentWorkshopInvoices] = useState([]);
    /** Server `total` from WPI list — used when dashboard JSON omits WPI counts (older APIs). */
    const [supplierWpiListTotal, setSupplierWpiListTotal] = useState(null);
    /** Normalized WPI rows for pipeline counts (up to API limit). */
    const [wpiRowsForPipeline, setWpiRowsForPipeline] = useState([]);
    const [cashTotal, setCashTotal] = useState(null);
    const [reportsPartialError, setReportsPartialError] = useState('');

    const formatCurrency = (amount, currency = 'SAR') =>
        `${currency} ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    const dataReady = !loading && !apiError && dashboardData != null;
    const currency =
        dashboardData?.currency ||
        dashboardData?.reports?.summary?.currencyCode ||
        'SAR';

    /** POs (Order Queue) + workshop purchase invoices (Finance → Workshop purchases). */
    const totalOrdersCount = dataReady
        ? (() => {
              const po = Number(dashboardData.totalPurchaseOrders ?? 0);
              const wpi = Number(dashboardData.totalWorkshopPurchaseInvoices ?? 0);
              const combined = po + wpi;
              const inboundRaw = dashboardData.totalInboundOrderDocuments;
              const inbound =
                  inboundRaw != null && inboundRaw !== ''
                      ? Number(inboundRaw)
                      : null;
              const fromReports = Number(dashboardData.reports?.summary?.totalOrders ?? 0);
              let fromDashboard = Number.isFinite(combined) ? combined : 0;
              if (inbound != null && Number.isFinite(inbound)) {
                  fromDashboard = Math.max(fromDashboard, inbound);
              }
              if (fromDashboard === 0 && Number.isFinite(fromReports) && fromReports > 0) {
                  fromDashboard = fromReports;
              }
              if (supplierWpiListTotal != null && Number.isFinite(supplierWpiListTotal)) {
                  return Math.max(fromDashboard, supplierWpiListTotal);
              }
              return fromDashboard;
          })()
        : null;

    const totalAR = dataReady ? Number(dashboardData.receivables?.total ?? 0) : null;
    const totalAP = dataReady
        ? dashboardData.reports?.summary?.totalPayables != null
            ? Number(dashboardData.reports.summary.totalPayables)
            : null
        : null;

    const totalCash =
        dataReady && cashTotal != null ? Number(cashTotal) : dataReady ? 0 : null;

    const orderSummary = ORDER_SUMMARY_STAGES.map((s) => {
        if (loading && !apiError) {
            return { ...s, count: '…' };
        }
        if (apiError) {
            return { ...s, count: '—' };
        }
        const source = dashboardData?.orderStatusSummary;
        const countMap = source
            ? {
                  pending_acceptance: Number(source.pending ?? 0),
                  accepted: Number(source.accepted ?? 0),
                  processing: Number(source.processing ?? 0),
                  ready_to_dispatch: Number(source.readyToDeliver ?? 0),
                  dispatched: Number(source.onTheWay ?? 0),
                  delivered: Number(source.delivered ?? 0),
              }
            : {
                  pending_acceptance: 0,
                  accepted: 0,
                  processing: 0,
                  ready_to_dispatch: 0,
                  dispatched: 0,
                  delivered: 0,
              };
        const po = countMap[s.id] ?? 0;
        const wpi = Array.isArray(wpiRowsForPipeline)
            ? wpiRowsForPipeline.filter((r) => wpiStatusToPipelineId(r?.status) === s.id).length
            : 0;
        return { ...s, count: po + wpi };
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

    const formatCount = (n) => {
        if (loading) return '…';
        if (apiError) return '—';
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return String(Number(n));
    };

    const totalProducts = dataReady ? Number(dashboardData.totalSupplierProducts ?? 0) : null;
    const totalStaff = dataReady ? Number(dashboardData.totalSupplierStaff ?? 0) : null;
    const totalLocations = dataReady ? Number(dashboardData.totalSupplierLocations ?? 0) : null;
    const openInvoicesCount = dataReady ? Number(dashboardData.openSalesInvoicesCount ?? 0) : null;
    const stockMatrixRows = dataReady ? Number(dashboardData.totalSupplierStockRows ?? 0) : null;
    const criticalAlertCount = dataReady ? Number(dashboardData.criticalStockAlerts?.count ?? 0) : null;

    const kpis = [
        {
            key: 'wpi',
            label: 'Total workshop purchases',
            value: loading ? '…' : apiError ? '—' : String(totalOrdersCount ?? 0),
            sub: 'POs + workshop purchase invoices',
            subAction: () => onTabChange('order_queue'),
            icon: Package,
            c: 'ws-kpi-icon--blue',
        },
        {
            key: 'ar',
            label: 'Accounts receivable',
            value: formatKpiValue(totalAR),
            sub: 'Unpaid sales invoices',
            subAction: () => onTabChange('sales_invoices'),
            icon: FileText,
            c: 'ws-kpi-icon--yellow',
        },
        {
            key: 'ap',
            label: 'Outstanding invoices',
            value: formatKpiValue(totalAP),
            sub: 'Open balance owed to you',
            subAction: () => onTabChange('sales_invoices'),
            icon: BarChart3,
            c: 'ws-kpi-icon--purple',
        },
        {
            key: 'cash',
            label: 'Cash & Bank',
            value: formatKpiValue(totalCash),
            sub: 'Ledger cash + bank',
            subAction: () => onTabChange('cash_bank'),
            icon: DollarSign,
            c: 'ws-kpi-icon--green',
        },
        {
            key: 'catalog',
            label: 'Product catalog',
            value: formatCount(totalProducts),
            sub: 'Your supplier products',
            subAction: () => onTabChange('catalog'),
            icon: LayoutGrid,
            c: 'ws-kpi-icon--blue',
        },
        {
            key: 'staff',
            label: 'Staff',
            value: formatCount(totalStaff),
            sub: 'Staff & roles (linked workshop)',
            subAction: () => onTabChange('employees'),
            icon: Users,
            c: 'ws-kpi-icon--purple',
        },
        {
            key: 'locations',
            label: 'Warehouse locations',
            value: formatCount(totalLocations),
            sub: 'Stock inventory locations',
            subAction: () => onTabChange('stock'),
            icon: MapPin,
            c: 'ws-kpi-icon--yellow',
        },
        {
            key: 'stockrows',
            label: 'Stock lines',
            value: formatCount(stockMatrixRows),
            sub: 'Product × location rows',
            subAction: () => onTabChange('stock'),
            icon: Warehouse,
            c: 'ws-kpi-icon--green',
        },
        {
            key: 'openinv',
            label: 'Open sales invoices',
            value: formatCount(openInvoicesCount),
            sub: 'Count of unpaid / partial AR',
            subAction: () => onTabChange('sales_invoices'),
            icon: ClipboardList,
            c: 'ws-kpi-icon--blue',
        },
        {
            key: 'crit',
            label: 'Critical stock alerts',
            value: formatCount(criticalAlertCount),
            sub: 'Workshop alerts — low stock',
            subAction: () => onTabChange('stock_alerts'),
            icon: AlertTriangle,
            c: 'ws-kpi-icon--purple',
        },
    ];

    useEffect(() => {
        let cancelled = false;
        const loadDashboard = async () => {
            setLoading(true);
            setApiError('');
            setReportsPartialError('');
            try {
                const [dashResult, wpiResult, reportsResult, cashResult] = await Promise.allSettled([
                    getSupplierDashboard(),
                    listSupplierWorkshopPurchaseInvoices({ limit: 500, offset: 0 }),
                    getSupplierReportsQuickSummary(),
                    listSupplierCashBankAccounts(),
                ]);

                if (cancelled) return;

                if (dashResult.status === 'rejected') {
                    console.error('Supplier dashboard API failed:', dashResult.reason);
                    setApiError(dashResult.reason?.message || 'Failed to load dashboard.');
                    setDashboardData(null);
                    setRecentWorkshopInvoices([]);
                    setWpiRowsForPipeline([]);
                    setSupplierWpiListTotal(null);
                    setCashTotal(null);
                    return;
                }

                const dashboardRes = dashResult.value;
                const wpiRes = wpiResult.status === 'fulfilled' ? wpiResult.value : null;
                const reportsRes = reportsResult.status === 'fulfilled' ? reportsResult.value : null;
                const cashRes = cashResult.status === 'fulfilled' ? cashResult.value : null;

                if (reportsResult.status === 'rejected') {
                    setReportsPartialError(
                        reportsResult.reason?.message || 'Reports summary unavailable.',
                    );
                }

                const accounts = Array.isArray(cashRes?.accounts) ? cashRes.accounts : [];
                const cashSum = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);

                setCashTotal(Number.isFinite(cashSum) ? cashSum : 0);
                setDashboardData({
                    ...dashboardRes,
                    reports: reportsRes,
                });
                const wpiList = unwrapWorkshopSupplierPurchaseInvoiceList(wpiRes ?? {});
                const wpiNorm = wpiList.map(normalizeWorkshopSupplierPurchaseInvoiceRow).filter(Boolean);
                setWpiRowsForPipeline(wpiNorm);
                setRecentWorkshopInvoices(wpiNorm.slice(0, 10));
                if (wpiRes && typeof wpiRes === 'object' && wpiRes.total != null) {
                    setSupplierWpiListTotal(Number(wpiRes.total));
                } else {
                    setSupplierWpiListTotal(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Supplier dashboard load failed:', err);
                    setApiError(err?.message || 'Failed to load dashboard.');
                    setDashboardData(null);
                    setRecentWorkshopInvoices([]);
                    setWpiRowsForPipeline([]);
                    setSupplierWpiListTotal(null);
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
                    <p className="ws-page-sub">Overview of orders, AR, outstanding invoices & cash</p>
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
            {reportsPartialError && !apiError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 10,
                        fontSize: '0.75rem',
                        color: '#92400E',
                        border: '1px solid #FDE68A',
                        background: '#FFFBEB',
                        borderRadius: 10,
                    }}
                >
                    {reportsPartialError} Some totals may show “—” until this succeeds.
                </div>
            ) : null}
            {loading && !apiError ? (
                <>
                    <ShimmerKpiGrid cards={10} />
                    <ShimmerOrderStatusBar pillCount={ORDER_SUMMARY_STAGES.length} />
                </>
            ) : (
                <>
                    <div
                        className="ws-kpi-grid"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}
                    >
                        {kpis.map((k) => (
                            <div key={k.key} className="ws-kpi-card">
                                <div>
                                    <p className="ws-kpi-label">{k.label}</p>
                                    <p className="ws-kpi-value">{k.value}</p>
                                    {k.subAction ? (
                                        <button
                                            type="button"
                                            onClick={k.subAction}
                                            style={{
                                                fontSize: '0.75rem',
                                                color: '#2563EB',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                marginTop: 4,
                                                padding: 0,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {k.sub}
                                        </button>
                                    ) : (
                                        <p className="ws-kpi-sub">{k.sub}</p>
                                    )}
                                </div>
                                <div className={`ws-kpi-icon ${k.c}`}>
                                    <k.icon size={22} />
                                </div>
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
                                Order status (branch POs + workshop purchases)
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
                </>
            )}
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
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 16px',
                            borderBottom: '1px solid rgba(220,38,38,0.12)',
                        }}
                    >
                        <AlertTriangle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#B91C1C', margin: 0 }}>
                            Critical stock alerts ({criticalStock.length})
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
                                    borderBottom:
                                        i < Math.min(5, criticalStock.length) - 1
                                            ? '1px solid rgba(220,38,38,0.1)'
                                            : 'none',
                                }}
                            >
                                <span style={{ color: '#B91C1C' }}>
                                    {p.name} below critical level ({p.qty} {p.unit} &lt; {p.reorder}{' '}
                                    {p.unit})
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
                                    Order queue
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
                    Quick actions
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
            <div className="ws-section" style={{ marginTop: 20 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--color-border-light)',
                    }}
                >
                    <p style={{ fontWeight: 700, color: 'var(--color-text-dark)', margin: 0 }}>
                        Recent workshop orders
                    </p>
                    <button
                        type="button"
                        onClick={() => onTabChange('workshop_purchase_invoices')}
                        style={{
                            fontSize: '0.75rem',
                            color: '#2563EB',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        View all <ChevronRight size={14} />
                    </button>
                </div>
                <div>
                    {loading && !apiError ? (
                        <ShimmerListRows rows={6} />
                    ) : apiError ? (
                        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#B91C1C', padding: 32, margin: 0 }}>
                            Unable to load workshop orders ({apiError})
                        </p>
                    ) : recentWorkshopInvoices.length === 0 ? (
                        <p
                            style={{
                                textAlign: 'center',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-muted)',
                                padding: 32,
                                margin: 0,
                            }}
                        >
                            No workshop purchase invoices yet. Workshops send these from Purchase Invoices after they
                            raise stock requests.
                        </p>
                    ) : (
                        recentWorkshopInvoices.map((row, i) => (
                            <div
                                key={row.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '12px 20px',
                                    borderBottom:
                                        i < recentWorkshopInvoices.length - 1
                                            ? '1px solid var(--color-border-light)'
                                            : 'none',
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '0.875rem',
                                            margin: 0,
                                            color: '#EA580C',
                                        }}
                                    >
                                        {row.invoice_number}
                                    </p>
                                    <p
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                            margin: '4px 0 0 0',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                        title={row.product_label || ''}
                                    >
                                        {row.date || '—'} · {row.product_label || '—'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>
                                        {formatCurrency(row.grand_total ?? 0, currency)}
                                    </p>
                                    <span className={`ws-badge ${workshopInvoiceStatusBadge(row.status)}`}>
                                        {row.status}
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
