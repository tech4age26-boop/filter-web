import { useState, useEffect } from 'react';
import { FileText, Calendar, TrendingUp, Wallet, DollarSign, Car, CreditCard, BarChart3, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

const REPORT_CATEGORIES = [
    { id: 'billing',    label: 'Monthly Billing Summary',       icon: FileText,   color: '#DBEAFE', textColor: '#1D4ED8' },
    { id: 'bookings',   label: 'Booking & Service History',     icon: Calendar,   color: '#D1FAE5', textColor: '#047857' },
    { id: 'quotations', label: 'Quotation History',             icon: TrendingUp, color: '#F3E8FF', textColor: '#7C3AED' },
    { id: 'wallet',     label: 'Wallet Transaction History',    icon: Wallet,     color: '#E0E7FF', textColor: '#4F46E5' },
    { id: 'savings',    label: 'Savings & Discount Report',     icon: DollarSign, color: '#FEF3C7', textColor: '#B45309' },
    { id: 'vehicles',   label: 'Vehicle-wise Usage Report',     icon: Car,        color: '#FFEDD5', textColor: '#C2410C' },
    { id: 'payments',   label: 'Payment History',               icon: CreditCard, color: '#FCE7F3', textColor: '#BE185D' },
];

const CUSTOM_REPORT_TYPES = [
    'Monthly billing Summary',
    'Booking and service history',
    'Quotation History',
    'Wallet Transaction History',
    'Savings and discount report',
    'Vehicle-wise usage Report',
    'Payment history',
];

function Spinner() {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader2 className="spin" size={28} style={{ color: 'var(--color-primary)' }}/></div>;
}

function useApi(path) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        apiFetch(path).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }, [path]);
    return { data, loading };
}

