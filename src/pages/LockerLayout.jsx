import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DollarSign, ArrowLeft, LogOut } from 'lucide-react';
import { NAV_ITEMS } from './locker/constants';
import LockerDashboard from './locker/LockerDashboard';
import PendingRequests from './locker/PendingRequests';
import RecordCollection from './locker/RecordCollection';
import ApprovalsScreen from './locker/ApprovalsScreen';
import CollectionsHistory from './locker/CollectionsHistory';
import DifferencesReport from './locker/DifferencesReport';
import PettyCash from './locker/PettyCash';
import './workshop/Workshop.css';

export default function LockerLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    // Sync activeTab with URL: /locker/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const setActiveTab = (tab) => {
        navigate(`/locker/${tab}`);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <LockerDashboard onTabChange={setActiveTab}/>;
            case 'pending': return <PendingRequests/>;
            case 'record': return <RecordCollection/>;
            case 'approvals': return <ApprovalsScreen/>;
            case 'history': return <CollectionsHistory/>;
            case 'differences': return <DifferencesReport/>;
            case 'petty_cash': return <PettyCash/>;
            default: return <LockerDashboard onTabChange={setActiveTab}/>;
        }
    };

    const currentLabel = NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo"><div className="ws-logo-icon"><DollarSign size={20}/></div><div><p className="ws-logo-title">Filter Locker</p><p className="ws-logo-sub">Portal</p></div></div>
                <a className="ws-back-link" onClick={() => navigate('/admin/dashboard')} style={{cursor:'pointer'}}><ArrowLeft size={14}/> Back to Super Admin</a>
                <nav className="ws-nav">
                    {NAV_ITEMS.map(item => (
                        <button key={item.id} className={`ws-nav-btn ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
                            <item.icon size={17}/><span>{item.label}</span>
                            {item.badge > 0 && <span className="ws-nav-badge">{item.badge}</span>}
                        </button>
                    ))}
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info"><div className="ws-user-avatar">LM</div><div><p className="ws-user-name">Locker Admin</p><p className="ws-user-role">Cash Operations</p></div></div>
                    <button className="ws-logout-btn" onClick={() => navigate('/')}><LogOut size={16}/></button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar"><div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">Locker Management Portal</p></div><div className="ws-topbar-right"><div className="ws-online-badge"><div className="ws-online-dot"/>Online</div></div></header>
                <main className="ws-content">{renderContent()}</main>
            </div>
        </div>
    );
}
