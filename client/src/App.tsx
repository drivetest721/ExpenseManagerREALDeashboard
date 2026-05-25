/**
 * App — root route table for the Expense Management frontend.
 * Protected routes require authentication (handled by ProtectedRoute).
 * Placeholder pages are swapped out as each phase lands.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PlaceholderPage from './pages/PlaceholderPage';
import AllowanceDetailsPage from './pages/AllowanceDetailsPage';

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Root redirect → protected expense page */}
      <Route path="/" element={<Navigate to="/expense" replace />} />

      {/* Protected routes */}
      <Route
        path="/expense"
        element={
          <ProtectedRoute>
            <PlaceholderPage
              title="Expense Management"
              phase="Phase 7 — Reimbursement Core"
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/allowance"
        element={
          <ProtectedRoute>
            <AllowanceDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Profile" phase="Phase 5 — Payment Methods" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredRole="owner">
            <PlaceholderPage title="Settings" phase="Phase 13 — Settings Page" />
          </ProtectedRoute>
        }
      />

      {/* 404 — redirect to expense (ProtectedRoute handles unauthed redirect) */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Navigate to="/expense" replace />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
