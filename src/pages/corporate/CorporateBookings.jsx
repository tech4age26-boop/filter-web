import { useState, useEffect } from 'react';
import { Calendar, Plus, Eye, Loader2, X, Car, MapPin, Wrench, Clock, FileText } from 'lucide-react';
import { apiFetch } from '../../services/api';
import Modal from '../../components/Modal';

const STATUS_STYLES = {
    pending:     { bg: '#FEF3C7', color: '#B45309' },
    submitted:   { bg: '#DBEAFE', color: '#1D4ED8' },
    confirmed:   { bg: '#DBEAFE', color: '#1D4ED8' },
    in_progress: { bg: '#EFF6FF', color: '#1D4ED8' },
    completed:   { bg: '#D1FAE5', color: '#047857' },
    cancelled:   { bg: '#FEE2E2', color: '#B91C1C' },
};

function OrderDetailModal({ orderId, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        apiFetch(`/corporate/orders/${orderId}`)
            .then(data => setDetail(data.order || data.data || data))
            .catch(err => setError(err.message || 'Failed to load'))
            .finally(() => setLoading(false));
    }, [orderId]);

    const status = detail?.status || detail?.orderStatus || detail?.order_status || 'pending';
    const st = STATUS_STYLES[status] || STATUS_STYLES.pending;

    const Row = ({ icon: Icon, label, value }) => value ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--color-border-light)' }}>
            <Icon size={15} style={{ color: 'var(--color-text-muted)', marginTop: 2, flexShrink: 0 }}/>
            <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</p>
                <p style={{ fontSize: '0.875rem', margin: '2px 0 0 0', fontWeight: 600 }}>{value}</p>
            </div>
        </div>
    ) : null;

    return (
        <Modal
            title={`Booking #${orderId}`}
            onClose={onClose}
            width="460px"
            footer={<div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn-portal-outline" onClick={onClose}>Close</button></div>}
        >
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 className="spin" size={32} style={{ color: 'var(--color-primary)' }}/>
                </div>
            )}
            {error && <p style={{ color: '#DC2626', padding: 16, margin: 0 }}>{error}</p>}
            {detail && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: '1.0625rem', margin: 0 }}>#{detail.orderNumber || detail.order_number || detail.id}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                {detail.createdAt || detail.created_at ? new Date(detail.createdAt || detail.created_at).toLocaleString('en-SA') : '—'}
                            </p>
                        </div>
                        <span style={{ background: st.bg, color: st.color, padding: '5px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {status.replace(/_/g, ' ')}
                        </span>
                    </div>

                    <Row icon={Car}      label="Vehicle"   value={detail.vehicle ? `${detail.vehicle.plateNo || detail.vehicle.plate_no || ''} — ${detail.vehicle.make || ''} ${detail.vehicle.model || ''}`.trim() : detail.vehiclePlate || detail.vehicle_plate} />
                    <Row icon={MapPin}   label="Branch"    value={detail.branch?.name || detail.branchName || detail.branch_name} />
                    <Row icon={Clock}    label="Booked For" value={detail.bookedFor || detail.booked_for} />
                    <Row icon={Wrench}   label="Services"  value={
                        detail.departments?.map(d => d.name).join(', ') ||
                        detail.services?.map(s => s.name).join(', ') ||
                        detail.departmentNames ||
                        detail.service
                    } />
                    <Row icon={FileText} label="Notes"     value={detail.notes} />

                    <div style={{ marginTop: 14, padding: 14, background: 'var(--color-bg-muted)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

    useEffect(() => {
        apiFetch('/corporate/orders')
            .then(data => setOrders(data.orders || data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const cancelOrder = async (id) => {
        try {
            await apiFetch(`/corporate/orders/${id}/cancel`, { method: 'POST' });
            setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o));
        } catch {}
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">My Bookings</h2><p className="ws-page-sub">Corporate service bookings schedule</p></div>
                <button className="btn-portal" style={{ background: '#059669', color: '#fff', border: 'none' }} onClick={() => setBookingOpen(true)}><Plus size={15}/> New Booking</button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: 'var(--color-primary)' }}/>
                </div>
            ) : orders.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Calendar size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }}/>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No bookings yet</p>
                    <button className="btn-portal" style={{ marginTop: 16, background: '#059669', color: '#fff', border: 'none' }} onClick={() => setBookingOpen(true)}>Book a Service</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {orders.map(o => {
                        const status = o.status || o.orderStatus || o.order_status || 'pending';
                        const st = STATUS_STYLES[status] || STATUS_STYLES.pending;
                        const canCancel = status === 'pending' || status === 'confirmed';
                        return (
                            <div key={o.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>
                                            {o.bookingCode || o.orderNumber || o.order_number || `#${o.id}`}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {o.vehicle ? `${o.vehicle.plateNo} · ${o.vehicle.make} ${o.vehicle.model}` : '—'} · {o.branchName || o.branch?.name || '—'}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {o.bookedFor ? new Date(o.bookedFor).toLocaleString('en-SA') : '—'}
                                        </p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '6px 0 0 0', color: 'var(--color-text-dark)' }}>
                                            {(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total) != null
                                                ? `SAR ${Number(o.amount ?? o.grandTotal ?? o.grand_total ?? o.totalAmount ?? o.total_amount ?? o.total).toFixed(2)}`
                                                : 'Amount Pending'}
                                        </p>
                                    </div>
                                    <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                                        {status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                    <button type="button"
                                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                                        onClick={() => setViewId(o.id)}>
                                        <Eye size={14}/> View Details
                                    </button>
                                    {canCancel && (
                                        <button type="button"
                                            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => cancelOrder(o.id)}>
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {viewId && <OrderDetailModal orderId={viewId} onClose={() => setViewId(null)}/>}
        </div>
    );
}
