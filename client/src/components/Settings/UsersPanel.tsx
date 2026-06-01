/**
 * UsersPanel — list, create and edit users from the Settings page.
 * Includes Reporting Managers management (approval chain hierarchy).
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, X, Check, UserX, UserCheck, Trash2 } from 'lucide-react';
import { listUsersApi, createUserApi, updateUserApi, updateManagersApi } from '../../utils/userApi';
import { listDepartmentsApi } from '../../utils/departmentApi';
import type { User, ManagerEntry } from '../../types/user';
import type { Department } from '../../types/department';
import type { UserRole } from '../../types/user';

const ALL_ROLES: UserRole[] = ['owner', 'senior_manager', 'manager', 'employee', 'ca', 'intern'];
const CREATABLE_ROLES: UserRole[] = ['owner', 'senior_manager', 'manager', 'ca', 'intern'];
const MANAGER_ROLES: UserRole[] = ['owner', 'senior_manager', 'manager'];

interface FormManager { manager_id: string; priority: number; approval_type: 'mandatory' | 'optional'; }
interface FormState {
  employee_id: string; name: string; email: string; password: string;
  role: UserRole; department_id: string; managers: FormManager[];
}
const EMPTY: FormState = { employee_id: '', name: '', email: '', password: '', role: 'employee', department_id: '', managers: [] };

export default function UsersPanel() {
  const [lsUsers, setLsUsers] = useState<User[]>([]);
  const [lsDepts, setLsDepts] = useState<Department[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strError, setStrError] = useState('');
  const [bShowForm, setBShowForm] = useState(false);
  const [strEditId, setStrEditId] = useState<string | null>(null);
  const [objForm, setObjForm] = useState<FormState>(EMPTY);
  const [bSaving, setBSaving] = useState(false);

  const load = useCallback(async () => {
    setBLoading(true); setStrError('');
    try {
      const [u, d] = await Promise.all([listUsersApi(), listDepartmentsApi()]);
      setLsUsers(u); setLsDepts(d);
    } catch { setStrError('Failed to load users.'); }
    finally { setBLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setObjForm(EMPTY); setStrEditId(null); setBShowForm(true); setStrError(''); }
  function openEdit(u: User) {
    const d0 = u.departments[0];
    setObjForm({
      employee_id: u.employee_id || '', name: u.name, email: u.email, password: '',
      role: (d0?.role ?? 'employee') as UserRole,
      department_id: d0?.department_id ?? '',
      managers: (u.managers || []).map(m => ({ manager_id: m.manager_id, priority: m.priority, approval_type: m.approval_type })),
    });
    setStrEditId(u.user_id); setBShowForm(true); setStrError('');
  }
  function closeForm() { setBShowForm(false); setStrEditId(null); setObjForm(EMPTY); }
  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setObjForm(f => ({ ...f, [k]: v })); }
  function addManagerRow() {
    setObjForm(f => ({ ...f, managers: [...f.managers, { manager_id: '', priority: f.managers.length + 1, approval_type: 'mandatory' }] }));
  }
  function updateManagerRow(i: number, patch: Partial<FormManager>) {
    setObjForm(f => ({ ...f, managers: f.managers.map((m, idx) => idx === i ? { ...m, ...patch } : m) }));
  }
  function removeManagerRow(i: number) {
    setObjForm(f => ({ ...f, managers: f.managers.filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    if (!objForm.name || !objForm.email) { setStrError('Name and email are required.'); return; }
    const seen = new Set<string>();
    for (const m of objForm.managers) {
      if (!m.manager_id) { setStrError('All manager rows must select a person.'); return; }
      if (seen.has(m.manager_id)) { setStrError('A manager is listed more than once.'); return; }
      seen.add(m.manager_id);
    }
    setBSaving(true); setStrError('');
    try {
      const dept = lsDepts.find(d => d.department_id === objForm.department_id);
      const lsMgrFull: ManagerEntry[] = objForm.managers.map(m => ({
        manager_id: m.manager_id,
        manager_name: lsUsers.find(u => u.user_id === m.manager_id)?.name,
        priority: m.priority, approval_type: m.approval_type,
      }));
      const lsMgrUpd = objForm.managers.map(m => ({ manager_id: m.manager_id, priority: m.priority, approval_type: m.approval_type }));
      if (strEditId) {
        await updateUserApi(strEditId, {
          name: objForm.name, email: objForm.email,
          departments: objForm.department_id ? [{ department_id: objForm.department_id, department_name: dept?.department_name, role: objForm.role, is_primary: true }] : undefined,
        });
        await updateManagersApi(strEditId, { managers: lsMgrUpd });
      } else {
        if (!objForm.password) { setStrError('Password is required for new users.'); setBSaving(false); return; }
        const objCreated = await createUserApi({
          employee_id: objForm.employee_id, name: objForm.name, email: objForm.email, password: objForm.password,
          departments: objForm.department_id ? [{ department_id: objForm.department_id, department_name: dept?.department_name, role: objForm.role, is_primary: true }] : [],
          managers: lsMgrFull,
        });
        if (lsMgrUpd.length > 0) await updateManagersApi(objCreated.user_id, { managers: lsMgrUpd });
      }
      closeForm(); await load();
    } catch (e: any) { setStrError(e.response?.data?.detail || 'Save failed.'); }
    finally { setBSaving(false); }
  }

  async function toggleActive(u: User) {
    const strAction = u.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${strAction} "${u.name}"?`)) return;
    try { await updateUserApi(u.user_id, { is_active: !u.is_active }); await load(); }
    catch { setStrError('Failed to update user.'); }
  }

  function getPrimaryRole(u: User): string {
    return u.departments.find(d => d.is_primary)?.role ?? u.departments[0]?.role ?? '—';
  }

  const lsMgrPool = lsUsers.filter(u =>
    u.is_active && u.user_id !== strEditId &&
    (u.departments || []).some(d => MANAGER_ROLES.includes(d.role))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
        <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00703C] text-white rounded hover:bg-[#005a30]">
          <Plus className="w-4 h-4" /> New User
        </button>
      </div>
      {strError && <p className="text-sm text-red-600 mb-3">{strError}</p>}
      {bShowForm && (
        <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">{strEditId ? 'Edit User' : 'New User'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div><label className="text-xs text-gray-600">Employee ID</label>
              <input className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={objForm.employee_id} onChange={e => set('employee_id', e.target.value)} placeholder="EMP001" disabled={!!strEditId} />
            </div>
            <div><label className="text-xs text-gray-600">Full Name *</label>
              <input className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={objForm.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div><label className="text-xs text-gray-600">Email *</label>
              <input type="email" className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={objForm.email} onChange={e => set('email', e.target.value)} />
            </div>
            {!strEditId && <div><label className="text-xs text-gray-600">Password *</label>
              <input type="password" className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={objForm.password} onChange={e => set('password', e.target.value)} />
            </div>}
            <div><label className="text-xs text-gray-600">Department</label>
              <select className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={objForm.department_id} onChange={e => set('department_id', e.target.value)}>
                <option value="">— None —</option>
                {lsDepts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-600">Role</label>
              <select className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={objForm.role} onChange={e => set('role', e.target.value as UserRole)}>
                {CREATABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4 border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-800">Reporting Managers (Approval Chain)</label>
              <button onClick={addManagerRow} type="button" className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                <Plus className="w-3 h-3" /> Add Manager
              </button>
            </div>
            {objForm.managers.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No managers assigned. This user's reimbursements will skip approval steps.</p>
            ) : (
              <div className="space-y-2">
                {objForm.managers.map((m, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white p-2 rounded border border-gray-200">
                    <div className="col-span-6">
                      <label className="text-xs text-gray-500">Manager</label>
                      <select className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={m.manager_id} onChange={e => updateManagerRow(i, { manager_id: e.target.value })}>
                        <option value="">— Select —</option>
                        {lsMgrPool.map(u => {
                          const r = u.departments.find(d => d.is_primary)?.role ?? u.departments[0]?.role;
                          return <option key={u.user_id} value={u.user_id}>{u.name} ({r})</option>;
                        })}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Priority</label>
                      <input type="number" min="1" className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={m.priority} onChange={e => updateManagerRow(i, { priority: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">Approval</label>
                      <select className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-sm" value={m.approval_type} onChange={e => updateManagerRow(i, { approval_type: e.target.value as 'mandatory' | 'optional' })}>
                        <option value="mandatory">Mandatory</option>
                        <option value="optional">Optional</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeManagerRow(i)} type="button" title="Remove" className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-1">Lower priority = earlier in the chain. The approval flow processes managers in priority order.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={bSaving} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00703C] text-white rounded hover:bg-[#005a30] disabled:opacity-50">
              <Check className="w-4 h-4" /> {bSaving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={closeForm} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {bLoading ? (
        <p className="text-sm text-gray-500 py-6 text-center cursor-default">Loading…</p>
      ) : lsUsers.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8 cursor-default">No users found.</p>
      ) : (
        <div className="space-y-2">
          {lsUsers.map(u => {
            const strRole = getPrimaryRole(u);
            const dictRoleTone: Record<string, { border: string; badge: string; avatar: string }> = {
              owner:          { border: 'border-l-purple-500', badge: 'bg-purple-100 text-purple-700', avatar: 'bg-purple-100 text-purple-700' },
              senior_manager: { border: 'border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700', avatar: 'bg-indigo-100 text-indigo-700' },
              manager:        { border: 'border-l-blue-500',   badge: 'bg-blue-100 text-blue-700',     avatar: 'bg-blue-100 text-blue-700' },
              employee:       { border: 'border-l-gray-400',   badge: 'bg-gray-100 text-gray-700',     avatar: 'bg-gray-100 text-gray-700' },
              ca:             { border: 'border-l-teal-500',   badge: 'bg-teal-100 text-teal-700',     avatar: 'bg-teal-100 text-teal-700' },
              intern:         { border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700', avatar: 'bg-orange-100 text-orange-700' },
            };
            const tone = dictRoleTone[strRole] ?? dictRoleTone.employee;
            const strInitials = u.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
            const nMgrs = (u.managers || []).length;
            return (
              <div key={u.user_id}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden border-l-4 transition-all ${
                  u.is_active ? tone.border : 'opacity-60 bg-gray-50 border-l-gray-400'
                }`}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
                    u.is_active ? tone.avatar : 'bg-gray-200 text-gray-600'
                  }`}>
                    {strInitials || '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900 truncate">{u.name}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tone.badge}`}>{strRole}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 cursor-default flex-wrap">
                      <span className="truncate">{u.email}</span>
                      {u.employee_id && <span className="font-mono">· {u.employee_id}</span>}
                      <span>· {nMgrs === 0 ? <span className="italic text-gray-400">no managers</span> : `${nMgrs} mgr${nMgrs > 1 ? 's' : ''}`}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(u)} title="Edit"
                      className="p-1.5 rounded text-gray-700 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(u)} title={u.is_active ? 'Deactivate' : 'Activate'}
                      className={`p-1.5 rounded cursor-pointer transition-colors ${
                        u.is_active ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-50'
                                    : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                      }`}>
                      {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
