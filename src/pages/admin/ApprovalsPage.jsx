import { useState, useEffect, useCallback } from 'react';
import {
    Check, X, Tag, User, Calendar, DollarSign, Package, ShoppingCart,
    RefreshCcw, ArrowRightLeft, FileText, Eye, Users, Settings, CreditCard,
    Loader, AlertCircle, Building2,
} from 'lucide-react';
import '../../styles/admin/ApprovalsPage.css';
import {
    list as listApprovals,
    approve as approveApi,
    reject as rejectApi,
} from '../../services/approvalsApi';
import {
    approveSuperAdminCorporatePriceQuotation,
    rejectSuperAdminCorporatePriceQuotation,
} from '../../services/superAdminApi';
import Modal from '../../components/Modal';
import ApprovalDetailsModal from './ApprovalDetailsModal';

const ENTITY_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'workshop_registration', label: 'Workshop (public signup)' },
    { value: 'branch_creation', label: 'Branch (workshop)' },
    { value: 'cashier_registration', label: 'Cashier' },
    { value: 'workshop_portal_staff_registration', label: 'Portal staff (workshop)' },
    { value: 'supplier_registration', label: 'Supplier' },
    { value: 'corporate_registration', label: 'Corporate' },
    { value: 'corporate_price_quotation', label: 'Corporate price quotation' },
    { value: 'technician_registration', label: 'Technician' },
];

const TAB_TO_STATUS = {
    Pending: 'pending',
    Approved: 'approved',
    Rejected: 'rejected',
    All: undefined,
};

function fmtPerson(p) {
    if (!p) return '—';
    if (typeof p === 'string') return p;
    return p.name || p.fullName || p.email || p.mobile || '—';
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

// Keep IDs as strings — backend uses BigInt.
function toStringId(v) {
    return v == null ? '' : String(v);
}

function normalizeItem(raw) {
    const entityType = raw.entityType ?? raw.entity_type ?? '';
    const meta = raw.meta ?? {};
    const id = toStringId(raw.requestId ?? raw.id ?? raw._id);

    const title = raw.title
        ?? meta.companyName
        ?? meta.branchName
        ?? (meta.name && meta.workshopStaffRole
            ? `${meta.name} (${String(meta.workshopStaffRole).replace(/_/g, ' ')})`
            : null)
        ?? meta.name
        ?? meta.workshopCode
        ?? meta.cashierName
        ?? meta.fullName
        ?? raw.businessName
        ?? raw.business_name
        ?? `${entityType || 'Request'} #${id}`;

    const type = entityType.replace('_registration', '') || 'registration';
    const typeLabel = ENTITY_TYPES.find((e) => e.value === entityType)?.label
        ?? entityType.replace(/_/g, ' ');

    return {
        id,
        entityType,
        type,
        typeLabel,
        status: raw.status ?? 'pending',
        title,
        meta,
        submittedBy: raw.submittedBy ?? raw.submitted_by ?? null,
        reviewer: raw.reviewer ?? raw.reviewed_by ?? null,
        date: raw.submittedAt ?? raw.createdAt ?? raw.created_at ?? raw.date ?? '',
        reference: raw.reference ?? raw.referenceNo ?? '',
        raw,
    };
}

/** Accept all known list shapes from /super-admin/approvals*. */
function unwrapApprovalsListResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const candidates = [
        payload.items,
        payload.data,
        payload.results,
        payload.rows,
        payload.list,
        payload?.data?.items,
        payload?.data?.rows,
        payload?.data?.results,
        payload?.data?.list,
    ];
    for (const c of candidates) {
        if (Array.isArray(c)) return c;
    }

    // Legacy numeric-key object fallback.
    return Object.entries(payload || {})
        .filter(([k]) => !Number.isNaN(Number(k)))
        .map(([, v]) => v);
}

