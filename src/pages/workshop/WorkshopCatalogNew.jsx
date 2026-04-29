import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Package, Layers, Tags, Wrench, RefreshCw, ShieldCheck, Search, Plus,
    ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Filter,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    getCatalogDepartments,
    getCatalogCategories,
    getCatalogProducts,
    getCatalogServices,
    adoptDepartmentsToBranches,
    adoptCategoriesToBranches,
    adoptProductsToBranches,
    adoptServicesToBranches,
    previewProductDeps,
    previewServiceDeps,
} from '../../services/workshopCatalogApi';

const PAGE_SIZE = 25;

const TABS = [
    { id: 'departments', label: 'Departments', Icon: Layers },
    { id: 'categories',  label: 'Categories',  Icon: Tags },
    { id: 'products',    label: 'Products',    Icon: Package },
    { id: 'services',    label: 'Services',    Icon: Wrench },
];

/** Pull an array out of a backend response, trying a few common shapes. */
function pickArray(res, keys) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

/** Pull pagination metadata out of a list response. */
function pickPagination(res, fallbackPageSize = PAGE_SIZE) {
    const r = res?.data && typeof res.data === 'object' ? res.data : res || {};
    return {
        total: Number(r.total ?? r.count ?? 0) || 0,
        page: Number(r.page ?? 1) || 1,
        pageSize: Number(r.pageSize ?? fallbackPageSize) || fallbackPageSize,
    };
}

function rowHasInBranch(row) {
    return row?.inBranch === true || row?.in_branch === true;
}
function rowHasInWorkshop(row) {
    return row?.inWorkshop === true || row?.in_workshop === true || row?.adopted === true;
}

/** Group an array of `{ branchName, itemName }` adoption rows by branch. */
function groupByBranch(entries) {
    const map = new Map();
    for (const e of entries) {
        const key = e.branchName || (e.branchId != null ? `Branch ${e.branchId}` : 'Branch');
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e.itemName || e.name || e.itemId || '');
    }
    return [...map.entries()];
}

/**
 * Summarize the new per-branch adoption response.
 *   added: { departments: [{branchId, branchName, itemId, itemName, kind}], categories, products, services }
 *   skipped: [{ kind, branchId, itemId, reason }]
 */
function summarizeAdoptResponse(res, primaryKind) {
    const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
    const added = payload.added || {};
    const skipped = Array.isArray(payload.skipped) ? payload.skipped : [];

    const buckets = ['departments', 'categories', 'products', 'services'];
    const counts = Object.fromEntries(buckets.map((b) => [b, Array.isArray(added[b]) ? added[b].length : 0]));
    const primaryCount = counts[primaryKind] || 0;
    const extraBuckets = buckets.filter((b) => b !== primaryKind && counts[b] > 0);

    const extras = [];
    if (primaryCount > 0) {
        const groups = groupByBranch(added[primaryKind]);
        for (const [branch, names] of groups) {
            extras.push(
                `${branch}: ${names.length} ${primaryKind} (${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''})`,
            );
        }
    }
    for (const b of extraBuckets) {
        const groups = groupByBranch(added[b]);
        const total = counts[b];
        const noun = total === 1 ? b.replace(/s$/, '') : b;
        const branchSummary = groups.map(([branch, names]) => `${branch} (${names.length})`).join(', ');
        extras.push(`Also added ${total} ${noun} → ${branchSummary}`);
    }

    return {
        kind: 'success',
        summary: `Added: ${primaryCount} · Skipped: ${skipped.length}${skipped.length ? ' (already in branch)' : ''}`,
        addedExtras: extras,
    };
}

/** Top-of-tab dismissable banner showing the latest adopt result. */
function ResultBanner({ banner, onClose }) {
    if (!banner) return null;
    const isError = banner.kind === 'error';
    const Icon = isError ? AlertCircle : CheckCircle2;
    const color = isError ? '#B91C1C' : '#047857';
    const bg = isError ? '#FEE2E2' : '#ECFDF5';
    const border = isError ? '#FECACA' : '#A7F3D0';
    return (
        <div
            style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                color,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: '0.875rem',
            }}
        >
            <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{banner.summary}</div>
                {Array.isArray(banner.addedExtras) && banner.addedExtras.length > 0 && (
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {banner.addedExtras.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>
                )}
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color,
                    cursor: 'pointer',
                    padding: 2,
                    lineHeight: 0,
                }}
            >
                <X size={16} />
            </button>
        </div>
    );
}

