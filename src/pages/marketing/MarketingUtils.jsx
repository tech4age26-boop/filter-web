import React, { useState, useEffect } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const INITIAL_PROMOTIONS = [
    { id: 1, name: 'Eid15%', strategy: 'Percentage Discount', usage: '124/500', status: 'Active', value: '15', type: 'percentage' },
    { id: 2, name: 'Weekend Deal', strategy: 'Zone Wise', usage: '45/100', status: 'Active', value: '50', type: 'fixed' },
    { id: 3, name: 'Oil Change Special', strategy: 'Seasonal', usage: '89/200', status: 'Paused', value: '25', type: 'percentage' }
];

export const INITIAL_PROMO_CODES = [
    { id: 1, code: 'OFF50', discount: '50 SAR', status: 'Active', usage: '45/100', expiry: '2024-12-31' },
    { id: 2, code: 'WELCOME20', discount: '20%', status: 'Active', usage: '120/500', expiry: '2024-06-30' },
    { id: 3, code: 'EID2024', discount: '15%', status: 'Expired', usage: '500/500', expiry: '2024-04-10' }
];

export const INITIAL_REFERRERS = [
    { id: 1, name: 'Ahmed Khan', cat: 'Influencer', rate: '5%', earned: 2450, paid: 2000, bal: 450, mobile: '+966 50 123 4567', email: 'ahmed@email.com', status: 'Active' },
    { id: 2, name: 'Riyadh Car Club', cat: 'Corporate Partner', rate: '10%', earned: 8900, paid: 7500, bal: 1400, mobile: '+966 55 987 6543', email: 'rcc@email.com', status: 'Active' },
    { id: 3, name: 'Sara Miller', cat: 'Individual', rate: '2.5%', earned: 1200, paid: 1200, bal: 0, mobile: '+966 53 444 5555', email: 'sara@email.com', status: 'Active' }
];

export const INITIAL_REFERRAL_CODES = [
    { id: 1, code: 'CORP-HNMTE', type: 'corporate', typeLabel: 'Corporate Referral', referrerName: 'Ahmed Khan', status: 'Active' },
    { id: 2, code: 'REF-XYZ12', type: 'walk-in', typeLabel: 'Walk-in Referral', referrerName: 'Jane Smith', status: 'Active' }
];

export const INITIAL_LOYALTY_TIERS = [
    { id: 1, tier: 'Bronze', color: 'bronze', points: '0 - 1,000', perks: '3% Points back, 1 Free Wash/yr', minPoints: 0, discount: 3 },
    { id: 2, tier: 'Silver', color: 'silver', points: '1,001 - 5,000', perks: '5% Points back, 2 Free Washes/yr', minPoints: 1001, discount: 5 },
    { id: 3, tier: 'Gold', color: 'gold', points: '5,001 - 15,000', perks: '10% Points back, Priority Service', minPoints: 5001, discount: 10 },
    { id: 4, tier: 'Platinum', color: 'platinum', points: '15,000+', perks: '15% Points back, Concierge pickup', minPoints: 15001, discount: 15 }
];

export const INITIAL_LOYALTY_PROGRAM = {
    name: 'FILTER Rewards',
    pointsPerSpent: 1,
    pointsPerDiscount: 100,
    minRedeem: 500,
    desc: 'Reward your most loyal customers with points and exclusive perks.'
};

export const MarketingContext = React.createContext();

export const MarketingProvider = ({ children }) => {
    const [promotions, setPromotions] = useState(INITIAL_PROMOTIONS);
    const [promoCodes, setPromoCodes] = useState(INITIAL_PROMO_CODES);
    const [referrers, setReferrers] = useState(INITIAL_REFERRERS);
    const [referralCodes, setReferralCodes] = useState(INITIAL_REFERRAL_CODES);
    const [loyaltyTiers, setLoyaltyTiers] = useState(INITIAL_LOYALTY_TIERS);
    const [loyaltyProgram, setLoyaltyProgram] = useState(INITIAL_LOYALTY_PROGRAM);

    const value = {
        promotions, setPromotions,
        promoCodes, setPromoCodes,
        referrers, setReferrers,
        referralCodes, setReferralCodes,
        loyaltyTiers, setLoyaltyTiers,
        loyaltyProgram, setLoyaltyProgram
    };

    return (
        <MarketingContext.Provider value={value}>
            {children}
        </MarketingContext.Provider>
    );
};

export const useMarketingState = () => {
    const context = React.useContext(MarketingContext);
    if (!context) {
        throw new Error('useMarketingState must be used within a MarketingProvider');
    }
    return context;
};


export const StatCardMini = ({ title, value, icon: Icon, trend }) => (
    <div className="dashboard-stat-card">
        <div className="dashboard-stat-content">
            <p className="dashboard-stat-label">{title}</p>
            <h3 className="dashboard-stat-value">{value}</h3>
            {trend && <p className="dashboard-stat-subtitle" style={{ color: trend.startsWith('+') ? '#10B981' : '#6B7280' }}>
                {trend} <span style={{ color: '#6B7280' }}>this month</span>
            </p>}
        </div>
        <div className="icon-wrapper">
            <Icon size={20} />
        </div>
    </div>
);

export const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder = "Select options..." }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">{label}</label>
            <div
                className="form-input-field"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    minHeight: '44px',
                    height: 'auto',
                    padding: '8px 16px'
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selected.length === 0 ? (
                        <span style={{ color: '#9CA3AF' }}>{placeholder}</span>
                    ) : (
                        selected.map(opt => (
                            <span
                                key={opt}
                                style={{
                                    background: 'rgba(255, 215, 0, 0.1)',
                                    color: 'var(--color-primary)',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    border: '1px solid rgba(255, 215, 0, 0.2)'
                                }}
                            >
                                {opt}
                            </span>
                        ))
                    )}
                </div>
                <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : '' }} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 999,
                                background: 'white',
                                borderRadius: '12px',
                                marginTop: '8px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #F3F4F6',
                                padding: '8px',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}
                        >
                            {options.map(opt => (
                                <div
                                    key={opt}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const next = selected.includes(opt)
                                            ? selected.filter(s => s !== opt)
                                            : [...selected, opt];
                                        onChange(next);
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#F9FAFB'}
                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(opt)}
                                        readOnly
                                        style={{ accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                                    />
                                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{opt}</span>
                                </div>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export const generateCode = (prefix = '', length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    return prefix ? `${prefix}-${random}` : random;
};
