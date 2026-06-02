import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import {
    createStorageInvoice,
    postStorageInvoice,
} from '../../../services/storageFacilityApi';
import ProductLineCombobox from './ProductLineCombobox';
import SearchableEntityCombobox from './SearchableEntityCombobox';
import StorageFacilityVatTotals, { fmtSar } from './StorageFacilityVatTotals';
import { computeStorageTotals, unitAmountForApi } from './storageFacilityTotals';

function newLine() {
    return {
        key: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storageProductId: '',
        search: '',
        qty: '1',
        unitPrice: '',
        description: '',
    };
}

export default function StorageFacilityNewInvoiceModal({
    brandId,
    brandName,
    products,
    customers,
    whSearch,
    onLoadCatalog,
    onClose,
    onSaved,
}) {
    const [invoiceType, setInvoiceType] = useState('storage_fee');
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [reference, setReference] = useState('');
    const [storageCustomerId, setStorageCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [billingAddress, setBillingAddress] = useState('');
    const [description, setDescription] = useState('');
    const [supplierProductId, setSupplierProductId] = useState('');
    const [lines, setLines] = useState(() => [newLine(), newLine()]);
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const [saving, setSaving] = useState(false);

    const productRefs = useRef([]);
    const qtyRefs = useRef([]);
    const priceRefs = useRef([]);
    const descRefs = useRef([]);

    const customerOptions = useMemo(
        () =>
            (customers || []).map((c) => ({
                id: c.id,
                label: c.name,
                subtitle: [c.code, c.mobile].filter(Boolean).join(' · ') || undefined,
            })),
        [customers],
    );

    const calculatedDueDate = useMemo(() => {
        const issue = new Date(issueDate);
        if (Number.isNaN(issue.getTime())) return '—';
        if (dueDateType === 'Custom') return customDueDate || '—';
        if (dueDateType === 'EOM') {
            const eom = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
            return eom.toISOString().slice(0, 10);
        }
        const due = new Date(issue);
        due.setDate(issue.getDate() + parseInt(String(netDays || 0), 10));
        return due.toISOString().slice(0, 10);
    }, [issueDate, dueDateType, netDays, customDueDate]);

    const showProductLines =
        invoiceType === 'stock_sale' ||
        invoiceType === 'withdrawal_to_owner' ||
        invoiceType === 'storage_fee';

    const updateLine = useCallback((key, patch) => {
        setLines((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    }, []);

    const addLine = () => {
        setLines((prev) => [...prev, newLine()]);
    };

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((ln) => ln.key !== key)));
    };

    const validLines = useMemo(() => {
        if (invoiceType === 'storage_fee' && !lines.some((l) => l.storageProductId)) {
            return [];
        }
        return lines.filter(
            (ln) =>
                ln.storageProductId &&
                ln.qty !== '' &&
                Number(ln.qty) > 0 &&
                (invoiceType === 'storage_fee' || (ln.unitPrice !== '' && Number(ln.unitPrice) >= 0)),
        );
    }, [lines, invoiceType]);

    const linesForTotals = useMemo(
        () =>
            lines
                .filter((ln) => ln.qty !== '' && ln.unitPrice !== '')
                .map((ln) => ({ qty: ln.qty, unitAmount: ln.unitPrice })),
        [lines],
    );

    const totals = useMemo(
        () => computeStorageTotals(linesForTotals, amountsTaxInclusive),
        [linesForTotals, amountsTaxInclusive],
    );

    const unitPriceColLabel = amountsTaxInclusive
        ? 'Unit price (incl. VAT)'
        : 'Unit price (excl. VAT)';

    const buildPayloadLines = () => {
        if (validLines.length > 0) {
            return validLines.map((ln) => {
                const p = products.find((x) => String(x.id) === String(ln.storageProductId));
                const unitEx =
                    unitAmountForApi(ln.unitPrice, amountsTaxInclusive) ?? 0;
                const row = {
                    description: ln.description.trim() || p?.name || 'Line',
                    qty: Number(ln.qty),
                    unitPrice: unitEx,
                    storageProductId: ln.storageProductId,
                };
                if (invoiceType === 'withdrawal_to_owner' && supplierProductId) {
                    row.supplierProductId = supplierProductId;
                }
                return row;
            });
        }
        const feeUnit = lines[0]?.unitPrice
            ? unitAmountForApi(lines[0].unitPrice, amountsTaxInclusive) ?? 0
            : 0;
        return [
            {
                description: description.trim() || 'Storage fee',
                qty: 1,
                unitPrice: feeUnit,
            },
        ];
    };

    const submit = async (e, postAfter) => {
        e.preventDefault();
        if (invoiceType === 'stock_sale' && !storageCustomerId) {
            window.alert('Select a customer for stock sale.');
            return;
        }
        if (invoiceType === 'stock_sale' && validLines.length === 0) {
            window.alert('Add at least one product line with quantity and price.');
            return;
        }
        setSaving(true);
        try {
            const noteParts = [
                reference.trim() ? `Ref: ${reference.trim()}` : null,
                billingAddress.trim() ? `Bill to: ${billingAddress.trim()}` : null,
                description.trim() || null,
            ].filter(Boolean);
            const res = await createStorageInvoice(brandId, {
                invoiceType,
                issueDate,
                dueDate: calculatedDueDate !== '—' ? calculatedDueDate : undefined,
                storageCustomerId: storageCustomerId || undefined,
                notes: noteParts.length ? noteParts.join('\n') : undefined,
                lines: buildPayloadLines(),
            });
            if (postAfter) {
                await postStorageInvoice(brandId, res.invoice.id);
            }
            onSaved?.();
            onClose?.();
        } catch (ex) {
            window.alert(ex?.message || 'Failed to create invoice');
        } finally {
            setSaving(false);
        }
    };

    const lineGridCols = '36px minmax(140px, 1.5fr) 72px 96px minmax(80px, 1fr) 36px';

    return (
        <Modal
            title="New invoice"
            size="large"
            onClose={() => !saving && onClose?.()}
            contentClassName="sf-doc-modal"
            disableClose={saving}
        >
            <form className="pi-form-container sf-doc-modal-shell" onSubmit={(e) => submit(e, false)}>
                <div className="sf-doc-modal-top">
                <p className="sf-doc-modal-lead">
                    {brandName ? `${brandName} — ` : ''}
                    Create storage fee, stock sale, or withdrawal invoice.
                </p>

                <div className="pi-header-grid sf-doc-header-row">
                    <div className="pi-field sf-doc-type-row">
                        <label htmlFor="sf-inv-type">Invoice type</label>
                        <select
                            id="sf-inv-type"
                            value={invoiceType}
                            onChange={(e) => setInvoiceType(e.target.value)}
                        >
                            <option value="storage_fee">Storage fee</option>
                            <option value="stock_sale">Stock sale</option>
                            <option value="withdrawal_to_owner">Withdrawal to your warehouse</option>
                        </select>
                    </div>
                    <div className="pi-field">
                        <label>Issue date</label>
                        <div className="pi-input-with-icon">
                            <input
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                            />
                            <Calendar size={16} />
                        </div>
                    </div>
                    <div className="pi-field">
                        <label>Due date</label>
                        <div
                            className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}
                        >
                            <select
                                value={dueDateType}
                                onChange={(e) => setDueDateType(e.target.value)}
                            >
                                <option value="Net">Net</option>
                                <option value="Custom">Custom</option>
                                <option value="EOM">EOM</option>
                            </select>
                            {dueDateType === 'Net' ? (
                                <div className="pi-days-input">
                                    <input
                                        type="number"
                                        min="0"
                                        value={netDays}
                                        onChange={(e) => setNetDays(e.target.value)}
                                    />
                                    <span>days</span>
                                </div>
                            ) : null}
                            {dueDateType === 'Custom' ? (
                                <div className="pi-date-input-small">
                                    <input
                                        type="date"
                                        value={customDueDate}
                                        onChange={(e) => setCustomDueDate(e.target.value)}
                                    />
                                </div>
                            ) : null}
                        </div>
                        <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                    </div>
                    <div className="pi-field">
                        <label>Reference (optional)</label>
                        <input
                            type="text"
                            placeholder="Ref #"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>
                </div>

                {(invoiceType === 'stock_sale' || invoiceType === 'storage_fee') && (
                    <div className="pi-header-grid sf-doc-header-row">
                        <div className="pi-field" style={{ gridColumn: 'span 2' }}>
                            <label>
                                Customer
                                {invoiceType === 'stock_sale' ? ' *' : ' (optional)'}
                            </label>
                            <SearchableEntityCombobox
                                id="sf-inv-customer"
                                options={customerOptions}
                                value={storageCustomerId}
                                displayText={customerSearch}
                                onDisplayTextChange={(t) => {
                                    setCustomerSearch(t);
                                    setStorageCustomerId('');
                                }}
                                onSelect={(c) => {
                                    setStorageCustomerId(String(c.id));
                                    setCustomerSearch(c.label);
                                }}
                                placeholder="Search customer…"
                                required={invoiceType === 'stock_sale'}
                            />
                        </div>
                    </div>
                )}

                {invoiceType === 'withdrawal_to_owner' ? (
                    <div className="pi-header-grid">
                        <div className="pi-field">
                            <label>Warehouse catalog SKU (optional map)</label>
                            <select
                                className="sf-movement-input"
                                value={supplierProductId}
                                onChange={(e) => setSupplierProductId(e.target.value)}
                            >
                                <option value="">Select catalog product…</option>
                                {(whSearch || []).map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="sf-doc-link-btn"
                                onClick={() => onLoadCatalog?.()}
                            >
                                Load warehouse catalog
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="sf-doc-meta-grid">
                    <div className="pi-field">
                        <label>Billing address (optional)</label>
                        <textarea
                            rows={1}
                            className="sf-compact-textarea"
                            placeholder="Billing address"
                            value={billingAddress}
                            onChange={(e) => setBillingAddress(e.target.value)}
                        />
                    </div>
                    <div className="pi-field">
                        <label>Description (optional)</label>
                        <input
                            type="text"
                            placeholder="Invoice description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                </div>

                {showProductLines ? (
                    <div className="sf-doc-modal-scroll">
                    <div className="pi-lines-section">
                        <div
                            className="pi-lines-header sf-pi-lines-header"
                            style={{ gridTemplateColumns: lineGridCols }}
                        >
                            <div>#</div>
                            <div>Product</div>
                            <div>Qty</div>
                            <div>Unit price</div>
                            <div>Line note</div>
                            <div />
                        </div>
                        {lines.map((ln, rowIndex) => (
                            <div
                                key={ln.key}
                                className="pi-line-row sf-pi-line-data-row"
                                style={{ display: 'grid', gridTemplateColumns: lineGridCols, gap: 12, alignItems: 'start' }}
                            >
                                <span className="sf-pi-line-num">{rowIndex + 1}</span>
                                <ProductLineCombobox
                                    products={products}
                                    value={ln.storageProductId}
                                    searchText={ln.search}
                                    inputRef={(el) => {
                                        productRefs.current[rowIndex] = el;
                                    }}
                                    onSearchChange={(search) =>
                                        updateLine(ln.key, { search, storageProductId: '' })
                                    }
                                    onSelect={(p) =>
                                        updateLine(ln.key, {
                                            storageProductId: String(p.id),
                                            search: p.name || '',
                                            description: ln.description || p.name || '',
                                        })
                                    }
                                    onTabAdvance={() =>
                                        qtyRefs.current[rowIndex]?.focus()
                                    }
                                />
                                <input
                                    ref={(el) => {
                                        qtyRefs.current[rowIndex] = el;
                                    }}
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    className="sf-pi-cell-input"
                                    value={ln.qty}
                                    onChange={(e) =>
                                        updateLine(ln.key, { qty: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            priceRefs.current[rowIndex]?.focus();
                                        }
                                    }}
                                />
                                <input
                                    ref={(el) => {
                                        priceRefs.current[rowIndex] = el;
                                    }}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="sf-pi-cell-input"
                                    placeholder="0.00"
                                    value={ln.unitPrice}
                                    onChange={(e) =>
                                        updateLine(ln.key, { unitPrice: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            descRefs.current[rowIndex]?.focus();
                                        }
                                    }}
                                />
                                <input
                                    ref={(el) => {
                                        descRefs.current[rowIndex] = el;
                                    }}
                                    type="text"
                                    className="sf-pi-cell-input"
                                    placeholder="Optional"
                                    value={ln.description}
                                    onChange={(e) =>
                                        updateLine(ln.key, { description: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (rowIndex === lines.length - 1) {
                                                addLine(true);
                                            } else {
                                                productRefs.current[rowIndex + 1]?.focus();
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="sf-bulk-row-remove"
                                    onClick={() => removeLine(ln.key)}
                                    tabIndex={-1}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <div className="pi-line-row">
                            <button type="button" className="btn-add-line" onClick={() => addLine(true)}>
                                <Plus size={16} /> Add line
                            </button>
                        </div>
                    </div>
                    </div>
                ) : null}

                <div className="sf-doc-modal-bottom">
                <StorageFacilityVatTotals
                    lines={linesForTotals}
                    amountsTaxInclusive={amountsTaxInclusive}
                    onAmountsTaxInclusiveChange={setAmountsTaxInclusive}
                    unitFieldLabel="Unit price"
                />

                <div className="sf-doc-modal-footer">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={saving}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn-portal-outline" disabled={saving}>
                        Save draft
                    </button>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        disabled={saving}
                        onClick={(e) => submit(e, true)}
                    >
                        {saving ? 'Saving…' : 'Create & post'}
                    </button>
                </div>
                </div>
            </form>
        </Modal>
    );
}
