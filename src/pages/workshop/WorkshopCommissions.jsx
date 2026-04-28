import React, { useState } from 'react';
import { 
    Clock, CheckCircle, DollarSign, Users, Wallet, 
    ArrowRight, Search, Filter, Calendar, X, 
    ChevronRight, Check, AlertCircle 
} from 'lucide-react';
import Modal from '../../components/Modal';

const MOCK_COMMISSIONS = [
    { id: 1, employee: 'Nasser Al-Shehri', initials: 'N', service: 'Full Service Package', date: '2026-03-22', rate: '10%', amount: 180, status: 'accrued' },
    { id: 2, employee: 'Faisal Al-Ghamdi', initials: 'F', service: 'Suspension Check', date: '2026-03-21', rate: '11%', amount: 55, status: 'accrued' },
    { id: 3, employee: 'Omar Al-Qahtani', initials: 'O', service: 'Paint Protection Film', date: '2026-03-20', rate: '10%', amount: 200, status: 'accrued' },
    { id: 4, employee: 'Khalid Al-Mutairi', initials: 'K', service: 'Windshield Replacement', date: '2026-03-19', rate: '10%', amount: 150, status: 'accrued' },
    { id: 5, employee: 'Ahmed Al-Harthi', initials: 'A', service: 'Differential Service', date: '2026-03-18', rate: '12%', amount: 100, status: 'paid' },
    { id: 6, employee: 'Nasser Al-Shehri', initials: 'N', service: 'Exhaust Repair', date: '2026-03-16', rate: '15%', amount: 90, status: 'accrued' },
    { id: 7, employee: 'Faisal Al-Ghamdi', initials: 'F', service: 'AC Service', date: '2026-03-15', rate: '13%', amount: 65, status: 'accrued' },
    { id: 8, employee: 'Omar Al-Qahtani', initials: 'O', service: 'Full Oil Change', date: '2026-03-14', rate: '10%', amount: 45, status: 'accrued' },
];

const EMPLOYEE_SUMMARIES = [
    { name: 'Nasser Al-Shehri', initials: 'N', color: '#E0E7FF', textColor: '#4338CA', entries: 3, amount: 320 },
    { name: 'Faisal Al-Ghamdi', initials: 'F', color: '#DBEAFE', textColor: '#1D4ED8', entries: 4, amount: 310 },
    { name: 'Omar Al-Qahtani', initials: 'O', color: '#F3E8FF', textColor: '#7E22CE', entries: 3, amount: 300 },
    { name: 'Khalid Al-Mutairi', initials: 'K', color: '#E0F2FE', textColor: '#0369A1', entries: 3, amount: 222 },
    { name: 'Ahmed Al-Harthi', initials: 'A', color: '#F0FDF4', textColor: '#15803D', entries: 3, amount: 130 },
];

const ACCOUNTS = [
    "Cash Register — Riyadh — SAR 18,500",
    "Al Rajhi Bank — Riyadh — SAR 198,500",
    "Cash Register — Jeddah — SAR 13,200",
    "Petty Cash — Dammam — SAR 3,800",
    "SNB Bank — Jeddah — SAR 114,250",
    "Bank — SAR 1,500"
];

