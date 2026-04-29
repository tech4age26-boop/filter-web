import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function WorkshopPosMonitoring({ selectedBranchId = 'all', branches = [] }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const loadPosMonitoring = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch(`/workshop-staff/pos-monitoring${qs(branchScopeParams(selectedBranchId))}`);
            if (!response?.success) {
                throw new Error('Invalid POS monitoring response.');
            }
            setData(response);
        } catch (err) {
            setError(err.message || 'Failed to load POS monitoring.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const { liveCountersScoped, closingReportsScoped } = useMemo(() => {
        const rawLive = data?.liveCounters || [];
        const rawClose = data?.closingReports || [];
        if (!selectedBranchId || selectedBranchId === 'all') {
            return { liveCountersScoped: rawLive, closingReportsScoped: rawClose };
        }
        const bn = branches.find((b) => String(b.id) === String(selectedBranchId))?.name || '';
        const match = (row) => {
            const rid = row.branchId ?? row.branch_id;
            if (rid != null && String(rid) === String(selectedBranchId)) return true;
            if (bn && String(row.branchName ?? row.branch_name ?? '').trim() === bn) return true;
            return false;
        };
        return {
            liveCountersScoped: rawLive.filter(match),
            closingReportsScoped: rawClose.filter(match),
        };
    }, [data, selectedBranchId, branches]);

    useEffect(() => {
        loadPosMonitoring();
    }, [loadPosMonitoring]);

    const isAllBranches = !selectedBranchId || selectedBranchId === 'all';

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">POS Monitoring</h2>
                    <p className="ws-page-sub">
                        Live counters and recent closing reports · <strong>{branchLabel}</strong>
                    </p>
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
                    <div><p className="ws-kpi-label">Live Counters</p><p className="ws-kpi-value">{isAllBranches ? toNumber(data?.liveCountersCount) : liveCountersScoped.length}</p></div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">POS</div>
                </div>
                <div className="ws-kpi-card">
                    <div><p className="ws-kpi-label">Open Orders</p><p className="ws-kpi-value">{isAllBranches ? toNumber(data?.openOrdersCount) : liveCountersScoped.reduce((s, c) => s + toNumber(c.shiftOpenOrders), 0)}</p></div>
                    <div className="ws-kpi-icon ws-kpi-icon--orange">ORD</div>
                </div>
                <div className="ws-kpi-card">
                    <div><p className="ws-kpi-label">Today Sales</p><p className="ws-kpi-value">SAR {(isAllBranches ? toNumber(data?.todaySales) : liveCountersScoped.reduce((s, c) => s + toNumber(c.shiftSales), 0)).toLocaleString()}</p></div>
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
                            {liveCountersScoped.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No live counters</td></tr>
                            ) : liveCountersScoped.map((counter) => (
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
                            {closingReportsScoped.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No closing reports</td></tr>
                            ) : closingReportsScoped.map((report) => (
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
