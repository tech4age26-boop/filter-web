import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, CheckCircle, X, Eye, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';

export default function WorkshopApprovals() {
    const [approvals, setApprovals] = useState([]);
    const [filterType, setFilterType] = useState('all');
    const [queueFilter, setQueueFilter] = useState('all');
    const [rejectDialog, setRejectDialog] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [viewDialog, setViewDialog] = useState(null);
    const [currency, setCurrency] = useState('SAR');
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const loadApprovals = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const response = await apiFetch(`/workshop-staff/petty-cash/requests?limit=100&offset=0&queue=${encodeURIComponent(queueFilter)}`);
            if (!(response?.success && Array.isArray(response.requests))) {
                throw new Error('Invalid approvals response.');
            }
            setApprovals(response.requests);
            setCurrency(response.currency || 'SAR');
        } catch (error) {
            setLoadError(error.message || 'Failed to load approvals queue.');
        } finally {
            setIsLoading(false);
        }
    }, [queueFilter]);

    useEffect(() => {
        loadApprovals();
    }, [loadApprovals]);

    const typeOptions = useMemo(() => {
        return Array.from(new Set(approvals.map((a) => a.kind).filter(Boolean)));
    }, [approvals]);

    const filtered = approvals.filter((a) => filterType === 'all' || a.kind === filterType);
    const typeColors = { expense: 'ws-badge--yellow', fund_request: 'ws-badge--blue', payment: 'ws-badge--green', advance: 'ws-badge--purple', purchase: 'ws-badge--purple' };
    const statusColors = { pending: 'ws-badge--yellow', approved: 'ws-badge--green', rejected: 'ws-badge--red' };

    const handleApprove = async (id) => {
        setActionLoadingId(`approve-${id}`);
        setLoadError('');
        try {
            await apiFetch(`/workshop-staff/petty-cash/${id}/approve`, { method: 'POST' });
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setLoadError(error.message || 'Failed to approve request.');
        } finally {
            setActionLoadingId(null);
        }
    };
    const handleReject = async () => {
        if (!rejectReason.trim() || !rejectDialog) return;
        const id = rejectDialog.id;
        setActionLoadingId(`reject-${id}`);
        setLoadError('');
        try {
            await apiFetch(`/workshop-staff/petty-cash/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
            });
            setRejectDialog(null);
            setRejectReason('');
            await loadApprovals();
            window.dispatchEvent(new Event('workshop-approvals-updated'));
        } catch (error) {
            setLoadError(error.message || 'Failed to reject request.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
    const formatDateFull = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Approvals Queue</h2><p className="ws-page-sub">Review and act on pending requests</p></div>
            </div>
            {loadError && (
                <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                    {loadError}
                </div>
            )}
            <div className="ws-section" style={{ marginBottom: 16 }}>
                <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={queueFilter} onChange={e => setQueueFilter(e.target.value)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem', minWidth: 160 }}>
                        <option value="all">All Queue</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem', minWidth: 160 }}>
                        <option value="all">All Types</option>
                        {typeOptions.map(t => (
                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                        ))}
                    </select>
                    <button className="btn-portal" onClick={loadApprovals} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        <Clock size={16}/>{filtered.length} requests
                    </div>
                </div>
            </div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr><th>Type</th><th>Amount</th><th>Requested By</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>{isLoading ? 'Loading approvals...' : 'No approvals found'}</td></tr>
                        ) : filtered.map(a => (
                            <tr key={a.id}>
                                <td><span className={`ws-badge ${typeColors[a.kind] || 'ws-badge--gray'}`}>{a.kind?.replace('_', ' ')}</span></td>
                                <td><strong>{currency} {(a.amount || 0).toLocaleString()}</strong></td>
                                <td>{a.cashier?.name || a.employee?.name || '—'}</td>
                                <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{formatDate(a.requestedAt)}</td>
                                <td><span className={`ws-badge ${statusColors[a.status] || 'ws-badge--gray'}`}>{a.status || 'unknown'}</span></td>
                                <td>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                            type="button"
                                            onClick={() => handleApprove(a.id)}
                                            disabled={a.status !== 'pending' || actionLoadingId !== null}
                                            style={{ padding: 6, borderRadius: 6, border: 'none', background: '#D1FAE5', color: '#059669', cursor: a.status === 'pending' && actionLoadingId === null ? 'pointer' : 'not-allowed', opacity: a.status === 'pending' && actionLoadingId === null ? 1 : 0.5 }}
                                        >
                                            <CheckCircle size={14}/>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setRejectDialog(a); setRejectReason(''); }}
                                            disabled={a.status !== 'pending' || actionLoadingId !== null}
                                            style={{ padding: 6, borderRadius: 6, border: 'none', background: '#FEE2E2', color: '#DC2626', cursor: a.status === 'pending' && actionLoadingId === null ? 'pointer' : 'not-allowed', opacity: a.status === 'pending' && actionLoadingId === null ? 1 : 0.5 }}
                                        >
                                            <X size={14}/>
                                        </button>
                                        <button type="button" onClick={() => setViewDialog(a)} style={{ padding: 6, borderRadius: 6, border: 'none', background: '#F3F4F6', color: '#4B5563', cursor: 'pointer' }}><Eye size={14}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {rejectDialog && (
                    <Modal title="Reject Approval" onClose={() => { setRejectDialog(null); setRejectReason(''); }}
                        footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn-secondary" onClick={() => { setRejectDialog(null); setRejectReason(''); }} disabled={actionLoadingId !== null}>Cancel</button><button className="btn-submit" style={{ background: '#DC2626' }} disabled={!rejectReason.trim() || actionLoadingId !== null} onClick={handleReject}>{actionLoadingId?.startsWith('reject-') ? 'Rejecting...' : 'Reject'}</button></div>}>
                        <textarea placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem', resize: 'vertical' }}/>
                    </Modal>
                )}
                {viewDialog && (
                    <Modal title="Approval Details" onClose={() => setViewDialog(null)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Type</span><span className="capitalize">{viewDialog.kind?.replace('_', ' ')}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Amount</span><strong>{currency} {(viewDialog.amount || 0).toLocaleString()}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Requested by</span><span>{viewDialog.cashier?.name || viewDialog.employee?.name || '—'}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Category</span><span>{viewDialog.category?.name || '—'}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Branch</span><span>{viewDialog.branch?.name || '—'}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Reason</span><span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.reason || '—'}</span></div>
                            {viewDialog.requestedAt && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Requested at</span><span>{formatDateFull(viewDialog.requestedAt)}</span></div>}
                            {viewDialog.approvedAt && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Approved at</span><span>{formatDateFull(viewDialog.approvedAt)}</span></div>}
                            {viewDialog.rejectionReason && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-muted)' }}>Rejection Reason</span><span style={{ textAlign: 'right', maxWidth: 220 }}>{viewDialog.rejectionReason}</span></div>}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
