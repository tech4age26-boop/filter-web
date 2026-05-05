import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import '../../styles/admin/MarketingPortalPage.css';
import '../marketing/Marketing.css';
import { useMarketingState } from '../marketing/MarketingUtils';
import { getWorkshops } from '../../services/superAdminApi';

function normalizeWorkshopsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    return [];
}

const SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard', path: 'dashboard' },
    { id: 'promotions', label: 'Promotions', path: 'promotions' },
    { id: 'promo-codes', label: 'Promo Codes', path: 'promo-codes' },
    { id: 'referral-management', label: 'Referral Management', path: 'referral-management' },
    { id: 'referral-types-rules', label: 'Referral Types + Rules', path: 'referral-types-rules' },
    { id: 'loyalty-programs', label: 'Loyalty Programs', path: 'loyalty-programs' },
    { id: 'customer-insights', label: 'Customer Insights', path: 'customer-insights' },
];

export default function MarketingPortalPage() {
    const location = useLocation();
    const [showAddModal, setShowAddModal] = useState(false);
    const [workshops, setWorkshops] = useState([]);
    const [marketingWorkshopId, setMarketingWorkshopId] = useState('');

    useEffect(() => {
        getWorkshops({ limit: '200', offset: '0' })
            .then((data) => setWorkshops(normalizeWorkshopsPayload(data)))
            .catch(() => setWorkshops([]));
    }, []);

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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <label className="marketing-workshop-scope" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>
                        Workshop scope
                        <select
                            className="form-input-field"
                            style={{ minWidth: 200, height: 40, fontWeight: 600 }}
                            value={marketingWorkshopId}
                            onChange={(e) => setMarketingWorkshopId(e.target.value)}
                        >
                            <option value="">All workshops (system)</option>
                            {workshops.map((w) => {
                                const id = w.id ?? w._id ?? w.workshopId;
                                if (id == null) return null;
                                return (
                                    <option key={String(id)} value={String(id)}>
                                        {w.name || w.workshopName || `Workshop ${id}`}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    {!isDashboard && !isInsights && currentTab.id !== 'referral-codes' && currentTab.id !== 'referral-management' && currentTab.id !== 'referral-types-rules' && (
                        <button
                            type="button"
                            className="btn-portal"
                            onClick={() => setShowAddModal(true)}
                        >
                            <Plus size={16} /> Add {activeLabel.replace(/s$/, '')}
                        </button>
                    )}
                </div>
            </header>

            <div className="marketing-content">
                <Outlet context={{
                    showAddModal, setShowAddModal,
                    promotions, setPromotions,
                    promoCodes, setPromoCodes,
                    referrers, setReferrers,
                    referralCodes, setReferralCodes,
                    loyaltyTiers, setLoyaltyTiers,
                    loyaltyProgram, setLoyaltyProgram,
                    marketingWorkshopId,
                    setMarketingWorkshopId,
                    workshops,
                }} />
            </div>
        </div>
    );
}
