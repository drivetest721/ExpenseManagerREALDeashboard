/**
 * DepartmentsPanel — list, create and edit departments from the Settings page.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { listDepartmentsApi, createDepartmentApi, updateDepartmentApi, deleteDepartmentApi } from '../../utils/departmentApi';
import type { Department } from '../../types/department';

interface FormState { name: string; }
const EMPTY: FormState = { name: '' };

export default function DepartmentsPanel() {
  const [lsDepts, setLsDepts] = useState<Department[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strError, setStrError] = useState('');
  const [strSuccess, setStrSuccess] = useState('');

  const [bShowForm, setBShowForm] = useState(false);
  const [strEditId, setStrEditId] = useState<string | null>(null);
  const [objForm, setObjForm] = useState<FormState>(EMPTY);
  const [bSaving, setBSaving] = useState(false);

  const load = useCallback(async () => {
    setBLoading(true); setStrError('');
    try { setLsDepts(await listDepartmentsApi()); }
    catch { setStrError('Failed to load departments.'); }
    finally { setBLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string) { setStrSuccess(msg); setTimeout(() => setStrSuccess(''), 3000); }

  function openCreate() { setObjForm(EMPTY); setStrEditId(null); setBShowForm(true); setStrError(''); }
  function openEdit(d: Department) { setObjForm({ name: d.department_name }); setStrEditId(d.department_id); setBShowForm(true); setStrError(''); }
  function closeForm() { setBShowForm(false); setStrEditId(null); setObjForm(EMPTY); }

  async function handleSave() {
    if (!objForm.name.trim()) { setStrError('Department name is required.'); return; }
    setBSaving(true); setStrError('');
    try {
      if (strEditId) {
        await updateDepartmentApi(strEditId, { department_name: objForm.name.trim() });
        flash('Department updated.');
      } else {
        await createDepartmentApi({ department_name: objForm.name.trim(), owner_ids: [] });
        flash('Department created.');
      }
      closeForm(); await load();
    } catch (e: any) { setStrError(e.response?.data?.detail || 'Save failed.'); }
    finally { setBSaving(false); }
  }

  async function handleDelete(d: Department) {
    if (!confirm(`Delete department "${d.department_name}"? This cannot be undone.`)) return;
    setStrError('');
    try { await deleteDepartmentApi(d.department_id); flash('Department deleted.'); await load(); }
    catch (e: any) { setStrError(e.response?.data?.detail || 'Delete failed.'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-600 cursor-default">All departments in the organisation. Each user is mapped to one primary department.</p>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-1.5 px-4 h-10 text-sm font-medium bg-[#00703C] text-white rounded-md hover:bg-[#005a30] cursor-pointer shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {strError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-3 py-2 text-sm">{strError}</div>}
      {strSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-3 py-2 text-sm">✅ {strSuccess}</div>}

      {/* Inline form */}
      {bShowForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h4 className="font-semibold text-gray-900 mb-4 cursor-default">{strEditId ? 'Edit Department' : 'New Department'}</h4>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Department Name <span className="text-red-500">*</span></label>
            <input className="w-full h-10 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#00703C]/30 focus:border-[#00703C]"
              value={objForm.name} onChange={e => setObjForm({ name: e.target.value })}
              placeholder="e.g. Engineering" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeForm} className="inline-flex items-center gap-1.5 px-4 h-10 text-sm border border-gray-300 rounded-md text-[#4A4A4A] bg-white hover:bg-[#F7F7F7] cursor-pointer shadow-sm">
              <X className="w-4 h-4" /> Cancel
            </button>
            <button onClick={handleSave} disabled={bSaving}
              className="inline-flex items-center gap-1.5 px-4 h-10 text-sm bg-[#00703C] text-white rounded-md hover:bg-[#005a30] disabled:opacity-50 cursor-pointer shadow-sm">
              <Check className="w-4 h-4" /> {bSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {bLoading ? <p className="text-sm text-gray-500 py-6 text-center cursor-default">Loading…</p> : lsDepts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8 cursor-default">No departments found.</p>
      ) : (
        <div className="space-y-2">
          {lsDepts.map(d => (
            <div key={d.department_id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden border-l-4 transition-all ${
                d.is_active ? 'border-l-[#00703C]' : 'opacity-60 bg-gray-50 border-l-gray-400'
              }`}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs flex-shrink-0 ${
                  d.is_active ? 'bg-[#00703C]/10 text-[#00703C]' : 'bg-gray-200 text-gray-600'
                }`}>
                  {d.department_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 truncate">{d.department_name}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{d.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 cursor-default">{d.owner_ids.length} owner{d.owner_ids.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(d)} title="Edit"
                    className="p-1.5 rounded text-gray-700 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(d)} title="Delete"
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
