import { useState, useEffect } from 'react';
import { ShoppingCart, Search, CheckCircle2, XCircle, Clock, Loader } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import { getSalesOrders } from '../../services/superAdminApi';

const StatusBadge = ({ status }) => {
    const variants = {
        Cancelled: { class: 'so-status-cancelled', icon: XCircle },
        Pending: { class: 'so-status-pending', icon: Clock },
        Completed: { class: 'so-status-completed', icon: CheckCircle2 },
    };
    const config = variants[status] || variants.Pending;
    const Icon = config.icon;

    return (
        <span className={`so-status-badge ${config.class}`}>
            <Icon size={12} />
            {status}
        </span>
    );
};

function normalizeOrder(o) {
    return {
        id: o.id ?? o._id ?? o.orderNo ?? o.invoiceNo ?? '—',
        date: o.createdAt ?? o.date ?? '—',
        branch: o.branchName ?? o.branch?.name ?? o.branchId ?? '—',
        customer: o.customerName ?? o.customer?.name ?? 'Walk-in',
        mobile: o.customerMobile ?? o.customer?.mobile ?? '—',
        vehicle: o.vehiclePlate ?? o.vehicle?.plate ?? '—',
        technician: o.technicianName ?? o.technician?.name ?? '—',
        total: parseFloat(o.totalAmount ?? o.total ?? 0),
        status: o.status ?? 'Pending',
    };
}

export default function SalesOrders() {
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSalesOrders({ limit: '100', offset: '0' })
            .then((d) => setOrders((Array.isArray(d) ? d : (d?.salesOrders ?? [])).map(normalizeOrder)))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleStatusChange = (id, newStatus) => {
        setOrders(prev => prev.map(order =>
            order.id === id ? { ...order, status: newStatus } : order
        ));
    };

    const kpis = [
        { label: 'Total Orders', value: orders.length.toString() },
        { label: 'Completed', value: orders.filter(o => o.status === 'Completed').length.toString() },
        { label: 'Pending', value: orders.filter(o => o.status === 'Pending').length.toString() },
        { label: 'Revenue', value: `SAR ${orders.reduce((acc, o) => acc + (o.status === 'Completed' ? o.total : 0), 0).toFixed(0)}`, className: 'revenue' },
    ];

    return (
        <div className="so-container">
            <header className="so-header">
                <div>
                    <h2 className="so-title"><ShoppingCart size={20} color="#F59E0B" /> All Sales Orders</h2>
                    <p className="so-sub">View POS sales across all branches</p>
                </div>
                <div className="so-order-count-badge">{orders.length} orders</div>
            </header>

            {/* KPI Cards */}
            <div className="so-kpi-grid">
                {kpis.map(k => (
                    <div key={k.label} className="so-kpi-card">
                        <p className="so-kpi-label">{k.label}</p>
                        <h3 className={`so-kpi-value ${k.className || ''}`}>{k.value}</h3>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="so-filter-bar">
                <div className="so-search-wrapper">
                    <Search className="so-search-icon" size={16} />
                    <input 
                        type="text" 
                        className="so-search-input" 
                        placeholder="Search Invoice, customer, plate..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="so-select">
                    <option>All Status</option>
                    <option>Completed</option>
                    <option>Pending</option>
                    <option>Cancelled</option>
                </select>
                <select className="so-select">
                    <option>All Branches</option>
                    <option>69c157b2</option>
                    <option>69a24345</option>
                </select>
                <div className="so-date-group">
                    <input type="date" className="so-date-input" placeholder="mm/dd/yyyy" />
                    <input type="date" className="so-date-input" placeholder="mm/dd/yyyy" />
                </div>
            </div>

            {/* Orders Table */}
            <div className="so-table-wrapper">
                <table className="so-table">
                    <thead>
                        <tr>
                            <th>Invoice No</th>
                            <th>Date</th>
                            <th>Branch</th>
                            <th>Customer</th>
                            <th>Vehicle</th>
                            <th>Technician</th>
                            <th>Total (SAR)</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : orders.map((order) => (
                            <tr key={order.id}>
                                <td><a href="#" className="so-inv-link">{order.id}</a></td>
                                <td>{order.date}</td>
                                <td className="so-text-dim">{order.branch}</td>
                                <td>
                                    <div className="so-customer-info">
                                        <strong>{order.customer}</strong>
                                        <span className="so-customer-mobile">{order.mobile}</span>
                                    </div>
                                </td>
                                <td>{order.vehicle}</td>
                                <td>{order.technician}</td>
                                <td style={{ fontWeight: 600 }}>{order.total.toFixed(2)}</td>
                                <td><StatusBadge status={order.status} /></td>
                                <td>
                                    {order.status === 'Pending' && (
                                        <button 
                                            className="so-action-btn"
                                            onClick={() => handleStatusChange(order.id, 'Completed')}
                                        >
                                            — Completed
                                        </button>
                                    )}
                                    {order.status === 'Completed' && (
                                        <button 
                                            className="so-action-btn"
                                            onClick={() => handleStatusChange(order.id, 'Cancelled')}
                                        >
                                            — Cancelled
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