export default function WorkshopCommissions() {
    const [commissions, setCommissions] = useState(MOCK_COMMISSIONS);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [payoutModalOpen, setPayoutModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState('');

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllAccrued = () => {
        const accruedOnly = commissions.filter(c => c.status === 'accrued');
        if (selectedIds.size === accruedOnly.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(accruedOnly.map(c => c.id)));
        }
    };

    const selectedTotal = Array.from(selectedIds).reduce((sum, id) => {
        const c = commissions.find(item => item.id === id);
        return sum + (c ? c.amount : 0);
    }, 0);

    const stats = {
        totalAccrued: commissions.filter(c => c.status === 'accrued').reduce((sum, c) => sum + c.amount, 0),
        totalPaid: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0),
        pendingEmployees: new Set(commissions.filter(c => c.status === 'accrued').map(c => c.employee)).size,
        selectedAmount: selectedTotal
    };

    const confirmPayout = () => {
        if (!selectedAccount) return;
        setCommissions(prev => prev.map(c => 
            selectedIds.has(c.id) ? { ...c, status: 'paid' } : c
        ));
        setSelectedIds(new Set());
        setPayoutModalOpen(false);
        setSelectedAccount('');
    };

    return (
        <div className="ws-commissions">
            {/* Stats Overview */}
            <div className="ws-commissions-stats">
                <div className="ws-stat-card border-orange">
                    <p className="ws-stat-label">Total Accrued</p>
                    <h3 className="ws-stat-value text-orange">SAR {stats.totalAccrued.toLocaleString()}</h3>
                </div>
                <div className="ws-stat-card border-green">
                    <p className="ws-stat-label">Total Paid</p>
                    <h3 className="ws-stat-value text-green">SAR {stats.totalPaid.toLocaleString()}</h3>
                </div>
                <div className="ws-stat-card border-blue">
                    <p className="ws-stat-label">Pending Employees</p>
                    <h3 className="ws-stat-value text-blue">{stats.pendingEmployees}</h3>
                </div>
                <div className="ws-stat-card border-purple">
                    <p className="ws-stat-label">Selected for Payout</p>
                    <h3 className="ws-stat-value text-purple">SAR {stats.selectedAmount.toLocaleString()}</h3>
                </div>
            </div>

            {/* Employee Summaries */}
            <div className="ws-commissions-section">
                <header className="ws-section-header">
                    <Users size={18} className="text-blue" />
                    <h4>Pending Payout by Employee</h4>
                </header>
                <div className="ws-employee-chips">
                    {EMPLOYEE_SUMMARIES.map(emp => (
                        <div key={emp.name} className="ws-emp-chip">
                            <div className="ws-emp-avatar" style={{ backgroundColor: emp.color, color: emp.textColor }}>
                                {emp.initials}
                            </div>
                            <div className="ws-emp-details">
                                <p className="ws-emp-name">{emp.name}</p>
                                <p className="ws-emp-summary">{emp.entries} entries · SAR {emp.amount}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="ws-commissions-filters">
                <div className="ws-filter-group">
                    <select className="ws-select">
                        <option>All Status</option>
                    </select>
                    <select className="ws-select">
                        <option>All Employees</option>
                    </select>
                    <div className="ws-date-picker">
                        <input type="text" placeholder="mm/dd/yyyy" />
                        <Calendar size={14} />
                    </div>
                    <div className="ws-date-picker">
                        <input type="text" placeholder="mm/dd/yyyy" />
                        <Calendar size={14} />
                    </div>
                </div>
                <div className="ws-filter-actions">
                    {selectedIds.size > 0 && (
                        <button className="ws-btn-clear" onClick={() => setSelectedIds(new Set())}>
                            Clear ({selectedIds.size})
                        </button>
                    )}
                    <button 
                        className={`ws-btn-payout ${selectedIds.size > 0 ? 'active' : ''}`}
                        onClick={() => selectedIds.size > 0 ? setPayoutModalOpen(true) : toggleSelectAllAccrued()}
                    >
                        {selectedIds.size > 0 ? (
                            <><Wallet size={16} /> Process Payout · SAR {selectedTotal}</>
                        ) : (
                            'Select All Accrued'
                        )}
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="ws-commissions-table-wrapper">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th width="40"><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === commissions.filter(c => c.status === 'accrued').length} onChange={toggleSelectAllAccrued} /></th>
                            <th>EMPLOYEE</th>
                            <th>SERVICE</th>
                            <th>JOB CARD</th>
                            <th>DATE</th>
                            <th>RATE</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {commissions.map(c => (
                            <tr key={c.id} className={selectedIds.has(c.id) ? 'selected' : ''}>
                                <td>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(c.id)} 
                                        onChange={() => c.status === 'accrued' && toggleSelect(c.id)}
                                        disabled={c.status !== 'accrued'} 
                                    />
                                </td>
                                <td>
                                    <div className="ws-table-emp">
                                        <div className="ws-table-avatar">{c.initials}</div>
                                        <span>{c.employee}</span>
                                    </div>
                                </td>
                                <td><span className="ws-text-dim">{c.service}</span></td>
                                <td><a href="#" className="ws-link">dummy-order-</a></td>
                                <td><span className="ws-text-dim">{c.date}</span></td>
                                <td><span className="ws-text-dim">{c.rate}</span></td>
                                <td className="ws-font-bold">SAR {c.amount}</td>
                                <td>
                                    <span className={`ws-badge ${c.status === 'accrued' ? 'bg-orange-light text-orange' : 'bg-green-light text-green'}`}>
                                        {c.status === 'accrued' ? <Clock size={12} /> : <CheckCircle size={12} />}
                                        {c.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Payout Modal */}
            {payoutModalOpen && (
                <Modal 
                    title={(
                        <div className="ws-modal-title">
                            <div className="ws-modal-icon bg-green-light text-green"><Wallet size={20}/></div>
                            <span>Process Commission Payout</span>
                        </div>
                    )}
                    onClose={() => setPayoutModalOpen(false)}
                    footer={(
                        <div className="ws-modal-footer">
                            <button className="ws-btn-secondary" onClick={() => setPayoutModalOpen(false)}>Cancel</button>
                            <button 
                                className="ws-btn-confirm" 
                                onClick={confirmPayout}
                                disabled={!selectedAccount}
                            >
                                Confirm Payout · SAR {selectedTotal}
                            </button>
                        </div>
                    )}
                >
                    <div className="ws-payout-modal-content">
                        <div className="ws-summary-box">
                            <div className="ws-summary-line">
                                <span className="ws-text-dim">Commissions selected</span>
                                <span className="ws-font-bold">{selectedIds.size}</span>
                            </div>
                            <div className="ws-summary-line">
                                <span className="ws-text-dim">Total payout amount</span>
                                <h4 className="text-green">SAR {selectedTotal}</h4>
                            </div>
                        </div>

                        <div className="ws-form-group">
                            <label className="ws-form-label">Select Cash / Bank Account</label>
                            <select 
                                className="ws-form-select"
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                            >
                                <option value="">Choose account...</option>
                                {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                            </select>
                        </div>

                        <div className="ws-alert-banner">
                            <AlertCircle size={18} className="text-orange" />
                            <p>Journal entry will be posted: Dr Commission Payable / Cr Cash/Bank</p>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
