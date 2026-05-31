import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Pencil, Search } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams, unwrapWorkshopBranchListResponse } from '../../services/workshopStaffApi';
import { getBranchProducts, getBranchServices } from '../../services/workshopCatalogApi';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const catalogItemId = (row, kind) => {
    if (kind === 'products') {
        return String(row.id ?? row.productId ?? row.product?.id ?? '');
    }
    return String(row.id ?? row.serviceId ?? row.service?.id ?? '');
};

const catalogItemName = (row) =>
    row.name ?? row.product?.name ?? row.service?.name ?? '—';

const emptyForm = () => ({
    code: '',
    discountType: 'fixed',
    discountValue: '',
    validFrom: '',
    validTo: '',
    usageLimit: '',
    minOrderAmount: '',
    description: '',
    isActive: true,
    branchMode: 'all',
    branchIds: [],
    allProducts: true,
    productIds: [],
    allServices: true,
    serviceIds: [],
});

const promoToForm = (promo) => {
    const branchIds = Array.isArray(promo.branchIds)
        ? promo.branchIds.map(String)
        : Array.isArray(promo.branch_ids)
            ? promo.branch_ids.map(String)
            : [];
    const productIds = Array.isArray(promo.productIds)
        ? promo.productIds.map(String)
        : [];
    const serviceIds = Array.isArray(promo.serviceIds)
        ? promo.serviceIds.map(String)
        : [];
    return {
        code: promo.code || '',
        discountType: promo.discountType === 'percent' ? 'percent' : 'fixed',
        discountValue: promo.discountValue != null && promo.discountValue !== '' ? String(promo.discountValue) : '',
        validFrom: promo.validFrom || '',
        validTo: promo.validTo || '',
        usageLimit: promo.usageLimit != null && promo.usageLimit !== '' ? String(promo.usageLimit) : '',
        minOrderAmount: promo.minOrderAmount != null && promo.minOrderAmount !== '' ? String(promo.minOrderAmount) : '',
        description: promo.description || '',
        isActive: promo.isActive !== false,
        branchMode: branchIds.length === 0 ? 'all' : 'selected',
        branchIds,
        allProducts: productIds.length === 0,
        productIds,
        allServices: serviceIds.length === 0,
        serviceIds,
    };
};

function buildPromoPayload(form, { includeIsActive = false } = {}) {
    const payload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: toNumber(form.discountValue),
        validFrom: form.validFrom,
        validTo: form.validTo,
        usageLimit: form.usageLimit.trim() === '' ? null : toNumber(form.usageLimit),
        minOrderAmount: form.minOrderAmount.trim() === '' ? null : toNumber(form.minOrderAmount),
        description: form.description.trim() || null,
        branchIds: form.branchMode === 'all' ? [] : form.branchIds.map(String),
        productIds: form.allProducts ? [] : form.productIds.map(String),
        serviceIds: form.allServices ? [] : form.serviceIds.map(String),
    };
    if (includeIsActive) {
        payload.isActive = Boolean(form.isActive);
    }
    return payload;
}

