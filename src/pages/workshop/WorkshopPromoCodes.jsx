import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function WorkshopPromoCodes({ selectedBranchId = 'all', branches = [] }) {
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);
    const [promoCodes, setPromoCodes] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        code: '',
        discountType: 'fixed',
        discountValue: '',
        validFrom: '',
        validTo: '',
        usageLimit: '',
        minOrderAmount: '',
        description: '',
    });

    const loadPromoCodes = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch(
                `/workshop-staff/promo-codes${qs({
                    isActive: true,
                    limit: 20,
                    offset: 0,
                    ...branchScopeParams(selectedBranchId),
                })}`,
            );
            if (!(response?.success && Array.isArray(response.promoCodes))) {
                throw new Error('Invalid promo codes response.');
            }
            let rows = response.promoCodes;
            if (selectedBranchId && selectedBranchId !== 'all') {
                const bid = String(selectedBranchId);
                rows = rows.filter((pc) => {
                    const ids = pc.branchIds ?? pc.branch_ids ?? pc.applicableBranchIds;
                    if (!Array.isArray(ids) || ids.length === 0) return true;
                    return ids.some((id) => String(id) === bid);
                });
            }
            setPromoCodes(rows);
            setTotal(rows.length);
        } catch (err) {
            setError(err.message || 'Failed to load promo codes.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadPromoCodes();
    }, [loadPromoCodes]);

    const createPromoCode = async () => {
        if (!form.code.trim() || !form.validFrom || !form.validTo) return;

        setIsSaving(true);
        setError('');
        try {
            await apiFetch('/workshop-staff/promo-code/create', {
                method: 'POST',
                body: JSON.stringify({
                    code: form.code.trim().toUpperCase(),
                    discountType: form.discountType,
                    discountValue: toNumber(form.discountValue),
                    validFrom: form.validFrom,
                    validTo: form.validTo,
                    usageLimit: toNumber(form.usageLimit),
                    minOrderAmount: toNumber(form.minOrderAmount),
                    description: form.description.trim(),
                    isActive: true,
                }),
            });

            setShowCreateModal(false);
            setForm({
                code: '',
                discountType: 'fixed',
                discountValue: '',
                validFrom: '',
                validTo: '',
                usageLimit: '',
                minOrderAmount: '',
                description: '',
            });
            await loadPromoCodes();
        } catch (err) {
            setError(err.message || 'Failed to create promo code.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Promo Codes</h2>
                    <p className="ws-page-sub">
                        Active promotional codes · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-portal" onClick={loadPromoCodes} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button className="btn-portal" onClick={() => setShowCreateModal(true)}>
                        <Plus size={14} /> Create Promo
                    </button>
                </div>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Active Promo Codes</p>
                        <p className="ws-kpi-value">{total}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">PC</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <div style={{ overflowX: 'auto', padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Validity</th>
                                <th>Usage</th>
                                <th>Min Order</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && promoCodes.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={6} />
                            ) : promoCodes.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No promo codes found</td></tr>
                            ) : promoCodes.map((promo) => (
                                <tr key={promo.id}>
                                    <td><strong>{promo.code}</strong></td>
                                    <td>
                                        {promo.discountType === 'percent'
                                            ? `${toNumber(promo.discountValue)}%`
                                            : `SAR ${toNumber(promo.discountValue).toLocaleString()}`}
                                    </td>
                                    <td>{promo.validFrom || '—'} to {promo.validTo || '—'}</td>
                                    <td>{toNumber(promo.usageCount)} / {toNumber(promo.usageLimit)}</td>
                                    <td>SAR {toNumber(promo.minOrderAmount).toLocaleString()}</td>
                                    <td><span className={`ws-badge ${promo.isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>{promo.isActive ? 'active' : 'inactive'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreateModal && (
                <Modal
                    title="Create Promo Code"
                    onClose={() => setShowCreateModal(false)}
                    footer={
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn-secondary" onClick={() => setShowCreateModal(false)} disabled={isSaving}>Cancel</button>
                            <button className="btn-submit" onClick={createPromoCode} disabled={isSaving || !form.code.trim() || !form.validFrom || !form.validTo}>
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    }
                >
                    <div className="ws-form-grid">
                        <div className="ws-field"><label>Promo Code *</label><input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} placeholder="e.g. SAVE20" /></div>
                        <div className="ws-field"><label>Discount Type *</label><select value={form.discountType} onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}><option value="fixed">Fixed</option><option value="percent">Percent</option></select></div>
                        <div className="ws-field"><label>Discount Value</label><input type="number" value={form.discountValue} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))} /></div>
                        <div className="ws-field"><label>Usage Limit</label><input type="number" value={form.usageLimit} onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))} /></div>
                        <div className="ws-field"><label>Min Order Amount</label><input type="number" value={form.minOrderAmount} onChange={(e) => setForm((prev) => ({ ...prev, minOrderAmount: e.target.value }))} /></div>
                        <div className="ws-field"><label>Valid From *</label><input type="date" value={form.validFrom} onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))} /></div>
                        <div className="ws-field"><label>Valid To *</label><input type="date" value={form.validTo} onChange={(e) => setForm((prev) => ({ ...prev, validTo: e.target.value }))} /></div>
                        <div className="ws-field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
