import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Warehouse, ArrowLeft, LogOut, FileText, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import { NAV_GROUPS, SUPPLIER_AR_SUMMARY } from './supplier/constants';
import SupplierDashboard from './supplier/SupplierDashboard';
import SupplierOrderQueue from './supplier/SupplierOrderQueue';
import SupplierStockInventory from './supplier/SupplierStockInventory';
import SupplierWorkshopAlerts from './supplier/SupplierWorkshopAlerts';
import SupplierCatalog from './supplier/SupplierCatalog';
import SupplierStaff from './supplier/SupplierStaff';
import SupplierSalesInvoices from './supplier/SupplierSalesInvoices';
import SupplierPurchaseInvoices from './supplier/SupplierPurchaseInvoices';
import SupplierCashBank from './supplier/SupplierCashBank';
import SupplierExpenses from './supplier/SupplierExpenses';
import SupplierAccountingPage from './supplier/SupplierAccountingPage';
import { useAuth } from '../context/AuthContext';
import { getSupplierProfile, getSupplierReceivables } from '../services/supplierApi';
import './workshop/Workshop.css';

export default function SupplierLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    
    // Determine active tab from URL: /supplier/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        // If path is /supplier/accounting/cash-bank, parts are ['supplier', 'accounting', 'cash-bank']
        if (parts[1] === 'accounting' && parts[2]) {
            return `accounting_${parts[2]}`;
        }
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const [expandedGroups, setExpandedGroups] = useState(['accounting']);
    
    const [arSummary, setArSummary] = useState(null);
    const [arSummaryError, setArSummaryError] = useState('');
    const [profileName, setProfileName] = useState(user?.name || 'Supplier Admin');
    const [profileRole, setProfileRole] = useState('Supplier Portal Manager');

    const setActiveTab = (tab) => {
        if (tab.startsWith('accounting_')) {
            const sub = tab.replace('accounting_', '');
            navigate(`/supplier/accounting/${sub}`);
        } else {
            navigate(`/supplier/${tab}`);
        }
    };

    const toggleGroup = (id) => {
        setExpandedGroups(prev => 
            prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
        );
    };

    const handleLogout = () => {
        logout();
        navigate('/supplier/login', { replace: true });
    };

    const userType = String(user?.userType || user?.type || '').toLowerCase();
    const canGoBackToAdmin =
        userType === 'admin' ||
        userType === 'super_admin' ||
        userType === 'admin_user' ||
        userType === 'platform_admin';

    useEffect(() => {
        let cancelled = false;
        const bootstrapSupplierData = async () => {
            try {
                const [profileRes, receivablesRes] = await Promise.all([
                    getSupplierProfile(),
                    getSupplierReceivables(),
                ].map(p => p.catch(e => { console.error(e); return null; })));
                
                if (cancelled) return;

                if (receivablesRes && Array.isArray(receivablesRes.list)) {
                    const totalOutstanding = receivablesRes.list.reduce(
                        (sum, item) => sum + Number(item.outstanding || 0),
                        0,
                    );
                    setArSummary(totalOutstanding);
                } else if (receivablesRes && receivablesRes.data) {
                    setArSummary(receivablesRes.data.total_receivable || 0);
                }

                const supplierName =
                    profileRes?.supplier?.companyName ||
                    profileRes?.supplier?.name ||
                    user?.name;
                if (supplierName) setProfileName(supplierName);
                
                if (profileRes?.supplier?.role) setProfileRole(profileRes.supplier.role);
            } catch (error) {
                if (!cancelled) {
                    console.error('Supplier layout API bootstrap failed:', error);
                    setArSummaryError('Error loading AR');
                }
            }
        };
        bootstrapSupplierData();
        return () => { cancelled = true; };
    }, [user?.name]);

    const renderContent = () => {
        if (activeTab.startsWith('accounting_')) {
            return <SupplierAccountingPage activeSubTab={activeTab} />;
        }

        switch (activeTab) {
            case 'dashboard': return <SupplierDashboard onTabChange={setActiveTab}/>;
            case 'order_queue': return <SupplierOrderQueue/>;
            case 'stock': return <SupplierStockInventory/>;
            case 'stock_alerts': return <SupplierWorkshopAlerts/>;
            case 'catalog': return <SupplierCatalog/>;
            case 'employees': return <SupplierStaff/>;
            case 'sales_invoices': return <SupplierSalesInvoices/>;
            case 'purchase_invoices': return <SupplierPurchaseInvoices/>;
            case 'cash_bank': return <SupplierCashBank/>;
            case 'expenses': return <SupplierExpenses/>;
            case 'accounting': return <SupplierAccountingPage activeSubTab="accounting_coa" />;
            default: return <SupplierDashboard onTabChange={setActiveTab}/>;
        }
    };

    const currentLabel = NAV_GROUPS.flatMap(g => [g, ...(g.items || [])])
        .flatMap(i => [i, ...(i.subItems || [])])
        .find(i => i.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="workshop-layout supplier-portal">
            <aside className="ws-sidebar">
                <div className="ws-logo">
                    <div className="ws-logo-icon"><Warehouse size={20}/></div>
                    <div><p className="ws-logo-title">Filter Supplier</p><p className="ws-logo-sub">Portal</p></div>
                </div>
                <div style={{ padding: '10px 14px', margin: '10px 12px', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={14}/> AR: {
                        arSummaryError ? 'Error' : 
                        arSummary === null ? 'Loading...' : 
                        `SAR ${Number(arSummary).toLocaleString()}`
                    }
                </div>
                {canGoBackToAdmin ? (
                    <a className="ws-back-link" onClick={() => navigate('/admin/dashboard')} style={{cursor:'pointer'}}><ArrowLeft size={14}/> Back to Super Admin</a>
                ) : null}
                <nav className="ws-nav">
                    {NAV_GROUPS.map(grp => (
                        <div key={grp.label}>
                            <div style={{fontSize:'0.625rem',fontWeight:800,color:'#000000',opacity:0.4,padding:'14px 14px 6px',textTransform:'uppercase',letterSpacing:'0.14em'}}>{grp.label}</div>
                            {grp.items.map(item => {
                                const hasSub = item.subItems && item.subItems.length > 0;
                                const isExpanded = expandedGroups.includes(item.id);
                                const isActive = activeTab === item.id || activeTab.startsWith(`${item.id}_`);

                                return (
                                    <div key={item.id} className="ws-nav-group">
                                        <button 
                                            className={`ws-nav-btn ${isActive ? 'active' : ''}`} 
                                            onClick={() => hasSub ? toggleGroup(item.id) : setActiveTab(item.id)}
                                        >
                                            <item.icon size={17} color="#000000"/>
                                            <span>{item.label}</span>
                                            {item.badge > 0 && <span className="ws-nav-badge">{item.badge}</span>}
                                            {hasSub && (
                                                <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                                                    {isExpanded ? <ChevronDown size={14} color="#000000"/> : <ChevronRight size={14} color="#000000"/>}
                                                </div>
                                            )}
                                        </button>

                                        <AnimatePresence>
                                            {hasSub && isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                                    className="ws-nav-submenu"
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    {item.subItems.map(sub => (
                                                        <button 
                                                            key={sub.id} 
                                                            className={`ws-nav-sub-btn ${activeTab === sub.id ? 'active' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveTab(sub.id);
                                                            }}
                                                        >
                                                            <sub.icon size={14} color="#000000"/>
                                                            <span>{sub.label}</span>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info"><div className="ws-user-avatar">SP</div><div><p className="ws-user-name">{profileName}</p><p className="ws-user-role">{profileRole}</p></div></div>
                    <button className="ws-logout-btn" onClick={handleLogout}><LogOut size={16}/></button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar"><div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">Complete operations, stock, invoicing & accounting</p></div>
                    <div className="ws-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" className="btn-portal" style={{ background: '#2563EB', color: '#fff', border: 'none', fontSize: '0.8125rem', padding: '8px 14px' }} onClick={() => setActiveTab('sales_invoices')}><FileText size={14}/> New Sales Invoice</button>
                        <button type="button" className="btn-portal-outline" style={{ fontSize: '0.8125rem', padding: '8px 14px' }} onClick={() => setActiveTab('order_queue')}><ShoppingCart size={14}/> Order Queue</button>
                        <div className="ws-online-badge"><div className="ws-online-dot"/>Online</div>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>
        </div>
    );
}
