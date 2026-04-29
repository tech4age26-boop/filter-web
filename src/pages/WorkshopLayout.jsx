import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, ArrowLeft, LogOut, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    NAV_ITEMS,
} from './workshop/constants';
import WorkshopDashboard from './workshop/WorkshopDashboard';
import WorkshopEmployees from './workshop/WorkshopEmployees';
import WorkshopDepartments from './workshop/WorkshopDepartments';
import WorkshopCatalog from './workshop/WorkshopCatalog';
import WorkshopCatalogNew from './workshop/WorkshopCatalogNew';
import WorkshopPurchases from './workshop/WorkshopPurchases';
import WorkshopApprovals from './workshop/WorkshopApprovals';
import WorkshopSuppliers from './workshop/WorkshopSuppliers';
import WorkshopReports from './workshop/WorkshopReports';
import WorkshopPosMonitoring from './workshop/WorkshopPosMonitoring';
import WorkshopPromoCodes from './workshop/WorkshopPromoCodes';
import WorkshopCorporateManagement from './workshop/WorkshopCorporateManagement';
import WorkshopBranches from './workshop/WorkshopBranches';
import WorkshopCommissions from './workshop/WorkshopCommissions';
import WorkshopInventory from './workshop/WorkshopInventory';
import WorkshopAccountingPage from './workshop/WorkshopAccountingPage';
import { apiFetch } from '../services/api';
import './workshop/Workshop.css';
import '../styles/admin/AccountingPage.css';
import '../styles/admin/ApprovalsPage.css';

