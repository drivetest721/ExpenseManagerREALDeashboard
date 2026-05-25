/**
 * AppHeader — top navigation bar.
 * Renders the two primary links required by REAL_DASHBOARD_APP.txt:
 *   - "Expense Management"
 *   - "Allowance Details"
 * Additional links (Profile, Settings) become visible based on role in later phases.
 */
import { NavLink } from 'react-router-dom';

const strNavBase =
  'px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer';
const strNavInactive = 'text-gray-700 hover:bg-gray-100';
const strNavActive = 'bg-[#00703C] text-white hover:bg-[#005a30]';

export function AppHeader() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-default">
          <div className="w-2 h-8 rounded-full bg-[#00703C]" />
          <h1 className="text-lg font-semibold text-gray-900">Real Dashboard</h1>
        </div>

        <nav className="flex items-center gap-2">
          <NavLink
            to="/expense"
            className={({ isActive }) =>
              `${strNavBase} ${isActive ? strNavActive : strNavInactive}`
            }
          >
            Expense Management
          </NavLink>
          <NavLink
            to="/allowance"
            className={({ isActive }) =>
              `${strNavBase} ${isActive ? strNavActive : strNavInactive}`
            }
          >
            Allowance Details
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default AppHeader;
