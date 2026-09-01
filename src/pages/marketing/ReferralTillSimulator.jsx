import React, { useCallback, useEffect, useState } from 'react';
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Car,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  marketingValidateRedemption,
  marketingRecordRedemption,
  marketingListRedemptions,
} from '../../services/superAdminMarketingApi';

/**
 * Till simulator — stands in for the cashier screen.
 *
 * This is NOT the real POS. The cashier flow does not yet accept a referral
 * code; wiring it there writes into live sales and double-entry accounting and
 * is blocked on the commission rules being agreed. This screen calls the same
 * /referral-redemptions endpoints the POS will call once that happens, so the
 * whole chain — code + plate in, rules checked, commission created, referrer
 * notified — can be exercised and demonstrated without touching real sales.
 *
 * The banner saying so is deliberate and should not be removed: without it this
 * screen implies POS attribution is finished, which it is not.
 */
export default function ReferralTillSimulator({ formatSar }) {
  const [form, setForm] = useState({ referralCode: '', vehiclePlate: '', amount: '', mobileLast4: '' });
  const [checking, setChecking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [check, setCheck] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);

  const money = (v) => (formatSar ? formatSar(v) : Number(v ?? 0).toFixed(2));

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    // Any edit invalidates a previous check — otherwise the operator could act
    // on a result for different inputs.
    setCheck(null);
    setResult(null);
    setError('');
  };

  const loadRecent = useCallback(async () => {
    try {
      const res = await marketingListRedemptions({});
      setRecent((res?.redemptions ?? []).slice(0, 8));
    } catch {
      // A failed history load should not block recording a sale.
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const payload = () => ({
    referralCode: form.referralCode.trim(),
    vehiclePlate: form.vehiclePlate.trim(),
    amount: form.amount === '' ? undefined : Number(form.amount),
    mobileLast4: form.mobileLast4.trim() || undefined,
  });

  const runCheck = async () => {
    setChecking(true);
    setError('');
    setResult(null);
    try {
      const res = await marketingValidateRedemption(payload());
      setCheck(res);
    } catch (e) {
      setError(e?.message || 'Could not check this code.');
    } finally {
      setChecking(false);
    }
  };

  const record = async () => {
    setRecording(true);
    setError('');
    try {
      const res = await marketingRecordRedemption(payload());
      if (res?.valid === false) {
        // The backend re-checks on record, so a code can be refused here even
        // after a successful check — someone else may have used the last one.
        setError(res.message);
        setCheck(null);
      } else {
        setResult(res);
        setCheck(null);
        setForm({ referralCode: '', vehiclePlate: '', amount: '', mobileLast4: '' });
        await loadRecent();
      }
    } catch (e) {
      setError(e?.message || 'Could not record this sale.');
    } finally {
      setRecording(false);
    }
  };

  const canSubmit = form.referralCode.trim() && form.vehiclePlate.trim();

  return (
    <>
      <div className="mk-ref-section-header">
        <div>
          <h2 className="mk-ref-section-title">Till Simulator</h2>
          <p className="mk-ref-section-subtitle">
            Enter a referral code and vehicle plate the way a cashier would.
          </p>
        </div>
      </div>

      {/* Deliberate and load-bearing: without this the screen implies the real
          POS already does this. It does not. */}
      <div
        className="mk-card"
        style={{
          display: 'flex',
          gap: '0.7rem',
          alignItems: 'flex-start',
          padding: '0.9rem 1.1rem',
          marginBottom: '1.5rem',
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.25)',
        }}
      >
        <Info size={18} style={{ flexShrink: 0, marginTop: '1px', color: '#2563eb' }} />
        <span style={{ fontSize: '0.87rem', color: '#1e40af' }}>
          <strong>This stands in for the cashier screen.</strong> The real POS does not
          accept referral codes yet — that needs the commission rules agreed first,
          because it writes into live sales and accounting. This calls the same
          endpoints the POS will call, so the full chain can be demonstrated safely.
          Both code kinds work here: a shared referrer code, or a personal code
          issued to one customer (which needs their mobile digits and locks to the
          first car that uses it).
        </span>
      </div>

      <div className="mk-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.2rem',
            marginBottom: '1.2rem',
          }}
        >
          <div>
            <label className="mk-ref-form-label">Referral Code</label>
            <input
              className="mk-ref-input"
              placeholder="e.g. AHMED-2024"
              value={form.referralCode}
              onChange={set('referralCode')}
              disabled={recording}
            />
          </div>
          <div>
            <label className="mk-ref-form-label">Vehicle Plate</label>
            <input
              className="mk-ref-input"
              placeholder="e.g. 1234 ABJ"
              value={form.vehiclePlate}
              onChange={set('vehiclePlate')}
              disabled={recording}
            />
          </div>
          <div>
            <label className="mk-ref-form-label">Customer Mobile (last 4)</label>
            <input
              className="mk-ref-input"
              inputMode="numeric"
              maxLength={4}
              placeholder="e.g. 4567"
              value={form.mobileLast4}
              onChange={set('mobileLast4')}
              disabled={recording}
            />
          </div>
          <div>
            <label className="mk-ref-form-label">Invoice Total (SAR)</label>
            <input
              className="mk-ref-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={set('amount')}
              disabled={recording}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="mk-ref-secondary-btn"
            onClick={runCheck}
            disabled={!canSubmit || checking || recording}
          >
            <ScanLine size={15} />
            {checking ? 'Checking…' : 'Check Code'}
          </button>
          <button
            type="button"
            className="mk-ref-primary-btn"
            onClick={record}
            disabled={!canSubmit || recording}
          >
            {recording ? 'Recording…' : 'Record Sale'}
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start',
              marginTop: '1.1rem',
              color: '#dc2626',
              fontSize: '0.88rem',
            }}
          >
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{error}</span>
          </div>
        )}

        {check && (
          <div
            style={{
              marginTop: '1.1rem',
              padding: '0.9rem 1.1rem',
              borderRadius: '12px',
              background: check.valid ? 'rgba(34,197,94,0.07)' : 'rgba(220,38,38,0.06)',
              border: `1px solid ${check.valid ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.25)'}`,
              fontSize: '0.88rem',
              color: check.valid ? '#15803d' : '#dc2626',
            }}
          >
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              {check.valid ? (
                <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              )}
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{check.message}</p>
                {check.valid && (
                  <p style={{ margin: '0.4rem 0 0', opacity: 0.85 }}>
                    Plate {check.plate?.display}
                    {check.rule
                      ? ` · rule "${check.rule.title}"${
                          check.rule.perPlateLimit
                            ? `, used ${check.rule.usesOnThisPlate} of ${check.rule.perPlateLimit} times by this car`
                            : ''
                        }`
                      : ' · no rule applies, unlimited'}
                    {check.discountPercent !== null && check.discountPercent !== undefined
                      ? ` · customer discount ${check.discountPercent}%`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div
            style={{
              marginTop: '1.1rem',
              padding: '1rem 1.1rem',
              borderRadius: '12px',
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '1px', color: '#16a34a' }} />
              <div style={{ fontSize: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#15803d' }}>
                  {result.message}
                </p>
                <p style={{ margin: '0.45rem 0 0', color: 'var(--color-text-muted)' }}>
                  {result.redemption?.plate} · customer paid{' '}
                  {money(result.redemption?.amount)} SAR
                  {result.redemption?.discountApplied
                    ? ` · discount ${money(result.redemption.discountApplied)} SAR`
                    : ''}
                </p>
                <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-muted)' }}>
                  A pending commission was created and {result.redemption?.referrerName} was
                  notified — check their wallet and notifications.
                </p>
                {result.boundToPlate && (
                  <p style={{ margin: '0.3rem 0 0', color: '#15803d', fontWeight: 600 }}>
                    This personal code is now locked to {result.boundToPlate}. No other
                    vehicle can use it.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="mk-card mk-ref-table-card">
        <div className="mk-ref-section-header" style={{ padding: '0 0 0.8rem' }}>
          <h3 className="mk-ref-section-title" style={{ margin: 0 }}>Recent Code Uses</h3>
          <button type="button" className="mk-ref-secondary-btn" onClick={loadRecent}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <table className="mk-ref-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Referrer</th>
              <th>Code</th>
              <th>Vehicle</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan="5" className="mk-ref-empty-table">
                  No code uses recorded yet.
                </td>
              </tr>
            ) : (
              recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r.referrerName || '—'}</td>
                  <td>{r.referralCode}</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Car size={14} style={{ opacity: 0.5 }} />
                    {r.plate}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {r.amount === null ? '—' : money(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
