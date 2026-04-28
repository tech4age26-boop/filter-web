import { useState, useEffect } from 'react';
import { Wallet, Building2, CreditCard, Loader2, Eye, Download } from 'lucide-react';
import { apiFetch, BASE_URL } from '../../services/api';

export default function MonthlyBilling({ onTabChange }) {
    const [billing, setBilling] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/corporate/billing/monthly')
            .then(data => setBilling(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const walletBal = billing?.walletBalance ?? billing?.wallet_balance ?? 0;
    const currentBill = billing?.currentBill ?? billing?.current ?? null;
    const history = billing?.invoices ?? billing?.bills ?? billing?.history ?? billing?.data ?? [];
    const billAmt = currentBill?.totalAmount ?? currentBill?.total_amount ?? currentBill?.amount ?? billing?.totalAmount ?? 0;
    const billStatus = currentBill?.status ?? billing?.status ?? 'pending';
    const billDue = currentBill?.dueDate ?? currentBill?.due_date ?? currentBill?.due ?? null;

    const handleDownload = (id) => {
        const token = localStorage.getItem('filter_auth_token');
        window.open(`${BASE_URL}/corporate/invoices/${id}/download?token=${token}`, '_blank');
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Monthly Billing</h2><p className="ws-page-sub">Corporate monthly consolidated invoices</p></div>
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: 'var(--color-primary)' }}/>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#F8F8FC', borderRadius: 12, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Wallet size={20} style={{ color: '#7C3AED' }}/>
                            <span style={{ fontSize: '0.9375rem', color: '#6D28D9', fontWeight: 500 }}>Wallet: SAR {Number(walletBal).toLocaleString()}</span>
                        </div>
                        <button type="button" onClick={() => onTabChange?.('wallet')} style={{ fontSize: '0.875rem', color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Manage</button>
                    </div>

                    <div style={{ background: 'linear-gradient(135deg, #2563EB, #1E40AF)', borderRadius: 18, padding: 24, color: '#fff', marginBottom: 24, boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                            <div>
                                <p style={{ fontSize: '0.875rem', opacity: 0.8, margin: 0 }}>Monthly Billing – {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                                <p style={{ fontSize: '1.75rem', fontWeight: 900, margin: '8px 0 0 0' }}>SAR {Number(billAmt).toFixed(2)}</p>
                                {billDue && <p style={{ fontSize: '0.8125rem', opacity: 0.8, margin: '6px 0 0 0' }}>Due: {billDue}</p>}
                                <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: '4px 0 0 0' }}>Wallet Balance: SAR {Number(walletBal).toLocaleString()}</p>
                            </div>
                            <span className={`ws-badge ${billStatus === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}
                                style={{ background: billStatus === 'paid' ? 'rgba(34,197,94,0.9)' : 'rgba(234,179,8,0.9)', color: '#fff' }}>
                                {billStatus}
                            </span>
                        </div>
                        {billStatus !== 'paid' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
                                <button className="btn-portal" style={{ background: '#fff', color: '#1D4ED8', border: 'none' }}><Wallet size={16}/> Pay with Wallet (SAR {Number(walletBal).toLocaleString()})</button>
                                <button className="btn-portal-outline" style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#1D4ED8' }}><Building2 size={16}/> Pay with Bank</button>
                                <button className="btn-portal-outline" style={{ borderColor: 'rgba(255,255,255,0.5)', color: '#1D4ED8' }}><CreditCard size={16}/> Pay Partial</button>
                            </div>
                        )}
                    </div>

                    <div className="ws-section">
                        <div className="ws-section-header"><span className="ws-section-title">Billing History</span></div>
                        {history.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>No billing history yet</p>
                        ) : (
                            history.map((b, i) => (
                                <div key={b.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < history.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                                    <div>
                                        <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{b.id || b.invoiceNumber || `INV-${i + 1}`}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                            {b.period || (b.period_month && b.period_year ? `${b.period_month}/${b.period_year}` : b.month || '—')} · {b.orders ?? b.orderCount ?? 0} invoices
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: 0 }}>SAR {Number(b.totalAmount ?? b.total_amount ?? b.amount ?? 0).toFixed(2)}</p>
                                            <span className={`ws-badge ${(b.status === 'paid') ? 'ws-badge--green' : 'ws-badge--yellow'}`}>{b.status || 'pending'}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                                                onClick={() => apiFetch(`/corporate/invoices/${b.id}/view`).catch(() => {})}>
                                                <Eye size={14}/> View
                                            </button>
                                            <button style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#059669', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                                                onClick={() => handleDownload(b.id)}>
                                                <Download size={14}/> Download
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
