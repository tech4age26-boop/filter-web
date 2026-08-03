import { useEffect, useMemo, useState } from 'react';
import { Loader } from 'lucide-react';
import Modal from '../Modal';

function r2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function fmt(n) {
    return Number(n ?? 0).toLocaleString('en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * Multi-step Generate Bill:
 *  1) due date + review snapshot
 *  2) include previous opening balance? yes/no
 *  3) ask edit?
 *  4) optional edit invoice amounts (bill-only)
 *  5) confirm generate
 */
export default function CorporateGenerateBillModal({
    open,
    onClose,
    t,
    companyName,
    dateFrom,
    dateTo,
    dueDate,
    onDueDateChange,
    ledger,
    generating,
    onGenerate,
}) {
    const [step, setStep] = useState('review'); // review | askOpening | askEdit | edit | confirm
    const [draftLines, setDraftLines] = useState([]);
    const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);

    const priorOpening = r2(ledger?.summary?.openingBalance);

    useEffect(() => {
        if (!open) {
            setStep('review');
            setDraftLines([]);
            setIncludeOpeningBalance(true);
            return;
        }
        const invoices = (ledger?.lines || []).filter((l) => l.type === 'Invoice');
        setDraftLines(
            invoices.map((l) => ({
                invoiceId: String(l.invoiceId || ''),
                invoiceNo: l.invoiceNo || '—',
                date: l.date || '',
                vehicleNo: l.vehicleNo || '—',
                productsServices: l.productsServicesEn || l.productsServices || '—',
                invoiceExclVat: r2(l.invoiceExclVat),
                vat15: r2(l.vat15),
                salesDiscounts: r2(l.salesDiscounts),
                invoiceInclusiveVat: r2(l.invoiceInclusiveVat),
                original: {
                    invoiceExclVat: r2(l.invoiceExclVat),
                    vat15: r2(l.vat15),
                    salesDiscounts: r2(l.salesDiscounts),
                    invoiceInclusiveVat: r2(l.invoiceInclusiveVat),
                },
            })),
        );
        setIncludeOpeningBalance(true);
        setStep('review');
    }, [open, ledger]);

    const totals = useMemo(() => {
        const excl = r2(draftLines.reduce((s, l) => s + Number(l.invoiceExclVat || 0), 0));
        const vat = r2(draftLines.reduce((s, l) => s + Number(l.vat15 || 0), 0));
        const disc = r2(draftLines.reduce((s, l) => s + Number(l.salesDiscounts || 0), 0));
        const incl = r2(draftLines.reduce((s, l) => s + Number(l.invoiceInclusiveVat || 0), 0));
        return { excl, vat, disc, incl };
    }, [draftLines]);

    const dirtyOverrides = useMemo(() => {
        return draftLines
            .filter((l) => {
                if (!l.invoiceId) return false;
                const o = l.original || {};
                return (
                    r2(l.invoiceExclVat) !== r2(o.invoiceExclVat) ||
                    r2(l.vat15) !== r2(o.vat15) ||
                    r2(l.salesDiscounts) !== r2(o.salesDiscounts) ||
                    r2(l.invoiceInclusiveVat) !== r2(o.invoiceInclusiveVat)
                );
            })
            .map((l) => ({
                invoiceId: l.invoiceId,
                invoiceExclVat: r2(l.invoiceExclVat),
                vat15: r2(l.vat15),
                salesDiscounts: r2(l.salesDiscounts),
                invoiceInclusiveVat: r2(l.invoiceInclusiveVat),
            }));
    }, [draftLines]);

    if (!open) return null;

    const updateLine = (invoiceId, patch) => {
        setDraftLines((prev) =>
            prev.map((l) => {
                if (l.invoiceId !== invoiceId) return l;
                const next = { ...l, ...patch };
                if (
                    patch.invoiceExclVat != null ||
                    patch.vat15 != null ||
                    patch.salesDiscounts != null
                ) {
                    if (patch.invoiceInclusiveVat == null) {
                        next.invoiceInclusiveVat = r2(
                            Math.max(
                                0,
                                Number(next.invoiceExclVat || 0) -
                                    Number(next.salesDiscounts || 0) +
                                    Number(next.vat15 || 0),
                            ),
                        );
                    }
                }
                return next;
            }),
        );
    };

    const fireGenerate = () => {
        onGenerate({
            lineOverrides: dirtyOverrides,
            includeOpeningBalance,
        });
    };

    const title =
        step === 'askOpening'
            ? t('modal.askOpeningTitle')
            : step === 'askEdit'
              ? t('modal.askEditTitle')
              : step === 'edit'
                ? t('modal.editTitle')
                : step === 'confirm'
                  ? t('modal.confirmTitle')
                  : t('modal.title');

    const footer = (() => {
        if (step === 'review') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={generating}>
                        {t('btn.cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn-submit"
                        disabled={!dueDate?.trim() || generating}
                        onClick={() => setStep('askOpening')}
                    >
                        {t('btn.continueReview')}
                    </button>
                </>
            );
        }
        if (step === 'askOpening') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={() => setStep('review')} disabled={generating}>
                        {t('btn.wizardBack')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={generating}
                        onClick={() => {
                            setIncludeOpeningBalance(false);
                            setStep('askEdit');
                        }}
                    >
                        {t('btn.noOpening')}
                    </button>
                    <button
                        type="button"
                        className="btn-submit"
                        disabled={generating}
                        onClick={() => {
                            setIncludeOpeningBalance(true);
                            setStep('askEdit');
                        }}
                    >
                        {t('btn.yesOpening')}
                    </button>
                </>
            );
        }
        if (step === 'askEdit') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={() => setStep('askOpening')} disabled={generating}>
                        {t('btn.wizardBack')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={generating}
                        onClick={() => setStep('confirm')}
                    >
                        {t('btn.noKeepAsIs')}
                    </button>
                    <button type="button" className="btn-submit" disabled={generating} onClick={() => setStep('edit')}>
                        {t('btn.yesEdit')}
                    </button>
                </>
            );
        }
        if (step === 'edit') {
            return (
                <>
                    <button type="button" className="btn-secondary" onClick={() => setStep('askEdit')} disabled={generating}>
                        {t('btn.wizardBack')}
                    </button>
                    <button
                        type="button"
                        className="btn-submit"
                        disabled={generating}
                        onClick={() => setStep('confirm')}
                    >
                        {t('btn.continueToGenerate')}
                    </button>
                </>
            );
        }
        return (
            <>
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep(dirtyOverrides.length ? 'edit' : 'askEdit')}
                    disabled={generating}
                >
                    {t('btn.wizardBack')}
                </button>
                <button
                    type="button"
                    className="btn-submit"
                    disabled={generating || !dueDate?.trim()}
                    onClick={fireGenerate}
                >
                    {generating ? (
                        <>
                            <Loader size={14} className="spin" /> {t('btn.generating')}
                        </>
                    ) : (
                        t('btn.confirmGenerate')
                    )}
                </button>
            </>
        );
    })();

    return (
        <Modal title={title} onClose={onClose} footer={footer} size="large">
            <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {t('modal.period')} <strong>{dateFrom} — {dateTo}</strong>
                <br />
                {t('modal.company')} <strong>{companyName}</strong>
            </p>

            {(step === 'review' || step === 'confirm') && (
                <div className="form-group">
                    <label className="form-label">{t('modal.dueDate')}</label>
                    <input
                        type="date"
                        className="form-input-field"
                        value={dueDate || ''}
                        onChange={(e) => onDueDateChange(e.target.value)}
                        required
                        disabled={step === 'confirm' && generating}
                    />
                </div>
            )}

            {step === 'askOpening' ? (
                <div style={{ padding: '12px 0' }}>
                    <p style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                        {t('modal.askOpeningBody')}
                    </p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 12 }}>
                        {t('modal.priorOpening', {
                            amount: fmt(priorOpening),
                        })}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 10 }}>
                        {t('modal.askOpeningHint')}
                    </p>
                </div>
            ) : null}

            {step === 'askEdit' ? (
                <div style={{ padding: '12px 0' }}>
                    <p style={{ fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                        {t('modal.askEditBody')}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 10 }}>
                        {t('modal.editDisclaimer')}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: 8 }}>
                        {includeOpeningBalance
                            ? t('modal.openingIncluded')
                            : t('modal.openingExcluded')}
                    </p>
                </div>
            ) : null}

            {(step === 'review' || step === 'edit' || step === 'confirm') && (
                <>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <Kpi label={t('modal.kpiExcl')} value={fmt(totals.excl)} t={t} />
                        <Kpi label={t('modal.kpiVat')} value={fmt(totals.vat)} t={t} />
                        <Kpi label={t('modal.kpiDisc')} value={fmt(totals.disc)} t={t} />
                        <Kpi label={t('modal.kpiIncl')} value={fmt(totals.incl)} t={t} accent />
                    </div>

                    {step === 'confirm' ? (
                        <p style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 8 }}>
                            {includeOpeningBalance
                                ? t('modal.openingIncluded')
                                : t('modal.openingExcluded')}
                            {includeOpeningBalance
                                ? ` (${t('money.sar', { amount: fmt(priorOpening) })})`
                                : ''}
                        </p>
                    ) : null}

                    {step === 'confirm' && dirtyOverrides.length > 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 10px', borderRadius: 8 }}>
                            {t('modal.editedNotice', { n: dirtyOverrides.length })}
                        </p>
                    ) : null}

                    <div style={{ overflowX: 'auto', maxHeight: 360, border: '1px solid #e2e8f0', borderRadius: 10 }}>
                        <table className="ws-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    <th>{t('th.date')}</th>
                                    <th>{t('th.invNo')}</th>
                                    <th>{t('th.vehicle')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.exclVatShort')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.vat15')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.discounts')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.inclVatShort')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {draftLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                                            {t('empty.period')}
                                        </td>
                                    </tr>
                                ) : (
                                    draftLines.map((l) => (
                                        <tr key={l.invoiceId || l.invoiceNo}>
                                            <td>{l.date}</td>
                                            <td style={{ fontWeight: 700 }}>{l.invoiceNo}</td>
                                            <td>{l.vehicleNo}</td>
                                            {step === 'edit' ? (
                                                <>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.invoiceExclVat}
                                                            onChange={(v) => updateLine(l.invoiceId, { invoiceExclVat: v })}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.vat15}
                                                            onChange={(v) => updateLine(l.invoiceId, { vat15: v })}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.salesDiscounts}
                                                            onChange={(v) => updateLine(l.invoiceId, { salesDiscounts: v })}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <NumInput
                                                            value={l.invoiceInclusiveVat}
                                                            onChange={(v) =>
                                                                updateLine(l.invoiceId, { invoiceInclusiveVat: v })
                                                            }
                                                        />
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td style={{ textAlign: 'right' }}>{t('money.sar', { amount: fmt(l.invoiceExclVat) })}</td>
                                                    <td style={{ textAlign: 'right' }}>{t('money.sar', { amount: fmt(l.vat15) })}</td>
                                                    <td style={{ textAlign: 'right' }}>{t('money.sar', { amount: fmt(l.salesDiscounts) })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                        {t('money.sar', { amount: fmt(l.invoiceInclusiveVat) })}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {step === 'edit' ? (
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 8 }}>
                            {t('modal.editDisclaimer')}
                        </p>
                    ) : null}
                </>
            )}
        </Modal>
    );
}

function Kpi({ label, value, t, accent }) {
    return (
        <div
            style={{
                flex: '1 1 120px',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: accent ? '#fef2f2' : '#f8fafc',
            }}
        >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontWeight: 800, marginTop: 2 }}>{t('money.sar', { amount: value })}</div>
        </div>
    );
}

function NumInput({ value, onChange }) {
    return (
        <input
            type="number"
            step="0.01"
            min="0"
            value={Number.isFinite(Number(value)) ? value : 0}
            onChange={(e) => onChange(r2(e.target.value))}
            style={{
                width: 96,
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                textAlign: 'right',
                fontSize: '0.8rem',
            }}
        />
    );
}