/** Card used in every grid: checkbox + title + meta + adoption badge. */
function CatalogCard({ row, label, subtitle, meta, selected, disabled, disabledLabel, hint, onToggle }) {
    return (
        <div
            className={`mc-product-card ${disabled ? '' : 'clickable'} ${selected ? 'selected' : ''}`}
            onClick={() => !disabled && onToggle?.()}
            style={disabled ? { opacity: 0.7, cursor: 'default' } : undefined}
        >
            <div className="mc-card-type-label">{label}</div>
            <div className="mc-card-info-main">
                <h4 className="mc-card-title">{row.name}</h4>
                {subtitle && <span className="mc-card-subtitle">{subtitle}</span>}
                {meta?.length > 0 && (
                    <div className="mc-card-meta-list">
                        {meta.map((m, i) => (
                            <div key={i} className="mc-meta-item">
                                {m.Icon && <m.Icon size={14} />}
                                <span>{m.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                {hint && (
                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#0369A1', fontWeight: 600 }}>
                        {hint}
                    </div>
                )}
            </div>
            <div className="mc-card-footer-actions">
                {disabled ? (
                    <span className="ws-badge ws-badge--green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheck size={14} /> {disabledLabel || 'In your workshop'}
                    </span>
                ) : (
                    <div className={`mc-card-selection-btn ${selected ? 'selected' : ''}`}>
                        {selected ? <ShieldCheck size={20} /> : <Plus size={20} />}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function WorkshopCatalogNew({ selectedBranchId = 'all', branches: branchesProp = [] }) {
    const [activeTab, setActiveTab] = useState('departments');
    const [banner, setBanner] = useState(null);

    // Resolve the workshop-level branch context.
    const isAllBranches = !selectedBranchId || selectedBranchId === 'all';
    const browseBranchId = isAllBranches ? undefined : String(selectedBranchId);
    const branchList = useMemo(() => Array.isArray(branchesProp) ? branchesProp : [], [branchesProp]);
    const selectedBranchName = useMemo(
        () => branchList.find((b) => String(b.id) === String(selectedBranchId))?.name,
        [branchList, selectedBranchId],
    );

    // ─── Departments tab ────────────────────────────────────────────────────
    const [deptRows, setDeptRows] = useState([]);
    const [deptLoading, setDeptLoading] = useState(false);
    const [deptError, setDeptError] = useState('');
    const [deptSelected, setDeptSelected] = useState(new Set());

    const loadDepartments = useCallback((signal) => {
        setDeptLoading(true);
        setDeptError('');
        getCatalogDepartments({ branchId: browseBranchId, signal })
            .then((res) => setDeptRows(pickArray(res, ['departments', 'items'])))
            .catch((err) => {
                if (err.name !== 'AbortError') setDeptError(err.message || 'Failed to load departments.');
            })
            .finally(() => setDeptLoading(false));
    }, [browseBranchId]);

    // ─── Categories tab ─────────────────────────────────────────────────────
    const [catRows, setCatRows] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catError, setCatError] = useState('');
    const [catSelected, setCatSelected] = useState(new Set());
    const [catFilter, setCatFilter] = useState({ departmentId: 'all', type: 'all' });

    const loadCategories = useCallback((signal) => {
        setCatLoading(true);
        setCatError('');
        const params = {
            departmentId: catFilter.departmentId === 'all' ? undefined : catFilter.departmentId,
            type: catFilter.type === 'all' ? undefined : catFilter.type,
            branchId: browseBranchId,
            signal,
        };
        getCatalogCategories(params)
            .then((res) => setCatRows(pickArray(res, ['categories', 'items'])))
            .catch((err) => {
                if (err.name !== 'AbortError') setCatError(err.message || 'Failed to load categories.');
            })
            .finally(() => setCatLoading(false));
    }, [catFilter.departmentId, catFilter.type, browseBranchId]);

    // ─── Products tab ───────────────────────────────────────────────────────
    const [prodRows, setProdRows] = useState([]);
    const [prodLoading, setProdLoading] = useState(false);
    const [prodError, setProdError] = useState('');
    const [prodSelected, setProdSelected] = useState(new Set());
    const [prodFilter, setProdFilter] = useState({ departmentId: 'all', categoryId: 'all', q: '' });
    const [prodQInput, setProdQInput] = useState('');
    const [prodPage, setProdPage] = useState(1);
    const [prodTotal, setProdTotal] = useState(0);

    const loadProducts = useCallback((signal) => {
        setProdLoading(true);
        setProdError('');
        const params = {
            departmentId: prodFilter.departmentId === 'all' ? undefined : prodFilter.departmentId,
            categoryId: prodFilter.categoryId === 'all' ? undefined : prodFilter.categoryId,
            q: prodFilter.q || undefined,
            page: prodPage,
            pageSize: PAGE_SIZE,
            branchId: browseBranchId,
            signal,
        };
        getCatalogProducts(params)
            .then((res) => {
                setProdRows(pickArray(res, ['products', 'items']));
                setProdTotal(pickPagination(res).total);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setProdError(err.message || 'Failed to load products.');
            })
            .finally(() => setProdLoading(false));
    }, [prodFilter.departmentId, prodFilter.categoryId, prodFilter.q, prodPage, browseBranchId]);

    // ─── Services tab ───────────────────────────────────────────────────────
    const [svcRows, setSvcRows] = useState([]);
    const [svcLoading, setSvcLoading] = useState(false);
    const [svcError, setSvcError] = useState('');
    const [svcSelected, setSvcSelected] = useState(new Set());
    const [svcFilter, setSvcFilter] = useState({ departmentId: 'all', categoryId: 'all', q: '' });
    const [svcQInput, setSvcQInput] = useState('');
    const [svcPage, setSvcPage] = useState(1);
    const [svcTotal, setSvcTotal] = useState(0);

    const loadServices = useCallback((signal) => {
        setSvcLoading(true);
        setSvcError('');
        const params = {
            departmentId: svcFilter.departmentId === 'all' ? undefined : svcFilter.departmentId,
            categoryId: svcFilter.categoryId === 'all' ? undefined : svcFilter.categoryId,
            q: svcFilter.q || undefined,
            page: svcPage,
            pageSize: PAGE_SIZE,
            branchId: browseBranchId,
            signal,
        };
        getCatalogServices(params)
            .then((res) => {
                setSvcRows(pickArray(res, ['services', 'items']));
                setSvcTotal(pickPagination(res).total);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') setSvcError(err.message || 'Failed to load services.');
            })
            .finally(() => setSvcLoading(false));
    }, [svcFilter.departmentId, svcFilter.categoryId, svcFilter.q, svcPage, browseBranchId]);

    // ─── Effects: load when tab/filters change ──────────────────────────────
    useEffect(() => {
        const ctrl = new AbortController();
        if (activeTab === 'departments') loadDepartments(ctrl.signal);
        if (activeTab === 'categories')  loadCategories(ctrl.signal);
        if (activeTab === 'products')    loadProducts(ctrl.signal);
        if (activeTab === 'services')    loadServices(ctrl.signal);
        return () => ctrl.abort();
    }, [activeTab, loadDepartments, loadCategories, loadProducts, loadServices]);

    // Always have the department list ready for filter dropdowns and category modal.
    useEffect(() => {
        if (deptRows.length === 0 && !deptLoading) {
            const ctrl = new AbortController();
            loadDepartments(ctrl.signal);
            return () => ctrl.abort();
        }
        return undefined;
    }, [deptRows.length, deptLoading, loadDepartments]);

    // Reset to page 1 when filters change.
    useEffect(() => { setProdPage(1); }, [prodFilter.departmentId, prodFilter.categoryId, prodFilter.q]);
    useEffect(() => { setSvcPage(1); }, [svcFilter.departmentId, svcFilter.categoryId, svcFilter.q]);

    // Debounced search input → filter.
    const prodSearchRef = useRef();
    useEffect(() => {
        clearTimeout(prodSearchRef.current);
        prodSearchRef.current = setTimeout(() => {
            setProdFilter((f) => ({ ...f, q: prodQInput.trim() }));
        }, 350);
        return () => clearTimeout(prodSearchRef.current);
    }, [prodQInput]);

    const svcSearchRef = useRef();
    useEffect(() => {
        clearTimeout(svcSearchRef.current);
        svcSearchRef.current = setTimeout(() => {
            setSvcFilter((f) => ({ ...f, q: svcQInput.trim() }));
        }, 350);
        return () => clearTimeout(svcSearchRef.current);
    }, [svcQInput]);

    // ─── Modals ─────────────────────────────────────────────────────────────
    // Default branch targets for any new modal: the currently-selected branch
    // when one is picked, otherwise "all branches" (empty array → BE resolves
    // to every active branch).
    const defaultTargetBranchIds = useMemo(
        () => (isAllBranches ? [] : [String(selectedBranchId)]),
        [isAllBranches, selectedBranchId],
    );

    const [deptCatModal, setDeptCatModal] = useState(null);
    // { departments, selections, targetBranchIds, loading, error }
    const [productAdopt, setProductAdopt] = useState(null);
    // { rows, missing, openingQty, criticalStockPoint, targetBranchIds, loading, error }
    const [serviceAdopt, setServiceAdopt] = useState(null);
    // { rows, missing, targetBranchIds, loading, error }

    const idsToRows = (ids, rows) => rows.filter((r) => ids.has(String(r.id ?? r._id)));

    // ─── Adopt: Departments ─────────────────────────────────────────────────
    const openDeptCategoryModal = useCallback(async () => {
        const selectedRows = idsToRows(deptSelected, deptRows);
        if (selectedRows.length === 0) return;
        const selections = {};
        for (const d of selectedRows) {
            selections[String(d.id)] = { mode: 'all', pickedIds: new Set(), categories: [] };
        }
        setDeptCatModal({
            departments: selectedRows,
            selections,
            targetBranchIds: defaultTargetBranchIds,
            loading: false,
            error: '',
        });
        // Fetch categories for each selected department (no branch context — we
        // need the full master list so the user can pick what to adopt).
        for (const d of selectedRows) {
            try {
                const res = await getCatalogCategories({ departmentId: d.id, branchId: browseBranchId });
                const cats = pickArray(res, ['categories', 'items']);
                setDeptCatModal((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev, selections: { ...prev.selections } };
                    next.selections[String(d.id)] = {
                        ...next.selections[String(d.id)],
                        categories: cats,
                    };
                    return next;
                });
            } catch {
                /* leave categories empty for this dept */
            }
        }
    }, [deptSelected, deptRows, defaultTargetBranchIds, browseBranchId]);

    const submitDepartmentsAdopt = async () => {
        if (!deptCatModal) return;
        setDeptCatModal((prev) => ({ ...prev, loading: true, error: '' }));
        const departmentIds = deptCatModal.departments.map((d) => String(d.id));
        const categorySelections = [];
        for (const d of deptCatModal.departments) {
            const sel = deptCatModal.selections[String(d.id)];
            if (!sel) continue;
            if (sel.mode === 'all') {
                categorySelections.push({ departmentId: String(d.id), categoryIds: 'all' });
            } else if (sel.mode === 'pick' && sel.pickedIds && sel.pickedIds.size > 0) {
                categorySelections.push({
                    departmentId: String(d.id),
                    categoryIds: [...sel.pickedIds].map(String),
                });
            }
            // mode === 'none' → omit, dept added without categories
        }
        try {
            const body = {
                departmentIds,
                ...(categorySelections.length ? { categorySelections } : {}),
                ...(deptCatModal.targetBranchIds?.length ? { branchIds: deptCatModal.targetBranchIds } : {}),
            };
            const res = await adoptDepartmentsToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'departments'));
            setDeptSelected(new Set());
            setDeptCatModal(null);
            const ctrl = new AbortController();
            loadDepartments(ctrl.signal);
        } catch (err) {
            setDeptCatModal((prev) => prev && { ...prev, loading: false, error: err.message || 'Failed to add.' });
        }
    };

    // ─── Adopt: Categories (small modal just to pick target branches) ───────
    const [categoryAdopt, setCategoryAdopt] = useState(null);
    // { ids: string[], targetBranchIds: string[], loading, error }

    const openCategoryAdopt = () => {
        if (catSelected.size === 0) return;
        setCategoryAdopt({
            ids: [...catSelected].map(String),
            targetBranchIds: defaultTargetBranchIds,
            loading: false,
            error: '',
        });
    };

    const submitCategoriesAdopt = async () => {
        if (!categoryAdopt) return;
        setCategoryAdopt((prev) => prev && { ...prev, loading: true, error: '' });
        try {
            const body = {
                categoryIds: categoryAdopt.ids,
                ...(categoryAdopt.targetBranchIds?.length ? { branchIds: categoryAdopt.targetBranchIds } : {}),
            };
            const res = await adoptCategoriesToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'categories'));
            setCatSelected(new Set());
            setCategoryAdopt(null);
            const ctrl = new AbortController();
            loadCategories(ctrl.signal);
        } catch (err) {
            setCategoryAdopt((prev) => prev && { ...prev, loading: false, error: err.message || 'Failed to add categories.' });
        }
    };

    // ─── Adopt: Products ────────────────────────────────────────────────────
    const openProductAdopt = useCallback(async () => {
        const selectedRows = idsToRows(prodSelected, prodRows);
        if (selectedRows.length === 0) return;
        setProductAdopt({
            rows: selectedRows,
            missing: { departments: [], categories: [] },
            // Per-row stock entry. Empty strings show as placeholders so it's
            // obvious that 0 isn't the silent default — you'll get 0 only if
            // you explicitly type 0 (or leave blank and the FE coerces it).
            items: selectedRows.map((r) => ({
                productId: String(r.id),
                name: r.name,
                openingQty: '',
                criticalStockPoint: '',
            })),
            bulkOpeningQty: '',
            bulkCriticalStockPoint: '',
            targetBranchIds: defaultTargetBranchIds,
            loading: true,
            error: '',
        });
        try {
            const res = await previewProductDeps({ productIds: selectedRows.map((r) => String(r.id)) });
            const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
            const missing = payload.missing || { departments: [], categories: [] };
            setProductAdopt((prev) => prev && {
                ...prev,
                missing: {
                    departments: Array.isArray(missing.departments) ? missing.departments : [],
                    categories: Array.isArray(missing.categories) ? missing.categories : [],
                },
                loading: false,
            });
        } catch (err) {
            setProductAdopt((prev) => prev && { ...prev, loading: false, error: err.message || 'Could not check dependencies.' });
        }
    }, [prodSelected, prodRows, defaultTargetBranchIds]);

    const submitProductsAdopt = async () => {
        if (!productAdopt) return;
        setProductAdopt((prev) => prev && { ...prev, loading: true, error: '' });
        try {
            const items = productAdopt.items.map((it) => ({
                productId: String(it.productId),
                openingQty: it.openingQty === '' ? 0 : Number(it.openingQty) || 0,
                criticalStockPoint: it.criticalStockPoint === '' ? 0 : Number(it.criticalStockPoint) || 0,
            }));
            const body = {
                items,
                ...(productAdopt.targetBranchIds?.length ? { branchIds: productAdopt.targetBranchIds } : {}),
            };
            const res = await adoptProductsToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'products'));
            setProdSelected(new Set());
            setProductAdopt(null);
            const ctrl = new AbortController();
            loadProducts(ctrl.signal);
        } catch (err) {
            setProductAdopt((prev) => prev && { ...prev, loading: false, error: err.message || 'Failed to add products.' });
        }
    };

    // ─── Adopt: Services ────────────────────────────────────────────────────
    const openServiceAdopt = useCallback(async () => {
        const selectedRows = idsToRows(svcSelected, svcRows);
        if (selectedRows.length === 0) return;
        setServiceAdopt({
            rows: selectedRows,
            missing: { departments: [], categories: [] },
            targetBranchIds: defaultTargetBranchIds,
            loading: true,
            error: '',
        });
        try {
            const res = await previewServiceDeps({ serviceIds: selectedRows.map((r) => String(r.id)) });
            const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
            const missing = payload.missing || { departments: [], categories: [] };
            setServiceAdopt((prev) => prev && {
                ...prev,
                missing: {
                    departments: Array.isArray(missing.departments) ? missing.departments : [],
                    categories: Array.isArray(missing.categories) ? missing.categories : [],
                },
                loading: false,
            });
        } catch (err) {
            setServiceAdopt((prev) => prev && { ...prev, loading: false, error: err.message || 'Could not check dependencies.' });
        }
    }, [svcSelected, svcRows, defaultTargetBranchIds]);

    const submitServicesAdopt = async () => {
        if (!serviceAdopt) return;
        setServiceAdopt((prev) => prev && { ...prev, loading: true, error: '' });
        try {
            const items = serviceAdopt.rows.map((r) => ({ serviceId: String(r.id) }));
            const body = {
                items,
                ...(serviceAdopt.targetBranchIds?.length ? { branchIds: serviceAdopt.targetBranchIds } : {}),
            };
            const res = await adoptServicesToBranches(body);
            setBanner(summarizeAdoptResponse(res, 'services'));
            setSvcSelected(new Set());
            setServiceAdopt(null);
            const ctrl = new AbortController();
            loadServices(ctrl.signal);
        } catch (err) {
            setServiceAdopt((prev) => prev && { ...prev, loading: false, error: err.message || 'Failed to add services.' });
        }
    };

    // ─── Helpers ────────────────────────────────────────────────────────────
    const toggleId = (set, setSet, id) => {
        const next = new Set(set);
        const key = String(id);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSet(next);
    };

    const departmentOptions = useMemo(
        () => deptRows.map((d) => ({ id: String(d.id), name: d.name })),
        [deptRows],
    );

    const refreshActive = () => {
        const ctrl = new AbortController();
        if (activeTab === 'departments') loadDepartments(ctrl.signal);
        if (activeTab === 'categories')  loadCategories(ctrl.signal);
        if (activeTab === 'products')    loadProducts(ctrl.signal);
        if (activeTab === 'services')    loadServices(ctrl.signal);
    };

    // ─── Render helpers ─────────────────────────────────────────────────────
    const renderToolbar = (count, onAdd, addLabel, onClear) => (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                margin: '8px 0 16px',
                padding: '10px 14px',
                background: 'var(--color-bg-muted, #F8FAFC)',
                border: '1px solid var(--color-border-light, #E5E7EB)',
                borderRadius: 10,
                flexWrap: 'wrap',
            }}
        >
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                Selected: <span style={{ color: count > 0 ? '#2563EB' : 'inherit' }}>{count}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="mc-btn-ghost" disabled={count === 0} onClick={onClear}>
                    Clear
                </button>
                <button type="button" className="mc-btn-primary blue-btn" disabled={count === 0} onClick={onAdd}>
                    {addLabel}
                </button>
            </div>
        </div>
    );

    const renderEmpty = (Icon, message) => (
        <div className="mc-grid-empty">
            <Icon size={48} />
            <p>{message}</p>
        </div>
    );

    const renderLoading = (message) => (
        <div className="mc-grid-loading">
            <RefreshCw className="spin" size={32} />
            <p>{message}</p>
        </div>
    );

    const renderError = (msg) => (
        <div className="mc-grid-empty" style={{ color: '#B91C1C' }}>
            <AlertCircle size={48} />
            <p>{msg}</p>
            <button type="button" className="mc-btn-primary blue-btn" onClick={refreshActive} style={{ marginTop: 8 }}>
                <RefreshCw size={14} /> Retry
            </button>
        </div>
    );

    const renderDepartmentsTab = () => (
        <>
            {renderToolbar(
                deptSelected.size,
                openDeptCategoryModal,
                isAllBranches ? 'Add Selected to branches…' : `Add Selected to ${selectedBranchName || 'this branch'}`,
                () => setDeptSelected(new Set()),
            )}
            <div className="mc-product-grid">
                {deptError ? renderError(deptError)
                    : deptLoading ? renderLoading('Loading departments…')
                    : deptRows.length === 0 ? renderEmpty(Layers, 'No departments in the master catalog.')
                    : deptRows.map((d) => {
                        const id = String(d.id);
                        const inB = rowHasInBranch(d);
                        const inWs = rowHasInWorkshop(d);
                        const disabled = !isAllBranches ? inB : false;
                        const hint = isAllBranches && inWs
                            ? 'Already in some branches — adopt again to add to more.'
                            : !isAllBranches && !inB && inWs
                                ? 'In another branch — not in this one yet.'
                                : null;
                        return (
                            <CatalogCard
                                key={id}
                                row={d}
                                label="Department"
                                subtitle={d.description || 'Master Department'}
                                meta={typeof d.categoriesCount === 'number' ? [{ Icon: Tags, text: `${d.categoriesCount} categories` }] : []}
                                selected={deptSelected.has(id)}
                                disabled={disabled}
                                disabledLabel={!isAllBranches ? `In ${selectedBranchName || 'this branch'}` : 'In your workshop'}
                                hint={hint}
                                onToggle={() => toggleId(deptSelected, setDeptSelected, id)}
                            />
                        );
                    })}
            </div>
        </>
    );

    const renderCategoriesTab = () => (
        <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Filter size={14} />
                    <select
                        value={catFilter.departmentId}
                        onChange={(e) => setCatFilter((f) => ({ ...f, departmentId: e.target.value }))}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                    >
                        <option value="all">All departments</option>
                        {departmentOptions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                <select
                    value={catFilter.type}
                    onChange={(e) => setCatFilter((f) => ({ ...f, type: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                >
                    <option value="all">All types</option>
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                </select>
            </div>
            {renderToolbar(
                catSelected.size,
                openCategoryAdopt,
                isAllBranches ? 'Add Selected to branches…' : `Add Selected to ${selectedBranchName || 'this branch'}`,
                () => setCatSelected(new Set()),
            )}
            <div className="mc-product-grid">
                {catError ? renderError(catError)
                    : catLoading ? renderLoading('Loading categories…')
                    : catRows.length === 0 ? renderEmpty(Tags, 'No categories match these filters.')
                    : catRows.map((c) => {
                        const id = String(c.id);
                        const inB = rowHasInBranch(c);
                        const inWs = rowHasInWorkshop(c);
                        const disabled = !isAllBranches ? inB : false;
                        const deptName = c.departmentName || c.department?.name || departmentOptions.find((d) => d.id === String(c.departmentId))?.name;
                        const hint = isAllBranches && inWs
                            ? 'Already in some branches.'
                            : !isAllBranches && !inB && inWs
                                ? 'In another branch — not in this one yet.'
                                : null;
                        return (
                            <CatalogCard
                                key={id}
                                row={c}
                                label={(c.type || 'category').toString().toUpperCase()}
                                subtitle={deptName ? `${deptName} department` : 'Category'}
                                meta={[]}
                                selected={catSelected.has(id)}
                                disabled={disabled}
                                disabledLabel={!isAllBranches ? `In ${selectedBranchName || 'this branch'}` : 'In your workshop'}
                                hint={hint}
                                onToggle={() => toggleId(catSelected, setCatSelected, id)}
                            />
                        );
                    })}
            </div>
        </>
    );

    const renderListTab = ({
        rows, loading, error, selected, setSelected,
        filter, setFilter, qInput, setQInput,
        page, setPage, total,
        kind,
    }) => {
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const Icon = kind === 'product' ? Package : Wrench;
        const subtitleFn = (row) => {
            const dept = row.departmentName || row.department?.name;
            const cat = row.categoryName || row.category?.name;
            return [dept, cat].filter(Boolean).join(' · ') || 'Master Catalog';
        };
        const metaFn = (row) => {
            const list = [];
            if (row.sku) list.push({ Icon: Tags, text: row.sku });
            if (kind === 'product' && row.brandName) list.push({ Icon: Layers, text: row.brandName });
            const price = row.salePrice ?? row.sellingPrice ?? row.basePrice;
            if (price != null) list.push({ Icon: undefined, text: `SAR ${Number(price).toLocaleString()}` });
            return list;
        };
        return (
            <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
                        <input
                            type="text"
                            placeholder={`Search ${kind === 'product' ? 'products' : 'services'}…`}
                            value={qInput}
                            onChange={(e) => setQInput(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                        />
                    </div>
                    <select
                        value={filter.departmentId}
                        onChange={(e) => setFilter((f) => ({ ...f, departmentId: e.target.value, categoryId: 'all' }))}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                    >
                        <option value="all">All departments</option>
                        {departmentOptions.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
                {renderToolbar(
                    selected.size,
                    kind === 'product' ? openProductAdopt : openServiceAdopt,
                    isAllBranches ? 'Add Selected to branches…' : `Add Selected to ${selectedBranchName || 'this branch'}`,
                    () => setSelected(new Set()),
                )}
                <div className="mc-product-grid">
                    {error ? renderError(error)
                        : loading ? renderLoading(`Loading ${kind === 'product' ? 'products' : 'services'}…`)
                        : rows.length === 0 ? renderEmpty(Icon, `No ${kind === 'product' ? 'products' : 'services'} match these filters.`)
                        : rows.map((row) => {
                            const id = String(row.id);
                            const inB = rowHasInBranch(row);
                            const inWs = rowHasInWorkshop(row);
                            const disabled = !isAllBranches ? inB : false;
                            const hint = isAllBranches && inWs
                                ? 'Already in some branches.'
                                : !isAllBranches && !inB && inWs
                                    ? 'In another branch — not in this one yet.'
                                    : null;
                            return (
                                <CatalogCard
                                    key={id}
                                    row={row}
                                    label={kind === 'product' ? 'Product' : 'Service'}
                                    subtitle={subtitleFn(row)}
                                    meta={metaFn(row)}
                                    selected={selected.has(id)}
                                    disabled={disabled}
                                    disabledLabel={!isAllBranches ? `In ${selectedBranchName || 'this branch'}` : 'In your workshop'}
                                    hint={hint}
                                    onToggle={() => toggleId(selected, setSelected, id)}
                                />
                            );
                        })}
                </div>
                {!loading && rows.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                        <button type="button" className="mc-btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                            <ChevronLeft size={14} /> Previous
                        </button>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            Page {page} of {totalPages} · {total} total
                        </span>
                        <button type="button" className="mc-btn-ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                            Next <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="mc-container">
            <div className="mc-header">
                <div className="mc-title-group">
                    <h1>Master Catalog</h1>
                    <p>
                        Browse the corporate catalog and add items to your workshop branches. Adding a category auto-adopts its parent department to the same branches; adding a product or service also auto-adopts its parent department and category.
                    </p>
                    <div style={{
                        marginTop: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: isAllBranches ? '#EEF2FF' : '#ECFEFF',
                        color: isAllBranches ? '#4338CA' : '#0E7490',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                    }}>
                        <span>Adoption target:</span>
                        <span>
                            {isAllBranches
                                ? 'All branches (you can change per item before submit)'
                                : selectedBranchName || `Branch ${selectedBranchId}`}
                        </span>
                    </div>
                </div>
                <div className="mc-header-actions">
                    <button type="button" className="mc-btn-ghost" onClick={refreshActive}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            <div className="mc-tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`mc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.Icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <ResultBanner banner={banner} onClose={() => setBanner(null)} />

            <div key={activeTab}>
                {activeTab === 'departments' && renderDepartmentsTab()}
                {activeTab === 'categories' && renderCategoriesTab()}
                {activeTab === 'products' && renderListTab({
                    rows: prodRows, loading: prodLoading, error: prodError,
                    selected: prodSelected, setSelected: setProdSelected,
                    filter: prodFilter, setFilter: setProdFilter,
                    qInput: prodQInput, setQInput: setProdQInput,
                    page: prodPage, setPage: setProdPage, total: prodTotal,
                    kind: 'product',
                })}
                {activeTab === 'services' && renderListTab({
                    rows: svcRows, loading: svcLoading, error: svcError,
                    selected: svcSelected, setSelected: setSvcSelected,
                    filter: svcFilter, setFilter: setSvcFilter,
                    qInput: svcQInput, setQInput: setSvcQInput,
                    page: svcPage, setPage: setSvcPage, total: svcTotal,
                    kind: 'service',
                })}
            </div>

            <CategorySelectionModal
                state={deptCatModal}
                onChange={setDeptCatModal}
                onClose={() => setDeptCatModal(null)}
                onSubmit={submitDepartmentsAdopt}
                branches={branchList}
            />

            <CategoryAdoptModal
                state={categoryAdopt}
                onChange={setCategoryAdopt}
                onClose={() => setCategoryAdopt(null)}
                onSubmit={submitCategoriesAdopt}
                branches={branchList}
            />

            <ProductAdoptModal
                state={productAdopt}
                onChange={setProductAdopt}
                onClose={() => setProductAdopt(null)}
                onSubmit={submitProductsAdopt}
                branches={branchList}
            />

            <ServiceAdoptModal
                state={serviceAdopt}
                onChange={setServiceAdopt}
                onClose={() => setServiceAdopt(null)}
                onSubmit={submitServicesAdopt}
                branches={branchList}
            />
        </div>
    );
}

/* ─── Modals ────────────────────────────────────────────────────────────── */

/**
 * Reusable branch-target multi-select. Empty `value` means "all branches"
 * (BE resolves to every active branch in the workshop). Filling values means
 * "only these branches".
 */
function BranchTargetPicker({ branches, value, onChange }) {
    const allSelected = !value || value.length === 0;
    const setAll = () => onChange([]);
    const togglePick = (branchId) => {
        const id = String(branchId);
        if (allSelected) {
            // Switching from "all" to "specific" — start with the toggled one.
            onChange([id]);
            return;
        }
        const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
        onChange(next);
    };
    return (
        <div style={{ padding: 12, border: '1px solid var(--color-border-light, #E5E7EB)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.875rem' }}>
                Add to which branches?
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: allSelected ? 700 : 500 }}>
                <input type="radio" checked={allSelected} onChange={setAll} />
                All branches in this workshop
            </label>
            <div style={{ marginTop: 8 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: !allSelected ? 700 : 500 }}>
                    <input
                        type="radio"
                        checked={!allSelected}
                        onChange={() => onChange(branches.length > 0 ? [String(branches[0].id)] : [])}
                    />
                    Specific branches
                </label>
            </div>
            {!allSelected && (
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, paddingLeft: 24 }}>
                    {branches.length === 0 ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                            No branches found. The backend will resolve to all active branches.
                        </p>
                    ) : (
                        branches.map((b) => {
                            const id = String(b.id);
                            return (
                                <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={value.includes(id)} onChange={() => togglePick(id)} />
                                    {b.name}
                                </label>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function CategoryAdoptModal({ state, onChange, onClose, onSubmit, branches }) {
    return (
        <AnimatePresence>
            {state && (
                <Modal
                    title={`Add ${state.ids.length} categor${state.ids.length === 1 ? 'y' : 'ies'} to branches`}
                    onClose={state.loading ? () => {} : onClose}
                    contentClassName="modal-content mc-modal-redesign"
                    footer={
                        <div className="mc-modal-footer row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                                Cancel
                            </button>
                            <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                                {state.loading ? 'Adding…' : 'Add'}
                            </button>
                        </div>
                    }
                >
                    {state.error && (
                        <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                            {state.error}
                        </div>
                    )}
                    <p style={{ marginTop: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        Parent departments will be auto-adopted to the same branches if needed.
                    </p>
                    <BranchTargetPicker
                        branches={branches}
                        value={state.targetBranchIds}
                        onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                    />
                </Modal>
            )}
        </AnimatePresence>
    );
}

function CategorySelectionModal({ state, onChange, onClose, onSubmit, branches }) {
    return (
        <AnimatePresence>
            {state && (
                <Modal
                    title="Pick categories for each department"
                    onClose={onClose}
                    contentClassName="modal-content mc-modal-redesign"
                    footer={
                        <div className="mc-modal-footer row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                                Cancel
                            </button>
                            <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                                {state.loading ? 'Adding…' : 'Add to my workshop'}
                            </button>
                        </div>
                    }
                >
                    <p style={{ marginTop: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        For each department you selected, choose which categories should be added. You can pick all, some, or skip categories entirely. Each chosen branch gets the same selection.
                    </p>
                    {state.error && (
                        <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                            {state.error}
                        </div>
                    )}
                    <div style={{ marginBottom: 14 }}>
                        <BranchTargetPicker
                            branches={branches}
                            value={state.targetBranchIds}
                            onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {state.departments.map((d) => {
                            const sel = state.selections[String(d.id)] || { mode: 'all', pickedIds: new Set(), categories: [] };
                            const setMode = (mode) =>
                                onChange((prev) => prev && {
                                    ...prev,
                                    selections: {
                                        ...prev.selections,
                                        [String(d.id)]: { ...prev.selections[String(d.id)], mode },
                                    },
                                });
                            const togglePick = (catId) =>
                                onChange((prev) => {
                                    if (!prev) return prev;
                                    const cur = prev.selections[String(d.id)];
                                    const next = new Set(cur.pickedIds);
                                    const key = String(catId);
                                    if (next.has(key)) next.delete(key);
                                    else next.add(key);
                                    return {
                                        ...prev,
                                        selections: {
                                            ...prev.selections,
                                            [String(d.id)]: { ...cur, pickedIds: next, mode: 'pick' },
                                        },
                                    };
                                });
                            return (
                                <div key={String(d.id)} style={{ border: '1px solid var(--color-border-light, #E5E7EB)', borderRadius: 10, padding: 12 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{d.name}</div>
                                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
                                        {['all', 'pick', 'none'].map((m) => (
                                            <label key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                                <input
                                                    type="radio"
                                                    name={`dept-${d.id}-mode`}
                                                    checked={sel.mode === m}
                                                    onChange={() => setMode(m)}
                                                />
                                                {m === 'all' ? 'All categories' : m === 'pick' ? 'Pick categories' : 'No categories (department only)'}
                                            </label>
                                        ))}
                                    </div>
                                    {sel.mode === 'pick' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                                            {(sel.categories || []).length === 0 ? (
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>No categories available for this department.</p>
                                            ) : (
                                                sel.categories.map((c) => (
                                                    <label key={String(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={sel.pickedIds.has(String(c.id))}
                                                            onChange={() => togglePick(c.id)}
                                                        />
                                                        {c.name}
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
}

function MissingDependenciesList({ missing }) {
    const hasAny = (missing.departments?.length || 0) + (missing.categories?.length || 0) > 0;
    if (!hasAny) {
        return (
            <div style={{ padding: 10, background: '#ECFDF5', color: '#047857', borderRadius: 8, fontSize: '0.875rem' }}>
                Everything is already in your workshop. We just need to attach the selected items.
            </div>
        );
    }
    return (
        <div style={{ padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: '0.875rem' }}>
            <strong>We will also add the following so the items fit in your workshop:</strong>
            {missing.departments?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>Departments ({missing.departments.length})</div>
                    <div>{missing.departments.map((d) => d.name).join(', ')}</div>
                </div>
            )}
            {missing.categories?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>Categories ({missing.categories.length})</div>
                    <div>{missing.categories.map((c) => c.name).join(', ')}</div>
                </div>
            )}
        </div>
    );
}

function ProductAdoptModal({ state, onChange, onClose, onSubmit, branches }) {
    return (
        <AnimatePresence>
            {state && (
                <Modal
                    title={`Add ${state.rows.length} product${state.rows.length === 1 ? '' : 's'} to your workshop`}
                    onClose={state.loading ? () => {} : onClose}
                    contentClassName="modal-content mc-modal-redesign"
                    footer={
                        <div className="mc-modal-footer row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                                Cancel
                            </button>
                            <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                                {state.loading ? 'Adding…' : 'Add to my workshop'}
                            </button>
                        </div>
                    }
                >
                    {state.error && (
                        <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                            {state.error}
                        </div>
                    )}

                    {state.loading && (state.missing.departments.length === 0 && state.missing.categories.length === 0) ? (
                        <div className="mc-grid-loading"><RefreshCw className="spin" size={24} /> <p>Checking dependencies…</p></div>
                    ) : (
                        <>
                            <MissingDependenciesList missing={state.missing} />

                            <div style={{ marginTop: 14 }}>
                                <BranchTargetPicker
                                    branches={branches}
                                    value={state.targetBranchIds}
                                    onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                                />
                            </div>

                            <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--color-border-light, #E5E7EB)', borderRadius: 8 }}>
                                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.875rem' }}>
                                    Stock values (per product, per branch)
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                    Leave blank to default to 0. These values set <strong>openingQty</strong> when each branch adopts (catalog baseline; manual adjustments only change on-hand later).
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'end', padding: '8px 10px', background: 'var(--color-bg-muted, #F9FAFB)', borderRadius: 6, marginBottom: 10 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Apply to all rows</div>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Opening (adoption)"
                                        value={state.bulkOpeningQty ?? ''}
                                        onChange={(e) => onChange((prev) => prev && { ...prev, bulkOpeningQty: e.target.value })}
                                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', width: 110, fontSize: '0.8125rem' }}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Critical"
                                        value={state.bulkCriticalStockPoint ?? ''}
                                        onChange={(e) => onChange((prev) => prev && { ...prev, bulkCriticalStockPoint: e.target.value })}
                                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', width: 90, fontSize: '0.8125rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onChange((prev) => prev && {
                                            ...prev,
                                            items: prev.items.map((it) => ({
                                                ...it,
                                                openingQty: prev.bulkOpeningQty !== '' && prev.bulkOpeningQty != null ? prev.bulkOpeningQty : it.openingQty,
                                                criticalStockPoint: prev.bulkCriticalStockPoint !== '' && prev.bulkCriticalStockPoint != null ? prev.bulkCriticalStockPoint : it.criticalStockPoint,
                                            })),
                                        })}
                                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        Apply
                                    </button>
                                </div>

                                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--color-bg-muted, #F9FAFB)', textAlign: 'left' }}>
                                                <th style={{ padding: '8px 10px', fontWeight: 700 }}>Product</th>
                                                <th style={{ padding: '8px 10px', fontWeight: 700, width: 130 }}>Opening (adoption)</th>
                                                <th style={{ padding: '8px 10px', fontWeight: 700, width: 130 }}>Critical Stock</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(state.items || []).map((it, idx) => (
                                                <tr key={it.productId} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: '8px 10px' }}>{it.name}</td>
                                                    <td style={{ padding: '6px 10px' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={it.openingQty}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                onChange((prev) => prev && {
                                                                    ...prev,
                                                                    items: prev.items.map((row, i) => i === idx ? { ...row, openingQty: v } : row),
                                                                });
                                                            }}
                                                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', width: '100%', fontSize: '0.8125rem' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '6px 10px' }}>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={it.criticalStockPoint}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                onChange((prev) => prev && {
                                                                    ...prev,
                                                                    items: prev.items.map((row, i) => i === idx ? { ...row, criticalStockPoint: v } : row),
                                                                });
                                                            }}
                                                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', width: '100%', fontSize: '0.8125rem' }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </Modal>
            )}
        </AnimatePresence>
    );
}

function ServiceAdoptModal({ state, onChange, onClose, onSubmit, branches }) {
    return (
        <AnimatePresence>
            {state && (
                <Modal
                    title={`Add ${state.rows.length} service${state.rows.length === 1 ? '' : 's'} to your workshop`}
                    onClose={state.loading ? () => {} : onClose}
                    contentClassName="modal-content mc-modal-redesign"
                    footer={
                        <div className="mc-modal-footer row" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button type="button" className="mc-btn-ghost mc-btn-large" onClick={onClose} disabled={state.loading}>
                                Cancel
                            </button>
                            <button type="button" className="mc-btn-primary blue-btn mc-btn-large" onClick={onSubmit} disabled={state.loading}>
                                {state.loading ? 'Adding…' : 'Add to my workshop'}
                            </button>
                        </div>
                    }
                >
                    {state.error && (
                        <div style={{ padding: 10, background: '#FEE2E2', color: '#B91C1C', borderRadius: 8, fontSize: '0.875rem', marginBottom: 12 }}>
                            {state.error}
                        </div>
                    )}

                    {state.loading && (state.missing.departments.length === 0 && state.missing.categories.length === 0) ? (
                        <div className="mc-grid-loading"><RefreshCw className="spin" size={24} /> <p>Checking dependencies…</p></div>
                    ) : (
                        <>
                            <MissingDependenciesList missing={state.missing} />
                            <div style={{ marginTop: 14 }}>
                                <BranchTargetPicker
                                    branches={branches}
                                    value={state.targetBranchIds}
                                    onChange={(v) => onChange((prev) => prev && { ...prev, targetBranchIds: v })}
                                />
                            </div>
                            <div style={{ marginTop: 14, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Services being added: {state.rows.map((r) => r.name).slice(0, 5).join(', ')}{state.rows.length > 5 ? `, and ${state.rows.length - 5} more` : ''}.
                            </div>
                        </>
                    )}
                </Modal>
            )}
        </AnimatePresence>
    );
}
