import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import UserProfileMenu from '../components/UserProfileMenu';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Package, Users, BadgeDollarSign, DollarSign, BookOpen,
    Bell, Search, ChevronDown, ChevronRight,
    Shield, Map, Truck, Building, UserCheck, Receipt, ArrowLeftRight, FileSpreadsheet,
    Landmark, FileText, Car, Warehouse, Box, ShoppingCart, UserPlus, Globe, Megaphone, Trophy,
    Menu, X, Percent, Wrench, GitBranch, Radio, BarChart2, ClipboardList
} from 'lucide-react';
import '../styles/AdminLayout.css';

const TRANSLATIONS = {
    en: {
        section: { CONTROL: 'CONTROL', OPERATIONS: 'OPERATIONS', FINANCE: 'FINANCE', SPECIALIZED: 'SPECIALIZED' },
        nav: {
            dashboard: 'Dashboard', reports: 'Reporting', pos: 'POS / New Order', approvals: 'Approvals', 'zone-management': 'Zone Management', 'tax-codes': 'Tax Code', permissions: 'Permissions', 'tier-management': 'Tier Management',
            inventory: 'Inventory', 'products-services': 'Products & Services', 'stock-movements': 'Stock Movements', categories: 'Categories', 'units-of-measure': 'Units of Measure',
            customers: 'Customers', 'all-customers': 'All Customers', 'corporate-billing': 'Corporate Billing',
            suppliers: 'Suppliers', employees: 'Employees', branches: 'Branches', workshop: 'Workshop',
            sales: 'Sales', 'workshop-sales': 'Workshop Sales', 'suppliers-warehouse-sales': 'Suppliers & Warehouse Sales', receipts: 'Receipts',
            'referral-commissions': 'Commission',
            commissions: 'Commission',
            'referral-commissions-rm': 'Referral Commissions',
            accounting: 'Accounting',
            'chart-of-accounts': 'Chart of Accounts',
            'cash-bank': 'Cash & Bank',
            'sales-reports': 'Sales Reports', 'sales-orders': 'Sales Orders',
            transactions: 'Transactions', 'journal-entries': 'Journal Entries', purchases: 'Purchases', expenses: 'Expenses', payments: 'Payments', advances: 'Advances', ledger: 'Ledger',
            marketing: 'Marketing',
            'fleet-management': 'Fleet Management', 'warehouse-portal': 'Warehouse Portal', 'locker-management': 'Locker Management',
            'workshop-portal': 'Filter Admin Workshop Portal', 'locker-portal': 'Filter Locker Portal', 'supplier-portal': 'Filter Supplier Portal', 'corporate-portal': 'Filter Corporate Portal', 'referrer-portal': 'Filter Referrer Portal', 'technician-app': 'Filter Technician Portal', 'pos-portal': 'Filter POS Portal'
        },
        logoDesc: 'FILTER ERP',
        pageSubtitle: 'Global operational control.',
        searchPlaceholder: 'Search resources...',
        userName: 'ASIF AL BHUTTO',
        userRole: 'SUPER ADMIN',
    },
    ar: {
        section: { CONTROL: 'التحكم', OPERATIONS: 'العمليات', FINANCE: 'المالية', SPECIALIZED: 'متخصص' },
        nav: {
            dashboard: 'لوحة التحكم', reports: 'التقارير', pos: 'نقطة البيع / طلب جديد', approvals: 'الموافقات', 'zone-management': 'إدارة المناطق', 'tax-codes': 'أكواد الضريبة', permissions: 'الصلاحيات', 'tier-management': 'إدارة الفئات',
            inventory: 'المخزون', 'products-services': 'المنتجات والخدمات', 'stock-movements': 'حركة المخزون', categories: 'الفئات', 'units-of-measure': 'وحدات القياس',
            customers: 'العملاء', 'all-customers': 'جميع العملاء', 'corporate-billing': 'الفواتير المؤسسية',
            suppliers: 'الموردون', employees: 'الموظفون', branches: 'الفروع', workshop: 'الورشة',
            sales: 'المبيعات', 'workshop-sales': 'مبيعات الورشة', 'suppliers-warehouse-sales': 'الموردون ومبيعات المستودع', receipts: 'الإيصالات',
            'referral-commissions': 'العمولات',
            commissions: 'العمولات',
            'referral-commissions-rm': 'عمولات الإحالة',
            accounting: 'المحاسبة',
            'chart-of-accounts': 'دليل الحسابات',
            'cash-bank': 'النقد والبنك',
            'sales-reports': 'تقارير المبيعات', 'sales-orders': 'طلبات المبيعات',
            transactions: 'المعاملات', 'journal-entries': 'قيد اليومية', purchases: 'المشتريات', expenses: 'المصروفات', payments: 'المدفوعات', advances: 'السلف', ledger: 'دفتر الأستاذ',
            marketing: 'التسويق',
            'fleet-management': 'إدارة الأسطول', 'warehouse-portal': 'بوابة المستودع', 'locker-management': 'إدارة الخزائن',
            'workshop-portal': 'بوابة فلتر لورشة العمل', 'locker-portal': 'بوابة فلتر للخزائن', 'supplier-portal': 'بوابة فلتر للموردين', 'corporate-portal': 'بوابة فلتر للمؤسسات', 'referrer-portal': 'بوابة فلتر للإحالة', 'technician-app': 'بوابة فلتر للفنيين', 'pos-portal': 'بوابة فلتر لنقاط البيع'
        },
        logoDesc: 'فلتر ERP',
        logoDesc: 'وحدة المشرف الأعلى',
        pageSubtitle: 'التحكم التشغيلي العالمي.',
        searchPlaceholder: 'البحث في الموارد...',
        userName: 'آسف البوتو',
        userRole: 'مشرف أعلى',
    },
};

