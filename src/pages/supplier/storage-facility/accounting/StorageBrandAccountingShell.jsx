import React from 'react';
import StorageBrandTransactionHub from './StorageBrandTransactionHub';
import StorageBrandJournalLogs from './StorageBrandJournalLogs';
import StorageBrandAccountsTab from './StorageBrandAccountsTab';
import StorageBrandCashBankTab from './StorageBrandCashBankTab';

const ACCT_NAV = [
    { id: 'acct_hub', label: 'Transaction Hub' },
    { id: 'acct_cash', label: 'Cash & Bank' },
    { id: 'acct_accounts', label: 'Account categories' },
    { id: 'acct_log_pay', label: 'Payments log' },
    { id: 'acct_log_rcpt', label: 'Receipts log' },
    { id: 'acct_log_je', label: 'Journal log' },
];

export default function StorageBrandAccountingShell({
    brandId,
    brandName,
    customers,
    acctTab,
    onAcctTabChange,
}) {
    return (
        <div className="sf-brand-accounting">
            <div className="sf-brand-accounting-head">
                <h2 className="sf-brand-accounting-title">Accounting</h2>
                <p className="sf-brand-accounting-sub">
                    {brandName ? `${brandName} — ` : ''}
                    Payments, receipts, journals, cash registers, and account ledgers.
                </p>
            </div>
            <nav className="sf-brand-acct-nav" aria-label="Accounting sections">
                {ACCT_NAV.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={
                            acctTab === t.id
                                ? 'sf-brand-acct-nav-btn sf-brand-acct-nav-btn--active'
                                : 'sf-brand-acct-nav-btn'
                        }
                        onClick={() => onAcctTabChange(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>
            <div className="sf-brand-acct-body">
                {acctTab === 'acct_hub' ? (
                    <StorageBrandTransactionHub brandId={brandId} customers={customers} />
                ) : null}
                {acctTab === 'acct_cash' ? (
                    <StorageBrandCashBankTab brandId={brandId} />
                ) : null}
                {acctTab === 'acct_accounts' ? (
                    <StorageBrandAccountsTab brandId={brandId} />
                ) : null}
                {acctTab === 'acct_log_pay' ? (
                    <StorageBrandJournalLogs brandId={brandId} kind="payments" />
                ) : null}
                {acctTab === 'acct_log_rcpt' ? (
                    <StorageBrandJournalLogs brandId={brandId} kind="receipts" />
                ) : null}
                {acctTab === 'acct_log_je' ? (
                    <StorageBrandJournalLogs brandId={brandId} kind="journals" />
                ) : null}
            </div>
        </div>
    );
}
