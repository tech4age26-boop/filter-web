import React, { useState } from 'react';
import { MOCK_PENDING } from './constants';

export default function RecordCollection() {
    const [form, setForm] = useState({ request: '', received: '', notes: '' });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const handleSubmit = () => { alert('Collection recorded!'); setForm({ request: '', received: '', notes: '' }); };
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Record Collection</h2><p className="ws-page-sub">Record cash received from branch locker</p></div></div>
            <div className="ws-section" style={{maxWidth:520,padding:24}}>
                <div className="ws-form-grid">
                    <div className="ws-field"><label>Request # *</label><select value={form.request} onChange={e=>set('request',e.target.value)}><option value="">Select Request</option>{MOCK_PENDING.map(p=><option key={p.id} value={p.id}>{p.id} — {p.branch}</option>)}</select></div>
                    <div className="ws-field"><label>Received Amount (SAR) *</label><input type="number" value={form.received} onChange={e=>set('received',e.target.value)} placeholder="0.00"/></div>
                    <div className="ws-field" style={{gridColumn:'1 / -1'}}><label>Notes</label><input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes..."/></div>
                </div>
                <div style={{display:'flex',gap:12,justifyContent:'flex-end',marginTop:20}}>
                    <button className="btn-secondary" onClick={()=>setForm({ request: '', received: '', notes: '' })}>Cancel</button>
                    <button className="btn-submit" onClick={handleSubmit}>Record Collection</button>
                </div>
            </div>
        </div>
    );
}
