import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CreditCard, Plus, Receipt, Trash2 } from 'lucide-react';
import {
    getBrandAccounts,
    listBrandPayments,
    listBrandReceipts,
    postBrandGeneralJournal,
    postBrandPayment,
    postBrandReceipt,
    unwrapBrandAccounts,
} from '../../../../services/storageFacilityAccountingApi';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from '../../accounting/SupplierAccountingShared';

const PAY_TYPES = [
    { value: 'customer', label: 'Customer' },
    { value: 'others', label: 'Others' },
];

function emptyLine(headerDate) {
    return {
        lineDate: headerDate || todayISO(),
        payType: 'customer',
        payeeValue: '',
        accountId: '',
        amount: '',
        lineReference: '',
        notes: '',
    };
}

function emptyJournalLine() {
    return { accountId: '', debit: '', credit: '', lineReference: '', notes: '' };
}

function cashLabel(a) {
    return `[${a.code}] ${a.name} — ${money(a.balance ?? 0)}`;
}

function partyFromRow(row) {
    if (row.payType === 'customer' && row.payeeValue) {
        return { partyType: 'storage_customer', partyId: row.payeeValue };
    }
    return {};
}

function BrandPayReceiptGrid({ brandId, variant, accounts, customers, onPosted }) {
    const leafAccounts = useMemo(
        () => (accounts || []).filter((a) => !a.hasChildren),
        [accounts],
    );
    const cashOptions = leafAccounts.filter((a) => a.isCashEquivalent);
    const lineAccounts =
        variant === 'payment'
            ? leafAccounts.filter((a) => a.type === 'LIABILITY' || a.type === 'EXPENSE')
            : leafAccounts.filter((a) => !a.isCashEquivalent);

    const [headerDate, setHeaderDate] = useState(todayISO());
    const [headerRef, setHeaderRef] = useState('');
    const [generalNote, setGeneralNote] = useState('');
    const [cashAccountId, setCashAccountId] = useState('');
    const [lines, setLines] = useState(() => [emptyLine(todayISO())]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cashAccountId && cashOptions[0]?.id) setCashAccountId(String(cashOptions[0].id));
    }, [cashOptions, cashAccountId]);

    const total = useMemo(
        () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [lines],
    );

    const validCount = useMemo(
        () =>
            lines.filter(
                (l) =>
                    l.accountId &&
                    Number(l.amount) > 0 &&
                    (l.payType === 'others' || (l.payeeValue && String(l.payeeValue).trim())),
            ).length,
        [lines],
    );

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    function addLine() {
        setLines((ls) => [...ls, emptyLine(headerDate)]);
    }

    function handleTabFromNotes(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey || idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function saveAll(e) {
        e.preventDefault();
        setErr('');
        if (!cashAccountId) {
            setErr('Select a cash/bank account.');
            return;
        }
        const clean = lines.filter(
            (l) =>
                l.accountId &&
                Number(l.amount) > 0 &&
                (l.payType === 'others' || (l.payeeValue && String(l.payeeValue).trim())),
        );
        if (clean.length === 0) {
            setErr('Add at least one valid row.');
            return;
        }
        setSaving(true);
        const posted = [];
        try {
            for (const l of clean) {
                const body = {
                    date: l.lineDate || headerDate,
                    cashAccountId,
                    description: generalNote.trim() || undefined,
                    reference: headerRef.trim() || undefined,
                    lines: [
                        {
                            accountId: l.accountId,
                            amount: Number(l.amount),
                            description: l.notes?.trim() || undefined,
                            lineReference: l.lineReference?.trim() || undefined,
                            ...partyFromRow(l),
                        },
                    ],
                };
                const res =
                    variant === 'payment'
                        ? await postBrandPayment(brandId, body)
                        : await postBrandReceipt(brandId, body);
                posted.push(res);
            }
            onPosted?.(posted);
            setLines([emptyLine(headerDate)]);
            setGeneralNote('');
            setHeaderRef('');
        } catch (ex) {
            setErr(ex?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={saveAll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                {variant === 'payment'
                    ? 'Payments — Dr expense/payable, Cr cash/bank. Tab from Notes on the last row adds a line.'
                    : 'Receipts — Dr cash/bank, Cr revenue/AR. Tab from Notes on the last row adds a line.'}
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                }}
            >
                <Field label="Date" required>
                    <input
                        type="date"
                        style={inputStyle}
                        value={headerDate}
                        onChange={(e) => setHeaderDate(e.target.value)}
                        required
                    />
                </Field>
                <Field label="Reference number">
                    <input style={inputStyle} value={headerRef} onChange={(e) => setHeaderRef(e.target.value)} />
                </Field>
                <Field label="General note">
                    <input style={inputStyle} value={generalNote} onChange={(e) => setGeneralNote(e.target.value)} />
                </Field>
                <Field label="Paid from / Receipt to account *" required>
                    <select
                        style={inputStyle}
                        value={cashAccountId}
                        onChange={(e) => setCashAccountId(e.target.value)}
                        required
                    >
                        <option value="">— Select —</option>
                        {cashOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {cashLabel(a)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 900 }}>
                    <thead>
                        <tr>
                            <th>Voucher</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Payee</th>
                            <th>{variant === 'payment' ? 'Account Dr' : 'Account Cr'}</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th>Ref</th>
                            <th>Notes</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx}>
                                <td>{variant === 'payment' ? 'PE' : 'RC'}{String(idx + 1).padStart(4, '0')}</td>
                                <td>
                                    <input
                                        type="date"
                                        style={inputStyle}
                                        value={l.lineDate || headerDate}
                                        onChange={(e) => updateLine(idx, { lineDate: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <select
                                        style={inputStyle}
                                        value={l.payType}
                                        onChange={(e) =>
                                            updateLine(idx, { payType: e.target.value, payeeValue: '' })
                                        }
                                    >
                                        {PAY_TYPES.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    {l.payType === 'customer' ? (
                                        <select
                                            style={inputStyle}
                                            value={l.payeeValue}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                updateLine(idx, { payeeValue: id });
                                                if (variant === 'receipt' && id) {
                                                    const ar = lineAccounts.find((a) => a.code === '1100');
                                                    if (ar) updateLine(idx, { accountId: String(ar.id) });
                                                }
                                            }}
                                        >
                                            <option value="">Select customer…</option>
                                            {customers.map((c) => (
                                                <option key={c.id} value={String(c.id)}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                                    )}
                                </td>
                                <td>
                                    <select
                                        style={inputStyle}
                                        value={l.accountId}
                                        onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                                    >
                                        <option value="">Select account…</option>
                                        {lineAccounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                [{a.code}] {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.amount}
                                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) => updateLine(idx, { lineReference: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => handleTabFromNotes(e, idx)}
                                    />
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        style={{ ...outlineBtnStyle, color: '#B91C1C' }}
                                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                        disabled={lines.length === 1}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                    {validCount} row(s) — {money(total)}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={addLine}>
                        <Plus size={14} /> Add row
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validCount === 0}>
                        {saving ? 'Saving…' : variant === 'payment' ? 'Save payments' : 'Save receipts'}
                    </button>
                </div>
            </div>
            <AcctError message={err} />
        </form>
    );
}

function BrandJournalGrid({ brandId, accounts, headerDate, headerRef, generalNote, onPosted }) {
    const leafAccounts = useMemo(
        () => (accounts || []).filter((a) => !a.hasChildren),
        [accounts],
    );
    const [lines, setLines] = useState(() => [emptyJournalLine(), emptyJournalLine()]);
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

    function addLine() {
        setLines((ls) => [...ls, emptyJournalLine()]);
    }

    function onNotesKeyDown(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey || idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function submit(e) {
        e.preventDefault();
        if (!totals.balanced) {
            setErr('Debits must equal credits.');
            return;
        }
        const cleanLines = lines
            .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
            .map((l) => ({
                accountId: l.accountId,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                description: [l.lineReference, l.notes].filter(Boolean).join(' | ') || undefined,
            }));
        setSaving(true);
        try {
            const res = await postBrandGeneralJournal(brandId, {
                date: headerDate,
                description: generalNote.trim() || undefined,
                reference: headerRef.trim() || undefined,
                lines: cleanLines,
            });
            onPosted?.([res]);
            setLines([emptyJournalLine(), emptyJournalLine()]);
        } catch (ex) {
            setErr(ex?.message || 'Post failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 720 }}>
                    <thead>
                        <tr>
                            <th>Account</th>
                            <th style={{ textAlign: 'right' }}>Debit</th>
                            <th style={{ textAlign: 'right' }}>Credit</th>
                            <th>Ref</th>
                            <th>Notes</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx}>
                                <td>
                                    <select
                                        style={inputStyle}
                                        value={l.accountId}
                                        onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                                    >
                                        <option value="">—</option>
                                        {leafAccounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                [{a.code}] {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.debit}
                                        onChange={(e) => updateLine(idx, { debit: e.target.value, credit: '' })}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.credit}
                                        onChange={(e) => updateLine(idx, { credit: e.target.value, debit: '' })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) => updateLine(idx, { lineReference: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => onNotesKeyDown(e, idx)}
                                    />
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        style={outlineBtnStyle}
                                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                        disabled={lines.length <= 2}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>Totals</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totals.debit)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totals.credit)}</td>
                            <td colSpan={3} />
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" style={outlineBtnStyle} onClick={addLine}>
                    <Plus size={14} /> Add row
                </button>
                <button type="submit" style={primaryBtnStyle} disabled={saving || !totals.balanced}>
                    {saving ? 'Posting…' : 'Save journal'}
                </button>
            </div>
            <AcctError message={err} />
        </form>
    );
}

export default function StorageBrandTransactionHub({ brandId, customers = [] }) {
    const [tab, setTab] = useState('payment');
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [gjDate, setGjDate] = useState(todayISO());
    const [gjRef, setGjRef] = useState('');
    const [gjNote, setGjNote] = useState('');
    const [lastPosted, setLastPosted] = useState(null);
    const [recentPayments, setRecentPayments] = useState([]);
    const [recentReceipts, setRecentReceipts] = useState([]);

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getBrandAccounts(brandId);
            setAccounts(unwrapBrandAccounts(res));
        } catch (e) {
            setErr(e?.message || 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    const reloadRecent = useCallback(async () => {
        try {
            const [p, r] = await Promise.all([
                listBrandPayments(brandId, { limit: 8 }),
                listBrandReceipts(brandId, { limit: 8 }),
            ]);
            setRecentPayments(p?.journals ?? []);
            setRecentReceipts(r?.journals ?? []);
        } catch {
            /* ignore */
        }
    }, [brandId]);

    useEffect(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        reloadRecent();
    }, [reloadRecent, lastPosted]);

    const tabBtn = (id, label, Icon) => (
        <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tab === id ? 'sf-brand-hub-tab sf-brand-hub-tab--active' : 'sf-brand-hub-tab'}
        >
            {Icon ? <Icon size={16} /> : null}
            {label}
        </button>
    );

    return (
        <AcctCard title="Transaction entry">
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : (
                <>
                    <div className="sf-brand-hub-tabs">
                        {tabBtn('payment', 'Payments', CreditCard)}
                        {tabBtn('receipt', 'Receipts', Receipt)}
                        {tabBtn('journal', 'Journal entry', ArrowLeftRight)}
                    </div>
                    {tab === 'payment' ? (
                        <BrandPayReceiptGrid
                            brandId={brandId}
                            variant="payment"
                            accounts={accounts}
                            customers={customers}
                            onPosted={(j) => {
                                setLastPosted(j?.[j.length - 1]);
                                reloadRecent();
                            }}
                        />
                    ) : null}
                    {tab === 'receipt' ? (
                        <BrandPayReceiptGrid
                            brandId={brandId}
                            variant="receipt"
                            accounts={accounts}
                            customers={customers}
                            onPosted={(j) => {
                                setLastPosted(j?.[j.length - 1]);
                                reloadRecent();
                            }}
                        />
                    ) : null}
                    {tab === 'journal' ? (
                        <>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                    gap: 12,
                                    marginBottom: 12,
                                }}
                            >
                                <Field label="Date">
                                    <input
                                        type="date"
                                        style={inputStyle}
                                        value={gjDate}
                                        onChange={(e) => setGjDate(e.target.value)}
                                    />
                                </Field>
                                <Field label="Reference">
                                    <input style={inputStyle} value={gjRef} onChange={(e) => setGjRef(e.target.value)} />
                                </Field>
                                <Field label="Note">
                                    <input style={inputStyle} value={gjNote} onChange={(e) => setGjNote(e.target.value)} />
                                </Field>
                            </div>
                            <BrandJournalGrid
                                brandId={brandId}
                                accounts={accounts}
                                headerDate={gjDate}
                                headerRef={gjRef}
                                generalNote={gjNote}
                                onPosted={(j) => {
                                    setLastPosted(j?.[0]);
                                    reloadRecent();
                                }}
                            />
                        </>
                    ) : null}
                    {lastPosted ? (
                        <p style={{ marginTop: 12, color: '#065f46', fontWeight: 700, fontSize: 13 }}>
                            Last saved: {lastPosted.entryNumber} — {money(lastPosted.totalDebit)}
                        </p>
                    ) : null}
                    <div style={{ marginTop: 20 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800 }}>Recent payments</h4>
                        {recentPayments.length === 0 ? (
                            <AcctEmpty message="No recent payments." />
                        ) : (
                            <ul style={{ fontSize: 13 }}>
                                {recentPayments.map((j) => (
                                    <li key={j.id}>
                                        {j.entryNumber} · {fmtDate(j.date)} · {money(j.totalDebit)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 800 }}>Recent receipts</h4>
                        {recentReceipts.length === 0 ? (
                            <AcctEmpty message="No recent receipts." />
                        ) : (
                            <ul style={{ fontSize: 13 }}>
                                {recentReceipts.map((j) => (
                                    <li key={j.id}>
                                        {j.entryNumber} · {fmtDate(j.date)} · {money(j.totalCredit)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </AcctCard>
    );
}
