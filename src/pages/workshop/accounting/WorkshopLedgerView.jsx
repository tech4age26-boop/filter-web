import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Book, Filter, RefreshCw, Search } from 'lucide-react';
import { getAccountLedger, getAccountsList } from '../../../services/ledgerApi';
import { accT } from '../../../utils/accountingI18n';
import '../../../styles/admin/AccountingPage.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function WorkshopLedgerView({ locale: localeProp } = {}) {
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const [accounts, setAccounts] = useState([]);
    const [accountId, setAccountId] = useState('');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [ledger, setLedger] = useState(null);
    const [loadingAccounts, setLoadingAccounts] = useState(true);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [error, setError] = useState('');
    const accountsRef = useRef([]);

    const loadAccounts = useCallback(async () => {
        setLoadingAccounts(true);
        try {
            const res = await getAccountsList({ limit: 1000 });
            const list = Array.isArray(res) ? res : (res?.items ?? res?.accounts ?? []);
            accountsRef.current = list;
            setAccounts(list);
        } catch (e) {
            setError(e?.message || t('ledger.loadAccountsFailed'));
        } finally {
            setLoadingAccounts(false);
        }
    }, [t]);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return accounts.slice(0, 400);
        return accounts.filter((a) =>
            String(a.code || '').toLowerCase().includes(term) ||
            String(a.name || '').toLowerCase().includes(term),
        ).slice(0, 400);
    }, [accounts, search]);

    const loadLedger = useCallback(async () => {
        if (!accountId) {
            setLedger(null);
            return;
        }
        setLoadingLedger(true);
        setError('');
        try {
            const res = await getAccountLedger(accountId, {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                limit: 500,
            });
            setLedger(res);
        } catch (e) {
            setError(e?.message || t('ledger.loadFailed'));
        } finally {
            setLoadingLedger(false);
        }
    }, [accountId, dateFrom, dateTo, t]);

    useEffect(() => { loadLedger(); }, [loadLedger]);

    const totals = useMemo(() => {
        if (!ledger?.lines) return { debit: 0, credit: 0 };
        return ledger.lines.reduce(
            (acc, l) => ({ debit: acc.debit + Number(l.debit), credit: acc.credit + Number(l.credit) }),
            { debit: 0, credit: 0 },
        );
    }, [ledger]);

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Book size={20} style={{ marginRight: 8 }} />{t('ledger.title')}</h2>
                <p className="cash-bank-desc">
                    {t('ledger.desc')}
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                <div>
                    <label className="form-label">{t('ledger.searchAccounts')}</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', top: 12, left: 10, color: '#94A3B8' }} />
                        <input
                            type="text"
                            className="form-input-field"
                            style={{ paddingLeft: 30 }}
                            value={search}
                            placeholder={t('ledger.searchPh')}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <label className="form-label">{t('ledger.account')}</label>
                    <select className="form-input-field" value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={loadingAccounts}>
                        <option value="">{loadingAccounts ? t('loading') : t('ledger.selectAccount')}</option>
                        {filtered.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.code} · {a.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">{t('date.from')}</label>
                    <input type="date" className="form-input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">{t('date.to')}</label>
                    <input type="date" className="form-input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal" onClick={loadLedger} disabled={loadingLedger}>
                        <Filter size={14} style={{ marginRight: 6 }} /> {t('date.apply')}
                    </button>
                </div>
            </section>

            {ledger?.account ? (
                <div className="cash-bank-stats" style={{ marginBottom: 12 }}>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><Book size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">{ledger.account.code} · {ledger.account.name}</p>
                            <p className="cash-bank-stat-value">SAR {fmt(ledger.closingRunningBalance)}</p>
                            <p className="cash-bank-stat-meta">
                                {ledger.account.type} · {t('ledger.meta.normal')} {ledger.account.normalBalance}
                                {ledger.truncated ? ` · ${t('ledger.meta.showing', { returned: ledger.returnedLines, total: ledger.totalLines })}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="cash-bank-stat-card">
                        <div className="cash-bank-stat-icon"><RefreshCw size={24} /></div>
                        <div>
                            <p className="cash-bank-stat-label">{t('ledger.periodMovement')}</p>
                            <p className="cash-bank-stat-value">{t('ledger.dr', { n: fmt(totals.debit) })}</p>
                            <p className="cash-bank-stat-meta">{t('ledger.cr', { n: fmt(totals.credit) })}</p>
                        </div>
                    </div>
                </div>
            ) : null}

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>
                        {loadingLedger ? t('loading') :
                            ledger?.lines?.length ? t('ledger.lines', { n: ledger.returnedLines }) : t('ledger.noData')}
                    </strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('ledger.th.date')}</th>
                            <th className="table-th">{t('ledger.th.entryNo')}</th>
                            <th className="table-th">{t('ledger.th.type')}</th>
                            <th className="table-th">{t('ledger.th.description')}</th>
                            <th className="table-th">{t('ledger.th.source')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.debit')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.credit')}</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>{t('ledger.th.running')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!accountId ? (
                            <tr><td colSpan={8} className="table-cell table-empty">{t('ledger.pickAccount')}</td></tr>
                        ) : (ledger?.lines ?? []).length === 0 ? (
                            <tr><td colSpan={8} className="table-cell table-empty">{t('ledger.noEntries')}</td></tr>
                        ) : ledger.lines.map((l) => (
                            <tr key={l.id}>
                                <td className="table-cell">{new Date(l.date).toLocaleDateString()}</td>
                                <td className="table-cell" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{l.entryNumber}</td>
                                <td className="table-cell">{l.journalType}</td>
                                <td className="table-cell" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {l.lineDescription || l.journalDescription || '—'}
                                </td>
                                <td className="table-cell">{l.source ?? '—'}</td>
                                <td className="table-cell" style={{ textAlign: 'right' }}>{l.debit ? `SAR ${fmt(l.debit)}` : '—'}</td>
                                <td className="table-cell" style={{ textAlign: 'right' }}>{l.credit ? `SAR ${fmt(l.credit)}` : '—'}</td>
                                <td className="table-cell" style={{ textAlign: 'right', fontWeight: 600 }}>SAR {fmt(l.runningBalance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
