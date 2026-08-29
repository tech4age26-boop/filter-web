import React, { useState } from 'react';
import {
  Copy, Check, Globe, Landmark, User, Info,
} from 'lucide-react';
import {
  referrerGetMe,
  referrerGetPayoutDetails,
  formatSar,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { ReferrerState } from './ReferrerStates';

export default function ReferrerSettings() {
  const [locale, setLocale] = useState('en');
  const [copied, setCopied] = useState(false);

  const meReq = useReferrerData(referrerGetMe, []);
  const bankReq = useReferrerData(referrerGetPayoutDetails, []);

  const referrer = meReq.data?.referrer;
  const bank = bankReq.data?.bank;

  const copyCode = async () => {
    if (!referrer?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referrer.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the code is on screen to copy manually.
    }
  };

  // A React element is always truthy, so gate on the state itself.
  const showPlaceholder = meReq.loading || meReq.error || meReq.notLinked;
  const placeholder = (
    <ReferrerState
      loading={meReq.loading}
      error={meReq.error}
      notLinked={meReq.notLinked}
      onRetry={meReq.reload}
      loadingLabel="Loading your settings…"
    />
  );

  const readOnly = {
    background: 'var(--color-bg-muted)',
    cursor: 'default',
  };

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Settings</h1>
          <p>Your account details and referral code.</p>
        </div>
      </header>

      {showPlaceholder ? placeholder : (
        <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Referral code */}
          <div className="rf-card">
            <h3 className="rf-card-title" style={{ marginBottom: '1.5rem' }}>
              Your Referral Code
            </h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'var(--color-bg-muted)',
                padding: '1rem',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  padding: '0.5rem 1rem',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px dashed var(--color-primary)',
                  color: 'var(--color-primary)',
                }}
              >
                {referrer?.referralCode || '—'}
              </div>
              <button className="rf-btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={copyCode}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          {/* Commission terms — the real terms on this profile, replacing the
              mock "program rules" that were read from another portal's fixtures. */}
          <div className="rf-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Info size={20} color="var(--color-primary)" />
              <h3 className="rf-card-title" style={{ margin: 0 }}>Your Commission Terms</h3>
            </div>
            <div className="rf-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="rf-form-group">
                <label className="rf-label">Commission Type</label>
                <input
                  className="rf-input"
                  style={readOnly}
                  value={referrer?.commissionType === 'fixed' ? 'Fixed amount' : 'Percentage'}
                  disabled
                />
              </div>
              <div className="rf-form-group">
                <label className="rf-label">Rate</label>
                <input
                  className="rf-input"
                  style={readOnly}
                  value={
                    referrer?.commissionType === 'fixed'
                      ? `${formatSar(referrer?.commissionValue)} SAR per referral`
                      : `${referrer?.commissionValue ?? 0}%`
                  }
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="rf-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <User size={20} color="var(--color-primary)" />
              <h3 className="rf-card-title" style={{ margin: 0 }}>Profile Information</h3>
            </div>
            <div
              className="rf-stats-grid"
              style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}
            >
              <div className="rf-form-group">
                <label className="rf-label">Full Name</label>
                <input className="rf-input" style={readOnly} value={referrer?.name || '—'} disabled />
              </div>
              <div className="rf-form-group">
                <label className="rf-label">Mobile Number</label>
                <input className="rf-input" style={readOnly} value={referrer?.phone || '—'} disabled />
              </div>
              <div className="rf-form-group">
                <label className="rf-label">Email</label>
                <input className="rf-input" style={readOnly} value={referrer?.email || '—'} disabled />
              </div>
              <div className="rf-form-group">
                <label className="rf-label">Status</label>
                <input className="rf-input" style={readOnly} value={referrer?.status || '—'} disabled />
              </div>
            </div>
            {/* Editing is read-only for now: there is no endpoint for a referrer to
                update their own profile. The previous Save button had no handler at
                all, so it looked like it saved and did nothing. */}
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              To change these details, contact the marketing team.
            </p>
          </div>

          {/* Bank details */}
          <div className="rf-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Landmark size={20} color="var(--color-primary)" />
              <h3 className="rf-card-title" style={{ margin: 0 }}>Bank Details</h3>
            </div>

            {bankReq.loading ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
            ) : !bank?.iban ? (
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                No bank account on file. Contact the marketing team to add one.
              </p>
            ) : (
              <>
                <div
                  className="rf-stats-grid"
                  style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}
                >
                  <div className="rf-form-group">
                    <label className="rf-label">Bank Name</label>
                    <input className="rf-input" style={readOnly} value={bank.bankName || '—'} disabled />
                  </div>
                  <div className="rf-form-group">
                    <label className="rf-label">Bank IBAN</label>
                    <input className="rf-input" style={readOnly} value={bank.iban} disabled />
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  To change your bank details, contact the marketing team.
                </p>
              </>
            )}
          </div>

          {/* Language */}
          <div className="rf-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Globe size={20} color="var(--color-primary)" />
              <h3 className="rf-card-title" style={{ margin: 0 }}>Language</h3>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className={`rf-btn-${locale === 'en' ? 'primary' : 'outline'}`}
                onClick={() => setLocale('en')}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Globe size={18} />
                English
              </button>
              <button
                className={`rf-btn-${locale === 'ar' ? 'primary' : 'outline'}`}
                onClick={() => setLocale('ar')}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Globe size={18} />
                العربية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
