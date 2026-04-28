import { useState, useEffect } from 'react';
import { Tag, Plus, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

const STATUS_STYLES = {
    sent:     { bg: '#DBEAFE', color: '#1D4ED8' },
    pending:  { bg: '#FEF3C7', color: '#B45309' },
    accepted: { bg: '#D1FAE5', color: '#047857' },
    approved: { bg: '#D1FAE5', color: '#047857' },
    draft:    { bg: '#F1F5F9', color: '#475569' },
    rejected: { bg: '#FEE2E2', color: '#B91C1C' },
};

export default function CorporateQuotations({ setQuoteOpen }) {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/corporate/quotations')
            .then(data => setQuotes(data.quotations || data.data || data.quotes || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Price Quotations</h2><p className="ws-page-sub">Corporate service price proposals</p></div>
                <button className="btn-portal" style={{ background: '#7C3AED', color: '#fff', border: 'none' }} onClick={() => setQuoteOpen(true)}><Plus size={15}/> Request Quotation</button>
            </div>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: '#7C3AED' }}/>
                </div>
            ) : quotes.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Tag size={48} style={{ opacity: 0.3, margin: '0 auto 16px', display: 'block' }}/>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No quotations yet</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Request a price quotation for corporate pricing</p>
                    <button className="btn-portal" style={{ marginTop: 16, background: '#7C3AED', color: '#fff', border: 'none' }} onClick={() => setQuoteOpen(true)}>Request Quotation</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {quotes.map(q => {
                        const status = q.status || 'draft';
                        const st = STATUS_STYLES[status] || STATUS_STYLES.draft;
                        return (
                            <div key={q.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-dark)', margin: 0 }}>#{q.quotationNumber || q.id}</p>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{q.company || q.companyName || '—'}</p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '6px 0 0 0', color: 'var(--color-text-dark)' }}>{q.service || q.services || q.description || '—'}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                            {q.validUntil || q.valid_until ? `Valid until: ${q.validUntil || q.valid_until}` : q.createdAt ? `Created: ${new Date(q.createdAt).toLocaleDateString('en-SA')}` : ''}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                        <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-dark)', margin: 0 }}>SAR {Number(q.amount || q.totalAmount || q.total_amount || 0).toLocaleString()}</p>
                                        <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>
                                        {(q.discount || q.discountPercent) && <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>{q.discount || `${q.discountPercent}% off`}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
