/**
 * App — root route table for the Expense Management frontend.
 * Protected routes require authentication (handled by ProtectedRoute).
 * Placeholder pages are swapped out as each phase lands.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AllowanceDetailsPage from './pages/AllowanceDetailsPage';
import ProfilePage from './pages/ProfilePage';
import ExpenseManagementPage from './pages/ExpenseManagementPage';
import NewReimbursementPage from './pages/NewReimbursementPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotificationsInboxPage from './pages/NotificationsInboxPage';

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
            <ExpenseManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expense/new/:formType"
        element={
          <ProtectedRoute>
            <NewReimbursementPage />
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
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredRole="owner">
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredRole="owner">
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <NotificationsInboxPage />
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
