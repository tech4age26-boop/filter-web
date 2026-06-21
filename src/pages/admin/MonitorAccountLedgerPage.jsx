import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ProfessionalLedgerStatementDocument from '../../components/accounting/ProfessionalLedgerStatementDocument';
import {
    accountNormalDebit,
    unwrapLedgerPayload,
} from '../../utils/accountLedgerStatementUtils';
import {
    exportAccountLedgerExcel,
    exportAccountLedgerPdf,
} from '../../utils/supplierLedgerExport';
import * as accountsApi from '../../services/accountsApi';
import * as supMon from '../../services/supplierAccountingMonitorApi';
import { getPlatformHqInfo, getWorkshops, getSuppliers } from '../../services/superAdminApi';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from './saAccountingDateRange';
import { loadSaAccountingScope } from './saAccountingScope';
import '../../styles/admin/AccountingPage.css';

/**
 * Super Admin monitor — full-page account ledger statement (workshop, HQ, or supplier scope).
 */
export default function MonitorAccountLedgerPage() {
    const { accountId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const scope = useMemo(() => loadSaAccountingScope(), []);
    const isSupplier = scope.type === 'supplier';
    const isHq = scope.type === 'hq';
    const [resolvedHqWorkshopId, setResolvedHqWorkshopId] = useState(scope.hqWorkshopId || '');

    const workshopId = isHq ? resolvedHqWorkshopId : scope.workshopId;

    const fallbackCode = searchParams.get('code') || '';
    const fallbackName = searchParams.get('name') || '';
    const fallbackType = searchParams.get('type') || '';
    const urlDateFrom = searchParams.get('dateFrom') || '';
    const urlDateTo = searchParams.get('dateTo') || '';

    const [entityLabel, setEntityLabel] = useState('');
    const storedRange = useMemo(() => loadSaAccountingDateRange(), []);
    const [dateFrom, setDateFrom] = useState(
        () => urlDateFrom || storedRange.dateFrom || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => urlDateTo || storedRange.dateTo || todayISO(),
    );
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);
    const loadSeqRef = useRef(0);

    useEffect(() => {
        if (!isHq) return;
        if (scope.hqWorkshopId) {
            setResolvedHqWorkshopId(scope.hqWorkshopId);
            return;
        }
        let cancelled = false;
        getPlatformHqInfo()
            .then((res) => {
                if (!cancelled && res?.workshopId) {
                    setResolvedHqWorkshopId(String(res.workshopId));
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isHq, scope.hqWorkshopId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (isSupplier && scope.supplierId) {
                    const res = await getSuppliers().catch(() => ({ suppliers: [] }));
                    const s = (res?.suppliers || res || []).find(
                        (x) => String(x.id) === String(scope.supplierId),
                    );
                    if (!cancelled) setEntityLabel(s?.name || '');
                } else if (workshopId) {
                    const res = await getWorkshops({ limit: 100 }).catch(() => ({ workshops: [] }));
                    const w = (res?.workshops || res || []).find(
                        (x) => String(x.id) === String(workshopId),
                    );
                    if (!cancelled) {
                        setEntityLabel(
                            isHq ? w?.name || 'Platform HQ' : w?.name || '',
                        );
                    }
                }
            } catch {
                /* optional */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isSupplier, isHq, scope.supplierId, workshopId]);

    useEffect(() => {
        if (urlDateFrom) setDateFrom(urlDateFrom);
        if (urlDateTo) setDateTo(urlDateTo);
    }, [accountId, urlDateFrom, urlDateTo]);

    const ledgerParams = useMemo(() => {
        const p = {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 10000,
        };
        if (!isSupplier && scope.branchId) {
            p.branchId = scope.branchId;
        }
        if (!isSupplier && workshopId) {
            p.workshopId = workshopId;
        }
        return p;
    }, [dateFrom, dateTo, isSupplier, scope.branchId, workshopId]);

    const load = useCallback(async () => {
        if (!accountId) return;
        if (isSupplier && !scope.supplierId) {
            setErr('Select a supplier on Chart of Accounts first.');
            setData(null);
            setLoading(false);
            return;
        }
        if (!isSupplier && !workshopId) {
            setErr(
                isHq
                    ? 'Set up Platform HQ books on Chart of Accounts first.'
                    : 'Select a workshop on Chart of Accounts first.',
            );
            setData(null);
            setLoading(false);
            return;
        }
        const seq = ++loadSeqRef.current;
        setLoading(true);
        setErr('');
        try {
            let res;
            if (isSupplier) {
                res = await supMon.monitorSupplierAccountLedger(
                    scope.supplierId,
                    accountId,
                    ledgerParams,
                );
            } else {
                res = await accountsApi.getAccountLedger(accountId, ledgerParams);
            }
            if (seq !== loadSeqRef.current) return;
            setData(unwrapLedgerPayload(res));
        } catch (e) {
            if (seq !== loadSeqRef.current) return;
            setErr(e?.message || 'Failed to load ledger');
            setData(null);
        } finally {
            if (seq === loadSeqRef.current) setLoading(false);
        }
    }, [accountId, isHq, isSupplier, ledgerParams, scope.supplierId, workshopId]);

    useEffect(() => {
        void load();
    }, [load]);

    async function fetchForExport() {
        if (isSupplier) {
            const res = await supMon.monitorSupplierAccountLedger(
                scope.supplierId,
                accountId,
                { ...ledgerParams, limit: 10000 },
            );
            return unwrapLedgerPayload(res);
        }
        const res = await accountsApi.getAccountLedger(accountId, {
            ...ledgerParams,
            limit: 10000,
        });
        return unwrapLedgerPayload(res);
    }

    function buildExportHeader(root) {
        return {
            ...(root?.header || {}),
            accountCode: root?.header?.accountCode || fallbackCode || data?.header?.accountCode || '',
            accountName: root?.header?.accountName || fallbackName || data?.header?.accountName || '',
            accountType: root?.header?.accountType || fallbackType || data?.header?.accountType || '',
            companyName: root?.header?.companyName || entityLabel || undefined,
            from: root?.header?.from || dateFrom || undefined,
            to: root?.header?.to || dateTo || undefined,
            currencyCode: root?.header?.currencyCode || 'SAR',
        };
    }

    async function onExportPdf() {
        setErr('');
        try {
            const root = await fetchForExport();
            exportAccountLedgerPdf({
                header: buildExportHeader(root),
                openingBalance: root?.openingBalance ?? 0,
                rows: root?.rows ?? [],
                totals: root?.totals,
            });
        } catch (e) {
            setErr(e?.message || 'PDF export failed');
        }
    }

    async function onExportExcel() {
        setErr('');
        try {
            const root = await fetchForExport();
            exportAccountLedgerExcel({
                header: buildExportHeader(root),
                openingBalance: root?.openingBalance ?? 0,
                rows: root?.rows ?? [],
                totals: root?.totals,
            });
        } catch (e) {
            setErr(e?.message || 'Excel export failed');
        }
    }

    function clearRange() {
        const next = loadSaAccountingDateRange();
        setDateFrom(next.dateFrom);
        setDateTo(next.dateTo);
    }

    const accountType =
        data?.header?.accountType ||
        data?.account?.type ||
        fallbackType ||
        '';
    const normalDebit = accountNormalDebit(accountType);
    const scopeLabel = isSupplier ? 'Supplier' : isHq ? 'Platform HQ' : 'Workshop';
    const scopeNote = isHq
        ? `${scopeLabel}: ${entityLabel || '—'} · Full editing enabled`
        : `${scopeLabel}: ${entityLabel || '—'} · Read-only monitoring`;

    return (
        <div className="accounting-page module-container">
            <ProfessionalLedgerStatementDocument
                onBack={() => navigate('/admin/accounting/chart-of-accounts')}
                backLabel="Back to Chart of Accounts"
                scopeNote={scopeNote}
                loading={loading}
                error={err}
                accountCode={data?.header?.accountCode || fallbackCode}
                accountName={data?.header?.accountName || fallbackName}
                accountType={accountType}
                companyName={data?.header?.companyName || entityLabel || undefined}
                periodFrom={data?.header?.from || dateFrom || '—'}
                periodTo={data?.header?.to || dateTo || '—'}
                openingBalance={data?.openingBalance ?? 0}
                rows={data?.rows ?? []}
                totals={data?.totals}
                normalDebit={normalDebit}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onApply={() => void load()}
                onClear={clearRange}
                onExportPdf={() => void onExportPdf()}
                onExportExcel={() => void onExportExcel()}
                exportDisabled={!data || loading}
            />
        </div>
    );
}
