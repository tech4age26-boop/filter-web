import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, 
    Wrench, 
    Monitor, 
    UserCheck, 
    Package, 
    Share2, 
    Box, 
    ArrowRight,
    Lock,
    PackageCheck
} from 'lucide-react';
import { publicReceiveSupplierSalesInvoiceWithPassword } from '../services/publicVerifyApi';
import '../styles/SignInPage.css'; // Reusing branding styles

const PORTALS = [
    {
        id: 'corporate',
        name: 'Filter Corporate Portal',
        description: 'Fleet management, billing, and company account controls for corporate clients.',
        icon: Building2,
        color: '#8B5CF6', // Purple
    },
    {
        id: 'workshop',
        name: 'Filter Admin Workshop Portal',
        description: 'Internal management for service centers, inventory, and technician assignment.',
        icon: Wrench,
        color: '#059669', // Emerald
    },
    {
        id: 'pos',
        name: 'Filter POS Portal',
        description: 'Point of Sale system for front-desk operations and instant invoicing.',
        icon: Monitor,
        color: '#3B82F6', // Blue
    },
    {
        id: 'technician',
        name: 'Filter Technician Portal',
        description: 'Real-time job tracking, service checklists, and quality assurance for our mechanics.',
        icon: UserCheck,
        color: '#D97706', // Amber
    },
    {
        id: 'locker',
        name: 'Filter Locker Portal',
        description: 'Secure terminal management for our contactless vehicle drop-off/pick-up points.',
        icon: Box,
        color: '#DC2626', // Red
    },
    {
        id: 'supplier',
        name: 'Filter Supplier Portal',
        description: 'Inventory supply chain management and warehouse procurement system.',
        icon: Package,
        color: '#4B5563', // Gray
    },
    {
        id: 'referrer-portal',
        name: 'Filter Referrer Portal',
        description: 'Track referrals, manage earnings, and see client conversion metrics.',
        icon: Share2,
        color: '#EC4899', // Pink
    }
];

