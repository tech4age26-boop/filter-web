import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
    getSupplierAccounts,
    postSupplierGeneralJournal,
    postSupplierPayment,
    postSupplierReceipt,
} from '../../../services/supplierAccountingApi';
import {
    AcctCard,
    AcctError,
    Field,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from './SupplierAccountingShared';

const TABS = [
    { id: 'payment', label: 'Payment (cash out)' },
    { id: 'receipt', label: 'Receipt (cash in)' },
    { id: 'journal', label: 'General Journal' },
];

function emptyPaymentLine() {
    return { accountId: '', amount: '', description: '' };
}
function emptyJournalLine() {
    return { accountId: '', debit: '', credit: '', description: '' };
}

function PaymentReceiptForm({ accounts, variant, onPosted }) {
    const cashOptions = accounts.filter((a) => a.isCashEquivalent);
    const otherOptions = accounts;
    const [date, setDate] = useState(todayISO());
    const [cashAccountId, setCashAccountId] = useState(cashOptions[0]?.id || '');
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [lines, setLines] = useState([emptyPaymentLine()]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cashAccountId && cashOptions[0]?.id) {
            setCashAccountId(cashOptions[0].id);
        }
    }, [cashOptions, cashAccountId]);

    const total = useMemo(
        () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [lines],
    );

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    async function submit(e) {
        e.preventDefault();
        setErr('');
        if (!cashAccountId) {
            setErr('Pick a cash/bank account.');
            return;
        }
        const cleanLines = lines.filter((l) => l.accountId && Number(l.amount) > 0);
        if (cleanLines.length === 0) {
            setErr('Add at least one line with account + amount > 0.');
            return;
        }
        setSaving(true);
        try {
            const body = {
                date,
                cashAccountId,
                description: description.trim() || undefined,
                reference: reference.trim() || undefined,
                lines: cleanLines.map((l) => ({
                    accountId: l.accountId,
                    amount: Number(l.amount),
                    description: l.description?.trim() || undefined,
                })),
            };
            const res = variant === 'payment'
                ? await postSupplierPayment(body)
                : await postSupplierReceipt(body);
            onPosted?.(res);
            setLines([emptyPaymentLine()]);
            setDescription('');
            setReference('');
        } catch (e) {
            setErr(e?.message || 'Failed to post entry');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Date" required>
                    <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} required />
                </Field>
                <Field label={variant === 'payment' ? 'Paid from (cash/bank)' : 'Received into (cash/bank)'} required>
                    <select style={inputStyle} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} required>
                        <option value="">— Select —</option>
                        {cashOptions.map((a) => (
                            <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Reference">
                    <input style={inputStyle} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque / TXN / Slip #" />
                </Field>
            </div>
            <Field label="Description">
                <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note for the journal header" />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 13, color: '#475569', fontWeight: 800 }}>
                    {variant === 'payment' ? 'Debit lines (where the money goes)' : 'Credit lines (where the money comes from)'}
                </h4>
                <button type="button" style={outlineBtnStyle} onClick={() => setLines((ls) => [...ls, emptyPaymentLine()])}>
                    <Plus size={14} /> Add line
                </button>
            </div>
            <table className="ws-table" style={{ width: '100%' }}>
                <thead>
                    <tr>
                        <th style={{ width: '32%' }}>Account</th>
                        <th>Description</th>
                        <th style={{ width: 140, textAlign: 'right' }}>Amount</th>
                        <th style={{ width: 60 }} />
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l, idx) => (
                        <tr key={idx}>
                            <td>
                                <select style={inputStyle} value={l.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })}>
                                    <option value="">— Select account —</option>
                                    {otherOptions.map((a) => (
                                        <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                                    ))}
                                </select>
                            </td>
                            <td>
                                <input style={inputStyle} value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} placeholder="Memo" />
                            </td>
                            <td>
                                <input type="number" step="0.01" min="0" style={{ ...inputStyle, textAlign: 'right' }} value={l.amount} onChange={(e) => updateLine(idx, { amount: e.target.value })} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button
                                    type="button"
                                    style={outlineBtnStyle}
                                    onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                    disabled={lines.length === 1}
                                    title="Remove line"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>{money(total)}</td>
                        <td />
                    </tr>
                </tfoot>
            </table>

            <AcctError message={err} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={primaryBtnStyle} disabled={saving || total <= 0}>
                    {saving ? 'Posting…' : variant === 'payment' ? 'Post payment' : 'Post receipt'}
                </button>
            </div>
        </form>
    );
}

