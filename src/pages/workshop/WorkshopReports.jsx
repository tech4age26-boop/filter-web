import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, ChevronRight, MoreVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from '../../components/Modal';
import { ShimmerTextBlock, ShimmerTable } from '../../components/supplier/Shimmer';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import {
    getWorkshopReportsAnalytics,
    getWorkshopRecentOrderDetails,
    getWorkshopRecentOrderPdf,
    getWorkshopRecentOrders,
    getWorkshopReportsByBranch,
    getWorkshopReportsByBranchDetails,
    getWorkshopReportsByCustomer,
    getWorkshopReportsByCustomerDetails,
    getWorkshopReportsByDepartment,
    getWorkshopReportsByDepartmentDetails,
    getWorkshopReportsByProduct,
    getWorkshopReportsByProductDetails,
    getWorkshopReportsByTechnician,
    getWorkshopReportsByTechnicianDetails,
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

function extractSummaryRows(res, key) {
    const direct = parseArr(res?.[key]);
    if (direct.length) return direct;
    const nested = parseArr(res?.data?.[key]);
    if (nested.length) return nested;
    const rows = parseArr(res?.rows);
    if (rows.length) return rows;
    const dataRows = parseArr(res?.data?.rows);
    if (dataRows.length) return dataRows;
    return [];
}

const humanizeKey = (key) =>
    String(key || '')
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (m) => m.toUpperCase());

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
    const [summaryData, setSummaryData] = useState({
        by_technician: [],
        by_customer: [],
        by_product: [],
        by_department: [],
        by_branch: [],
    });
    const [detailRows, setDetailRows] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const [detailsTitle, setDetailsTitle] = useState('');
    const [selectedDetailKey, setSelectedDetailKey] = useState('');
    const [detailTableWidth, setDetailTableWidth] = useState(0);
    const topScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const scrollSyncLockRef = useRef(false);
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
                const isAll = !selectedBranchId || selectedBranchId === 'all';
                const res = await getWorkshopTechnicians({
                    ...workshopReportsAnalyticsParams(selectedBranchId, {}),
                    ...(isAll ? { isActive: 'true' } : {}),
                });
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
        setDetailsError('');
        setDetailRows([]);
        setSelectedDetailKey('');
        setDetailsTitle('');
        try {
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate: dateFrom,
                endDate: dateTo,
                technicianId: selectedTechId || undefined,
            });
            const [
                response,
                recentOrdersRes,
                byTechnicianRes,
                byCustomerRes,
                byProductRes,
                byDepartmentRes,
                byBranchRes,
            ] = await Promise.all([
                getWorkshopReportsAnalytics(params),
                getWorkshopRecentOrders(params),
                getWorkshopReportsByTechnician(params),
                getWorkshopReportsByCustomer(params),
                getWorkshopReportsByProduct(params),
                getWorkshopReportsByDepartment(params),
                getWorkshopReportsByBranch(params),
            ]);
            if (!response?.success) {
                throw new Error('Invalid reports response.');
            }
            setReportData(response);
            setRecentOrders(Array.isArray(recentOrdersRes?.rows) ? recentOrdersRes.rows : []);
            setSummaryData({
                by_technician: extractSummaryRows(byTechnicianRes, 'by_technician'),
                by_customer: extractSummaryRows(byCustomerRes, 'by_customer'),
                by_product: extractSummaryRows(byProductRes, 'by_product'),
                by_department: extractSummaryRows(byDepartmentRes, 'by_department'),
                by_branch: extractSummaryRows(byBranchRes, 'by_branch'),
            });
        } catch (error) {
            setLoadError(error.message || 'Failed to load reports analytics.');
            setReportData(null);
            setSummaryData({
                by_technician: [],
                by_customer: [],
                by_product: [],
                by_department: [],
                by_branch: [],
            });
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

    useEffect(() => {
        setDetailRows([]);
        setDetailsError('');
        setDetailsTitle('');
        setSelectedDetailKey('');
    }, [activeTab]);

    useEffect(() => {
        if (detailsLoading || detailsError || detailRows.length === 0) return;
        const updateWidth = () => {
            const el = bottomScrollRef.current;
            if (!el) return;
            setDetailTableWidth(el.scrollWidth || 0);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, [detailRows, detailsLoading, detailsError]);

    const handleTopScroll = () => {
        if (scrollSyncLockRef.current) return;
        const top = topScrollRef.current;
        const bottom = bottomScrollRef.current;
        if (!top || !bottom) return;
        scrollSyncLockRef.current = true;
        bottom.scrollLeft = top.scrollLeft;
        scrollSyncLockRef.current = false;
    };

    const handleBottomScroll = () => {
        if (scrollSyncLockRef.current) return;
        const top = topScrollRef.current;
        const bottom = bottomScrollRef.current;
        if (!top || !bottom) return;
        scrollSyncLockRef.current = true;
        top.scrollLeft = bottom.scrollLeft;
        scrollSyncLockRef.current = false;
    };

    const loadDetails = useCallback(
        async (tabId, row) => {
            const params = workshopReportsAnalyticsParams(selectedBranchId, {
                startDate: dateFrom,
                endDate: dateTo,
                technicianId: selectedTechId || undefined,
            });
            let fetcher = null;
            let key = '';
            let title = '';
            if (tabId === 'by_technician') {
                fetcher = getWorkshopReportsByTechnicianDetails;
                key = String(row.technician_id ?? row.technicianId ?? row.id ?? '');
                title = `Technician details: ${row.name || 'Technician'}`;
            } else if (tabId === 'by_customer') {
                fetcher = getWorkshopReportsByCustomerDetails;
                key = String(row.customer_id ?? row.customerId ?? '');
                title = `Customer details: ${row.customer_name ?? row.customerName ?? 'Customer'}`;
            } else if (tabId === 'by_product') {
                fetcher = getWorkshopReportsByProductDetails;
                key = String(row.product_id ?? row.productId ?? '');
                title = `Product details: ${row.product_name ?? row.productName ?? row.item_name ?? 'Item'}`;
            } else if (tabId === 'by_department') {
                fetcher = getWorkshopReportsByDepartmentDetails;
                key = String(row.department_id ?? row.departmentId ?? '');
                title = `Department details: ${row.department_name ?? row.departmentName ?? 'Department'}`;
            } else if (tabId === 'by_branch') {
                fetcher = getWorkshopReportsByBranchDetails;
                key = String(row.branch_id ?? row.branchId ?? '');
                title = `Branch details: ${row.branch_name ?? row.branchName ?? 'Branch'}`;
            }
            if (!fetcher || !key) return;

            setSelectedDetailKey(`${tabId}:${key || 'all'}`);
            setDetailsLoading(true);
            setDetailsError('');
            setDetailsTitle(title);
            try {
                const res = await fetcher(key, params);
                const rows = parseArr(res?.rows);
                if (tabId === 'by_technician') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.jobId;
                            delete next.job_id;
                            delete next.departmentId;
                            delete next.department_id;
                            delete next.branchId;
                            delete next.branch_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.technicianId;
                            delete next.technician_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_customer') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.corporateAccountId;
                            delete next.corporate_account_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_product') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.salesOrderItemId;
                            delete next.sales_order_item_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            delete next.productId;
                            delete next.product_id;
                            delete next.serviceId;
                            delete next.service_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_department') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.salesOrderItemId;
                            delete next.sales_order_item_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            delete next.productId;
                            delete next.product_id;
                            delete next.serviceId;
                            delete next.service_id;
                            return next;
                        }),
                    );
                } else if (tabId === 'by_branch') {
                    setDetailRows(
                        rows.map((r) => {
                            const next = { ...(r || {}) };
                            delete next.invoiceId;
                            delete next.invoice_id;
                            delete next.salesOrderId;
                            delete next.sales_order_id;
                            delete next.vehicleId;
                            delete next.vehicle_id;
                            return next;
                        }),
                    );
                } else {
                    setDetailRows(rows);
                }
            } catch (error) {
                setDetailsError(error?.message || 'Failed to load details.');
                setDetailRows([]);
            } finally {
                setDetailsLoading(false);
            }
        },
        [selectedBranchId, dateFrom, dateTo, selectedTechId],
    );

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

        const techRaw = parseArr(summaryData.by_technician).length
            ? summaryData.by_technician
            : parseArr(r.by_technician).length
              ? r.by_technician
              : r.operationalPerformance;
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
            byCustomer: parseArr(summaryData.by_customer).length ? summaryData.by_customer : parseArr(r.by_customer),
            byProduct: parseArr(summaryData.by_product).length ? summaryData.by_product : parseArr(r.by_product),
            byDepartment: parseArr(summaryData.by_department).length ? summaryData.by_department : parseArr(r.by_department),
            byBranch: parseArr(summaryData.by_branch).length ? summaryData.by_branch : parseArr(r.by_branch),
            period: r.period ?? null,
            previousPeriod: r.previous_period ?? null,
            definitions: typeof r.definitions === 'string' ? r.definitions : '',
        };
    }, [reportData, summaryData]);

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
                                            <tr
                                                key={t.id || t.name}
                                                onClick={() => loadDetails('by_technician', t)}
                                                style={{ cursor: 'pointer', background: selectedDetailKey === `by_technician:${t.id}` ? '#F8FAFC' : undefined }}
                                            >
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
                                    <th>PHONE NUMBER</th>
                                    <th>PLATE NUMBER</th>
                                    <th>ORDERS</th>
                                    <th>REVENUE (SAR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(norm?.byCustomer ?? []).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                            No customer breakdown for this scope.
                                        </td>
                                    </tr>
                                ) : (
                                    norm.byCustomer.map((row, i) => (
                                        <tr
                                            key={row.customer_id ?? row.customerId ?? i}
                                            onClick={() => loadDetails('by_customer', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_customer:${String(row.customer_id ?? row.customerId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
                                            <td>
                                                <strong>
                                                    {row.customer_mobile ??
                                                        row.customerMobile ??
                                                        row.phone ??
                                                        row.mobile ??
                                                        '—'}
                                                </strong>
                                            </td>
                                            <td>
                                                {Array.isArray(row.plate_numbers ?? row.plateNumbers) &&
                                                (row.plate_numbers ?? row.plateNumbers).length > 0
                                                    ? (row.plate_numbers ?? row.plateNumbers).join(', ')
                                                    : row.plate_no ?? row.plateNo ?? '—'}
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
                                        <tr
                                            key={row.product_id ?? row.productId ?? i}
                                            onClick={() => loadDetails('by_product', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_product:${String(row.product_id ?? row.productId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
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
                                        <tr
                                            key={row.department_id ?? row.departmentId ?? i}
                                            onClick={() => loadDetails('by_department', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_department:${String(row.department_id ?? row.departmentId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
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
                                        <tr
                                            key={row.branch_id ?? row.branchId ?? i}
                                            onClick={() => loadDetails('by_branch', row)}
                                            style={{ cursor: 'pointer', background: selectedDetailKey === `by_branch:${String(row.branch_id ?? row.branchId ?? '')}` ? '#F8FAFC' : undefined }}
                                        >
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
                        <ShimmerTextBlock lines={6} />
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
            {(detailsLoading || detailsError || detailRows.length > 0) && (
                <Modal
                    title={detailsTitle || 'Details'}
                    onClose={() => {
                        setDetailRows([]);
                        setDetailsError('');
                        setDetailsTitle('');
                        setSelectedDetailKey('');
                    }}
                    width="min(1620px, 98vw)"
                >
                    {detailsLoading ? (
                        <ShimmerTable rows={8} columns={6} />
                    ) : detailsError ? (
                        <div style={{ padding: 8, color: '#B91C1C' }}>{detailsError}</div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12, maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' }}>
                            {(() => {
                                const hiddenCols = new Set([
                                    'jobId',
                                    'job_id',
                                    'departmentId',
                                    'department_id',
                                    'branchId',
                                    'branch_id',
                                    'customerId',
                                    'customer_id',
                                ]);
                                const columns = Object.keys(detailRows[0] || {}).filter((k) => !hiddenCols.has(k));
                                return (
                            <>
                                <div
                                    className="ws-report-table-wrapper"
                                    ref={topScrollRef}
                                    onScroll={handleTopScroll}
                                    style={{ overflowX: 'auto', overflowY: 'hidden' }}
                                >
                                    <div style={{ width: detailTableWidth, height: 1 }} />
                                </div>
                                <div
                                    className="ws-report-table-wrapper"
                                    ref={bottomScrollRef}
                                    onScroll={handleBottomScroll}
                                    style={{ overflowX: 'auto', overflowY: 'hidden' }}
                                >
                                    <table className="ws-table" style={{ minWidth: 'max-content', width: '100%' }}>
                                        <thead>
                                            <tr>
                                                {columns.map((k) => (
                                                    <th key={k} style={{ padding: '8px 10px' }}>{humanizeKey(k)}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailRows.map((row, i) => (
                                                <tr key={i}>
                                                    {columns.map((k) => {
                                                        const val = row?.[k];
                                                        return (
                                                            <td key={k} style={{ padding: '10px' }}>
                                                            {Array.isArray(val) ? (
                                                                val.length === 0 ? (
                                                                    '[]'
                                                                ) : val.every((item) => item && typeof item === 'object') ? (
                                                                    <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
                                                                        {val.map((item, idx) => (
                                                                            <div
                                                                                key={item.salesOrderItemId ?? idx}
                                                                                style={{
                                                                                    padding: '6px 8px',
                                                                                    border: '1px solid #E5E7EB',
                                                                                    borderRadius: 8,
                                                                                    background: '#F8FAFC',
                                                                                }}
                                                                            >
                                                                                <div style={{ fontWeight: 700, fontSize: 12 }}>
                                                                                    {item.itemName ?? item.name ?? `Item ${idx + 1}`}
                                                                                </div>
                                                                                <div style={{ fontSize: 11, color: '#6B7280' }}>
                                                                                    {item.itemType ?? 'item'} • Qty: {item.qty ?? '—'} • SAR {toNumber(item.lineTotal).toLocaleString()}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    val.join(', ')
                                                                )
                                                            ) : val == null || val === '' ? (
                                                                '—'
                                                            ) : (
                                                                String(val)
                                                            )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                                );
                            })()}
                        </div>
                    )}
                </Modal>
            )}
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
