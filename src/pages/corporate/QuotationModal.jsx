/**
 * Corporate “New Price Quotation” — branch-free master catalog search + price-quotations submit.
 * Stack: React (Vite); API base URL = `BASE_URL` in `src/services/api.js` (Bearer via apiFetch).
 */
import { useState, useEffect } from 'react';
import { Tag, Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';

const SEARCH_MIN_LEN = 2;
const SEARCH_DEBOUNCE_MS = 320;
const SEARCH_LIMIT = 30;

/** Saudi VAT 15%: amount ex VAT × 1.15 = amount inc VAT. */
const QUOTE_VAT_MULTIPLIER = 1.15;

const CORPORATE_PRICE_QUOTATIONS_CHANGED = 'corporate-price-quotations-changed';

function roundMoney2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x * 100) / 100;
}

function pickCatalogItemType(item) {
    const t = String(item?.itemType ?? item?.type ?? '').toLowerCase();
    if (t === 'service') return 'service';
    if (t === 'product') return 'product';
    if (item?.serviceId != null || item?.service_id != null) return 'service';
    return 'product';
}

function catalogRowId(raw, itemType) {
    if (String(raw?.id ?? '').trim() !== '') return String(raw.id).trim();
    if (itemType === 'service') return String(raw.serviceId ?? raw.service_id ?? '').trim();
    return String(raw.productId ?? raw.product_id ?? '').trim();
}

/** GET /corporate/master-catalog/search — prefers `{ success, items: [...] }`. */
function normalizeMasterCatalogSearchResponse(data) {
    if (!data) return [];
    const root = data.data != null && typeof data.data === 'object' ? data.data : data;
    if (Array.isArray(root.items)) {
        return root.items.map((row) => toPickerRow(row));
    }
    if (Array.isArray(root)) {
        return root.map((row) => toPickerRow(row));
    }
    const products = root.products || root.product || [];
    const services = root.services || root.service || [];
    const out = [];
    (Array.isArray(products) ? products : []).forEach((p) => out.push(toPickerRow({ ...p, itemType: 'product' })));
    (Array.isArray(services) ? services : []).forEach((s) => out.push(toPickerRow({ ...s, itemType: 'service' })));
    return out;
}

function toPickerRow(raw) {
    const itemType = pickCatalogItemType(raw);
    const id = catalogRowId(raw, itemType);
    const name = raw.name ?? raw.title ?? '—';
    const salePrice = parseFloat(raw.salePrice ?? raw.sale_price ?? raw.price ?? 0) || 0;
    const minC = raw.minPriceCorporate ?? raw.min_price_corporate;
    const maxC = raw.maxPriceCorporate ?? raw.max_price_corporate;
    const minNum = minC != null && minC !== '' ? Number(minC) : null;
    const maxNum = maxC != null && maxC !== '' ? Number(maxC) : null;
    return {
        itemType,
        id,
        name,
        sku: raw.sku ?? '',
        unit: raw.unit ?? raw.uom ?? raw.unitOfMeasurement ?? '',
        departmentName: raw.departmentName ?? raw.department_name ?? '',
        categoryName: raw.categoryName ?? raw.category_name ?? '',
        salePrice,
        salePriceExcludingVat: raw.salePriceExcludingVat ?? raw.sale_price_excluding_vat,
        minPriceCorporate: Number.isFinite(minNum) ? minNum : null,
        maxPriceCorporate: Number.isFinite(maxNum) ? maxNum : null,
        _raw: raw,
    };
}

function lineKey(line) {
    return `${line.itemType}:${line.itemType === 'product' ? line.productId : line.serviceId}`;
}

function formatSubmitError(err) {
    const m = err?.message;
    if (typeof m === 'string' && m.trim()) return m.trim();
    if (Array.isArray(m)) return m.map(String).join(' ');
    return 'Failed to submit quotation';
}

