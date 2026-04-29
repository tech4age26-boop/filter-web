import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

function unwrapList(res, keys = ['data', 'technicians', 'cashiers', 'users', 'items']) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of keys) {
        const v = res[k];
        if (Array.isArray(v)) return v;
    }
    return [];
}

export function unwrapWorkshopStaffList(res, kind) {
    return unwrapList(
        res,
        kind === 'technician' ? ['technicians', 'data', 'items', 'users'] : ['cashiers', 'data', 'items', 'users'],
    );
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

/**
 * Create a technician.
 * Body: { name, mobile, email?, password?, technicianType?, workshopDuty?, oncallAvailable?, commissionPercent,
 *         branchId?, departmentIds?, basicSalary?, iqama? }.
 * If `branchId` is omitted the BE creates the technician without a branch and
 * skips the `technicianStatus` row (it can be initialized later).
 */
export const createWorkshopTechnician = (body) =>
    apiFetch('/workshop-staff/technicians', { method: 'POST', body: JSON.stringify(body) });

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
 * Map API user row to UI row (WorkshopEmployees / dashboard).
 * @param {object} raw
 * @param {'technician'|'cashier'} role
 */
export function normalizeWorkshopEmployee(raw, role) {
    const id = raw.id ?? raw.userId ?? raw._id;
    const name = raw.name ?? raw.fullName ?? '—';
    const phone = raw.mobile ?? raw.phone ?? '';
    const email = raw.email ?? '';
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
    const dualTechnicianType =
        technicianType === 'both' ||
        technicianType === 'hybrid' ||
        technicianType === 'workshop_and_oncall' ||
        technicianType === 'workshop_on_call';
    const workshop_duty =
        dualTechnicianType ||
        technicianType === 'workshop' ||
        raw.workshopDuty === true ||
        raw.workshop_duty === true;
    const oncall_available =
        dualTechnicianType ||
        technicianType === 'on_call' ||
        technicianType === 'oncall' ||
        raw.oncallAvailable === true ||
        raw.oncall_available === true;
    const displayRole = (raw.role ?? raw.userType ?? raw.user_type ?? role ?? '').toString().toLowerCase() || role;

    return {
        id,
        name,
        role: displayRole,
        branch,
        branchId,
        phone,
        email,
        iqama: raw.iqama ?? raw.iqamaNumber ?? '',
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
    const techList = unwrapWorkshopStaffList(techRes, 'technician').map((u) => normalizeWorkshopEmployee(u, 'technician'));
    const cashList = unwrapWorkshopStaffList(cashRes, 'cashier').map((u) => normalizeWorkshopEmployee(u, 'cashier'));
    return { techList, cashList, employees: [...techList, ...cashList] };
}