export default function PortalHubPage() {
    const navigate = useNavigate();
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [receiveInvoiceId, setReceiveInvoiceId] = useState('');
    const [receivePassword, setReceivePassword] = useState('');
    const [receiveSubmitting, setReceiveSubmitting] = useState(false);
    const [receiveError, setReceiveError] = useState('');
    const [receiveResult, setReceiveResult] = useState(null);

    const closeReceiveModal = () => {
        if (receiveSubmitting) return;
        setReceiveOpen(false);
        setReceiveInvoiceId('');
        setReceivePassword('');
        setReceiveError('');
        setReceiveResult(null);
    };

    const handleReceiveSubmit = async (e) => {
        e?.preventDefault?.();
        if (receiveSubmitting) return;
        const id = String(receiveInvoiceId || '').trim();
        if (!id) {
            setReceiveError('Enter the supplier invoice number / id printed on the invoice.');
            return;
        }
        if (!receivePassword.trim()) {
            setReceiveError('Enter the workshop or branch password.');
            return;
        }
        setReceiveSubmitting(true);
        setReceiveError('');
        setReceiveResult(null);
        try {
            const res = await publicReceiveSupplierSalesInvoiceWithPassword(id, receivePassword);
            setReceiveResult(res);
            setReceivePassword('');
        } catch (err) {
            setReceiveError(err?.message || 'Could not authenticate. Check the invoice id and password.');
        } finally {
            setReceiveSubmitting(false);
        }
    };

    return (
        <div className="signin-container" style={{ overflowY: 'auto', padding: '40px 20px' }}>
            <div className="hub-content" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                
                {/* Header Section */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <h1 className="brand-main-title" style={{ fontSize: '3.5rem', marginBottom: '12px' }}>
                        FILTER <span>HUB</span>
                    </h1>
                    <p className="brand-subtitle" style={{ maxWidth: '700px', margin: '0 auto', fontSize: '1.1rem' }}>
                        Select your destination portal below. Secure access to the Filter Services management ecosystem. 
                        Professional tools for every part of the journey.
                    </p>
                </motion.div>

                {/* Portals Grid */}
                <div className="portals-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
                    gap: '24px',
                    paddingBottom: '40px'
                }}>
                    {PORTALS.map((portal, index) => (
                        <motion.div
                            key={portal.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            whileHover={{ y: -8 }}
                            className="portal-card"
                            onClick={() => navigate(`/${portal.id}/login`)}
                            style={{
                                background: 'white',
                                borderRadius: '24px',
                                padding: '32px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                border: '1px solid rgba(0,0,0,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {/* Accent Background */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '120px',
                                height: '120px',
                                background: `${portal.color}08`,
                                borderRadius: '0 0 0 100%',
                                zIndex: 0
                            }} />

                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ 
                                    width: '56px', 
                                    height: '56px', 
                                    borderRadius: '16px', 
                                    background: `${portal.color}15`, 
                                    color: portal.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '24px'
                                }}>
                                    <portal.icon size={28} />
                                </div>

                                <h3 style={{ 
                                    fontSize: '1.5rem', 
                                    fontWeight: '800', 
                                    color: '#111827', 
                                    marginBottom: '12px' 
                                }}>
                                    {portal.name}
                                </h3>
                                
                                <p style={{ 
                                    color: '#6B7280', 
                                    lineHeight: '1.6', 
                                    fontSize: '0.9375rem',
                                    marginBottom: '32px',
                                    flexGrow: 1
                                }}>
                                    {portal.description}
                                </p>

                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    fontWeight: '700',
                                    color: portal.color,
                                    fontSize: '0.875rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    <span>Access Portal</span>
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Admin Access Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    style={{ 
                        textAlign: 'center', 
                        marginTop: '40px', 
                        padding: '30px',
                        borderTop: '1px solid rgba(0,0,0,0.08)'
                    }}
                >
                    <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setReceiveOpen(true);
                                setReceiveError('');
                                setReceiveResult(null);
                            }}
                            style={{
                                background: '#059669',
                                border: '1px solid #047857',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.875rem',
                                fontWeight: '700',
                                color: '#fff',
                                transition: 'all 0.2s',
                                boxShadow: '0 6px 16px rgba(5,150,105,0.25)',
                            }}
                        >
                            <PackageCheck size={16} />
                            Received (workshop)
                        </button>
                        <button
                            onClick={() => navigate('/admin/login')}
                            style={{
                                background: 'transparent',
                                border: '1px solid #E5E7EB',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#6B7280',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Lock size={14} />
                            Filter ERP Access
                        </button>
                    </div>
                    <p style={{ marginTop: '16px', fontSize: '0.75rem', color: '#9CA3AF' }}>
                        “Received” authenticates a workshop password and updates branch inventory for a supplier
                        invoice. ERP access is restricted to administrative staff only.
                    </p>
                </motion.div>
            </div>

            {receiveOpen ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Workshop receives supplier invoice"
                    onClick={closeReceiveModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        zIndex: 50,
                    }}
                >
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleReceiveSubmit}
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            width: '100%',
                            maxWidth: 420,
                            padding: 24,
                            boxShadow: '0 20px 50px rgba(2,6,23,0.35)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <PackageCheck size={22} style={{ color: '#059669' }} />
                            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                Mark supplier invoice as received
                            </h2>
                        </div>
                        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.45 }}>
                            Enter the supplier invoice id (printed on the invoice / QR) and either the branch login
                            password or workshop owner / admin password. On success, branch inventory is updated.
                        </p>

                        {receiveResult ? (
                            <div
                                style={{
                                    marginBottom: 14,
                                    padding: 12,
                                    borderRadius: 10,
                                    background: '#ECFDF5',
                                    border: '1px solid #A7F3D0',
                                    color: '#065F46',
                                    fontSize: '0.8125rem',
                                }}
                            >
                                <strong style={{ display: 'block', marginBottom: 4 }}>
                                    {receiveResult.alreadyReceivedBefore ? 'Already received' : 'Inventory updated'}
                                </strong>
                                {receiveResult.message ||
                                    'Branch inventory has been updated for this invoice.'}
                                {receiveResult.invoiceNumber ? (
                                    <div style={{ marginTop: 6, color: '#047857' }}>
                                        Invoice: <strong>{receiveResult.invoiceNumber}</strong>
                                        {receiveResult.branchName ? ` · ${receiveResult.branchName}` : ''}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <label
                            htmlFor="hub-receive-invoice"
                            style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#334155',
                                marginBottom: 6,
                            }}
                        >
                            Supplier invoice id / number
                        </label>
                        <input
                            id="hub-receive-invoice"
                            type="text"
                            value={receiveInvoiceId}
                            onChange={(e) => setReceiveInvoiceId(e.target.value)}
                            disabled={receiveSubmitting}
                            placeholder="e.g. 12345 or SI-2026-0001"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                fontSize: '0.9375rem',
                                outline: 'none',
                                marginBottom: 12,
                            }}
                        />

                        <label
                            htmlFor="hub-receive-password"
                            style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#334155',
                                marginBottom: 6,
                            }}
                        >
                            Workshop / branch password
                        </label>
                        <input
                            id="hub-receive-password"
                            type="password"
                            value={receivePassword}
                            onChange={(e) => setReceivePassword(e.target.value)}
                            disabled={receiveSubmitting}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                fontSize: '0.9375rem',
                                outline: 'none',
                                marginBottom: 12,
                            }}
                        />

                        {receiveError ? (
                            <p
                                style={{
                                    margin: '0 0 10px',
                                    fontSize: '0.8125rem',
                                    color: '#B91C1C',
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                }}
                            >
                                {receiveError}
                            </p>
                        ) : null}

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={closeReceiveModal}
                                disabled={receiveSubmitting}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    cursor: receiveSubmitting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Close
                            </button>
                            <button
                                type="submit"
                                disabled={
                                    receiveSubmitting ||
                                    !receiveInvoiceId.trim() ||
                                    !receivePassword.trim()
                                }
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: '#059669',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor:
                                        receiveSubmitting ||
                                        !receiveInvoiceId.trim() ||
                                        !receivePassword.trim()
                                            ? 'not-allowed'
                                            : 'pointer',
                                    opacity:
                                        receiveSubmitting ||
                                        !receiveInvoiceId.trim() ||
                                        !receivePassword.trim()
                                            ? 0.7
                                            : 1,
                                }}
                            >
                                {receiveSubmitting ? 'Authenticating…' : 'Confirm & receive'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
