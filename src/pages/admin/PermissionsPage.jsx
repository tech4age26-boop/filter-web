import React, { useState, useEffect } from 'react';
import {
    Plus, Pencil, Eye, Trash2, Search, Briefcase,
    ShieldCheck, LayoutDashboard, ShoppingCart,
    Package, Users, Truck, Calculator, BarChart3,
    UserCircle, Settings, Check, ChevronDown
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from '../../components/Modal';
import ApprovalsPage from './ApprovalsPage';
import '../../styles/admin/PermissionsPage.css';

const MOCK_USERS = [
    {
        id: 1,
        name: 'abhutto1411',
        email: 'abhutto1411@gmail.com',
        role: 'Workshop Admin',
        permissions: 20,
        status: 'Active',
        avatar: 'A'
    },
    {
        id: 2,
        name: 'Asif Ali Bhutto',
        email: 'abhutto85@gmail.com',
        role: 'Super Admin',
        permissions: 22,
        status: 'Active',
        avatar: 'A'
    }
];

const MOCK_BRANCHES = [
    { id: 'master', name: 'Super Admin' },
    { id: 'b1', name: 'Main Branch' },
    { id: 'b2', name: 'North Branch' },
    { id: 'b3', name: 'South Branch' }
];

const MOCK_EMPLOYEES = [
    { id: 'e0', branchId: 'master', name: 'System Administrator' },
    { id: 'e1', branchId: 'b1', name: 'John Doe' },
    { id: 'e2', branchId: 'b1', name: 'Jane Smith' },
    { id: 'e3', branchId: 'b2', name: 'Mike Johnson' },
    { id: 'e4', branchId: 'b2', name: 'Sarah Williams' },
    { id: 'e5', branchId: 'b3', name: 'Robert Brown' }
];

const MOCK_ROLES = [
    {
        id: 'workshop-admin',
        name: 'Workshop Admin',
        description: 'Workshop Owner',
        permissionCount: 20,
        tags: ['view dashboard', 'view products', 'edit products', 'view customers'],
        isSystem: false,
        cardClass: 'role-admin'
    },
    {
        id: 'super-admin',
        name: 'Super Admin',
        description: 'Full system access',
        permissionCount: 22,
        tags: ['view dashboard', 'pos access', 'view products', 'edit products', 'view approvals', 'manage approvals'],
        isSystem: true,
        cardClass: 'role-admin'
    },
    {
        id: 'manager',
        name: 'Manager',
        description: 'Branch management access',
        permissionCount: 10,
        tags: ['view dashboard', 'pos access', 'view products', 'edit products'],
        isSystem: true,
        cardClass: 'role-manager'
    },
    {
        id: 'accountant',
        name: 'Accountant',
        description: 'Financial operations',
        permissionCount: 9,
        tags: ['view dashboard', 'submit expenses', 'approve expenses', 'submit payments', 'view approvals', 'manage approvals'],
        isSystem: true,
        cardClass: 'role-accountant'
    },
    {
        id: 'cashier',
        name: 'Cashier',
        description: 'POS and basic operations',
        permissionCount: 5,
        tags: ['view dashboard', 'pos access', 'view customers', 'view products'],
        isSystem: true,
        cardClass: 'role-cashier'
    }
];

const PERMISSION_GROUPS = [
    { id: 'dashboard', name: 'Dashboard', total: 1, sub: ['View Dashboard'] },
    { id: 'pos', name: 'POS', total: 1, sub: ['POS Access'] },
    { id: 'inventory', name: 'Inventory', total: 3, sub: ['View Products', 'Edit Products', 'Manage Inventory'] },
    { id: 'customers', name: 'Customers', total: 2, sub: ['View Customers', 'Edit Customers'] },
    { id: 'suppliers', name: 'Suppliers', total: 2, sub: ['View Suppliers', 'Edit Suppliers'] },
    { id: 'accounting', name: 'Accounting', total: 6, sub: ['Submit Expenses', 'Approve Expenses', 'Submit Payments', 'Approve Payments', 'Create Purchases', 'Approve Purchases'] },
    { id: 'approvals', name: 'Approvals', total: 2, sub: ['View Approvals', 'Manage Approvals'] },
    { id: 'reports', name: 'Reports', total: 2, sub: ['View Reports', 'Export Reports'] },
    { id: 'hr', name: 'HR', total: 2, sub: ['View Employees', 'Edit Employees'] },
    { id: 'admin', name: 'Admin', total: 3, sub: ['Manage Branches', 'Manage Users', 'Manage Settings'] },
];

export default function PermissionsPage() {
    const [activeTab, setActiveTab] = useState('users'); // 'users' or 'roles'
    const [users, setUsers] = useState(MOCK_USERS);
    const [roles, setRoles] = useState(MOCK_ROLES);
    const [roleModalOpen, setRoleModalOpen] = useState(false);
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateNewRole = () => {
        setEditingRole(null);
        setRoleModalOpen(true);
    };

    const handleCreateNewUser = () => {
        setUserModalOpen(true);
    };

    const handleSaveUser = (userData) => {
        const newUser = {
            ...userData,
            id: users.length + 1
        };
        setUsers(prev => [...prev, newUser]);
        setUserModalOpen(false);
    };

    const handleEditRole = (role) => {
        setEditingRole(role);
        setRoleModalOpen(true);
    };

    const handleDeleteRole = (id) => {
        if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
            setRoles(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleSaveRole = (roleData) => {
        if (editingRole) {
            setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...roleData } : r));
        } else {
            const newRole = {
                ...roleData,
                id: `role-${Date.now()}`,
                isSystem: false,
                cardClass: 'role-manager' // Default class
            };
            setRoles(prev => [...prev, newRole]);
        }
        setRoleModalOpen(false);
        setEditingRole(null);
    };

    return (
        <div className="permissions-page module-container">
            <header className="permissions-page-header">
                <div>
                    <h1 className="permissions-title">Users & Permissions</h1>
                    <p className="permissions-subtitle">Manage users, roles and access control</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn-portal create-role-btn" onClick={handleCreateNewUser}>
                        <UserCircle size={18} /> Create User
                    </button>
                    <button type="button" className="btn-portal create-role-btn" onClick={handleCreateNewRole}>
                        <ShieldCheck size={18} /> Create Role
                    </button>
                </div>
            </header>

            <div className="permissions-tabs-container">
                <div className="permissions-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        Users
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
                        onClick={() => setActiveTab('roles')}
                    >
                        Roles ({roles.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('approvals')}
                    >
                        Approval Configuration
                    </button>
                </div>
            </div>

            <main className="permissions-content">
                <AnimatePresence mode="wait">
                    {activeTab === 'users' ? (
                        <UsersTab key="users" users={filteredUsers} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
                    ) : activeTab === 'roles' ? (
                        <RolesTab key="roles" roles={roles} onEdit={handleEditRole} onDelete={handleDeleteRole} />
                    ) : (
                        <ApprovalsPage key="approvals" isTab={true} onlySettings={true} />
                    )}
                </AnimatePresence>
            </main>

            <AnimatePresence>
                {roleModalOpen && (
                    <RoleModal
                        onClose={() => { setRoleModalOpen(false); setEditingRole(null); }}
                        onSave={handleSaveRole}
                        editingRole={editingRole}
                    />
                )}
                {userModalOpen && (
                    <UserModal 
                        onClose={() => setUserModalOpen(false)}
                        onSave={handleSaveUser}
                        roles={roles}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function UsersTab({ users, searchQuery, setSearchQuery }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="users-tab-content"
        >
            <div className="search-bar-container">
                <div className="search-input-wrapper">
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="premium-table-container">
                <table className="premium-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Permissions</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>
                                    <div className="user-info-cell">
                                        <div className="perm-user-avatar">{user.avatar}</div>
                                        <div className="user-details">
                                            <div className="perm-user-name">{user.name}</div>
                                            <div className="perm-user-email">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div className="role-selector">
                                        <span>{user.role}</span>
                                        <ChevronDown size={14} />
                                    </div>
                                </td>
                                <td>
                                    <span className="permission-count-badge">
                                        {user.permissions} permissions
                                    </span>
                                </td>
                                <td>
                                    <span className="status-badge status-active">Active</span>
                                </td>
                                <td className="text-right">
                                    <div className="action-buttons">
                                        <button className="btn-icon"><Pencil size={18} /></button>
                                        <button className="btn-icon delete"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

function RolesTab({ roles, onEdit, onDelete }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="roles-grid"
        >
            {roles.map(role => (
                <motion.div
                    key={role.id}
                    className={`role-card ${role.cardClass || ''}`}
                    whileHover={{ scale: 1.02 }}
                >
                    <div className="role-card-header">
                        <div className="role-icon-container">
                            <ShieldCheck size={22} className="role-icon" />
                        </div>
                        <div className="role-card-actions">
                            <button className="btn-icon" onClick={() => onEdit(role)}><Pencil size={18} /></button>
                            <button className="btn-icon delete" onClick={() => onDelete(role.id)}><Trash2 size={18} /></button>
                        </div>
                    </div>
                    <div className="role-card-body">
                        <h3 className="role-name">{role.name}</h3>
                        <p className="role-perm-count">{role.permissionCount} permissions</p>
                        <p className="role-description">{role.description}</p>

                        <div className="role-tags">
                            {role.tags.slice(0, 4).map(tag => (
                                <span key={tag} className="role-tag">{tag}</span>
                            ))}
                            {role.tags.length > 4 && (
                                <span className="role-tag-more">+{role.tags.length - 4} more</span>
                            )}
                        </div>
                    </div>
                    {role.isSystem && (
                        <div className="role-card-footer">
                            <span className="system-role-badge">System Role</span>
                        </div>
                    )}
                </motion.div>
            ))}
        </motion.div>
    );
}

function RoleModal({ onClose, onSave, editingRole }) {
    const [name, setName] = useState(editingRole?.name || '');
    const [description, setDescription] = useState(editingRole?.description || '');
    const [selectedPermissions, setSelectedPermissions] = useState({});

    useEffect(() => {
        if (editingRole && editingRole.tags) {
            const initialMap = {};
            // Convert tags back to group-sub keys
            editingRole.tags.forEach(tag => {
                PERMISSION_GROUPS.forEach(group => {
                    const match = group.sub.find(s => s.toLowerCase() === tag.toLowerCase());
                    if (match) {
                        initialMap[`${group.id}-${match}`] = true;
                    }
                });
            });
            setSelectedPermissions(initialMap);
        }
    }, [editingRole]);

    const togglePermission = (group, sub) => {
        const key = `${group}-${sub}`;
        setSelectedPermissions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const toggleGroup = (group) => {
        const groupData = PERMISSION_GROUPS.find(g => g.id === group);
        const allSelected = groupData.sub.every(sub => selectedPermissions[`${group}-${sub}`]);

        const newSelected = { ...selectedPermissions };
        groupData.sub.forEach(sub => {
            newSelected[`${group.id}-${sub}`] = !allSelected;
        });
        setSelectedPermissions(newSelected);
    };

    const getGroupSelectedCount = (group) => {
        const groupData = PERMISSION_GROUPS.find(g => g.id === group);
        return groupData.sub.filter(sub => selectedPermissions[`${group.id}-${sub}`]).length;
    };

    const totalSelected = Object.values(selectedPermissions).filter(Boolean).length;

    const selectAll = () => {
        const totalPossible = PERMISSION_GROUPS.reduce((acc, g) => acc + g.total, 0);
        const isCurrentlyFull = totalSelected === totalPossible;
        const newSelected = {};
        PERMISSION_GROUPS.forEach(group => {
            group.sub.forEach(sub => {
                newSelected[`${group.id}-${sub}`] = !isCurrentlyFull;
            });
        });
        setSelectedPermissions(newSelected);
    };

    const handleSubmit = () => {
        if (!name.trim()) {
            alert('Please enter a role name');
            return;
        }

        const tags = Object.keys(selectedPermissions)
            .filter(key => selectedPermissions[key])
            .map(key => key.split('-')[1].toLowerCase());

        onSave({
            name,
            description,
            tags,
            permissionCount: tags.length
        });
    };

    return (
        <Modal
            title={editingRole ? "Edit Role" : "Create New Role"}
            onClose={onClose}
            className="create-role-modal"
            footer={
                <div className="modal-footer-actions">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-submit" onClick={handleSubmit}>
                        {editingRole ? "Save Changes" : "Create Role"}
                    </button>
                </div>
            }
        >
            <div className="create-role-form">
                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Role Name *</label>
                        <input
                            type="text"
                            placeholder="e.g., store_manager"
                            className="form-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="form-group flex-1">
                        <label>Description</label>
                        <input
                            type="text"
                            placeholder="Brief description"
                            className="form-input"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                <div className="permissions-header">
                    <h3>Permissions ({totalSelected} selected)</h3>
                    <button className="btn-link" onClick={selectAll}>
                        {totalSelected === PERMISSION_GROUPS.reduce((acc, g) => acc + g.total, 0) ? 'Deselect All' : 'Select All'}
                    </button>
                </div>

                <div className="permissions-groups-list">
                    {PERMISSION_GROUPS.map(group => (
                        <div key={group.id} className="permission-group-card">
                            <div className="group-header">
                                <div className="group-title-row">
                                    <label className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            checked={getGroupSelectedCount(group.id) === group.total}
                                            onChange={() => toggleGroup(group.id)}
                                        />
                                        <span className="checkmark"></span>
                                        <span className="group-name">{group.name}</span>
                                    </label>
                                    <span className="group-counter">{getGroupSelectedCount(group.id)}/{group.total}</span>
                                </div>
                            </div>
                            <div className="group-subs-grid">
                                {group.sub.map(sub => (
                                    <label key={sub} className="checkbox-container sub-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={selectedPermissions[`${group.id}-${sub}`] || false}
                                            onChange={() => togglePermission(group.id, sub)}
                                        />
                                        <span className="checkmark"></span>
                                        <span className="sub-name">{sub}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
}

function UserModal({ onClose, onSave, roles }) {
    const [selectedBranch, setSelectedBranch] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = () => {
        if (!selectedEmployee || !selectedRole || !password) {
            alert('Please fill all required fields');
            return;
        }

        const employeeName = MOCK_EMPLOYEES.find(e => e.id === selectedEmployee)?.name || 'Unknown';
        const role = roles.find(r => r.id === selectedRole);
        const roleName = role?.name || 'Unknown';
        const rolePermCount = role?.permissionCount || 0;

        onSave({
            name: employeeName,
            email: `${employeeName.toLowerCase().replace(' ', '.')}@example.com`,
            role: roleName,
            permissions: rolePermCount,
            status: 'Active',
            avatar: employeeName.charAt(0)
        });
    };

    const branchEmployees = MOCK_EMPLOYEES.filter(emp => emp.branchId === selectedBranch);

    return (
        <Modal
            title="Create New User"
            onClose={onClose}
            className="create-role-modal"
            footer={
                <div className="modal-footer-actions">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-submit" onClick={handleSubmit}>
                        Create User
                    </button>
                </div>
            }
        >
            <div className="create-role-form">
                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Branch *</label>
                        <select 
                            className="form-input" 
                            value={selectedBranch} 
                            onChange={(e) => {
                                setSelectedBranch(e.target.value);
                                setSelectedEmployee('');
                            }}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                        >
                            <option value="">Select Branch</option>
                            {MOCK_BRANCHES.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group flex-1">
                        <label>Employee *</label>
                        <select 
                            className="form-input" 
                            value={selectedEmployee} 
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            disabled={!selectedBranch}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                        >
                            <option value="">Select Employee</option>
                            {branchEmployees.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group flex-1">
                        <label>Role *</label>
                        <select 
                            className="form-input" 
                            value={selectedRole} 
                            onChange={(e) => setSelectedRole(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                        >
                            <option value="">Select Role</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group flex-1">
                        <label>Password *</label>
                        <input
                            type="password"
                            placeholder="Enter password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
