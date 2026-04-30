import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import RM_Commissions from '../referral-management/RM_Commissions';
import COAView from '../../components/accounting/COAView';
import GlobalCashBankView from '../../components/accounting/CashBankView';
import JournalEntriesView from '../../components/accounting/JournalEntriesView';
import GlobalTransactionEntryView from '../../components/accounting/TransactionEntryView';
import GlobalLedgerView from '../../components/accounting/LedgerView';
import GlobalPurchasesView from '../../components/accounting/PurchasesView';
import GlobalExpensesView from '../../components/accounting/ExpensesView';
import GlobalPaymentsView from '../../components/accounting/PaymentsView';
import GlobalReceiptsView from '../../components/accounting/ReceiptsView';
import GlobalAdvancesView from '../../components/accounting/AdvancesView';
import CommissionsView from '../../components/accounting/CommissionsView';
import '../../styles/admin/AccountingPage.css';

const SUB_TABS = [
    { path: 'chart-of-accounts', label: 'Chart of Accounts' },
    { path: 'cash-bank', label: 'Cash & Bank' },
    { path: 'commissions', label: 'Commission' },
    { path: 'referral-commissions-rm', label: 'Referral Commissions' },
    { path: 'transactions', label: 'Transactions' },
    { path: 'journal-entries', label: 'Journal Entries' },
    { path: 'purchases', label: 'Purchases' },
    { path: 'expenses', label: 'Expenses' },
    { path: 'receipts', label: 'Receipts' },
    { path: 'payments', label: 'Payments' },
    { path: 'advances', label: 'Advances' },
    { path: 'ledger', label: 'Ledger' },
];

export default function AccountingPage() {
    const { subTab } = useParams();
    const activeSub = subTab || 'cash-bank';

    const [taxes, setTaxes] = useState([
        { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
        { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
        { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0.00 },
        { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0.00 },
    ]);

    return (
        <div className="accounting-page module-container">
            <div className="accounting-sub-nav">
                {SUB_TABS.map((t) => (
                    <NavLink
                        key={t.path}
                        to={`/admin/accounting/${t.path}`}
                        className={({ isActive }) => `accounting-sub-tab ${isActive ? 'active' : ''}`}
                    >
                        {localStorage.getItem('portal-locale') === 'ar' && (t.path === 'commissions' || t.path === 'referral-commissions') ? 'العمولات' : t.label}
                    </NavLink>
                ))}
            </div>

            {activeSub === 'chart-of-accounts' && <COAView readOnly={false} />}
            {activeSub === 'cash-bank' && <GlobalCashBankView readOnly={false} />}
            {activeSub === 'commissions' && <CommissionsView readOnly={false} />}
            {activeSub === 'referral-commissions' && <CommissionsView readOnly={false} />}
            {activeSub === 'referral-commissions-rm' && <RM_Commissions />}
            {activeSub === 'payments' && <GlobalPaymentsView readOnly={false} />}
            {activeSub === 'transactions' && <GlobalTransactionEntryView readOnly={false} />}
            {activeSub === 'journal-entries' && <JournalEntriesView readOnly={false} />}
            {activeSub === 'purchases' && <GlobalPurchasesView readOnly={false} />}
            {activeSub === 'expenses' && <GlobalExpensesView readOnly={false} />}
            {activeSub === 'receipts' && <GlobalReceiptsView readOnly={false} />}
            {activeSub === 'advances' && <GlobalAdvancesView readOnly={false} />}
            {activeSub === 'ledger' && <GlobalLedgerView readOnly={false} />}
        </div>
    );
}
