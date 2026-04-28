import React from 'react';
import { Clock, DollarSign, AlertTriangle, History } from 'lucide-react';
import { MOCK_HISTORY } from './constants';

export default function LockerDashboard({ onTabChange }) {
    const kpis = [
        { label: 'Pending Collections', value: '3', sub: '2 overdue', icon: Clock, c: 'ws-kpi-icon--red' },
        { label: "Today's Collected", value: 'SAR 12,400', sub: '1 request', icon: DollarSign, c: 'ws-kpi-icon--green' },
        { label: 'Monthly Collected', value: 'SAR 142,800', sub: 'This month', icon: DollarSign, c: 'ws-kpi-icon--blue' },
        { label: 'Pending Approvals', value: '2', sub: 'Differences', icon: AlertTriangle, c: 'ws-kpi-icon--yellow' },
    ];
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Locker Dashboard</h2><p className="ws-page-sub">Cash Collection & Locker Operations</p></div></div>
            <div className="ws-kpi-grid">{kpis.map(k => <div key={k.label} className="ws-kpi-card"><div><p className="ws-kpi-label">{k.label}</p><p className="ws-kpi-value">{k.value}</p><p className="ws-kpi-sub">{k.sub}</p></div><div className={`ws-kpi-icon ${k.c}`}><k.icon size={22}/></div></div>)}</div>
            <div className="ws-quick-grid">
                {[{l:'Pending Requests',t:'pending',i:Clock,s:'3 awaiting'},{l:'Record Collection',t:'record',i:DollarSign,s:'Record cash received'},{l:'Approvals',t:'approvals',i:AlertTriangle,s:'2 differences'},{l:'History',t:'history',i:History,s:'View past collections'}].map(a=><div key={a.t} className="ws-quick-card" onClick={()=>onTabChange(a.t)}><div className="ws-quick-icon"><a.i size={22}/></div><p className="ws-quick-label">{a.l}</p><p className="ws-quick-sub">{a.s}</p></div>)}
            </div>
            <div className="ws-section">
                <div className="ws-section-header"><span className="ws-section-title">Recent Collections</span></div>
                <table className="ws-table">
                    <thead><tr><th>Request #</th><th>Branch</th><th>Date</th><th>Received</th><th>Difference</th><th>Status</th></tr></thead>
                    <tbody>{MOCK_HISTORY.slice(0,5).map(c=>(
                        <tr key={c.id}><td><strong style={{fontFamily:'monospace',fontSize:'0.8rem'}}>{c.id}</strong></td><td>{c.branch}</td><td style={{fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{c.date}</td><td><strong>{c.received}</strong></td>
                            <td><span style={{fontWeight:700,color:c.difference===0?'#16A34A':c.difference<0?'#DC2626':'#059669'}}>{c.difference===0?'—':c.difference>0?'+':''}{c.difference}</span></td>
                            <td><span className={`ws-badge ws-badge--green`}>Collected</span></td></tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    );
}
