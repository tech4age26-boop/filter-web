import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Wallet, Calendar, Tag, LogOut } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../components/Modal';
import {
    NAV_GROUPS,
} from './corporate/constants';
import CorporateDashboard from './corporate/CorporateDashboard';
import CorporateProfile from './corporate/CorporateProfile';
import CorporateVehicles from './corporate/CorporateVehicles';
import CorporateBookings from './corporate/CorporateBookings';
import CorporateQuotations from './corporate/CorporateQuotations';
import QuotationModal from './corporate/QuotationModal';
import MonthlyBilling from './corporate/MonthlyBilling';
import CorporateWallet from './corporate/CorporateWallet';
import CorporateReports from './corporate/CorporateReports';
import { apiFetch } from '../services/api';
import './workshop/Workshop.css';

export default function CorporateLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    
    // Sync activeTab with URL: /corporate/TAB_NAME
    const getActiveTabFromUrl = () => {
        const parts = location.pathname.split('/').filter(Boolean);
        return parts[1] || 'dashboard';
    };

    const activeTab = getActiveTabFromUrl();
    const setActiveTab = (tab) => {
        navigate(`/corporate/${tab}`);
    };
    const [bookingOpen, setBookingOpen] = useState(false);
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [vehicles, setVehicles] = useState([]);
    const [branches, setBranches] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);

    useEffect(() => {
        apiFetch('/corporate/vehicles')
            .then(data => { if (data.success) setVehicles(data.vehicles); })
            .catch(() => {});
        apiFetch('/corporate/profile')
            .then(data => {
                const allBranches = (data.workshops || []).flatMap(w => w.branches || []);
                const ids = data.corporateAccount?.selectedStoreIds || [];
                setBranches(ids.length ? allBranches.filter(b => ids.includes(String(b.id))) : allBranches);
            })
            .catch(() => {});
        apiFetch('/corporate/wallet')
            .then(data => setWalletBalance(data.balance ?? data.walletBalance ?? data.wallet_balance ?? data.amount ?? 0))
            .catch(() => {});
    }, []);
    const [bookingForm, setBookingForm] = useState({ vehicle_id: '', branch_id: '', department_ids: [], booking_date: '', notes: '', pay_from_wallet: false });
    const [departments, setDepartments] = useState([]);
    const [depsLoading, setDepsLoading] = useState(false);
    const setBook = (k, v) => setBookingForm(f => ({ ...f, [k]: v }));
    const toggleDept = (id) => setBookingForm(f => ({ ...f, department_ids: f.department_ids.includes(id) ? f.department_ids.filter(d => d !== id) : [...f.department_ids, id] }));

    useEffect(() => {
        if (!bookingForm.branch_id) { setDepartments([]); return; }
        setDepsLoading(true);
        apiFetch(`/corporate/departments?branchId=${bookingForm.branch_id}`)
            .then(data => { if (data.success) setDepartments(data.departments); })
            .catch(() => setDepartments([]))
            .finally(() => setDepsLoading(false));
    }, [bookingForm.branch_id]);

    const [bookingStep, setBookingStep] = useState(1);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [validateResult, setValidateResult] = useState(null);

    const EMPTY_BOOKING = { vehicle_id: '', branch_id: '', department_ids: [], booking_date: '', notes: '', pay_from_wallet: false };
    const resetBooking = () => { setBookingStep(1); setBookingError(''); setBookingForm(EMPTY_BOOKING); setValidateResult(null); };
    const fmtDate = (dt) => dt ? dt.replace('T', ' ') + ':00' : '';

    const handleValidate = async () => {
        if (!bookingForm.vehicle_id || !bookingForm.branch_id || !bookingForm.booking_date || bookingForm.department_ids.length === 0) return;
        setBookingLoading(true); setBookingError('');
        try {
            await apiFetch(`/corporate/branches/${bookingForm.branch_id}`, { method: 'POST' }).catch(() => {});
            const result = await apiFetch('/corporate/order', { method: 'POST', body: JSON.stringify({ branchId: bookingForm.branch_id, vehicleId: bookingForm.vehicle_id, departmentIds: bookingForm.department_ids, bookedFor: fmtDate(bookingForm.booking_date), payFromWallet: bookingForm.pay_from_wallet, notes: bookingForm.notes }) });
            setValidateResult(result);
            setBookingStep(2);
        } catch (err) { setBookingError(err.message || 'Validation failed'); }
        finally { setBookingLoading(false); }
    };

    const handleConfirmBooking = async () => {
        setBookingLoading(true); setBookingError('');
        try {
            await apiFetch('/corporate/make_payment', { method: 'POST', body: JSON.stringify({ branchId: bookingForm.branch_id, vehicleId: bookingForm.vehicle_id, departmentIds: bookingForm.department_ids, bookedFor: fmtDate(bookingForm.booking_date), payFromWallet: bookingForm.pay_from_wallet, notes: bookingForm.notes, paymentMethod: bookingForm.pay_from_wallet ? 'Wallet balance' : 'Cash', partialWalletPayment: false, saveAsDraft: false, services: [], products: [] }) });
            setBookingOpen(false); resetBooking();
        } catch (err) { setBookingError(err.message || 'Booking failed'); }
        finally { setBookingLoading(false); }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <CorporateDashboard onTabChange={setActiveTab} setBookingOpen={setBookingOpen} setQuoteOpen={setQuoteOpen}/>;
            case 'profile': return <CorporateProfile onTabChange={setActiveTab}/>;
            case 'vehicles': return <CorporateVehicles vehicles={vehicles} setVehicles={setVehicles}/>;
            case 'bookings': return <CorporateBookings setBookingOpen={setBookingOpen}/>;
            case 'quotations': return <CorporateQuotations setQuoteOpen={setQuoteOpen}/>;
            case 'billing': return <MonthlyBilling onTabChange={setActiveTab}/>;
            case 'wallet': return <CorporateWallet/>;
            case 'reports': return <CorporateReports walletBalance={walletBalance}/>;
            default: return <CorporateDashboard onTabChange={setActiveTab} setBookingOpen={setBookingOpen} setQuoteOpen={setQuoteOpen}/>;
        }
    };

    const currentLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || 'Dashboard';

    return (
        <div className="workshop-layout">
            <aside className="ws-sidebar">
                <div className="ws-logo"><div className="ws-logo-icon"><Building2 size={20}/></div><div><p className="ws-logo-title">Filter Corporate</p><p className="ws-logo-sub">Portal</p></div></div>
                <div style={{padding:'10px 14px',margin:'10px 12px',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:10,fontSize:'0.75rem',fontWeight:700,color:'#111111',display:'flex',alignItems:'center',gap:8}}>
                    <Wallet size={14}/> Wallet: SAR {Number(walletBalance).toLocaleString()}
                </div>
                <nav className="ws-nav">
                    {NAV_GROUPS.map(grp => (
                        <div key={grp.label}>
                            <div style={{fontSize:'0.625rem',fontWeight:800,color:'rgba(255,255,255,0.28)',padding:'14px 14px 6px',textTransform:'uppercase',letterSpacing:'0.14em'}}>{grp.label}</div>
                            {grp.items.map(item => <button key={item.id} className={`ws-nav-btn ${activeTab===item.id?'active':''}`} onClick={() => setActiveTab(item.id)}><item.icon size={17}/><span>{item.label}</span></button>)}
                        </div>
                    ))}
                </nav>
                <div className="ws-user-footer">
                    <div className="ws-user-info">
                        <div className="ws-user-avatar">
                            {user?.name?.charAt(0) || 'C'}
                        </div>
                        <div>
                            <p className="ws-user-name">{user?.name || 'Corporate Admin'}</p>
                            <p className="ws-user-role">{user?.corporateAccount?.companyName || 'Corporate Portal'}</p>
                        </div>
                    </div>
                    <button className="ws-logout-btn" onClick={() => {
                        logout();
                        navigate('/');
                    }}>
                        <LogOut size={16}/>
                    </button>
                </div>
            </aside>
            <div className="ws-main">
                <header className="ws-topbar"><div><p className="ws-topbar-title">{currentLabel}</p><p className="ws-topbar-sub">Corporate Client Portal</p></div>
                    <div className="ws-topbar-right">
                        <button className="btn-portal" onClick={() => setBookingOpen(true)}><Calendar size={14}/> New Booking</button>
                        <button className="btn-portal" onClick={() => setQuoteOpen(true)}><Tag size={14}/> Quotation</button>
                    </div>
                </header>
                <main className="ws-content">{renderContent()}</main>
            </div>

            <AnimatePresence>
                {bookingOpen && (() => {
                    const selV = vehicles.find(x => String(x.id) === String(bookingForm.vehicle_id));
                    const selB = branches.find(x => x.id === bookingForm.branch_id);
                    const selDepts = bookingForm.department_ids.map(did => departments.find(d => d.id === did)?.name).filter(Boolean).join(', ');
                    const step1Valid = bookingForm.vehicle_id && bookingForm.branch_id && bookingForm.booking_date && bookingForm.department_ids.length > 0;
                    return (
                        <Modal
                            title={bookingStep === 1 ? 'Book Service Appointment' : 'Review & Confirm'}
                            onClose={() => { setBookingOpen(false); resetBooking(); }}
                            footer={
                                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                                    {bookingStep === 1 ? (
                                        <>
                                            <button className="btn-portal-outline" onClick={() => { setBookingOpen(false); resetBooking(); }}>Cancel</button>
                                            <button className="btn-portal" style={{background:'#059669',color:'#fff',border:'none'}} disabled={!step1Valid || bookingLoading} onClick={handleValidate}>{bookingLoading ? 'Validating…' : 'Next: Review'}</button>
                                        </>
                                    ) : (
                                        <>
                                            <button className="btn-portal-outline" onClick={() => { setBookingStep(1); setBookingError(''); }}>Back</button>
                                            <button className="btn-portal" style={{background:'#059669',color:'#fff',border:'none'}} disabled={bookingLoading || (bookingForm.pay_from_wallet && walletBalance < Number(validateResult?.totalAmount ?? validateResult?.grandTotal ?? validateResult?.grand_total ?? validateResult?.total ?? validateResult?.amount ?? 0) && Number(validateResult?.totalAmount ?? validateResult?.grandTotal ?? validateResult?.grand_total ?? validateResult?.total ?? validateResult?.amount ?? 0) > 0)} onClick={handleConfirmBooking}>{bookingLoading ? 'Processing…' : 'Confirm Booking'}</button>
                                        </>
                                    )}
                                </div>
                            }
                            width="420px"
                        >
                            {bookingStep === 1 ? (
                                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                                    <div className="ws-field"><label>Vehicle *</label><select value={bookingForm.vehicle_id} onChange={e=>setBook('vehicle_id',e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.plateNo} – {v.make} {v.model}</option>)}</select></div>
                                    <div className="ws-field"><label>Branch *</label><select value={bookingForm.branch_id} onChange={e=>setBookingForm(f=>({...f,branch_id:e.target.value,department_ids:[]}))} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div><label style={{display:'block',marginBottom:6,fontWeight:600}}>Departments (Services) * <span style={{fontWeight:400,color:'var(--color-text-muted)',fontSize:'0.75rem'}}>— select one or more</span></label>
                                        <div style={{border:'1px solid var(--color-border)',borderRadius:10,maxHeight:140,overflowY:'auto'}}>
                                            {!bookingForm.branch_id ? <p style={{margin:0,padding:'12px 14px',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Select a branch first</p>
                                            : depsLoading ? <p style={{margin:0,padding:'12px 14px',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>Loading…</p>
                                            : departments.length === 0 ? <p style={{margin:0,padding:'12px 14px',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>No departments available</p>
                                            : departments.map(d => (
                                                <label key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--color-border-light)'}}>
                                                    <input type="checkbox" checked={bookingForm.department_ids.includes(d.id)} onChange={() => toggleDept(d.id)} style={{accentColor:'#059669'}}/>
                                                    <span style={{fontSize:'0.875rem'}}>{d.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {bookingForm.department_ids.length > 0 && <p style={{fontSize:'0.75rem',color:'#059669',marginTop:4}}>{bookingForm.department_ids.length} department(s) selected</p>}
                                    </div>
                                    <div className="ws-field"><label>Date & Time *</label><input type="datetime-local" value={bookingForm.booking_date} onChange={e=>setBook('booking_date',e.target.value)} style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)'}}/></div>
                                    <div className="ws-field"><label>Notes</label><textarea value={bookingForm.notes} onChange={e=>setBook('notes',e.target.value)} rows={2} placeholder="Any special requirements…" style={{width:'100%',padding:'10px 12px',borderRadius:9,border:'1px solid var(--color-border)',resize:'vertical'}}/></div>
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:14,borderRadius:14,background:'#FAF5FF',border:'1px solid #EDE9FE'}}>
                                        <div><p style={{fontSize:'0.875rem',fontWeight:600,color:'#6D28D9',margin:0}}>Wallet Balance: SAR {Number(walletBalance).toLocaleString()}</p><p style={{fontSize:'0.75rem',color:'#7C3AED',margin:'2px 0 0 0'}}>Pay from wallet?</p></div>
                                        <button type="button" onClick={()=>setBook('pay_from_wallet',!bookingForm.pay_from_wallet)} style={{width:48,height:24,borderRadius:999,border:'none',background:bookingForm.pay_from_wallet?'#7C3AED':'#D1D5DB',cursor:'pointer',position:'relative'}}><span style={{position:'absolute',top:2,left:2,width:20,height:20,borderRadius:'50%',background:'#fff',transform:bookingForm.pay_from_wallet?'translateX(24px)':'none',transition:'transform 0.2s'}}/></button>
                                    </div>
                                    {bookingError && <p style={{margin:0,padding:'10px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:9,fontSize:'0.8rem',color:'#DC2626'}}>{bookingError}</p>}
                                </div>
                            ) : (() => {
                                const orderTotal = Number(validateResult?.totalAmount ?? validateResult?.grandTotal ?? validateResult?.grand_total ?? validateResult?.total ?? validateResult?.amount ?? 0);
                                const insufficientBalance = bookingForm.pay_from_wallet && walletBalance < orderTotal && orderTotal > 0;
                                return (
                                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                                    <div style={{padding:16,background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:12,display:'flex',flexDirection:'column',gap:8}}>
                                        <p style={{fontWeight:700,color:'#065F46',margin:'0 0 4px 0',fontSize:'0.9rem'}}>Booking Summary</p>
                                        {[
                                            ['Vehicle', selV ? `${selV.plateNo} — ${selV.make} ${selV.model}` : '—'],
                                            ['Branch', selB?.name || '—'],
                                            ['Services', selDepts || '—'],
                                            ['Date', bookingForm.booking_date?.replace('T', ' ') || '—'],
                                            ['Payment', bookingForm.pay_from_wallet ? 'Wallet balance' : 'Cash'],
                                        ].map(([k, val]) => (
                                            <div key={k} style={{display:'flex',gap:8,fontSize:'0.8rem'}}><span style={{color:'var(--color-text-muted)',minWidth:70}}>{k}:</span><span style={{fontWeight:600}}>{val}</span></div>
                                        ))}
                                        {bookingForm.notes && <div style={{display:'flex',gap:8,fontSize:'0.8rem'}}><span style={{color:'var(--color-text-muted)',minWidth:70}}>Notes:</span><span>{bookingForm.notes}</span></div>}
                                    </div>

                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'var(--color-bg-muted)',borderRadius:10}}>
                                        <span style={{fontSize:'0.85rem',color:'var(--color-text-muted)',fontWeight:600}}>Estimated Total</span>
                                        <span style={{fontWeight:800,fontSize:'1.0625rem',color:'var(--color-text-dark)'}}>
                                            {orderTotal > 0 ? `SAR ${orderTotal.toFixed(2)}` : 'Calculated at workshop'}
                                        </span>
                                    </div>

                                    {bookingForm.pay_from_wallet && (
                                        <div style={{padding:'10px 14px',borderRadius:9,background: insufficientBalance ? '#FEF2F2' : '#F0FDF4', border:`1px solid ${insufficientBalance ? '#FECACA' : '#BBF7D0'}`,fontSize:'0.8rem'}}>
                                            <div style={{display:'flex',justifyContent:'space-between'}}>
                                                <span style={{color:'var(--color-text-muted)'}}>Wallet Balance</span>
                                                <span style={{fontWeight:700,color: insufficientBalance ? '#DC2626' : '#16A34A'}}>SAR {Number(walletBalance).toLocaleString()}</span>
                                            </div>
                                            {insufficientBalance && <p style={{margin:'4px 0 0 0',color:'#DC2626',fontWeight:600}}>⚠ Insufficient balance — please top up your wallet</p>}
                                        </div>
                                    )}

                                    {bookingError && <p style={{margin:0,padding:'10px 14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:9,fontSize:'0.8rem',color:'#DC2626'}}>{bookingError}</p>}
                                    <p style={{padding:12,background:'#EFF6FF',borderRadius:10,fontSize:'0.75rem',color:'#1D4ED8',margin:0}}>📲 Booking will be sent to workshop for confirmation. Status: Pending Approval</p>
                                </div>
                                );
                            })()}
                        </Modal>
                    );
                })()}
                {quoteOpen && (
                    <QuotationModal
                        branches={branches}
                        walletBalance={walletBalance}
                        onClose={() => setQuoteOpen(false)}
                        onSave={() => setQuoteOpen(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
