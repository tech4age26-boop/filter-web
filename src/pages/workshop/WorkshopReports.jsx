import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronRight, MoreVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../../components/Modal';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import {
    getWorkshopReportsAnalytics,
    getWorkshopRecentOrderDetails,
    getWorkshopRecentOrderPdf,
    getWorkshopRecentOrders,
    getWorkshopTechnicians,
    runWorkshopRelativeAction,
    workshopReportsAnalyticsParams,
    unwrapWorkshopStaffList,
    flattenWorkshopStaffRow,
} from '../../services/workshopStaffApi';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => `SAR ${toNumber(value).toLocaleString()}`;

const mapRecentPdfToInvoice = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw?.invoice && typeof raw.invoice === 'object' ? raw.invoice : raw;
    const salesOrder = src.salesOrder && typeof src.salesOrder === 'object' ? src.salesOrder : {};
    const customer = salesOrder.customer && typeof salesOrder.customer === 'object' ? salesOrder.customer : {};
    const vehicle = salesOrder.vehicle && typeof salesOrder.vehicle === 'object' ? salesOrder.vehicle : {};
    const jobs = Array.isArray(salesOrder.jobs) ? salesOrder.jobs : (Array.isArray(src.jobs) ? src.jobs : []);
    const payments = Array.isArray(src.payments) ? src.payments : [];
    const departments = Array.isArray(src.departments) ? src.departments : [];
    const splitPayments = Array.isArray(src.splitPayments)
        ? src.splitPayments
        : payments.map((p) => ({ method: p?.method, amount: p?.amount }));
    const paymentMethod =
        src.paymentMethod ||
        payments.map((p) => p?.method).filter(Boolean).join(', ') ||
        splitPayments.map((p) => p?.method).filter(Boolean).join(', ') ||
        'Unpaid';
    return {
        ...src,
        invoiceId: src.invoiceId ?? src.id,
        invoiceNo: src.invoiceNo,
        invoiceDate: src.invoiceDate,
        issuedAt: src.issuedAt || src.dateTime || src.invoiceDate,
        customerName: src.customerName || customer.name,
        customerMobile: src.phone || src.customerMobile || customer.mobile,
        customerTaxId: src.taxId ?? src.customerTaxId ?? customer.taxId ?? null,
        plateNo: src.vehicleNo || src.plateNo || vehicle.plateNo,
        vehicleModel: src.model ?? src.vehicleModel ?? vehicle.model ?? null,
        vehicleYear: src.year ?? src.vehicleYear ?? vehicle.year ?? null,
        vehicleMake: src.make ?? src.vehicleMake ?? vehicle.make ?? null,
        vehicleVin: src.vin ?? src.vehicleVin ?? vehicle.vin ?? null,
        branchName: src.branchName || src.branch?.name,
        totalAmount: src.totalAmount ?? src.invoiceTotal,
        paymentMethod,
        maintenanceChecklist: src.maintenanceChecklist,
        departments: departments.length > 0 ? departments : jobs.map((j) => ({
            departmentId: j?.departmentId,
            departmentName: j?.department || j?.departmentName,
            items: [],
        })),
        jobs,
        customerType: src.customerType,
        splitPayments,
    };
};

/** Last N inclusive UTC calendar days through today UTC (matches typical “last 30 days” API default). */
function defaultUtcDateRangeInclusive(days = 30) {
    const end = new Date();
    const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    const startUtc = new Date(endUtc);
    startUtc.setUTCDate(startUtc.getUTCDate() - (days - 1));
    return {
        from: startUtc.toISOString().slice(0, 10),
        to: endUtc.toISOString().slice(0, 10),
    };
}

