import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, AlertCircle, Wallet, RefreshCw, History, X } from 'lucide-react';
import './Workshop.css';

import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import { MOCK_SUPPLIERS_CATALOG } from './constants';
import { getMyProducts, getBranchProducts, patchBranchProduct } from '../../services/workshopCatalogApi';
import {
    getWorkshopStaffBranchProducts,
    getWorkshopStaffProducts,
    unwrapWorkshopBranchListResponse,
} from '../../services/workshopStaffApi';
import { postBranchProductInventoryAdjustment, getBranchProductInventoryAdjustments } from '../../services/workshopInventoryApi';
import { useAuth } from '../../context/AuthContext';

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

function humanizeInventoryLogSource(source) {
    const s = String(source || 'manual').toLowerCase();
    if (s === 'supplier_purchase_invoice') return 'Supplier purchase (approved)';
    if (s === 'pos') return 'POS';
    if (s === 'purchase_receipt') return 'Purchase receipt';
    return s.replace(/_/g, ' ');
}

function humanizeInventoryLogReferenceType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'workshop_supplier_purchase_invoice') return 'Workshop purchase invoice';
    return t.replace(/_/g, ' ');
}

function normalizeAdjustmentEntry(raw) {
    if (!raw) return null;
    const at = raw.at ?? raw.createdAt ?? raw.created_at ?? raw.occurredAt;
    if (!at) return null;
    const movementType = String(raw.movementType ?? raw.movement_type ?? '').toLowerCase();
    let source = String(raw.source ?? 'manual').toLowerCase();
    if (
        (source === 'manual' || source === '') &&
        (movementType === 'workshop_supplier_purchase_received' || movementType.includes('supplier_purchase'))
    ) {
        source = 'supplier_purchase_invoice';
    }
    const id = String(
        raw.id ?? raw.logId ?? raw.movementId ?? raw.movement_id ?? `${at}-${raw.previousQty}-${raw.newQty}`,
    );
    const previousQty =
        raw.previousQty != null
            ? Number(raw.previousQty)
            : raw.previous_qty != null
              ? Number(raw.previous_qty)
              : null;
    const newQty =
        raw.newQty != null ? Number(raw.newQty) : raw.new_qty != null ? Number(raw.new_qty) : null;
    let delta = 0;
    if (raw.delta != null) delta = Number(raw.delta);
    else if (raw.qty != null) delta = Number(raw.qty);
    else if (previousQty != null && newQty != null) delta = newQty - previousQty;
    const referenceRaw = raw.reference ?? raw.reference_json;
    const reference =
        referenceRaw && typeof referenceRaw === 'object' && !Array.isArray(referenceRaw)
            ? {
                type: referenceRaw.type ? String(referenceRaw.type) : '',
                id: referenceRaw.id != null ? String(referenceRaw.id) : '',
            }
            : null;
    const reason =
        raw.reason ||
        (source === 'supplier_purchase_invoice' ? 'Supplier purchase (approved)' : null) ||
        '—';
    return {
        id,
        at: String(at),
        previousQty,
        newQty,
        delta,
        reason,
        note: raw.note ?? raw.notes ?? null,
        adjustedBy: raw.adjustedBy ?? raw.adjusted_by ?? raw.user ?? null,
        source,
        reference,
        movementType: movementType || undefined,
    };
}

function extractAdjustmentEntries(res) {
    const list =
        (Array.isArray(res?.data?.entries) && res.data.entries)
        || (Array.isArray(res?.entries) && res.entries)
        || (Array.isArray(res?.data?.movements) && res.data.movements)
        || (Array.isArray(res?.movements) && res.movements)
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

function buildInventorySearchText(row) {
    const fields = [
        row?._searchText,
        row?.name,
        row?.productName,
        row?.product_name,
        row?.itemName,
        row?.item_name,
        row?.sku,
        row?.code,
        row?.barcode,
        row?.partNumber,
        row?.part_number,
        row?.brand,
        row?.departmentName,
        row?.department_name,
        row?.categoryName,
        row?.category_name,
        row?.id,
    ];
    return fields
        .map(normalizeInventorySearchValue)
        .filter(Boolean)
        .join(' ');
}

function normalizeInventorySearchValue(value) {
    if (value == null) return '';
    let s = String(value);
    try {
        if (typeof s.normalize === 'function') {
            s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        }
    } catch {
        /* lone surrogates / engines without normalize — fall back to raw string */
    }
    return s.toLowerCase().trim();
}

function buildRawInventorySearchText(...sources) {
    const fields = [];
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        fields.push(
            source.name,
            source.productName,
            source.product_name,
            source.itemName,
            source.item_name,
            source.title,
            source.sku,
            source.code,
            source.barcode,
            source.partNumber,
            source.part_number,
            source.brand,
            source.departmentName,
            source.department_name,
            source.department?.name,
            source.categoryName,
            source.category_name,
            source.category?.name,
            source.id,
            source.productId,
            source.product_id,
        );
    }
    return fields.map(normalizeInventorySearchValue).filter(Boolean).join(' ');
}

