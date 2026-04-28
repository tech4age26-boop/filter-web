import React, { useState, useEffect } from 'react';
import { Search, X, User, Check, RefreshCw, AlertTriangle, Users } from 'lucide-react';
import { apiFetch } from '../../../services/api';

export default function TechnicianAssignmentModal({ 
    job, 
    selectedTechs, 
    onConfirm,
    onClose,
    loading: parentLoading
}) {
    const [search, setSearch] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [localSelected, setLocalSelected] = useState(selectedTechs || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const deptId = job.departmentId || job.deptId || job.department?.id || job.department_id;
    const deptName = job.departmentName || job.department?.name || job.department || 'Workshop';

    useEffect(() => {
        const fetchTechs = async () => {
            setLoading(true);
            setError(null);
            try {
                const query = deptId ? `?departmentId=${deptId}` : '';
                const url = `/cashier/technicians${query}`;
                const res = await apiFetch(url);
                const data = Array.isArray(res) ? res : (res.technicians || res.data || []);
                setTechnicians(data);
            } catch (err) {
                console.error('Fetch Techs Error:', err);
                if (err.message?.includes('supplier_id')) {
                    setError('Backend database error: missing supplier_id column. Please contact support.');
                } else {
                    setError('Could not load technicians');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchTechs();
    }, [deptId]);

    const getTechId = (tech) => {
        return tech.employeeId || tech.id || tech.userId || 
               tech.employee?.id || tech.user?.id || tech.technician?.id;
    };

    const handleToggleTech = (tech) => {
        const techId = getTechId(tech);
        setLocalSelected(prev => {
            const exists = prev.find(t => getTechId(t) === techId);
            if (exists) {
                return prev.filter(t => getTechId(t) !== techId);
            } else {
                return [...prev, { ...tech, id: techId, name: tech.name || tech.employeeName }];
            }
        });
    };

    const handleConfirm = () => {
        onConfirm(localSelected);
    };

    const filteredTechs = technicians.filter(t => {
        // Filter by Department (Dynamic & Robust)
        const techDeptId = t.departmentId || t.department?.id || t.deptId || t.department;
        const matchesDept = !deptId || 
                           String(techDeptId).toLowerCase() === String(deptId).toLowerCase() ||
                           (t.departmentName && String(t.departmentName).toLowerCase() === String(deptId).toLowerCase()) ||
                           (t.department?.name && String(t.department.name).toLowerCase() === String(deptId).toLowerCase());
        
        // Filter by Search
        const name = t.name || t.employeeName || '';
        const spec = t.specialization || t.role || '';
        const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) ||
                             spec.toLowerCase().includes(search.toLowerCase());

        // If tech has no department info, we show them anyway as fallback
        const isFallback = !techDeptId;

        return (matchesDept || isFallback) && matchesSearch;
    });

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-compact" onClick={e => e.stopPropagation()}>
                {/* Header: Slim and Simple */}
                <div className="modal-header-slim">
                    <div className="header-info-compact">
                        <Users size={20} color="var(--pos-gold)" />
                        <div>
                            <h3 className="modal-title-small">Assign Staff</h3>
                            <p className="modal-subtitle-small">{deptName}</p>
                        </div>
                    </div>
                    <button className="close-btn-minimal" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="modal-body-compact">
                    {/* Search Bar: More integrated */}
                    <div className="search-box-minimal">
                        <Search size={16} />
                        <input 
                            type="text" 
                            placeholder="Search name or role..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="tech-list-slim custom-scrollbar">
                        {loading ? (
                            <div className="compact-loading">
                                <RefreshCw size={24} className="animate-spin" color="var(--pos-gold)" />
                            </div>
                        ) : error ? (
                            <div className="compact-error">{error}</div>
                        ) : filteredTechs.length === 0 ? (
                            <div className="compact-empty">No personnel found</div>
                        ) : (
                            filteredTechs.map(t => {
                                const empId = getTechId(t);
                                const isSel = localSelected.some(st => getTechId(st) === empId);
                                
                                const wasInBackend = (job.technicians || []).some(bt => getTechId(bt) === empId);
                                let displayUsedSlots = t.usedSlots || 0;
                                if (isSel && !wasInBackend) displayUsedSlots += 1;
                                if (!isSel && wasInBackend) displayUsedSlots = Math.max(0, displayUsedSlots - 1);

                                const isOnline = t.status?.toLowerCase() !== 'offline';
                                const isBusy = displayUsedSlots >= (t.totalSlots || 3);
                                
                                return (
                                    <div 
                                        key={empId || Math.random()} 
                                        className={`tech-row-slim ${isSel ? 'selected' : ''}`}
                                        onClick={() => empId && handleToggleTech(t)}
                                    >
                                        <div className="tech-avatar-slim">
                                            <div className="avatar-initial">
                                                {(t.name || t.employeeName || 'T').charAt(0)}
                                            </div>
                                            <div className={`tech-status-dot-minimal ${isOnline ? (isBusy ? 'busy' : 'online') : 'offline'}`} />
                                        </div>

                                        <div className="tech-details-slim">
                                            <span className="tech-name-slim">{t.name || t.employeeName}</span>
                                            <span className="tech-role-slim">{t.specialization || t.role || 'Technician'}</span>
                                        </div>

                                        <div className="tech-meta-slim">
                                            <div className="slot-badge">
                                                {displayUsedSlots}/{t.totalSlots || 3}
                                            </div>
                                            {isSel && <div className="check-box-minimal"><Check size={14} /></div>}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Footer: Compact and functional */}
                <div className="modal-footer-compact">
                    <div className="selection-stats-minimal">
                        <span className="count-label">{localSelected.length} Selected</span>
                        {localSelected.length > 0 && (
                            <button className="btn-reset-minimal" onClick={() => setLocalSelected([])}>Clear</button>
                        )}
                    </div>
                    <div className="footer-btns-compact">
                        <button className="btn-cancel-minimal" onClick={onClose}>Cancel</button>
                        <button 
                            className="btn-save-minimal" 
                            onClick={handleConfirm} 
                            disabled={parentLoading}
                        >
                            {parentLoading ? '...' : 'Assign'}
                        </button>
                    </div>
                </div>
            </div>
            
            <style>{`
                .search-box-minimal {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #f1f5f9;
                    border-radius: 12px;
                    padding: 8px 14px;
                    margin-bottom: 12px;
                    color: #94a3b8;
                }
                .search-box-minimal input {
                    background: none;
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .tech-list-slim {
                    max-height: 380px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .tech-row-slim {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.15s;
                    border: 1.5px solid transparent;
                }
                .tech-row-slim:hover {
                    background: #f8fafc;
                }
                .tech-row-slim.selected {
                    background: #fff9ec;
                    border-color: #fcc247;
                }

                .tech-avatar-slim {
                    position: relative;
                    flex-shrink: 0;
                    width: 36px;
                    height: 36px;
                }
                .avatar-initial {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 0.9rem;
                    color: #64748b;
                }
                .selected .avatar-initial {
                    background: #fcc247;
                    color: #1e293b;
                }
                .tech-status-dot-minimal {
                    position: absolute;
                    bottom: -1px;
                    right: -1px;
                    width: 11px;
                    height: 11px;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    z-index: 2;
                }
                .tech-status-dot-minimal.online { background: #10b981; }
                .tech-status-dot-minimal.busy { background: #f97316; }
                .tech-status-dot-minimal.offline { background: #94a3b8; }

                .tech-details-slim {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .tech-name-slim {
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: #1e293b;
                }
                .tech-role-slim {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: #94a3b8;
                }

                .tech-meta-slim {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .slot-badge {
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #64748b;
                    background: #f1f5f9;
                    padding: 2px 6px;
                    border-radius: 6px;
                }
                .check-box-minimal {
                    width: 20px;
                    height: 20px;
                    border-radius: 6px;
                    background: #fcc247;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #1e293b;
                }

                .selection-stats-minimal {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .count-label {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                }
                .btn-reset-minimal {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 0.7rem;
                    font-weight: 800;
                    cursor: pointer;
                    padding: 2px 4px;
                }

                .footer-btns-compact {
                    display: flex;
                    gap: 8px;
                }

                .compact-loading, .compact-error, .compact-empty {
                    padding: 40px 0;
                    text-align: center;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #94a3b8;
                }
            `}</style>
        </div>
    );
}


