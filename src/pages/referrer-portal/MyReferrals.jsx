import React, { useMemo, useState } from 'react';
import { Search, Pencil, XCircle, History, Check, X, AlertCircle } from 'lucide-react';
import {
  referrerGetMySubmissions,
  referrerGetSubmissionRedemptions,
  referrerUpdateSubmission,
  referrerCancelSubmission,
  formatDate,
  formatSar,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { EmptyState, ReferrerState } from './ReferrerStates';

const FILTERS = ['All', 'Approved', 'Contacted', 'Converted', 'Cancelled'];

const STATUS_LABEL = {
  approved: 'Approved',
  pending: 'Pending',
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function MyReferrals() {
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const req = useReferrerData(referrerGetMySubmissions, []);
  const referrals = useMemo(() => req.data?.submissions ?? [], [req.data]);

  // One row at a time is either being edited or having its history shown.
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [historyId, setHistoryId] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState('');

  const startEdit = (ref) => {
    setRowError('');
    setHistoryId(null);
    setEditingId(ref.id);
    setEditForm({
      customerName: ref.customerName ?? '',
      mobile: ref.mobile ?? '',
      vehiclePlate: ref.vehiclePlate ?? '',
      city: ref.city ?? '',
    });
  };

  const saveEdit = async (id) => {
    setBusy(true);
    setRowError('');
    try {
      await referrerUpdateSubmission(id, editForm);
      setEditingId(null);
      await req.reload();
    } catch (e) {
      // The backend refuses an edit once the referral has been used — its
      // message explains why, so show that rather than a generic failure.
      setRowError(e?.message || 'Could not save this referral.');
    } finally {
      setBusy(false);
    }
  };

  const cancelReferral = async (id) => {
    if (!window.confirm('Withdraw this referral? It will no longer be active.')) return;
    setBusy(true);
    setRowError('');
    try {
      await referrerCancelSubmission(id);
      await req.reload();
    } catch (e) {
      setRowError(e?.message || 'Could not cancel this referral.');
    } finally {
      setBusy(false);
    }
  };

  const toggleHistory = async (id) => {
    if (historyId === id) {
      setHistoryId(null);
      return;
    }
    setEditingId(null);
    setRowError('');
    setBusy(true);
    try {
      const res = await referrerGetSubmissionRedemptions(id);
      setHistory(res?.redemptions ?? []);
      setHistoryId(id);
    } catch (e) {
      setRowError(e?.message || 'Could not load usage history.');
    } finally {
      setBusy(false);
    }
  };

  const filteredReferrals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return referrals.filter((ref) => {
      const matchesSearch =
        !term ||
        String(ref.customerName || '').toLowerCase().includes(term) ||
        String(ref.mobile || '').toLowerCase().includes(term) ||
        String(ref.vehiclePlate || '').toLowerCase().includes(term);
      const matchesFilter =
        filter === 'All' ||
        String(ref.status || '').toLowerCase() === filter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [referrals, searchTerm, filter]);

  const showPlaceholder = req.loading || req.error || req.notLinked;

  const cellInput = (key, placeholder) => (
    <input
      className="rf-input"
      style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
      placeholder={placeholder}
      value={editForm[key] ?? ''}
      onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
      disabled={busy}
    />
  );

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>My Referrals</h1>
          <p>Track, edit and withdraw the referrals you have submitted.</p>
        </div>
      </header>

      {showPlaceholder ? (
        <ReferrerState
          loading={req.loading}
          error={req.error}
          notLinked={req.notLinked}
          onRetry={req.reload}
          loadingLabel="Loading your referrals…"
        />
      ) : (
        <>
          <div
            className="rf-actions-bar"
            style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}
          >
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-faint)',
                }}
              />
              <input
                className="rf-input"
                placeholder="Search name, mobile or plate..."
                style={{ paddingLeft: '3rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div
              className="rf-filter-group"
              style={{ display: 'flex', gap: '0.5rem', background: '#e5e7eb', padding: '4px', borderRadius: '10px' }}
            >
              {FILTERS.map((f) => (
                <button
                  key={f}
                  className="rf-filter-btn"
                  style={{
                    background: filter === f ? '#fff' : 'transparent',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: filter === f ? '#000' : 'var(--color-text-muted)',
                    boxShadow: filter === f ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  }}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {rowError && (
            <div
              className="rf-card"
              style={{
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-start',
                padding: '0.9rem 1.1rem',
                marginBottom: '1rem',
                color: '#dc2626',
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '0.88rem' }}>{rowError}</span>
            </div>
          )}

          <div className="rf-card">
            {referrals.length === 0 ? (
              <EmptyState message="You haven’t submitted any referrals yet." />
            ) : (
              <div className="rf-table-container">
                <table className="rf-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Mobile</th>
                      <th>Vehicle Plate</th>
                      <th>City</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((ref) => {
                      const status = String(ref.status || '').toLowerCase();
                      const editing = editingId === ref.id;
                      const canChange = status !== 'cancelled' && status !== 'converted';

                      return (
                        <React.Fragment key={ref.id}>
                          <tr>
                            <td style={{ fontWeight: 600 }}>
                              {editing ? cellInput('customerName', 'Customer') : ref.customerName || '—'}
                            </td>
                            <td style={{ color: 'var(--color-text-muted)' }}>
                              {editing ? cellInput('mobile', 'Mobile') : ref.mobile || '—'}
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {editing ? cellInput('vehiclePlate', 'Plate') : ref.vehiclePlate || '—'}
                            </td>
                            <td>{editing ? cellInput('city', 'City') : ref.city || '—'}</td>
                            <td>
                              <span className={`rf-badge rf-badge-${status}`}>
                                {STATUS_LABEL[status] || ref.status}
                              </span>
                            </td>
                            <td>{formatDate(ref.createdAt)}</td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {editing ? (
                                <>
                                  <button
                                    className="rf-btn-primary"
                                    style={{ padding: '0.35rem 0.7rem', display: 'inline-flex' }}
                                    onClick={() => saveEdit(ref.id)}
                                    disabled={busy}
                                  >
                                    <Check size={15} />
                                  </button>
                                  <button
                                    className="rf-btn-outline"
                                    style={{ padding: '0.35rem 0.7rem', marginLeft: '0.4rem', display: 'inline-flex' }}
                                    onClick={() => setEditingId(null)}
                                    disabled={busy}
                                  >
                                    <X size={15} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="rf-btn-outline"
                                    style={{ padding: '0.35rem 0.7rem', display: 'inline-flex' }}
                                    onClick={() => toggleHistory(ref.id)}
                                    disabled={busy}
                                    title="Usage history"
                                  >
                                    <History size={15} />
                                  </button>
                                  {canChange && (
                                    <>
                                      <button
                                        className="rf-btn-outline"
                                        style={{ padding: '0.35rem 0.7rem', marginLeft: '0.4rem', display: 'inline-flex' }}
                                        onClick={() => startEdit(ref)}
                                        disabled={busy}
                                        title="Edit"
                                      >
                                        <Pencil size={15} />
                                      </button>
                                      <button
                                        className="rf-btn-outline"
                                        style={{ padding: '0.35rem 0.7rem', marginLeft: '0.4rem', display: 'inline-flex' }}
                                        onClick={() => cancelReferral(ref.id)}
                                        disabled={busy}
                                        title="Withdraw"
                                      >
                                        <XCircle size={15} />
                                      </button>
                                    </>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>

                          {historyId === ref.id && (
                            <tr>
                              <td colSpan="7" style={{ background: 'var(--color-bg-muted)' }}>
                                {history.length === 0 ? (
                                  <p style={{ margin: 0, padding: '0.8rem 0', fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                                    This referral’s vehicle hasn’t used your code yet.
                                  </p>
                                ) : (
                                  <div style={{ padding: '0.5rem 0' }}>
                                    <p style={{ margin: '0 0 0.6rem', fontWeight: 700, fontSize: '0.8rem' }}>
                                      USAGE HISTORY
                                    </p>
                                    {history.map((h) => (
                                      <div
                                        key={h.id}
                                        style={{
                                          display: 'flex',
                                          gap: '1.5rem',
                                          fontSize: '0.85rem',
                                          padding: '0.35rem 0',
                                        }}
                                      >
                                        <span style={{ color: 'var(--color-text-faint)' }}>
                                          {formatDate(h.createdAt)}
                                        </span>
                                        <span style={{ fontWeight: 600 }}>{h.plate}</span>
                                        <span>Spend: {h.amount === null ? '—' : `${formatSar(h.amount)} SAR`}</span>
                                        <span>
                                          You earned:{' '}
                                          <strong>
                                            {h.commissionAmount === null
                                              ? '—'
                                              : `${formatSar(h.commissionAmount)} SAR`}
                                          </strong>
                                          {h.commissionStatus ? ` (${h.commissionStatus})` : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {filteredReferrals.length === 0 && (
                      <tr>
                        <td
                          colSpan="7"
                          style={{ textAlign: 'center', padding: '3rem', opacity: 0.5, fontStyle: 'italic' }}
                        >
                          No referrals match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
