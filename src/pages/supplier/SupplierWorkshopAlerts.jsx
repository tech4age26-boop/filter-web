import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getSupplierDashboard } from '../../services/supplierApi';
import { ShimmerListRows } from '../../components/supplier/Shimmer';

export default function SupplierWorkshopAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');
    const resolve = id => setAlerts(prev => prev.filter(a => a.id !== id));

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setApiError('');
            try {
                const data = await getSupplierDashboard();
                const list = Array.isArray(data?.criticalStockAlerts?.alerts)
                    ? data.criticalStockAlerts.alerts.map((a) => ({
                          id: `${a.supplierProductId}-${a.supplierLocationId}`,
                          product: a.productName,
                          branch: a.locationName,
                          current: a.current,
                          threshold: a.critical,
                          severity: 'critical',
                      }))
                    : [];
                if (!cancelled) setAlerts(list);
            } catch (err) {
                console.error('Supplier alerts API failed:', err);
                if (!cancelled) {
                    setAlerts([]);
                    setApiError(err?.message || 'Failed to load alerts');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Workshop Alerts</h2><p className="ws-page-sub">Low stock alerts from workshop branches</p></div></div>
            <div style={{padding:14,background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:12,marginBottom:20,fontSize:'0.875rem',color:'#92400E'}}>
                <strong>Workshop Stock Alerts</strong> — when any workshop branch reaches critical stock level, a notification appears here. Issue a <strong>Sales Invoice</strong> to send them stock.
            </div>
            {apiError ? (
                <div className="ws-section" style={{ marginBottom: 16, padding: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#B91C1C', fontSize: '0.875rem' }}>
                    <strong>Could not load alerts:</strong> {apiError}
                </div>
            ) : null}
            {loading ? (
                <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                    <ShimmerListRows rows={6} />
                </div>
            ) : alerts.length === 0 ? <div className="ws-empty"><AlertTriangle size={56} className="ws-empty-icon"/><p className="ws-empty-text">No active alerts</p></div>
            : alerts.map(a => (
                <div key={a.id} className="ws-approval-card" style={{borderLeft:`4px solid ${a.severity==='critical'?'#DC2626':'#F59E0B'}`}}>
                    <div className="ws-approval-top">
                        <div><p className="ws-approval-title">{a.product}</p><p className="ws-approval-meta">Branch: {a.branch} · Current: {a.current} · Threshold: {a.threshold}</p></div>
                        <span className={`ws-badge ${a.severity==='critical'?'ws-badge--red':'ws-badge--yellow'}`}>{a.severity}</span>
                    </div>
                    <div className="ws-approval-actions">
                        <button className="ws-btn-approve" onClick={() => resolve(a.id)}>Mark Restocked</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
