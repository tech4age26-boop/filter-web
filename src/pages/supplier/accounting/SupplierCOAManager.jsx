import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    ChevronRight,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import {
    createSupplierAccount,
    deleteSupplierAccount,
    getSupplierAccountLedger,
    getSupplierAccounts,
    getSupplierAccountsTree,
    updateSupplierAccount,
} from '../../../services/supplierAccountingApi';
import {
    ACCOUNT_SUBTYPES_BY_TYPE,
    ACCOUNT_TYPES,
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    CASH_FLOW_CATEGORIES,
    Field,
    dangerBtnStyle,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
} from './SupplierAccountingShared';

const TYPE_LABELS = {
    ASSET: 'Assets',
    LIABILITY: 'Liabilities',
    EQUITY: 'Equity',
    INCOME: 'Revenue',
    EXPENSE: 'Expenses',
};

function emptyForm() {
    return {
        id: null,
        code: '',
        name: '',
        type: 'ASSET',
        subType: 'CURRENT',
        parentId: '',
        description: '',
        status: 'active',
        cashFlowCategory: '',
        isCashEquivalent: false,
        openingBalance: 0,
    };
}

function AccountForm({ initial, accounts, onCancel, onSaved }) {
    const [form, setForm] = useState(initial || emptyForm());
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const isEdit = !!initial?.id;

    const subtypes = ACCOUNT_SUBTYPES_BY_TYPE[form.type] || ['OTHER'];

    useEffect(() => {
        if (!subtypes.includes(form.subType)) {
            setForm((f) => ({ ...f, subType: subtypes[0] }));
        }
    }, [form.type]); // eslint-disable-line

    const parentOptions = (accounts || []).filter(
        (a) => a.type === form.type && a.id !== form.id,
    );

    async function submit(e) {
        e.preventDefault();
        setErr('');
        setSaving(true);
        try {
            const body = {
                code: form.code.trim(),
                name: form.name.trim(),
                type: form.type,
                subType: form.subType,
                parentId: form.parentId || undefined,
                description: form.description.trim() || undefined,
                status: form.status,
                cashFlowCategory: form.cashFlowCategory || undefined,
                isCashEquivalent: !!form.isCashEquivalent,
                openingBalance: Number(form.openingBalance || 0),
            };
            if (isEdit) {
                await updateSupplierAccount(form.id, body);
            } else {
                await createSupplierAccount(body);
            }
            onSaved();
        } catch (e) {
            setErr(e?.message || 'Failed to save account');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form
            onSubmit={submit}
            style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(2, minmax(200px, 1fr))',
                padding: 14,
                background: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.06)',
            }}
        >
            <Field label="Code" required>
                <input
                    style={inputStyle}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. 1100"
                    required
                />
            </Field>
            <Field label="Name" required>
                <input
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Account name"
                    required
                />
            </Field>
            <Field label="Type" required>
                <select
                    style={inputStyle}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                    {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>
                    ))}
                </select>
            </Field>
            <Field label="Sub-type" required>
                <select
                    style={inputStyle}
                    value={form.subType}
                    onChange={(e) => setForm({ ...form, subType: e.target.value })}
                >
                    {subtypes.map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                </select>
            </Field>
            <Field label="Parent">
                <select
                    style={inputStyle}
                    value={form.parentId || ''}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                >
                    <option value="">— None —</option>
                    {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                            [{p.code}] {p.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Cash flow category" hint="Tag cash/bank accounts so they show up in the Cash Flow statement.">
                <select
                    style={inputStyle}
                    value={form.cashFlowCategory || ''}
                    onChange={(e) => setForm({ ...form, cashFlowCategory: e.target.value })}
                >
                    {CASH_FLOW_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c || '— Auto —'}</option>
                    ))}
                </select>
            </Field>
            <Field label="Opening balance">
                <input
                    type="number"
                    step="0.01"
                    style={inputStyle}
                    value={form.openingBalance}
                    onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                />
            </Field>
            <Field label="Status">
                <select
                    style={inputStyle}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                </select>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, gridColumn: '1 / -1' }}>
                <input
                    type="checkbox"
                    checked={!!form.isCashEquivalent}
                    onChange={(e) => setForm({ ...form, isCashEquivalent: e.target.checked })}
                />
                Treat as a cash equivalent (cash/bank). Used by Cash Flow report scope.
            </label>
            <Field label="Description">
                <textarea
                    rows={2}
                    style={{ ...inputStyle, fontFamily: 'inherit' }}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
            </Field>
            {err ? <div style={{ gridColumn: '1 / -1' }}><AcctError message={err} /></div> : null}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" style={outlineBtnStyle} onClick={onCancel} disabled={saving}>Cancel</button>
                <button type="submit" style={primaryBtnStyle} disabled={saving}>
                    {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}
                </button>
            </div>
        </form>
    );
}

