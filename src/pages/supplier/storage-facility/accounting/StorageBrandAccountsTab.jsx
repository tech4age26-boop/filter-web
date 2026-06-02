import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../../../../components/Modal';
import {
    createBrandAccount,
    getBrandAccounts,
    unwrapBrandAccounts,
} from '../../../../services/storageFacilityAccountingApi';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    money,
    primaryBtnStyle,
} from '../../accounting/SupplierAccountingShared';
import StorageBrandLedgerView from './StorageBrandLedgerView';

const CATEGORIES = ['Cash', 'Bank', 'AR', 'AP', 'Revenue', 'Expense', 'Equity', 'Other'];

export default function StorageBrandAccountsTab({ brandId }) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [ledgerAccount, setLedgerAccount] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({
        code: '',
        name: '',
        type: 'EXPENSE',
        accountCategory: 'Expense',
    });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await getBrandAccounts(brandId);
            setAccounts(unwrapBrandAccounts(res));
        } catch (e) {
            setErr(e?.message || 'Failed to load accounts');
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        load();
    }, [load]);

    if (ledgerAccount) {
        return (
            <StorageBrandLedgerView
                brandId={brandId}
                account={ledgerAccount}
                onBack={() => setLedgerAccount(null)}
            />
        );
    }

    async function submit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            await createBrandAccount(brandId, form);
            setModalOpen(false);
            setForm({ code: '', name: '', type: 'EXPENSE', accountCategory: 'Expense' });
            await load();
        } catch (ex) {
            window.alert(ex?.message || 'Failed to add account');
        } finally {
            setSaving(false);
        }
    }

    const grouped = CATEGORIES.map((cat) => ({
        cat,
        rows: accounts.filter((a) => (a.accountCategory || 'Other') === cat),
    })).filter((g) => g.rows.length > 0);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                    Chart of accounts for this brand. Accounts appear on the Transaction Hub.
                </p>
                <button type="button" className="mgr-si-btn-new" onClick={() => setModalOpen(true)}>
                    <Plus size={14} /> Add account
                </button>
            </div>
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : accounts.length === 0 ? (
                <AcctEmpty message="No accounts yet." />
            ) : (
                grouped.map(({ cat, rows }) => (
                    <AcctCard key={cat} title={cat} style={{ marginBottom: 16 }}>
                        <div className="sf-account-list">
                            {rows.map((a) => (
                                <button
                                    key={a.id}
                                    type="button"
                                    className="sf-account-list-row"
                                    onClick={() => setLedgerAccount(a)}
                                >
                                    <span>
                                        <strong>
                                            [{a.code}] {a.name}
                                        </strong>
                                        <small>{a.type}</small>
                                    </span>
                                    <span>{money(a.balance)}</span>
                                </button>
                            ))}
                        </div>
                    </AcctCard>
                ))
            )}
            {modalOpen ? (
                <Modal
                    title="Add account"
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !saving && setModalOpen(false)}
                >
                    <form className="sf-simple-form" onSubmit={submit}>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label>Code *</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="sf-form-field">
                                <label>Category</label>
                                <select
                                    value={form.accountCategory}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, accountCategory: e.target.value }))
                                    }
                                >
                                    {CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="sf-form-field">
                            <label>Name *</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="sf-form-field">
                            <label>Account type</label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                            >
                                <option value="ASSET">Asset</option>
                                <option value="LIABILITY">Liability</option>
                                <option value="EQUITY">Equity</option>
                                <option value="REVENUE">Revenue</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={saving}
                                onClick={() => setModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" style={primaryBtnStyle} disabled={saving}>
                                Save account
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
