import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Wallet, Plus, Receipt, Loader2, Send, MessageCircle } from 'lucide-react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import ExpenseProofPicker from '../../components/accounting/ExpenseProofPicker';
import ExpenseProofThumbnail from '../../components/accounting/ExpenseProofThumbnail';
import { useAuth } from '../../context/AuthContext';
import {
    createMyFundRequest,
    getMyWallet,
    getMyWalletChatContact,
    listMyFundRequests,
    listMyWalletTransactions,
    recordMyWalletExpense,
    shareFundRequestInChat,
} from '../../services/adminWalletApi';
import { firstVisibleAdminPath } from '../../utils/permissions';
import {
    coerceWalletFieldText,
    formatWalletTxDate,
} from '../../utils/walletHistory';
import { adminWalletExpenseComboboxOptions } from '../../constants/adminWalletExpenseCategories';

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'completed') return 'ws-badge ws-badge--green';
    if (s === 'rejected') return 'ws-badge ws-badge--red';
    return 'ws-badge';
}

export default function MyWalletPage() {
    const navigate = useNavigate();
    const { user, hasPermission } = useAuth();
    const walletEnabled = Boolean(user?.walletEnabled);
    const canViewChat = hasPermission('chat.view');
    const canPostToChat = hasPermission('chat.create');

    const [wallet, setWallet] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [fundRequests, setFundRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [fundOpen, setFundOpen] = useState(false);
    const [fundAmount, setFundAmount] = useState('');
    const [fundPurpose, setFundPurpose] = useState('');
    const [fundSaving, setFundSaving] = useState(false);

    const expenseCategoryOptions = useMemo(() => adminWalletExpenseComboboxOptions(), []);

    const [expenseOpen, setExpenseOpen] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('');
    const [expenseCategorySearch, setExpenseCategorySearch] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseVendor, setExpenseVendor] = useState('');
    const [expenseProofPreview, setExpenseProofPreview] = useState(null);
    const [expenseSaving, setExpenseSaving] = useState(false);
    const [walletChatNotice, setWalletChatNotice] = useState('');
    const [lastChatConversationId, setLastChatConversationId] = useState('');

    const applyChatResult = (chat, successMessage) => {
        if (!canPostToChat || !chat) return;
        if (chat.posted) {
            setWalletChatNotice(
                successMessage.replace('{name}', chat.contactName || 'super admin'),
            );
            if (chat.conversationId) {
                setLastChatConversationId(String(chat.conversationId));
            }
            return;
        }
        if (chat.alreadyInChat) {
            setWalletChatNotice('This request is already visible in your support chat.');
            if (chat.conversationId) {
                setLastChatConversationId(String(chat.conversationId));
            }
            return;
        }
        if (chat.error) {
            setWalletChatNotice(
                'Saved successfully, but could not notify super admin in chat. Use Open Chat to follow up.',
            );
        }
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [walletRes, txRes, fundRes] = await Promise.all([
                getMyWallet(),
                listMyWalletTransactions({ limit: 100 }),
                listMyFundRequests(),
            ]);
            setWallet(walletRes);
            const allFundRequests = Array.isArray(fundRes?.fundRequests)
                ? fundRes.fundRequests
                : [];
            setFundRequests(allFundRequests);
            setTransactions(
                Array.isArray(txRes?.transactions)
                    ? txRes.transactions
                    : Array.isArray(walletRes?.recentTransactions)
                        ? walletRes.recentTransactions
                        : [],
            );
        } catch (err) {
            setError(err?.message || 'Failed to load wallet');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (walletEnabled) loadData();
    }, [walletEnabled, loadData]);

    const handleFundSubmit = async (e) => {
        e.preventDefault();
        const amount = Number(fundAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid amount.');
            return;
        }
        if (!fundPurpose.trim()) {
            alert('Purpose is required.');
            return;
        }
        setFundSaving(true);
        setWalletChatNotice('');
        try {
            const res = await createMyFundRequest({
                amount,
                purpose: fundPurpose.trim(),
            });
            setFundOpen(false);
            setFundAmount('');
            setFundPurpose('');
            if (canPostToChat) {
                applyChatResult(
                    res?.chat,
                    'Fund request sent to {name} in chat.',
                );
            } else {
                setWalletChatNotice('Fund request submitted for super-admin approval.');
            }
            await loadData();
        } catch (err) {
            alert(err?.message || 'Failed to submit fund request');
        } finally {
            setFundSaving(false);
        }
    };

    const handleExpenseSubmit = async (e) => {
        e.preventDefault();
        const amount = Number(expenseAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid amount.');
            return;
        }
        if (!expenseDescription.trim()) {
            alert('Description is required.');
            return;
        }
        if (!expenseCategory) {
            alert('Select an account category.');
            return;
        }
        setExpenseSaving(true);
        setWalletChatNotice('');
        try {
            const res = await recordMyWalletExpense({
                amount,
                description: expenseDescription.trim(),
                vendorName: expenseVendor.trim() || undefined,
                expenseCategory,
                ...(expenseProofPreview ? { proofUrl: expenseProofPreview } : {}),
            });
            setExpenseOpen(false);
            setExpenseAmount('');
            setExpenseCategory('');
            setExpenseCategorySearch('');
            setExpenseDescription('');
            setExpenseVendor('');
            setExpenseProofPreview(null);
            if (canPostToChat) {
                applyChatResult(
                    res?.chat,
                    'Expense recorded and shared with {name} in chat.',
                );
            } else {
                setWalletChatNotice('Expense recorded successfully.');
            }
            await loadData();
        } catch (err) {
            alert(err?.message || 'Failed to record expense');
        } finally {
            setExpenseSaving(false);
        }
    };

    const openWalletChat = async (conversationId) => {
        if (!canViewChat) return;
        try {
            if (conversationId) {
                navigate('/admin/chat', { state: { openConversationId: String(conversationId) } });
                return;
            }
            const res = await getMyWalletChatContact();
            const contactId = res?.userId ?? res?.data?.userId;
            if (contactId) {
                navigate('/admin/chat', { state: { openUserId: String(contactId) } });
                return;
            }
        } catch {
            /* fall through */
        }
        navigate('/admin/chat');
    };

    const handleShareInChat = async (requestId) => {
        if (!canPostToChat) return;
        try {
            const res = await shareFundRequestInChat(requestId);
            const chat = res?.chat;
            if (chat?.conversationId) {
                setWalletChatNotice('Fund request shared in chat.');
                setLastChatConversationId(String(chat.conversationId));
                await openWalletChat(chat.conversationId);
            }
        } catch (err) {
            alert(err?.message || 'Could not share in chat');
        }
    };

    if (!walletEnabled) {
        return <Navigate to={firstVisibleAdminPath(user)} replace />;
    }

    const balance = wallet?.balance ?? wallet?.wallet?.balance ?? 0;

    return (
        <div className="ws-module-container">
            <div className="ws-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <div>
                    <h2 className="ws-page-title">My Wallet</h2>
                    <p className="ws-page-sub">
                        Request funds, record expenses, and view your wallet history.
                        {canPostToChat
                            ? ' Fund requests and expenses are shared with super admin in chat.'
                            : ' Submissions go to the super-admin approvals queue.'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {canViewChat && (
                        <button
                            type="button"
                            className="ws-btn-secondary"
                            onClick={() => openWalletChat()}
                        >
                            <MessageCircle size={16} /> Open Chat
                        </button>
                    )}
                    <button type="button" className="ws-btn-secondary" onClick={() => { setExpenseOpen((v) => !v); setFundOpen(false); }}>
                        <Receipt size={16} /> Record Expense
                    </button>
                    <button type="button" className="ws-btn-primary" onClick={() => { setFundOpen((v) => !v); setExpenseOpen(false); }}>
                        <Plus size={16} /> Request Funds
                    </button>
                </div>
            </div>

            {error && (
                <p style={{ margin: '0 0 16px', padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, color: '#DC2626', fontSize: '0.875rem' }}>
                    {error}
                </p>
            )}

            {walletChatNotice && (
                <div
                    style={{
                        margin: '0 0 16px',
                        padding: '10px 14px',
                        background: '#ECFDF5',
                        borderRadius: 8,
                        color: '#047857',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                    }}
                >
                    <span>{walletChatNotice}</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {canViewChat && (lastChatConversationId || walletChatNotice.includes('follow up')) && (
                            <button
                                type="button"
                                className="ws-btn-secondary"
                                onClick={() => openWalletChat(lastChatConversationId || undefined)}
                            >
                                <MessageCircle size={14} /> Open chat
                            </button>
                        )}
                        <button
                            type="button"
                            className="ws-btn-secondary"
                            onClick={() => setWalletChatNotice('')}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: '#0ea5e9' }} />
                </div>
            ) : (
                <>
                    <div style={{
                        background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                        borderRadius: 16, padding: 28, color: '#fff', marginBottom: 24,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        boxShadow: '0 4px 20px rgba(14,165,233,0.25)',
                    }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.85, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Available Balance
                            </p>
                            <p style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>
                                SAR {formatSar(balance)}
                            </p>
                        </div>
                        <Wallet size={48} style={{ opacity: 0.35 }} />
                    </div>

                    {fundOpen && (
                        <div className="ws-section" style={{ marginBottom: 20 }}>
                            <div className="ws-section-header">
                                <span className="ws-section-title">Request Funds</span>
                            </div>
                            <form onSubmit={handleFundSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                                    {canPostToChat
                                        ? 'Your request is sent for super-admin approval and posted to your support chat.'
                                        : 'Your request is sent for super-admin approval.'}
                                </p>
                                <div className="ws-field">
                                    <label>Amount (SAR) *</label>
                                    <input type="number" min="0.01" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="e.g. 5000" />
                                </div>
                                <div className="ws-field">
                                    <label>Purpose *</label>
                                    <textarea rows={3} value={fundPurpose} onChange={(e) => setFundPurpose(e.target.value)} placeholder="Why do you need these funds?" />
                                </div>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button type="button" className="ws-btn-secondary" onClick={() => setFundOpen(false)}>Cancel</button>
                                    <button type="submit" className="ws-btn-primary" disabled={fundSaving}>
                                        {fundSaving ? <Loader2 size={14} className="spin" /> : <><Send size={14} /> Submit Request</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {expenseOpen && (
                        <div className="ws-section" style={{ marginBottom: 20 }}>
                            <div className="ws-section-header">
                                <span className="ws-section-title">Record Expense</span>
                            </div>
                            <form onSubmit={handleExpenseSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                                    {canPostToChat
                                        ? 'Amount is deducted immediately and a summary is posted to your support chat.'
                                        : 'Amount is deducted from your wallet immediately.'}
                                </p>
                                <div className="ws-field">
                                    <label>Amount (SAR) *</label>
                                    <input type="number" min="0.01" step="0.01" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                                </div>
                                <div className="ws-field">
                                    <label>Account category *</label>
                                    <SearchableEntityCombobox
                                        id="admin-wallet-expense-category"
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
                                        disabled={expenseSaving}
                                    />
                                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                        Posted to HQ Petty Cash Expense account (6100).
                                    </p>
                                </div>
                                <div className="ws-field">
                                    <label>Description *</label>
                                    <input type="text" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="What was this expense for?" />
                                </div>
                                <div className="ws-field">
                                    <label>Vendor (optional)</label>
                                    <input type="text" value={expenseVendor} onChange={(e) => setExpenseVendor(e.target.value)} placeholder="e.g. Careem, Jarir" />
                                </div>
                                <ExpenseProofPicker
                                    id="admin-wallet-expense-proof"
                                    preview={expenseProofPreview}
                                    onChange={setExpenseProofPreview}
                                    disabled={expenseSaving}
                                />
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button type="button" className="ws-btn-secondary" onClick={() => setExpenseOpen(false)}>Cancel</button>
                                    <button type="submit" className="ws-btn-primary" disabled={expenseSaving}>
                                        {expenseSaving ? <Loader2 size={14} className="spin" /> : 'Record Expense'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {fundRequests.length > 0 && (
                        <div className="ws-section" style={{ marginBottom: 20 }}>
                            <div className="ws-section-header">
                                <span className="ws-section-title">Fund Requests</span>
                            </div>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Reference</th>
                                        <th>Purpose</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {fundRequests.map((r) => (
                                        <tr key={r.id}>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                {formatWalletTxDate({ createdAt: r.createdAt })}
                                            </td>
                                            <td style={{ opacity: 0.7 }}>{r.requestNumber}</td>
                                            <td>{r.purpose}</td>
                                            <td style={{ fontWeight: 600 }}>SAR {formatSar(r.amount)}</td>
                                            <td><span className={statusBadgeClass(r.status)}>{r.status}</span></td>
                                            <td>
                                                {canPostToChat
                                                    && String(r.status || '').toLowerCase() === 'pending' && (
                                                    <button
                                                        type="button"
                                                        className="ws-btn-secondary"
                                                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                                        onClick={() => handleShareInChat(r.id)}
                                                    >
                                                        Share in chat
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="ws-section">
                        <div className="ws-section-header">
                            <span className="ws-section-title">Transaction History</span>
                        </div>
                        {transactions.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', margin: 0 }}>
                                No transactions yet
                            </p>
                        ) : (
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Reference</th>
                                        <th>Description</th>
                                        <th>Proof</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((t) => {
                                        const typeRaw = String(t.type || '').toLowerCase();
                                        const amount = Number(t.amount ?? 0);
                                        const isCredit = typeRaw === 'credit' || (typeRaw !== 'debit' && amount > 0);
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                    {formatWalletTxDate(t)}
                                                </td>
                                                <td style={{ opacity: 0.7 }}>{t.referenceId || '—'}</td>
                                                <td>{coerceWalletFieldText(t.description)}</td>
                                                <td>
                                                    {!isCredit ? (
                                                        <ExpenseProofThumbnail proofUrl={t.proofUrl} size={36} />
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    <span className={`ws-badge ${isCredit ? 'ws-badge--green' : 'ws-badge--red'}`}>
                                                        {t.type || (isCredit ? 'credit' : 'debit')}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: 700, color: isCredit ? '#16A34A' : '#DC2626' }}>
                                                    {isCredit ? '+' : '−'} SAR {formatSar(Math.abs(amount))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