function GeneralJournalForm({ accounts, onPosted }) {
    const [date, setDate] = useState(todayISO());
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [lines, setLines] = useState([emptyJournalLine(), emptyJournalLine()]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const totals = useMemo(() => {
        const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
        return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 && debit > 0 };
    }, [lines]);

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    async function submit(e) {
        e.preventDefault();
        setErr('');
        if (!totals.balanced) {
            setErr('Debit total must equal credit total (and be greater than 0).');
            return;
        }
        const cleanLines = lines
            .filter((l) => l.accountId && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0)
            .map((l) => ({
                accountId: l.accountId,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                description: l.description?.trim() || undefined,
            }));
        if (cleanLines.length < 2) {
            setErr('At least 2 balanced lines are required.');
            return;
        }
        setSaving(true);
        try {
            const res = await postSupplierGeneralJournal({
                date,
                description: description.trim() || undefined,
                reference: reference.trim() || undefined,
                lines: cleanLines,
            });
            onPosted?.(res);
            setLines([emptyJournalLine(), emptyJournalLine()]);
            setDescription('');
            setReference('');
        } catch (e) {
            setErr(e?.message || 'Failed to post journal');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Date" required>
                    <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} required />
                </Field>
                <Field label="Reference">
                    <input style={inputStyle} value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
                <Field label="Description">
                    <input style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: 13, color: '#475569', fontWeight: 800 }}>Lines (must balance)</h4>
                <button type="button" style={outlineBtnStyle} onClick={() => setLines((ls) => [...ls, emptyJournalLine()])}>
                    <Plus size={14} /> Add line
                </button>
            </div>
            <table className="ws-table" style={{ width: '100%' }}>
                <thead>
                    <tr>
                        <th style={{ width: '28%' }}>Account</th>
                        <th>Description</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                        <th style={{ width: 120, textAlign: 'right' }}>Credit</th>
                        <th style={{ width: 60 }} />
                    </tr>
                </thead>
                <tbody>
                    {lines.map((l, idx) => (
                        <tr key={idx}>
                            <td>
                                <select style={inputStyle} value={l.accountId} onChange={(e) => updateLine(idx, { accountId: e.target.value })}>
                                    <option value="">— Select —</option>
                                    {accounts.map((a) => (
                                        <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>
                                    ))}
                                </select>
                            </td>
                            <td>
                                <input style={inputStyle} value={l.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                            </td>
                            <td>
                                <input type="number" step="0.01" min="0" style={{ ...inputStyle, textAlign: 'right' }} value={l.debit} onChange={(e) => updateLine(idx, { debit: e.target.value, credit: '' })} />
                            </td>
                            <td>
                                <input type="number" step="0.01" min="0" style={{ ...inputStyle, textAlign: 'right' }} value={l.credit} onChange={(e) => updateLine(idx, { credit: e.target.value, debit: '' })} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button type="button" style={outlineBtnStyle} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} disabled={lines.length <= 2}>
                                    <Trash2 size={14} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>Totals</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totals.debit)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totals.credit)}</td>
                        <td />
                    </tr>
                </tfoot>
            </table>

            {totals.balanced ? null : (
                <div style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>
                    Out of balance by {money(Math.abs(totals.debit - totals.credit))}
                </div>
            )}

            <AcctError message={err} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" style={primaryBtnStyle} disabled={saving || !totals.balanced}>
                    {saving ? 'Posting…' : 'Post journal'}
                </button>
            </div>
        </form>
    );
}

export default function SupplierTransactionHub() {
    const [tab, setTab] = useState('payment');
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [lastPosted, setLastPosted] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const list = await getSupplierAccounts({ status: 'active' });
            setAccounts(Array.isArray(list) ? list : list?.accounts || []);
        } catch (e) {
            setErr(e?.message || 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title="Transaction Hub"
                action={(
                    <div style={{ display: 'flex', gap: 6 }}>
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                style={tab === t.id ? primaryBtnStyle : outlineBtnStyle}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
            >
                <AcctError message={err} />
                {loading ? <div style={{ padding: 12, color: '#64748B' }}>Loading accounts…</div> : (
                    <>
                        {tab === 'payment' && <PaymentReceiptForm variant="payment" accounts={accounts} onPosted={setLastPosted} />}
                        {tab === 'receipt' && <PaymentReceiptForm variant="receipt" accounts={accounts} onPosted={setLastPosted} />}
                        {tab === 'journal' && <GeneralJournalForm accounts={accounts} onPosted={setLastPosted} />}
                    </>
                )}
                {lastPosted ? (
                    <div style={{ marginTop: 14, padding: 12, background: '#ECFDF5', borderRadius: 10, color: '#065F46', fontWeight: 700, fontSize: 13 }}>
                        Posted entry <strong>{lastPosted.entryNumber}</strong> — total {money(lastPosted.totalDebit)}.
                    </div>
                ) : null}
            </AcctCard>
        </div>
    );
}