function TechDropdown({ value, options, onChange }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef(null);
    const label = options.find((o) => o.value === value)?.label ?? 'All Technicians';

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
            <button type="button" className="ws-dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
                {label}
                <ChevronRight
                    size={14}
                    className={isOpen ? 'rotate-90' : ''}
                    style={{ transition: 'transform 0.2s', transform: `rotate(${isOpen ? '90deg' : '0deg'})` }}
                />
            </button>
            {isOpen && (
                <div className="ws-dropdown-menu">
                    {options.map((opt) => (
                        <div
                            key={opt.value || '__all__'}
                            className={`ws-dropdown-item ${value === opt.value ? 'active' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            {opt.label}
                            {value === opt.value && <span className="ws-check">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function parseArr(v) {
    if (Array.isArray(v)) return v;
    return [];
}

function technicianDropdownRow(raw) {
    const row = flattenWorkshopStaffRow(raw, 'technician');
    const id =
        row.id ??
        row.userId ??
        row.employee_id ??
        row.employeeId ??
        row.user?.id ??
        row.technician_id ??
        row.technicianId;
    const name =
        row.name ??
        row.fullName ??
        row.full_name ??
        row.user?.name ??
        (row.user && `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim()) ??
        'Unknown';
    if (id == null || String(id) === '') return null;
    return { id: String(id), name: String(name).trim() || 'Unknown' };
}

export default function WorkshopReports({ selectedBranchId = 'all', branches = [] }) {
    const defaults = useMemo(() => defaultUtcDateRangeInclusive(30), []);
    const [dateFrom, setDateFrom] = useState(defaults.from);
    const [dateTo, setDateTo] = useState(defaults.to);
    const [activeTab, setActiveTab] = useState('daily_sales');
    const [selectedTechId, setSelectedTechId] = useState('');
    const [technicianOptions, setTechnicianOptions] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [recentOrderDetails, setRecentOrderDetails] = useState(null);
    const [recentOrderDetailsLoading, setRecentOrderDetailsLoading] = useState(false);
    const [recentOrderDetailsError, setRecentOrderDetailsError] = useState('');
    const [openRecentOrderMenuId, setOpenRecentOrderMenuId] = useState('');
    const [recentOrderActionBusyId, setRecentOrderActionBusyId] = useState('');
    const [invoicePreviewData, setInvoicePreviewData] = useState(null);
    const [autoDownloadAfterPreview, setAutoDownloadAfterPreview] = useState(false);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const techSelectOptions = useMemo(() => {
        const uniq = new Map();
        for (const t of technicianOptions) {
            if (t?.id) uniq.set(String(t.id), { value: String(t.id), label: t.name });
        }
        return [{ value: '', label: 'All Technicians' }, ...uniq.values()];
    }, [technicianOptions]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopTechnicians(workshopReportsAnalyticsParams(selectedBranchId, {}));
                if (cancelled) return;
                const rawList = unwrapWorkshopStaffList(res, 'technician');
                const opts = [];
                for (const raw of rawList) {
                    const opt = technicianDropdownRow(raw);
                    if (opt) opts.push(opt);
                }
                setTechnicianOptions(opts);
            } catch {
                if (!cancelled) setTechnicianOptions([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedBranchId]);

    useEffect(() => {
        setSelectedTechId('');
    }, [selectedBranchId]);

    const loadReports = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate: dateFrom,
                endDate: dateTo,
                technicianId: selectedTechId || undefined,
            });
            const [response, recentOrdersRes] = await Promise.all([
                getWorkshopReportsAnalytics(params),
                getWorkshopRecentOrders(params),
            ]);
            if (!response?.success) {
                throw new Error('Invalid reports response.');
            }
            setReportData(response);
            setRecentOrders(Array.isArray(recentOrdersRes?.rows) ? recentOrdersRes.rows : []);
        } catch (error) {
            setLoadError(error.message || 'Failed to load reports analytics.');
            setReportData(null);
            setRecentOrders([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId, dateFrom, dateTo, selectedTechId]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const fetchRecentOrderDetails = useCallback(async (invoiceId) => {
        const params = workshopReportsAnalyticsParams(selectedBranchId, {
            startDate: dateFrom,
            endDate: dateTo,
        });
        return await getWorkshopRecentOrderDetails(invoiceId, params);
    }, [selectedBranchId, dateFrom, dateTo]);

    const openRecentOrderDetails = useCallback(async (invoiceId) => {
        if (!invoiceId) return;
        setRecentOrderDetailsLoading(true);
        setRecentOrderDetailsError('');
        try {
            const res = await fetchRecentOrderDetails(invoiceId);
            setRecentOrderDetails(res && typeof res === 'object' ? res : null);
        } catch (error) {
            setRecentOrderDetailsError(error?.message || 'Failed to load recent order details.');
            setRecentOrderDetails(null);
        } finally {
            setRecentOrderDetailsLoading(false);
        }
    }, [fetchRecentOrderDetails]);

    const handleRecentOrderAction = useCallback(async (invoiceId, actionType) => {
        if (!invoiceId) return;
        setRecentOrderActionBusyId(String(invoiceId));
        try {
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate: dateFrom,
                endDate: dateTo,
            });
            const res = await getWorkshopRecentOrderPdf(invoiceId, params);
            const invoiceObj = mapRecentPdfToInvoice(res);
            if (!invoiceObj) throw new Error('Invalid invoice response.');
            if (actionType === 'view') {
                setInvoicePreviewData(invoiceObj);
                setAutoDownloadAfterPreview(false);
            } else if (actionType === 'download') {
                setInvoicePreviewData(invoiceObj);
                setAutoDownloadAfterPreview(true);
            } else if (actionType === 'whatsapp') {
                const endpoint = `/workshop-staff/invoices/${encodeURIComponent(String(invoiceId))}/whatsapp-pdf`;
                const method = 'POST';
                await runWorkshopRelativeAction(endpoint, method);
                window.alert('Invoice sent to WhatsApp successfully.');
            }
        } catch (error) {
            window.alert(error?.message || 'Failed to execute action.');
        } finally {
            setRecentOrderActionBusyId('');
            setOpenRecentOrderMenuId('');
        }
    }, [selectedBranchId, dateFrom, dateTo]);

    useEffect(() => {
        if (!autoDownloadAfterPreview || !invoicePreviewData) return;
        const timer = setTimeout(() => {
            const btn = document.querySelector('.invoice-modal-root .invoice-btn-tertiary');
            if (btn && btn instanceof HTMLElement) {
                btn.click();
            }
            setAutoDownloadAfterPreview(false);
        }, 180);
        return () => clearTimeout(timer);
    }, [autoDownloadAfterPreview, invoicePreviewData]);

    const norm = useMemo(() => {
        if (!reportData || typeof reportData !== 'object') return null;
        const r = reportData;
        const fo = r.financialOverview ?? {};
        const inv = r.inventoryValuation ?? {};

        const totalRevenue = toNumber(r.total_revenue ?? fo.totalRevenue);
        const revenueChangePercent = toNumber(r.revenue_change_percent ?? fo.revenueChangePercent);
        const stockValueCost = toNumber(r.stock_value_cost ?? inv.stockValueCost);
        const potentialProfit = toNumber(r.potential_profit ?? inv.potentialProfit);
        const activeSkus = toNumber(r.active_skus ?? inv.activeSkus);

        const dailyRaw = parseArr(r.daily_revenue).length ? r.daily_revenue : fo.dailyRevenue;
        const dailyRevenue = parseArr(dailyRaw).map((e) => ({
            day: e.day_label ?? e.day ?? '',
            date: e.date ?? '',
            amount: toNumber(e.revenue ?? e.amount),
        }));

        const techRaw = parseArr(r.by_technician).length ? r.by_technician : r.operationalPerformance;
        const byTechnician = parseArr(techRaw).map((e) => ({
            id: String(e.technician_id ?? e.employeeId ?? e.id ?? ''),
            name: e.name || 'Unknown',
            completedJobs: toNumber(e.completed_jobs ?? e.totalJobs ?? e.orders),
            commission: toNumber(e.commission_sar ?? e.commission),
            revenue: toNumber(e.revenue_sar ?? e.revenue),
        }));

        return {
            completedOrdersCount: toNumber(r.completed_orders_count),
            totalRevenue,
            revenueChangePercent,
            stockValueCost,
            potentialProfit,
            activeSkus,
            dailyRevenue,
            byTechnician,
            byCustomer: parseArr(r.by_customer),
            byProduct: parseArr(r.by_product),
            byDepartment: parseArr(r.by_department),
            byBranch: parseArr(r.by_branch),
            period: r.period ?? null,
            previousPeriod: r.previous_period ?? null,
            definitions: typeof r.definitions === 'string' ? r.definitions : '',
        };
    }, [reportData]);

    const kpis = useMemo(() => {
        if (!norm) {
            return [
                { label: 'Total Revenue', value: formatCurrency(0), color: 'text-green' },
                { label: 'Revenue Change', value: '0.0%', sub: 'vs previous period', color: 'text-blue' },
                { label: 'Stock Value (Cost)', value: formatCurrency(0), color: 'text-orange' },
                { label: 'Potential Profit', value: formatCurrency(0), sub: '0 active SKUs', color: 'text-purple' },
            ];
        }
        const sign = norm.revenueChangePercent > 0 ? '+' : '';
        return [
            { label: 'Total Revenue', value: formatCurrency(norm.totalRevenue), color: 'text-green' },
            {
                label: 'Revenue Change',
                value: `${sign}${norm.revenueChangePercent.toFixed(1)}%`,
                sub: 'vs previous period',
                color: 'text-blue',
            },
            { label: 'Stock Value (Cost)', value: formatCurrency(norm.stockValueCost), color: 'text-orange' },
            {
                label: 'Potential Profit',
                value: formatCurrency(norm.potentialProfit),
                sub: `${norm.activeSkus} active SKUs`,
                color: 'text-purple',
            },
        ];
    }, [norm]);

    const completedOrdersDisplay = norm?.completedOrdersCount ?? 0;

    const tabs = [
        { id: 'daily_sales', label: 'Daily Sales' },
        { id: 'by_technician', label: 'By Technician' },
        { id: 'by_customer', label: 'By Customer' },
        { id: 'by_product', label: 'By Product' },
        { id: 'by_department', label: 'By Department' },
        { id: 'by_branch', label: 'By Branch' },
        { id: 'recent_orders', label: 'Recent Orders' },
    ];

    const periodLine = useMemo(() => {
        if (!norm?.period?.start_date && !norm?.period?.startDate) return null;
        const p = norm.period;
        const curStart = p.start_date ?? p.startDate;
        const curEnd = p.end_date ?? p.endDate;
        const pp = norm.previousPeriod;
        const prevStart = pp?.start_date ?? pp?.startDate;
        const prevEnd = pp?.end_date ?? pp?.endDate;
        if (!curStart || !curEnd) return null;
        const prev =
            prevStart && prevEnd
                ? ` · Previous: ${prevStart} → ${prevEnd}`
                : '';
        return `Period: ${curStart} → ${curEnd}${prev}`;
    }, [norm]);

    return (
        <div className="ws-reports-page">
            <div className="ws-reports-header">
                <div>
                    <h2 className="ws-page-title">Reports & Analytics</h2>
                    <p className="ws-page-sub">
                        Scope · <strong>{branchLabel}</strong>
                    </p>
                    {periodLine && (
                        <p className="ws-text-dim" style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
                            {periodLine}
                        </p>
                    )}
                </div>
                <div className="ws-online-badge">
                    <div className="ws-online-dot" /> Online
                </div>
            </div>

            <div className="ws-reports-filters">
                <div className="ws-filter-group">
                    <div className="ws-date-input-group">
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        <span className="ws-text-dim">to</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <TechDropdown value={selectedTechId} options={techSelectOptions} onChange={setSelectedTechId} />
                    <button type="button" className="ws-btn-refresh" onClick={loadReports} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <div className="ws-order-count">
                    <span>{completedOrdersDisplay} completed orders</span>
                </div>
            </div>
            {loadError && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {loadError}
                </div>
            )}

            <div className="ws-reports-kpi-grid">
                {kpis.map((k) => (
                    <div key={k.label} className="ws-kpi-card">
                        <p className="ws-kpi-label">{k.label}</p>
                        <h3 className={`ws-kpi-value ${k.color}`}>{k.value}</h3>
                        {k.sub && <p className="ws-kpi-sub">{k.sub}</p>}
                    </div>
                ))}
            </div>

            <div className="ws-reports-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`ws-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="ws-tab-content">
                {activeTab === 'daily_sales' && (
                    <div className="ws-report-view">
                        <div className="ws-chart-container">
                            <h4 className="ws-chart-title">Daily Revenue</h4>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer>
                                    <BarChart data={norm?.dailyRevenue ?? []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, fill: '#6B7280' }}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <Tooltip
                                            cursor={{ fill: '#F9FAFB' }}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            }}
                                        />
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
                                    {(norm?.dailyRevenue ?? []).length === 0 ? (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                No daily revenue data
                                            </td>
                                        </tr>
                                    ) : (
                                        (norm?.dailyRevenue ?? []).map((d, i) => (
                                            <tr key={`${d.date}-${i}`}>
                                                <td>{d.day}</td>
                                                <td>{d.date}</td>
                                                <td className="ws-font-bold">SAR {d.amount.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
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
                                    <BarChart
                                        data={norm?.byTechnician ?? []}
                                        layout="vertical"
                                        margin={{ left: 40, right: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#6B7280' }}
                                            width={120}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#F9FAFB' }}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: 'none',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            }}
                                        />
                                        <Bar dataKey="revenue" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="ws-report-table-wrapper">
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>TECHNICIAN</th>
                                        <th>COMPLETED JOBS</th>
                                        <th>REVENUE (SAR)</th>
                                        <th>COMMISSION (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(norm?.byTechnician ?? []).length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                                No technician performance data
                                            </td>
                                        </tr>
                                    ) : (
                                        (norm?.byTechnician ?? []).map((t) => (
                                            <tr key={t.id || t.name}>
                                                <td>
                                                    <strong>{t.name}</strong>
                                                </td>
                                                <td>{t.completedJobs}</td>
                                                <td className="ws-font-bold">SAR {t.revenue.toLocaleString()}</td>
                                                <td className="ws-font-bold">SAR {t.commission.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'by_customer' && (
                    <div className="ws-report-table-wrapper">
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>CUSTOMER</th>
                                    <th>ORDERS</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byCustomer ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No customer breakdown for this scope.
                                        </td>
                                    </tr>
                                ) : (
                                    norm.byCustomer.map((row, i) => (
                                        <tr key={row.customer_id ?? row.customerId ?? i}>
                                            <td>
                                                <strong>{row.customer_name ?? row.customerName ?? '—'}</strong>
                                            </td>
                                            <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'by_product' && (
                    <div className="ws-report-table-wrapper">
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>PRODUCT / SERVICE</th>
                                    <th>TYPE</th>
                                    <th>QTY</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byProduct ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No product breakdown for this scope.
                                        </td>
                                    </tr>
                                ) : (
                                    norm.byProduct.map((row, i) => (
                                        <tr key={row.product_id ?? row.productId ?? i}>
                                            <td>
                                                <strong>{row.product_name ?? row.productName ?? row.product_id ?? row.productId ?? '—'}</strong>
                                            </td>
                                            <td>{row.item_type ?? row.itemType ?? '—'}</td>
                                            <td>{toNumber(row.qty_sold ?? row.qtySold)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'by_department' && (
                    <div className="ws-report-table-wrapper">
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>DEPARTMENT</th>
                                    <th>ORDERS</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byDepartment ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No department breakdown for this scope.
                                        </td>
                                    </tr>
                                ) : (
                                    norm.byDepartment.map((row, i) => (
                                        <tr key={row.department_id ?? row.departmentId ?? i}>
                                            <td>
                                                <strong>{row.department_name ?? row.departmentName ?? '—'}</strong>
                                            </td>
                                            <td>{toNumber(row.orders_count ?? row.ordersCount)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'by_branch' && (
                    <div className="ws-report-table-wrapper">
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>BRANCH</th>
                                    <th>COMPLETED ORDERS</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byBranch ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No branch breakdown (try “All branches”).
                                        </td>
                                    </tr>
                                ) : (
                                    norm.byBranch.map((row, i) => (
                                        <tr key={row.branch_id ?? row.branchId ?? i}>
                                            <td>
                                                <strong>{row.branch_name ?? row.branchName ?? '—'}</strong>
                                            </td>
                                            <td>{toNumber(row.completed_orders ?? row.completedOrders)}</td>
                                            <td className="ws-font-bold">
                                                SAR {toNumber(row.revenue_sar ?? row.revenueSar).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'recent_orders' && (
                    <div className="ws-report-table-wrapper ws-report-table-wrapper--actions">
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>INVOICE NO</th>
                                    <th>INVOICE DATE</th>
                                    <th>CUSTOMER NAME</th>
                                    <th>PLATE NO</th>
                                    <th>TOTAL (SAR)</th>
                                    <th style={{ width: 56 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No recent orders in this scope.
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((row, i) => (
                                        <tr
                                            key={row.invoiceId ?? row.invoiceNo ?? i}
                                            onClick={() => openRecentOrderDetails(row.invoiceId)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td><strong>{row.invoiceNo ?? '—'}</strong></td>
                                            <td>{row.invoiceDate ?? '—'}</td>
                                            <td>{row.customerName ?? '—'}</td>
                                            <td>{row.plateNo ?? '—'}</td>
                                            <td className="ws-font-bold">SAR {toNumber(row.invoiceTotal).toLocaleString()}</td>
                                            <td onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                                                <button
                                                    type="button"
                                                    className="ws-row-actions-trigger"
                                                    onClick={() =>
                                                        setOpenRecentOrderMenuId((prev) =>
                                                            prev === String(row.invoiceId) ? '' : String(row.invoiceId),
                                                        )
                                                    }
                                                    disabled={recentOrderActionBusyId === String(row.invoiceId)}
                                                >
                                                    <MoreVertical size={14} />
                                                </button>
                                                {openRecentOrderMenuId === String(row.invoiceId) && (
                                                    <div
                                                        className={`ws-row-actions-menu ${i >= Math.max(recentOrders.length - 3, 0) ? 'up' : ''}`}
                                                    >
                                                        <button type="button" className="ws-row-action-btn" onClick={() => handleRecentOrderAction(row.invoiceId, 'view')}>
                                                            View Invoice
                                                        </button>
                                                        <button type="button" className="ws-row-action-btn" onClick={() => handleRecentOrderAction(row.invoiceId, 'download')}>
                                                            Download PDF
                                                        </button>
                                                        <button type="button" className="ws-row-action-btn" onClick={() => handleRecentOrderAction(row.invoiceId, 'whatsapp')}>
                                                            Send Invoice to WhatsApp (PDF)
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {(recentOrderDetailsLoading || recentOrderDetailsError || recentOrderDetails) && (
                <Modal
                    title={`Recent Order ${recentOrderDetails?.invoiceNo ? `- ${recentOrderDetails.invoiceNo}` : 'Details'}`}
                    onClose={() => {
                        setRecentOrderDetails(null);
                        setRecentOrderDetailsError('');
                        setRecentOrderDetailsLoading(false);
                    }}
                    width="min(980px, 96vw)"
                >
                    {recentOrderDetailsLoading ? (
                        <div className="ws-text-dim">Loading details...</div>
                    ) : recentOrderDetailsError ? (
                        <div style={{ color: '#B91C1C' }}>{recentOrderDetailsError}</div>
                    ) : recentOrderDetails ? (
                        <div className="ws-report-table-wrapper">
                            <table className="ws-table">
                                <tbody>
                                    <tr><th>DATE / TIME</th><td>{recentOrderDetails.dateTime ?? '—'}</td></tr>
                                    <tr><th>CUSTOMER NAME</th><td>{recentOrderDetails.customerName ?? '—'}</td></tr>
                                    <tr><th>PHONE</th><td>{recentOrderDetails.phone ?? '—'}</td></tr>
                                    <tr><th>VEHICLE NO</th><td>{recentOrderDetails.vehicleNo ?? '—'}</td></tr>
                                    <tr><th>DEPARTMENTS</th><td>{(recentOrderDetails.departments ?? []).map((d) => d?.name).filter(Boolean).join(', ') || '—'}</td></tr>
                                    <tr><th>TECHNICIANS</th><td>{(recentOrderDetails.technicians ?? []).map((t) => t?.name).filter(Boolean).join(', ') || '—'}</td></tr>
                                    <tr><th>TOTAL AMOUNT</th><td>SAR {toNumber(recentOrderDetails.totalAmount).toLocaleString()}</td></tr>
                                    <tr><th>PAYMENT METHOD</th><td>{recentOrderDetails.paymentMethod ?? '—'}</td></tr>
                                    <tr><th>CUSTOMER TYPE</th><td>{recentOrderDetails.customerType ?? '—'}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                </Modal>
            )}

            <InvoiceDetailsModal
                invoice={invoicePreviewData}
                isOpen={!!invoicePreviewData}
                onClose={() => {
                    setInvoicePreviewData(null);
                    setAutoDownloadAfterPreview(false);
                }}
            />

            {norm?.definitions ? (
                <details className="ws-section" style={{ marginTop: 20 }}>
                    <summary className="ws-text-dim" style={{ cursor: 'pointer', fontWeight: 600 }}>
                        Metric definitions (from API)
                    </summary>
                    <pre
                        style={{
                            marginTop: 12,
                            fontSize: '0.8125rem',
                            whiteSpace: 'pre-wrap',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        {norm.definitions}
                    </pre>
                </details>
            ) : null}
        </div>
    );
}
