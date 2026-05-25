/**
 * App — root route table for the Expense Management frontend.
 * Real page implementations land in later phases; placeholders keep the
 * navigation wired during Phase 0 scaffolding.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PlaceholderPage from './pages/PlaceholderPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/expense" replace />} />
      <Route path="/home" element={<HomePage />} />
      <Route
        path="/login"
        element={<PlaceholderPage title="Login" phase="Phase 2 — Authentication" />}
      />
      <Route
        path="/expense"
        element={
          <PlaceholderPage
            title="Expense Management"
            phase="Phase 7 — Reimbursement Core"
          />
        }
      />
      <Route
        path="/allowance"
        element={
          <PlaceholderPage
            title="Allowance Details"
            phase="Phase 4 — Categories & Allowance"
          />
        }
      />
      <Route
        path="/profile"
        element={
          <PlaceholderPage title="Profile" phase="Phase 5 — Payment Methods" />
        }
      />
      <Route
        path="/settings"
        element={
          <PlaceholderPage title="Settings" phase="Phase 13 — Settings Page" />
        }
      />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}

export default App;