export default function WorkshopLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        const main = parts[1] || 'dashboard';
        const sub = parts[2];

        if (main === 'accounting' && sub) {
            const mapping = {
                'chart-of-accounts': 'acc-chart',
                'cash-bank': 'acc-cash',
                'transactions': 'acc-transactions',
                'journal-entries': 'acc-journal',
                'purchases': 'acc-purchases',
                'expenses': 'acc-expenses',
                'receipts': 'acc-receipts',
                'payments': 'acc-payments',
                'advances': 'acc-advances',
                'ledger': 'acc-ledger',
            };
            return mapping[sub] || 'acc-cash';
        }
        return main;
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromUrl());
    const [tabState, setTabState] = useState(null);

    const handleTabChange = (tabId, state = null) => {
        setActiveTab(tabId);
        setTabState(state);
        
        if (tabId.startsWith('acc-')) {
            const reverseMapping = {
                'acc-chart': 'chart-of-accounts',
                'acc-cash': 'cash-bank',
                'acc-transactions': 'transactions',
                'acc-journal': 'journal-entries',
                'acc-purchases': 'purchases',
                'acc-expenses': 'expenses',
                'acc-receipts': 'receipts',
                'acc-payments': 'payments',
                'acc-advances': 'advances',
                'acc-ledger': 'ledger',
            };
            navigate(`/workshop/accounting/${reverseMapping[tabId]}`);
        } else {
            navigate(`/workshop/${tabId}`);
        }
    };

    const [openMenus, setOpenMenus] = useState({ accounting: activeTab.startsWith('acc-') });

    const toggleMenu = (id) => {
        setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [branches, setBranches] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);

    const updateProductStatus = (productId, newStatus) => {
        setSelectedProducts(prev => prev.map(p => 
            p.id === productId ? { ...p, status: newStatus } : p
        ));
    };

    const [pendingApprovals, setPendingApprovals] = useState(0);
    const [dashboardLowStockCount, setDashboardLowStockCount] = useState(0);

    const loadBranches = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/branches');
            if (response?.success && Array.isArray(response.branches)) {
                setBranches(response.branches);
            }
        } catch {
            setBranches([]);
        }
    }, []);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    const loadPendingApprovalsCount = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/petty-cash/requests?limit=1&offset=0&queue=pending');
            if (response?.success) {
                setPendingApprovals(Number(response.total) || 0);
            }
        } catch {
            setPendingApprovals(0);
        }
    }, []);

    useEffect(() => {
        loadPendingApprovalsCount();
    }, [loadPendingApprovalsCount]);

    useEffect(() => {
        const handleApprovalsUpdated = () => {
            loadPendingApprovalsCount();
        };

        window.addEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        return () => {
            window.removeEventListener('workshop-approvals-updated', handleApprovalsUpdated);
        };
    }, [loadPendingApprovalsCount]);

    const selectedBranchName = useMemo(() => {
        if (selectedBranch === 'all') return 'All Branches';
        return branches.find((branch) => branch.id === selectedBranch)?.name || 'All Branches';
    }, [branches, selectedBranch]);

    useEffect(() => {
        if (activeTab !== 'dashboard') setDashboardLowStockCount(0);
    }, [activeTab]);

    const renderContent = () => {
        switch (activeTab) {
            case 'acc-chart':         
            case 'acc-cash':          
            case 'acc-commissions':
            case 'acc-referral':
            case 'acc-transactions':  
            case 'acc-journal':       
            case 'acc-purchases':     
            case 'acc-expenses':      
            case 'acc-receipts':      
            case 'acc-payments':      
            case 'acc-advances':      
            case 'acc-ledger':        return <WorkshopAccountingPage activeTab={activeTab} />;
            case 'dashboard':         return (
                <WorkshopDashboard
                    onTabChange={handleTabChange}
                    selectedBranchId={selectedBranch}
                    branches={branches}
                    onLowStockAlertsChange={setDashboardLowStockCount}
                />
            );
            case 'employees':   return <WorkshopEmployees selectedBranchId={selectedBranch} branches={branches} />;
            case 'departments': return <WorkshopDepartments selectedBranchId={selectedBranch} branches={branches} />;
            case 'catalog':     return (
                <WorkshopCatalog selectedBranchId={selectedBranch} branches={branches} />
            );
            case 'purchases':   return (
                <WorkshopPurchases 
                    tabState={tabState} 
                    clearTabState={() => setTabState(null)} 
                />
            );
            case 'approvals':   return <WorkshopApprovals />;
            case 'suppliers':   return <WorkshopSuppliers />;
            case 'reports':     return <WorkshopReports />;
            case 'pos-monitoring': return <WorkshopPosMonitoring />;
            case 'catalog-new': return (
                <WorkshopCatalogNew
                    selectedBranchId={selectedBranch}
                    branches={branches}
                />
            );
            case 'promo-codes': return <WorkshopPromoCodes />;
            case 'corporate-management': return <WorkshopCorporateManagement />;
            case 'branches':    return <WorkshopBranches />;
            case 'commissions': return <WorkshopCommissions />;
            case 'inventory': return (
                <WorkshopInventory
                    selectedBranchId={selectedBranch}
                    branches={branches}
                    selectedProducts={selectedProducts}
                    onTabChange={handleTabChange}
                    updateProductStatus={updateProductStatus}
                />
            );
            default:            return (
                <WorkshopDashboard
                    onTabChange={handleTabChange}
                    selectedBranchId={selectedBranch}
                    branches={branches}
                    onLowStockAlertsChange={setDashboardLowStockCount}
                />
            );
        }
    };

    const currentLabel = NAV_ITEMS.flatMap(i => i.subItems ? [i, ...i.subItems] : [i]).find(n => n.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo">
                    <div className="ws-logo-icon"><Building2 size={20}/></div>
                    <div><p className="ws-logo-title">Filter Admin Workshop</p><p className="ws-logo-sub">Portal</p></div>
                </div>
                <a className="ws-back-link" onClick={() => navigate('/admin/dashboard')} style={{cursor:'pointer'}}>
                    <ArrowLeft size={14}/> Back to Super Admin
                </a>
                <div className="ws-branch-selector">
                    <select className="ws-branch-select" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)', color: '#000000' }}>
                        <option value="all">All Branches</option>
                        {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                </div>
                <nav className="ws-nav">
                    {NAV_ITEMS.map((item) => {
                        const hasSub = item.subItems?.length > 0;
                        const isOpen = openMenus[item.id];
                        const isActiveParent = activeTab === item.id || (hasSub && item.subItems.some(s => s.id === activeTab));
                        
                        return (
                            <div key={item.id} className="ws-nav-item-group">
                                <button 
                                    className={`ws-nav-btn ${isActiveParent ? 'active' : ''}`} 
                                    onClick={() => {
                                        if (hasSub) {
                                            toggleMenu(item.id);
                                        } else {
                                            handleTabChange(item.id);
                                        }
                                    }}
                                >
                                    <item.icon size={18} color="#000000"/>
                                    <span>{item.label}</span>
                                    {hasSub && (
                                        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                            {isOpen ? <ChevronDown size={14} color="#000000"/> : <ChevronRight size={14} color="#000000"/>}
                                        </span>
                                    )}
                                    {item.badge && pendingApprovals > 0 && !hasSub && <span className="ws-nav-badge">{pendingApprovals}</span>}
                                </button>
                                {hasSub && (
                                    <AnimatePresence>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                style={{ overflow: 'hidden', paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}
                                            >
                                                {item.subItems.map(sub => (
                                                    <button
                                                        key={sub.id}
                                                        className={`ws-nav-btn ws-nav-sub-btn ${activeTab === sub.id ? 'active' : ''}`}
                                                        onClick={() => handleTabChange(sub.id)}
                                                        style={{ 
                                                            padding: '8px 12px', 
                                                            fontSize: '0.8125rem',
                                                            background: 'transparent',
                                                            color: '#000000',
                                                            textDecoration: activeTab === sub.id ? 'underline' : 'none',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            textAlign: 'left',
                                                            cursor: 'pointer',
                                                            display: 'block',
                                                            opacity: activeTab === sub.id ? 1 : 0.6
                                                        }}
                                                    >
                                                        {sub.label}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        );
                    })}
                    <div style={{ height: '40px', flexShrink: 0 }} />
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info">
                        <div className="ws-user-avatar">WA</div>
                        <div><p className="ws-user-name">Workshop Admin</p><p className="ws-user-role">Portal Manager</p></div>
                    </div>
                    <button className="ws-logout-btn" onClick={() => navigate('/')}><LogOut size={16}/></button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar">
                    <div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">{selectedBranchName}</p></div>
                    <div className="ws-topbar-right">
                        {dashboardLowStockCount > 0 && (
                            <button className="ws-alert-badge" onClick={() => setActiveTab('departments')}>
                                <AlertTriangle size={14}/> {dashboardLowStockCount} stock alert{dashboardLowStockCount > 1 ? 's' : ''}
                            </button>
                        )}
                        <div className="ws-online-badge"><div className="ws-online-dot"/> Online</div>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>
        </div>
    );
}
