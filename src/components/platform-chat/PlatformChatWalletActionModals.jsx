import React, { useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import Modal from '../Modal';
import { listAdminWalletCashAccounts } from '../../services/adminWalletApi';
import { formatSar } from './PlatformChatWalletMessage';
import '../../styles/admin/PlatformChatWallet.css';

function formatAccountOptionLabel(name, balance) {
    return `${name} — Closing SAR ${formatSar(balance)}`;
}

function normalizeCashAccounts(payload) {
    const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.accounts)
            ? payload.accounts
            : Array.isArray(payload?.cashAccounts)
                ? payload.cashAccounts
                : [];
    return rows.map((row) => {
        const balance = Number(
            row.closingBalance ?? row.balance ?? row.currentBalance ?? 0,
        );
        const name = row.name || 'Account';
        return {
            id: String(row.id || ''),
            name,
            balance,
            closingBalance: balance,
            optionLabel: formatAccountOptionLabel(name, balance),
        };
    });
}

export default function PlatformChatWalletActionModals({
    api,
    approveTarget,
    rejectTarget,
    onCloseApprove,
    onCloseReject,
    onApproveDone,
    onRejectDone,
    onError,
}) {
    const [busy, setBusy] = useState(false);
    const [cashAccounts, setCashAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [sourceAccountId, setSourceAccountId] = useState('');
    const [approveRemarks, setApproveRemarks] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [approveError, setApproveError] = useState('');

    useEffect(() => {
        if (!approveTarget) return undefined;
        const workshopId = approveTarget?.payload?.workshopId ?? '';
        let cancelled = false;
        setAccountsLoading(true);
        setApproveRemarks('');
        setApproveError('');
        listAdminWalletCashAccounts(workshopId ? { workshopId } : {})
            .then((res) => {
                if (cancelled) return;
                const normalized = normalizeCashAccounts(res);
                setCashAccounts(normalized);
                if (normalized.length > 0) setSourceAccountId(normalized[0].id);
            })
            .catch((err) => onError?.(err?.message || 'Failed to load accounts'))
            .finally(() => {
                if (!cancelled) setAccountsLoading(false);
            });
        return () => { cancelled = true; };
    }, [approveTarget, approveTarget?.payload?.workshopId, onError]);

    useEffect(() => {
        if (!rejectTarget) return;
        setRejectReason('');
    }, [rejectTarget]);

    const confirmApprove = async () => {
        if (!approveTarget?.message?.id || !sourceAccountId) return;
        const selected = cashAccounts.find((a) => a.id === sourceAccountId);
        setApproveError('');
        setBusy(true);
        try {
            const res = await api.approveWalletFundRequestMessage(approveTarget.message.id, {
                sourceAccountId,
                sourceAccountName: selected?.name || '',
                remarks: approveRemarks.trim() || undefined,
            });
            onApproveDone?.(res);
            onCloseApprove();
        } catch (err) {
            const message = err?.message || 'Could not approve request';
            setApproveError(message);
            onError?.(message);
        } finally {
            setBusy(false);
        }
    };

    const confirmReject = async () => {
        if (!rejectTarget?.message?.id || !rejectReason.trim()) return;
        setBusy(true);
        try {
            const res = await api.rejectWalletFundRequestMessage(rejectTarget.message.id, {
                reason: rejectReason.trim(),
            });
            onRejectDone?.(res);
            onCloseReject();
        } catch (err) {
            onError?.(err?.message || 'Could not reject request');
        } finally {
            setBusy(false);
        }
    };

    const selectedApproveAccount = cashAccounts.find((a) => a.id === sourceAccountId);
    const approveAmount = Number(approveTarget?.payload?.amount ?? 0);
    const insufficientApproveBalance = Boolean(
        approveTarget
        && selectedApproveAccount
        && Number.isFinite(approveAmount)
        && approveAmount > 0
        && selectedApproveAccount.balance < approveAmount,
    );
    const approveBalanceError = insufficientApproveBalance
        ? `Insufficient balance in ${selectedApproveAccount.name}. Closing balance is SAR ${formatSar(selectedApproveAccount.balance)} but this request needs SAR ${formatSar(approveAmount)}.`
        : '';
    const approveDisplayError = approveError || approveBalanceError;

    return (
        <>
            {approveTarget && (
                <Modal
                    title="Approve fund request"
                    onClose={busy ? undefined : onCloseApprove}
                    width={500}
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={onCloseApprove}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="pc-wallet-modal-primary"
                                disabled={busy || accountsLoading || !sourceAccountId || insufficientApproveBalance}
                                onClick={confirmApprove}
                            >
                                {busy ? <Loader2 size={14} className="spin" /> : <Check size={16} />}
                                Approve
                            </button>
                        </>
                    )}
                >
                    {approveDisplayError ? (
                        <div className="pc-wallet-modal-error" role="alert">
                            {approveDisplayError}
                        </div>
                    ) : null}
                    <p className="pc-wallet-modal-lead">
                        Approve <strong>{approveTarget.payload?.requestNumber}</strong> for{' '}
                        <strong>SAR {formatSar(approveTarget.payload?.amount)}</strong>
                    </p>
                    <label className="pc-wallet-field-label">Fund from account *</label>
                    {accountsLoading ? (
                        <p className="pc-wallet-empty"><Loader2 size={14} className="spin" /> Loading…</p>
                    ) : (
                        <select
                            className="pc-wallet-field"
                            value={sourceAccountId}
                            onChange={(e) => setSourceAccountId(e.target.value)}
                        >
                            {cashAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.optionLabel}
                                </option>
                            ))}
                        </select>
                    )}
                    {sourceAccountId && !accountsLoading && cashAccounts.length > 0 && (
                        <p className="pc-wallet-modal-hint" style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                            Closing balance:{' '}
                            <strong>
                                SAR {formatSar(cashAccounts.find((a) => a.id === sourceAccountId)?.balance ?? 0)}
                            </strong>
                        </p>
                    )}
                    <label className="pc-wallet-field-label">Remarks (optional)</label>
                    <textarea
                        className="pc-wallet-field"
                        rows={2}
                        value={approveRemarks}
                        onChange={(e) => setApproveRemarks(e.target.value)}
                    />
                </Modal>
            )}

            {rejectTarget && (
                <Modal
                    title="Reject fund request"
                    onClose={busy ? undefined : onCloseReject}
                    width={440}
                    disableClose={busy}
                    footer={(
                        <>
                            <button type="button" className="pc-wallet-modal-cancel" disabled={busy} onClick={onCloseReject}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="pc-wallet-modal-danger"
                                disabled={busy || !rejectReason.trim()}
                                onClick={confirmReject}
                            >
                                {busy ? <Loader2 size={14} className="spin" /> : <X size={16} />}
                                Reject
                            </button>
                        </>
                    )}
                >
                    <label className="pc-wallet-field-label">Reason *</label>
                    <textarea
                        className="pc-wallet-field"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Why is this being rejected?"
                    />
                </Modal>
            )}
        </>
    );
}
