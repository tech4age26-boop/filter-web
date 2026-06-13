import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

function rowCashierName(row) {
    return (
        row?.cashierName ||
        row?.cashier?.name ||
        row?.cashierUser?.name ||
        '—'
    );
}

function rowRequestStatus(row) {
    const raw = row?.status ?? row?.requestStatus ?? '';
    if (!raw) return '—';
    return String(raw).replace(/_/g, ' ');
}

function isPendingStatus(row) {
    const status = String(row?.status ?? row?.requestStatus ?? '').toLowerCase();
    return status === 'pending';
}

export default function PendingRequests({ onTabChange }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [forwardModal, setForwardModal] = useState(null);
    const [officers, setOfficers] = useState([]);
    const [officersLoading, setOfficersLoading] = useState(false);
    const [selectedOfficerId, setSelectedOfficerId] = useState('');
    const [forwardSubmitting, setForwardSubmitting] = useState(false);
    const [forwardError, setForwardError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests${qs({
                    view: 'supervisor',
                    status: 'open',
                    limit: 50,
                })}`,
            );
            const list = res?.items || res?.rows || res?.data || [];
            setRows(list);
        } catch (e) {
            setError(e?.message || 'Failed to load pending requests');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const loadOfficers = useCallback(async () => {
        setOfficersLoading(true);
        setForwardError('');
        try {
            const res = await apiFetch('/locker/field-officers');
            const list = res?.officers || [];
            setOfficers(list);
            if (list.length === 1) {
                setSelectedOfficerId(String(list[0].id));
            }
        } catch (e) {
            setForwardError(e?.message || 'Failed to load cash collectors');
        } finally {
            setOfficersLoading(false);
        }
    }, []);

    const openForwardModal = (row) => {
        setForwardModal({
            id: row.id,
            referenceCode: row.referenceCode,
            branchName: row.branchName,
            cashierName: rowCashierName(row),
        });
        setSelectedOfficerId('');
        setForwardError('');
        loadOfficers();
    };

    const closeForwardModal = () => {
        if (forwardSubmitting) return;
        setForwardModal(null);
        setSelectedOfficerId('');
        setForwardError('');
    };

    const submitForward = async () => {
        if (!forwardModal?.id) return;
        if (!selectedOfficerId) {
            setForwardError('Select a cash collector');
            return;
        }
        setForwardSubmitting(true);
        setForwardError('');
        try {
            const res = await apiFetch(
                `/locker/collection-requests/${forwardModal.id}/assign`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ officerUserId: selectedOfficerId }),
                },
            );
            if (res?.success === false) {
                throw new Error(res?.message || 'Failed to forward request');
            }
            closeForwardModal();
            await load();
        } catch (e) {
            setForwardError(e?.message || 'Failed to forward request');
        } finally {
            setForwardSubmitting(false);
        }
    };

    const goToRecordCollection = (requestId) => {
        onTabChange?.(`record?requestId=${encodeURIComponent(requestId)}`);
    };

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Pending Requests</h2>
                    <p className="ws-page-sub">
                        Branch cash collection requests awaiting pickup
                    </p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={load}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {error ? <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div> : null}

            <div className="ws-section">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Request #</th>
                            <th>Branch</th>
                            <th>Cashier</th>
                            <th>Officer</th>
                            <th>Requested</th>
                            <th>Expected</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No pending requests
                                </td>
                            </tr>
                        ) : (
                            rows.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {p.referenceCode}
                                        </strong>
                                    </td>
                                    <td>{p.branchName}</td>
                                    <td>{rowCashierName(p)}</td>
                                    <td>{p.assignedOfficerName || '—'}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}
                                    </td>
                                    <td>
                                        <strong>{fmtSar(p.expectedAmount)}</strong>
                                    </td>
                                    <td>
                                        <span
                                            className={`ws-badge ${
                                                (p.status ?? p.requestStatus) === 'assigned'
                                                    ? 'ws-badge--blue'
                                                    : 'ws-badge--yellow'
                                            }`}
                                        >
                                            {rowRequestStatus(p)}
                                        </span>
                                    </td>
                                    <td>
                                        <div
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 6,
                                                minWidth: 210,
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => openForwardModal(p)}
                                                disabled={!isPendingStatus(p)}
                                                title={
                                                    isPendingStatus(p)
                                                        ? 'Assign to a locker cash collector'
                                                        : 'Already forwarded to a collector'
                                                }
                                                style={{
                                                    padding: '6px 10px',
                                                    background: isPendingStatus(p) ? '#2563EB' : '#94a3b8',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    fontWeight: 700,
                                                    cursor: isPendingStatus(p) ? 'pointer' : 'not-allowed',
                                                    fontSize: '0.68rem',
                                                    lineHeight: 1.3,
                                                    textAlign: 'left',
                                                }}
                                            >
                                                Approve and forward to cash collector
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => goToRecordCollection(p.id)}
                                                style={{
                                                    padding: '6px 10px',
                                                    background: '#16A34A',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    fontSize: '0.68rem',
                                                    lineHeight: 1.3,
                                                    textAlign: 'left',
                                                }}
                                            >
                                                Approve and record collection
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {forwardModal ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.5)',
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 80,
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            width: 520,
                            maxWidth: '96vw',
                            background: '#fff',
                            borderRadius: 12,
                            padding: 20,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 12,
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0 }}>Forward to cash collector</h3>
                                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                    {forwardModal.referenceCode} · {forwardModal.branchName} ·{' '}
                                    {forwardModal.cashierName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeForwardModal}
                                disabled={forwardSubmitting}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {forwardError ? (
                            <div className="wlk-error" style={{ marginTop: 12 }}>
                                {forwardError}
                            </div>
                        ) : null}

                        <div className="ws-field" style={{ marginTop: 16 }}>
                            <label>Cash collector *</label>
                            <select
                                value={selectedOfficerId}
                                onChange={(e) => setSelectedOfficerId(e.target.value)}
                                disabled={officersLoading || forwardSubmitting}
                            >
                                <option value="">
                                    {officersLoading ? 'Loading collectors…' : 'Select collector…'}
                                </option>
                                {officers.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                        {o.displayCode ? ` (${o.displayCode})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                            The selected collector will see this request in their inbox and collect cash
                            from the POS cashier.
                        </p>

                        <div
                            style={{
                                display: 'flex',
                                gap: 10,
                                justifyContent: 'flex-end',
                                marginTop: 20,
                            }}
                        >
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={closeForwardModal}
                                disabled={forwardSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                onClick={submitForward}
                                disabled={forwardSubmitting || officersLoading}
                            >
                                {forwardSubmitting ? 'Forwarding…' : 'Approve & forward'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
