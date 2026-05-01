import { apiFetch } from './api';

/** Build a query string for GET requests (omits null/undefined/empty). */
export function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

/**
 * Optional `branchId` for workshop-staff list endpoints when the sidebar branch is not "all".
 * Backends may ignore this if unsupported; callers can still client-filter rows when fields exist.
 */
export function branchScopeParams(selectedBranchId) {
    if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') return {};
    return { branchId: String(selectedBranchId) };
}

/**
 * For GET /workshop-staff/products, /workshop-staff/commissions, etc.:
 * one branch → `branchId`; all branches in the UI → `allBranches=true` (required by the API).
 */
export function workshopStaffListScopeQuery(selectedBranchId) {
    if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') {
        return { allBranches: true };
    }
    return { branchId: String(selectedBranchId) };
}

function unwrapList(res, keys = ['data', 'technicians', 'cashiers', 'users', 'items']) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of keys) {
        const v = res[k];
        if (Array.isArray(v)) return v;
    }
    const data = res.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const k of keys) {
            const v = data[k];
            if (Array.isArray(v)) return v;
        }
    }
    return [];
}

export function unwrapWorkshopStaffList(res, kind) {
    const keys =
        kind === 'technician'
            ? ['technicians', 'data', 'items', 'users', 'rows', 'results', 'list']
            : ['cashiers', 'data', 'items', 'users', 'rows', 'results', 'list'];
    return unwrapList(res, keys);
}

/**
 * Workshop JWT — list technicians for this workshop.
 * Supported query params: `branchId` (filter to one branch), `isActive`
 * ('true' | 'false'). With nothing passed, returns the workshop-wide list.
 */
export const getWorkshopTechnicians = (params = {}) =>
    apiFetch(`/workshop-staff/technicians${qs(params)}`);

/**
 * Workshop JWT — list cashiers.
 * Supported query params: `branchId`, `isActive` ('true' | 'false').
 */
export const getWorkshopCashiers = (params = {}) =>
    apiFetch(`/workshop-staff/cashiers${qs(params)}`);

/** GET one technician (often includes user/email fields omitted from list responses). */
export const getWorkshopTechnicianById = (id) =>
    apiFetch(`/workshop-staff/technicians/${encodeURIComponent(String(id))}`);

/** GET one cashier. */
export const getWorkshopCashierById = (id) =>
    apiFetch(`/workshop-staff/cashiers/${encodeURIComponent(String(id))}`);

/**
 * Merge inner DTO when the API wraps rows as `{ technician: {...} }` or `{ cashier: {...} }`.
 * @param {object} row
 * @param {'technician'|'cashier'} kind
 */
export function flattenWorkshopStaffRow(row, kind) {
    if (row == null || typeof row !== 'object') return row;
    const inner =
        kind === 'technician'
            ? row.technician ?? row.technicianUser ?? row.tech ?? row.staff
            : row.cashier ?? row.cashierUser ?? row.staff;
    if (inner != null && typeof inner === 'object' && !Array.isArray(inner)) {
        return { ...inner, ...row };
    }
    return row;
}

/**
 * Single-resource JSON from GET /technicians/:id or POST create response.
 * @param {object} res
 * @param {'technician'|'cashier'} kind
 */
export function unwrapWorkshopStaffDetail(res, kind) {
    if (res == null || typeof res !== 'object') return null;
    const keys =
        kind === 'technician'
            ? ['technician', 'data', 'employee', 'profile', 'result', 'payload']
            : ['cashier', 'data', 'employee', 'profile', 'result', 'payload'];
    for (const k of keys) {
        const v = res[k];
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
            return flattenWorkshopStaffRow(v, kind);
        }
    }
    if (
        res.id != null ||
        res.userId != null ||
        res._id != null ||
        res.name != null ||
        res.mobile != null ||
        res.phone != null
    ) {
        return flattenWorkshopStaffRow(res, kind);
    }
    return null;
}

