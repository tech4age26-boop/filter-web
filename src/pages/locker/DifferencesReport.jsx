import React from 'react';
import { DollarSign, FileText } from 'lucide-react';
import { MOCK_APPROVALS } from './constants';

export default function DifferencesReport() {
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Differences Report</h2><p className="ws-page-sub">Cash variance analysis by branch</p></div></div>
            <div className="ws-kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Total Shorts</p><p className="ws-kpi-value">SAR 20</p></div><div className="ws-kpi-icon ws-kpi-icon--red"><DollarSign size={22}/></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Total Overs</p><p className="ws-kpi-value">SAR 50</p></div><div className="ws-kpi-icon ws-kpi-icon--green"><DollarSign size={22}/></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Net Variance</p><p className="ws-kpi-value">SAR +30</p></div><div className="ws-kpi-icon ws-kpi-icon--blue"><FileText size={22}/></div></div>
            </div>
            <div className="ws-section"><table className="ws-table"><thead><tr><th>Collection</th><th>Branch</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>{MOCK_APPROVALS.map(a=><tr key={a.id}><td>{a.collectionId}</td><td>{a.branch}</td><td><span className={`ws-badge ${a.type==='short'?'ws-badge--red':'ws-badge--green'}`}>{a.type}</span></td><td>SAR {a.amount}</td><td>{a.date}</td></tr>)}</tbody></table></div>
        </div>
    );
}
