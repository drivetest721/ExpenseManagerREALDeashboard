/**
 * AllowanceDetailsPage — read-only table of allowances the current user is
 * eligible for. Columns: Category | Sub Category | Amount | Status.
 */
import { useState, useEffect, useMemo } from 'react';
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

  const lsRows = useMemo(() => {
    const lsAll = flattenCategories(lsCategories);
    const q = strQuery.trim().toLowerCase();
    if (!q) return lsAll;
    return lsAll.filter(r =>
      r.category_name.toLowerCase().includes(q) ||
      r.sub_category.toLowerCase().includes(q)
    );
  }, [lsCategories, strQuery]);

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 cursor-default">
            Allowance Details
          </h2>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Search bar */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  value={strQuery}
                  onChange={e => setStrQuery(e.target.value)}
                  placeholder="Search category or sub-category…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#00703C] transition-colors"
                />
              </div>
            </div>

            {bIsLoading && (
              <p className="px-4 py-6 text-center text-sm text-gray-500 cursor-default">Loading allowances…</p>
            )}

            {strError && (
              <div className="mx-4 my-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm cursor-default">
                {strError}
              </div>
            )}

            {!bIsLoading && !strError && (
              <div className="max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-4 py-3 text-center border-l border-r border-gray-200">Category</th>
                      <th className="px-4 py-3 text-center border-r border-gray-200">Sub Category</th>
                      <th className="px-4 py-3 text-right border-r border-gray-200">Amount</th>
                      <th className="px-4 py-3 text-center border-r border-gray-200">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lsRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 cursor-default border-l border-r border-gray-200">
                          No allowances assigned to you.
                        </td>
                      </tr>
                    ) : (
                      lsRows.map((r, i) => (
                        <tr key={`${r.category_id}-${r.sub_category}-${i}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-center font-medium text-gray-900 cursor-default border-l border-r border-gray-200">{r.category_name}</td>
                          <td className="px-4 py-3 text-center text-gray-700 cursor-default border-r border-gray-200">{r.sub_category}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 cursor-default border-r border-gray-200">₹{r.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center cursor-default border-r border-gray-200">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
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