function KpiRow({ items }) {
    return (
        <div className="ws-kpi-grid" style={{ marginBottom: 20 }}>
            {items.map(k => (
                <div key={k.label} className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">{k.label}</p>
                        <p className="ws-kpi-value" style={{ color: k.color || 'var(--color-text-dark)' }}>{k.value}</p>
                        {k.sub && <p className="ws-kpi-sub">{k.sub}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function SectionHeader({ title }) {
    return <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: '0 0 16px 0' }}>{title}</h3>;
}

// ─── BILLING ────────────────────────────────────────────────────────────────
function BillingReportView() {
    const { data: summary, loading: sl } = useApi('/corporate/billing/summary');
    const { data: monthly, loading: ml } = useApi('/corporate/billing/monthly');
    const [statusFilter, setStatusFilter] = useState('all');

    const s = summary?.summary || summary || {};
    const invoices = monthly?.invoices || monthly?.data || [];
    const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => (i.status || '').toLowerCase() === statusFilter);

    if (sl || ml) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Monthly Billing Summary"/>
            <KpiRow items={[
                { label: 'Total Billed',   value: `SAR ${Number(s.totalBilled   ?? s.total_billed   ?? 0).toLocaleString()}`, color: 'var(--color-text-dark)' },
                { label: 'Total Paid',     value: `SAR ${Number(s.totalPaid     ?? s.total_paid     ?? 0).toLocaleString()}`, color: '#047857' },
                { label: 'Outstanding',    value: `SAR ${Number(s.outstanding   ?? s.dueBalance     ?? s.due_balance ?? 0).toLocaleString()}`, color: '#DC2626' },
                { label: 'Wallet Used',    value: `SAR ${Number(s.walletUsed    ?? s.wallet_used    ?? 0).toLocaleString()}`, color: '#7C3AED' },
            ]}/>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['all', 'paid', 'pending', 'overdue'].map(st => (
                    <button key={st} type="button" onClick={() => setStatusFilter(st)}
                        style={{ padding: '6px 12px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, border: 'none', background: statusFilter === st ? 'var(--color-text-dark)' : 'var(--color-bg-muted)', color: statusFilter === st ? '#fff' : 'var(--color-text-muted)', cursor: 'pointer' }}>
                        {st}
                    </button>
                ))}
            </div>
            {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No invoices found</p>
            ) : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>Invoice #</th><th>Date</th><th>Vehicle</th><th>Department</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                        {filtered.map((inv, i) => (
                            <tr key={inv.id || i}>
                                <td style={{ fontWeight: 600, color: '#2563EB' }}>{inv.invoiceNumber || inv.invoice_number || inv.id}</td>
                                <td>{inv.date || inv.createdAt ? new Date(inv.date || inv.createdAt).toLocaleDateString('en-SA') : '—'}</td>
                                <td>{inv.vehiclePlate || inv.vehicle?.plateNo || '—'}</td>
                                <td>{inv.department || inv.departmentName || inv.service || '—'}</td>
                                <td><strong>SAR {Number(inv.amount || inv.totalAmount || inv.total || 0).toLocaleString()}</strong></td>
                                <td><span className={`ws-badge ${(inv.status || '') === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{inv.status || '—'}</span></td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── BOOKING HISTORY ─────────────────────────────────────────────────────────
function BookingHistoryView() {
    const [status, setStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        const qs = new URLSearchParams({ limit: 100 });
        if (status) qs.set('status', status);
        if (startDate) qs.set('startDate', startDate);
        if (endDate) qs.set('endDate', endDate);
        apiFetch(`/corporate/bookings?${qs}`)
            .then((d) => setOrders(d.bookings || d.orders || d.data?.bookings || d.data || []))
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const STATUS_BADGE = { submitted: 'ws-badge--blue', completed: 'ws-badge--green', in_progress: 'ws-badge--blue', cancelled: 'ws-badge--red', pending: 'ws-badge--yellow' };
    const completed = orders.filter(o => o.status === 'completed').length;
    const totalSpend = orders.reduce((s, o) => s + (parseFloat(o.amount ?? o.grandTotal ?? o.total ?? 0) || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Booking & Service History"/>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="ws-field" style={{ margin: 0 }}><label>Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 10px' }}>
                        <option value="">All</option>
                        {['submitted','confirmed','in_progress','completed','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="ws-field" style={{ margin: 0 }}><label>From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 10px' }}/></div>
                <div className="ws-field" style={{ margin: 0 }}><label>To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 10px' }}/></div>
                <button className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }} onClick={load}>Filter</button>
            </div>
            {loading ? <Spinner/> : (
                <>
                    <KpiRow items={[
                        { label: 'Total Bookings', value: orders.length },
                        { label: 'Completed',      value: completed, color: '#047857' },
                        { label: 'Other',          value: orders.length - completed },
                        { label: 'Total Spend',    value: `SAR ${totalSpend.toLocaleString()}`, color: '#2563EB' },
                    ]}/>
                    {orders.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No bookings found</p> : (
                        <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                            <table className="ws-table"><thead><tr><th>Booking</th><th>Date</th><th>Vehicle</th><th>Branch</th><th>Status</th><th>Amount</th></tr></thead>
                            <tbody>
                                {orders.map((o, i) => (
                                    <tr key={o.id || i}>
                                        <td style={{ fontWeight: 600, color: '#2563EB' }}>{o.bookingCode || o.orderNumber || `#${o.id}`}</td>
                                        <td>{o.bookedFor ? new Date(o.bookedFor).toLocaleDateString('en-SA') : '—'}</td>
                                        <td>{o.vehicle?.plateNo || o.vehiclePlate || '—'}</td>
                                        <td>{o.branchName || o.branch?.name || '—'}</td>
                                        <td><span className={`ws-badge ${STATUS_BADGE[o.status] || 'ws-badge--gray'}`}>{(o.status || '—').replace(/_/g, ' ')}</span></td>
                                        <td>{(o.amount ?? o.grandTotal ?? o.total) != null ? `SAR ${Number(o.amount ?? o.grandTotal ?? o.total).toFixed(2)}` : 'Pending'}</td>
                                    </tr>
                                ))}
                            </tbody></table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── QUOTATIONS ──────────────────────────────────────────────────────────────
function normalizePriceQuotationsReportList(data) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data.quotations)) return data.quotations;
    if (Array.isArray(data.items)) return data.items;
    return [];
}

