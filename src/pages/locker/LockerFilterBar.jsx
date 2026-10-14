import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useLockerPortal } from './useLockerPortal';

export default function LockerFilterBar({
    filters,
    onChange,
    onApply,
    onReset,
    branches = [],
    cashiers = [],
    officers = [],
    showOfficer = false,
    showExpectedRange = false,
    loading = false,
    branchLockedId = null,
}) {
    const { t } = useLockerPortal();
    const set = (key, value) => onChange({ ...filters, [key]: value });
    const branchLocked = Boolean(branchLockedId);

    return (
        <div className="wlk-filter-bar">
            <div className="wlk-filter-bar__head">
                <span className="wlk-filter-bar__title">
                    <Filter size={14} /> {t('common.filters')}
                </span>
                <div className="wlk-filter-bar__actions">
                    <button type="button" className="btn-secondary" onClick={onReset} disabled={loading}>
                        <RotateCcw size={13} /> {t('common.reset')}
                    </button>
                    <button type="button" className="btn-submit" onClick={onApply} disabled={loading}>
                        {t('common.apply')}
                    </button>
                </div>
            </div>
            <div className="wlk-filter-grid">
                <div className="ws-field">
                    <label>{t('common.fromDate')}</label>
                    <input
                        type="date"
                        value={filters.from || ''}
                        onChange={(e) => set('from', e.target.value)}
                    />
                </div>
                <div className="ws-field">
                    <label>{t('common.toDate')}</label>
                    <input
                        type="date"
                        value={filters.to || ''}
                        onChange={(e) => set('to', e.target.value)}
                    />
                </div>
                <div className="ws-field">
                    <label>{t('common.branch')}</label>
                    <select
                        value={branchLockedId || filters.branchId || 'all'}
                        disabled={branchLocked}
                        title={branchLocked ? t('common.branchLocked') : undefined}
                        onChange={(e) => set('branchId', e.target.value)}
                    >
                        {!branchLocked ? <option value="all">{t('common.allBranches')}</option> : null}
                        {branches.map((b) => (
                            <option key={b.id} value={String(b.id)}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="ws-field">
                    <label>{t('common.cashier')}</label>
                    <select
                        value={filters.cashierId || 'all'}
                        onChange={(e) => set('cashierId', e.target.value)}
                    >
                        <option value="all">{t('common.allCashiers')}</option>
                        {cashiers.map((c) => {
                            const id = String(c.id || c.userId);
                            return (
                                <option key={id} value={id}>
                                    {c.name || c.email}
                                </option>
                            );
                        })}
                    </select>
                </div>
                {showOfficer ? (
                    <div className="ws-field">
                        <label>{t('common.officer')}</label>
                        <select
                            value={filters.officerId || 'all'}
                            onChange={(e) => set('officerId', e.target.value)}
                        >
                            <option value="all">{t('common.allOfficers')}</option>
                            {officers.map((o) => (
                                <option key={o.id} value={String(o.id)}>
                                    {o.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
                {showExpectedRange ? (
                    <>
                        <div className="ws-field">
                            <label>{t('common.minExpected')}</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                value={filters.minExpected ?? ''}
                                onChange={(e) => set('minExpected', e.target.value)}
                            />
                        </div>
                        <div className="ws-field">
                            <label>{t('common.maxExpected')}</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={t('common.any')}
                                value={filters.maxExpected ?? ''}
                                onChange={(e) => set('maxExpected', e.target.value)}
                            />
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