function matchesProductNameSearch(row, query) {
    const q = normalizeInventorySearchValue(query);
    if (!q) return true;
    /** Prefer full row index (name, SKU, dept, brand, `_searchText`) so search works across API shapes and Vercel builds. */
    const hay = normalizeInventorySearchValue(buildInventorySearchText(row));
    if (!hay) return false;
    return q
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => hay.includes(term));
}

/**
 * Same merge as Dept & Products `buildBranchProductRow`: branch link fields win over nested
 * `product` snapshot so on-hand qty does not fall back to catalog/stale `currentQty` on the master.
 */
function mergeBranchProductRowForInventory(row) {
    const master = row?.product && typeof row.product === 'object' ? row.product : {};
    return {
        ...row,
        ...master,
        id: master.id ?? row?.productId ?? row?.product_id ?? row?.id,
        openingQty: row?.openingQty ?? master?.openingQty,
        opening_qty: row?.opening_qty ?? master?.opening_qty,
        currentQty: row?.currentQty ?? master?.currentQty,
        current_qty: row?.current_qty ?? master?.current_qty,
        qtyOnHand: row?.qtyOnHand ?? master?.qtyOnHand,
        qty_on_hand: row?.qty_on_hand ?? master?.qty_on_hand,
        stockQty: row?.stockQty ?? master?.stockQty,
        stock_qty: row?.stock_qty ?? master?.stock_qty,
        criticalStockPoint: row?.criticalStockPoint ?? master?.criticalStockPoint,
        critical_stock_point: row?.critical_stock_point ?? master?.critical_stock_point,
        salePriceOverride: row?.salePriceOverride ?? master?.salePriceOverride,
        salePriceBeforeVat: row?.salePriceBeforeVat ?? master?.salePriceBeforeVat,
        sellingPriceBeforeVat: row?.sellingPriceBeforeVat ?? master?.sellingPriceBeforeVat,
        salePrice: row?.salePrice ?? master?.salePrice,
        sellingPrice: row?.sellingPrice ?? master?.sellingPrice,
        purchasePrice: row?.purchasePriceOverride ?? master?.purchasePrice ?? row?.purchasePrice,
    };
}

/**
 * Map a catalog row to a flat inventory row (products only).
 * Merges link row + nested `product` like Dept & Products branch lists.
 */
