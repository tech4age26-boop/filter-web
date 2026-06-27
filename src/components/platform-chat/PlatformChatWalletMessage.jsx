import { Wallet, Receipt, Link2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import '../../styles/admin/PlatformChatWallet.css';

function formatSar(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePayload(m) {
    if (m?.payload && typeof m.payload === 'object') return m.payload;
    if (!m?.content) return null;
    try {
        return JSON.parse(m.content);
    } catch {
        return null;
    }
}

function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'completed') return 'pc-wallet-status--approved';
    if (s === 'rejected') return 'pc-wallet-status--rejected';
    return 'pc-wallet-status--pending';
}

function statusLabel(status) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'approved') return 'Approved';
    if (s === 'rejected') return 'Rejected';
    if (s === 'completed') return 'Completed';
    if (s === 'pending') return 'Pending';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatusBadge({ status }) {
    const s = String(status || 'pending').toLowerCase();
    const Icon = s === 'approved' || s === 'completed'
        ? CheckCircle2
        : s === 'rejected'
            ? XCircle
            : Clock;
    return (
        <span className={`pc-wallet-status ${statusClass(status)}`}>
            <Icon size={12} strokeWidth={2.5} aria-hidden />
            {statusLabel(status)}
        </span>
    );
}

export function isWalletChatMessage(m) {
    return ['wallet_fund_request', 'wallet_status_event', 'wallet_tx_reference', 'wallet_expense_event'].includes(m?.type);
}

export function walletMessagePreview(m) {
    const p = parsePayload(m);
    if (m?.type === 'wallet_fund_request' && p) {
        return `💰 Fund request · ${p.currencyCode || 'SAR'} ${formatSar(p.amount)}`;
    }
    if (m?.type === 'wallet_expense_event' && p) {
        return `💸 Expense · SAR ${formatSar(p.amount)}`;
    }
    if (m?.type === 'wallet_status_event' && p) {
        const s = String(p.status || '').toLowerCase();
        if (s === 'approved') return `✅ Fund approved · ${p.requestNumber || ''}`;
        if (s === 'rejected') return `❌ Fund rejected · ${p.requestNumber || ''}`;
    }
    if (m?.type === 'wallet_tx_reference' && p) {
        return `📎 Wallet reference · ${p.reference || 'item'}`;
    }
    return m?.content || '';
}

