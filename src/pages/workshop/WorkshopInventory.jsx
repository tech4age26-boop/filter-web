import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, AlertCircle, Wallet, RefreshCw, History } from 'lucide-react';
import './Workshop.css';

import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MOCK_SUPPLIERS_CATALOG } from './constants';
import { getMyProducts, getBranchProducts } from '../../services/workshopCatalogApi';
import {
    getWorkshopStaffBranchProducts,
    getWorkshopStaffProducts,
    unwrapWorkshopBranchListResponse,
} from '../../services/workshopStaffApi';
import { postBranchProductInventoryAdjustment, getBranchProductInventoryAdjustments } from '../../services/workshopInventoryApi';

/** Match WorkshopDashboard / WorkshopDepartments response shapes. */
function extractProducts(res) {
    return unwrapWorkshopBranchListResponse(res, 'products');
}

function pickNumber(...vals) {
    for (const v of vals) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

/** First numeric value, or `null` if none set (so we can fall back to opening qty). */
function firstFiniteNumber(values) {
    for (const v of values) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

function normalizeAdjustmentEntry(raw) {
    if (!raw) return null;
    const at = raw.at ?? raw.createdAt;
    if (!at) return null;
    const id = String(raw.id ?? raw.logId ?? `${at}-${raw.previousQty}-${raw.newQty}`);
    const previousQty = Number(raw.previousQty) || 0;
    const newQty = Number(raw.newQty) || 0;
    const delta = raw.delta != null ? Number(raw.delta) : newQty - previousQty;
    return {
        id,
        at: String(at),
        previousQty,
        newQty,
        delta,
        reason: raw.reason || '—',
        adjustedBy: raw.adjustedBy || null,
    };
}

function extractAdjustmentEntries(res) {
    const list =
        (Array.isArray(res?.data?.entries) && res.data.entries)
        || (Array.isArray(res?.entries) && res.entries)
        || [];
    return list.map(normalizeAdjustmentEntry).filter(Boolean);
}

function mergeLogEntries(localList, serverList) {
    const byId = new Map();
    for (const e of serverList || []) byId.set(e.id, e);
    for (const e of localList || []) {
        if (!byId.has(e.id)) byId.set(e.id, e);
    }
    return [...byId.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Same low-stock rule as the dashboard & Dept & Products. */
function isLowStockRow(p) {
    const crit = Number(p.critical_level) || 0;
    const qty = Number(p.qty) || 0;
    return crit > 0 && qty <= crit;
}

function pickDisplayName(master, row) {
    const candidates = [
        master?.name,
        row?.name,
        row?.productName,
        row?.product_name,
        row?.serviceName,
        row?.itemName,
        row?.item_name,
        master?.title,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    const sku = master?.sku ?? row?.sku;
    if (sku != null && String(sku).trim() !== '') return String(sku).trim();
    return 'Unnamed';
}

/**
 * Map a catalog row to a flat inventory row (products only).
 * Merges link row + nested `product` like Dept & Products branch lists.
 */
function mapApiRowToInventory(row) {
    const nested = row?.product && typeof row.product === 'object' ? row.product : null;
    const master = nested || row;
    const id =
        master?.id ??
        row?.id ??
        row?.productId ??
        row?.product_id ??
        row?.serviceId ??
        row?.service_id;
    if (id == null || String(id).trim() === '') return null;

    const openingQty = pickNumber(
        row?.openingQty,
        master?.openingQty,
        row?.opening_qty,
        master?.opening_qty,
    );
    const onHand = firstFiniteNumber([
        row?.currentQty,
        row?.current_qty,
        master?.currentQty,
        row?.qtyOnHand,
        row?.qty_on_hand,
        master?.qtyOnHand,
        master?.qty_on_hand,
    ]);
    const qty = onHand !== null ? onHand : openingQty;

    const critical_level = pickNumber(
        row?.criticalStockPoint,
        master?.criticalStockPoint,
        row?.critical_stock_point,
        master?.critical_stock_point,
    );
    const basePrice = pickNumber(
        row?.salePriceOverride,
        row?.sellingPriceOverride,
        row?.salePriceBeforeVat,
        row?.sellingPriceBeforeVat,
        master?.salePriceBeforeVat,
        master?.sellingPriceBeforeVat,
        master?.salePrice,
        master?.sellingPrice,
        row?.sale_price,
        master?.sale_price,
        row?.purchasePrice,
        master?.purchasePrice,
        row?.purchase_price,
        master?.purchase_price,
    );

    return {
        id: String(id),
        name: pickDisplayName(master, row),
        brand: master?.brand || '',
        sku: master?.sku || row?.sku || '',
        departmentName:
            master?.departmentName ||
            master?.department_name ||
            master?.department?.name ||
            row?.departmentName ||
            row?.department_name ||
            row?.department?.name ||
            '—',
        categoryName:
            master?.categoryName ||
            master?.category_name ||
            master?.category?.name ||
            row?.categoryName ||
            '—',
        basePrice,
        openingQty,
        qty,
        critical_level,
    };
}

function applyStatusesFromParent(rows, selectedProducts) {
    const sel = new Map((selectedProducts || []).map((s) => [String(s.id), s]));
    return rows.map((r) => {
        const match = sel.get(String(r.id));
        if (match?.status) return { ...r, status: match.status };
        const { status, ...rest } = r;
        return rest;
    });
}

function stockStatus(item) {
    if (item.status === 'Requested') return { label: 'Requested', tone: 'blue' };
    if ((Number(item.qty) || 0) <= 0) return { label: 'Out of Stock', tone: 'red' };
    if (isLowStockRow(item)) return { label: 'Low Stock', tone: 'amber' };
    return { label: 'In Stock', tone: 'green' };
}

const ADJUST_LOG_STORAGE_PREFIX = 'pos-filter:workshop-inv-adjustments:v1:';

function adjustmentLogStorageKey(selectedBranchId) {
    const key = !selectedBranchId || selectedBranchId === 'all' ? 'all' : String(selectedBranchId);
    return `${ADJUST_LOG_STORAGE_PREFIX}${key}`;
}

/** @returns {Record<string, Array<{ id: string, at: string, previousQty: number, newQty: number, delta: number, reason: string }>>} */
function loadAdjustmentLogsFromStorage(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const p = JSON.parse(raw);
        return p && typeof p === 'object' ? p : {};
    } catch {
        return {};
    }
}

function saveAdjustmentLogsToStorage(storageKey, map) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
        /* ignore quota / private mode */
    }
}

export default function WorkshopInventory({
    selectedBranchId = 'all',
    branches = [],
    selectedProducts = [],
    onTabChange,
    updateProductStatus,
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const [productRows, setProductRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const selectedProductsRef = useRef(selectedProducts);
    useEffect(() => {
        selectedProductsRef.current = selectedProducts;
    }, [selectedProducts]);

    const isAllBranches = !selectedBranchId || selectedBranchId === 'all';
    const selectedBranchName = useMemo(() => {
        if (isAllBranches) return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, isAllBranches, selectedBranchId]);

    const logStorageKey = useMemo(() => adjustmentLogStorageKey(selectedBranchId), [selectedBranchId]);
    const [adjustmentLogs, setAdjustmentLogs] = useState({});
    const [logProduct, setLogProduct] = useState(null);
    const [logLoading, setLogLoading] = useState(false);
    const [logFetchError, setLogFetchError] = useState('');
    const [fetchedLogEntries, setFetchedLogEntries] = useState(null);

    useEffect(() => {
        if (!logProduct) {
            setFetchedLogEntries(null);
            setLogFetchError('');
            setLogLoading(false);
            return;
        }
        if (isAllBranches) {
            setFetchedLogEntries(null);
            setLogFetchError('');
            setLogLoading(false);
            return;
        }
        const ctrl = new AbortController();
        setLogLoading(true);
        setLogFetchError('');
        (async () => {
            try {
                const res = await getBranchProductInventoryAdjustments(String(selectedBranchId), String(logProduct.id), {
                    signal: ctrl.signal,
                });
                if (!ctrl.signal.aborted) {
                    setFetchedLogEntries(extractAdjustmentEntries(res));
                }
            } catch (e) {
                if (e.name === 'AbortError') return;
                if (!ctrl.signal.aborted) {
                    setFetchedLogEntries([]);
                    setLogFetchError(e.message || 'Could not load adjustment history.');
                }
            } finally {
                if (!ctrl.signal.aborted) setLogLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [logProduct, isAllBranches, selectedBranchId]);

    useEffect(() => {
        setAdjustmentLogs(loadAdjustmentLogsFromStorage(logStorageKey));
    }, [logStorageKey]);

    const loadInventory = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            let products = [];

            if (isAll) {
                try {
                    const pRes = await getWorkshopStaffProducts({ allBranches: true });
                    products = extractProducts(pRes);
                } catch {
                    products = [];
                }
                if (products.length === 0) {
                    try {
                        products = extractProducts(await getMyProducts());
                    } catch {
                        products = [];
                    }
                }
            } else {
                const bid = String(selectedBranchId);
                try {
                    const prodRes = await getWorkshopStaffBranchProducts(bid);
                    products = extractProducts(prodRes);
                } catch {
                    products = [];
                }
                if (products.length === 0) {
                    try {
                        products = extractProducts(await getBranchProducts(bid));
                    } catch {
                        products = [];
                    }
                }
                // Do not fall back to getMyProducts({ branchId }) here: some backends return a
                // workshop-wide union that ignores branchId, which wrongly fills empty branches (e.g. Riyadh with Dubai SKUs).
            }

            const mapped = products.map(mapApiRowToInventory).filter(Boolean);
            setProductRows(applyStatusesFromParent(mapped, selectedProductsRef.current));
        } catch (error) {
            setLoadError(error.message || 'Failed to load inventory.');
            setProductRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        setProductRows((prev) => (prev.length === 0 ? prev : applyStatusesFromParent(prev, selectedProducts)));
    }, [selectedProducts]);

    useEffect(() => {
        loadInventory();
    }, [loadInventory]);

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestItem, setRequestItem] = useState(null);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [requestQty, setRequestQty] = useState(0);

    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [adjustItem, setAdjustItem] = useState(null);
    const [newQty, setNewQty] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustSubmitError, setAdjustSubmitError] = useState('');
    const [adjustSaving, setAdjustSaving] = useState(false);

    const stats = useMemo(() => {
        const totalProducts = productRows.length;
        let lowStock = 0;
        let inventoryValue = 0;
        for (const p of productRows) {
            if (isLowStockRow(p)) lowStock += 1;
            inventoryValue += (Number(p.qty) || 0) * (Number(p.basePrice) || 0);
        }
        return [
            {
                label: 'Total products',
                value: totalProducts,
                sub: `SKUs in scope · ${selectedBranchName}`,
                icon: Package,
                color: '#3B82F6',
            },
            {
                label: 'Low stock (SKUs)',
                value: lowStock,
                sub: `At or below critical level · ${selectedBranchName}`,
                icon: AlertCircle,
                color: '#EF4444',
            },
            {
                label: 'Total inventory value',
                value: `SAR ${Math.round(inventoryValue).toLocaleString()}`,
                sub: `Current stock × sale price · ${selectedBranchName}`,
                icon: Wallet,
                color: '#10B981',
            },
        ];
    }, [productRows, selectedBranchName]);

    const handleOpenRequest = (item) => {
        if (updateProductStatus) {
            updateProductStatus(item.id, 'Requested');
        }
        setProductRows((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'Requested' } : p)),
        );

        if (onTabChange) {
            onTabChange('purchases', { autoOpenModal: true, selectedItem: item });
        }
    };

    const handleRequestSubmit = () => {
        setIsRequestModalOpen(false);
        setRequestItem(null);
        setSelectedSupplier('');
        setRequestQty(0);
    };

    const closeAdjustModal = () => {
        setIsAdjustModalOpen(false);
        setAdjustItem(null);
        setAdjustSubmitError('');
        setAdjustSaving(false);
    };

    const handleOpenAdjust = (item) => {
        setAdjustItem(item);
        setNewQty(item.qty != null ? String(item.qty) : '0');
        setAdjustReason('');
        setAdjustSubmitError('');
        setIsAdjustModalOpen(true);
    };

    const handleAdjustSubmit = async () => {
        if (!adjustItem || !adjustReason.trim()) return;
        const prevQty = Number(adjustItem.qty) || 0;
        const parsed = Number.parseFloat(String(newQty).trim().replace(/,/g, ''));
        if (!Number.isFinite(parsed) || parsed < 0) return;
        const qtyNum = Math.round(parsed);
        if (qtyNum === prevQty) return;

        const pid = String(adjustItem.id);
        const reasonTrim = adjustReason.trim();

        if (!isAllBranches) {
            setAdjustSaving(true);
            setAdjustSubmitError('');
            try {
                const res = await postBranchProductInventoryAdjustment(String(selectedBranchId), pid, {
                    previousQty: prevQty,
                    newQty: qtyNum,
                    reason: reasonTrim,
                });
                if (!res?.success) {
                    throw new Error(res?.message || 'Adjustment failed.');
                }
                const d = res.data || {};
                const serverEntry = {
                    id: String(d.logId || `${d.createdAt || new Date().toISOString()}-adj`),
                    at: d.createdAt || new Date().toISOString(),
                    previousQty: d.previousQty != null ? Number(d.previousQty) : prevQty,
                    newQty: d.newQty != null ? Number(d.newQty) : qtyNum,
                    delta: d.delta != null ? Number(d.delta) : qtyNum - prevQty,
                    reason: d.reason || reasonTrim,
                    adjustedBy: d.adjustedBy || null,
                };

                setAdjustmentLogs((prevMap) => {
                    const list = [...(prevMap[pid] || []), serverEntry];
                    const next = { ...prevMap, [pid]: list };
                    saveAdjustmentLogsToStorage(logStorageKey, next);
                    return next;
                });

                setProductRows((prev) =>
                    prev.map((p) =>
                        p.id === adjustItem.id
                            ? { ...p, qty: serverEntry.newQty, status: undefined }
                            : p,
                    ),
                );
                closeAdjustModal();
            } catch (err) {
                setAdjustSubmitError(err.message || 'Adjustment failed. If stock changed elsewhere, refresh and try again.');
            } finally {
                setAdjustSaving(false);
            }
            return;
        }

        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            at: new Date().toISOString(),
            previousQty: prevQty,
            newQty: qtyNum,
            delta: qtyNum - prevQty,
            reason: reasonTrim,
        };

        setAdjustmentLogs((prevMap) => {
            const list = [...(prevMap[pid] || []), entry];
            const next = { ...prevMap, [pid]: list };
            saveAdjustmentLogsToStorage(logStorageKey, next);
            return next;
        });

        setProductRows((prev) =>
            prev.map((p) =>
                p.id === adjustItem.id ? { ...p, qty: qtyNum, status: undefined } : p,
            ),
        );
        closeAdjustModal();
    };

    const filteredProducts = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return productRows;
        return productRows.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.brand && p.brand.toLowerCase().includes(q)) ||
                (p.sku && p.sku.toLowerCase().includes(q)),
        );
    }, [productRows, searchQuery]);

    const tableEmptyMessage = () => {
        if (isLoading) return 'Loading inventory…';
        if (loadError) return loadError;
        if (productRows.length === 0) return 'No products in this scope yet — adopt items under Dept & Products or Catalog.';
        return 'No products match your search.';
    };

    return (
        <div className="mc-catalog-container">
            <div className="mc-selection-header">
                <div className="mc-header-left">
                    <h3>Inventory Management</h3>
                    <p>
                        Track and manage <strong>product</strong> stock for <strong>{selectedBranchName}</strong>
                        {isAllBranches ? ' (workshop-wide product list)' : ''}.
                    </p>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            type="button"
                            className="mc-btn-ghost"
                            style={{ padding: '8px 14px', fontSize: '0.8125rem', border: '1px solid var(--color-border)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            onClick={() => loadInventory()}
                            disabled={isLoading}
                        >
                            <RefreshCw size={16} style={{ opacity: isLoading ? 0.5 : 1, animation: isLoading ? 'ws-spin 0.8s linear infinite' : undefined }} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="mc-stats-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '20px',
                    marginBottom: '24px',
                }}
            >
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className="mc-stat-card"
                        style={{
                            background: '#fff',
                            padding: '24px',
                            borderRadius: '24px',
                            border: '1px solid var(--color-border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        }}
                    >
                        <div
                            style={{
                                width: '54px',
                                height: '54px',
                                borderRadius: '14px',
                                background: `${stat.color}15`,
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <stat.icon size={26} />
                        </div>
                        <div>
                            <p
                                style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    margin: '0 0 4px',
                                }}
                            >
                                {stat.label}
                            </p>
                            <h4
                                style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 800,
                                    color: 'var(--color-text-dark)',
                                    margin: 0,
                                }}
                            >
                                {stat.value}
                            </h4>
                            {stat.sub && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>{stat.sub}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mc-selection-layout">
                <div className="mc-selection-main" style={{ gridColumn: 'span 2' }}>
                    <div
                        className="mc-inventory-card"
                        style={{
                            background: '#fff',
                            borderRadius: '24px',
                            border: '1px solid var(--color-border)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '24px',
                                borderBottom: '1px solid var(--color-border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                            }}
                        >
                            <div className="mc-header-filter" style={{ width: '100%', maxWidth: '400px' }}>
                                <div className="mc-filter-select-wrapper">
                                    <Search className="mc-filter-icon" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        className="mc-filter-select"
                                        style={{ paddingLeft: '40px', width: '100%' }}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Click a <strong>row</strong> for adjustment history.
                                {isAllBranches
                                    ? ' With all branches selected, history is only what this browser saved (no server log).'
                                    : ' History is loaded from the server for this branch.'}
                            </p>
                        </div>

                        <div className="mc-table-container" style={{ overflowX: 'auto' }}>
                            <table className="mc-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid var(--color-border-light)' }}>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Name
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Department
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Category
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                            title="branch_products.opening_qty — set at catalog adoption; unchanged by manual stock adjustments"
                                        >
                                            Opening (adoption)
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                            title="branch_inventory.qty_on_hand when present; otherwise same as adoption opening until first stock movement"
                                        >
                                            Current stock
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Price
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Status
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'right',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                <p style={{ fontWeight: 600 }}>Loading inventory…</p>
                                            </td>
                                        </tr>
                                    ) : filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                <div style={{ marginBottom: '16px', opacity: 0.3 }}>
                                                    <Package size={48} style={{ margin: '0 auto' }} />
                                                </div>
                                                <p style={{ fontWeight: 600 }}>{tableEmptyMessage()}</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((item, idx) => {
                                            const st = stockStatus(item);
                                            const low = isLowStockRow(item);
                                            const qtyBg =
                                                item.qty <= 0
                                                    ? '#FEF2F2'
                                                    : low
                                                      ? '#FFFBEB'
                                                      : '#ECFDF5';
                                            const qtyColor =
                                                item.qty <= 0 ? '#EF4444' : low ? '#D97706' : '#047857';

                                            const statusBg =
                                                st.tone === 'blue'
                                                    ? '#EFF6FF'
                                                    : st.tone === 'green'
                                                      ? '#ECFDF5'
                                                      : st.tone === 'amber'
                                                        ? '#FFFBEB'
                                                        : '#FEF2F2';
                                            const statusColor =
                                                st.tone === 'blue'
                                                    ? '#3B82F6'
                                                    : st.tone === 'green'
                                                      ? '#047857'
                                                      : st.tone === 'amber'
                                                        ? '#D97706'
                                                        : '#EF4444';

                                            return (
                                                <tr
                                                    key={item.id || idx}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => setLogProduct(item)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setLogProduct(item);
                                                        }
                                                    }}
                                                    style={{
                                                        borderBottom: '1px solid var(--color-border-light)',
                                                        cursor: 'pointer',
                                                    }}
                                                    className="ws-inv-row-clickable"
                                                >
                                                    <td style={{ padding: '16px 24px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <span
                                                                style={{
                                                                    textAlign: 'left',
                                                                    fontWeight: 700,
                                                                    color: 'var(--color-primary)',
                                                                    fontSize: '0.9375rem',
                                                                }}
                                                            >
                                                                {item.name}
                                                            </span>
                                                            {item.brand && (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.brand}</span>
                                                            )}
                                                            {(adjustmentLogs[item.id]?.length || 0) > 0 && (
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                    <History size={12} aria-hidden />
                                                                    {adjustmentLogs[item.id].length} manual adjustment{adjustmentLogs[item.id].length !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.departmentName}</td>
                                                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.categoryName}</td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                        {item.openingQty != null ? item.openingQty : '—'}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <span
                                                            style={{
                                                                padding: '4px 10px',
                                                                background: qtyBg,
                                                                color: qtyColor,
                                                                borderRadius: '6px',
                                                                fontSize: '0.8125rem',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {item.qty}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>
                                                        SAR {item.basePrice?.toLocaleString() || '0'}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <span
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '20px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                background: statusBg,
                                                                color: statusColor,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                            }}
                                                        >
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                            <button
                                                                type="button"
                                                                className="mc-btn-primary"
                                                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenRequest(item);
                                                                }}
                                                            >
                                                                Request from Supplier
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="mc-btn-ghost"
                                                                style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenAdjust(item);
                                                                }}
                                                            >
                                                                Manual Adjust
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isRequestModalOpen && (
                    <Modal onClose={() => setIsRequestModalOpen(false)} title="Request Stock from Supplier" width="500px">
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Product Details</p>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{requestItem?.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>SKU: {requestItem?.sku || 'N/A'}</p>
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>CHOOSE SUPPLIER</label>
                                <select className="mc-filter-select" style={{ width: '100%', height: '45px' }} value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                                    <option value="">Select a supplier...</option>
                                    {MOCK_SUPPLIERS_CATALOG.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>QUANTITY TO REQUEST</label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    placeholder="Enter quantity..."
                                    value={requestQty}
                                    onChange={(e) => setRequestQty(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => setIsRequestModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="mc-btn-primary" style={{ flex: 2, padding: '12px' }} onClick={handleRequestSubmit} disabled={!selectedSupplier || requestQty <= 0}>
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {logProduct && (
                    <Modal onClose={() => setLogProduct(null)} title="Manual adjustment log" width="720px">
                        <div style={{ padding: '0 24px 24px' }}>
                            <div style={{ marginBottom: 20, padding: '14px 16px', background: '#F9FAFB', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 6px' }}>Product</p>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{logProduct.name}</h4>
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    SKU: {logProduct.sku || '—'} · Opening (adoption): <strong>{logProduct.openingQty ?? '—'}</strong> · Current stock:{' '}
                                    <strong>{productRows.find((p) => String(p.id) === String(logProduct.id))?.qty ?? logProduct.qty}</strong>
                                    {isAllBranches ? ' · All branches: offline log only' : ` · ${selectedBranchName}`}
                                </p>
                            </div>
                            {logFetchError && (
                                <p style={{ margin: '0 0 12px', padding: '10px 12px', background: '#FEF3C7', borderRadius: 8, color: '#92400E', fontSize: '0.8125rem' }}>
                                    {logFetchError} Showing any entries cached in this browser.
                                </p>
                            )}
                            {(() => {
                                const localList = adjustmentLogs[logProduct.id] || [];
                                let merged;
                                if (isAllBranches) {
                                    merged = [...localList].sort((a, b) => String(b.at).localeCompare(String(a.at)));
                                } else if (logLoading) {
                                    return (
                                        <p style={{ margin: 0, padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                            Loading history…
                                        </p>
                                    );
                                } else {
                                    merged = mergeLogEntries(localList, fetchedLogEntries || []);
                                }

                                if (!merged.length) {
                                    return (
                                        <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                            No manual adjustments yet. Use <strong>Manual Adjust</strong> with a branch selected to record changes on the server.
                                        </p>
                                    );
                                }
                                const showByCol = merged.some((e) => e.adjustedBy?.name || e.adjustedBy?.id);
                                return (
                                    <div style={{ overflowX: 'auto', maxHeight: 'min(420px, 55vh)', overflowY: 'auto', border: '1px solid var(--color-border-light)', borderRadius: 12 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>When</th>
                                                    <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>From</th>
                                                    <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>To</th>
                                                    <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Δ</th>
                                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Reason</th>
                                                    {showByCol ? (
                                                        <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>By</th>
                                                    ) : null}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {merged.map((e) => (
                                                    <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>
                                                            {new Date(e.at).toLocaleString()}
                                                        </td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{e.previousQty}</td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{e.newQty}</td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: e.delta >= 0 ? '#047857' : '#B91C1C' }}>
                                                            {e.delta > 0 ? `+${e.delta}` : e.delta}
                                                        </td>
                                                        <td style={{ padding: '12px 14px' }}>{e.reason}</td>
                                                        {showByCol ? (
                                                            <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>
                                                                {e.adjustedBy?.name || e.adjustedBy?.id || '—'}
                                                            </td>
                                                        ) : null}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isAdjustModalOpen && (
                    <Modal onClose={closeAdjustModal} title="Manual Inventory Adjustment" width="500px">
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Product Details</p>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{adjustItem?.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    Current stock: <strong>{adjustItem?.qty ?? 0}</strong>
                                    {adjustItem?.openingQty != null ? (
                                        <> · Opening (adoption): <strong>{adjustItem.openingQty}</strong></>
                                    ) : null}
                                </p>
                            </div>

                            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                Sets <strong>current stock</strong> (effective on-hand per branch; not adoption opening). Enter a new total — higher to increase, lower to decrease. Must be ≥ 0.
                                {isAllBranches ? ' Select a single branch to save on the server.' : ' The server checks <strong>previousQty</strong> matches current stock — refresh if it changed elsewhere.'}
                            </p>

                            <div className="mc-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>NEW QUANTITY</label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    placeholder="Enter new stock level..."
                                    min={0}
                                    step={1}
                                    value={newQty}
                                    onChange={(e) => setNewQty(e.target.value)}
                                    disabled={adjustSaving}
                                />
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>REASON FOR ADJUSTMENT</label>
                                <select
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    value={adjustReason}
                                    onChange={(e) => setAdjustReason(e.target.value)}
                                    disabled={adjustSaving}
                                >
                                    <option value="">Select a reason...</option>
                                    <option value="Damaged Stock">Damaged Stock</option>
                                    <option value="Inventory Count Correction">Inventory Count Correction</option>
                                    <option value="Expired Item">Expired Item</option>
                                    <option value="Returns/Exchanges">Returns/Exchanges</option>
                                    <option value="Other">Other (Manual Entry)</option>
                                </select>
                            </div>

                            {adjustSubmitError && (
                                <p style={{ margin: '0 0 16px', padding: '12px', background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: '0.8125rem' }}>
                                    {adjustSubmitError}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={closeAdjustModal} disabled={adjustSaving}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-primary"
                                    style={{ flex: 2, padding: '12px', background: '#4B5563', borderColor: '#4B5563' }}
                                    onClick={handleAdjustSubmit}
                                    disabled={(() => {
                                        if (adjustSaving || !adjustItem || !adjustReason.trim()) return true;
                                        const parsed = Number.parseFloat(String(newQty).trim().replace(/,/g, ''));
                                        if (!Number.isFinite(parsed) || parsed < 0) return true;
                                        return Math.round(parsed) === (Number(adjustItem.qty) || 0);
                                    })()}
                                >
                                    {adjustSaving ? 'Saving…' : 'Apply Adjustment'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
