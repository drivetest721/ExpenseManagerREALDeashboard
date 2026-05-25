/**
 * useAuth — convenience re-export of the auth context hook.
 *
 * Usage:
 *   const { objUser, bIsAuthenticated, login, logout } = useAuth();
 *
 * This thin wrapper lets components import from `hooks/useAuth` rather
 * than reaching into the context layer directly, keeping the import path
 * stable if the implementation ever moves.
 */
export { useAuthContext as useAuth } from '../context/AuthContext';
