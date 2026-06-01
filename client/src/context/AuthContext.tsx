/**
 * AuthContext — global authentication state for the Expense Management app.
 *
 * Provides:
 *   - objUser        : current UserProfile (or null)
 *   - bIsAuthenticated
 *   - bIsLoading     : true while the initial /me check is in-flight
 *   - login()        : persists JWT + sets user state
 *   - logout()       : clears JWT + resets state
 *   - refreshUser()  : re-fetch /me (call after profile changes)
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { loginApi, logoutApi, getMeApi, type LoginRequest } from '../utils/authApi';
import type { User } from '../types/user';
import { AUTH_TOKEN_KEY } from '../utils/apiClient';

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextShape {
  objUser: User | null;
  bIsAuthenticated: boolean;
  bIsLoading: boolean;
  login: (objPayload: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextShape | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [objUser, setObjUser] = useState<User | null>(null);
  const [bIsLoading, setBIsLoading] = useState<boolean>(true);

  /** Re-fetch the current user from /api/auth/me */
  const refreshUser = useCallback(async () => {
    const strToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!strToken) {
      setObjUser(null);
      setBIsLoading(false);
      return;
    }
    try {
      const objResp = await getMeApi();
      setObjUser(objResp.user);
    } catch {
      // Token invalid / expired — clear it
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setObjUser(null);
    } finally {
      setBIsLoading(false);
    }
  }, []);

  // On mount: restore session from stored token
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (objPayload: LoginRequest) => {
    const objResp = await loginApi(objPayload);
    setObjUser(objResp.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setObjUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        objUser,
        bIsAuthenticated: objUser !== null,
        bIsLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuthContext — consume AuthContext.
 * Must be used inside <AuthProvider>.
 */
export function useAuthContext(): AuthContextShape {
  const objCtx = useContext(AuthContext);
  if (!objCtx) {
    throw new Error('useAuthContext must be used inside <AuthProvider>');
  }
  return objCtx;
}
