/**
 * CategoriesPanel — list, create and edit reimbursement categories from Settings.
 * "Allowed For" picker supports three modes: By Role, By Department, By Individual.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { listCategoriesApi, createCategoryApi, updateCategoryApi, deleteCategoryApi } from '../../utils/categoryApi';
import { listUsersApi } from '../../utils/userApi';
import { listDepartmentsApi } from '../../utils/departmentApi';
import type { Category, CategoryCreateRequest } from '../../types/category';
import type { UserRole, User } from '../../types/user';
import type { Department } from '../../types/department';

const ALL_ROLES: UserRole[] = ['owner', 'senior_manager', 'manager', 'employee', 'ca', 'intern'];
type PickerTab = 'role' | 'dept' | 'individual';

interface FormState {
  name: string; max_limit: string; requires_invoice: boolean;
  approval_required: boolean; allowed_roles: UserRole[];
  department_ids: string[]; sub_categories_str: string; is_active: boolean;
  picker_tab: PickerTab;
}
const EMPTY: FormState = {
  name: '', max_limit: '', requires_invoice: true, approval_required: true,
  allowed_roles: [...ALL_ROLES], department_ids: [],
  sub_categories_str: '', is_active: true, picker_tab: 'role',
};

export default function CategoriesPanel() {
  const [lsCats, setLsCats] = useState<Category[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strError, setStrError] = useState('');
  const [strSuccess, setStrSuccess] = useState('');
  const [bShowForm, setBShowForm] = useState(false);
  const [strEditId, setStrEditId] = useState<string | null>(null);
  const [objForm, setObjForm] = useState<FormState>(EMPTY);
  const [bSaving, setBSaving] = useState(false);

  // people-picker data
  const [lsUsers, setLsUsers] = useState<User[]>([]);
  const [lsDepts, setLsDepts] = useState<Department[]>([]);
  const [setSelUsers, setSetSelUsers] = useState<Set<string>>(new Set());
  const [setCollapsedDepts, setSetCollapsedDepts] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setBLoading(true);
    try { setLsCats(await listCategoriesApi()); }
    catch { setStrError('Failed to load categories.'); }
    finally { setBLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // load users + depts for picker when form opens
  useEffect(() => {
    if (!bShowForm) return;
    listUsersApi().then(setLsUsers).catch(() => {});
    listDepartmentsApi().then(setLsDepts).catch(() => {});
  }, [bShowForm]);

  // initialise selected-users set to all when individual tab is first shown
  useEffect(() => {
    if (objForm.picker_tab === 'individual' && lsUsers.length > 0 && setSelUsers.size === 0) {
      setSetSelUsers(new Set(lsUsers.map(u => u.user_id)));
    }
  }, [objForm.picker_tab, lsUsers]);

  function flash(msg: string) { setStrSuccess(msg); setTimeout(() => setStrSuccess(''), 3000); }
  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setObjForm(f => ({ ...f, [k]: v })); }

  function toggleRole(r: UserRole) {
    setObjForm(f => ({
      ...f, allowed_roles: f.allowed_roles.includes(r)
        ? f.allowed_roles.filter(x => x !== r)
        : [...f.allowed_roles, r]
    }));
  }
  function toggleDept(strId: string) {
    setObjForm(f => ({
      ...f, department_ids: f.department_ids.includes(strId)
        ? f.department_ids.filter(x => x !== strId)
        : [...f.department_ids, strId]
    }));
  }

  function openCreate() {
    setObjForm(EMPTY); setStrEditId(null); setBShowForm(true); setStrError('');
    setSetSelUsers(new Set());
  }
  function openEdit(c: Category) {
    const tab: PickerTab = c.department_ids.length > 0 ? 'dept' : 'role';
    setObjForm({
      name: c.name, max_limit: String(c.max_limit),
      requires_invoice: c.requires_invoice, approval_required: c.approval_required,
      allowed_roles: c.allowed_roles, department_ids: c.department_ids,
      sub_categories_str: c.sub_categories.join(', '),
      is_active: c.is_active, picker_tab: tab,
    });
    setStrEditId(c.category_id); setBShowForm(true); setStrError('');
    setSetSelUsers(new Set());
  }
  function closeForm() { setBShowForm(false); setStrEditId(null); }

  async function handleSave() {
    if (!objForm.name.trim() || !objForm.max_limit) { setStrError('Name and limit are required.'); return; }
    setBSaving(true); setStrError('');
    try {
      // derive allowed_roles + department_ids based on picker tab
      let finalRoles = objForm.allowed_roles;
      let finalDeptIds = objForm.department_ids;
      if (objForm.picker_tab === 'dept') {
        finalRoles = [];
        finalDeptIds = objForm.department_ids;
      } else if (objForm.picker_tab === 'individual') {
        const selUsers = lsUsers.filter(u => setSelUsers.has(u.user_id));
        finalRoles = [...new Set(selUsers.flatMap(u => u.departments.map(d => d.role)))] as UserRole[];
        finalDeptIds = [...new Set(selUsers.flatMap(u => u.departments.map(d => d.department_id)))];
      } else {
        finalDeptIds = [];
      }
      const payload: CategoryCreateRequest = {
        name: objForm.name.trim(), max_limit: parseFloat(objForm.max_limit),
        requires_invoice: objForm.requires_invoice, approval_required: objForm.approval_required,
        allowed_roles: finalRoles, department_ids: finalDeptIds,
        sub_categories: objForm.sub_categories_str.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (strEditId) { await updateCategoryApi(strEditId, { ...payload, is_active: objForm.is_active }); flash('Category updated.'); }
      else { await createCategoryApi(payload); flash('Category created.'); }
      closeForm(); await load();
    } catch (e: any) { setStrError(e.response?.data?.detail || 'Save failed.'); }
    finally { setBSaving(false); }
  }

  async function handleDelete(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await deleteCategoryApi(c.category_id); flash('Category deleted.'); await load(); }
    catch (e: any) { setStrError(e.response?.data?.detail || 'Delete failed.'); }
  }

  // ── Individual picker helpers ────────────────────────────────────────────────
  // Build tree: dept_id → { dept, roles → { role, users[] } }
  type RoleGroup = { role: UserRole; lsUsers: User[] };
  type DeptGroup = { dept: Department; lsRoles: RoleGroup[] };

  function buildTree(): DeptGroup[] {
    const lsDeptGroups: DeptGroup[] = lsDepts.map(dept => {
      const deptUsers = lsUsers.filter(u => u.departments.some(d => d.department_id === dept.department_id));
      const rolesInDept = [...new Set(deptUsers.flatMap(u =>
        u.departments.filter(d => d.department_id === dept.department_id).map(d => d.role)
      ))] as UserRole[];
      const lsRoles: RoleGroup[] = rolesInDept.map(role => ({
        role,
        lsUsers: deptUsers.filter(u => u.departments.some(d => d.department_id === dept.department_id && d.role === role)),
      }));
      return { dept, lsRoles };
    });
    // users with no dept
    const noDeptUsers = lsUsers.filter(u => u.departments.length === 0);
    if (noDeptUsers.length > 0) {
      lsDeptGroups.push({
        dept: { department_id: '__no_dept__', department_name: 'No Department', owner_ids: [], is_active: true },
        lsRoles: [{ role: 'employee', lsUsers: noDeptUsers }],
      });
    }
    return lsDeptGroups.filter(dg => dg.lsRoles.some(rg => rg.lsUsers.length > 0));
  }

  function isDeptAllSelected(dg: DeptGroup) {
    return dg.lsRoles.every(rg => rg.lsUsers.every(u => setSelUsers.has(u.user_id)));
  }
  function isRoleAllSelected(rg: RoleGroup) {
    return rg.lsUsers.every(u => setSelUsers.has(u.user_id));
  }
  function toggleDeptAll(dg: DeptGroup, val: boolean) {
    const allIds = dg.lsRoles.flatMap(rg => rg.lsUsers.map(u => u.user_id));
    setSetSelUsers(prev => {
      const s = new Set(prev);
      allIds.forEach(id => val ? s.add(id) : s.delete(id));
      return s;
    });
  }
  function toggleRoleAll(rg: RoleGroup, val: boolean) {
    setSetSelUsers(prev => {
      const s = new Set(prev);
      rg.lsUsers.forEach(u => val ? s.add(u.user_id) : s.delete(u.user_id));
      return s;
    });
  }
  function toggleUser(strId: string) {
    setSetSelUsers(prev => {
      const s = new Set(prev);
      s.has(strId) ? s.delete(strId) : s.add(strId);
      return s;
    });
  }
  function toggleDeptCollapsed(strId: string) {
    setSetCollapsedDepts(prev => {
      const s = new Set(prev);
      s.has(strId) ? s.delete(strId) : s.add(strId);
      return s;
    });
  }

  const strInput = "w-full h-10 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C]/30 focus:border-[#00703C]";
  const strLbl = "block text-sm font-medium text-gray-700 mb-1";

  const tree = buildTree();
  const iSelCount = setSelUsers.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-600 cursor-default">Spendable categories with per-item limits, invoice requirements and role eligibility.</p>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-medium bg-[#00703C] text-white rounded-md hover:bg-[#005a30] cursor-pointer shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      {strError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">{strError}</div>}
      {strSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-3 py-2 text-sm">✅ {strSuccess}</div>}

      {bShowForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h4 className="font-semibold text-gray-900 mb-4 cursor-default">{strEditId ? 'Edit Category' : 'New Category'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2"><label className={strLbl}>Category Name <span className="text-red-500">*</span></label>
              <input className={strInput} value={objForm.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Travel & Conveyance" />
            </div>
            <div><label className={strLbl}>Max Limit (₹) <span className="text-red-500">*</span></label>
              <input type="number" min="0" className={strInput} value={objForm.max_limit} onChange={e => set('max_limit', e.target.value)} />
            </div>
            <div><label className={strLbl}>Sub-categories <span className="text-gray-400 text-xs">(comma separated)</span></label>
              <input className={strInput} value={objForm.sub_categories_str} onChange={e => set('sub_categories_str', e.target.value)} placeholder="Flight, Train, Cab" />
            </div>
          </div>

          {/* ── Allowed For picker ── */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className={strLbl + ' mb-0'}>Allowed For</label>
              <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {(['role', 'dept', 'individual'] as PickerTab[]).map(tab => (
                  <button key={tab} type="button"
                    onClick={() => set('picker_tab', tab)}
                    className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors capitalize ${
                      objForm.picker_tab === tab ? 'bg-white shadow text-[#00703C] font-semibold' : 'text-gray-600 hover:text-gray-800'
                    }`}>
                    {tab === 'role' ? 'By Role' : tab === 'dept' ? 'By Department' : 'By Individual'}
                  </button>
                ))}
              </div>
            </div>

            {/* By Role */}
            {objForm.picker_tab === 'role' && (
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {ALL_ROLES.map(r => {
                  const bChecked = objForm.allowed_roles.includes(r);
                  return (
                    <button key={r} type="button" onClick={() => toggleRole(r)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border cursor-pointer transition-colors ${
                        bChecked ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}>{r}</button>
                  );
                })}
              </div>
            )}

            {/* By Department */}
            {objForm.picker_tab === 'dept' && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                {lsDepts.length === 0 && <p className="text-xs text-gray-500 italic">No departments found.</p>}
                {lsDepts.map(d => {
                  const bChecked = objForm.department_ids.includes(d.department_id);
                  return (
                    <label key={d.department_id} className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-white transition-colors">
                      <input type="checkbox" checked={bChecked} onChange={() => toggleDept(d.department_id)} className="cursor-pointer rounded" />
                      <span className="text-sm text-gray-800 font-medium">{d.department_name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* By Individual — hierarchical tree */}
            {objForm.picker_tab === 'individual' && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Users className="w-3.5 h-3.5" />
                    <span>{iSelCount} of {lsUsers.length} selected</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSetSelUsers(new Set(lsUsers.map(u => u.user_id)))}
                      className="text-xs text-[#00703C] hover:underline cursor-pointer">Select All</button>
                    <span className="text-gray-300">·</span>
                    <button type="button" onClick={() => setSetSelUsers(new Set())}
                      className="text-xs text-gray-500 hover:underline cursor-pointer">Clear</button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {tree.length === 0 && <p className="text-xs text-gray-400 italic px-4 py-4">No users found.</p>}
                  {tree.map(dg => {
                    const bAllSel = isDeptAllSelected(dg);
                    const bSomeSel = !bAllSel && dg.lsRoles.some(rg => rg.lsUsers.some(u => setSelUsers.has(u.user_id)));
                    const bCollapsed = setCollapsedDepts.has(dg.dept.department_id);
                    return (
                      <div key={dg.dept.department_id}>
                        {/* Department row */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 hover:bg-gray-100/80 border-b border-gray-100 sticky top-0">
                          <input
                            type="checkbox" checked={bAllSel}
                            ref={el => { if (el) el.indeterminate = bSomeSel; }}
                            onChange={e => toggleDeptAll(dg, e.target.checked)}
                            className="cursor-pointer"
                          />
                          <button type="button" onClick={() => toggleDeptCollapsed(dg.dept.department_id)}
                            className="flex items-center gap-1 flex-1 text-left cursor-pointer">
                            {bCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                            <span className="text-sm font-semibold text-gray-800">{dg.dept.department_name}</span>
                            <span className="text-xs text-gray-400 ml-1">{dg.lsRoles.reduce((s, rg) => s + rg.lsUsers.length, 0)} people</span>
                          </button>
                        </div>
                        {!bCollapsed && dg.lsRoles.map(rg => {
                          const bRoleAll = isRoleAllSelected(rg);
                          const bRoleSome = !bRoleAll && rg.lsUsers.some(u => setSelUsers.has(u.user_id));
                          return (
                            <div key={rg.role}>
                              {/* Role row */}
                              <div className="flex items-center gap-2 px-5 py-1.5 bg-gray-50/40 border-b border-gray-100">
                                <input
                                  type="checkbox" checked={bRoleAll}
                                  ref={el => { if (el) el.indeterminate = bRoleSome; }}
                                  onChange={e => toggleRoleAll(rg, e.target.checked)}
                                  className="cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{rg.role.replace(/_/g,' ')}</span>
                                <span className="text-xs text-gray-400">({rg.lsUsers.length})</span>
                              </div>
                              {/* User rows */}
                              {rg.lsUsers.map(u => (
                                <label key={u.user_id} className="flex items-center gap-3 px-7 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                                  <input type="checkbox" checked={setSelUsers.has(u.user_id)} onChange={() => toggleUser(u.user_id)} className="cursor-pointer" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm text-gray-900 font-medium truncate">{u.name}{u.employee_id ? <span className="text-xs text-gray-400 ml-1 font-mono">{u.employee_id}</span> : null}</p>
                                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-700">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={objForm.requires_invoice} onChange={e => set('requires_invoice', e.target.checked)} className="rounded" /> Requires Invoice</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={objForm.approval_required} onChange={e => set('approval_required', e.target.checked)} className="rounded" /> Approval Required</label>
            {strEditId && <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={objForm.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" /> Active</label>}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="inline-flex items-center gap-1.5 px-4 h-10 text-sm border border-gray-300 rounded-md text-[#4A4A4A] bg-white hover:bg-[#F7F7F7] cursor-pointer shadow-sm">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button onClick={handleSave} disabled={bSaving} className="inline-flex items-center gap-1.5 px-4 h-10 text-sm bg-[#00703C] text-white rounded-md hover:bg-[#005a30] disabled:opacity-50 cursor-pointer shadow-sm">
              <Check className="w-4 h-4" /> {bSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {bLoading ? <p className="text-sm text-gray-500 py-6 text-center cursor-default">Loading…</p> : lsCats.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8 cursor-default">No categories found.</p>
      ) : (
        <div className="space-y-2">
          {lsCats.map(c => (
            <div key={c.category_id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden border-l-4 transition-all ${
                c.is_active ? 'border-l-blue-400' : 'opacity-60 bg-gray-50 border-l-gray-400'
              }`}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs flex-shrink-0 ${
                  c.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 truncate">{c.name}</h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">₹{c.max_limit.toLocaleString()}</span>
                    {c.requires_invoice && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Invoice req.</span>}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {c.sub_categories.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate cursor-default">{c.sub_categories.join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} title="Edit"
                    className="p-1.5 rounded text-gray-700 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(c)} title="Delete"
                    className="p-1.5 rounded text-red-600 hover:text-red-800 hover:bg-red-50 cursor-pointer transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}