export default function QuotationModal({ walletBalance, onClose, onSave }) {
    const [lines, setLines] = useState([]);
    const [search, setSearch] = useState('');
    const [searchType, setSearchType] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const q = search.trim();
        if (q.length < SEARCH_MIN_LEN) {
            setSearchResults([]);
            setLoadingSearch(false);
            return undefined;
        }
        const ac = new AbortController();
        const t = window.setTimeout(async () => {
            setLoadingSearch(true);
            try {
                const qs = new URLSearchParams();
                qs.set('query', q);
                qs.set('limit', String(Math.min(100, SEARCH_LIMIT)));
                if (searchType === 'product' || searchType === 'service') qs.set('type', searchType);
                const data = await apiFetch(`/corporate/master-catalog/search?${qs.toString()}`, { signal: ac.signal });
                if (!ac.signal.aborted) {
                    setSearchResults(normalizeMasterCatalogSearchResponse(data));
                }
            } catch (e) {
                if (e?.name === 'AbortError') return;
                if (!ac.signal.aborted) setSearchResults([]);
            } finally {
                if (!ac.signal.aborted) setLoadingSearch(false);
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(t);
            ac.abort();
        };
    }, [search, searchType]);

    const linesKeys = new Set(lines.map(lineKey));
    const filteredResults = searchResults.filter((row) => row.id && !linesKeys.has(`${row.itemType}:${row.id}`));

    const addLine = (row) => {
        const line = {
            itemType: row.itemType,
            productId: row.itemType === 'product' ? row.id : undefined,
            serviceId: row.itemType === 'service' ? row.id : undefined,
            name: row.name,
            unit: row.unit,
            salePrice: row.salePrice,
            minPriceCorporate: row.minPriceCorporate,
            maxPriceCorporate: row.maxPriceCorporate,
            qty: 1,
            quotationPrice: row.salePrice,
        };
        setLines((prev) => [...prev, line]);
        setSearch('');
        setShowDropdown(false);
    };

    const updateLine = (idx, key, val) =>
        setLines((prev) => prev.map((l, i) => (i !== idx ? l : { ...l, [key]: val })));

    const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

    const totalNormal = lines.reduce((s, l) => s + (parseFloat(l.salePrice) || 0) * (parseFloat(l.qty) || 1), 0);
    const totalQuoted = lines.reduce((s, l) => s + (parseFloat(l.quotationPrice) || 0) * (parseFloat(l.qty) || 1), 0);
    const totalSavings = totalNormal - totalQuoted;
    const savingsPct = totalNormal > 0 ? ((totalSavings / totalNormal) * 100).toFixed(1) : 0;

    const handleSubmit = async () => {
        if (lines.length === 0) return;
        setSubmitting(true);
        setError('');
        try {
            const items = lines.map((l) => {
                const quoteExVat = roundMoney2(parseFloat(l.quotationPrice) || 0);
                const quoteIncVat = roundMoney2(quoteExVat * QUOTE_VAT_MULTIPLIER);
                const base = {
                    itemType: l.itemType,
                    qty: parseFloat(l.qty) || 1,
                    quotationPrice: quoteExVat,
                    priceExcludingVat: quoteExVat,
                    priceIncludingVat: quoteIncVat,
                };
                if (l.itemType === 'service') return { ...base, serviceId: String(l.serviceId) };
                return { ...base, productId: String(l.productId) };
            });
            const body = { items };
            const n = notes.trim();
            if (n) body.notes = n;
            const data = await apiFetch('/corporate/price-quotations/submit', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(CORPORATE_PRICE_QUOTATIONS_CHANGED));
            }
            onSave?.(data);
            onClose();
        } catch (err) {
            setError(formatSubmitError(err));
        } finally {
            setSubmitting(false);
        }
    };

    const showResultsPanel = showDropdown && (loadingSearch || search.trim().length >= SEARCH_MIN_LEN);

    return (
        <Modal
            title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={20} /> New Price Quotation
                </span>
            }
            onClose={onClose}
            width="520px"
            footer={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                    {error && (
                        <p style={{ color: '#DC2626', fontSize: '0.8125rem', margin: 0, textAlign: 'right' }}>{error}</p>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" className="btn-portal-outline" onClick={onClose} disabled={submitting}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-portal"
                            style={{ background: '#7C3AED', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                            disabled={lines.length === 0 || submitting}
                            onClick={() => void handleSubmit()}
                        >
                            {submitting && <Loader2 size={14} className="spin" />}
                            {submitting ? 'Submitting…' : 'Submit Quotation for Approval'}
                        </button>
                    </div>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, alignItems: 'end' }}>
                    <div />
                    <div className="ws-field" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Type (optional)</label>
                        <select
                            className="form-input-field"
                            value={searchType}
                            onChange={(e) => {
                                setSearchType(e.target.value);
                                setShowDropdown(true);
                            }}
                            style={{ padding: '8px 10px', fontSize: '0.875rem' }}
                        >
                            <option value="">All</option>
                            <option value="product">product</option>
                            <option value="service">service</option>
                        </select>
                    </div>
                </div>
                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                        Search master catalog
                        {loadingSearch && (
                            <Loader2 size={12} className="spin" style={{ marginLeft: 8, color: 'var(--color-text-muted)' }} />
                        )}
                    </label>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                        placeholder={`Type at least ${SEARCH_MIN_LEN} characters…`}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 9,
                            border: '1px solid var(--color-border)',
                            boxSizing: 'border-box',
                        }}
                    />
                    {showResultsPanel && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: 4,
                                maxHeight: 220,
                                overflowY: 'auto',
                                border: '1px solid var(--color-border)',
                                borderRadius: 10,
                                background: '#fff',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                zIndex: 10,
                            }}
                        >
                            {loadingSearch ? (
                                <p style={{ padding: '10px 12px', fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                    Searching…
                                </p>
                            ) : filteredResults.length === 0 ? (
                                <p style={{ padding: '10px 12px', fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                    {search.trim().length < SEARCH_MIN_LEN
                                        ? `Enter at least ${SEARCH_MIN_LEN} characters`
                                        : 'No matches — try different keywords'}
                                </p>
                            ) : (
                                filteredResults.map((row) => (
                                    <button
                                        key={`${row.itemType}-${row.id}`}
                                        type="button"
                                        onClick={() => addLine(row)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 12px',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderBottom: '1px solid var(--color-border-light)',
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                                            <span
                                                style={{
                                                    fontSize: '0.65rem',
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    background: row.itemType === 'service' ? '#EDE9FE' : '#DBEAFE',
                                                    color: row.itemType === 'service' ? '#7C3AED' : '#1D4ED8',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {row.itemType}
                                            </span>
                                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                                <span>{row.name}</span>
                                                {row.sku ? (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                        SKU {row.sku}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--color-text-muted)',
                                                flexShrink: 0,
                                                marginLeft: 8,
                                            }}
                                        >
                                            SAR {Number(row.salePrice).toFixed(2)}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="ws-field" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600 }}>Notes (optional)</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Optional message for approvers"
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 9,
                            border: '1px solid var(--color-border)',
                            boxSizing: 'border-box',
                            fontFamily: 'inherit',
                            fontSize: '0.875rem',
                        }}
                    />
                </div>

                {lines.length > 0 ? (
                    <>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 52px 88px 88px 28px',
                                gap: 8,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            <span>Item</span>
                            <span style={{ textAlign: 'center' }}>Qty</span>
                            <span style={{ textAlign: 'center' }}>Sale total</span>
                            <span style={{ textAlign: 'center' }}>Quote (ex VAT)</span>
                            <span />
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {lines.map((line, idx) => {
                                const qtyNum = parseFloat(line.qty) || 1;
                                const quoteEx = roundMoney2(parseFloat(line.quotationPrice) || 0);
                                const quoteInc = roundMoney2(quoteEx * QUOTE_VAT_MULTIPLIER);
                                const minH = line.minPriceCorporate;
                                const maxH = line.maxPriceCorporate;
                                const hint =
                                    minH != null &&
                                    maxH != null &&
                                    Number.isFinite(Number(minH)) &&
                                    Number.isFinite(Number(maxH))
                                        ? `Corporate range: SAR ${Number(minH).toFixed(2)} – ${Number(maxH).toFixed(2)}`
                                        : null;
                                return (
                                    <div
                                        key={lineKey(line)}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 52px 88px 88px 28px',
                                            gap: 8,
                                            alignItems: 'start',
                                            padding: 10,
                                            background: 'var(--color-bg-muted)',
                                            borderRadius: 10,
                                        }}
                                    >
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8125rem' }}>{line.name}</p>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                                {line.unit} · sale SAR {Number(line.salePrice).toFixed(2)}
                                            </p>
                                            {hint && (
                                                <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: '#7C3AED' }}>{hint}</p>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            value={line.qty}
                                            min="1"
                                            onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: 6,
                                                border: '1px solid var(--color-border)',
                                                fontSize: '0.75rem',
                                                textAlign: 'center',
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--color-text-muted)',
                                                textAlign: 'center',
                                                paddingTop: 6,
                                            }}
                                        >
                                            SAR {(Number(line.salePrice) * qtyNum).toFixed(2)}
                                        </span>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <input
                                                type="number"
                                                value={line.quotationPrice}
                                                placeholder="0"
                                                onChange={(e) => updateLine(idx, 'quotationPrice', e.target.value)}
                                                style={{
                                                    padding: '6px 8px',
                                                    borderRadius: 6,
                                                    border: '1px solid var(--color-border)',
                                                    fontSize: '0.75rem',
                                                    textAlign: 'center',
                                                    width: '100%',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
                                                Inc VAT SAR {quoteInc.toFixed(2)}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#DC2626',
                                                fontSize: 18,
                                                lineHeight: 1,
                                                padding: 0,
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {totalQuoted > 0 && (
                            <div style={{ padding: 14, borderRadius: 12, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                                <p style={{ fontWeight: 700, color: '#047857', margin: '0 0 8px 0', fontSize: '0.875rem' }}>
                                    Savings summary
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#065F46' }}>
                                    <span>Sale total:</span>
                                    <span>SAR {totalNormal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#065F46' }}>
                                    <span>Your quote total:</span>
                                    <span>SAR {totalQuoted.toFixed(2)}</span>
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        color: '#047857',
                                        marginTop: 6,
                                    }}
                                >
                                    <span>You save:</span>
                                    <span>
                                        SAR {totalSavings.toFixed(2)} ({savingsPct}%)
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: 32,
                            border: '2px dashed var(--color-border)',
                            borderRadius: 12,
                            color: 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                        }}
                    >
                        Search the master catalog above and add lines
                    </div>
                )}

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 12,
                        background: '#FAF5FF',
                        borderRadius: 12,
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-dark)',
                    }}
                >
                    Wallet balance: SAR {walletBalance?.toLocaleString?.() ?? walletBalance}
                </div>
            </div>
        </Modal>
    );
}
