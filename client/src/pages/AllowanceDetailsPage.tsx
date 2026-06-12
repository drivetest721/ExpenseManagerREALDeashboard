/**
 * AllowanceDetailsPage — read-only table of allowances the current user is
 * eligible for. Columns: Category | Sub Category | Amount | Status.
 */
import { useState,useRef, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { getMyAllowanceApi } from '../utils/allowanceApi';
import type { Category } from '../types/category';

interface AllowanceRow {
  category_id: string;
  category_name: string;
  sub_category: string;
  amount: number;
  is_active: boolean;
}

function flattenCategories(lsCats: Category[]): AllowanceRow[] {
  const lsRows: AllowanceRow[] = [];
  for (const objCat of lsCats) {
    const lsSubs = objCat.sub_categories && objCat.sub_categories.length > 0
      ? objCat.sub_categories
      : ['—'];
    for (const strSub of lsSubs) {
      lsRows.push({
        category_id: objCat.category_id,
        category_name: objCat.name,
        sub_category: strSub,
        amount: objCat.max_limit,
        is_active: objCat.is_active,
      });
    }
  }
  return lsRows;
}

export default function AllowanceDetailsPage() {
  const [lsCategories, setLsCategories] = useState<Category[]>([]);
  const [bIsLoading, setBIsLoading] = useState<boolean>(true);
  const [strError, setStrError] = useState<string>('');
  const [strQuery, setStrQuery] = useState<string>('');
  const [strStatusFilter, setStrStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<keyof AllowanceRow | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [bShowCatDropdown, setBShowCatDropdown] = useState(false);
  const [bShowSubCatDropdown, setBShowSubCatDropdown] = useState(false);

  function toggleSort(key: keyof AllowanceRow) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }: { col: keyof AllowanceRow }) {
    return (
      <span className="inline-flex flex-col ml-1 gap-[1px]">
        <span className={`text-[8px] leading-none ${sortKey === col && sortDir === 'asc' ? 'text-[#00703C]' : 'text-gray-400'}`}>▲</span>
        <span className={`text-[8px] leading-none ${sortKey === col && sortDir === 'desc' ? 'text-[#00703C]' : 'text-gray-400'}`}>▼</span>
      </span>
    );
  }
  function toggleCategory(name: string) {
      setSelectedCategories(prev =>
        prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
      );
    }

    function toggleSubCategory(name: string) {
      setSelectedSubCategories(prev =>
        prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
      );
    }

  useEffect(() => {
    async function fetchAllowances() {
      setBIsLoading(true);
      setStrError('');
      try {
        const lsData = await getMyAllowanceApi();
        setLsCategories(lsData);
      } catch (objErr: any) {
        setStrError(objErr.response?.data?.detail || 'Failed to load allowances');
      } finally {
        setBIsLoading(false);
      }
    }
    fetchAllowances();
  }, []);

  const refCatDropdown = useRef<HTMLDivElement>(null);
  const refSubCatDropdown = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (refCatDropdown.current && !refCatDropdown.current.contains(e.target as Node)) {
        setBShowCatDropdown(false);
      }
      if (refSubCatDropdown.current && !refSubCatDropdown.current.contains(e.target as Node)) {
        setBShowSubCatDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const lsRows = useMemo(() => {
    const lsAll = flattenCategories(lsCategories);
    const q = strQuery.trim().toLowerCase();

    let lsFiltered = lsAll.filter(r => {
      const matchesQuery = !q || r.category_name.toLowerCase().includes(q) || r.sub_category.toLowerCase().includes(q);
      const matchesStatus =
        strStatusFilter === 'all' ||
        (strStatusFilter === 'active' ? r.is_active : !r.is_active);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(r.category_name);
        const matchesSubCategory = selectedSubCategories.length === 0 || selectedSubCategories.includes(r.sub_category);
        return matchesQuery && matchesStatus && matchesCategory && matchesSubCategory;
    });

    if (sortKey) {
      lsFiltered = [...lsFiltered].sort((a, b) => {
        const vA = a[sortKey];
        const vB = b[sortKey];
        let cmp = 0;
        if (typeof vA === 'string' && typeof vB === 'string') {
          cmp = vA.localeCompare(vB);
        } else if (typeof vA === 'number' && typeof vB === 'number') {
          cmp = vA - vB;
        } else if (typeof vA === 'boolean' && typeof vB === 'boolean') {
          cmp = Number(vA) - Number(vB);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return lsFiltered;
  },  [lsCategories, strQuery, strStatusFilter, sortKey, sortDir, selectedCategories, selectedSubCategories])

  const columns: { label: string; col: keyof AllowanceRow; align: string }[] = [
    { label: 'Category',     col: 'category_name', align: 'text-left'   },
    { label: 'Sub Category', col: 'sub_category',  align: 'text-left'   },
    { label: 'Amount',       col: 'amount',        align: 'text-right'  },
    { label: 'Status',       col: 'is_active',     align: 'text-center' },
  ];

  const lsCategoryOptions = useMemo(() => {
    const all = flattenCategories(lsCategories).map(r => r.category_name);
    return [...new Set(all)].sort();
  }, [lsCategories]);

  const lsSubCategoryOptions = useMemo(() => {
    const all = flattenCategories(lsCategories).map(r => r.sub_category);
    return [...new Set(all)].sort();
  }, [lsCategories]);

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 cursor-default">
            Allowance Details
          </h2>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Category multi-select */}
          {/* Filter bar — 4 col grid */}
          <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-4 gap-3 items-center">

            {/* 1. Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={strQuery}
                onChange={e => setStrQuery(e.target.value)}
                placeholder="Search category…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#00703C] transition-colors"
              />
            </div>

            {/* 2. Status filter */}
            <select
              value={strStatusFilter}
              onChange={e => setStrStatusFilter(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#00703C] transition-colors cursor-pointer text-gray-700"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* 3. Category multi-select */}
            <div className="relative" ref={refCatDropdown}>
              <button
                onClick={() => { setBShowCatDropdown(p => !p); setBShowSubCatDropdown(false); }}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-white flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  selectedCategories.length > 0 ? 'border-[#00703C] text-[#00703C]' : 'border-gray-300 text-gray-700'
                } hover:border-[#00703C]`}
              >
                <span className="truncate">
                  {selectedCategories.length > 0 ? `Category (${selectedCategories.length})` : 'All Categories'}
                </span>
                <span className="text-[10px] shrink-0">▼</span>
              </button>
              {bShowCatDropdown && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-full py-1">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Category</span>
                    {selectedCategories.length > 0 && (
                      <button onClick={() => setSelectedCategories([])} className="text-xs text-[#00703C] hover:underline">Clear</button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {lsCategoryOptions.map(name => (
                      <label key={name} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(name)}
                          onChange={() => toggleCategory(name)}
                          className="accent-[#00703C] w-3.5 h-3.5"
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Sub Category multi-select */}
            <div className="relative" ref={refSubCatDropdown}>
              <button
                onClick={() => { setBShowSubCatDropdown(p => !p); setBShowCatDropdown(false); }}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-white flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  selectedSubCategories.length > 0 ? 'border-[#00703C] text-[#00703C]' : 'border-gray-300 text-gray-700'
                } hover:border-[#00703C]`}
              >
                <span className="truncate">
                  {selectedSubCategories.length > 0 ? `Sub Category (${selectedSubCategories.length})` : 'All Sub Categories'}
                </span>
                <span className="text-[10px] shrink-0">▼</span>
              </button>
              {bShowSubCatDropdown && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg w-full py-1">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Sub Category</span>
                    {selectedSubCategories.length > 0 && (
                      <button onClick={() => setSelectedSubCategories([])} className="text-xs text-[#00703C] hover:underline">Clear</button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {lsSubCategoryOptions.map(name => (
                      <label key={name} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedSubCategories.includes(name)}
                          onChange={() => toggleSubCategory(name)}
                          className="accent-[#00703C] w-3.5 h-3.5"
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>


        

            {bIsLoading && (
              <p className="px-4 py-6 text-center text-sm text-gray-500 cursor-default">
                Loading allowances…
              </p>
            )}

            {strError && (
              <div className="mx-4 my-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm cursor-default">
                {strError}
              </div>
            )}

            {!bIsLoading && !strError && (
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="border-b border-gray-200">
                      {columns.map(({ label, col, align }) => (
                        <th
                          key={col}
                          onClick={() => toggleSort(col)}
                          className={`px-4 py-3 ${align} text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors border-r border-gray-200 ${col === 'category_name' ? 'border-l' : ''}`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortIcon col={col} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lsRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 cursor-default">
                          No allowances found.
                        </td>
                      </tr>
                    ) : (
                      lsRows.map((r, i) => (
                        <tr
                          key={`${r.category_id}-${r.sub_category}-${i}`}
                          className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${
                            i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3 text-left font-medium text-gray-900 cursor-default border-l border-r border-gray-200">
                              {r.category_name}
                            </td>
                            <td className="px-4 py-3 text-left text-gray-700 cursor-default border-r border-gray-200">
                              {r.sub_category}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900 cursor-default border-r border-gray-200">
                              ₹{r.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center cursor-default border-r border-gray-200">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                r.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {r.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}