function LedgerDrawer({ account, onClose }) {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const load = useCallback(async () => {
        if (!account?.id) return;
        setLoading(true);
        setErr('');
        try {
            const res = await getSupplierAccountLedger(account.id, { dateFrom, dateTo, limit: 500 });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load ledger');
        } finally {
            setLoading(false);
        }
    }, [account?.id, dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    if (!account) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(960px, 95vw)',
                background: '#F8FAFC',
                zIndex: 1000,
                boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <header
                style={{
                    padding: '16px 20px',
                    background: '#ffffff',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                }}
            >
                <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
                        Ledger · {account.type}
                    </p>
                    <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                        [{account.code}] {account.name}
                    </h2>
                </div>
                <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Close">
                    <X size={22} />
                </button>
            </header>
            <div style={{ padding: '12px 20px', background: '#ffffff', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="From">
                    <input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </Field>
                <Field label="To">
                    <input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </Field>
                <button type="button" style={outlineBtnStyle} onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {loading ? <AcctLoading /> : err ? <AcctError message={err} /> : (
                    <>
                        {(data?.lines || []).length === 0 ? <AcctEmpty message="No journal lines in this range." /> : (
                            <table className="ws-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Entry #</th>
                                        <th>Description</th>
                                        <th>Reference</th>
                                        <th style={{ textAlign: 'right' }}>Debit</th>
                                        <th style={{ textAlign: 'right' }}>Credit</th>
                                        <th style={{ textAlign: 'right' }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(data?.lines || []).map((l) => (
                                        <tr key={l.id}>
                                            <td>{fmtDate(l.date)}</td>
                                            <td style={{ fontWeight: 700 }}>{l.entryNumber}</td>
                                            <td style={{ maxWidth: 280 }}>
                                                {l.lineDescription || l.journalDescription || '—'}
                                                {l.source ? (
                                                    <div style={{ fontSize: 11, color: '#64748B' }}>
                                                        {l.source}{l.sourceId ? ` · #${l.sourceId}` : ''}
                                                    </div>
                                                ) : null}
                                            </td>
                                            <td>{l.reference || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{Number(l.debit) > 0 ? money(l.debit) : '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{Number(l.credit) > 0 ? money(l.credit) : '—'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(l.runningBalance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default function SupplierCOAManager() {
    const [accounts, setAccounts] = useState([]);
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [view, setView] = useState('tree'); // 'tree' | 'flat'
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null);
    const [ledgerFor, setLedgerFor] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [flat, t] = await Promise.all([
                getSupplierAccounts(),
                getSupplierAccountsTree(),
            ]);
            setAccounts(Array.isArray(flat) ? flat : flat?.accounts || []);
            setTree(Array.isArray(t) ? t : t?.accounts || []);
        } catch (e) {
            setErr(e?.message || 'Failed to load chart of accounts');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (accounts || []).filter((a) => {
            if (filterType && a.type !== filterType) return false;
            if (!q) return true;
            return (
                a.name.toLowerCase().includes(q) ||
                String(a.code).toLowerCase().includes(q)
            );
        });
    }, [accounts, search, filterType]);

    async function handleDelete(id) {
        if (!confirm('Delete this account? System-seeded and posted accounts cannot be deleted.')) return;
        try {
            await deleteSupplierAccount(id);
            await reload();
        } catch (e) {
            alert(e?.message || 'Delete failed');
        }
    }

    function renderRow(a, depth = 0) {
        const normalDebit = a.type === 'ASSET' || a.type === 'EXPENSE';
        const balance = normalDebit ? a.closingDebit || 0 : a.closingCredit || 0;
        return (
            <tr key={a.id}>
                <td style={{ paddingLeft: 12 + depth * 22 }}>
                    <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', padding: 0, color: '#1D4ED8', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                        onClick={() => setLedgerFor(a)}
                    >
                        [{a.code}] {a.name}
                    </button>
                    {a.isAutoSeed ? (
                        <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#E0F2FE', color: '#075985', fontWeight: 700 }}>
                            System
                        </span>
                    ) : null}
                </td>
                <td>{a.type}</td>
                <td>{a.subType.replace(/_/g, ' ')}</td>
                <td style={{ textAlign: 'right' }}>{Number(a.closingDebit || 0) > 0 ? money(a.closingDebit) : '—'}</td>
                <td style={{ textAlign: 'right' }}>{Number(a.closingCredit || 0) > 0 ? money(a.closingCredit) : '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(balance)}</td>
                <td style={{ textAlign: 'right' }}>
                    <button type="button" style={outlineBtnStyle} onClick={() => setEditing(a)} title="Edit">
                        <Pencil size={14} />
                    </button>
                    {!a.isAutoSeed ? (
                        <button type="button" style={{ ...dangerBtnStyle, marginLeft: 6 }} onClick={() => handleDelete(a.id)} title="Delete">
                            <Trash2 size={14} />
                        </button>
                    ) : null}
                </td>
            </tr>
        );
    }

    function renderTreeNode(node, depth) {
        const rows = [renderRow(node, depth)];
        if (node.children?.length) {
            for (const child of node.children) {
                rows.push(...renderTreeNode(child, depth + 1));
            }
        }
        return rows;
    }

    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title="Chart of Accounts"
                action={(
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select style={{ ...inputStyle, width: 'auto' }} value={view} onChange={(e) => setView(e.target.value)}>
                            <option value="tree">Tree view</option>
                            <option value="flat">Flat list</option>
                        </select>
                        <select style={{ ...inputStyle, width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                            <option value="">All types</option>
                            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
                        </select>
                        <input
                            type="search"
                            placeholder="Search by code/name"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ ...inputStyle, width: 200 }}
                        />
                        <button type="button" style={primaryBtnStyle} onClick={() => { setCreating(true); setEditing(null); }}>
                            <Plus size={14} /> New Account
                        </button>
                    </div>
                )}
            >
                {creating || editing ? (
                    <div style={{ marginBottom: 14 }}>
                        <AccountForm
                            initial={editing}
                            accounts={accounts}
                            onCancel={() => { setCreating(false); setEditing(null); }}
                            onSaved={() => { setCreating(false); setEditing(null); reload(); }}
                        />
                    </div>
                ) : null}

                <AcctError message={err} />
                {loading ? <AcctLoading label="Loading accounts…" /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Type</th>
                                    <th>Sub-type</th>
                                    <th style={{ textAlign: 'right' }}>Debit Bal</th>
                                    <th style={{ textAlign: 'right' }}>Credit Bal</th>
                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {view === 'tree'
                                    ? tree
                                        .filter((n) => !filterType || n.type === filterType)
                                        .filter((n) => {
                                            const q = search.trim().toLowerCase();
                                            if (!q) return true;
                                            const matches = (a) =>
                                                a.name.toLowerCase().includes(q) ||
                                                String(a.code).toLowerCase().includes(q) ||
                                                (a.children || []).some(matches);
                                            return matches(n);
                                        })
                                        .flatMap((n) => renderTreeNode(n, 0))
                                    : filtered.map((a) => renderRow(a, 0))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#64748B' }}>
                                            No accounts match your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>

            {ledgerFor ? <LedgerDrawer account={ledgerFor} onClose={() => setLedgerFor(null)} /> : null}
        </div>
    );
}
