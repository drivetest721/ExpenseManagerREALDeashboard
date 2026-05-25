/**
 * HomePage — Phase-0 landing page. Verifies backend connectivity by calling
 * GET /api/health. Acts as a smoke-test until real pages land in later phases.
 */
import { useEffect, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { ErrorCard } from '../components/ErrorCard';
import { getHealth, type HealthResponse } from '../utils/healthApi';

export default function HomePage() {
  const [objHealth, setObjHealth] = useState<HealthResponse | null>(null);
  const [objError, setObjError] = useState<Error | null>(null);
  const [bLoading, setBLoading] = useState<boolean>(true);

  useEffect(() => {
    let bIsMounted = true;
    setBLoading(true);
    getHealth()
      .then((dictData) => {
        if (bIsMounted) setObjHealth(dictData);
      })
      .catch((objErr: unknown) => {
        if (bIsMounted) {
          setObjError(
            objErr instanceof Error ? objErr : new Error('Failed to reach backend'),
          );
        }
      })
      .finally(() => {
        if (bIsMounted) setBLoading(false);
      });
    return () => {
      bIsMounted = false;
    };
  }, []);

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-default">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Real Dashboard — Expense Management
            </h2>
            <p className="text-sm text-gray-600">
              Scaffolding complete. Use the navigation above to access the
              upcoming Expense Management and Allowance Details modules.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 cursor-default">
              Backend connectivity
            </h3>

            {bLoading && (
              <p className="text-sm text-gray-500 cursor-default">
                Pinging <code className="bg-gray-100 px-1 rounded">/api/health</code>…
              </p>
            )}

            {objError && <ErrorCard title="Backend unreachable" error={objError} />}

            {objHealth && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md cursor-default">
                <p className="text-sm">
                  ✅ <strong>{objHealth.app}</strong> v{objHealth.version} ·
                  env: <code>{objHealth.env}</code>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
