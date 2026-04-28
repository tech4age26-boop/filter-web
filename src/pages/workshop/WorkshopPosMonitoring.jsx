import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function WorkshopPosMonitoring() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const loadPosMonitoring = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch('/workshop-staff/pos-monitoring');
            if (!response?.success) {
                throw new Error('Invalid POS monitoring response.');
            }
            setData(response);
        } catch (err) {
            setError(err.message || 'Failed to load POS monitoring.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPosMonitoring();
    }, [loadPosMonitoring]);

    const liveCounters = data?.liveCounters || [];
    const closingReports = data?.closingReports || [];

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">POS Monitoring</h2>
                    <p className="ws-page-sub">Live counters and recent closing reports</p>
                </div>
                <button className="btn-portal" onClick={loadPosMonitoring} disabled={isLoading}>
                    <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div><p className="ws-kpi-label">Live Counters</p><p className="ws-kpi-value">{toNumber(data?.liveCountersCount)}</p></div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">POS</div>
                </div>
                <div className="ws-kpi-card">
                    <div><p className="ws-kpi-label">Open Orders</p><p className="ws-kpi-value">{toNumber(data?.openOrdersCount)}</p></div>
                    <div className="ws-kpi-icon ws-kpi-icon--orange">ORD</div>
                </div>
                <div className="ws-kpi-card">
                    <div><p className="ws-kpi-label">Today Sales</p><p className="ws-kpi-value">SAR {toNumber(data?.todaySales).toLocaleString()}</p></div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">SAR</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <p style={{ padding: '16px 16px 0', fontWeight: 700, margin: 0 }}>Live Counters</p>
                <div style={{ overflowX: 'auto', padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Cashier</th>
                                <th>Branch</th>
                                <th>Status</th>
                                <th>Shift Sales</th>
                                <th>Open Orders</th>
                                <th>Elapsed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {liveCounters.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No live counters</td></tr>
                            ) : liveCounters.map((counter) => (
                                <tr key={counter.posSessionId}>
                                    <td>{counter.cashierName || '—'}</td>
                                    <td>{counter.branchName || '—'}</td>
                                    <td><span className={`ws-badge ${String(counter.shiftStatus).toUpperCase() === 'OPEN' ? 'ws-badge--green' : 'ws-badge--gray'}`}>{counter.shiftStatus || '—'}</span></td>
                                    <td>SAR {toNumber(counter.shiftSales).toLocaleString()}</td>
                                    <td>{toNumber(counter.shiftOpenOrders)}</td>
                                    <td>{counter.shiftElapsedTime || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <p style={{ padding: '16px 16px 0', fontWeight: 700, margin: 0 }}>Recent Closing Reports</p>
                <div style={{ overflowX: 'auto', padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Cashier</th>
                                <th>Branch</th>
                                <th>Status</th>
                                <th>Closed At</th>
                                <th>System Total Sales</th>
                                <th>Physical Total</th>
                                <th>Total Difference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closingReports.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No closing reports</td></tr>
                            ) : closingReports.map((report) => (
                                <tr key={report.posSessionId}>
                                    <td>{report.cashierName || '—'}</td>
                                    <td>{report.branchName || '—'}</td>
                                    <td><span className={`ws-badge ${String(report.shiftStatus).toUpperCase() === 'CLOSED' ? 'ws-badge--blue' : 'ws-badge--gray'}`}>{report.shiftStatus || '—'}</span></td>
                                    <td>{report.closedAt ? new Date(report.closedAt).toLocaleString() : '—'}</td>
                                    <td>SAR {toNumber(report.systemTotalSales).toLocaleString()}</td>
                                    <td>SAR {toNumber(report.physicalTotal).toLocaleString()}</td>
                                    <td>SAR {toNumber(report.reconciliationTotalDifference).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
