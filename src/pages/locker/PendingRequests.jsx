import React, { useState } from 'react';
import { MOCK_PENDING } from './constants';

export default function PendingRequests() {
    const [pending, setPending] = useState(MOCK_PENDING);
    const collect = id => { setPending(prev => prev.filter(p => p.id !== id)); };
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Pending Requests</h2><p className="ws-page-sub">Branch cash collection requests awaiting pickup</p></div></div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr><th>Request #</th><th>Branch</th><th>Requested</th><th>Expected Amount</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>{pending.map(p=>(
                        <tr key={p.id}><td><strong style={{fontFamily:'monospace',fontSize:'0.8rem'}}>{p.id}</strong></td><td>{p.branch}</td><td style={{fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{p.requested}</td><td><strong>{p.expected}</strong></td>
                            <td><span className={`ws-badge ${p.status==='overdue'?'ws-badge--red':'ws-badge--yellow'}`}>{p.status==='overdue'?`Overdue (${p.hoursOverdue}h)`:'Pending'}</span></td>
                            <td><button onClick={()=>collect(p.id)} style={{padding:'6px 14px',background:'#16A34A',color:'#fff',border:'none',borderRadius:8,fontWeight:700,cursor:'pointer',fontSize:'0.75rem'}}>Record Collection</button></td></tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    );
}