/** Entity-specific compact "meta chips" shown on the card. */
function buildMetaChips(item) {
    const m = item.meta || {};
    const chips = [];
    const push = (label, value) => {
        if (value === undefined || value === null || value === '') return;
        chips.push({ label, value: String(value) });
    };

    switch (item.entityType) {
        case 'workshop_registration':
            push('Code', m.workshopCode);
            push('Owner', m.ownerName);
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('CR', m.crNumber);
            break;
        case 'supplier_registration':
            push('Contact', m.contactPerson);
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('License', m.tradeLicenseNo);
            push('VAT', m.vatId);
            push('City', m.cityDistrict);
            if (typeof m.isInternalWarehouse === 'boolean') {
                push('Internal WH', m.isInternalWarehouse ? 'Yes' : 'No');
            }
            break;
        case 'corporate_registration':
            push('Contact', m.contactPerson);
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('VAT', m.vatNumber);
            if (Array.isArray(m.selectedBranchIds) && m.selectedBranchIds.length > 0) {
                push('Branches', `${m.selectedBranchIds.length}`);
            }
            if (m.referral?.fullName) push('Referral', m.referral.fullName);
            break;
        case 'technician_registration':
            push('Mobile', m.mobile);
            push('Email', m.email);
            push('Workshop', m.workshop?.name);
            push('Branch', m.branch?.name);
            push('Type', m.employeeType);
            push('Tech Type', m.technicianType);
            if (Array.isArray(m.departments) && m.departments.length > 0) {
                push('Depts', m.departments.map((d) => d?.name).filter(Boolean).join(', '));
            }
            break;
        case 'branch_creation':
            push('Branch', m.name ?? m.branchName);
            push('Workshop', m.workshop?.name);
            push('Code', m.branchCode ?? m.code);
            push('Address', m.address);
            push('Requested', m.approvalRequestedAt ?? m.approval_requested_at);
            break;
        case 'cashier_registration':
            push('Name', m.name ?? m.cashierName);
            push('Email', m.email);
            push('Mobile', m.mobile);
            push('Workshop', m.workshop?.name);
            push('Branch', m.branch?.name);
            break;
        case 'workshop_portal_staff_registration':
            push('Role', m.workshopStaffRole ?? m.workshop_staff_role);
            push('Name', m.name ?? m.fullName);
            push('Email', m.email);
            push('Mobile', m.mobile);
            push('Workshop', m.workshop?.name);
            push('Branch', m.branch?.name);
            push(
                'Team leader dept',
                m.teamLeaderDepartment?.name ?? m.team_leader_department?.name,
            );
            break;
        case 'corporate_price_quotation':
        case 'corporate_price_quotations':
            push('Item', m.name);
            push('SKU', m.sku);
            push('Quote', m.quotationPrice != null ? `SAR ${m.quotationPrice}` : null);
            push('Status', m.status ?? item.status);
            break;
        default:
            break;
    }
    return chips;
}

/* ------------------------------------------------------------------ */
/*  Approve / Reject confirmation modals                              */
/* ------------------------------------------------------------------ */

function ApproveModal({ item, busy, onCancel, onConfirm }) {
    const [remarks, setRemarks] = useState('');
    return (
        <Modal
            title="Approve Request"
            onClose={busy ? undefined : onCancel}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-approve"
                        disabled={busy}
                        onClick={() => onConfirm(remarks)}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <Check size={16} />}
                        Approve
                    </button>
                </>
            )}
        >
            <p className="approval-modal-lead">
                Approve <strong>{item.title}</strong>? You can add optional remarks for the audit log.
            </p>
            <label className="approval-modal-label" htmlFor="approve-remarks">
                Remarks <span className="approval-modal-optional">(optional)</span>
            </label>
            <textarea
                id="approve-remarks"
                className="approval-modal-textarea"
                rows={3}
                placeholder="e.g. Documents verified."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={busy}
            />
        </Modal>
    );
}