export function PlatformChatWalletMessage({
    message,
    canApprove,
    canReject,
    actionBusy,
    onApprove,
    onReject,
}) {
    const p = parsePayload(message);
    if (!p) {
        return <span className="platform-chat-bubble-text">Wallet message</span>;
    }

    if (message.type === 'wallet_fund_request') {
        const status = String(p.status || 'pending').toLowerCase();
        const isPending = status === 'pending';
        return (
            <div className={`pc-wallet-card pc-wallet-card--fund pc-wallet-card--${status}`}>
                <div className="pc-wallet-card-head">
                    <div className="pc-wallet-card-head-icon" aria-hidden>
                        <Wallet size={18} strokeWidth={2.25} />
                    </div>
                    <div className="pc-wallet-card-head-text">
                        <div className="pc-wallet-card-title">Fund Request</div>
                        <div className="pc-wallet-card-ref">{p.requestNumber}</div>
                    </div>
                    <StatusBadge status={status} />
                </div>
                <div className="pc-wallet-card-body">
                    <div className="pc-wallet-card-amount">
                        <span className="pc-wallet-card-amount-label">Requested amount</span>
                        <span className="pc-wallet-card-amount-value">
                            <span className="pc-wallet-card-currency">{p.currencyCode || 'SAR'}</span>
                            {formatSar(p.amount)}
                        </span>
                    </div>
                    {p.purpose && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">Purpose</span>
                            <p className="pc-wallet-card-detail-value">{p.purpose}</p>
                        </div>
                    )}
                    {(p.workshopName || p.branchName) && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">Workshop / Branch</span>
                            <p className="pc-wallet-card-detail-value">
                                {[p.workshopName, p.branchName].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    )}
                </div>
                {isPending && !message.isSelf && (canApprove || canReject) && (
                    <div className="pc-wallet-card-actions-bar">
                        {canReject && (
                            <button
                                type="button"
                                className="pc-wallet-btn pc-wallet-btn--reject"
                                disabled={actionBusy}
                                onClick={() => onReject?.(message, p)}
                            >
                                Reject
                            </button>
                        )}
                        {canApprove && (
                            <button
                                type="button"
                                className="pc-wallet-btn pc-wallet-btn--approve"
                                disabled={actionBusy}
                                onClick={() => onApprove?.(message, p)}
                            >
                                Approve
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (message.type === 'wallet_status_event') {
        const status = String(p.status || '').toLowerCase();
        const approved = status === 'approved';
        return (
            <div className={`pc-wallet-card pc-wallet-card--status ${approved ? 'is-approved' : 'is-rejected'}`}>
                <div className="pc-wallet-card-status-banner">
                    {approved ? (
                        <CheckCircle2 size={18} strokeWidth={2.25} aria-hidden />
                    ) : (
                        <XCircle size={18} strokeWidth={2.25} aria-hidden />
                    )}
                    <span>{approved ? 'Fund request approved' : 'Fund request rejected'}</span>
                </div>
                <div className="pc-wallet-card-ref">{p.requestNumber}</div>
                <div className="pc-wallet-card-amount pc-wallet-card-amount--compact">
                    <span className="pc-wallet-card-amount-label">Amount</span>
                    <span className="pc-wallet-card-amount-value">
                        <span className="pc-wallet-card-currency">{p.currencyCode || 'SAR'}</span>
                        {formatSar(p.amount)}
                    </span>
                </div>
                {approved && p.sourceAccountName && (
                    <div className="pc-wallet-card-meta">Funded from {p.sourceAccountName}</div>
                )}
                {!approved && p.rejectionReason && (
                    <div className="pc-wallet-card-meta pc-wallet-card-meta--reason">{p.rejectionReason}</div>
                )}
            </div>
        );
    }

    if (message.type === 'wallet_tx_reference') {
        const typeLabel = String(p.rowType || 'item').replace(/_/g, ' ');
        return (
            <div className="pc-wallet-card pc-wallet-card--ref">
                <div className="pc-wallet-card-head pc-wallet-card-head--ref">
                    <div className="pc-wallet-card-head-icon pc-wallet-card-head-icon--ref" aria-hidden>
                        <Link2 size={18} strokeWidth={2.25} />
                    </div>
                    <div className="pc-wallet-card-head-text">
                        <div className="pc-wallet-card-title">{typeLabel}</div>
                        {p.reference && <div className="pc-wallet-card-ref">{p.reference}</div>}
                    </div>
                    {p.status && <StatusBadge status={p.status} />}
                </div>
                <div className="pc-wallet-card-body">
                    {p.amount != null && (
                        <div className="pc-wallet-card-amount pc-wallet-card-amount--compact">
                            <span className="pc-wallet-card-amount-label">Amount</span>
                            <span className="pc-wallet-card-amount-value">
                                <span className="pc-wallet-card-currency">SAR</span>
                                {formatSar(p.amount)}
                            </span>
                        </div>
                    )}
                    {p.description && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">Details</span>
                            <p className="pc-wallet-card-detail-value">{p.description}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (message.type === 'wallet_expense_event') {
        const status = String(p.status || 'pending').toLowerCase();
        const isPending = status === 'pending';
        return (
            <div className={`pc-wallet-card pc-wallet-card--expense pc-wallet-card--${status}`}>
                <div className="pc-wallet-card-head pc-wallet-card-head--expense">
                    <div className="pc-wallet-card-head-icon pc-wallet-card-head-icon--expense" aria-hidden>
                        <Receipt size={18} strokeWidth={2.25} />
                    </div>
                    <div className="pc-wallet-card-head-text">
                        <div className="pc-wallet-card-title">{isPending ? 'Expense Request' : 'Expense recorded'}</div>
                        {(p.requestNumber || p.referenceId) && (
                            <div className="pc-wallet-card-ref">{p.requestNumber || p.referenceId}</div>
                        )}
                    </div>
                    <StatusBadge status={status} />
                </div>
                <div className="pc-wallet-card-body">
                    <div className="pc-wallet-card-amount pc-wallet-card-amount--expense">
                        <span className="pc-wallet-card-amount-label">{isPending ? 'Requested amount' : 'Amount debited'}</span>
                        <span className="pc-wallet-card-amount-value">
                            <span className="pc-wallet-card-currency">{p.currencyCode || 'SAR'}</span>
                            {formatSar(p.amount)}
                        </span>
                    </div>
                    {p.description && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">Description</span>
                            <p className="pc-wallet-card-detail-value">{p.description}</p>
                        </div>
                    )}
                    {(p.workshopName || p.branchName) && (
                        <div className="pc-wallet-card-detail">
                            <span className="pc-wallet-card-detail-label">Workshop / Branch</span>
                            <p className="pc-wallet-card-detail-value">
                                {[p.workshopName, p.branchName].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    )}
                    {!isPending && p.balanceAfter != null && (
                        <div className="pc-wallet-card-meta">
                            Balance after: SAR {formatSar(p.balanceAfter)}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

export { formatSar, parsePayload };
