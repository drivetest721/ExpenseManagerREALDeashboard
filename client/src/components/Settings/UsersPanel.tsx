/**
 * UsersPanel — list, create and edit users from the Settings page.
 * Includes Reporting Managers management (approval chain hierarchy).
 */
import { useState, useEffect, useCallback, useMemo, type DragEvent } from 'react';
import {
  Plus,  X, Check,  Trash2,
  ChevronUp, ChevronDown, Search, Filter, Eye, Copy,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { listUsersApi, createUserApi, updateUserApi, updateManagersApi, updateCategoriesApi } from '../../utils/userApi';
import { listDepartmentsApi } from '../../utils/departmentApi';
import { getAllAllowanceApi } from '../../utils/allowanceApi';
import type { User,  UserRole } from '../../types/user';
import type { Department } from '../../types/department';
import type { AllowanceWithAssignees } from '../../types/category';

const ALL_ROLES: UserRole[] = ['owner', 'senior_manager', 'manager', 'ca', 'intern'];
const MANAGER_ROLES: UserRole[] = ['owner', 'senior_manager', 'manager'];
const PAGE_SIZE = 10;

interface FormDeptRow {
  department_id: string;
  role: UserRole;
  is_primary: boolean;
}

interface FormManagerRow {
  manager_id: string;
  priority: number;
  approval_type: 'mandatory' | 'optional';
}

interface UserAllowanceEntry {
  category_id: string;
  category_name?: string;
  sub_category?: string;
}

interface FormState {
  employee_id: string;
  name: string;
  email: string;
  password: string;
  is_active: boolean;
  departments: FormDeptRow[];
  managers: FormManagerRow[];
  default_allowances: UserAllowanceEntry[];
}

const EMPTY_FORM: FormState = {
  employee_id: '',
  name: '',
  email: '',
  password: '',
  is_active: true,
  departments: [],
  managers: [],
  default_allowances: [],
};

function buildUserForm(u: User): FormState {
  
  return {
    employee_id: u.employee_id || '',
    name: u.name,
    email: u.email,
    password:  '',
    is_active: u.is_active,
    departments: u.departments.map((d) => ({
      department_id: d.department_id,
      role: d.role,
      is_primary: d.is_primary,
    })),
    managers: u.managers.map((m) => ({
      manager_id: m.manager_id,
      priority: m.priority,
      approval_type: m.approval_type,
    })),
    default_allowances: u.default_allowances || [],
  };
}

function buildUserDepartmentsLabel(rows: FormDeptRow[]) {
  if (rows.length === 0) return 'None';
  return rows.map((row) => `${row.department_id || '—'} / ${row.role}`).join(', ');
}

function buildUserManagersLabel(rows: FormManagerRow[]) {
  if (rows.length === 0) return 'None';
  return rows.map((row) => `${row.manager_id || '—'} (${row.priority})`).join(', ');
}

// function validatePassword(strPwd: string): string | null {
//   if (!strPwd) return null;
//   if (strPwd.length < 6) return 'Password must be at least 6 characters.';
//   if (strPwd.length > 10) return 'Password cannot be longer than 10 characters.';
//   if (!/[A-Za-z]/.test(strPwd) || !/[0-9]/.test(strPwd) || !/[\W_]/.test(strPwd)) {
//     return 'Password must include letters, numbers, and symbols.';
//   }
//   return null;
// }

export default function UsersPanel() {
  const [lsUsers, setLsUsers] = useState<User[]>([]);
  const [lsDepts, setLsDepts] = useState<Department[]>([]);
  // const [bLoading, setBLoading] = useState(false);
  // const [strError, setStrError] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [objForm, setObjForm] = useState<FormState>(EMPTY_FORM);
  const [objOriginalForm, setObjOriginalForm] = useState<FormState | null>(null);
  const [bCreating, setBCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartments, setFilterDepartments] = useState<Set<string>>(new Set());
  const [filterRoles, setFilterRoles] = useState<Set<UserRole>>(new Set());
  const [showInactive, setShowInactive] = useState(true);
  const [sortColumn, setSortColumn] = useState<'name' | 'role' | 'department' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [bSaving, setBSaving] = useState(false);
  const [bConfirmOpen, setBConfirmOpen] = useState(false);
  const [strConfirmMode, setStrConfirmMode] = useState<'save' | 'close' | null>(null);
  const [lsConfirmChanges, setLsConfirmChanges] = useState<string[]>([]);
  const [bPasswordVisible, setBPasswordVisible] = useState(false);
  const [bDepartmentFilterOpen, setBDepartmentFilterOpen] = useState(false);
  const [bRoleFilterOpen, setBRoleFilterOpen] = useState(false);
  const [lsAllowances, setLsAllowances] = useState<AllowanceWithAssignees[]>([]);
  const [allowanceSearchQuery, setAllowanceSearchQuery] = useState('');
  const [allowancePage, setAllowancePage] = useState(1);
  const [draggedManagerIndex, setDraggedManagerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    // setBLoading(true);
    // setStrError('');
    try {
      const [u, d] = await Promise.all([listUsersApi(), listDepartmentsApi()]);
      setLsUsers(u);
      setLsDepts(d);
    } catch {
      // setStrError('Failed to load users.');
    } finally {
      // setBLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function loadAllowances() {
      try {
        const allowances = await getAllAllowanceApi();
        setLsAllowances(allowances);
      } catch {
        // Ignore allowance load failure for now.
      }
    }
    loadAllowances();
  }, []);

  const nextEmployeeId = useMemo(() => {
    const next = lsUsers.length + 1;
    return `EMP${String(next).padStart(3, '0')}`;
  }, [lsUsers.length]);

  useEffect(() => {
    if (bCreating) {
      setObjForm({
        ...EMPTY_FORM,
        employee_id: nextEmployeeId,
        departments: [{ department_id: '', role: 'employee', is_primary: true }],
        managers: [],
      });
      setObjOriginalForm(null);
    }
  }, [bCreating, nextEmployeeId]);

  function openCreate() {
    setBCreating(true);
    setExpandedUserId(null);
    // setStrError('');
  }

  function openEdit(u: User) {
    setBCreating(false);
    setExpandedUserId(u.user_id);
    setObjForm(buildUserForm(u));
    setObjOriginalForm(buildUserForm(u));
  }

  function closeEditor() {
    setExpandedUserId(null);
    setBCreating(false);
    setObjForm(EMPTY_FORM);
    setObjOriginalForm(null);
    setBPasswordVisible(false);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setObjForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateFormDept(index: number, patch: Partial<FormDeptRow>) {
    setObjForm((prev) => ({
      ...prev,
      departments: prev.departments.map((row, idx) => idx === index ? { ...row, ...patch } : row),
    }));
  }

  function addFormDeptRow() {
    setObjForm((prev) => ({
      ...prev,
      departments: [...prev.departments, { department_id: '', role: 'employee', is_primary: false }],
    }));
  }

  function removeFormDeptRow(index: number) {
    setObjForm((prev) => ({
      ...prev,
      departments: prev.departments.filter((_, idx) => idx !== index),
    }));
  }

  function updateFormManager(index: number, patch: Partial<FormManagerRow>) {
    setObjForm((prev) => ({
      ...prev,
      managers: prev.managers.map((row, idx) => idx === index ? { ...row, ...patch } : row),
    }));
  }

  function addFormManagerRow() {
    setObjForm((prev) => ({
      ...prev,
      managers: [...prev.managers, { manager_id: '', priority: prev.managers.length + 1, approval_type: 'mandatory' }],
    }));
  }

  function removeFormManagerRow(index: number) {
    setObjForm((prev) => ({
      ...prev,
      managers: prev.managers.filter((_, idx) => idx !== index),
    }));
  }

  function getAvailableDepartmentIds(currentIndex: number) {
    const taken = objForm.departments
      .filter((_, idx) => idx !== currentIndex)
      .map((row) => row.department_id)
      .filter(Boolean);
    return lsDepts.filter((dept) => !taken.includes(dept.department_id));
  }

  function getDepartmentRoleOptions(deptId: string) {
    if (!deptId) return ALL_ROLES;
    const roles = new Set<UserRole>();
    lsUsers.forEach((user) => {
      user.departments.forEach((d) => {
        if (d.department_id === deptId) roles.add(d.role);
      });
    });
    const arr = Array.from(roles) as UserRole[];
    return arr.length > 0 ? arr : ALL_ROLES;
  }

  const lsManagerCandidates = useMemo(() => {
    return lsUsers.filter((user) =>
      user.is_active &&
      user.user_id !== expandedUserId &&
      user.departments.some((d) => MANAGER_ROLES.includes(d.role))
    );
  }, [lsUsers, expandedUserId]);

  const selectedManagerIds = useMemo(() => new Set(objForm.managers.map((mgr) => mgr.manager_id).filter(Boolean)), [objForm.managers]);

  function getAvailableManagerCandidates(currentManagerId: string) {
    return lsManagerCandidates.filter((candidate) =>
      !selectedManagerIds.has(candidate.user_id) || candidate.user_id === currentManagerId
    );
  }

  function handleManagerDragStart(index: number) {
    setDraggedManagerIndex(index);
  }

  function handleManagerDragOver(event: DragEvent<HTMLTableRowElement>) {
    event.preventDefault();
  }

  function handleManagerDrop(index: number) {
    if (draggedManagerIndex === null || draggedManagerIndex === index) return;
    setObjForm((prev) => {
      const nextManagers = [...prev.managers];
      const [draggedManager] = nextManagers.splice(draggedManagerIndex, 1);
      nextManagers.splice(index, 0, draggedManager);
      return {
        ...prev,
        managers: nextManagers.map((row, idx) => ({ ...row, priority: idx + 1 })),
      };
    });
    setDraggedManagerIndex(null);
  }

  const allowancePageSize = 5;
  const lsFilteredAllowances = useMemo(() => {
    return lsAllowances.filter((allowance) => {
      if (!allowanceSearchQuery) return true;
      return allowance.name.toLowerCase().includes(allowanceSearchQuery.toLowerCase());
    });
  }, [lsAllowances, allowanceSearchQuery]);

  const allowancePageCount = Math.max(1, Math.ceil(lsFilteredAllowances.length / allowancePageSize));
  const lsPageAllowances = lsFilteredAllowances.slice((allowancePage - 1) * allowancePageSize, allowancePage * allowancePageSize);

  useEffect(() => {
    if (allowancePage > allowancePageCount) {
      setAllowancePage(allowancePageCount);
    }
  }, [allowancePage, allowancePageCount]);

  function toggleAllowanceSelection(categoryId: string, categoryName: string) {
    setObjForm((prev) => {
      const exists = prev.default_allowances.some((item) => item.category_id === categoryId);
      const nextAllowances = exists
        ? prev.default_allowances.filter((item) => item.category_id !== categoryId)
        : [...prev.default_allowances, { category_id: categoryId, category_name: categoryName }];
      return { ...prev, default_allowances: nextAllowances };
    });
  }

  const bFormOpen = bCreating || expandedUserId !== null;

  function buildChangeSummary(): string[] {
    const original = objOriginalForm;
    if (!original) {
      const changes: string[] = [];
      if (objForm.name) changes.push(`Name: — → ${objForm.name}`);
      if (objForm.email) changes.push(`Email: — → ${objForm.email}`);
      if (objForm.password) changes.push(`Password: — → updated`);
      if (objForm.departments.length > 0) changes.push(`Departments: — → ${buildUserDepartmentsLabel(objForm.departments)}`);
      if (objForm.managers.length > 0) changes.push(`Managers: — → ${buildUserManagersLabel(objForm.managers)}`);
      return changes;
    }

    const changes: string[] = [];
    if (original.name !== objForm.name) changes.push(`Name: ${original.name} → ${objForm.name}`);
    if (original.email !== objForm.email) changes.push(`Email: ${original.email} → ${objForm.email}`);
    if (objForm.password) changes.push(`Password: ****** → updated`);

    const origDepartments = buildUserDepartmentsLabel(original.departments);
    const newDepartments = buildUserDepartmentsLabel(objForm.departments);
    if (origDepartments !== newDepartments) changes.push(`Departments: ${origDepartments} → ${newDepartments}`);

    const origManagers = buildUserManagersLabel(original.managers);
    const newManagers = buildUserManagersLabel(objForm.managers);
    if (origManagers !== newManagers) changes.push(`Managers: ${origManagers} → ${newManagers}`);

    if (original.is_active !== objForm.is_active) {
      changes.push(`Status: ${original.is_active ? 'Active' : 'Inactive'} → ${objForm.is_active ? 'Active' : 'Inactive'}`);
    }

    return changes;
  }

  function openConfirmation(mode: 'save' | 'close') {
    const changes = buildChangeSummary();
    if (changes.length === 0) {
      if (mode === 'close') closeEditor();
      return;
    }
    setLsConfirmChanges(changes);
    setStrConfirmMode(mode);
    setBConfirmOpen(true);
  }

  async function handleConfirmOkay() {
    setBConfirmOpen(false);
    if (strConfirmMode === 'save') {
      await handleSave();
    } else if (strConfirmMode === 'close') {
      closeEditor();
    }
    setStrConfirmMode(null);
  }

  async function handleSave() {
    if (!objForm.name || !objForm.email) {
      alert('Name and email are required.');
      return;
    }

    if (bCreating && !objForm.password) {
      alert('Password is required for a new user.');
      return;
    }

    const managerIds = new Set<string>();
    for (const m of objForm.managers) {
      if (!m.manager_id) {
        alert('Each manager row must select a manager.');
        return;
      }
      if (managerIds.has(m.manager_id)) {
        alert('A manager may not be selected twice.');
        return;
      }
      managerIds.add(m.manager_id);
    }

    if (bCreating && !objForm.employee_id) {
      alert('Employee ID is required.');
      return;
    }

    setBSaving(true);
    try {
      const departmentRows = objForm.departments.filter((row) => row.department_id).map((row, idx) => ({
        department_id: row.department_id,
        department_name: lsDepts.find((d) => d.department_id === row.department_id)?.department_name,
        role: row.role,
        is_primary: idx === 0,
      }));
      const managerPayload = objForm.managers.map((m) => ({ manager_id: m.manager_id, priority: m.priority, approval_type: m.approval_type }));
      const allowancePayload = objForm.default_allowances.map((item) => ({ category_id: item.category_id, sub_category: item.sub_category }));

      if (bCreating) {
        const created = await createUserApi({
          employee_id: objForm.employee_id,
          name: objForm.name,
          email: objForm.email,
          password: objForm.password,
          departments: departmentRows,
          managers: managerPayload.map((m) => ({
            manager_id: m.manager_id,
            manager_name: lsUsers.find((u) => u.user_id === m.manager_id)?.name,
            priority: m.priority,
            approval_type: m.approval_type,
          })),
        });

        if (managerPayload.length > 0) {
          await updateManagersApi(created.user_id, { managers: managerPayload });
        }
        if (allowancePayload.length > 0) {
          await updateCategoriesApi(created.user_id, { default_allowances: allowancePayload });
        }
      } else if (expandedUserId) {
        await updateUserApi(expandedUserId, {
          name: objForm.name,
          email: objForm.email,
          password: objForm.password || undefined,
          is_active: objForm.is_active,
          departments: departmentRows,
        });
        await updateManagersApi(expandedUserId, { managers: managerPayload });
        await updateCategoriesApi(expandedUserId, { default_allowances: allowancePayload });
      }

      await load();
      closeEditor();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Save failed.');
    } finally {
      setBSaving(false);
    }
  }

  async function toggleActive(u: User) {
    const action = u.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} "${u.name}"?`)) return;
    try {
      await updateUserApi(u.user_id, { is_active: !u.is_active });
      await load();
    } catch {
      // setStrError('Failed to update user.');
    }
  }

  function getPrimaryRole(u: User): string {
    return u.departments.find((d) => d.is_primary)?.role ?? u.departments[0]?.role ?? '—';
  }

  const lsFilteredUsers = useMemo(() => {
    return lsUsers
      .filter((user) => {
        if (!showInactive && !user.is_active) return false;
        const text = `${user.name} ${user.email} ${user.employee_id} ${user.departments.map((d) => d.department_name).join(' ')} ${user.departments.map((d) => d.role).join(' ')}`.toLowerCase();
        if (searchQuery && !text.includes(searchQuery.toLowerCase())) return false;
        if (filterDepartments.size > 0 && !user.departments.some((d) => filterDepartments.has(d.department_id))) return false;
        if (filterRoles.size > 0 && !user.departments.some((d) => filterRoles.has(d.role))) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        if (sortColumn === 'name') return a.name.localeCompare(b.name) * dir;
        if (sortColumn === 'role') return getPrimaryRole(a).localeCompare(getPrimaryRole(b)) * dir;
        if (sortColumn === 'department') {
          const aDept = a.departments[0]?.department_name || '';
          const bDept = b.departments[0]?.department_name || '';
          return aDept.localeCompare(bDept) * dir;
        }
        if (sortColumn === 'status') return (Number(a.is_active) - Number(b.is_active)) * dir;
        return 0;
      });
  }, [lsUsers, searchQuery, filterDepartments, filterRoles, showInactive, sortColumn, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(lsFilteredUsers.length / PAGE_SIZE));
  const lsPageUsers = lsFilteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = lsPageUsers.length > 0 && lsPageUsers.every((u) => selectedIds.has(u.user_id));

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(userId)) copy.delete(userId);
      else copy.add(userId);
      return copy;
    });
  }

  function selectAllPage() {
    const ids = lsPageUsers.map((u) => u.user_id);
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      const selectedAll = ids.every((id) => copy.has(id));
      if (selectedAll) ids.forEach((id) => copy.delete(id));
      else ids.forEach((id) => copy.add(id));
      return copy;
    });
  }

  function toggleSort(column: 'name' | 'role' | 'department' | 'status') {
    if (sortColumn === column) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortColumn(column); setSortOrder('asc'); }
  }

  return (
    <div className="space-y-6">
      {/* <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#00703C] text-white text-sm hover:bg-[#005a30]">
          <Plus className="w-4 h-4" /> New User
        </button>
      </div> */}

      {bFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{bCreating ? 'New User' : 'Edit User'}</h4>
                <p className="text-sm text-gray-500">{bCreating ? 'Create a new user and assign departments, roles, and approval managers.' : 'Modify user details, department assignments, managers and status.'}</p>
              </div>
              <button type="button" onClick={closeEditor} className="text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Name</label>
                  <input
                    value={objForm.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Employee ID</label>
                  <input
                    value={objForm.employee_id}
                    disabled
                    className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Email</label>
                  <input
                    type="email"
                    value={objForm.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Password</label>
                  <div className="relative">
                    <input
                      type={bPasswordVisible ? 'text' : 'password'}
                      value={objForm.password}
                      onChange={(e) => updateForm('password', e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-3 py-2 pr-24 text-sm"
                      placeholder={bCreating ? 'Set password' : 'Change password'}
                    />
                    <button
                      type="button"
                      onClick={() => setBPasswordVisible((prev) => !prev)}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {objForm.password && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(objForm.password)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-900">Departments</h5>
                  <button
                    type="button"
                    onClick={addFormDeptRow}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Plus className="w-3 h-3" /> Add Department
                  </button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {objForm.departments.map((deptRow, idx) => {
                    const options = getAvailableDepartmentIds(idx);
                    const roleOptions = getDepartmentRoleOptions(deptRow.department_id);
                    return (
                      <div key={`${deptRow.department_id}-${idx}`} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3 items-end bg-white border border-gray-200 rounded p-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Department</label>
                          <select
                            value={deptRow.department_id}
                            onChange={(e) => updateFormDept(idx, { department_id: e.target.value, role: deptRow.role })}
                            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          >
                            <option value="">Select department</option>
                            {options.map((dept) => (
                              <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Role</label>
                          <select
                            value={deptRow.role}
                            onChange={(e) => updateFormDept(idx, { role: e.target.value as UserRole })}
                            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          >
                            {roleOptions.map((roleOption) => (
                              <option key={roleOption} value={roleOption}>{roleOption}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFormDeptRow(idx)}
                          className="self-end text-red-600 hover:text-red-800 rounded-md px-2 py-1 border border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900">Managers</h5>
                    <p className="text-sm text-gray-500">Drag rows to reorder manager priority and avoid duplicate assignments.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addFormManagerRow}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Plus className="w-3 h-3" /> Add manager
                  </button>
                </div>
                <div className="overflow-x-auto rounded border border-gray-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-3 py-3 w-14">Sr. No</th>
                        <th className="px-3 py-3">Manager</th>
                        <th className="px-3 py-3">Role</th>
                        <th className="px-3 py-3">Department</th>
                        <th className="px-3 py-3 w-20">Priority</th>
                        <th className="px-3 py-3 w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {objForm.managers.map((mgrRow, idx) => {
                        const selectedManager = lsUsers.find((u) => u.user_id === mgrRow.manager_id);
                        const options = getAvailableManagerCandidates(mgrRow.manager_id);
                        const deptLabel = selectedManager?.departments.map((d) => d.department_name || d.department_id).join(', ') || '—';
                        return (
                          <tr
                            key={`${mgrRow.manager_id}-${idx}`}
                            draggable
                            onDragStart={() => handleManagerDragStart(idx)}
                            onDragOver={handleManagerDragOver}
                            onDrop={() => handleManagerDrop(idx)}
                            className="bg-white hover:bg-gray-50 cursor-grab"
                          >
                            <td className="px-3 py-3 align-top">
                              <span className="text-sm font-medium text-gray-900">{idx + 1}</span>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <select
                                value={mgrRow.manager_id}
                                onChange={(e) => updateFormManager(idx, { manager_id: e.target.value })}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                              >
                                <option value="">Select manager</option>
                                {options.map((candidate) => (
                                  <option key={candidate.user_id} value={candidate.user_id}>
                                    {candidate.name} ({getPrimaryRole(candidate)})
                                  </option>
                                ))}
                              </select>
                              {selectedManager && (
                                <p className="text-xs text-gray-500 mt-1">{selectedManager.name} • {selectedManager.email}</p>
                              )}
                            </td>
                            <td className="px-3 py-3 align-top">{selectedManager ? getPrimaryRole(selectedManager) : '—'}</td>
                            <td className="px-3 py-3 align-top">{deptLabel}</td>
                            <td className="px-3 py-3 align-top">{mgrRow.priority}</td>
                            <td className="px-3 py-3 text-right align-top">
                              <button
                                type="button"
                                onClick={() => removeFormManagerRow(idx)}
                                className="text-red-600 hover:text-red-800 rounded-md px-2 py-1 border border-red-200 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {objForm.managers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">No managers assigned yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-gray-900">Allowances</h5>
                    <p className="text-sm text-gray-500">Select user allowance categories with search and paging.</p>
                  </div>
                  <input
                    type="text"
                    autoComplete="off"
                    value={allowanceSearchQuery}
                    onChange={(e) => { setAllowanceSearchQuery(e.target.value); setAllowancePage(1); }}
                    placeholder="Search allowances"
                    className="w-full sm:w-64 border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="overflow-hidden rounded border border-gray-200">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                        <tr>
                          <th className="px-3 py-3 w-12 text-center">Add</th>
                          <th className="px-3 py-3">Allowance</th>
                          <th className="px-3 py-3">Departments</th>
                          <th className="px-3 py-3">Roles</th>
                          <th className="px-3 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {lsPageAllowances.map((allowance) => {
                          const selected = objForm.default_allowances.some((item) => item.category_id === allowance.category_id);
                          return (
                            <tr key={allowance.category_id} className="bg-white hover:bg-gray-50">
                              <td className="px-3 py-3 text-center align-top">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleAllowanceSelection(allowance.category_id, allowance.name)}
                                  className="rounded border-gray-300"
                                />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <div className="font-medium text-gray-900">{allowance.name}</div>
                                <div className="text-xs text-gray-500">{allowance.sub_categories.join(', ') || 'No sub-categories'}</div>
                              </td>
                              <td className="px-3 py-3 align-top">{allowance.department_ids.join(', ') || 'All'}</td>
                              <td className="px-3 py-3 align-top">{allowance.allowed_roles.join(', ')}</td>
                              <td className="px-3 py-3 align-top">{allowance.is_active ? 'Active' : 'Inactive'}</td>
                            </tr>
                          );
                        })}
                        {lsPageAllowances.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">No allowances found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
                  <div>{objForm.default_allowances.length} selected</div>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      disabled={allowancePage <= 1}
                      onClick={() => setAllowancePage((prev) => Math.max(1, prev - 1))}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={allowancePage >= allowancePageCount}
                      onClick={() => setAllowancePage((prev) => Math.min(allowancePageCount, prev + 1))}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => openConfirmation('save')}
                  disabled={bSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#00703C] text-white hover:bg-[#005a30] disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => openConfirmation('close')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          name="userSearch"
          autoComplete="off"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          placeholder="Search name, email, department, role"
          className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Department filter */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setBDepartmentFilterOpen((prev) => !prev)}
          className="h-10 px-3 border border-gray-300 rounded-lg text-sm flex items-center gap-2 bg-white hover:bg-gray-50 whitespace-nowrap"
        >
          <Filter className="w-4 h-4 text-gray-500" />
          <span>{filterDepartments.size > 0 ? `Dept: ${filterDepartments.size}` : 'All Departments'}</span>
        </button>
        {bDepartmentFilterOpen && (
          <div className="absolute z-20 mt-2 w-52 max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg p-3">
            {lsDepts.map((dept) => (
              <label key={dept.department_id} className="flex items-center gap-2 text-sm text-gray-700 mb-2 last:mb-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterDepartments.has(dept.department_id)}
                  onChange={(e) => {
                    const next = new Set(filterDepartments);
                    if (e.target.checked) next.add(dept.department_id);
                    else next.delete(dept.department_id);
                    setFilterDepartments(next);
                    setPage(1);
                  }}
                  className="rounded border-gray-300"
                />
                {dept.department_name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Role filter */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setBRoleFilterOpen((prev) => !prev)}
          className="h-10 px-3 border border-gray-300 rounded-lg text-sm flex items-center gap-2 bg-white hover:bg-gray-50 whitespace-nowrap"
        >
          <Filter className="w-4 h-4 text-gray-500" />
          <span>{filterRoles.size > 0 ? `Role: ${filterRoles.size}` : 'All Roles'}</span>
        </button>
        {bRoleFilterOpen && (
          <div className="absolute z-20 mt-2 w-44 max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg p-3">
            {ALL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm text-gray-700 mb-2 last:mb-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterRoles.has(role)}
                  onChange={(e) => {
                    const next = new Set(filterRoles);
                    if (e.target.checked) next.add(role);
                    else next.delete(role);
                    setFilterRoles(next);
                    setPage(1);
                  }}
                  className="rounded border-gray-300"
                />
                {role}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Show inactive */}
      <label className="h-10 px-3 border border-gray-300 rounded-lg text-sm flex items-center gap-2 bg-white cursor-pointer whitespace-nowrap">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="rounded border-gray-300"
        />
        Show inactive
      </label>

      {/* Spacer */}
      <div className="flex-1" />

      {/* New User button */}
      <button
        onClick={openCreate}
        className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-[#00703C] text-white text-sm font-semibold hover:bg-[#005a30] whitespace-nowrap"
      >
        <Plus className="w-4 h-4" /> New User
      </button>
    </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 border-b border-gray-200 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={selectAllPage}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-3 border-b border-gray-200 cursor-pointer" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">
                    Name / Email
                    <span className="inline-flex flex-col -space-y-1">
                      <ChevronUp className={`w-3.5 h-3.5 ${sortColumn === 'name' && sortOrder === 'asc' ? 'text-black' : 'text-gray-400'}`} />
                      <ChevronDown className={`w-3.5 h-3.5 ${sortColumn === 'name' && sortOrder === 'desc' ? 'text-black' : 'text-gray-400'}`} />
                    </span>
                  </div>
                </th>
                <th className="px-3 py-3 border-b border-gray-200 cursor-pointer" onClick={() => toggleSort('role')}>
                  <div className="flex items-center gap-1">
                    Role
                    <span className="inline-flex flex-col -space-y-1">
                      <ChevronUp className={`w-3.5 h-3.5 ${sortColumn === 'role' && sortOrder === 'asc' ? 'text-black' : 'text-gray-400'}`} />
                      <ChevronDown className={`w-3.5 h-3.5 ${sortColumn === 'role' && sortOrder === 'desc' ? 'text-black' : 'text-gray-400'}`} />
                    </span>
                  </div>
                </th>
                <th className="px-3 py-3 border-b border-gray-200 cursor-pointer" onClick={() => toggleSort('department')}>
                  <div className="flex items-center gap-1">
                    Department
                    <span className="inline-flex flex-col -space-y-1">
                      <ChevronUp className={`w-3.5 h-3.5 ${sortColumn === 'department' && sortOrder === 'asc' ? 'text-black' : 'text-gray-400'}`} />
                      <ChevronDown className={`w-3.5 h-3.5 ${sortColumn === 'department' && sortOrder === 'desc' ? 'text-black' : 'text-gray-400'}`} />
                    </span>
                  </div>
                </th>
                <th className="px-3 py-3 border-b border-gray-200 cursor-pointer" onClick={() => toggleSort('status')}>
                  <div className="flex items-center gap-1">
                    Status
                    <span className="inline-flex flex-col -space-y-1">
                      <ChevronUp className={`w-3.5 h-3.5 ${sortColumn === 'status' && sortOrder === 'asc' ? 'text-black' : 'text-gray-400'}`} />
                      <ChevronDown className={`w-3.5 h-3.5 ${sortColumn === 'status' && sortOrder === 'desc' ? 'text-black' : 'text-gray-400'}`} />
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {lsPageUsers.map((user, idx) => {
                const role = getPrimaryRole(user);
                const deptLabel = user.departments.map((d) => d.department_name || d.department_id).join(', ') || '—';
                return (
                  <tr
                    key={user.user_id}
                    className={`border-b border-gray-200 ${!user.is_active ? 'text-gray-400' : 'cursor-pointer hover:bg-blue-50'} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    onClick={() => openEdit(user)}
                  >
                    <td className="px-3 py-3 border-r border-gray-200 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.user_id)}
                        onChange={() => toggleSelect(user.user_id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 text-left">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-3 py-3 border-r border-gray-200 text-left">{role}</td>
                    <td className="px-3 py-3 border-r border-gray-200 text-left">{deptLabel}</td>
                    <td className="px-3 py-3 text-left">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleActive(user); }}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lsPageUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">No users match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      

      <div className="flex items-center justify-end gap-2 px-3 py-3 border-t border-gray-200 bg-white">
        <span className="text-sm text-gray-500 mr-2">
          Page {page} of {pageCount} &nbsp;·&nbsp; {lsFilteredUsers.length} users
        </span>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {bConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Confirm save changes</h4>
                <p className="text-sm text-gray-500">Review the edits before continuing.</p>
              </div>
              <button type="button" onClick={() => setBConfirmOpen(false)} className="text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {lsConfirmChanges.slice(0, 5).map((line, idx) => (
                <div key={idx} className="text-sm text-gray-700">{line}</div>
              ))}
              {lsConfirmChanges.length > 5 && (
                <div className="text-xs text-gray-500">And {lsConfirmChanges.length - 5} more changes...</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setBConfirmOpen(false)} className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleConfirmOkay} className="px-4 py-2 text-sm rounded bg-[#00703C] text-white hover:bg-[#005a30]">Okay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