const NAV_CONFIG = [
    {
        section: 'CONTROL',
        items: [
            { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
            { label: 'Approvals', path: 'approvals', icon: FileText },
            { label: 'Zone Management', path: 'zone-management', icon: Map },
            { label: 'Tier Management', path: 'tier-management', icon: Trophy },
            { label: 'Tax Codes', path: 'tax-codes', icon: Percent },
            { label: 'Marketing', path: 'marketing', icon: Megaphone },
            { label: 'Permissions', path: 'permissions', icon: Shield },
        ],
    },
    {
        section: 'OPERATIONS',
        items: [
            {
                label: 'Inventory',
                path: 'inventory',
                icon: Package,
                subItems: [
                    { label: 'Products & Services', path: 'products-services' },
                    { label: 'Stock Movements', path: 'stock-movements' },
                    { label: 'Categories', path: 'categories' },
                    { label: 'Units of Measure', path: 'units-of-measure' },
                ],
            },
            {
                label: 'Customers',
                path: 'customers',
                icon: Users,
                subItems: [
                    { label: 'All Customers', path: 'all-customers' },
                    { label: 'Corporate Billing', path: 'corporate-billing' },
                ],
            },
            { label: 'Suppliers', path: 'suppliers', icon: Truck },
            { label: 'Employees', path: 'employees', icon: UserCheck },
            { label: 'Branches', path: 'branches', icon: Building },
            { label: 'Workshop', path: 'workshop', icon: Wrench },
        ],
    },
    {
        section: 'FINANCE',
        items: [
            {
                label: 'Sales',
                path: 'sales',
                icon: BadgeDollarSign,
                subItems: [
                    { label: 'Sales Reports', path: 'sales-reports' },
                    { label: 'Sales Orders', path: 'sales-orders' },
                    { label: 'Workshop Sales', path: 'workshop-sales' },
                    { label: 'Suppliers & Warehouse Sales', path: 'suppliers-warehouse-sales' },
                    { label: 'Receipts', path: 'receipts' },
                ],
            },
            {
                label: 'Accounting',
                path: 'accounting',
                icon: Landmark,
                subItems: [
                    { label: 'Chart of Accounts', path: 'chart-of-accounts', icon: FileSpreadsheet },
                    { label: 'Cash & Bank', path: 'cash-bank', icon: Landmark },
                    { label: 'Commission', path: 'commissions', icon: DollarSign },
                    { label: 'Referral Commissions', path: 'referral-commissions-rm', icon: BadgeDollarSign },
                    { label: 'Transactions', path: 'transactions', icon: ArrowLeftRight },
                    { label: 'Journal Entries', path: 'journal-entries', icon: FileText },
                    { label: 'Purchases', path: 'purchases', icon: ShoppingCart },
                    { label: 'Expenses', path: 'expenses', icon: Package },
                    { label: 'Receipts', path: 'receipts', icon: Receipt },
                    { label: 'Payments', path: 'payments', icon: BadgeDollarSign },
                    { label: 'Advances', path: 'advances', icon: UserPlus },
                    { label: 'Ledger', path: 'ledger', icon: BookOpen },
                ],
            },
        ],
    },
    {
        section: 'SPECIALIZED',
        items: [
            { label: 'Filter POS Portal', path: 'pos-portal', icon: ShoppingCart, externalPath: '/pos' },
            { label: 'Filter Admin Workshop Portal', path: 'workshop-portal', icon: Wrench, externalPath: '/workshop' },
            { label: 'Filter Locker Portal', path: 'locker-portal', icon: Box, externalPath: '/locker' },
            { label: 'Filter Supplier Portal', path: 'supplier-portal', icon: Warehouse, externalPath: '/supplier' },
            { label: 'Filter Corporate Portal', path: 'corporate-portal', icon: Building, externalPath: '/corporate' },
            { label: 'Filter Referrer Portal', path: 'referrer-portal', icon: GitBranch, externalPath: '/referrer-portal' },
            { label: 'Filter Technician Portal', path: 'technician-app', icon: Radio, externalPath: '/technician' },
        ],
    },
];

const getNavLabel = (path, locale) => TRANSLATIONS[locale]?.nav[path] ?? TRANSLATIONS.en.nav[path] ?? path;

const SidebarNavItem = ({ item, basePath, locale }) => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const hasSub = item.subItems?.length > 0;
    const parentPath = `${basePath}/${item.path}`;
    const isParentActive = useLocation().pathname.startsWith('/admin/' + item.path);
    const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

    if (item.externalPath) {
        return (
            <div className="nav-group">
                <div className="nav-link" onClick={() => navigate(item.externalPath)} style={{ cursor: 'pointer' }}>
                    <item.icon size={20} />
                    <span className="nav-label">{getNavLabel(item.path, locale)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', background: 'rgba(0,0,0,0.08)', color: '#000000', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>→</span>
                </div>
            </div>
        );
    }

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
                                        to={`/admin/${item.path}/${sub.path}`}
                                        className={({ isActive }) => `nav-sub-link ${isActive ? 'active' : ''}`}
                                    >
                                        {sub.icon && <sub.icon size={16} className="sub-nav-icon" />}
                                        <span className="sub-nav-label">{getNavLabel(sub.path, locale)}</span>
                                    </NavLink>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            ) : (
                <NavLink
                    to={`/admin/${item.path}`}
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
    const segment = pathname.replace(/^\/admin\/?/, '').split('/');
    if (!segment[0]) return locale === 'ar' ? TRANSLATIONS.ar.nav.dashboard : 'Dashboard';
    const last = segment[segment.length - 1];
    const label = getNavLabel(last, locale);
    return label;
};

import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [locale, setLocale] = useState(() => localStorage.getItem('portal-locale') || 'en');
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const dir = locale === 'ar' ? 'rtl' : 'ltr';
        const lang = locale === 'ar' ? 'ar' : 'en';
        document.documentElement.dir = dir;
        document.documentElement.lang = lang;
        localStorage.setItem('portal-locale', locale);
    }, [locale]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const pageTitle = getPageTitle(location.pathname, locale);
    const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

    const userDisplayName = user?.name || t.userName;
    const userDisplayRole = user?.adminRole ? user.adminRole.replace('_', ' ').toUpperCase() : t.userRole;
    const userInitials = userDisplayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

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
                    <h2 className="logo-main">FILTER <span className="logo-sub">ERP</span></h2>
                    <p className="logo-desc">{t.logoDesc}</p>
                </div>
                <nav className="sidebar-nav">
                    {NAV_CONFIG.map((sec) => (
                        <div key={sec.section}>
                            <div className="sidebar-section-label">{t.section[sec.section]}</div>
                            {sec.items.map((item) => (
                                <SidebarNavItem key={item.path} item={item} basePath="/admin" locale={locale} />
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div
                        className={`user-pill ${isUserMenuOpen ? 'menu-open' : ''}`}
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                        <div className="user-avatar">{userInitials}</div>
                        <div className="user-details">
                            <p className="user-name">{userDisplayName}</p>
                            <p className="user-role">{userDisplayRole}</p>
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
                        <div className="header-lang-switcher">
                            <span className="lang-label"><Globe size={16} /></span>
                            <button type="button" className={`lang-btn ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>EN</button>
                            <button type="button" className={`lang-btn lang-btn-ar ${locale === 'ar' ? 'active' : ''}`} onClick={() => setLocale('ar')}>العربية</button>
                        </div>
                        <div className="top-bar-divider" />
                        <div className="notification-icon">
                            <span className="notification-dot" />
                            <Bell color="#6C757D" />
                        </div>
                    </div>
                </header>
                <Outlet />
            </main>
        </div>
    );
}