function mapApiRowToInventory(row) {
    const merged = mergeBranchProductRowForInventory(row);
    const nested = row?.product && typeof row.product === 'object' ? row.product : null;
    const master = nested || row;
    const sourceRowId = row?.id ?? row?.branchProductId ?? row?.branch_product_id ?? row?.workshopProductId ?? row?.workshop_product_id;
    const branchId = row?.branchId ?? row?.branch_id ?? row?.branch?.id ?? merged.branchId ?? merged.branch_id ?? merged.branch?.id ?? '';
    const branchName = row?.branchName ?? row?.branch_name ?? row?.branch?.name ?? merged.branchName ?? merged.branch_name ?? merged.branch?.name ?? '';
    const id =
        merged.id ??
        master?.id ??
        row?.id ??
        row?.productId ??
        row?.product_id ??
        row?.serviceId ??
        row?.service_id;
    if (id == null || String(id).trim() === '') return null;

    const openingQty = pickNumber(merged.openingQty, merged.opening_qty);
    const onHand = firstFiniteNumber([
        merged.currentQty,
        merged.current_qty,
        merged.qtyOnHand,
        merged.qty_on_hand,
        merged.stockQty,
        merged.stock_qty,
        merged.inventory?.currentQty,
        merged.inventory?.current_qty,
        merged.inventory?.qtyOnHand,
        merged.inventory?.qty_on_hand,
        merged.branchInventory?.qtyOnHand,
        merged.branchInventory?.qty_on_hand,
    ]);
    const qty = onHand !== null ? onHand : openingQty;

    const critical_level = pickNumber(
        merged.criticalStockPoint,
        merged.critical_stock_point,
    );
    const basePrice = pickNumber(
        merged.salePriceOverride,
        merged.sellingPriceOverride,
        merged.salePriceBeforeVat,
        merged.sellingPriceBeforeVat,
        merged.salePrice,
        merged.sellingPrice,
        merged.sale_price,
        merged.purchasePrice,
        merged.purchase_price,
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
        branchId: branchId != null && String(branchId).trim() !== '' ? String(branchId) : null,
        branchName: branchName != null && String(branchName).trim() !== '' ? String(branchName) : null,
        _rowKey: [
            id,
            branchId,
            sourceRowId,
            row?.sku ?? master?.sku ?? '',
        ].map((v) => (v == null ? '' : String(v))).join(':'),
        _searchText: buildRawInventorySearchText(row, master, merged, nested),
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

function workshopIdFromSession(workshop) {
    if (!workshop || typeof workshop !== 'object') return undefined;
    const id = workshop.id ?? workshop._id ?? workshop.workshopId;
    return id != null && String(id).trim() !== '' ? String(id) : undefined;
}

export default function WorkshopInventory({
    selectedBranchId = 'all',
    branches = [],
    selectedProducts = [],
    onTabChange,
    updateProductStatus,
}) {
    const { workshop } = useAuth();
    const workshopIdQuery = useMemo(() => workshopIdFromSession(workshop), [workshop]);

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
                    workshopId: workshopIdQuery,
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
    }, [logProduct, isAllBranches, selectedBranchId, workshopIdQuery]);

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

    /**
     * Live-refresh when a workshop approval (or QR receive) just adjusted stock
     * for any branch. We always reload the open list — backend filters by the
     * sidebar's selected branch already, so cross-branch noise is fine.
     */
    useEffect(() => {
        const handler = () => {
            loadInventory();
        };
        window.addEventListener('workshop-inventory-updated', handler);
        return () => window.removeEventListener('workshop-inventory-updated', handler);
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

    const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
    const [criticalItem, setCriticalItem] = useState(null);
    const [criticalInput, setCriticalInput] = useState('');
    const [criticalSubmitError, setCriticalSubmitError] = useState('');
    const [criticalSaving, setCriticalSaving] = useState(false);

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

    const closeCriticalModal = () => {
        setIsCriticalModalOpen(false);
        setCriticalItem(null);
        setCriticalInput('');
        setCriticalSubmitError('');
        setCriticalSaving(false);
    };

    const handleOpenCritical = (item) => {
        setCriticalItem(item);
        setCriticalInput(item.critical_level != null && item.critical_level !== '' ? String(item.critical_level) : '0');
        setCriticalSubmitError('');
        setIsCriticalModalOpen(true);
    };

    const handleCriticalSubmit = async () => {
        if (!criticalItem || isAllBranches) return;
        const parsed = Number.parseFloat(String(criticalInput).trim().replace(/,/g, ''));
        if (!Number.isFinite(parsed) || parsed < 0) {
            setCriticalSubmitError('Enter a number ≥ 0.');
            return;
        }
        const nextCrit = Math.round(parsed * 1000) / 1000;
        const prevCrit = Number(criticalItem.critical_level) || 0;
        if (nextCrit === prevCrit) {
            closeCriticalModal();
            return;
        }
        const pid = String(criticalItem.id);
        const bid = String(selectedBranchId);
        setCriticalSaving(true);
        setCriticalSubmitError('');
        try {
            const res = await patchBranchProduct(bid, pid, { criticalStockPoint: nextCrit }, { workshopId: workshopIdQuery });
            if (res && typeof res === 'object' && res.success === false) {
                throw new Error(res.message || 'Update failed.');
            }
            const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
            const serverCrit = pickNumber(
                payload.criticalStockPoint,
                payload.critical_stock_point,
                nextCrit,
            );
            setProductRows((prev) =>
                prev.map((p) => (p.id === pid ? { ...p, critical_level: serverCrit } : p)),
            );
            closeCriticalModal();
        } catch (err) {
            setCriticalSubmitError(err.message || 'Could not update critical level.');
        } finally {
            setCriticalSaving(false);
        }
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
                const res = await postBranchProductInventoryAdjustment(
                    String(selectedBranchId),
                    pid,
                    {
                        previousQty: prevQty,
                        newQty: qtyNum,
                        reason: reasonTrim,
                    },
                    { workshopId: workshopIdQuery },
                );
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
        if (!normalizeInventorySearchValue(searchQuery)) return productRows;
        return productRows.filter((p) => matchesProductNameSearch(p, searchQuery));
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
                            <div className="mc-header-filter" style={{ width: '100%', maxWidth: 'none' }}>
                                <div
                                    className="mc-filter-select-wrapper"
                                    style={{ position: 'relative', width: '100%', minWidth: 'min(900px, 100%)', maxWidth: '100%' }}
                                >
                                    <Search className="mc-filter-icon" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search by product name or SKU..."
                                        className="mc-filter-select"
                                        style={{ paddingLeft: '40px', paddingRight: searchQuery ? '70px' : '14px', width: '100%', minHeight: 46, fontSize: '0.95rem' }}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            aria-label="Clear search"
                                            title="Clear search"
                                            style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: '#F3F4F6',
                                                color: '#374151',
                                                borderRadius: 8,
                                                width: 26,
                                                height: 26,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Showing <strong>{filteredProducts.length}</strong> of{' '}
                                <strong>{productRows.length}</strong> products
                                {searchQuery ? ` for "${searchQuery}"` : ''}.
                            </p>
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
                                            SKU
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
                                            title="Low-stock threshold for this branch (branch_products.criticalStockPoint). When current stock ≤ this value (and &gt; 0), the row is treated as low stock."
                                        >
                                            Critical
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
                                        <ShimmerTableBodyRows rows={8} columns={10} />
                                    ) : filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                                                    key={`inv:${idx}:${item._rowKey || item.id || ''}:${searchQuery}`}
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
                                                    <td style={{ padding: '16px 24px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                                        {item.sku || '—'}
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
                                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                        {Number(item.critical_level) > 0 ? item.critical_level : '—'}
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
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
                                                            <button
                                                                type="button"
                                                                className="mc-btn-ghost"
                                                                style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                                                                title={
                                                                    isAllBranches
                                                                        ? 'Select a single branch to edit critical stock level.'
                                                                        : 'Set low-stock threshold for this branch'
                                                                }
                                                                disabled={isAllBranches}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenCritical(item);
                                                                }}
                                                            >
                                                                Critical level
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
                    <Modal onClose={() => setLogProduct(null)} title="Inventory stock timeline" width="780px">
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
                                            No timeline entries yet for this branch/product.
                                        </p>
                                    );
                                }
                                const showByCol = merged.some((e) => e.adjustedBy?.name || e.adjustedBy?.id);
                                const showRefCol = merged.some(
                                    (e) => e.reference?.id || (e.source && e.source !== 'manual'),
                                );
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
                                                    {showRefCol ? (
                                                        <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Source / Ref</th>
                                                    ) : null}
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
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{e.previousQty == null ? '—' : e.previousQty}</td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{e.newQty == null ? '—' : e.newQty}</td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: e.delta >= 0 ? '#047857' : '#B91C1C' }}>
                                                            {e.delta > 0 ? `+${e.delta}` : e.delta}
                                                        </td>
                                                        <td style={{ padding: '12px 14px' }}>{e.reason}</td>
                                                        {showRefCol ? (
                                                            <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>
                                                                <span>{humanizeInventoryLogSource(e.source)}</span>
                                                                {e.reference?.id ? (
                                                                    <span>
                                                                        {' '}
                                                                        · {humanizeInventoryLogReferenceType(e.reference.type)} #
                                                                        {e.reference.id}
                                                                    </span>
                                                                ) : null}
                                                            </td>
                                                        ) : null}
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

            <AnimatePresence>
                {isCriticalModalOpen && (
                    <Modal onClose={closeCriticalModal} title="Critical stock level" width="500px">
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Product</p>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{criticalItem?.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    Current stock: <strong>{criticalItem?.qty ?? 0}</strong>
                                    {criticalItem?.openingQty != null ? (
                                        <> · Opening (adoption): <strong>{criticalItem.openingQty}</strong></>
                                    ) : null}
                                </p>
                            </div>

                            {isAllBranches ? (
                                <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#92400E', background: '#FFFBEB', padding: 12, borderRadius: 8 }}>
                                    Select a <strong>single branch</strong> in the workshop header to update critical levels on the server.
                                </p>
                            ) : (
                                <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                    When <strong>current stock</strong> is at or below this number (and the value is greater than 0), the product is flagged as <strong>low stock</strong>. Use <strong>0</strong> to turn off the threshold for this branch.
                                </p>
                            )}

                            <div className="mc-form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>
                                    CRITICAL STOCK POINT (THIS BRANCH)
                                </label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    min={0}
                                    step="any"
                                    placeholder="0"
                                    value={criticalInput}
                                    onChange={(e) => setCriticalInput(e.target.value)}
                                    disabled={criticalSaving || isAllBranches}
                                />
                            </div>

                            {criticalSubmitError && (
                                <p style={{ margin: '0 0 16px', padding: '12px', background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: '0.8125rem' }}>
                                    {criticalSubmitError}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={closeCriticalModal} disabled={criticalSaving}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-primary"
                                    style={{ flex: 2, padding: '12px' }}
                                    onClick={handleCriticalSubmit}
                                    disabled={
                                        criticalSaving ||
                                        isAllBranches ||
                                        (() => {
                                            const parsed = Number.parseFloat(String(criticalInput).trim().replace(/,/g, ''));
                                            if (!Number.isFinite(parsed) || parsed < 0) return true;
                                            const nextCrit = Math.round(parsed * 1000) / 1000;
                                            return nextCrit === (Number(criticalItem?.critical_level) || 0);
                                        })()
                                    }
                                >
                                    {criticalSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
