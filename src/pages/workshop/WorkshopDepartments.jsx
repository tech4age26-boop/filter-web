import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, Pencil, ShoppingCart, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
    MOCK_BRANCHES,
    MOCK_CATEGORIES,
    UNIT_OPTIONS,
} from './constants';

export default function WorkshopDepartments() {
    const { workshop } = useAuth();
    const [departments, setDepartments] = useState([]);
    const [products, setProducts] = useState([]);
    const [productCategories, setProductCategories] = useState(MOCK_CATEGORIES);
    const [activeTab, setActiveTab] = useState('products');
    const [filterDept, setFilterDept] = useState('all');
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [showDeptForm, setShowDeptForm] = useState(false);
    const [showProdForm, setShowProdForm] = useState(false);
    const [showRequestForm, setShowRequestForm] = useState(null);
    const [editingProd, setEditingProd] = useState(null);
    const [isDeptLoading, setIsDeptLoading] = useState(false);
    const [deptError, setDeptError] = useState('');
    const [isSavingDept, setIsSavingDept] = useState(false);
    const [isProductsLoading, setIsProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState('');
    const [isSavingProduct, setIsSavingProduct] = useState(false);
    const [branches, setBranches] = useState([]);
    const [productUnits, setProductUnits] = useState(UNIT_OPTIONS);
    const [defaultProductUnit, setDefaultProductUnit] = useState('pcs');
    const [categories, setCategories] = useState([]);
    const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
    const [categoriesError, setCategoriesError] = useState('');
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', type: 'product', departmentId: '' });

    const [deptForm, setDeptForm] = useState({ name: '', branch_id: 'b1' });
    const [prodForm, setProdForm] = useState({
        name: '', sku: '', category_id: '', type: 'product', unit: 'piece',
        purchase_price: '', sale_price: '', stock_qty: 0, critical_level: '', reorder_level: '', department_ids: [], branch_id: '', department_id: '',
    });

    const filteredProds = products.filter(p => {
        if (filterDept !== 'all' && !p.department_ids?.includes(filterDept)) return false;
        if (lowStockOnly && !(p.critical_level && p.stock_qty <= p.critical_level)) return false;
        return true;
    });
    const criticalCount = products.filter(p => p.critical_level && p.stock_qty <= p.critical_level).length;

    const loadDepartments = useCallback(async () => {
        setIsDeptLoading(true);
        setDeptError('');
        try {
            const response = await apiFetch('/workshop-staff/departments');
            if (response?.success && Array.isArray(response.departments)) {
                setDepartments(response.departments);
                return;
            }
            throw new Error('Invalid departments response.');
        } catch (error) {
            setDeptError(error.message || 'Failed to load departments.');
        } finally {
            setIsDeptLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDepartments();
    }, [loadDepartments]);

    const loadBranches = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/branches');
            if (response?.success && Array.isArray(response.branches)) {
                setBranches(response.branches);
            }
        } catch {
            setBranches([]);
        }
    }, []);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    const loadProductUnits = useCallback(async () => {
        try {
            const response = await apiFetch('/workshop-staff/product-units');
            if (response?.success && Array.isArray(response.units) && response.units.length > 0) {
                setProductUnits(response.units);
                setDefaultProductUnit(response.defaultUnit || response.units[0] || 'pcs');
            }
        } catch {
            setProductUnits(UNIT_OPTIONS);
            setDefaultProductUnit('pcs');
        }
    }, []);

    useEffect(() => {
        loadProductUnits();
    }, [loadProductUnits]);

    const loadCategories = useCallback(async () => {
        setIsCategoriesLoading(true);
        setCategoriesError('');
        try {
            const response = await apiFetch('/workshop-staff/categories');
            if (!(response?.success && Array.isArray(response.categories))) {
                throw new Error('Invalid categories response.');
            }
            setCategories(response.categories);
            setProductCategories(response.categories.map((category) => ({ id: category.id, name: category.name })));
        } catch (error) {
            setCategoriesError(error.message || 'Failed to load categories.');
        } finally {
            setIsCategoriesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const saveCategory = async () => {
        if (!categoryForm.name.trim() || !categoryForm.departmentId) return;
        const normalizedName = categoryForm.name.trim().toLowerCase();
        const duplicateCategory = categories.some((category) => {
            return (
                String(category.name || '').trim().toLowerCase() === normalizedName &&
                String(category.type || '').toLowerCase() === String(categoryForm.type || '').toLowerCase() &&
                String(category.departmentId || '') === String(categoryForm.departmentId || '')
            );
        });
        if (duplicateCategory) {
            setCategoriesError('A category with the same name already exists for this type and department.');
            return;
        }
        setIsSavingCategory(true);
        setCategoriesError('');
        try {
            await apiFetch('/workshop-staff/category/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: categoryForm.name.trim(),
                    type: categoryForm.type,
                    departmentId: String(categoryForm.departmentId),
                    isActive: true,
                }),
            });
            setShowCategoryForm(false);
            setCategoryForm({ name: '', type: 'product', departmentId: '' });
            await loadCategories();
        } catch (error) {
            setCategoriesError(error.message || 'Failed to create category.');
        } finally {
            setIsSavingCategory(false);
        }
    };

    const normalizeProduct = (product, category) => ({
        id: `product-${product.id}`,
        sourceId: product.id,
        name: product.name || 'Unnamed',
        sku: product.sku || '',
        category_id: product.categoryId || category?.id || '',
        type: category?.type || product.type || 'product',
        unit: product.unit || 'piece',
        purchase_price: Number(product.purchasePrice) || 0,
        sale_price: Number(product.salePrice) || 0,
        stock_qty: Number(product.openingQty) || 0,
        critical_level: Number(product.criticalStockPoint) || 0,
        reorder_level: Number(product.reorderLevel) || 0,
        department_ids: product.departmentId ? [product.departmentId] : [],
        dept: product.departmentName || '—',
        isActive: product.isActive !== false,
    });

    const normalizeService = (service) => ({
        id: `service-${service.id}`,
        sourceId: service.id,
        name: service.name || 'Unnamed Service',
        sku: '',
        category_id: service.categoryId || '',
        type: 'service',
        unit: 'service',
        purchase_price: 0,
        sale_price: Number(service.sellingPrice) || 0,
        stock_qty: 0,
        critical_level: 0,
        reorder_level: 0,
        department_ids: service.departmentId ? [service.departmentId] : [],
        dept: service.departmentName || '—',
        isActive: service.isActive !== false,
    });

    const loadProducts = useCallback(async () => {
        const workshopId = workshop?.id;
        if (!workshopId) {
            setProductsError('Workshop session missing. Please login again.');
            return;
        }

        setIsProductsLoading(true);
        setProductsError('');

        try {
            const [productsResponse, servicesResponse] = await Promise.all([
                apiFetch(`/workshop-staff/products?workshopId=${encodeURIComponent(workshopId)}`),
                apiFetch('/workshop-products/services'),
            ]);

            if (!(productsResponse?.success && Array.isArray(productsResponse.categories))) {
                throw new Error('Invalid products response.');
            }

            const normalizedProducts = [];
            const normalizedCategories = [];

            productsResponse.categories.forEach((category) => {
                normalizedCategories.push({ id: category.id, name: category.name });

                (category.productsWithoutSub || []).forEach((product) => {
                    normalizedProducts.push(normalizeProduct(product, category));
                });

                (category.subCategories || []).forEach((subCategory) => {
                    (subCategory.products || []).forEach((product) => {
                        normalizedProducts.push(normalizeProduct(product, category));
                    });
                });
            });

            const normalizedServices = Array.isArray(servicesResponse?.services)
                ? servicesResponse.services.map(normalizeService)
                : [];

            if (Array.isArray(servicesResponse?.services)) {
                servicesResponse.services.forEach((service) => {
                    if (service?.categoryId && service?.categoryName) {
                        normalizedCategories.push({ id: service.categoryId, name: service.categoryName });
                    }
                });
            }

            setProducts([...normalizedProducts, ...normalizedServices]);
            if (normalizedCategories.length > 0) {
                const deduped = Array.from(
                    new Map(normalizedCategories.map((category) => [String(category.id), category])).values()
                );
                setProductCategories(deduped);
            }
        } catch (error) {
            setProductsError(error.message || 'Failed to load products and services.');
        } finally {
            setIsProductsLoading(false);
        }
    }, [workshop?.id]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const saveDept = async () => {
        if (!deptForm.name) return;
        setIsSavingDept(true);
        setDeptError('');
        try {
            await apiFetch('/workshop-staff/department/create', {
                method: 'POST',
                body: JSON.stringify({
                    name: deptForm.name,
                    isActive: true,
                }),
            });
            await loadDepartments();
            setShowDeptForm(false);
            setDeptForm({ name: '', branch_id: 'b1' });
        } catch (error) {
            setDeptError(error.message || 'Failed to create department.');
        } finally {
            setIsSavingDept(false);
        }
    };
    const openAddProd = () => {
        setEditingProd(null);
        setProdForm({
            name: '',
            sku: '',
            category_id: '',
            type: 'product',
            unit: defaultProductUnit || 'pcs',
            purchase_price: '',
            sale_price: '',
            stock_qty: 0,
            critical_level: '',
            reorder_level: '',
            department_ids: [],
            branch_id: branches[0]?.id || '',
            department_id: departments[0]?.id || '',
        });
        setShowProdForm(true);
    };
    const openEditProd = (p) => {
        setEditingProd(p);
        setProdForm({
            ...p,
            purchase_price: p.purchase_price || '',
            sale_price: p.sale_price || '',
            critical_level: p.critical_level || '',
            reorder_level: p.reorder_level || '',
            branch_id: p.branch_id || branches[0]?.id || '',
            department_id: p.department_id || p.department_ids?.[0] || departments[0]?.id || '',
        });
        setShowProdForm(true);
    };
    const saveProd = async () => {
        if (!prodForm.name) return;
        const data = {
            ...prodForm,
            sale_price: parseFloat(prodForm.sale_price) || 0, purchase_price: parseFloat(prodForm.purchase_price) || 0,
            stock_qty: parseInt(prodForm.stock_qty) || 0, critical_level: parseFloat(prodForm.critical_level) || 0,
            reorder_level: parseFloat(prodForm.reorder_level) || 0,
            department_ids: prodForm.department_ids?.length ? prodForm.department_ids : [prodForm.department_id || editingProd?.department_ids?.[0] || departments[0]?.id].filter(Boolean),
            department_id: prodForm.department_id || editingProd?.department_ids?.[0] || departments[0]?.id || '',
            branch_id: prodForm.branch_id || branches[0]?.id || '',
            dept: editingProd?.dept || departments[0]?.name || 'Lubrication',
        };

        const workshopId = workshop?.id;
        if (!workshopId) {
            setProductsError('Workshop session missing. Please login again.');
            return;
        }

        setIsSavingProduct(true);
        setProductsError('');

        if (editingProd) {
            try {
                const sourceId = editingProd.sourceId || String(editingProd.id).replace(/^product-/, '').replace(/^service-/, '');
                const isService = data.type === 'service' || String(editingProd.id).startsWith('service-');

                if (isService) {
                    await apiFetch(`/workshop-staff/service/${sourceId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            name: data.name,
                            categoryId: String(data.category_id || ''),
                            departmentId: String(data.department_id || data.department_ids?.[0] || ''),
                            sellingPrice: data.sale_price,
                            minPriceCorporate: 0,
                            maxPriceCorporate: 0,
                            isActive: true,
                        }),
                    });
                } else {
                    await apiFetch(`/workshop-staff/product/${sourceId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            name: data.name,
                            unit: data.unit || defaultProductUnit || 'pcs',
                            purchasePrice: data.purchase_price,
                            salePrice: data.sale_price,
                            openingQty: data.stock_qty,
                            criticalStockPoint: data.critical_level,
                            categoryId: String(data.category_id || ''),
                            allowDecimalQty: true,
                            minPriceCorporate: 0,
                            maxPriceCorporate: 0,
                            isActive: true,
                        }),
                    });
                }
                await loadProducts();
                setShowProdForm(false);
            } catch (error) {
                setProductsError(error.message || 'Failed to update item.');
            } finally {
                setIsSavingProduct(false);
            }
            return;
        }

        try {
            await apiFetch('/workshop-staff/product/create', {
                method: 'POST',
                body: JSON.stringify({
                    workshopId: String(workshopId),
                    branchId: String(data.branch_id || ''),
                    name: data.name,
                    departmentId: String(data.department_id || ''),
                    categoryId: String(data.category_id || ''),
                    unit: data.unit || defaultProductUnit || 'pcs',
                    purchasePrice: data.purchase_price,
                    salePrice: data.sale_price,
                    openingQty: data.stock_qty,
                    minPriceCorporate: 0,
                    maxPriceCorporate: 0,
                    criticalStockPoint: data.critical_level,
                    kmTypeValue: 0,
                    allowDecimalQty: true,
                    type: data.type || 'product',
                    isActive: true,
                }),
            });
            await loadProducts();
            setShowProdForm(false);
        } catch (error) {
            setProductsError(error.message || 'Failed to create product.');
        } finally {
            setIsSavingProduct(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">Dept & Products</h2><p className="ws-page-sub">Departments and product catalog with stock levels</p></div>
            </div>

            {criticalCount > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:12,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,padding:14,marginBottom:20}}>
                    <AlertTriangle size={20} style={{color:'#DC2626',flexShrink:0}}/>
                    <p style={{margin:0,fontSize:'0.875rem',fontWeight:600,color:'#DC2626'}}>
                        {criticalCount} product{criticalCount > 1 ? 's are' : ' is'} at or below critical stock level — suppliers have been notified.
                    </p>
                </div>
            )}

            <div style={{display:'flex',gap:8,marginBottom:20,borderBottom:'1px solid var(--color-border)'}}>
                <button onClick={() => setActiveTab('departments')} style={{padding:'10px 18px',border:'none',borderBottom: activeTab==='departments' ? '2px solid var(--color-text-dark)' : '2px solid transparent',background:'none',fontWeight:700,fontSize:'0.875rem',color: activeTab==='departments' ? 'var(--color-text-dark)' : 'var(--color-text-muted)',cursor:'pointer'}}>
                    Departments ({departments.length})
                </button>
                <button onClick={() => setActiveTab('products')} style={{padding:'10px 18px',border:'none',borderBottom: activeTab==='products' ? '2px solid var(--color-text-dark)' : '2px solid transparent',background:'none',fontWeight:700,fontSize:'0.875rem',color: activeTab==='products' ? 'var(--color-text-dark)' : 'var(--color-text-muted)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                    Products & Services
                    {criticalCount > 0 && <span className="ws-nav-badge" style={{marginLeft:4}}>{criticalCount}</span>}
                </button>
                <button onClick={() => setActiveTab('categories')} style={{padding:'10px 18px',border:'none',borderBottom: activeTab==='categories' ? '2px solid var(--color-text-dark)' : '2px solid transparent',background:'none',fontWeight:700,fontSize:'0.875rem',color: activeTab==='categories' ? 'var(--color-text-dark)' : 'var(--color-text-muted)',cursor:'pointer'}}>
                    Categories ({categories.length})
                </button>
            </div>

            {activeTab === 'departments' && (
                <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                        <button className="btn-portal" onClick={loadDepartments} disabled={isDeptLoading}>
                            <RefreshCw size={14} /> {isDeptLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button className="btn-portal" onClick={() => setShowDeptForm(true)}><Plus size={14}/> Add Department</button>
                    </div>
                    {deptError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {deptError}
                        </div>
                    )}
                    <div className="ws-section">
                        <table className="ws-table">
                            <thead><tr><th>Name</th><th>Workshop ID</th><th>Status</th></tr></thead>
                            <tbody>
                                {departments.length === 0 ? (
                                    <tr><td colSpan={3} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>{isDeptLoading ? 'Loading departments...' : 'No departments found'}</td></tr>
                                ) : departments.map(d => {
                                    const isActive = Boolean(d.isActive ?? d.status === 'active');
                                    return (
                                        <tr key={d.id}>
                                            <td><strong>{d.name}</strong></td>
                                            <td>{d.workshopId || '—'}</td>
                                            <td><span className={`ws-badge ${isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>{isActive ? 'active' : 'inactive'}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'products' && (
                <div>
                    {productsError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {productsError}
                        </div>
                    )}
                    <div className="ws-section" style={{marginBottom:16}}>
                        <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',justifyContent:'space-between',padding:16}}>
                            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                                <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid var(--color-border)',fontSize:'0.875rem',minWidth:160}}>
                                    <option value="all">All Departments</option>
                                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <button onClick={()=>setLowStockOnly(!lowStockOnly)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:`1px solid ${lowStockOnly?'#FCA5A5':'var(--color-border)'}`,background:lowStockOnly?'#FEF2F2':'#fff',color:lowStockOnly?'#DC2626':'var(--color-text-muted)',fontWeight:700,fontSize:'0.8125rem',cursor:'pointer'}}>
                                    <AlertTriangle size={14}/> Low Stock Only
                                </button>
                            </div>
                            <div style={{display:'flex',gap:10}}>
                                <button className="btn-portal" onClick={loadProducts} disabled={isProductsLoading}>
                                    <RefreshCw size={14}/> {isProductsLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                                <button className="btn-portal" onClick={openAddProd}><Plus size={14}/> Add Product/Service</button>
                            </div>
                        </div>
                    </div>
                    <div className="ws-section">
                        <div style={{overflowX:'auto'}}>
                            <table className="ws-table">
                                <thead><tr><th>Name</th><th>SKU</th><th>Type</th><th>Unit</th><th>Sale Price</th><th>Purchase Price</th><th>Stock Qty</th><th>Critical</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>{filteredProds.length === 0 ? (
                                    <tr><td colSpan={10} style={{padding:40,textAlign:'center',color:'var(--color-text-muted)'}}>{isProductsLoading ? 'Loading products...' : 'No products found'}</td></tr>
                                ) : filteredProds.map(p => {
                                    const isCritical = p.critical_level && p.stock_qty <= p.critical_level;
                                    return (
                                        <tr key={p.id} style={{background: isCritical ? '#FEF2F2' : undefined}}>
                                            <td><strong>{p.name}</strong></td>
                                            <td style={{fontFamily:'monospace',fontSize:'0.8rem',color:'var(--color-text-muted)'}}>{p.sku || '—'}</td>
                                            <td><span className="ws-badge ws-badge--gray">{p.type}</span></td>
                                            <td style={{textTransform:'capitalize'}}>{p.unit}</td>
                                            <td>SAR {(p.sale_price||0).toFixed(2)}</td>
                                            <td style={{color:'var(--color-text-muted)'}}>SAR {(p.purchase_price||0).toFixed(2)}</td>
                                            <td><span style={{fontWeight:700,color:isCritical?'#DC2626':'inherit'}}>{p.stock_qty ?? '—'}</span></td>
                                            <td style={{color:'var(--color-text-muted)'}}>{p.critical_level ?? '—'}</td>
                                            <td><span className={`ws-badge ${isCritical?'ws-badge--red':'ws-badge--green'}`}>{isCritical ? '⚠ Critical' : 'OK'}</span></td>
                                            <td>
                                                <div style={{display:'flex',gap:6}}>
                                                    <button onClick={()=>openEditProd(p)} style={{padding:'4px 10px',background:'#EFF6FF',color:'#2563EB',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',fontSize:'0.75rem'}}><Pencil size={12}/></button>
                                                    <button onClick={()=>setShowRequestForm(p)} title="Request stock from supplier" style={{padding:'4px 10px',background:'#fff',color:'#2563EB',border:'1px solid #93C5FD',borderRadius:6,fontWeight:600,cursor:'pointer',fontSize:'0.75rem'}}><ShoppingCart size={12}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'categories' && (
                <div>
                    <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10,marginBottom:16}}>
                        <button className="btn-portal" onClick={loadCategories} disabled={isCategoriesLoading}>
                            <RefreshCw size={14} /> {isCategoriesLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button className="btn-portal" onClick={() => setShowCategoryForm(true)}>
                            <Plus size={14}/> Add Category
                        </button>
                    </div>
                    {categoriesError && (
                        <div style={{ marginBottom: 16, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, fontSize: '0.875rem' }}>
                            {categoriesError}
                        </div>
                    )}
                    <div className="ws-section">
                        <div style={{overflowX:'auto'}}>
                            <table className="ws-table">
                                <thead><tr><th>Name</th><th>Type</th><th>Department</th></tr></thead>
                                <tbody>
                                    {categories.length === 0 ? (
                                        <tr><td colSpan={3} style={{padding:40,textAlign:'center',color:'var(--color-text-muted)'}}>{isCategoriesLoading ? 'Loading categories...' : 'No categories found'}</td></tr>
                                    ) : categories.map((category) => (
                                        <tr key={category.id}>
                                            <td><strong>{category.name}</strong></td>
                                            <td><span className="ws-badge ws-badge--gray">{category.type || '—'}</span></td>
                                            <td>{category.departmentName || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showDeptForm && <Modal title="Add Department" onClose={()=>setShowDeptForm(false)} footer={<div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-secondary" onClick={()=>setShowDeptForm(false)}>Cancel</button><button className="btn-submit" disabled={isSavingDept || !deptForm.name.trim()} onClick={saveDept}>{isSavingDept ? 'Saving...' : 'Save'}</button></div>}>
                    <div className="ws-form-grid">
                        <div className="ws-field"><label>Name *</label><input value={deptForm.name} onChange={e=>setDeptForm(f=>({...f,name:e.target.value}))}/></div>
                        <div className="ws-field"><label>Branch</label><select value={deptForm.branch_id} onChange={e=>setDeptForm(f=>({...f,branch_id:e.target.value}))}><option value="b1">Main Branch — Riyadh</option>{MOCK_BRANCHES.filter(b=>!b.includes('Main')).map((b,i)=><option key={i} value={'b'+(i+2)}>{b}</option>)}</select></div>
                    </div>
                </Modal>}
                {showProdForm && (
                    <Modal title={editingProd ? 'Edit Product/Service' : 'Add Product/Service'} onClose={()=>setShowProdForm(false)} footer={<div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-secondary" onClick={()=>setShowProdForm(false)}>Cancel</button><button className="btn-submit" disabled={isSavingProduct || !prodForm.name.trim()} onClick={saveProd}>{isSavingProduct ? 'Saving...' : 'Save'}</button></div>}>
                        <div className="ws-form-grid">
                            <div className="ws-field" style={{gridColumn:'1/-1'}}><label>Name *</label><input value={prodForm.name} onChange={e=>setProdForm(f=>({...f,name:e.target.value}))}/></div>
                            <div className="ws-field"><label>SKU / Barcode</label><input value={prodForm.sku} onChange={e=>setProdForm(f=>({...f,sku:e.target.value}))} placeholder="Optional"/></div>
                            <div className="ws-field"><label>Category</label><select value={prodForm.category_id} onChange={e=>setProdForm(f=>({...f,category_id:e.target.value}))}><option value="">Select Category</option>{productCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div className="ws-field"><label>Branch</label><select value={prodForm.branch_id} onChange={e=>setProdForm(f=>({...f,branch_id:e.target.value}))}><option value="">Select Branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                            <div className="ws-field"><label>Department</label><select value={prodForm.department_id} onChange={e=>setProdForm(f=>({...f,department_id:e.target.value,department_ids:e.target.value?[e.target.value]:[]}))}><option value="">Select Department</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                            <div className="ws-field"><label>Type</label><select value={prodForm.type} onChange={e=>setProdForm(f=>({...f,type:e.target.value}))}><option value="product">Product</option><option value="service">Service</option></select></div>
                            <div className="ws-field"><label>Unit</label><select value={prodForm.unit} onChange={e=>setProdForm(f=>({...f,unit:e.target.value}))}>{productUnits.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
                            <div className="ws-field"><label>Purchase Price (SAR)</label><input type="number" value={prodForm.purchase_price} onChange={e=>setProdForm(f=>({...f,purchase_price:e.target.value}))}/></div>
                            <div className="ws-field"><label>Sale Price (SAR, incl. VAT)</label><input type="number" value={prodForm.sale_price} onChange={e=>setProdForm(f=>({...f,sale_price:e.target.value}))}/></div>
                            <div className="ws-field"><label>Current Stock Qty</label><input type="number" value={prodForm.stock_qty} onChange={e=>setProdForm(f=>({...f,stock_qty:e.target.value}))}/></div>
                            <div className="ws-field"><label>Critical Level <span style={{fontSize:'0.6875rem',color:'#DC2626'}}>(alert threshold)</span></label><input type="number" value={prodForm.critical_level} onChange={e=>setProdForm(f=>({...f,critical_level:e.target.value}))}/></div>
                            <div className="ws-field"><label>Reorder Level</label><input type="number" value={prodForm.reorder_level} onChange={e=>setProdForm(f=>({...f,reorder_level:e.target.value}))}/></div>
                        </div>
                        {prodForm.critical_level && prodForm.stock_qty <= parseFloat(prodForm.critical_level) && (
                            <div style={{display:'flex',alignItems:'center',gap:8,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:10,padding:12,marginTop:16,fontSize:'0.8125rem',color:'#DC2626'}}>
                                <AlertTriangle size={16}/> Current stock is at/below critical level — saving will notify all active suppliers.
                            </div>
                        )}
                    </Modal>
                )}
                {showRequestForm && (
                    <Modal title={`Request Stock — ${showRequestForm.name}`} onClose={()=>setShowRequestForm(null)} footer={<div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-secondary" onClick={()=>setShowRequestForm(null)}>Cancel</button><button className="btn-submit" onClick={()=>{ alert('Stock request submitted for approval'); setShowRequestForm(null); }}>Submit Request</button></div>}>
                        <div style={{display:'flex',flexDirection:'column',gap:14}}>
                            <div style={{background:'var(--color-bg-muted)',padding:14,borderRadius:10}}>
                                <p style={{fontSize:'0.6875rem',fontWeight:700,color:'var(--color-text-muted)',margin:'0 0 4px'}}>Current Stock</p>
                                <p style={{fontSize:'1.25rem',fontWeight:900,margin:0}}>{showRequestForm.stock_qty} <span style={{fontSize:'0.875rem',fontWeight:500,color:'var(--color-text-muted)'}}>{showRequestForm.unit}</span></p>
                                {showRequestForm.critical_level && showRequestForm.stock_qty <= showRequestForm.critical_level && <span className="ws-badge ws-badge--red" style={{marginTop:8,display:'inline-block'}}>⚠ Below critical level</span>}
                            </div>
                            <div className="ws-field"><label>Supplier / Warehouse</label><select><option>Al-Jazeera Auto Parts</option><option>Gulf Lubricants Co.</option><option>Saudi Tire Trading</option></select></div>
                            <div className="ws-field"><label>Quantity Requested ({showRequestForm.unit})</label><input type="number" placeholder={`Enter qty in ${showRequestForm.unit}`}/></div>
                            <div className="ws-field"><label>Notes</label><input placeholder="Optional notes..."/></div>
                        </div>
                    </Modal>
                )}
                {showCategoryForm && (
                    <Modal
                        title="Add Category"
                        onClose={() => setShowCategoryForm(false)}
                        footer={
                            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                                <button className="btn-secondary" onClick={() => setShowCategoryForm(false)} disabled={isSavingCategory}>Cancel</button>
                                <button className="btn-submit" onClick={saveCategory} disabled={isSavingCategory || !categoryForm.name.trim() || !categoryForm.departmentId}>
                                    {isSavingCategory ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        }
                    >
                        <div className="ws-form-grid">
                            <div className="ws-field" style={{gridColumn:'1/-1'}}>
                                <label>Name *</label>
                                <input value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="ws-field">
                                <label>Type *</label>
                                <select value={categoryForm.type} onChange={e => setCategoryForm(f => ({ ...f, type: e.target.value }))}>
                                    <option value="product">Product</option>
                                    <option value="service">Service</option>
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Department *</label>
                                <select value={categoryForm.departmentId} onChange={e => setCategoryForm(f => ({ ...f, departmentId: e.target.value }))}>
                                    <option value="">Select Department</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>{department.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