function QuotationsReportView() {
    const { data: sumData, loading: sl } = useApi('/corporate/price-quotations/summary');
    const { data: listData, loading: ll } = useApi('/corporate/price-quotations?limit=50&offset=0');
    const s = sumData && typeof sumData === 'object' ? sumData : {};
    const quotes = normalizePriceQuotationsReportList(listData);
    const STATUS_STYLE = {
        approved: 'ws-badge--green',
        rejected: 'ws-badge--red',
        pending: 'ws-badge--yellow',
        sent: 'ws-badge--blue',
        draft: 'ws-badge--gray',
    };

    if (sl || ll) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Price quotation history"/>
            <KpiRow items={[
                { label: 'Total', value: s.total ?? quotes.length },
                { label: 'Pending', value: s.pending ?? quotes.filter((q) => q.status === 'pending').length, color: '#D97706' },
                { label: 'Approved', value: s.approved ?? quotes.filter((q) => q.status === 'approved').length, color: '#047857' },
                { label: 'Rejected', value: s.rejected ?? quotes.filter((q) => q.status === 'rejected').length, color: '#DC2626' },
            ]}/>
            {quotes.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No quotation lines found</p> : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>ID</th><th>Submitted</th><th>Name</th><th>Quote</th><th>Status</th></tr></thead>
                    <tbody>
                        {quotes.map((q, i) => (
                            <tr key={q.id || i}>
                                <td style={{ fontWeight: 600, color: '#7C3AED' }}>#{q.id}</td>
                                <td>{q.submittedAt ? new Date(q.submittedAt).toLocaleDateString('en-SA') : '—'}</td>
                                <td>{q.name || '—'}</td>
                                <td>SAR {Number(q.quotationPrice ?? q.priceIncludingVat ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td><span className={`ws-badge ${STATUS_STYLE[String(q.status || '').toLowerCase()] || 'ws-badge--gray'}`}>{q.status || '—'}</span></td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── WALLET ──────────────────────────────────────────────────────────────────
function WalletReportView({ walletBalance }) {
    const { data: sumData, loading: sl } = useApi('/corporate/wallet/summary');
    const { data: histData, loading: hl } = useApi('/corporate/wallet/history?limit=50');
    const s = sumData?.summary || sumData || {};
    const txns = histData?.transactions || histData?.data || histData?.history || [];

    if (sl || hl) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Wallet Transaction History"/>
            <KpiRow items={[
                { label: 'Current Balance', value: `SAR ${Number(walletBalance || s.balance || 0).toLocaleString()}`, color: '#6D28D9' },
                { label: 'Total Credits',   value: `SAR ${Number(s.totalCredits  ?? s.total_credits  ?? 0).toLocaleString()}`, color: '#047857' },
                { label: 'Total Debits',    value: `SAR ${Number(s.totalDebits   ?? s.total_debits   ?? 0).toLocaleString()}`, color: '#DC2626' },
                { label: 'Transactions',    value: s.count ?? s.totalTransactions ?? txns.length },
            ]}/>
            {txns.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No transactions found</p> : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Type</th></tr></thead>
                    <tbody>
                        {txns.map((t, i) => {
                            const amount = parseFloat(t.amount || 0);
                            const isCredit = (t.type || '').toLowerCase() === 'credit' || amount > 0;
                            return (
                                <tr key={t.id || i}>
                                    <td>{t.date || t.createdAt ? new Date(t.date || t.createdAt).toLocaleDateString('en-SA') : '—'}</td>
                                    <td>{t.description || t.desc || t.note || '—'}</td>
                                    <td style={{ fontWeight: 700, color: isCredit ? '#047857' : '#DC2626' }}>{isCredit ? '+' : '-'}SAR {Math.abs(amount).toLocaleString()}</td>
                                    <td><span className={`ws-badge ${isCredit ? 'ws-badge--green' : 'ws-badge--red'}`}>{t.type || (isCredit ? 'credit' : 'debit')}</span></td>
                                </tr>
                            );
                        })}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── SAVINGS ─────────────────────────────────────────────────────────────────
function SavingsReportView() {
    const { data, loading } = useApi('/corporate/reports/savings');
    const d = data?.savings || data?.data || data || {};
    const byDept = d.byDepartment || d.departments || d.breakdown || [];

    if (loading) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Savings & Discount Report"/>
            <KpiRow items={[
                { label: 'Normal Market Cost',  value: `SAR ${Number(d.normalCost  ?? d.normalTotal   ?? d.marketCost   ?? 0).toLocaleString()}` },
                { label: 'Your Corporate Cost', value: `SAR ${Number(d.yourCost    ?? d.corporateCost ?? d.totalSpent   ?? 0).toLocaleString()}`, color: '#1D4ED8' },
                { label: 'Total Savings',       value: `SAR ${Number(d.savings     ?? d.totalSavings  ?? 0).toLocaleString()}`, color: '#047857' },
                { label: 'Savings %',           value: `${Number(d.savingsPercent ?? d.percentage    ?? 0).toFixed(1)}%`, color: '#047857' },
            ]}/>
            {byDept.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {byDept.map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                            <span style={{ fontWeight: 600 }}>{d.name || d.department || d.departmentName}</span>
                            <span style={{ fontWeight: 700, color: '#047857' }}>SAR {Number(d.saved || d.savings || d.amount || 0).toLocaleString()} saved</span>
                        </div>
                    ))}
                </div>
            )}
            {byDept.length === 0 && <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 16 }}>No breakdown data available</p>}
        </div>
    );
}

// ─── VEHICLES ────────────────────────────────────────────────────────────────
function VehicleUsageView() {
    const { data, loading } = useApi('/corporate/reports/vehicle-usage');
    const vehicles = data?.vehicles || data?.data || data?.report || [];

    if (loading) return <Spinner/>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Vehicle-wise Usage Report"/>
            {vehicles.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No vehicle data found</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {vehicles.map((v, i) => (
                        <div key={v.id || i} className="ws-section" style={{ marginBottom: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Car size={20} style={{ color: '#2563EB' }}/></div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 700, margin: 0 }}>{v.make || ''} {v.model || ''} — {v.plateNo || v.plate_no || v.plate || '—'}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                        {v.serviceCount ?? v.services ?? v.totalServices ?? 0} services · SAR {Number(v.totalSpend ?? v.totalSpent ?? v.spend ?? 0).toLocaleString()}
                                    </p>
                                </div>
                                {v.lastService && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Last: {v.lastService}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
function PaymentsReportView() {
    const [method, setMethod] = useState('All');
    const [status, setStatus] = useState('All');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        const qs = new URLSearchParams({ method, status });
        apiFetch(`/corporate/reports/payments?${qs}`)
            .then(d => setPayments(d.payments || d.data || d.history || []))
            .catch(() => setPayments([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeader title="Payment History"/>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="ws-field" style={{ margin: 0 }}><label>Method</label>
                    <select value={method} onChange={e => setMethod(e.target.value)} style={{ padding: '8px 10px' }}>
                        {['All','Wallet','Credit Card','Bank Transfer','Cash'].map(m => <option key={m}>{m}</option>)}
                    </select>
                </div>
                <div className="ws-field" style={{ margin: 0 }}><label>Status</label>
                    <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 10px' }}>
                        {['All','Paid','Success','Pending','Failed'].map(s => <option key={s}>{s}</option>)}
                    </select>
                </div>
                <button className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }} onClick={load}>Filter</button>
            </div>
            {loading ? <Spinner/> : payments.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>No payments found</p>
            ) : (
                <div className="ws-section" style={{ marginBottom: 0, padding: 0, overflow: 'auto' }}>
                    <table className="ws-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Invoice #</th><th>Status</th></tr></thead>
                    <tbody>
                        {payments.map((p, i) => (
                            <tr key={p.id || i}>
                                <td>{p.date || p.createdAt ? new Date(p.date || p.createdAt).toLocaleDateString('en-SA') : '—'}</td>
                                <td><strong>SAR {Number(p.amount || 0).toLocaleString()}</strong></td>
                                <td>{p.method || p.paymentMethod || '—'}</td>
                                <td style={{ color: '#2563EB' }}>{p.invoiceNumber || p.invoice || p.reference || '—'}</td>
                                <td><span className={`ws-badge ${['paid','success'].includes((p.status||'').toLowerCase()) ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{p.status || '—'}</span></td>
                            </tr>
                        ))}
                    </tbody></table>
                </div>
            )}
        </div>
    );
}

// ─── CUSTOM REPORT ───────────────────────────────────────────────────────────
function CustomReportSection() {
    const [type, setType] = useState(CUSTOM_REPORT_TYPES[0]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generate = async () => {
        if (!fromDate || !toDate) { setError('Please select both dates'); return; }
        setLoading(true); setError(''); setResult(null);
        try {
            const qs = new URLSearchParams({ fromDate, toDate, type });
            const data = await apiFetch(`/corporate/reports/custom?${qs}`);
            setResult(data);
        } catch (e) {
            setError(e.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ws-section" style={{ marginTop: 20, borderStyle: 'dashed' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={16}/> Generate Custom Report</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem', minWidth: 200 }}>
                    {CUSTOM_REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}/>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.8125rem' }}/>
                <button type="button" className="btn-portal" style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }} onClick={generate} disabled={loading}>
                    {loading && <Loader2 size={14} className="spin"/>}<BarChart3 size={14}/> Generate
                </button>
            </div>
            {error && <p style={{ color: '#DC2626', fontSize: '0.8125rem', margin: '8px 0 0 0' }}>{error}</p>}
            {result && (
                <div style={{ marginTop: 16, padding: 16, background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                    <p style={{ fontWeight: 600, margin: '0 0 8px 0', fontSize: '0.875rem' }}>Report Generated</p>
                    <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 200, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CorporateReports({ walletBalance = 0 }) {
    const [activeReport, setActiveReport] = useState('overview');
    const { data: summaryData, loading: summaryLoading } = useApi('/corporate/reports/summary');
    const s = summaryData?.summary || summaryData?.kpis || summaryData || {};

    if (activeReport !== 'overview') {
        return (
            <div>
                <button type="button" onClick={() => setActiveReport('overview')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '0.875rem', color: '#2563EB', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                    <ArrowLeft size={16}/> Back to Reports
                </button>
                {activeReport === 'billing'    && <BillingReportView/>}
                {activeReport === 'bookings'   && <BookingHistoryView/>}
                {activeReport === 'quotations' && <QuotationsReportView/>}
                {activeReport === 'wallet'     && <WalletReportView walletBalance={walletBalance}/>}
                {activeReport === 'savings'    && <SavingsReportView/>}
                {activeReport === 'vehicles'   && <VehicleUsageView/>}
                {activeReport === 'payments'   && <PaymentsReportView/>}
            </div>
        );
    }

    return (
        <div>
            <div className="ws-page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div><h2 className="ws-page-title">Reports & Analytics</h2><p className="ws-page-sub">Corporate account analytics</p></div>
            </div>

            {summaryLoading ? <Spinner/> : (
                <KpiRow items={[
                    { label: 'Total Spent (All time)', value: `SAR ${Number(s.totalSpent       ?? s.total_spent       ?? 0).toLocaleString()}`, color: '#2563EB' },
                    { label: 'This Month',             value: `SAR ${Number(s.thisMonthAmount  ?? s.thisMonth         ?? s.monthlyTotal ?? 0).toLocaleString()}` },
                    { label: 'Total Savings',          value: `SAR ${Number(s.totalSavings     ?? s.savings           ?? 0).toLocaleString()}`, color: '#047857' },
                    { label: 'Wallet Used',            value: `SAR ${Number(s.walletUsed       ?? s.wallet_used       ?? 0).toLocaleString()}`, color: '#7C3AED' },
                ]}/>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {REPORT_CATEGORIES.map(r => (
                    <button key={r.id} type="button" onClick={() => setActiveReport(r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><r.icon size={20} style={{ color: r.textColor }}/></div>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-dark)' }}>{r.label}</span>
                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }}/>
                    </button>
                ))}
            </div>

            <CustomReportSection/>
        </div>
    );
}
