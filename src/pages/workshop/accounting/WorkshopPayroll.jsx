import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Trash2, Save, RefreshCw, Users } from 'lucide-react';
import {
    bulkCreateSalaryPayments,
    getSalaryPayments,
} from '../../../services/advancesApi';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import { getWorkshopEmployees } from '../../../services/workshopStaffApi';
import { payrollT } from '../../../utils/payrollI18n';
import '../../../styles/admin/AccountingPage.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const defaultPeriod = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const emptyRow = () => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: '',
    employeeName: '',
    gross: '',
    deduction: '0',
    payFromAccountId: '',
    notes: '',
});

export default function WorkshopPayroll() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => payrollT(locale, key, vars), [locale]);

    const [period, setPeriod] = useState(defaultPeriod());
    const [paymentDate, setPaymentDate] = useState(todayIso());
    const [rows, setRows] = useState([emptyRow()]);
    const [employees, setEmployees] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [recent, setRecent] = useState([]);
    const [loadingLookups, setLoadingLookups] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const loadLookups = useCallback(async () => {
        setLoadingLookups(true);
        try {
            const [empRes, cashRes, salRes] = await Promise.all([
                getWorkshopEmployees({ limit: 200 }).catch(() => ({ items: [] })),
                listCashBankAccounts({}).catch(() => ({ accounts: [] })),
                getSalaryPayments({ limit: 20 }).catch(() => []),
            ]);
            const empItems = empRes?.items ?? empRes?.employees ?? empRes ?? [];
            setEmployees(Array.isArray(empItems) ? empItems : []);
            setAccounts(cashRes?.accounts ?? cashRes?.items ?? []);
            setRecent(Array.isArray(salRes) ? salRes : (salRes?.items ?? []));
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoadingLookups(false);
        }
    }, [t]);

    useEffect(() => { loadLookups(); }, [loadLookups]);

    const totals = useMemo(() => {
        const gross = rows.reduce((s, r) => s + (Number(r.gross) || 0), 0);
        const deduction = rows.reduce((s, r) => s + (Number(r.deduction) || 0), 0);
        return { gross, deduction, net: Math.max(gross - deduction, 0) };
    }, [rows]);

    const setRow = (idx, patch) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (idx) => setRows((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

    const handleEmployeeChange = (idx, employeeId) => {
        const emp = employees.find((e) => String(e.id) === String(employeeId));
        setRow(idx, {
            employeeId,
            employeeName: emp?.name || emp?.fullName || emp?.email || '',
        });
    };

    const submit = async () => {
        setMsg('');
        setError('');
        const items = rows.filter((r) => r.employeeId && Number(r.gross) > 0);
        if (items.length === 0) {
            setError(t('err.needRow'));
            return;
        }
        for (const r of items) {
            if (!r.payFromAccountId) {
                setError(t('err.needPayFrom'));
                return;
            }
        }
        setSubmitting(true);
        try {
            const payload = {
                rows: items.map((r) => ({
                    employeeId: String(r.employeeId),
                    employeeName: r.employeeName,
                    period,
                    paymentDate,
                    grossSalary: Number(r.gross),
                    advanceDeduction: Number(r.deduction || 0),
                    payFromAccountId: String(r.payFromAccountId),
                    notes: r.notes?.trim() || undefined,
                })),
            };
            const res = await bulkCreateSalaryPayments(payload);
            setMsg(t('msg.saved', { n: res?.saved ?? items.length, total: fmt(res?.total ?? totals.gross) }));
            setRows([emptyRow()]);
            await loadLookups();
        } catch (e) {
            setError(e?.message || t('err.submit'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Users size={20} style={{ marginRight: 8 }} /> {t('title')}</h2>
                <p className="cash-bank-desc">
                    {t('subtitle')}
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}
            {msg ? <p className="form-help-text" style={{ color: '#065F46' }}>{msg}</p> : null}

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div>
                    <label className="form-label">{t('label.period')}</label>
                    <input type="month" className="form-input-field" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">{t('label.paymentDate')}</label>
                    <input type="date" className="form-input-field" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-portal-outline" disabled={loadingLookups} onClick={loadLookups}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> {t('btn.refreshLookups')}
                    </button>
                </div>
            </section>

            <section className="premium-table cash-bank-table" style={{ marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('th.employee')}</th>
                            <th className="table-th">{t('th.gross')}</th>
                            <th className="table-th">{t('th.deduction')}</th>
                            <th className="table-th">{t('th.netAuto')}</th>
                            <th className="table-th">{t('th.payFrom')}</th>
                            <th className="table-th">{t('th.notes')}</th>
                            <th className="table-th"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, idx) => {
                            const net = Math.max((Number(r.gross) || 0) - (Number(r.deduction) || 0), 0);
                            return (
                                <tr key={r.key}>
                                    <td className="table-cell">
                                        <select className="form-input-field" value={r.employeeId} onChange={(e) => handleEmployeeChange(idx, e.target.value)}>
                                            <option value="">{t('opt.select')}</option>
                                            {employees.map((e) => (
                                                <option key={e.id} value={e.id}>{e.name || e.fullName || e.email}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="table-cell">
                                        <input type="number" min="0" step="0.01" className="form-input-field" value={r.gross} onChange={(e) => setRow(idx, { gross: e.target.value })} />
                                    </td>
                                    <td className="table-cell">
                                        <input type="number" min="0" step="0.01" className="form-input-field" value={r.deduction} onChange={(e) => setRow(idx, { deduction: e.target.value })} />
                                    </td>
                                    <td className="table-cell">SAR {fmt(net)}</td>
                                    <td className="table-cell">
                                        <select className="form-input-field" value={r.payFromAccountId} onChange={(e) => setRow(idx, { payFromAccountId: e.target.value })}>
                                            <option value="">{t('opt.selectAccount')}</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name} {a.coaCode ? `· ${a.coaCode}` : ''}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="table-cell">
                                        <input type="text" className="form-input-field" value={r.notes} onChange={(e) => setRow(idx, { notes: e.target.value })} placeholder={t('ph.notes')} />
                                    </td>
                                    <td className="table-cell">
                                        <button type="button" className="btn-edit-zone" onClick={() => removeRow(idx)} disabled={rows.length <= 1}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <button type="button" className="btn-portal-outline" onClick={addRow}>
                    <Plus size={14} style={{ marginRight: 6 }} /> {t('btn.addRow')}
                </button>
                <div style={{ marginLeft: 'auto', color: '#0F172A' }}>
                    <strong>{t('totals.gross')}</strong> SAR {fmt(totals.gross)}
                    {' · '}<strong>{t('totals.deductions')}</strong> SAR {fmt(totals.deduction)}
                    {' · '}<strong>{t('totals.net')}</strong> SAR {fmt(totals.net)}
                </div>
                <button type="button" className="btn-portal" disabled={submitting} onClick={submit}>
                    <Save size={14} style={{ marginRight: 6 }} /> {submitting ? t('btn.submitting') : t('btn.submit')}
                </button>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                    <strong>{t('recent.title')}</strong>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('recent.th.date')}</th>
                            <th className="table-th">{t('recent.th.employee')}</th>
                            <th className="table-th">{t('recent.th.period')}</th>
                            <th className="table-th">{t('recent.th.gross')}</th>
                            <th className="table-th">{t('recent.th.deduction')}</th>
                            <th className="table-th">{t('recent.th.net')}</th>
                            <th className="table-th">{t('recent.th.payFrom')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr><td colSpan={7} className="table-cell table-empty">{t('recent.empty')}</td></tr>
                        ) : recent.map((s) => (
                            <tr key={s.id}>
                                <td className="table-cell">{s.paymentDate ? new Date(s.paymentDate).toLocaleDateString() : '—'}</td>
                                <td className="table-cell">{s.employeeName}</td>
                                <td className="table-cell">{s.period}</td>
                                <td className="table-cell">SAR {fmt(s.grossSalary)}</td>
                                <td className="table-cell">SAR {fmt(s.advanceDeduction)}</td>
                                <td className="table-cell">SAR {fmt(s.netSalary)}</td>
                                <td className="table-cell">{s.payFromAccountName ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
