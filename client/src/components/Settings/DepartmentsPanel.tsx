/**
 * DepartmentsPanel — list, create and edit departments from the Settings page.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Check, Search, Trash2 } from 'lucide-react';
import { listDepartmentsApi, createDepartmentApi, updateDepartmentApi, deleteDepartmentApi } from '../../utils/departmentApi';
import { listUsersApi } from '../../utils/userApi';
import type { Department } from '../../types/department';
import type { User } from '../../types/user';

interface FormState { 
  department_id: string;
  name: string; 
}
const EMPTY: FormState = { department_id: '', name: '' };

export default function DepartmentsPanel() {
  const [lsDepts, setLsDepts] = useState<Department[]>([]);
  const [lsUsers, setLsUsers] = useState<User[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strError, setStrError] = useState('');
  const [strSuccess, setStrSuccess] = useState('');

  const [bFormOpen, setBFormOpen] = useState(false);
  const [strEditId, setStrEditId] = useState<string | null>(null);
  const [objForm, setObjForm] = useState<FormState>(EMPTY);
  const [bSaving, setBSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setBLoading(true); 
    setStrError('');
    try { 
      const [depts, users] = await Promise.all([listDepartmentsApi(), listUsersApi()]);
      setLsDepts(depts);
      setLsUsers(users);
    }
    catch { setStrError('Failed to load departments.'); }
    finally { setBLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) { setStrSuccess(msg); setTimeout(() => setStrSuccess(''), 3000); }

  function openCreate() { 
    const newId = `DEPT${String(lsDepts.length + 1).padStart(3, '0')}`;
    setObjForm({ department_id: newId, name: '' }); 
    setStrEditId(null); 
    setBFormOpen(true); 
    setStrError(''); 
  }
  
  function openEdit(d: Department) { 
    setObjForm({ department_id: d.department_id, name: d.department_name }); 
    setStrEditId(d.department_id); 
    setBFormOpen(true); 
    setStrError(''); 
  }
  
  function closeForm() { 
    setBFormOpen(false); 
    setStrEditId(null); 
    setObjForm(EMPTY); 
  }

  async function handleSave() {
    if (!objForm.name.trim()) { setStrError('Department name is required.'); return; }
    setBSaving(true); 
    setStrError('');
    try {
      if (strEditId) {
        await updateDepartmentApi(strEditId, { department_name: objForm.name.trim() });
        flash('Department updated.');
      } else {
        await createDepartmentApi({ 
          department_id: objForm.department_id.trim(),
          department_name: objForm.name.trim(), 
          owner_ids: [] 
        });
        flash('Department created.');
      }
      closeForm(); 
      await load();
    } catch (e: any) { 
      setStrError(e.response?.data?.detail || 'Save failed.'); 
    }
    finally { setBSaving(false); }
  }

  async function handleDelete(d: Department) {
    if (!confirm(`Delete department "${d.department_name}"? This cannot be undone.`)) return;
    setStrError('');
    try { 
      await deleteDepartmentApi(d.department_id); 
      flash('Department deleted.'); 
      await load(); 
    }
    catch (e: any) { setStrError(e.response?.data?.detail || 'Delete failed.'); }
  }

  const lsFilteredDepts = useMemo(() => {
    return lsDepts.filter((dept) => {
      const text = `${dept.department_id} ${dept.department_name}`.toLowerCase();
      return !searchQuery || text.includes(searchQuery.toLowerCase());
    });
  }, [lsDepts, searchQuery]);

  function getOwnerNames(ownerIds: string[]): string {
    if (ownerIds.length === 0) return 'No owners';
    return ownerIds.map((ownerId) => {
      const owner = lsUsers.find((u) => u.user_id === ownerId);
      return owner ? owner.name : ownerId;
    }).join(', ');
  }

  const formOwners = useMemo(() => {
    if (!strEditId) return [];
    const dept = lsDepts.find((d) => d.department_id === strEditId);
    return dept?.owner_ids || [];
  }, [strEditId, lsDepts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Departments</h3>
          <p className="text-sm text-gray-500">Manage departments and assign owners for organisation.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-[#00703C] text-white text-sm hover:bg-[#005a30]">
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {strError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">{strError}</div>}
      {strSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-3 py-2 text-sm">✅ {strSuccess}</div>}

      {/* Floating Form Modal */}
      {bFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{strEditId ? 'Edit Department' : 'New Department'}</h4>
                <p className="text-sm text-gray-500">{strEditId ? 'Update department details and owners.' : 'Create a new department and assign owners.'}</p>
              </div>
              <button type="button" onClick={closeForm} className="text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Department ID</label>
                  <input 
                    type="text"
                    value={objForm.department_id}
                    disabled={!!strEditId}
                    onChange={(e) => setObjForm({ ...objForm, department_id: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50 disabled:cursor-not-allowed"
                    placeholder="Auto-generated"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Department Name <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    value={objForm.name}
                    onChange={(e) => setObjForm({ ...objForm, name: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g. Engineering"
                  />
                </div>
              </div>

              {strEditId && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Owners</label>
                  <div className="mt-2 space-y-2">
                    {formOwners.length === 0 ? (
                      <p className="text-sm text-gray-500">No owners assigned to this department.</p>
                    ) : (
                      <div className="border border-gray-200 rounded p-3 space-y-2">
                        {formOwners.map((ownerId) => {
                          const owner = lsUsers.find((u) => u.user_id === ownerId);
                          return (
                            <div key={ownerId} className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{owner?.name || ownerId}</p>
                                <p className="text-xs text-gray-500">{owner?.email}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={bSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#00703C] text-white hover:bg-[#005a30] disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            name="deptSearch"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by department ID or name"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {bLoading ? (
        <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
      ) : lsFilteredDepts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">{searchQuery ? 'No departments match your search.' : 'No departments found.'}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 border-b border-gray-200">Department ID</th>
                  <th className="px-4 py-3 border-b border-gray-200">Name</th>
                  <th className="px-4 py-3 border-b border-gray-200">Owners</th>
                  <th className="px-4 py-3 border-b border-gray-200">Status</th>
                  <th className="px-4 py-3 border-b border-gray-200 w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lsFilteredDepts.map((dept) => (
                  <tr
                    key={dept.department_id}
                    onClick={() => openEdit(dept)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-left">
                      <span className="font-medium text-gray-900">{dept.department_id}</span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className="text-gray-900">{dept.department_name}</span>
                    </td>
                    <td className="px-4 py-3 text-left text-sm text-gray-600">
                      {getOwnerNames(dept.owner_ids)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        dept.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {dept.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(dept)}
                        title="Delete"
                        className="p-1.5 rounded text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