function RejectModal({ item, busy, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const trimmed = reason.trim();
    const valid = trimmed.length > 0;

    const handleConfirm = () => {
        if (!valid) {
            setTouched(true);
            return;
        }
        onConfirm(trimmed);
    };

    return (
        <Modal
            title="Reject Request"
            onClose={busy ? undefined : onCancel}
            width={460}
            footer={(
                <>
                    <button type="button" className="btn-view-details" disabled={busy} onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-reject"
                        disabled={busy || !valid}
                        onClick={handleConfirm}
                    >
                        {busy ? <Loader size={14} className="spin" /> : <X size={16} />}
                        Reject
                    </button>
                </>
            )}
        >
            <p className="approval-modal-lead">
                Reject <strong>{item.title}</strong>? Provide a reason — it will be shown to the
                submitter.
            </p>
            <label className="approval-modal-label" htmlFor="reject-reason">
                Reason <span className="approval-modal-required">(required)</span>
            </label>
            <textarea
                id="reject-reason"
                className={`approval-modal-textarea ${touched && !valid ? 'invalid' : ''}`}
                rows={3}
                placeholder="e.g. Trade license expired."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                disabled={busy}
            />
            {touched && !valid && (
                <p className="approval-modal-error">A reason is required to reject.</p>
            )}
        </Modal>
    );
}

/* ------------------------------------------------------------------ */
/*  Toast (matches the lightweight pattern used in TechnicianLayout)  */
/* ------------------------------------------------------------------ */

function Toast({ toast }) {
    if (!toast) return null;
    const isError = toast.type === 'error';
    return (
        <div
            className="approvals-toast"
            style={{
                background: isError ? '#FEE2E2' : '#DCFCE7',
                color: isError ? '#DC2626' : '#15803D',
                borderColor: isError ? '#FCA5A5' : '#BBF7D0',
            }}
            role="status"
        >
            {toast.msg}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function ApprovalsPage({ isTab = false, onlySettings = false }) {
    const [currentTab, setCurrentTab] = useState(onlySettings ? 'Settings' : 'Pending');
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [reloadTick, setReloadTick] = useState(0);

    // dialogs
    const [detailsTarget, setDetailsTarget] = useState(null); // { entityType, id }
    const [approveTarget, setApproveTarget] = useState(null); // item
    const [rejectTarget, setRejectTarget] = useState(null);   // item

    // toast
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const [moduleSettings, setModuleSettings] = useState({
        inventory: { enabled: true, sub: { adjustments: true, transfers: true, uomChanges: false, priceOverrides: true, safetyStock: false } },
        sales: { enabled: true, sub: { invoiceDiscounts: true, salesRefunds: true, creditLimitChanges: false, customerTierUpgrades: true } },
        accounting: { enabled: true, sub: { expenseSubmission: true, paymentVouchers: true, purchaseOrders: true, bankAccountChanges: false } },
        hr: { enabled: true, sub: { newEmployeeEntry: true, salaryAdjustments: true, rolePermissionChanges: true } },
        system: { enabled: false, sub: { databaseBackups: true, thirdPartyIntegrations: false, apiKeyManagement: false } },
    });

    useEffect(() => {
        if (currentTab === 'Settings') return undefined;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const status = TAB_TO_STATUS[currentTab];
        listApprovals({ status, entityType: entityTypeFilter })
            .then((data) => {
                if (cancelled) return;
                const arr = unwrapApprovalsListResponse(data);
                setItems(arr.map(normalizeItem));
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [currentTab, entityTypeFilter, reloadTick]);

    const removeFromList = useCallback((id) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    }, []);

    const isCorporatePriceQuotation = (et) =>
        et === 'corporate_price_quotation' || et === 'corporate_price_quotations';

    const handleApproveConfirm = async (item, remarks) => {
        setActionLoading(item.id);
        try {
            if (isCorporatePriceQuotation(item.entityType)) {
                await approveSuperAdminCorporatePriceQuotation(item.id);
            } else {
                await approveApi(item.entityType, item.id, remarks);
            }
            removeFromList(item.id);
            setApproveTarget(null);
            setDetailsTarget(null);
            showToast('Request approved.');
        } catch (err) {
            showToast(`Approve failed: ${err.message}`, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (item, reason) => {
        setActionLoading(item.id);
        try {
            if (isCorporatePriceQuotation(item.entityType)) {
                await rejectSuperAdminCorporatePriceQuotation(item.id, { reason });
            } else {
                await rejectApi(item.entityType, item.id, reason);
            }
            removeFromList(item.id);
            setRejectTarget(null);
            setDetailsTarget(null);
            showToast('Request rejected.');
        } catch (err) {
            showToast(`Reject failed: ${err.message}`, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const toggleModule = (module) => {
        setModuleSettings((prev) => ({ ...prev, [module]: { ...prev[module], enabled: !prev[module].enabled } }));
    };

    const toggleSubModule = (module, sub) => {
        setModuleSettings((prev) => ({
            ...prev,
            [module]: { ...prev[module], sub: { ...prev[module].sub, [sub]: !prev[module].sub[sub] } },
        }));
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'promotion': return <Tag size={14} />;
            case 'expense': return <DollarSign size={14} />;
            case 'purchase': return <ShoppingCart size={14} />;
            case 'inventory': return <Package size={14} />;
            case 'refund': return <RefreshCcw size={14} />;
            case 'transfer': return <ArrowRightLeft size={14} />;
            case 'sales': return <CreditCard size={14} />;
            case 'accounting': return <DollarSign size={14} />;
            case 'hr': return <Users size={14} />;
            case 'system': return <Settings size={14} />;
            case 'workshop':
            case 'supplier':
            case 'corporate':
            case 'corporate_price_quotation':
            case 'corporate_price_quotations':
            case 'technician':
            case 'branch_creation':
                return <Building2 size={14} />;
            case 'cashier':
                return <CreditCard size={14} />;
            case 'workshop_portal_staff':
                return <Users size={14} />;
            default:
                return <FileText size={14} />;
        }
    };

    const tabs = ['Pending', 'Approved', 'Rejected', 'All'];

    const content = (
        <>
            <Toast toast={toast} />

            {!onlySettings && (
                <div className="tabs-container">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            className={`tab-item ${currentTab === tab ? 'active' : ''}`}
                            onClick={() => setCurrentTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            )}

            {currentTab !== 'Settings' && (
                <div className="approvals-filter-bar">
                    <select
                        className="entity-type-filter"
                        value={entityTypeFilter}
                        onChange={(e) => setEntityTypeFilter(e.target.value)}
                    >
                        {ENTITY_TYPES.map((et) => (
                            <option key={et.value} value={et.value}>{et.label}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="btn-view-details approvals-refresh-btn"
                        onClick={() => setReloadTick((t) => t + 1)}
                        disabled={loading}
                    >
                        <RefreshCcw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            )}

            {currentTab === 'Settings' && (
                <div className="approval-settings-grid hyper-detailed">
                    {Object.entries(moduleSettings).map(([module, data]) => (
                        <div key={module} className="settings-group-container secondary">
                            <div className="settings-card main-toggle-premium">
                                <div className="settings-info-premium">
                                    <div className={`settings-icon-wrapper-large type-${module}`}>
                                        {getTypeIcon(module)}
                                    </div>
                                    <div className="settings-text-block">
                                        <h4 className="settings-module-name-large">
                                            {module === 'hr' ? 'Human Resources' : module.charAt(0).toUpperCase() + module.slice(1)}
                                        </h4>
                                        <p className="settings-module-desc-premium">
                                            Manage granular approval requirements for {module} actions.
                                        </p>
                                    </div>
                                </div>
                                <div className="main-toggle-wrapper">
                                    <span className={`toggle-status-label ${data.enabled ? 'enabled' : 'disabled'}`}>
                                        {data.enabled ? 'ACTIVE' : 'DISABLED'}
                                    </span>
                                    <label className="switch premium">
                                        <input type="checkbox" checked={data.enabled} onChange={() => toggleModule(module)} />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                            </div>
                            {data.enabled && (
                                <div className="sub-settings-grid-premium">
                                    {Object.entries(data.sub).map(([subKey, subEnabled]) => (
                                        <div key={subKey} className="sub-setting-card-premium">
                                            <div className="sub-setting-header-premium">
                                                <span className="sub-setting-name-premium">
                                                    {subKey.charAt(0).toUpperCase() + subKey.slice(1).replace(/([A-Z])/g, ' $1')}
                                                </span>
                                                <label className="switch small-premium">
                                                    <input type="checkbox" checked={subEnabled} onChange={() => toggleSubModule(module, subKey)} />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                            <p className="sub-setting-info-text">Requires manual admin review for this action.</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {currentTab !== 'Settings' && loading && (
                <div className="empty-state-card">
                    <Loader size={24} className="spin" />
                    <p className="empty-desc">Loading approvals…</p>
                </div>
            )}

            {currentTab !== 'Settings' && !loading && error && (
                <div className="empty-state-card">
                    <AlertCircle size={24} />
                    <p className="empty-status">Failed to load</p>
                    <p className="empty-desc">{error}</p>
                </div>
            )}

            {currentTab !== 'Settings' && !loading && !error && items.length > 0 && (
                <div className="approval-cards">
                    {items.map((item) => {
                        const chips = buildMetaChips(item);
                        return (
                            <div key={item.id} className="approval-card">
                                <div className="approval-card-header">
                                    <span className={`approval-type-badge type-${item.type}`}>
                                        {getTypeIcon(item.type)} {item.typeLabel}
                                    </span>
                                    <div className="header-right">
                                        <span className={`approval-status-badge status-${item.status}`}>{item.status}</span>
                                    </div>
                                </div>
                                <h3 className="approval-card-title">{item.title}</h3>
                                <div className="approval-card-meta">
                                    <span><User size={14} /> {fmtPerson(item.submittedBy)}</span>
                                    <span><Calendar size={14} /> {formatDate(item.date)}</span>
                                    {item.reviewer && (
                                        <span className="approval-reviewer">
                                            Reviewer: {fmtPerson(item.reviewer)}
                                        </span>
                                    )}
                                    {item.reference && (
                                        <span className="reference-badge">Ref: {item.reference}</span>
                                    )}
                                </div>
                                {chips.length > 0 && (
                                    <div className="approval-card-chips">
                                        {chips.map((chip, idx) => (
                                            <span key={`${chip.label}-${idx}`} className="approval-chip">
                                                <span className="approval-chip-label">{chip.label}</span>
                                                <span className="approval-chip-value">{chip.value}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="approval-card-actions">
                                    {item.status === 'pending' && (
                                        <>
                                            <button
                                                type="button"
                                                className="btn-approve"
                                                disabled={actionLoading === item.id}
                                                onClick={() => setApproveTarget(item)}
                                            >
                                                {actionLoading === item.id ? <Loader size={14} className="spin" /> : <Check size={16} />} Approve
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-reject"
                                                disabled={actionLoading === item.id}
                                                onClick={() => setRejectTarget(item)}
                                            >
                                                {actionLoading === item.id ? <Loader size={14} className="spin" /> : <X size={16} />} Reject
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-view-details"
                                        onClick={() => setDetailsTarget({ entityType: item.entityType, id: item.id, item })}
                                    >
                                        <Eye size={16} /> Details
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {currentTab !== 'Settings' && !loading && !error && items.length === 0 && (
                <div className="empty-state-card">
                    <p className="empty-status">0 {currentTab.toLowerCase()} items</p>
                    <p className="empty-desc">
                        {currentTab === 'Pending'
                            ? 'Nothing is waiting for review right now.'
                            : 'Nothing to show in this tab.'}
                    </p>
                </div>
            )}

            {detailsTarget && (
                <ApprovalDetailsModal
                    entityType={detailsTarget.entityType}
                    id={detailsTarget.id}
                    onClose={() => setDetailsTarget(null)}
                    actionDisabled={actionLoading === detailsTarget.id}
                    onApprove={(data) => {
                        const target = detailsTarget.item ?? {
                            id: toStringId(data?.requestId ?? data?.id),
                            entityType: detailsTarget.entityType,
                            title: data?.title ?? data?.meta?.companyName ?? data?.meta?.name ?? 'this request',
                        };
                        setApproveTarget(target);
                    }}
                    onReject={(data) => {
                        const target = detailsTarget.item ?? {
                            id: toStringId(data?.requestId ?? data?.id),
                            entityType: detailsTarget.entityType,
                            title: data?.title ?? data?.meta?.companyName ?? data?.meta?.name ?? 'this request',
                        };
                        setRejectTarget(target);
                    }}
                />
            )}

            {approveTarget && (
                <ApproveModal
                    item={approveTarget}
                    busy={actionLoading === approveTarget.id}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={(remarks) => handleApproveConfirm(approveTarget, remarks)}
                />
            )}

            {rejectTarget && (
                <RejectModal
                    item={rejectTarget}
                    busy={actionLoading === rejectTarget.id}
                    onCancel={() => setRejectTarget(null)}
                    onConfirm={(reason) => handleRejectConfirm(rejectTarget, reason)}
                />
            )}
        </>
    );

    if (isTab) return content;

    return (
        <div className="approvals-page module-container">
            {content}
        </div>
    );
}
