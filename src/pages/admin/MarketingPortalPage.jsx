import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import '../../styles/admin/MarketingPortalPage.css';
import '../marketing/Marketing.css';
import { useMarketingState } from '../marketing/MarketingUtils';

const SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard', path: 'dashboard' },
    { id: 'promotions', label: 'Promotions', path: 'promotions' },
    { id: 'promo-codes', label: 'Promo Codes', path: 'promo-codes' },
    { id: 'referral-management', label: 'Referral Management', path: '/referral-management' },
    { id: 'referral-types-rules', label: 'Referral Types + Rules', path: 'referral-types-rules' },
    { id: 'loyalty-programs', label: 'Loyalty Programs', path: 'loyalty-programs' },
    { id: 'customer-insights', label: 'Customer Insights', path: 'customer-insights' },
];

export default function MarketingPortalPage() {
    const location = useLocation();
    const [showAddModal, setShowAddModal] = useState(false);

    // Sync States (centralized hook)
    const {
        promotions, setPromotions,
        promoCodes, setPromoCodes,
        referrers, setReferrers,
        referralCodes, setReferralCodes,
        loyaltyTiers, setLoyaltyTiers,
        loyaltyProgram, setLoyaltyProgram
    } = useMarketingState();

    const currentTab = SUB_TABS.find(t => location.pathname.endsWith(t.path)) || SUB_TABS[0];
    const activeLabel = currentTab.label;
    const isDashboard = currentTab.id === 'dashboard';
    const isInsights = currentTab.id === 'customer-insights';

    return (
        <div className="marketing-portal-page module-container">
            <div className="marketing-sub-nav">
                {SUB_TABS.map((t) => (
                    <NavLink
                        key={t.id}
                        to={t.path.startsWith('/') ? t.path : `/admin/marketing/${t.path}`}
                        className={({ isActive }) => `marketing-sub-tab ${isActive ? 'active' : ''}`}
                        onClick={() => setShowAddModal(false)}
                    >
                        {t.label}
                    </NavLink>
                ))}
            </div>

            <header className="marketing-page-header">
                <div>
                    <h1 className="marketing-title">{activeLabel}</h1>
                    <p className="marketing-subtitle">Marketing and customer engagement control.</p>
                </div>
                {!isDashboard && !isInsights && currentTab.id !== 'referral-codes' && (
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={16} /> Add {activeLabel.replace(/s$/, '')}
                    </button>
                )}
            </header>

            <div className="marketing-content">
                <Outlet context={{
                    showAddModal, setShowAddModal,
                    promotions, setPromotions,
                    promoCodes, setPromoCodes,
                    referrers, setReferrers,
                    referralCodes, setReferralCodes,
                    loyaltyTiers, setLoyaltyTiers,
                    loyaltyProgram, setLoyaltyProgram
                }} />
            </div>
        </div>
    );
}
