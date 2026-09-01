import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertCircle } from 'lucide-react';
import {
  referrerCreateSubmission,
  referrerGetMe,
} from '../../services/referrerPortalApi';
import useReferrerData from './useReferrerData';
import { ReferrerState } from './ReferrerStates';

const SERVICE_TYPES = ['Individual', 'Corporate', 'Franchise'];

export default function AddReferral() {
  const navigate = useNavigate();

  // Loaded for the code-validity banner: a referrer whose code has expired or run
  // out should be told before filling the form in, not after submitting it.
  const meReq = useReferrerData(referrerGetMe, []);
  const validity = meReq.data?.codeValidity;

  const [form, setForm] = useState({
    customerName: '',
    mobile: '',
    vehiclePlate: '',
    serviceType: 'Individual',
    city: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await referrerCreateSubmission({
        customerName: form.customerName.trim(),
        mobile: form.mobile.trim(),
        vehiclePlate: form.vehiclePlate.trim() || undefined,
        serviceType: form.serviceType,
        city: form.city.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      // Land on the list, so the referrer sees the referral they just submitted.
      navigate('/referrer-portal/my_referrals');
    } catch (err) {
      // The backend owns the code-validity rules, so its message is the one to show.
      setError(err?.message || 'Could not submit this referral. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showPlaceholder = meReq.loading || meReq.error || meReq.notLinked;
  const codeBlocked = Boolean(validity) && validity.valid === false;
  const hasUseLimit =
    validity?.usesRemaining !== null && validity?.usesRemaining !== undefined;

  return (
    <div className="rf-content">
      <header className="rf-header">
        <div className="rf-welcome">
          <h1>Add Referral</h1>
          <p>Submit a new potential customer lead.</p>
        </div>
      </header>

      {showPlaceholder ? (
        <ReferrerState
          loading={meReq.loading}
          error={meReq.error}
          notLinked={meReq.notLinked}
          onRetry={meReq.reload}
          loadingLabel="Loading…"
        />
      ) : (
        <div className="rf-card rf-form-card">
          {codeBlocked && (
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                alignItems: 'flex-start',
                background: 'rgba(220,38,38,0.06)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                marginBottom: '1.5rem',
                color: '#dc2626',
                fontSize: '0.88rem',
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>
                {validity.reason} Ask the marketing team to issue a new code before
                submitting more referrals.
              </span>
            </div>
          )}

          {!codeBlocked && hasUseLimit && (
            <p
              style={{
                marginTop: 0,
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)',
              }}
            >
              Your code <strong>{meReq.data?.referrer?.referralCode}</strong> has{' '}
              <strong>{validity.usesRemaining}</strong> use
              {validity.usesRemaining === 1 ? '' : 's'} left.
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="rf-form-group">
              <label className="rf-label">Customer Name</label>
              <input
                className="rf-input"
                placeholder="e.g. Ahmed Hassan"
                value={form.customerName}
                onChange={set('customerName')}
                disabled={submitting || codeBlocked}
                required
              />
            </div>

            <div className="rf-form-group">
              <label className="rf-label">Mobile Number</label>
              <input
                className="rf-input"
                placeholder="+966"
                value={form.mobile}
                onChange={set('mobile')}
                disabled={submitting || codeBlocked}
                required
              />
            </div>

            <div className="rf-form-group">
              <label className="rf-label">Vehicle Plate</label>
              <input
                className="rf-input"
                placeholder="e.g. 1234 ABJ"
                value={form.vehiclePlate}
                onChange={set('vehiclePlate')}
                disabled={submitting || codeBlocked}
              />
              <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                The plate identifies this referral. Arabic or Latin both work — they
                are matched to the same car.
              </p>
            </div>

            <div className="rf-form-group">
              <label className="rf-label">Service Type</label>
              <select
                className="rf-input rf-select"
                value={form.serviceType}
                onChange={set('serviceType')}
                disabled={submitting || codeBlocked}
                required
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="rf-form-group">
              <label className="rf-label">City</label>
              <input
                className="rf-input"
                placeholder="e.g. Riyadh"
                value={form.city}
                onChange={set('city')}
                disabled={submitting || codeBlocked}
                required
              />
            </div>

            <div className="rf-form-group">
              <label className="rf-label">Notes</label>
              <textarea
                className="rf-input rf-textarea"
                placeholder="Add any additional details here..."
                value={form.notes}
                onChange={set('notes')}
                disabled={submitting || codeBlocked}
              />
            </div>

            {error && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-start',
                  color: '#dc2626',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="rf-btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
              disabled={submitting || codeBlocked}
            >
              <Send size={18} />
              {submitting ? 'Submitting…' : 'Submit Referral'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
