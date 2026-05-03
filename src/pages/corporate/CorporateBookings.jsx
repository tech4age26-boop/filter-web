import { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Eye, Loader2, Car, MapPin, Wrench, Clock, FileText, Package } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { fetchCorporateBookings, fetchCorporateBookingById } from '../../services/corporateBookingsApi';
import Modal from '../../components/Modal';

/** Flatten `{ booking: { ... } }` so services/products sit on the object we read. */
function normalizeBookingDetailPayload(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    const inner = raw.booking || raw.data?.booking;
    if (inner && typeof inner === 'object') {
        return { ...raw, ...inner };
    }
    return raw;
}

const STATUS_STYLES = {
    pending: { bg: '#FEF3C7', color: '#B45309' },
    submitted: { bg: '#DBEAFE', color: '#1D4ED8' },
    confirmed: { bg: '#DBEAFE', color: '#1D4ED8' },
    in_progress: { bg: '#EFF6FF', color: '#1D4ED8' },
    completed: { bg: '#D1FAE5', color: '#047857' },
    cancelled: { bg: '#FEE2E2', color: '#B91C1C' },
};

/** Service lines saved with the corporate booking (several API shapes). */
function pickBookingServiceLines(d) {
    if (!d || typeof d !== 'object') return [];
    const keys = [
        'bookingServices',
        'booking_services',
        'serviceLines',
        'service_lines',
        'catalogServices',
        'catalog_services',
        'selectedServices',
        'selected_services',
    ];
    for (const k of keys) {
        const v = d[k];
        if (Array.isArray(v) && v.length) return v;
    }
    if (Array.isArray(d.services) && d.services.length) {
        const first = d.services[0];
        if (first && (first.serviceId != null || first.service_id != null || first.departmentId != null || first.department_id != null)) {
            return d.services;
        }
    }
    return [];
}

/** Product lines with qty (several API shapes). */
function pickBookingProductLines(d) {
    if (!d || typeof d !== 'object') return [];
    const keys = [
        'bookingProducts',
        'booking_products',
        'productLines',
        'product_lines',
        'catalogProducts',
        'catalog_products',
        'selectedProducts',
        'selected_products',
    ];
    for (const k of keys) {
        const v = d[k];
        if (Array.isArray(v) && v.length) return v;
    }
    if (Array.isArray(d.products) && d.products.length) {
        const first = d.products[0];
        if (first && (first.productId != null || first.product_id != null || first.qty != null || first.quantity != null)) {
            return d.products;
        }
    }
    return [];
}

function serviceLineLabel(s) {
    const name = s.name || s.serviceName || s.service_name || s.title || '—';
    const dept = s.departmentName || s.department_name || s.department?.name || '';
    const sku = s.sku ? ` · ${s.sku}` : '';
    return dept ? `${name} (${dept})${sku}` : `${name}${sku}`;
}

function productLineLabel(p) {
    const name = p.name || p.productName || p.product_name || p.title || '—';
    const qty = p.qty ?? p.quantity ?? p.qtyOrdered ?? 1;
    const dept = p.departmentName || p.department_name || p.department?.name || '';
    const sku = p.sku ? ` · ${p.sku}` : '';
    const tail = dept ? ` — ${dept}` : '';
    return `${name} ×${qty}${tail}${sku}`;
}

/** When API only returns combined sales lines, split by item type / ids. */
function splitSalesOrderIntoServiceProduct(items) {
    if (!Array.isArray(items) || !items.length) return { services: [], products: [] };
    const services = [];
    const products = [];
    for (const line of items) {
        const t = String(line.itemType || line.item_type || line.type || line.kind || '').toLowerCase();
        const hasPrd = line.productId != null || line.product_id != null;
        const hasSvc = line.serviceId != null || line.service_id != null;
        if (hasPrd || t === 'product') products.push(line);
        else if (hasSvc || t === 'service') services.push(line);
        else products.push(line);
    }
    return { services, products };
}