/**
 * Create a technician.
 * Preferred route: POST /workshop-staff/technician/create.
 * Backward compatibility: if unavailable, fallback to POST /workshop-staff/technicians.
 * Body: { name, mobile, email?, password?, technicianType?, workshopDuty?, oncallAvailable?, commissionPercent,
 *         branchId?, departmentIds?, basicSalary?, iqama? }.
 */
export const createWorkshopTechnician = async (body) => {
    try {
        return await apiFetch('/workshop-staff/technician/create', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    } catch (primaryErr) {
        // Older backends used the plural route for create.
        try {
            return await apiFetch('/workshop-staff/technicians', {
                method: 'POST',
                body: JSON.stringify(body),
            });
        } catch {
            throw primaryErr;
        }
    }
};

/**
 * Create a cashier.
 * Body: { name, branchId, mobile?, email?, password?, iqama? }.
 * `branchId` is required server-side (cashiers.branch_id is NOT NULL); the BE
 * returns 400 if missing.
 */
export const createWorkshopCashier = (body) =>
    apiFetch('/workshop-staff/cashiers', { method: 'POST', body: JSON.stringify(body) });

/** Patch a technician. All fields optional: name, mobile, email, password, branchId, technicianType, workshopDuty, oncallAvailable, commissionPercent, basicSalary, iqama, departmentIds, isActive. */
export const updateWorkshopTechnician = (id, body) =>
    apiFetch(`/workshop-staff/technicians/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/** Patch a cashier. All fields optional: name, mobile, email, password, branchId, iqama, isActive. */
export const updateWorkshopCashier = (id, body) =>
    apiFetch(`/workshop-staff/cashiers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteWorkshopTechnician = (id) =>
    apiFetch(`/workshop-staff/technicians/${id}`, { method: 'DELETE' });

export const deleteWorkshopCashier = (id) =>
    apiFetch(`/workshop-staff/cashiers/${id}`, { method: 'DELETE' });

export const getWorkshopBranches = () => apiFetch('/workshop-staff/branches');

/**
 * Workshop JWT — nested tree for one branch (departments → categories → items).
 * Use when the UI needs hierarchy (e.g. POS menus). Prefer flat lists below for tables/dropdowns.
 */
export const getWorkshopStaffBranchCatalog = (branchId, { signal } = {}) =>
    apiFetch(`/workshop-staff/branches/${encodeURIComponent(branchId)}/catalog`, { signal });

/**
 * Workshop JWT — flat branch product list. Branch is always in the path.
 * `workshopId` query is optional: the backend uses `query.workshopId || req.user.workshopId`.
 * Omit it for normal workshop tokens; pass it for impersonation / super-admin-style flows.
 */
export const getWorkshopStaffBranchProducts = (branchId, { signal, workshopId } = {}) =>
    apiFetch(
        `/workshop-staff/branches/${encodeURIComponent(branchId)}/products${qs({ workshopId })}`,
        { signal },
    );

/** Flat branch service list (same contract as products). */
export const getWorkshopStaffBranchServices = (branchId, { signal, workshopId } = {}) =>
    apiFetch(
        `/workshop-staff/branches/${encodeURIComponent(branchId)}/services${qs({ workshopId })}`,
        { signal },
    );

/**
 * GET /workshop-staff/products — **branchId** (or **branch_id**) is required unless **allBranches=true**
 * (workshop-wide union). Prefer `getWorkshopStaffBranchProducts(id)` where the branch is always in the path.
 *
 * `workshopId` is optional when the JWT already carries the workshop (same resolution as branch …/products).
 * Example with only a workshop token: `getWorkshopStaffProducts({ allBranches: true })`.
 * Pass `workshopId` when impersonating. If neither query nor user has a workshop, the API returns **400** (not 401).
 */
export const getWorkshopStaffProducts = (params = {}) =>
    apiFetch(`/workshop-staff/products${qs(params)}`);

/**
 * GET /workshop-staff/services — same contract as products (branchId / allBranches=true / optional workshopId).
 */
export const getWorkshopStaffServices = (params = {}) =>
    apiFetch(`/workshop-staff/services${qs(params)}`);

/**
 * Query for GET /workshop-staff/reports-analytics (same branch rule as products: branchId or allBranches=true).
 * Sends both snake_case and camelCase date / technician keys for DTO compatibility.
 * @param {string|number|'all'|undefined} selectedBranchId
 * @param {{ startDate?: string, endDate?: string, technicianId?: string }} opts — ISO YYYY-MM-DD (UTC calendar days on server)
 */
export function workshopReportsAnalyticsParams(selectedBranchId, opts = {}) {
    const { startDate = '', endDate = '', technicianId = '' } = opts;
    const q = { ...workshopStaffListScopeQuery(selectedBranchId) };
    if (q.branchId != null && q.branchId !== '') q.branch_id = q.branchId;
    if (startDate) {
        q.start_date = startDate;
        q.startDate = startDate;
    }
    if (endDate) {
        q.end_date = endDate;
        q.endDate = endDate;
    }
    if (technicianId != null && String(technicianId) !== '') {
        const tid = String(technicianId);
        q.technician_id = tid;
        q.employee_id = tid;
    }
    return q;
}

/** Workshop JWT — bundled KPIs, daily revenue, by technician/customer/product/department/branch. */
export const getWorkshopReportsAnalytics = (params = {}, options = {}) =>
    apiFetch(`/workshop-staff/reports-analytics${qs(params)}`, options);

/**
 * Flat list from GET .../branches/:id/products|services (workshop-staff or workshop-catalog) and
 * similar workshop-product payloads. Staff APIs may use `items`, `rows`, or `data` instead of `products`.
 * @param {'products'|'services'} kind
 */
export function unwrapWorkshopBranchListResponse(res, kind = 'products') {
    if (res == null) return [];
    if (Array.isArray(res)) return res;
    if (typeof res !== 'object') return [];

    const primaryKey = kind === 'services' ? 'services' : 'products';
    const buckets = [
        res[primaryKey],
        res?.data?.[primaryKey],
        res?.data?.items,
        res?.data?.rows,
        res?.items,
        res?.rows,
        res?.data?.list,
        res?.list,
        res?.result,
        res?.results,
        res?.payload,
        res?.data?.payload,
    ];
    for (const a of buckets) {
        if (Array.isArray(a)) return a;
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

/**
 * Workshop JWT — suppliers for this workshop (filtered by workshopId).
 * Query: `q` or `search` (first non-empty wins) — case-insensitive server-side search.
 * Pagination: `limit` (max 500), `offset`.
 */
export const getWorkshopSuppliers = (params = {}) =>
    apiFetch(`/workshop-staff/suppliers${qs(params)}`);

/**
 * Global supplier registry visible to workshop admins.
 * GET /workshop-staff/suppliers/registered
 * Query: q/search, isActive, limit, offset.
 */
export const getRegisteredWorkshopSuppliers = (params = {}) =>
    apiFetch(`/workshop-staff/suppliers/registered${qs(params)}`);

/**
 * Link existing suppliers to the current workshop.
 * POST /workshop-staff/suppliers/link
 * Body: { supplierIds: string[] }
 */
export const linkSuppliersToWorkshop = (supplierIds = []) =>
    apiFetch('/workshop-staff/suppliers/link', {
        method: 'POST',
        body: JSON.stringify({ supplierIds: (supplierIds || []).map(String) }),
    });

/** Workshop — create supplier purchase invoice (starts pending; no stock until supplier approves). */
export const createWorkshopSupplierPurchaseInvoice = (body) =>
    apiFetch('/workshop-staff/supplier-purchase-invoices', {
        method: 'POST',
        body: JSON.stringify(body),
    });

/** Workshop — list supplier purchase invoices. Query: status, supplierId, limit, offset (+ optional branchId). */
export const listWorkshopSupplierPurchaseInvoices = (params = {}) =>
    apiFetch(`/workshop-staff/supplier-purchase-invoices${qs(params)}`);

/** Workshop — single invoice */
export const getWorkshopSupplierPurchaseInvoice = (invoiceId) =>
    apiFetch(`/workshop-staff/supplier-purchase-invoices/${encodeURIComponent(String(invoiceId))}`);

/**
 * Map API user row to UI row (WorkshopEmployees / dashboard).
 * @param {object} raw
 * @param {'technician'|'cashier'} role
 */
export function normalizeWorkshopEmployee(raw, role) {
    const id = raw.id ?? raw.userId ?? raw._id;
    const user = raw.user && typeof raw.user === 'object' ? raw.user : null;
    const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile : null;
    const employee = raw.employee && typeof raw.employee === 'object' ? raw.employee : null;
    const worker = raw.worker && typeof raw.worker === 'object' ? raw.worker : null;
    const name = raw.name ?? raw.fullName ?? raw.full_name ?? '—';
    const phone = raw.mobile ?? raw.phone ?? user?.mobile ?? user?.phone ?? employee?.mobile ?? employee?.phone ?? '';
    const email =
        raw.email ??
        user?.email ??
        profile?.email ??
        employee?.email ??
        worker?.email ??
        raw.emailAddress ??
        raw.email_address ??
        raw.userEmail ??
        raw.user_email ??
        raw.contactEmail ??
        raw.contact_email ??
        raw.loginEmail ??
        '';
    const branchRaw =
        raw.branchName ??
        raw.branch?.name ??
        (typeof raw.branch === 'string' ? raw.branch : null) ??
        null;
    const branch = branchRaw || '—';
    const branchId =
        raw.branchId != null
            ? String(raw.branchId)
            : raw.branch?.id != null
              ? String(raw.branch.id)
              : raw.branch_id != null
                ? String(raw.branch_id)
                : '';
    // Technicians may be linked to multiple workshop departments. The BE may
    // send these as `departmentIds: string[]` or expand them into
    // `departments: [{id,name}, …]` — accept either shape.
    const departmentIds = Array.isArray(raw.departmentIds)
        ? raw.departmentIds.map(String)
        : Array.isArray(raw.department_ids)
          ? raw.department_ids.map(String)
          : Array.isArray(raw.departments)
            ? raw.departments
                .map((d) => (d == null ? null : String(d.id ?? d._id ?? d)))
                .filter((v) => v != null && v !== '')
            : [];

    const singleDeptName =
        raw.department?.name ??
        raw.departmentName ??
        (typeof raw.department === 'string' ? raw.department : '') ??
        '';
    let fromDepartmentList = '';
    if (Array.isArray(raw.departmentNames) && raw.departmentNames.length > 0) {
        fromDepartmentList = raw.departmentNames.map((n) => String(n).trim()).filter(Boolean).join(', ');
    }
    if (!fromDepartmentList && Array.isArray(raw.departments) && raw.departments.length > 0) {
        fromDepartmentList = raw.departments
            .map((d) => {
                if (d == null) return '';
                if (typeof d === 'string') return d.trim();
                return String(d.name ?? d.departmentName ?? d.title ?? '').trim();
            })
            .filter(Boolean)
            .join(', ');
    }
    const department = (fromDepartmentList || singleDeptName || '').trim();
    const commission = Number(raw.commissionPercent ?? raw.commission_percent ?? 0);
    const active = raw.isActive !== false && raw.status !== 'inactive';
    const status = active ? 'active' : 'inactive';
    const technicianType = String(raw.technicianType ?? raw.technician_type ?? '').toLowerCase();
    const dutyMode = String(raw.dutyMode ?? raw.duty_mode ?? '').toLowerCase();
    const dualTechnicianType =
        technicianType === 'both' ||
        technicianType === 'hybrid' ||
        technicianType === 'workshop_and_oncall' ||
        technicianType === 'workshop_on_call';
    const explicitWorkshop = raw.workshopDuty ?? raw.workshop_duty;
    const explicitOncall = raw.oncallAvailable ?? raw.oncall_available;
    const hasExplicitDutyFlags = explicitWorkshop != null || explicitOncall != null;

    /**
     * Capability (form checkboxes) vs active session:
     * - technicianType "both" / hybrid = eligible for workshop AND on-call.
     * - dutyMode is the *current active* mode when type is "both" (e.g. dutyMode
     *   "workshop" + technicianType "both" → still show both toggles on).
     * So never derive capability from dutyMode alone before reading technicianType.
     */
    let workshop_duty;
    let oncall_available;
    if (hasExplicitDutyFlags) {
        workshop_duty = !!explicitWorkshop;
        oncall_available = !!explicitOncall;
    } else if (dualTechnicianType) {
        workshop_duty = true;
        oncall_available = true;
    } else if (technicianType === 'workshop') {
        workshop_duty = true;
        oncall_available = false;
    } else if (technicianType === 'on_call' || technicianType === 'oncall') {
        workshop_duty = false;
        oncall_available = true;
    } else if (
        dutyMode === 'both' ||
        dutyMode === 'hybrid' ||
        dutyMode === 'mixed' ||
        dutyMode === 'workshop_and_oncall'
    ) {
        workshop_duty = true;
        oncall_available = true;
    } else if (dutyMode === 'workshop') {
        workshop_duty = true;
        oncall_available = false;
    } else if (dutyMode === 'on_call' || dutyMode === 'oncall' || dutyMode === 'on-call') {
        workshop_duty = false;
        oncall_available = true;
    } else {
        workshop_duty =
            technicianType === 'workshop' ||
            raw.workshopDuty === true ||
            raw.workshop_duty === true;
        oncall_available =
            technicianType === 'on_call' ||
            technicianType === 'oncall' ||
            raw.oncallAvailable === true ||
            raw.oncall_available === true;
    }
    const displayRole = (raw.role ?? raw.userType ?? raw.user_type ?? role ?? '').toString().toLowerCase() || role;

    return {
        id,
        name,
        role: displayRole,
        branch,
        branchId,
        phone,
        email,
        iqama:
            raw.iqama ??
            raw.iqamaNumber ??
            raw.iqama_no ??
            raw.iqamaNo ??
            profile?.iqama ??
            user?.iqama ??
            employee?.iqama ??
            worker?.iqama ??
            raw.cnic ??
            raw.nationalId ??
            raw.national_id ??
            raw.idNumber ??
            raw.id_number ??
            raw.resident_id ??
            raw.residentId ??
            '',
        department: department || undefined,
        departmentIds,
        status,
        workshop_duty: role === 'technician' ? workshop_duty : false,
        oncall_available: role === 'technician' ? oncall_available : false,
        commission_percent: Number.isFinite(commission) ? commission : 0,
        commission_type: raw.commissionType ?? raw.commission_type ?? '',
        basic_salary: raw.basicSalary ?? raw.basic_salary ?? '',
        _source: role,
    };
}

/**
 * Load both technicians and cashiers in parallel, normalized for the UI.
 * Pass `{ branchId }` to scope the listing to one branch (the server will
 * filter via `?branchId=<id>` on each endpoint). Omit `branchId` for the
 * workshop-wide list.
 *
 * @param {object} [params]
 * @param {string|number} [params.branchId]
 * @param {boolean|string} [params.isActive]
 */
export async function loadWorkshopEmployeesCombined(params = {}) {
    const query = {};
    if (params.branchId != null && params.branchId !== '' && params.branchId !== 'all') {
        query.branchId = String(params.branchId);
    }
    if (params.isActive != null && params.isActive !== '') {
        query.isActive = String(params.isActive);
    }
    const [techRes, cashRes] = await Promise.all([
        getWorkshopTechnicians(query).catch(() => null),
        getWorkshopCashiers(query).catch(() => null),
    ]);
    if (techRes == null && cashRes == null) {
        throw new Error(
            'Failed to load employees (GET /workshop-staff/technicians and /workshop-staff/cashiers unreachable).',
        );
    }
    const techList = unwrapWorkshopStaffList(techRes, 'technician').map((u) =>
        normalizeWorkshopEmployee(flattenWorkshopStaffRow(u, 'technician'), 'technician'),
    );
    const cashList = unwrapWorkshopStaffList(cashRes, 'cashier').map((u) =>
        normalizeWorkshopEmployee(flattenWorkshopStaffRow(u, 'cashier'), 'cashier'),
    );
    return { techList, cashList, employees: [...techList, ...cashList] };
}
