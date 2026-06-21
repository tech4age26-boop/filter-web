import React, { useMemo, useRef, useState } from 'react';
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    FileSpreadsheet,
    FileText,
    Printer,
} from 'lucide-react';
import {
    LEDGER_ROWS_PER_PAGE,
    fmtBalanceSide,
    fmtMoneySar,
} from '../../utils/accountLedgerStatementUtils';
import '../../styles/accounting/ProfessionalLedgerStatement.css';

/**
 * Full-page professional ledger statement (print / PDF / Excel toolbar + paginated document).
 */
export default function ProfessionalLedgerStatementDocument({
    onBack,
    backLabel = 'Back to Chart of Accounts',
    scopeNote = '',
    loading = false,
    error = '',
    accountCode = '',
    accountName = '',
    accountType = '',
    companyName = '',
    periodFrom = '—',
    periodTo = '—',
    openingBalance = 0,
    rows = [],
    totals = null,
    normalDebit = true,
    dateFrom = '',
    dateTo = '',
    onDateFromChange,
    onDateToChange,
    onApply,
    onClear,
    onExportPdf,
    onExportExcel,
    exportDisabled = false,
    showCashLedgerColumns = false,
    counterpartyColumnLabel = 'Paid to / Received from',
    offsetAccountColumnLabel = 'Expense / AR account',
    filterOptions = null,
    partyFilterKey = '',
    onPartyFilterKeyChange,
    offsetAccountFilterId = '',
    onOffsetAccountFilterIdChange,
}) {
    const printRef = useRef(null);
    const [page, setPage] = useState(1);

    const parties = filterOptions?.parties ?? [];
    const offsetAccounts = filterOptions?.offsetAccounts ?? [];
    const colSpan = showCashLedgerColumns ? 7 : 5;

    const totalPages = Math.max(1, Math.ceil((rows?.length || 0) / LEDGER_ROWS_PER_PAGE));

    const pagedRows = useMemo(() => {
        const start = (page - 1) * LEDGER_ROWS_PER_PAGE;
        return (rows || []).slice(start, start + LEDGER_ROWS_PER_PAGE);
    }, [rows, page]);

    React.useEffect(() => {
        setPage(1);
    }, [rows, dateFrom, dateTo, partyFilterKey, offsetAccountFilterId]);

    function handlePrint() {
        window.print();
    }

    const accountLine =
        accountCode && accountName
            ? `[${accountCode}] ${accountName}`
            : accountName || accountCode || '—';

    return (
        <div className="pls-page">
            {scopeNote ? <p className="pls-scope-note no-print">{scopeNote}</p> : null}

            <div className="pls-controls no-print">
                <button type="button" className="pls-back" onClick={onBack}>
                    <ArrowLeft size={16} />
                    {backLabel}
                </button>
                <div className="pls-filter-field">
                    <label htmlFor="pls-from">From</label>
                    <input
                        id="pls-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => onDateFromChange?.(e.target.value)}
                    />
                </div>
                <div className="pls-filter-field">
                    <label htmlFor="pls-to">To</label>
                    <input
                        id="pls-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => onDateToChange?.(e.target.value)}
                    />
                </div>
                {parties.length > 0 ? (
                    <div className="pls-filter-field">
                        <label htmlFor="pls-party">Party</label>
                        <select
                            id="pls-party"
                            value={partyFilterKey}
                            onChange={(e) => onPartyFilterKeyChange?.(e.target.value)}
                        >
                            <option value="">All parties</option>
                            {parties.map((p) => (
                                <option key={p.key} value={p.key}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                {offsetAccounts.length > 0 ? (
                    <div className="pls-filter-field">
                        <label htmlFor="pls-offset">Offset account</label>
                        <select
                            id="pls-offset"
                            value={offsetAccountFilterId}
                            onChange={(e) => onOffsetAccountFilterIdChange?.(e.target.value)}
                        >
                            <option value="">All accounts</option>
                            {offsetAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                    [{a.code}] {a.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                <button type="button" className="btn-portal" onClick={onApply} disabled={loading}>
                    {loading ? 'Loading…' : 'Apply filters'}
                </button>
                <button
                    type="button"
                    className="btn-portal-outline"
                    onClick={onClear}
                    disabled={loading}
                >
                    Clear filters
                </button>
            </div>

            {totals ? (
                <div className="pls-kpi-grid no-print">
                    <div className="pls-kpi">
                        <div className="pls-kpi-label">Total Debit</div>
                        <div className="pls-kpi-value pls-kpi-value--debit">
                            {fmtMoneySar(totals.totalDebit)}
                        </div>
                    </div>
                    <div className="pls-kpi">
                        <div className="pls-kpi-label">Total Credit</div>
                        <div className="pls-kpi-value pls-kpi-value--credit">
                            {fmtMoneySar(totals.totalCredit)}
                        </div>
                    </div>
                    <div className="pls-kpi">
                        <div className="pls-kpi-label">Closing Balance</div>
                        <div className="pls-kpi-value">
                            {fmtBalanceSide(totals.closingBalance, normalDebit)}
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="pls-toolbar no-print">
                <div className="pls-toolbar-left">
                    <button
                        type="button"
                        className="pls-tool-btn"
                        onClick={handlePrint}
                        disabled={loading || exportDisabled}
                    >
                        <Printer size={15} />
                        Print
                    </button>
                    <button
                        type="button"
                        className="pls-tool-btn"
                        onClick={onExportPdf}
                        disabled={loading || exportDisabled}
                    >
                        <FileText size={15} />
                        PDF
                    </button>
                    <button
                        type="button"
                        className="pls-tool-btn"
                        onClick={onExportExcel}
                        disabled={loading || exportDisabled}
                    >
                        <FileSpreadsheet size={15} />
                        Excel
                    </button>
                </div>
                <div className="pls-toolbar-right">
                    <button
                        type="button"
                        className="pls-tool-btn"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage(1)}
                        aria-label="First page"
                    >
                        <ChevronsLeft size={15} />
                    </button>
                    <button
                        type="button"
                        className="pls-tool-btn"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span className="pls-page-indicator">
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        className="pls-tool-btn"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next page"
                    >
                        <ChevronRight size={15} />
                    </button>
                    <button
                        type="button"
                        className="pls-tool-btn"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage(totalPages)}
                        aria-label="Last page"
                    >
                        <ChevronsRight size={15} />
                    </button>
                </div>
            </div>

            {error ? <div className="pls-error no-print">{error}</div> : null}

            <div className="pls-document" ref={printRef} id="ledger-statement-print">
                <header className="pls-doc-head">
                    <h1 className="pls-doc-title">Statement</h1>
                    <div className="pls-doc-brand" aria-hidden>
                        FILTER
                    </div>
                    {companyName ? (
                        <p className="pls-doc-sub">({companyName})</p>
                    ) : null}
                    <p className="pls-doc-account">
                        {accountLine}
                        {accountType ? ` · ${accountType}` : ''}
                    </p>
                    <p className="pls-doc-period">
                        From {periodFrom} &nbsp; To {periodTo}
                    </p>
                </header>

                <div className="pls-table-wrap">
                    <table className="pls-table">
                        <thead>
                            <tr>
                                <th style={{ width: 100 }}>Date</th>
                                {showCashLedgerColumns ? (
                                    <>
                                        <th>{counterpartyColumnLabel}</th>
                                        <th>{offsetAccountColumnLabel}</th>
                                    </>
                                ) : null}
                                <th>Description</th>
                                <th className="pls-col-amount" style={{ width: 110 }}>
                                    Debit
                                </th>
                                <th className="pls-col-amount" style={{ width: 110 }}>
                                    Credit
                                </th>
                                <th className="pls-col-amount" style={{ width: 130 }}>
                                    Balance
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {page === 1 ? (
                                <tr className="pls-row-opening">
                                    <td>—</td>
                                    {showCashLedgerColumns ? (
                                        <>
                                            <td>—</td>
                                            <td>—</td>
                                        </>
                                    ) : null}
                                    <td>Opening balance</td>
                                    <td className="pls-col-amount">—</td>
                                    <td className="pls-col-amount">—</td>
                                    <td className="pls-col-amount">
                                        {fmtBalanceSide(openingBalance, normalDebit)}
                                    </td>
                                </tr>
                            ) : null}
                            {loading && rows.length === 0 ? (
                                <tr>
                                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24 }}>
                                        Loading ledger…
                                    </td>
                                </tr>
                            ) : pagedRows.length === 0 && page === 1 ? (
                                <tr>
                                    <td colSpan={colSpan} style={{ textAlign: 'center', padding: 24 }}>
                                        No transactions in this period.
                                    </td>
                                </tr>
                            ) : (
                                pagedRows.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                                        {showCashLedgerColumns ? (
                                            <>
                                                <td title={r.counterpartyLabel || ''}>
                                                    {r.counterpartyLabel || '—'}
                                                </td>
                                                <td title={r.offsetAccountLabel || ''}>
                                                    {r.offsetAccountLabel || '—'}
                                                </td>
                                            </>
                                        ) : null}
                                        <td>{r.description || '—'}</td>
                                        <td className="pls-col-amount">
                                            {r.debit > 0 ? fmtMoneySar(r.debit) : ''}
                                        </td>
                                        <td className="pls-col-amount">
                                            {r.credit > 0 ? fmtMoneySar(r.credit) : ''}
                                        </td>
                                        <td className="pls-col-amount">
                                            {fmtBalanceSide(r.runningBalance, normalDebit)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totals ? (
                    <div className="pls-summary">
                        <div className="pls-summary-row">
                            <span>Opening balance</span>
                            <strong>{fmtBalanceSide(openingBalance, normalDebit)}</strong>
                        </div>
                        <div className="pls-summary-row">
                            <span>Total debits</span>
                            <strong>{fmtBalanceSide(totals.totalDebit, true)}</strong>
                        </div>
                        <div className="pls-summary-row">
                            <span>Total credits</span>
                            <strong>{fmtMoneySar(totals.totalCredit)}</strong>
                        </div>
                        <div className="pls-summary-row pls-summary-row--closing">
                            <span>Closing balance</span>
                            <strong>{fmtBalanceSide(totals.closingBalance, normalDebit)}</strong>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