function OrderDetailModal({ orderId, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setError('');
        (async () => {
            try {
                const d = await fetchCorporateBookingById(orderId, { signal: ac.signal });
                if (!ac.signal.aborted) setDetail(normalizeBookingDetailPayload(d));
            } catch {
                try {
                    const data = await apiFetch(`/corporate/orders/${orderId}`, { signal: ac.signal });
                    if (!ac.signal.aborted) setDetail(normalizeBookingDetailPayload(data.order || data.data || data));
                } catch (err) {
                    if (!ac.signal.aborted) setError(err.message || 'Failed to load');
                }
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [orderId]);

    const status = detail?.status || detail?.orderStatus || detail?.order_status || 'pending';
    const st = STATUS_STYLES[status] || STATUS_STYLES.pending;

    const Row = ({ icon: Icon, label, value }) =>
        value ? (
            <div
                style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-border-light)',
                }}
            >
                <Icon size={15} style={{ color: 'var(--color-text-muted)', marginTop: 2, flexShrink: 0 }} />
                <div>
                    <p
                        style={{
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            margin: 0,
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                        }}
                    >
                        {label}
                    </p>
                    <p style={{ fontSize: '0.875rem', margin: '2px 0 0 0', fontWeight: 600 }}>{value}</p>
                </div>
            </div>
        ) : null;

    const salesItems =
        detail?.salesOrder?.items ||
        detail?.sales_order?.items ||
        detail?.salesOrder?.lines ||
        detail?.lineItems ||
        [];

    const explicitServices = detail ? pickBookingServiceLines(detail) : [];
    const explicitProducts = detail ? pickBookingProductLines(detail) : [];
    const splitFromSales = splitSalesOrderIntoServiceProduct(salesItems);
    const displayServices = explicitServices.length > 0 ? explicitServices : splitFromSales.services;
    const displayProducts = explicitProducts.length > 0 ? explicitProducts : splitFromSales.products;
    const showGenericSalesLines =
        displayServices.length === 0 &&
        displayProducts.length === 0 &&
        Array.isArray(salesItems) &&
        salesItems.length > 0;

    return (
        <Modal
            title={`Booking #${detail?.bookingCode || detail?.booking_code || orderId}`}
            onClose={onClose}
            width="520px"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-portal-outline" onClick={onClose}>
                        Close
                    </button>
                </div>
            }
        >
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 className="spin" size={32} style={{ color: 'var(--color-primary)' }} />
                </div>
            )}
            {error && (
                <p style={{ color: '#DC2626', padding: 16, margin: 0 }}>
                    {error}
                </p>
            )}
            {detail && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: '1.0625rem', margin: 0 }}>
                                {detail.bookingCode || detail.booking_code || detail.orderNumber || detail.order_number || `#${detail.id}`}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                {detail.createdAt || detail.created_at
                                    ? new Date(detail.createdAt || detail.created_at).toLocaleString('en-SA')
                                    : '—'}
                            </p>
                        </div>
                        <span
                            style={{
                                background: st.bg,
                                color: st.color,
                                padding: '5px 12px',
                                borderRadius: 8,
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                            }}
                        >
                            {String(status).replace(/_/g, ' ')}
                        </span>
                    </div>

                    <Row
                        icon={Car}
                        label="Vehicle"
                        value={
                            detail.vehicle
                                ? `${detail.vehicle.plateNo || detail.vehicle.plate_no || ''} — ${detail.vehicle.make || ''} ${detail.vehicle.model || ''}`.trim()
                                : detail.vehiclePlate || detail.vehicle_plate
                        }
                    />
                    <Row icon={MapPin} label="Branch" value={detail.branch?.name || detail.branchName || detail.branch_name} />
                    <Row
                        icon={Wrench}
                        label="Workshop"
                        value={detail.workshop?.name || detail.workshopName || detail.workshop_name}
                    />
                    <Row
                        icon={Wrench}
                        label="Departments"
                        value={
                            Array.isArray(detail.departments)
                                ? detail.departments.map((d) => d.name || d.id).join(', ')
                                : typeof detail.departmentNames === 'string'
                                  ? detail.departmentNames
                                  : Array.isArray(detail.departmentNames)
                                    ? detail.departmentNames.join(', ')
                                    : ''
                        }
                    />
                    <Row icon={Clock} label="Booked For" value={detail.bookedFor || detail.booked_for} />
                    <Row icon={FileText} label="Notes" value={detail.notes} />
                    {detail.approvedBy?.name || detail.approved_by ? (
                        <Row
                            icon={FileText}
                            label="Approved by"
                            value={detail.approvedBy?.name || detail.approved_by?.name || String(detail.approvedBy || detail.approved_by)}
                        />
                    ) : null}

                    {(displayServices.length > 0 || displayProducts.length > 0) && (
                        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border-light)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>
                                SERVICES &amp; PRODUCTS (BOOKED)
                            </p>
                            {displayServices.length > 0 && (
                                <div style={{ marginBottom: displayProducts.length ? 12 : 0 }}>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Wrench size={14} /> Services
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                        {displayServices.map((s, i) => (
                                            <li key={s.id || s.serviceId || s.service_id || i} style={{ marginBottom: 4 }}>
                                                {serviceLineLabel(s)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {displayProducts.length > 0 && (
                                <div>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B7280', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Package size={14} /> Products
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                        {displayProducts.map((p, i) => (
                                            <li key={p.id || p.productId || p.product_id || i} style={{ marginBottom: 4 }}>
                                                {productLineLabel(p)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {showGenericSalesLines && (
                        <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border-light)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>
                                ORDER LINES
                            </p>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem' }}>
                                {salesItems.map((line, i) => (
                                    <li key={line.id || i} style={{ marginBottom: 4 }}>
                                        {line.name || line.productName || line.serviceName || line.description || '—'}
                                        {line.qty != null ? ` ×${line.qty}` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div
                        style={{
                            marginTop: 14,
                            padding: 14,
                            background: 'var(--color-bg-muted)',
                            borderRadius: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Amount</span>
                        <span style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--color-text-dark)' }}>
                            {(detail.amount ?? detail.grandTotal ?? detail.grand_total ?? detail.totalAmount ?? detail.total_amount ?? detail.total) != null
                                ? `SAR ${Number(detail.amount ?? detail.grandTotal ?? detail.grand_total ?? detail.totalAmount ?? detail.total_amount ?? detail.total).toFixed(2)}`
                                : 'Amount Pending'}
                        </span>
                    </div>

                    {detail.paymentMethod && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '8px 0 0 0' }}>
                            Payment: {detail.paymentMethod}
                            {detail.payFromWallet ? ' (Wallet)' : ''}
                            {detail.partialWalletPayment ? ' · partial wallet' : ''}
                        </p>
                    )}
                </div>
            )}
        </Modal>
    );
}

export default function CorporateBookings({ setBookingOpen }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewId, setViewId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        fetchCorporateBookings({ limit: 50, offset: 0 })
            .then(({ bookings }) => setOrders(bookings))
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const cancelOrder = async (id) => {
        try {
            try {
                await apiFetch(`/corporate/bookings/${id}/cancel`, { method: 'POST' });
            } catch {
                await apiFetch(`/corporate/orders/${id}/cancel`, { method: 'POST' });
            }
            setOrders((prev) => prev.map((o) => (String(o.id) === String(id) ? { ...o, status: 'cancelled' } : o)));
        } catch {
            /* ignore */
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">My Bookings</h2>
                    <p className="ws-page-sub">Corporate service bookings</p>
                </div>
                <button
                    className="btn-portal"
                    style={{ background: '#059669', color: '#fff', border: 'none' }}
                    onClick={() => setBookingOpen(true)}
                >
                    <Plus size={15} /> New Booking
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : orders.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Calendar size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No bookings yet</p>
                    <button
                        className="btn-portal"
                        style={{ marginTop: 16, background: '#059669', color: '#fff', border: 'none' }}
                        onClick={() => setBookingOpen(true)}
                    >
                        Book a Service
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {orders.map((o) => {
                        const status = o.status || o.orderStatus || o.order_status || 'pending';
                        const st = STATUS_STYLES[status] || STATUS_STYLES.pending;
                        const canCancel = status === 'pending' || status === 'confirmed';
                        return (
                            <div key={o.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>
                                            {o.bookingCode || o.booking_code || o.orderNumber || o.order_number || `#${o.id}`}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {o.vehicle ? `${o.vehicle.plateNo} · ${o.vehicle.make} ${o.vehicle.model}` : '—'} ·{' '}
                                            {o.branchName || o.branch?.name || '—'}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {o.bookedFor || o.booked_for ? new Date(o.bookedFor || o.booked_for).toLocaleString('en-SA') : '—'}
                                        </p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '6px 0 0 0', color: 'var(--color-text-dark)' }}>
                                            {(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total) != null
                                                ? `SAR ${Number(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total).toFixed(2)}`
                                                : 'Amount Pending'}
                                        </p>
                                    </div>
                                    <span
                                        style={{
                                            background: st.bg,
                                            color: st.color,
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {String(status).replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: 6,
                                            border: '1px solid var(--color-border)',
                                            background: '#fff',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                        }}
                                        onClick={() => setViewId(o.id)}
                                    >
                                        <Eye size={14} /> View Details
                                    </button>
                                    {canCancel && (
                                        <button
                                            type="button"
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #FECACA',
                                                background: '#FEF2F2',
                                                color: '#DC2626',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => cancelOrder(o.id)}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {viewId && <OrderDetailModal orderId={viewId} onClose={() => setViewId(null)} />}
        </div>
    );
}
