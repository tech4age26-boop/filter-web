import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, RefreshCw, Wallet } from 'lucide-react';
import {
    listLogFilterUsers,
    listPettyCashExpensesLog,
} from '../../../services/accountingLogsApi';
import { useHqAdminBooksScope } from '../../../hooks/useHqAdminBooksScope';
import '../../../styles/admin/AccountingPage.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function sidebarBranchToFilter(selectedBranchId) {
    return selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '';
}

function formatFilterUserLabel(u) {
    const name = u.name || u.email || u.id;
    const role = u.role ? String(u.role).replace(/_/g, ' ') : '';
    return role ? `${name} (${role})` : name;
}

export default function WorkshopExpensesLog({ branches = [], selectedBranchId = 'all' }) {
    const { isAdminHqBooks } = useHqAdminBooksScope();
    const [branchId, setBranchId] = useState(() => sidebarBranchToFilter(selectedBranchId));
    const [userId, setUserId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listPettyCashExpensesLog({
                ...(isAdminHqBooks ? {} : { branchId: branchId || undefined }),
                userId: userId || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                search: search.trim() || undefined,
                limit: 200,
            });
            setRows(res?.items ?? []);
            setTotal(res?.total ?? 0);
        } catch (e) {
            setError(e?.message || 'Could not load expenses.');
        } finally {
            setLoading(false);
        }
    }, [branchId, userId, dateFrom, dateTo, search, isAdminHqBooks]);

    useEffect(() => {
        if (!isAdminHqBooks) {
            setBranchId(sidebarBranchToFilter(selectedBranchId));
        }
    }, [selectedBranchId, isAdminHqBooks]);

    const branchScopeForUsers = isAdminHqBooks ? undefined : (branchId || undefined);

    useEffect(() => {
        listLogFilterUsers({ branchId: branchScopeForUsers })
            .then((res) => {
                const nextUsers = res?.users ?? [];
                setUsers(nextUsers);
                setUserId((prev) => (prev && nextUsers.some((u) => String(u.id) === String(prev)) ? prev : ''));
            })
            .catch(() => {
                setUsers([]);
                setUserId('');
            });
    }, [branchScopeForUsers]);

    useEffect(() => { reload(); }, [reload]);

    const totalAmount = useMemo(
        () => rows.reduce((s, r) => s + Number(r.amount), 0),
        [rows],
    );

    const colSpan = isAdminHqBooks ? 6 : 7;

    return (
        <div className="accounting-page module-container">
            <header className="cash-bank-header">
                <h2 className="cash-bank-title"><Wallet size={20} style={{ marginRight: 8 }} />Expenses</h2>
                <p className="cash-bank-desc">
                    {isAdminHqBooks
                        ? 'Platform HQ expense approvals — not scoped to workshop branches.'
                        : 'Approved petty-cash expense requests across all users and branches.'}
                </p>
            </header>

            {error ? <p className="form-help-text" style={{ color: '#B45309' }}>{error}</p> : null}

            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: '#fafafa',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
            }}>
                {!isAdminHqBooks ? (
                <div>
                    <label className="form-label">Branch</label>
                    <select className="form-input-field" value={branchId} onChange={(e) => {
                        setBranchId(e.target.value);
                        setUserId('');
                    }}>
                        <option value="">All branches</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                ) : null}
                <div>
                    <label className="form-label">User</label>
                    <select className="form-input-field" value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">All users</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>{formatFilterUserLabel(u)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label">From</label>
                    <input type="date" className="form-input-field" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">To</label>
                    <input type="date" className="form-input-field" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div>
                    <label className="form-label">Search</label>
                    <input type="search" className="form-input-field" placeholder="Category / description…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" className="btn-submit btn-dark" onClick={reload} disabled={loading}>
                        <Filter size={14} style={{ marginRight: 6 }} /> Apply
                    </button>
                </div>
            </section>

            <div className="cash-bank-stat-card" style={{ marginBottom: 16, maxWidth: 280 }}>
                <div>
                    <p className="cash-bank-stat-label">Total approved</p>
                    <p className="cash-bank-stat-value">SAR {fmt(totalAmount)}</p>
                    <p className="cash-bank-stat-meta">{rows.length} of {total} rows</p>
                </div>
            </div>

            <section className="premium-table cash-bank-table">
                <header style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{loading ? 'Loading…' : `${rows.length} entries`}</strong>
                    <button type="button" className="btn-portal-outline" onClick={reload} disabled={loading}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
                    </button>
                </header>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Amount</th>
                            <th className="table-th">Category</th>
                            <th className="table-th">User</th>
                            {!isAdminHqBooks ? <th className="table-th">Branch</th> : null}
                            <th className="table-th">Approved by</th>
                            <th className="table-th">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={colSpan} className="table-cell table-empty">{loading ? 'Loading…' : 'No expenses found.'}</td></tr>
                        ) : rows.map((r) => (
                            <tr key={r.id}>
                                <td className="table-cell">{r.approvedAt ? new Date(r.approvedAt).toLocaleDateString() : '—'}</td>
                                <td className="table-cell">SAR {fmt(r.amount)}</td>
                                <td className="table-cell">{r.category?.name ?? '—'}</td>
                                <td className="table-cell">{r.requestedBy?.name ?? r.requestedBy?.email ?? '—'}</td>
                                {!isAdminHqBooks ? <td className="table-cell">{r.branch?.name ?? '—'}</td> : null}
                                <td className="table-cell">{r.approvedBy?.name ?? '—'}</td>
                                <td className="table-cell" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.description ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
