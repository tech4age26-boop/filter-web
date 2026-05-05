import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import UserProfileMenu from '../components/UserProfileMenu';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Megaphone, Ticket, Users, FileText, Gift, LineChart,
    Bell, Search, ChevronDown, ChevronRight, Globe, Plus, Menu, X, Shield
} from 'lucide-react';
import '../styles/AdminLayout.css';
import './marketing/Marketing.css';
import { useMarketingState } from './marketing/MarketingUtils';
import { getWorkshops } from '../services/superAdminApi';

function normalizeWorkshopsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    return [];
}

const TRANSLATIONS = {
    en: {
        section: { MARKETING: 'MARKETING & CARE', INSIGHTS: 'INSIGHTS & ANALYTICS' },
        nav: {
            dashboard: 'Dashboard',
            promotions: 'Promotions',
            'promo-codes': 'Promo Codes',
            'referral-management': 'Referral Management',
            'referral-types-rules': 'Referral Types + Rules',
            'loyalty-programs': 'Loyalty Programs',
            'customer-insights': 'Customer Insights',
        },
        logoDesc: 'MARKETING & CARE UNIT',
        pageSubtitle: 'Engagement and retention control.',
        searchPlaceholder: 'Search marketing data...',
        userName: 'MARKETING ADMIN',
        userRole: 'PORTAL MANAGER',
    },
    ar: {
        section: { MARKETING: 'التسويق والعناية', INSIGHTS: 'الرؤى والتحليلات' },
        nav: {
            dashboard: 'لوحة التحكم',
            promotions: 'العروض الترويجية',
            'promo-codes': 'أكواد الخصم',
            'referral-management': 'إدارة الإحالة',
            'referral-types-rules': 'أنواع الإحالة + القواعد',
            'loyalty-programs': 'برامج الولاء',
            'customer-insights': 'رؤى العملاء',
        },
        logoDesc: 'وحدة التسويق والعناية',
        pageSubtitle: 'التحكم في المشاركة والاحتفاظ.',
        searchPlaceholder: 'البحث في بيانات التسويق...',
        userName: 'مدير التسويق',
        userRole: 'مدير البوابة',
    },
};

