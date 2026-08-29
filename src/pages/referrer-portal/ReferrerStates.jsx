import React from 'react';
import { AlertCircle, Inbox, Link2Off, RefreshCw } from 'lucide-react';

/**
 * Shared placeholders for the referrer portal.
 *
 * These exist so a screen with no data says so plainly. The portal used to fill
 * every gap with invented figures, which in a product that reports what someone
 * is owed is worse than showing nothing.
 */

const wrap = {
  padding: '3rem 1rem',
  textAlign: 'center',
  color: 'var(--color-text-muted)',
};

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div style={wrap}>
      <RefreshCw size={22} style={{ opacity: 0.5, animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: '0.75rem' }}>{label}</p>
      <style>{'@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div style={wrap}>
      <AlertCircle size={22} style={{ color: '#dc2626' }} />
      <p style={{ marginTop: '0.75rem', color: '#dc2626' }}>{message}</p>
      {onRetry && (
        <button className="rf-btn-outline" style={{ marginTop: '1rem' }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** The login exists but was never linked to a referrer profile. */
export function NotLinkedState() {
  return (
    <div style={wrap}>
      <Link2Off size={22} style={{ opacity: 0.5 }} />
      <p style={{ marginTop: '0.75rem', fontWeight: 600 }}>
        Your account isn’t linked to a referrer profile yet
      </p>
      <p style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
        Ask the marketing team to link it, then your referrals and earnings will appear here.
      </p>
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div style={wrap}>
      <Inbox size={22} style={{ opacity: 0.4 }} />
      <p style={{ marginTop: '0.75rem' }}>{message}</p>
    </div>
  );
}

/**
 * Render the right placeholder for the current state, or `children` when loaded.
 * Returns null when there is nothing to stand in for.
 */
export function ReferrerState({ loading, error, notLinked, onRetry, loadingLabel }) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (notLinked) return <NotLinkedState />;
  return null;
}
