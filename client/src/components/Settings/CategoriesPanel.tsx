/**
 * CategoriesPanel — list, create and edit reimbursement categories from Settings.
 * Uses DataTable utility component with sortable columns, pagination, and a floating modal editor.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, X, Check, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { listCategoriesApi, createCategoryApi, updateCategoryApi } from '../../utils/categoryApi';
import DataTable from '../common/DataTable';
import type { Category, CategoryCreateRequest } from '../../types/category';
import type { UserRole } from '../../types/user';

const PAGE_SIZES = [5, 10, 25, 50];

type SortField = 'name' | 'max_limit' | 'is_active';

interface FormState {
  category_id: string;
  name: string;
  max_limit: string;
  sub_categories: string[];
  is_active: boolean;
  allowed_roles: UserRole[];
  department_ids: string[];
  requires_invoice: boolean;
  approval_required: boolean;
}

interface CategoriesPanelProps {
  registerCreateHandler?: (openCreate: () => void) => void;
}

const EMPTY: FormState = {
  category_id: '',
  name: '',
  max_limit: '',
  sub_categories: [],
  is_active: true,
  allowed_roles: ['owner', 'senior_manager', 'manager', 'employee', 'ca', 'intern'],
  department_ids: [],
  requires_invoice: true,
  approval_required: true,
};

function normalizeCategoryId(value: string) {
  const num = parseInt(value.replace(/\D/g, ''), 10);
  return Number.isNaN(num) ? null : num;
}

function getNextCategoryId(lsCats: Category[]) {
  const highest = lsCats
    .map((cat) => normalizeCategoryId(cat.category_id))
    .filter((value): value is number => value !== null)
    .reduce((max, value) => Math.max(max, value), 0);

  return `CAT${String(highest + 1).padStart(3, '0')}`;
}

function makeFormSnapshot(form: FormState) {
  return JSON.stringify({
    category_id: form.category_id,
    name: form.name.trim(),
    max_limit: form.max_limit.trim(),
    sub_categories: form.sub_categories.map((s) => s.trim()),
    is_active: form.is_active,
    requires_invoice: form.requires_invoice,
    approval_required: form.approval_required,
    allowed_roles: form.allowed_roles,
    department_ids: form.department_ids,
  });
}

export default function CategoriesPanel({ registerCreateHandler }: CategoriesPanelProps) {
  const [bModalOpen, setBModalOpen] = useState(false);
  const [strEditId, setStrEditId] = useState<string | null>(null);
  const [objForm, setObjForm] = useState<FormState>(EMPTY);
  const [objInitialSnapshot, setObjInitialSnapshot] = useState('');
  const [subCategoryInput, setSubCategoryInput] = useState('');
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [bSaving, setBSaving] = useState(false);

  // Shared state
  const [lsCats, setLsCats] = useState<Category[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [strError, setStrError] = useState('');
  const [strSuccess, setStrSuccess] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedCategories = useMemo(() => {
    const copy = [...lsCats];
    copy.sort((a, b) => {
      const direction = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'max_limit') {
        return (a.max_limit - b.max_limit) * direction;
      }
      if (sortField === 'is_active') {
        return ((a.is_active ? 0 : 1) - (b.is_active ? 0 : 1)) * direction;
      }
      return a.name.localeCompare(b.name) * direction;
    });
    return copy;
  }, [lsCats, sortField, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedCategories.length / pageSize));
  const pagedCategories = useMemo(
    () => sortedCategories.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [sortedCategories, pageIndex, pageSize],
  );

  useEffect(() => {
    if (pageIndex >= pageCount) {
      setPageIndex(pageCount - 1);
    }
  }, [pageCount, pageIndex]);

  const load = useCallback(async () => {
    setBLoading(true);
    setStrError('');
    try {
      setLsCats(await listCategoriesApi(true));
    } catch {
      setStrError('Failed to load categories.');
    } finally {
      setBLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function getSortedIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDir === 'asc'
      ? <ChevronUp className="w-4 h-4 text-gray-700" />
      : <ChevronDown className="w-4 h-4 text-gray-700" />;
  }

  function changeSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDir('asc');
  }

  const formIsDirty = useMemo(
    () => objInitialSnapshot !== makeFormSnapshot(objForm),
    [objForm, objInitialSnapshot],
  );

  function flash(msg: string) {
    setStrSuccess(msg);
    setTimeout(() => setStrSuccess(''), 3000);
  }

  function setFormField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setObjForm((prev) => ({ ...prev, [key]: value }));
  }

  const openCreate = useCallback(() => {
    const nextId = getNextCategoryId(lsCats);
    const nextForm = { ...EMPTY, category_id: nextId };
    setObjForm(nextForm);
    setObjInitialSnapshot(makeFormSnapshot(nextForm));
    setStrEditId(null);
    setBModalOpen(true);
    setSubCategoryInput('');
    setEditingSubIndex(null);
    setStrError('');
  }, [lsCats]);

  useEffect(() => {
    registerCreateHandler?.(openCreate);
  }, [registerCreateHandler, openCreate]);

  function openEdit(category: Category) {
    const formState: FormState = {
      category_id: category.category_id,
      name: category.name,
      max_limit: String(category.max_limit),
      sub_categories: [...category.sub_categories],
      is_active: category.is_active,
      allowed_roles: [...category.allowed_roles],
      department_ids: [...category.department_ids],
      requires_invoice: category.requires_invoice,
      approval_required: category.approval_required,
    };
    setObjForm(formState);
    setObjInitialSnapshot(makeFormSnapshot(formState));
    setStrEditId(category.category_id);
    setBModalOpen(true);
    setSubCategoryInput('');
    setEditingSubIndex(null);
    setStrError('');
  }

  function closeModal() {
    if (formIsDirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    setBModalOpen(false);
    setStrEditId(null);
    setObjForm(EMPTY);
    setObjInitialSnapshot('');
    setSubCategoryInput('');
    setEditingSubIndex(null);
    setStrError('');
  }

  function addSubCategory() {
    const value = subCategoryInput.trim();
    if (!value) {
      return;
    }

    const duplicate = objForm.sub_categories.some(
      (sub, idx) => sub.toLowerCase() === value.toLowerCase() && idx !== editingSubIndex,
    );

    if (duplicate) {
      setStrError('Subcategory already exists.');
      return;
    }

    setObjForm((prev) => {
      const nextSubCategories = [...prev.sub_categories];
      if (editingSubIndex !== null && editingSubIndex >= 0 && editingSubIndex < nextSubCategories.length) {
        nextSubCategories[editingSubIndex] = value;
      } else {
        nextSubCategories.push(value);
      }
      return { ...prev, sub_categories: nextSubCategories };
    });

    setSubCategoryInput('');
    setEditingSubIndex(null);
    setStrError('');
  }

  function removeSubCategory(index: number) {
    setObjForm((prev) => ({
      ...prev,
      sub_categories: prev.sub_categories.filter((_, idx) => idx !== index),
    }));

    if (editingSubIndex === index) {
      setEditingSubIndex(null);
      setSubCategoryInput('');
    }
  }

  function editSubCategory(index: number) {
    setEditingSubIndex(index);
    setSubCategoryInput(objForm.sub_categories[index]);
    setStrError('');
  }

  async function handleSave() {
    const name = objForm.name.trim();
    const maxLimit = Number(objForm.max_limit);

    if (!name) {
      setStrError('Category name is required.');
      return;
    }
    if (Number.isNaN(maxLimit) || maxLimit < 0) {
      setStrError('Enter a valid limit.');
      return;
    }
    if (!window.confirm('Save changes to this category?')) {
      return;
    }

    setBSaving(true);
    setStrError('');
    try {
      const payload: CategoryCreateRequest = {
        category_id: objForm.category_id,
        name,
        max_limit: maxLimit,
        sub_categories: objForm.sub_categories.map((sub) => sub.trim()).filter(Boolean),
        allowed_roles: [...objForm.allowed_roles],
        department_ids: [...objForm.department_ids],
        requires_invoice: objForm.requires_invoice,
        approval_required: objForm.approval_required,
      };

      if (strEditId) {
        await updateCategoryApi(strEditId, {
          name: payload.name,
          max_limit: payload.max_limit,
          sub_categories: payload.sub_categories,
          allowed_roles: payload.allowed_roles,
          department_ids: payload.department_ids,
          requires_invoice: payload.requires_invoice,
          approval_required: payload.approval_required,
          is_active: objForm.is_active,
        });
        flash('Category updated.');
      } else {
        await createCategoryApi(payload);
        flash('Category created.');
      }

      closeModal();
      await load();
    } catch (error: any) {
      setStrError(error?.response?.data?.detail || 'Save failed.');
    } finally {
      setBSaving(false);
    }
  }

  async function toggleActive(category: Category) {
    try {
      const updated = await updateCategoryApi(category.category_id, { is_active: !category.is_active });
      setLsCats((prev) => prev.map((c) => (c.category_id === updated.category_id ? updated : c)));
      flash(`Category ${updated.name} ${updated.is_active ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      setStrError(err?.response?.data?.detail || 'Failed to update status.');
    }
  }

  return (
    <div className="space-y-6 bg-gray-50 rounded-lg p-6">
      {strError && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>{strError}</div>
          </div>
        </div>
      )}
      {strSuccess && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-lg">✅</span>
            <div>{strSuccess}</div>
          </div>
        </div>
      )}

      {bModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-5">
              <div>
                <h4 className="text-xl font-semibold text-gray-900">{strEditId ? 'Edit Category' : 'New Category'}</h4>
                <p className="mt-1 text-sm text-gray-500">Update category details, limits and subcategories.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Category ID</label>
                  <input
                    type="text"
                    value={objForm.category_id}
                    disabled
                    className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={objForm.name}
                    onChange={(e) => setFormField('name', e.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#00703C] focus:ring-[#00703C]/30"
                    placeholder="e.g. Travel & Conveyance"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Max Limit (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={objForm.max_limit}
                    onChange={(e) => setFormField('max_limit', e.target.value)}
                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#00703C] focus:ring-[#00703C]/30"
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Subcategories</label>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {objForm.sub_categories.length === 0 ? (
                      <span className="rounded-sm bg-gray-100 px-3 py-1 text-sm text-gray-500">No subcategories yet</span>
                    ) : (
                      objForm.sub_categories.map((sub, index) => (
                        <span
                          key={`${sub}-${index}`}
                          className="inline-flex items-center rounded-sm border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700"
                        >
                          <button
                            type="button"
                            onClick={() => editSubCategory(index)}
                            className="text-left text-sm text-gray-700 hover:text-gray-900"
                          >
                            {sub}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSubCategory(index)}
                            className="ml-2 rounded-sm p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={subCategoryInput}
                      onChange={(e) => setSubCategoryInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubCategory(); } }}
                      placeholder={editingSubIndex !== null ? 'Update subcategory' : 'Add subcategory'}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#00703C] focus:ring-[#00703C]/30"
                    />
                    <button
                      type="button"
                      onClick={addSubCategory}
                      className="inline-flex h-10 items-center justify-center rounded-md bg-[#00703C] px-4 text-sm font-medium text-white hover:bg-[#005a30]"
                    >
                      {editingSubIndex !== null ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Status</label>
                  <label className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={objForm.is_active}
                      onChange={(e) => setFormField('is_active', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#00703C] focus:ring-[#00703C]"
                    />
                    <span className="text-sm text-gray-700">{objForm.is_active ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={bSaving}
                className="inline-flex items-center justify-center rounded-lg bg-[#00703C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005a30] disabled:opacity-60 transition-colors"
              >
                <Check className="mr-2 h-4 w-4" />
                {bSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bLoading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Loading categories…</p>
        </div>
      ) : (
        <DataTable<Category>
          columns={[
            {
              key: 'name',
              label: 'Category Name',
              sortable: true,
              render: (category) => (
                <div className="space-y-1">
                  <span className="block text-sm font-semibold text-gray-900 max-w-[36ch] truncate">{category.name}</span>
                  {category.sub_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {category.sub_categories.map((sub, idx) => (
                        <span key={`${sub}-${idx}`} className="rounded-sm bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          {sub}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'max_limit',
              label: 'Limit',
              width: 'w-32',
              align: 'right',
              sortable: true,
              render: (category) => <span className="font-semibold text-gray-900">₹{category.max_limit.toLocaleString()}</span>,
            },
            {
              key: 'is_active',
              label: 'Status',
              width: 'w-32',
              align: 'center',
              sortable: true,
              render: (category) => (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleActive(category); }}
                  className={`inline-flex items-center justify-center rounded-sm px-3 py-1 text-xs font-semibold border ${
                    category.is_active
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {category.is_active ? 'Active' : 'Inactive'}
                </button>
              ),
            },
          ]}
          data={lsCats}
          pageSize={10}
          pageSizeOptions={PAGE_SIZES}
          showSerialNumber={true}
          alternateRowColor={true}
          rowBgColor="bg-white"
          altRowBgColor="bg-gray-50"
          hoverBgColor="hover:bg-blue-50/30"
          headerBgColor="bg-white"
          headerTextColor="text-gray-700 font-semibold"
          headerBorderColor="border-gray-200"
          rowBorderColor="border-gray-100"
          rowScrollable={true}
          scrollHeight="56rem"
          onRowClick={(category) => openEdit(category)}
          defaultSortKey="name"
          defaultSortDir="asc"
          emptyMessage="No categories found."
        />
      )}
    </div>
  );
}
