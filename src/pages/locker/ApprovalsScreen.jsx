import React, { useState } from 'react';
import { MOCK_APPROVALS } from './constants';

export default function ApprovalsScreen() {
    const [approvals, setApprovals] = useState(MOCK_APPROVALS);
    const approve = id => setApprovals(prev => prev.filter(a => a.id !== id));
    const reject = id => { if (confirm('Reject this difference approval?')) setApprovals(prev => prev.filter(a => a.id !== id)); };
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Pending Approvals</h2><p className="ws-page-sub">Cash difference approvals</p></div></div>
            {approvals.map(a=>(
                <div key={a.id} className="ws-approval-card">
                    <div className="ws-approval-top">
                        <div><p className="ws-approval-title">{a.collectionId} — {a.branch}</p><p className="ws-approval-meta">{a.type} by SAR {a.amount} · {a.reason} · By: {a.submittedBy} · {a.date}</p></div>
                        <span className={`ws-badge ${a.type==='short'?'ws-badge--red':'ws-badge--green'}`}>{a.type}</span>
                    </div>
                    <div className="ws-approval-actions">
                        <button className="ws-btn-approve" onClick={()=>approve(a.id)}>Approve</button>
                        <button className="ws-btn-reject" onClick={()=>reject(a.id)}>Reject</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
