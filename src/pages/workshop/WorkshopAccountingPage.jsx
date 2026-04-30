import React, { useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
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

export default function WorkshopAccountingPage({ activeTab }) {
    const { subTab: paramsSubTab } = useParams();

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);
    
    // Normalize activeSub to match the internal view keys
    const getActiveSub = () => {
        const raw = paramsSubTab || (activeTab ? activeTab.replace('acc-', '') : 'cash-bank');
        const mapping = {
            'chart': 'chart-of-accounts',
            'cash': 'cash-bank',
            'journal': 'journal-entries',
            'transactions': 'transactions',
            'purchases': 'purchases',
            'expenses': 'expenses',
            'receipts': 'receipts',
            'payments': 'payments',
            'advances': 'advances',
            'commissions': 'commissions',
            'ledger': 'ledger'
        };
        return mapping[raw] || raw;
    };

    const activeSub = getActiveSub();

    const [taxes, setTaxes] = useState([
        { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
        { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
        { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0.00 },
        { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0.00 },
    ]);

    return (
        <div className="accounting-page module-container">
            {activeSub === 'chart-of-accounts' && <COAView readOnly={true} />}
            {activeSub === 'cash-bank' && <GlobalCashBankView readOnly={true} />}
            {activeSub === 'commissions' && <CommissionsView readOnly={true} />}
            {activeSub === 'payments' && <GlobalPaymentsView readOnly={true} />}
            {activeSub === 'transactions' && <GlobalTransactionEntryView readOnly={true} />}
            {activeSub === 'journal-entries' && <JournalEntriesView readOnly={true} />}
            {activeSub === 'purchases' && <GlobalPurchasesView readOnly={true} />}
            {activeSub === 'expenses' && <GlobalExpensesView readOnly={false} />}
            {activeSub === 'receipts' && <GlobalReceiptsView readOnly={true} />}
            {activeSub === 'advances' && <GlobalAdvancesView readOnly={false} />}
            {activeSub === 'ledger' && <GlobalLedgerView readOnly={false} />}
        </div>
    );
}
