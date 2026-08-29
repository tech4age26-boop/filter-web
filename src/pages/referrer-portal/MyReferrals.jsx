import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  referrerGetMyReferrals,
  formatDate,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { EmptyState, ReferrerState } from './ReferrerStates';

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];

export default function MyReferrals() {
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const req = useReferrerData(referrerGetMyReferrals, []);
  const referrals = useMemo(() => req.data?.referrals ?? [], [req.data]);

  const filteredReferrals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return referrals.filter((ref) => {
      const matchesSearch = !term || String(ref.name || '').toLowerCase().includes(term);
      const matchesFilter =
        filter === 'All' ||
        String(ref.status || '').toLowerCase() === filter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [referrals, searchTerm, filter]);

  // A React element is always truthy, so gate on the state itself.
  const showPlaceholder = req.loading || req.error || req.notLinked;
  const placeholder = (
    <ReferrerState
      loading={req.loading}
      error={req.error}
      notLinked={req.notLinked}
      onRetry={req.reload}
      loadingLabel="Loading your referrals…"
    />
  );

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>My Referrals</h1>
          <p>Track and manage all your submitted leads.</p>
        </div>
      </header>

      {showPlaceholder ? placeholder : (
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
                placeholder="Search..."
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

          <div className="rf-card">
            {referrals.length === 0 ? (
              <EmptyState message="You haven’t referred any accounts yet." />
            ) : (
              <div className="rf-table-container">
                <table className="rf-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Account Name</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReferrals.map((ref) => (
                      <tr key={ref.id}>
                        <td style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem' }}>
                          {ref.id}
                        </td>
                        <td style={{ fontWeight: 600 }}>{ref.name || '—'}</td>
                        <td>
                          <span className={`rf-badge rf-badge-${String(ref.status).toLowerCase()}`}>
                            {ref.status}
                          </span>
                        </td>
                        <td>{formatDate(ref.createdAt)}</td>
                      </tr>
                    ))}
                    {filteredReferrals.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
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
