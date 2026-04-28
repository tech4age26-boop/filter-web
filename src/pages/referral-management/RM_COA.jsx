import React from 'react';
import { MOCK_ACCOUNTS } from './RM_Constants';

const AccountTable = ({ title, color, accounts }) => (
    <div className="rm-card" style={{ marginBottom: '24px', padding: '0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="rm-card-title" style={{ color: color, fontSize: '0.95rem' }}>{title}</h3>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{accounts.length} accounts</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>
                        <th style={{ padding: '12px 24px' }}>Code</th>
                        <th style={{ padding: '12px 24px' }}>Account Name</th>
                        <th style={{ padding: '12px 24px', textAlign: 'center' }}>System</th>
                        <th style={{ padding: '12px 24px', textAlign: 'right' }}>Balance</th>
                    </tr>
                </thead>
                <tbody style={{ fontSize: '0.875rem' }}>
                    {accounts.map(acc => (
                        <tr key={acc.code} style={{ borderBottom: '1px solid #f8f9fa' }}>
                            <td style={{ padding: '16px 24px', color: '#10b981', fontWeight: 600 }}>{acc.code}</td>
                            <td style={{ padding: '16px 24px', fontWeight: 500 }}>{acc.name}</td>
                            <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                <div style={{ 
                                    width: '8px', height: '8px', borderRadius: '50%', 
                                    background: acc.system ? '#6b7280' : 'transparent',
                                    border: acc.system ? 'none' : '1px solid #6b7280',
                                    display: 'inline-block' 
                                }}></div>
                            </td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700 }}>SAR {acc.balance.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export default function RM_COA() {
    return (
        <div className="rm-content">
            <div style={{ paddingBottom: '2rem' }}>
                <h2 className="rm-topbar-title">Chart of Accounts</h2>
                <p className="rm-topbar-sub">System and configurable accounts for double-entry bookkeeping</p>
            </div>

            <AccountTable title="Asset Accounts" color="#3b82f6" accounts={MOCK_ACCOUNTS.assets} />
            <AccountTable title="Liability Accounts" color="#f59e0b" accounts={MOCK_ACCOUNTS.liabilities} />
            <AccountTable title="Expense Accounts" color="#ef4444" accounts={MOCK_ACCOUNTS.expenses} />
        </div>
    );
}
