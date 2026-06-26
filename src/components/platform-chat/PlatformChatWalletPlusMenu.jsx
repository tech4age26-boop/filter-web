import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Banknote, History, Receipt } from 'lucide-react';
import Modal from '../Modal';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import ExpenseProofPicker from '../accounting/ExpenseProofPicker';
import ExpenseProofThumbnail from '../accounting/ExpenseProofThumbnail';
import { adminWalletExpenseComboboxOptions } from '../../constants/adminWalletExpenseCategories';
import { formatSar } from './PlatformChatWalletMessage';
import '../../styles/admin/PlatformChatWallet.css';

export default function PlatformChatWalletPlusMenu({
    api,
    conversationId,
    showRequestFunds,
    showRecordExpense,
    showTransactionHistory,
    disabled,
    onMessageSent,
    onError,
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [fundOpen, setFundOpen] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const [fundAmount, setFundAmount] = useState('');
    const [fundPurpose, setFundPurpose] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('');
    const [expenseCategorySearch, setExpenseCategorySearch] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseVendor, setExpenseVendor] = useState('');
    const [expenseProofPreview, setExpenseProofPreview] = useState(null);

    const expenseCategoryOptions = useMemo(() => adminWalletExpenseComboboxOptions(), []);

    const [historyRows, setHistoryRows] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const menuRef = useRef(null);

    const hasAnyOption = showRequestFunds || showRecordExpense || showTransactionHistory;
    if (!hasAnyOption || !conversationId) return null;

    useEffect(() => {
        if (!menuOpen) return undefined;
        const onDoc = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [menuOpen]);

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await api.getWalletHistory(conversationId);
            setHistoryRows(Array.isArray(res?.rows) ? res.rows : []);
        } catch (err) {
            onError?.(err?.message || 'Failed to load wallet history');
            setHistoryRows([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const openHistory = () => {
        setMenuOpen(false);
        setHistoryOpen(true);
        loadHistory();
    };

    const submitFundRequest = async (e) => {
        e.preventDefault();
        const amount = Number(fundAmount);
        const purpose = fundPurpose.trim();
        if (!Number.isFinite(amount) || amount <= 0 || !purpose) return;
        setBusy(true);
        try {
            const res = await api.sendWalletFundRequest(conversationId, { amount, purpose });
            const msg = res?.message ?? res?.data?.message;
            if (msg) onMessageSent?.(msg);
            setFundOpen(false);
            setFundAmount('');
            setFundPurpose('');
            setMenuOpen(false);
        } catch (err) {
            onError?.(err?.message || 'Could not send fund request');
        } finally {
            setBusy(false);
        }
    };

    const submitExpense = async (e) => {
        e.preventDefault();
        const amount = Number(expenseAmount);
        const description = expenseDescription.trim();
        if (!Number.isFinite(amount) || amount <= 0 || !description) return;
        if (!expenseCategory) {
            onError?.('Select an account category.');
            return;
        }
        setBusy(true);
        try {
            const res = await api.recordWalletExpense(conversationId, {
                amount,
                description,
                vendorName: expenseVendor.trim() || undefined,
                expenseCategory,
                ...(expenseProofPreview ? { proofUrl: expenseProofPreview } : {}),
            });
            const msg = res?.message ?? res?.data?.message;
            if (msg) onMessageSent?.(msg);
            setExpenseOpen(false);
            setExpenseAmount('');
            setExpenseCategory('');
            setExpenseCategorySearch('');
            setExpenseDescription('');
            setExpenseVendor('');
            setExpenseProofPreview(null);
            setMenuOpen(false);
        } catch (err) {
            onError?.(err?.message || 'Could not record expense');
        } finally {
            setBusy(false);
        }
    };

    const sendTxReference = async (row) => {
        setBusy(true);
        try {
            const res = await api.sendWalletTxReference(conversationId, {
                rowType: row.rowType,
                rowId: row.rowId,
                reference: row.reference,
                amount: row.amount,
                description: row.description,
                status: row.status,
                date: row.date,
            });
            const msg = res?.message ?? res?.data?.message;
            if (msg) onMessageSent?.(msg);
            setHistoryOpen(false);
        } catch (err) {
            onError?.(err?.message || 'Could not send reference');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <div className="pc-wallet-plus-wrap" ref={menuRef}>
                <button
                    type="button"
                    className="pc-wallet-plus-btn"
                    disabled={disabled || busy}
                    onClick={() => setMenuOpen((v) => !v)}
                    title="Wallet actions"
                    aria-label="Wallet actions"
                >
                    <Plus size={20} />
                </button>
                {menuOpen && (
                    <div className="pc-wallet-dropup" role="menu">
                        {showRequestFunds && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setFundOpen(true);
                                }}
                            >
                                <Banknote size={16} /> Request Funds
                            </button>
                        )}
                        {showRecordExpense && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    setExpenseOpen(true);
                                }}
                            >
                                <Receipt size={16} /> Record Expense
                            </button>
                        )}
                        {showTransactionHistory && (
                            <button type="button" role="menuitem" onClick={openHistory}>
                                <History size={16} /> Transaction History
                            </button>
                        )}
                    </div>
                )}
            </div>

            {fundOpen && (
                <Modal
                    title="Request Funds"
                    onClose={busy ? undefined : () => setFundOpen(false)}
                    width={440}
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={() => setFundOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="pc-wallet-modal-primary" disabled={busy} onClick={submitFundRequest}>
                                {busy ? <Loader2 size={14} className="spin" /> : 'Send to chat'}
                            </button>
                        </>
                    )}
                >
                    <form onSubmit={submitFundRequest}>
                        <label className="pc-wallet-field-label">Amount (SAR)</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="pc-wallet-field"
                            value={fundAmount}
                            onChange={(e) => setFundAmount(e.target.value)}
                            required
                        />
                        <label className="pc-wallet-field-label">Reason / Purpose</label>
                        <textarea
                            className="pc-wallet-field"
                            rows={3}
                            value={fundPurpose}
                            onChange={(e) => setFundPurpose(e.target.value)}
                            placeholder="What do you need these funds for?"
                            required
                        />
                    </form>
                </Modal>
            )}

            {expenseOpen && (
                <Modal
                    title="Record Expense"
                    onClose={busy ? undefined : () => setExpenseOpen(false)}
                    width={440}
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={() => setExpenseOpen(false)}>
                                Cancel
                            </button>
                            <button type="button" className="pc-wallet-modal-primary" disabled={busy} onClick={submitExpense}>
                                {busy ? <Loader2 size={14} className="spin" /> : 'Record & share in chat'}
                            </button>
                        </>
                    )}
                >
                    <form onSubmit={submitExpense}>
                        <label className="pc-wallet-field-label">Amount (SAR)</label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="pc-wallet-field"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            required
                        />
                        <label className="pc-wallet-field-label">Account category</label>
                        <SearchableEntityCombobox
                            id="pc-wallet-expense-category"
                            required
                            options={expenseCategoryOptions}
                            value={expenseCategory}
                            displayText={expenseCategorySearch}
                            onDisplayTextChange={(text) => {
                                setExpenseCategorySearch(text);
                                if (!text.trim()) setExpenseCategory('');
                            }}
                            onSelect={(opt) => {
                                setExpenseCategory(opt?.id || '');
                                setExpenseCategorySearch(opt?.label || '');
                            }}
                            placeholder="Type to search — ↑↓ to navigate, Enter to select"
                            entityLabel="category"
                            maxInitial={30}
                            maxFiltered={30}
                            disabled={busy}
                        />
                        <label className="pc-wallet-field-label">Description</label>
                        <input
                            type="text"
                            className="pc-wallet-field"
                            value={expenseDescription}
                            onChange={(e) => setExpenseDescription(e.target.value)}
                            placeholder="What was this expense for?"
                            required
                        />
                        <label className="pc-wallet-field-label">Vendor (optional)</label>
                        <input
                            type="text"
                            className="pc-wallet-field"
                            value={expenseVendor}
                            onChange={(e) => setExpenseVendor(e.target.value)}
                            placeholder="e.g. Careem, Jarir"
                        />
                        <ExpenseProofPicker
                            id="pc-wallet-expense-proof"
                            preview={expenseProofPreview}
                            onChange={setExpenseProofPreview}
                            disabled={busy}
                        />
                    </form>
                </Modal>
            )}

            {historyOpen && (
                <Modal
                    title="Wallet transaction history"
                    onClose={busy ? undefined : () => setHistoryOpen(false)}
                    width={560}
                    disableClose={busy}
                    footer={(
                        <button type="button" className="pc-wallet-modal-cancel" onClick={() => setHistoryOpen(false)}>
                            Close
                        </button>
                    )}
                >
                    {historyLoading ? (
                        <div className="pc-wallet-loading"><Loader2 className="spin" size={24} /></div>
                    ) : historyRows.length === 0 ? (
                        <p className="pc-wallet-empty">No wallet activity yet.</p>
                    ) : (
                        <ul className="pc-wallet-history-list">
                            {historyRows.map((row) => (
                                <li key={`${row.rowType}-${row.rowId}`}>
                                    <button
                                        type="button"
                                        className="pc-wallet-history-item"
                                        disabled={busy}
                                        onClick={() => sendTxReference(row)}
                                    >
                                        <div className="pc-wallet-history-main">
                                            <span className="pc-wallet-history-type">
                                                {String(row.rowType).replace(/_/g, ' ')}
                                            </span>
                                            <span className="pc-wallet-history-desc">
                                                {row.description || row.reference || '—'}
                                            </span>
                                        </div>
                                        <div className="pc-wallet-history-meta">
                                            <strong>SAR {formatSar(row.amount)}</strong>
                                            <span className={`pc-wallet-status ${row.status === 'approved' || row.status === 'completed' ? 'pc-wallet-status--approved' : row.status === 'rejected' ? 'pc-wallet-status--rejected' : 'pc-wallet-status--pending'}`}>
                                                {row.status || '—'}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="pc-wallet-history-hint">Tap a row to quote it in the chat.</p>
                </Modal>
            )}
        </>
    );
}
