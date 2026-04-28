import React from 'react';
import { MOCK_HISTORY } from './constants';

export default function CollectionsHistory() {
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Collections History</h2><p className="ws-page-sub">Past cash collection records</p></div></div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr><th>Request #</th><th>Branch</th><th>Date</th><th>Expected</th><th>Received</th><th>Difference</th></tr></thead>
                    <tbody>{MOCK_HISTORY.map(c=>(
                        <tr key={c.id}><td><strong style={{fontFamily:'monospace'}}>{c.id}</strong></td><td>{c.branch}</td><td style={{fontSize:'0.8rem'}}>{c.date}</td><td>{c.expected}</td><td><strong>{c.received}</strong></td>
                            <td style={{fontWeight:700,color:c.difference===0?'#16A34A':c.difference<0?'#DC2626':'#059669'}}>{c.difference===0?'—':c.difference}</td></tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    );
}
