/**
 * AllowanceDetailsPage — read-only view of allowances (categories) assigned to
 * the current user.
 *
 * If the user is Admin (Owner/CA), shows all categories + assignees.
 * Otherwise shows only categories the user is eligible for.
 */
import { useState, useEffect } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { useAuth } from '../hooks/useAuth';
import { getMyAllowanceApi, getAllAllowanceApi } from '../utils/allowanceApi';
import type { Category, AllowanceWithAssignees } from '../types/category';
import AllowanceCard from '../components/allowance/AllowanceCard';
import AssigneeList from '../components/allowance/AssigneeList';

export default function AllowanceDetailsPage() {
  const { objUser } = useAuth();
  const [lsCategories, setLsCategories] = useState<Category[]>([]);
  const [lsAllowances, setLsAllowances] = useState<AllowanceWithAssignees[]>([]);
  const [bIsLoading, setBIsLoading] = useState<boolean>(true);
  const [strError, setStrError] = useState<string>('');

  const bIsAdmin = objUser?.primary_role === 'owner' || objUser?.primary_role === 'ca';

  useEffect(() => {
    async function fetchAllowances() {
      setBIsLoading(true);
      setStrError('');
      try {
        if (bIsAdmin) {
          const lsData = await getAllAllowanceApi();
          setLsAllowances(lsData);
        } else {
          const lsData = await getMyAllowanceApi();
          setLsCategories(lsData);
        }
      } catch (objErr: any) {
        setStrError(objErr.response?.data?.detail || 'Failed to load allowances');
      } finally {
        setBIsLoading(false);
      }
    }

    fetchAllowances();
  }, [bIsAdmin]);

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 cursor-default">
            Allowance Details
          </h2>

          {bIsLoading && (
            <p className="text-gray-600 cursor-default">Loading allowances...</p>
          )}

          {strError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 cursor-default">
              {strError}
            </div>
          )}

          {!bIsLoading && !strError && (
            <div className="space-y-4">
              {bIsAdmin ? (
                lsAllowances.length === 0 ? (
                  <p className="text-gray-600 cursor-default">No categories configured yet.</p>
                ) : (
                  lsAllowances.map((objAllowance) => (
                    <div key={objAllowance.category_id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <AllowanceCard objCategory={objAllowance} />
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 cursor-default">
                          Assignees ({objAllowance.assignees.length})
                        </h4>
                        <AssigneeList lsAssignees={objAllowance.assignees} />
                      </div>
                    </div>
                  ))
                )
              ) : (
                lsCategories.length === 0 ? (
                  <p className="text-gray-600 cursor-default">No allowances assigned to you.</p>
                ) : (
                  lsCategories.map((objCat) => (
                    <div key={objCat.category_id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <AllowanceCard objCategory={objCat} />
                    </div>
                  ))
                )
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