const NAV_CONFIG = [
    {
        section: 'MARKETING',
        items: [
            { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
            { label: 'Promotions', path: 'promotions', icon: Megaphone },
            { label: 'Promo Codes', path: 'promo-codes', icon: Ticket },
            { label: 'Referral Management', path: 'referral-management', icon: Users },
            { label: 'Referral Types + Rules', path: 'referral-types-rules', icon: Shield },
            { label: 'Loyalty Programs', path: 'loyalty-programs', icon: Gift },
        ],
    },
    {
        section: 'INSIGHTS',
        items: [
            { label: 'Customer Insights', path: 'customer-insights', icon: LineChart },
        ],
    },
];

const getNavLabel = (path, locale) => TRANSLATIONS[locale]?.nav[path] ?? TRANSLATIONS.en.nav[path] ?? path;

const SidebarNavItem = ({ item, basePath, locale }) => {
    const [open, setOpen] = useState(false);
    const hasSub = item.subItems?.length > 0;
    const isParentActive = useLocation().pathname.startsWith(basePath + '/' + item.path);

    return (
        <div className="nav-group">
            {hasSub ? (
                <>
                    <div
                        className={`nav-link ${isParentActive ? 'active' : ''}`}
                        onClick={() => setOpen(!open)}
                    >
                        <div className="flex items-center gap-4">
                            <item.icon size={20} />
                            <span className="nav-label">{getNavLabel(item.path, locale)}</span>
                        </div>
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <AnimatePresence>
                        {open && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="nav-submenu"
                            >
                                {item.subItems.map((sub) => (
                                    <NavLink
                                        key={sub.path}
                                        to={`${basePath}/${item.path}/${sub.path}`}
                                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                                    >
                                        {getNavLabel(sub.path, locale)}
                                    </NavLink>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            ) : (
                <NavLink
                    to={item.isExternal ? `/${item.path}` : `${basePath}/${item.path}`}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                    <item.icon size={20} />
                    <span className="nav-label">{getNavLabel(item.path, locale)}</span>
                </NavLink>
            )}
        </div>
    );
};

const getPageTitle = (pathname, locale) => {
    const segment = pathname.replace(/^\/marketing\/?/, '').split('/');
    if (!segment[0]) return locale === 'ar' ? TRANSLATIONS.ar.nav.dashboard : 'Dashboard';
    const last = segment[segment.length - 1];
    const label = getNavLabel(last, locale);
    return locale === 'ar' ? label : last.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export default function MarketingLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [locale, setLocale] = useState(() => localStorage.getItem('marketing-locale') || 'en');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [workshops, setWorkshops] = useState([]);
    const [marketingWorkshopId, setMarketingWorkshopId] = useState('');

    useEffect(() => {
        getWorkshops({ limit: '200', offset: '0' })
            .then((data) => setWorkshops(normalizeWorkshopsPayload(data)))
            .catch(() => setWorkshops([]));
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('portal-locale');
        localStorage.removeItem('marketing-locale');
        navigate('/');
    };

    // Sync States (centralized hook)
    const {
        promotions, setPromotions,
        promoCodes, setPromoCodes,
        referrers, setReferrers,
        referralCodes, setReferralCodes,
        loyaltyTiers, setLoyaltyTiers,
        loyaltyProgram, setLoyaltyProgram
    } = useMarketingState();

    useEffect(() => {
        const dir = locale === 'ar' ? 'rtl' : 'ltr';
        const lang = locale === 'ar' ? 'ar' : 'en';
        document.documentElement.dir = dir;
        document.documentElement.lang = lang;
        localStorage.setItem('marketing-locale', locale);
    }, [locale]);

    const pageTitle = getPageTitle(location.pathname, locale);
    const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

    const isDashboard = location.pathname.includes('/dashboard');
    const isInsights = location.pathname.includes('/customer-insights');

    return (
        <div className={`admin-layout ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="sidebar-overlay"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </AnimatePresence>

            <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <h2 className="logo-main">FILTER <span className="logo-sub">POS</span></h2>
                    <p className="logo-desc">{t.logoDesc}</p>
                </div>
                <nav className="sidebar-nav">
                    {NAV_CONFIG.map((sec) => (
                        <div key={sec.section}>
                            <div className="sidebar-section-label">{t.section[sec.section]}</div>
                            {sec.items.map((item) => (
                                <SidebarNavItem key={item.path} item={item} basePath="/marketing" locale={locale} />
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="sidebar-footer">

                    <div
                        className={`user-pill ${isUserMenuOpen ? 'menu-open' : ''}`}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                        <div className="user-avatar">MA</div>
                        <div className="user-details">
                            <p className="user-name">{t.userName}</p>
                            <p className="user-role">{t.userRole}</p>
                        </div>
                        <ChevronDown className="user-menu-chevron" size={14} />

                        <UserProfileMenu
                            isOpen={isUserMenuOpen}
                            onClose={() => setIsUserMenuOpen(false)}
                            onLogout={handleLogout}
                            locale={locale}
                        />
                    </div>
                </div>
            </aside>
            <main className="main-content">
                <header className="top-bar">
                    <div className="header-info">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                className="mobile-menu-toggle"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                            <div>
                                <h1 className="page-title">{locale === 'ar' ? pageTitle : pageTitle.toUpperCase()}</h1>
                                <p className="page-subtitle">{t.pageSubtitle}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                            {locale === 'ar' ? 'نطاق الورشة' : 'Workshop scope'}
                            <select
                                className="form-input-field"
                                style={{ minWidth: 180, height: 38, fontWeight: 600, fontSize: '0.8rem' }}
                                value={marketingWorkshopId}
                                onChange={(e) => setMarketingWorkshopId(e.target.value)}
                            >
                                <option value="">{locale === 'ar' ? 'كل الورش' : 'All workshops'}</option>
                                {workshops.map((w) => {
                                    const id = w.id ?? w._id ?? w.workshopId;
                                    if (id == null) return null;
                                    return (
                                        <option key={String(id)} value={String(id)}>
                                            {w.name || `Workshop ${id}`}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                        {!isDashboard && !isInsights && (
                            <button
                                className="btn-portal"
                                onClick={() => setShowAddModal(true)}
                            >
                                <Plus size={18} /> {locale === 'ar' ? 'إضافة جديد' : 'ADD NEW'}
                            </button>
                        )}
                        <div className="header-lang-switcher">
                            <span className="lang-label"><Globe size={16} /></span>
                            <button type="button" className={`lang-btn ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>EN</button>
                            <button type="button" className={`lang-btn ${locale === 'ar' ? 'active' : ''}`} onClick={() => setLocale('ar')}>العربية</button>
                        </div>
                        <div className="top-bar-divider" />
                        <div className="notification-icon">
                            <span className="notification-dot" />
                            <Bell color="#6C757D" />
                        </div>
                    </div>
                </header>
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
            </main>
        </div>
    );
}
