/**
 * ProtectedRoute — wraps any route that requires authentication.
 *
 * Behaviour:
 *  - While auth state is loading   → show a centred spinner (no flash).
 *  - Not authenticated             → redirect to /login, preserving intended destination.
 *  - Authenticated                 → render the child element.
 *
 * Optional `requiredRole` prop restricts access to a specific primary_role.
 * If the user's role doesn't match, they're sent to /expense with a toast.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, only users whose primary_role matches can access this route. */
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { bIsAuthenticated, bIsLoading, objUser } = useAuth();
  const objLocation = useLocation();

  // While restoring session from localStorage — render nothing (prevents flash)
  if (bIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 cursor-default">
          <div className="w-8 h-8 border-4 border-[#00703C] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    );
  }

  // Not logged in → go to login, remember where user was trying to go
  if (!bIsAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: objLocation.pathname }}
        replace
      />
    );
  }

  // Role-restricted route check
  if (requiredRole && objUser?.departments.find((d) => d.is_primary)?.role !== requiredRole) {
    return <Navigate to="/expense" replace />;
  }

  return <>{children}</>;
}
