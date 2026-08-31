import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, User, LogOut } from 'lucide-react';

/**
 * Account menu in the sidebar footer.
 *
 * Settings and Profile render only when the host layout supplies a handler.
 * They previously always rendered and only called console.log, so in every
 * portal they looked clickable and did nothing — and there is no settings or
 * profile route outside the referrer portal to point them at. A menu item that
 * goes nowhere is worse than one that isn't there.
 */
const UserProfileMenu = ({ isOpen, onClose, onLogout, onSettings, onProfile, locale = 'en' }) => {
    const t = {
        en: { settings: 'Settings', profile: 'Profile', logout: 'Logout' },
        ar: { settings: 'الإعدادات', profile: 'الملف الشخصي', logout: 'تسجيل الخروج' }
    };

    const currentT = t[locale] || t.en;

    const run = (handler) => (e) => {
        e.stopPropagation();
        onClose();
        handler?.();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="user-profile-menu"
                >
                    {onSettings && (
                        <button className="user-menu-item" onClick={run(onSettings)}>
                            <Settings size={16} />
                            <span>{currentT.settings}</span>
                        </button>
                    )}

                    {onProfile && (
                        <button className="user-menu-item" onClick={run(onProfile)}>
                            <User size={16} />
                            <span>{currentT.profile}</span>
                        </button>
                    )}

                    {(onSettings || onProfile) && <div className="user-menu-divider" />}

                    <button className="user-menu-item logout" onClick={run(onLogout)}>
                        <LogOut size={16} />
                        <span>{currentT.logout}</span>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default UserProfileMenu;
