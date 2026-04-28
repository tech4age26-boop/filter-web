import { useState, useEffect } from 'react';
import { Check, X, Tag, User, Calendar, DollarSign, Package, ShoppingCart, RefreshCcw, ArrowRightLeft, FileText, Eye, Users, Settings, CreditCard, Loader, AlertCircle } from 'lucide-react';
import '../../styles/admin/ApprovalsPage.css';
import {
    getPendingApprovals,
    getApprovedApprovals,
    getRejectedApprovals,
    getApprovals,
    approveRequest,
    rejectRequest,
} from '../../services/approvalsApi';

const ENTITY_TYPES = [
    { value: '', label: 'All Types' },
    { value: 'workshop_registration', label: 'Workshop' },
    { value: 'supplier_registration', label: 'Supplier' },
    { value: 'corporate_registration', label: 'Corporate' },
    { value: 'technician_registration', label: 'Technician' },
];

function normalizeItem(raw) {
    const entityType = raw.entityType ?? raw.entity_type ?? '';
    return {
        id: raw.requestId ?? raw.id ?? raw._id,
        entityType,
        type: entityType.replace('_registration', '') || 'registration',
        status: raw.status ?? 'pending',
        title: raw.title ?? raw.name ?? raw.businessName ?? raw.business_name
            ?? `${entityType || 'Request'} #${raw.requestId ?? raw.id ?? raw._id}`,
        sub: raw.subtitle ?? raw.email ?? raw.submittedBy ?? raw.submitted_by ?? '—',
        department: entityType ? entityType.replace('_registration', '').replace('_', ' ') : '—',
        date: raw.submittedAt ?? raw.createdAt ?? raw.created_at ?? raw.date ?? '',
        amount: raw.amount ?? '—',
        reference: raw.reference ?? raw.referenceNo ?? '',
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ApprovalsPage({ isTab = false, onlySettings = false }) {
    const [currentTab, setCurrentTab] = useState(onlySettings ? 'Settings' : 'Pending');
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const [moduleSettings, setModuleSettings] = useState({
        inventory: { enabled: true, sub: { adjustments: true, transfers: true, uomChanges: false, priceOverrides: true, safetyStock: false } },
        sales: { enabled: true, sub: { invoiceDiscounts: true, salesRefunds: true, creditLimitChanges: false, customerTierUpgrades: true } },
        accounting: { enabled: true, sub: { expenseSubmission: true, paymentVouchers: true, purchaseOrders: true, bankAccountChanges: false } },
        hr: { enabled: true, sub: { newEmployeeEntry: true, salaryAdjustments: true, rolePermissionChanges: true } },
        system: { enabled: false, sub: { databaseBackups: true, thirdPartyIntegrations: false, apiKeyManagement: false } },
    });

    useEffect(() => {
        if (currentTab === 'Settings') return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const fetchFn = currentTab === 'Pending'
            ? () => getPendingApprovals({ entityType: entityTypeFilter })
            : currentTab === 'Approved'
                ? () => getApprovedApprovals({ entityType: entityTypeFilter })
                : currentTab === 'Rejected'
                    ? () => getRejectedApprovals({ entityType: entityTypeFilter })
                    : () => getApprovals({ entityType: entityTypeFilter });

        fetchFn()
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data)
                    ? data
                    : Object.entries(data)
                        .filter(([k]) => !isNaN(Number(k)))
                        .map(([, v]) => v);
                setItems(list.map(normalizeItem));
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [currentTab, entityTypeFilter]);

    const handleApprove = async (item) => {
        setActionLoading(item.id);
        try {
            await approveRequest(item.entityType, item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
        } catch (err) {
            alert(`Approve failed: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (item) => {
        setActionLoading(item.id);
        try {
            await rejectRequest(item.entityType, item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
        } catch (err) {
            alert(`Reject failed: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const toggleModule = (module) => {
        setModuleSettings(prev => ({ ...prev, [module]: { ...prev[module], enabled: !prev[module].enabled } }));
    };

    const toggleSubModule = (module, sub) => {
        setModuleSettings(prev => ({
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
            case 'workshop': return <FileText size={14} />;
            case 'supplier': return <FileText size={14} />;
            case 'corporate': return <FileText size={14} />;
            case 'technician': return <FileText size={14} />;
            default: return <FileText size={14} />;
        }
    };

    const tabs = ['Pending', 'Approved', 'Rejected', 'All'];

    const content = (
        <>
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
                    {items.map((item) => (
                        <div key={item.id} className="approval-card">
                            <div className="approval-card-header">
                                <span className={`approval-type-badge type-${item.type}`}>
                                    {getTypeIcon(item.type)} {item.type}
                                </span>
                                <div className="header-right">
                                    {item.amount && item.amount !== '—' && (
                                        <span className="approval-amount">{item.amount}</span>
                                    )}
                                    <span className={`approval-status-badge status-${item.status}`}>{item.status}</span>
                                </div>
                            </div>
                            <h3 className="approval-card-title">{item.title}</h3>
                            <div className="approval-card-meta">
                                <span><User size={14} /> {item.sub}</span>
                                <span>{item.department}</span>
                                <span><Calendar size={14} /> {formatDate(item.date)}</span>
                                {item.reference && (
                                    <span className="reference-badge">Ref: {item.reference}</span>
                                )}
                            </div>
                            {item.status === 'pending' && (
                                <div className="approval-card-actions">
                                    <button
                                        type="button"
                                        className="btn-approve"
                                        disabled={actionLoading === item.id}
                                        onClick={() => handleApprove(item)}
                                    >
                                        {actionLoading === item.id ? <Loader size={14} className="spin" /> : <Check size={16} />} Approve
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-reject"
                                        disabled={actionLoading === item.id}
                                        onClick={() => handleReject(item)}
                                    >
                                        {actionLoading === item.id ? <Loader size={14} className="spin" /> : <X size={16} />} Reject
                                    </button>
                                    <button type="button" className="btn-view-details">
                                        <Eye size={16} /> Details
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {currentTab !== 'Settings' && !loading && !error && items.length === 0 && (
                <div className="empty-state-card">
                    <p className="empty-status">0 {currentTab.toLowerCase()} items</p>
                    <p className="empty-desc">Everything is reviewed. Powering up precision for your automotive network.</p>
                </div>
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
