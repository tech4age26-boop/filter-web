import {
    LayoutDashboard, UserPlus, Users, Wallet,
    PieChart, Bell, Settings,
} from 'lucide-react';

/**
 * Navigation for the referrer portal.
 *
 * The MOCK_* fixtures that used to live here (MOCK_REFERRER, MOCK_STATS,
 * MOCK_REFERRALS, MOCK_NOTIFICATIONS, MOCK_TRANSACTIONS, MOCK_PAYOUTS,
 * CHART_DATA) have been removed. Every screen now loads the signed-in
 * referrer's own data from /referrer/me/* — see services/referrerPortalApi.js.
 *
 * They were not harmless placeholders: each account saw the same invented
 * balances (45,750 SAR earned, 12,300 available) under someone else's name.
 */
export const REFERRER_NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add_referral', label: 'Add Referral', icon: UserPlus },
    { id: 'my_referrals', label: 'My Referrals', icon: Users },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: PieChart },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
];