function ApplicabilityPicker({
    title,
    allLabel,
    allChecked,
    onAllChange,
    items,
    selectedIds,
    onToggle,
    onSelectMany,
    kind,
    loading,
    disabled,
}) {
    const [search, setSearch] = useState('');

    const sorted = useMemo(
        () => [...items].sort((a, b) => catalogItemName(a).localeCompare(catalogItemName(b))),
        [items],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((row) => catalogItemName(row).toLowerCase().includes(q));
    }, [sorted, search]);

    const visibleIds = useMemo(
        () => filtered.map((row) => catalogItemId(row, kind)).filter(Boolean),
        [filtered, kind],
    );

    const selectedInView = visibleIds.filter((id) => selectedIds.includes(id)).length;

    const selectVisible = () => {
        if (disabled || !visibleIds.length) return;
        onSelectMany([...new Set([...selectedIds, ...visibleIds])]);
    };

    const clearVisible = () => {
        if (disabled || !visibleIds.length) return;
        const remove = new Set(visibleIds);
        onSelectMany(selectedIds.filter((id) => !remove.has(id)));
    };

    return (
        <div className="ws-promo-picker">
            <div className="ws-promo-picker-head">
                <label>{title}</label>
                {!allChecked && selectedIds.length > 0 ? (
                    <span className="ws-promo-picker-count">{selectedIds.length} selected</span>
                ) : null}
            </div>
            <label className="ws-promo-picker-all">
                <input
                    type="checkbox"
                    checked={allChecked}
                    disabled={disabled}
                    onChange={(e) => onAllChange(e.target.checked)}
                />
                {allLabel}
            </label>
            {!allChecked ? (
                <>
                    <div className="ws-promo-picker-search-wrap">
                        <Search size={15} />
                        <input
                            type="text"
                            className="ws-promo-picker-search"
                            placeholder={`Search ${kind}…`}
                            value={search}
                            disabled={disabled || loading}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {!disabled && !loading && filtered.length > 0 ? (
                        <div className="ws-promo-picker-actions">
                            <button type="button" disabled={disabled} onClick={selectVisible}>
                                Select visible ({visibleIds.length})
                            </button>
                            <button type="button" disabled={disabled || selectedInView === 0} onClick={clearVisible}>
                                Clear visible
                            </button>
                        </div>
                    ) : null}
                    <div className="ws-promo-picker-list">
                        {loading ? (
                            <p className="ws-promo-picker-empty">Loading catalog…</p>
                        ) : disabled ? (
                            <p className="ws-promo-picker-empty">Select at least one branch first.</p>
                        ) : sorted.length === 0 ? (
                            <p className="ws-promo-picker-empty">
                                No {kind} on the selected branch(es). Adopt items in catalog first.
                            </p>
                        ) : filtered.length === 0 ? (
                            <p className="ws-promo-picker-empty">No {kind} match &ldquo;{search.trim()}&rdquo;</p>
                        ) : filtered.map((row) => {
                            const id = catalogItemId(row, kind);
                            if (!id) return null;
                            const checked = selectedIds.includes(id);
                            return (
                                <label key={id} className="ws-promo-picker-row">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={() => onToggle(id)}
                                    />
                                    <span>{catalogItemName(row)}</span>
                                </label>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </div>
    );
}

function PromoCodeFormFields({
    form,
    setForm,
    branches = [],
    catalogProducts = [],
    catalogServices = [],
    catalogLoading = false,
    codeReadOnly = false,
    usageCount,
    formError = '',
}) {
    const branchOptions = useMemo(
        () => branches.filter((b) => b.isActive !== false),
        [branches],
    );

    const toggleBranch = (branchId) => {
        const id = String(branchId);
        setForm((prev) => {
            const has = prev.branchIds.includes(id);
            const branchIds = has
                ? prev.branchIds.filter((x) => x !== id)
                : [...prev.branchIds, id];
            return { ...prev, branchIds };
        });
    };

    const toggleId = (field, id) => {
        setForm((prev) => {
            const list = prev[field];
            const next = list.includes(id)
                ? list.filter((x) => x !== id)
                : [...list, id];
            return { ...prev, [field]: next };
        });
    };

    const setIds = (field, ids) => {
        setForm((prev) => ({ ...prev, [field]: ids.map(String) }));
    };

    const catalogDisabled = form.branchMode === 'selected' && form.branchIds.length === 0;

    return (
        <div>
            {formError ? <p className="ws-promo-form-error">{formError}</p> : null}

            <section className="ws-promo-form-section">
                <h3 className="ws-promo-form-section-title">Promo details</h3>
                <p className="ws-promo-form-section-desc">Code, discount, and optional description.</p>
                <div className="ws-form-grid">
                    <div className="ws-field">
                        <label>Promo Code *</label>
                        <input
                            value={form.code}
                            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                            placeholder="e.g. SAVE20"
                            readOnly={codeReadOnly}
                            style={codeReadOnly ? { background: '#f8fafc', cursor: 'not-allowed' } : undefined}
                        />
                    </div>
                    <div className="ws-field">
                        <label>Status</label>
                        <select
                            value={form.isActive ? 'active' : 'inactive'}
                            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="ws-field">
                        <label>Discount Type *</label>
                        <select
                            value={form.discountType}
                            onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}
                        >
                            <option value="fixed">Fixed (SAR)</option>
                            <option value="percent">Percent (%)</option>
                        </select>
                    </div>
                    <div className="ws-field">
                        <label>Discount Value *</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.discountValue}
                            onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                            placeholder={form.discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                        />
                    </div>
                    <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                        <label>Description</label>
                        <input
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Optional internal note"
                        />
                    </div>
                </div>
            </section>

            <section className="ws-promo-form-section">
                <h3 className="ws-promo-form-section-title">Validity & limits</h3>
                <p className="ws-promo-form-section-desc">When the promo is valid and how often it can be used.</p>
                <div className="ws-form-grid">
                    <div className="ws-field">
                        <label>Valid From *</label>
                        <input
                            type="date"
                            value={form.validFrom}
                            onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))}
                        />
                    </div>
                    <div className="ws-field">
                        <label>Valid To *</label>
                        <input
                            type="date"
                            value={form.validTo}
                            onChange={(e) => setForm((prev) => ({ ...prev, validTo: e.target.value }))}
                        />
                    </div>
                    <div className="ws-field">
                        <label>Usage Limit</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={form.usageLimit}
                            onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
                            placeholder="Leave empty for unlimited"
                        />
                        {usageCount != null && (
                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Times used: {toNumber(usageCount)}
                            </p>
                        )}
                    </div>
                    <div className="ws-field">
                        <label>Min Order Amount (SAR)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.minOrderAmount}
                            onChange={(e) => setForm((prev) => ({ ...prev, minOrderAmount: e.target.value }))}
                            placeholder="Optional"
                        />
                    </div>
                </div>
            </section>

            <section className="ws-promo-form-section">
                <h3 className="ws-promo-form-section-title">Where this promo applies</h3>
                <p className="ws-promo-form-section-desc">
                    Choose branches, then optionally limit to specific products and services from those branches.
                </p>
                <div className="ws-form-grid">
                    <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                        <label>Branches *</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 10 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="promoBranchMode"
                                    checked={form.branchMode === 'all'}
                                    onChange={() => setForm((prev) => ({
                                        ...prev,
                                        branchMode: 'all',
                                        branchIds: [],
                                    }))}
                                />
                                All branches
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="promoBranchMode"
                                    checked={form.branchMode === 'selected'}
                                    onChange={() => setForm((prev) => ({ ...prev, branchMode: 'selected' }))}
                                />
                                Selected branches
                            </label>
                        </div>
                        {form.branchMode === 'selected' ? (
                            <div className="ws-promo-branch-list">
                                {branchOptions.length === 0 ? (
                                    <p className="ws-promo-picker-empty">No branches available.</p>
                                ) : branchOptions.map((b) => {
                                    const id = String(b.id);
                                    return (
                                        <label key={id} className="ws-promo-branch-row">
                                            <input
                                                type="checkbox"
                                                checked={form.branchIds.includes(id)}
                                                onChange={() => toggleBranch(id)}
                                            />
                                            <span>{b.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="form-help-text" style={{ margin: 0 }}>
                                Promo applies to all active branches ({branchOptions.length}).
                            </p>
                        )}
                    </div>

                    <div className="ws-promo-applicability-grid">
                        <ApplicabilityPicker
                            title="Products"
                            allLabel="All products on selected branch(es)"
                            allChecked={form.allProducts}
                            onAllChange={(checked) => setForm((prev) => ({
                                ...prev,
                                allProducts: checked,
                                productIds: checked ? [] : prev.productIds,
                            }))}
                            items={catalogProducts}
                            selectedIds={form.productIds}
                            onToggle={(id) => toggleId('productIds', id)}
                            onSelectMany={(ids) => setIds('productIds', ids)}
                            kind="products"
                            loading={catalogLoading}
                            disabled={catalogDisabled}
                        />

                        <ApplicabilityPicker
                            title="Services"
                            allLabel="All services on selected branch(es)"
                            allChecked={form.allServices}
                            onAllChange={(checked) => setForm((prev) => ({
                                ...prev,
                                allServices: checked,
                                serviceIds: checked ? [] : prev.serviceIds,
                            }))}
                            items={catalogServices}
                            selectedIds={form.serviceIds}
                            onToggle={(id) => toggleId('serviceIds', id)}
                            onSelectMany={(ids) => setIds('serviceIds', ids)}
                            kind="services"
                            loading={catalogLoading}
                            disabled={catalogDisabled}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function scopeSummary(promo, branches) {
    const branchIds = promo.branchIds ?? [];
    const productIds = promo.productIds ?? [];
    const serviceIds = promo.serviceIds ?? [];
    const branchText = branchIds.length === 0
        ? 'All branches'
        : branchIds.length === 1
            ? (branches.find((b) => String(b.id) === String(branchIds[0]))?.name ?? '1 branch')
            : `${branchIds.length} branches`;
    const productText = productIds.length === 0 ? 'All products' : `${productIds.length} products`;
    const serviceText = serviceIds.length === 0 ? 'All services' : `${serviceIds.length} services`;
    return { branchText, productText, serviceText };
}

export default function WorkshopPromoCodes({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const canCreatePromo = hasPermission('workshop.promo-codes.create');
    const canEditPromo   = hasPermission('workshop.promo-codes.edit');
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const [promoCodes, setPromoCodes] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [modalError, setModalError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [catalogServices, setCatalogServices] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const branchIdsForCatalog = useMemo(() => {
        if (form.branchMode === 'all') {
            return branches.filter((b) => b.isActive !== false).map((b) => String(b.id));
        }
        return form.branchIds;
    }, [form.branchMode, form.branchIds, branches]);

    const loadPromoCodes = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch(
                `/workshop-staff/promo-codes${qs({
                    limit: 100,
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
            setTotal(response.total ?? rows.length);
        } catch (err) {
            setError(err.message || 'Failed to load promo codes.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadPromoCodes();
    }, [loadPromoCodes]);

    useEffect(() => {
        if (!showCreateModal) return undefined;
        let cancelled = false;

        const loadCatalog = async () => {
            if (branchIdsForCatalog.length === 0) {
                setCatalogProducts([]);
                setCatalogServices([]);
                return;
            }
            setCatalogLoading(true);
            try {
                const productMap = new Map();
                const serviceMap = new Map();
                await Promise.all(branchIdsForCatalog.map(async (bid) => {
                    const [pRes, sRes] = await Promise.all([
                        getBranchProducts(bid).catch(() => null),
                        getBranchServices(bid).catch(() => null),
                    ]);
                    for (const p of unwrapWorkshopBranchListResponse(pRes, 'products')) {
                        const id = catalogItemId(p, 'products');
                        if (id) productMap.set(id, p);
                    }
                    for (const s of unwrapWorkshopBranchListResponse(sRes, 'services')) {
                        const id = catalogItemId(s, 'services');
                        if (id) serviceMap.set(id, s);
                    }
                }));
                if (!cancelled) {
                    setCatalogProducts([...productMap.values()]);
                    setCatalogServices([...serviceMap.values()]);
                }
            } finally {
                if (!cancelled) setCatalogLoading(false);
            }
        };

        loadCatalog();
        return () => { cancelled = true; };
    }, [showCreateModal, branchIdsForCatalog.join('|')]);

    const openCreate = () => {
        setEditingPromo(null);
        setForm(emptyForm());
        setModalError('');
        setShowCreateModal(true);
    };

    const openEdit = (promo) => {
        setEditingPromo(promo);
        setForm(promoToForm(promo));
        setModalError('');
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingPromo(null);
        setForm(emptyForm());
        setModalError('');
        setCatalogProducts([]);
        setCatalogServices([]);
    };

    const validateForm = () => {
        if (!form.code.trim() || !form.validFrom || !form.validTo) return 'Code, valid from, and valid to are required.';
        if (form.branchMode === 'selected' && form.branchIds.length === 0) {
            return 'Select at least one branch, or choose All branches.';
        }
        if (!form.allProducts && form.productIds.length === 0) {
            return 'Select at least one product, or choose All products.';
        }
        if (!form.allServices && form.serviceIds.length === 0) {
            return 'Select at least one service, or choose All services.';
        }
        if (toNumber(form.discountValue) <= 0) return 'Discount value must be greater than zero.';
        if (form.validTo && form.validFrom && form.validTo < form.validFrom) {
            return 'Valid To must be on or after Valid From.';
        }
        return '';
    };

    const savePromoCode = async () => {
        const validationMsg = validateForm();
        if (validationMsg) {
            setModalError(validationMsg);
            return;
        }

        setIsSaving(true);
        setModalError('');
        setError('');
        try {
            if (editingPromo) {
                await apiFetch(`/workshop-staff/promo-code/${encodeURIComponent(String(editingPromo.id))}`, {
                    method: 'PATCH',
                    body: JSON.stringify(buildPromoPayload(form, { includeIsActive: true })),
                });
            } else {
                const payload = buildPromoPayload(form, { includeIsActive: true });
                await apiFetch('/workshop-staff/promo-code/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...payload,
                        usageLimit: payload.usageLimit ?? undefined,
                        minOrderAmount: payload.minOrderAmount ?? undefined,
                        isActive: true,
                    }),
                });
            }
            closeModal();
            await loadPromoCodes();
        } catch (err) {
            setModalError(err.message || (editingPromo ? 'Failed to update promo code.' : 'Failed to create promo code.'));
        } finally {
            setIsSaving(false);
        }
    };

    const activeCount = promoCodes.filter((p) => p.isActive).length;

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Promo Codes</h2>
                    <p className="ws-page-sub">
                        Create and manage promotional codes · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-portal" onClick={loadPromoCodes} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    {canCreatePromo && (
                        <button type="button" className="btn-portal" onClick={openCreate}>
                            <Plus size={14} /> Create Promo
                        </button>
                    )}
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
                        <p className="ws-kpi-label">Total Promo Codes</p>
                        <p className="ws-kpi-value">{total}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">PC</div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Active</p>
                        <p className="ws-kpi-value">{activeCount}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">ON</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <div style={{ overflowX: 'auto', padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Branches</th>
                                <th>Products</th>
                                <th>Services</th>
                                <th>Validity</th>
                                <th>Usage</th>
                                <th>Min Order</th>
                                <th>Status</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && promoCodes.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={10} />
                            ) : promoCodes.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No promo codes found
                                    </td>
                                </tr>
                            ) : (
                                promoCodes.map((promo) => {
                                    const scope = scopeSummary(promo, branches);
                                    return (
                                        <tr key={promo.id}>
                                            <td><strong>{promo.code}</strong></td>
                                            <td>
                                                {promo.discountType === 'percent'
                                                    ? `${toNumber(promo.discountValue)}%`
                                                    : `SAR ${toNumber(promo.discountValue).toLocaleString()}`}
                                            </td>
                                            <td>{scope.branchText}</td>
                                            <td>{scope.productText}</td>
                                            <td>{scope.serviceText}</td>
                                            <td>
                                                {promo.validFrom || '—'} to {promo.validTo || '—'}
                                            </td>
                                            <td>
                                                {promo.usageLimit != null && promo.usageLimit !== ''
                                                    ? `${toNumber(promo.usageCount)} / ${toNumber(promo.usageLimit)}`
                                                    : `${toNumber(promo.usageCount)} / ∞`}
                                            </td>
                                            <td>SAR {toNumber(promo.minOrderAmount).toLocaleString()}</td>
                                            <td>
                                                <span className={`ws-badge ${promo.isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                    {promo.isActive ? 'active' : 'inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                {canEditPromo && (
                                                    <button
                                                        type="button"
                                                        className="btn-portal"
                                                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        onClick={() => openEdit(promo)}
                                                    >
                                                        <Pencil size={12} /> Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreateModal && (
                <Modal
                    title={editingPromo ? `Edit Promo — ${editingPromo.code}` : 'Create Promo Code'}
                    onClose={closeModal}
                    width={920}
                    contentClassName="ws-promo-modal"
                    footer={(
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                            <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSaving}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                onClick={savePromoCode}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : editingPromo ? 'Update Promo' : 'Create Promo'}
                            </button>
                        </div>
                    )}
                >
                    <PromoCodeFormFields
                        form={form}
                        setForm={setForm}
                        branches={branches}
                        catalogProducts={catalogProducts}
                        catalogServices={catalogServices}
                        catalogLoading={catalogLoading}
                        codeReadOnly={Boolean(editingPromo)}
                        usageCount={editingPromo ? toNumber(editingPromo.usageCount) : undefined}
                        formError={modalError}
                    />
                </Modal>
            )}
        </div>
    );
}
