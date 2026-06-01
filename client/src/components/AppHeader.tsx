/**
 * AppHeader — top navigation bar.
 * Desktop: inline nav links. Mobile: hamburger drawer.
 * Links: Expense Management, Allowance Details, Profile, Analytics & Settings (owner/ca only).
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from './common/NotificationBell';

const strNavBase =
  'px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer';
const strNavInactive = 'text-gray-700 hover:bg-gray-100';
const strNavActive = 'bg-[#00703C] text-white hover:bg-[#005a30]';

type NavItem = { to: string; label: string; admin?: boolean };

export function AppHeader() {
  const { objUser } = useAuth();
  const [bMenuOpen, setBMenuOpen] = useState<boolean>(false);
  // Allow Which role can see the Analytics page and the settings page
  const bIsAdmin = !!objUser && (objUser.departments || []).some(
    (d) => d.role === 'owner'
  );

  const lsNav: NavItem[] = [
    { to: '/expense', label: 'Expense Management' },
    { to: '/allowance', label: 'Allowance Details' },
    { to: '/profile', label: 'Profile' },
    { to: '/analytics', label: 'Analytics', admin: true },
    { to: '/settings', label: 'Settings', admin: true },
  ];
  const lsVisible = lsNav.filter((n) => !n.admin || bIsAdmin);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 cursor-default min-w-0">
          <div className="w-2 h-8 rounded-full bg-[#00703C] shrink-0" />
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Real Dashboard</h1>
        </div>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-2">
          {lsVisible.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `${strNavBase} ${isActive ? strNavActive : strNavInactive}`
              }
            >
              {n.label}
            </NavLink>
          ))}
          <NotificationBell />
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 lg:hidden">
          <NotificationBell />
          <button
            onClick={() => setBMenuOpen((b) => !b)}
            aria-label={bMenuOpen ? 'Close menu' : 'Open menu'}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            {bMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {bMenuOpen && (
        <nav className="lg:hidden border-t border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col gap-1">
            {lsVisible.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                onClick={() => setBMenuOpen(false)}
                className={({ isActive }) =>
                  `${strNavBase} ${isActive ? strNavActive : strNavInactive} w-full`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

export default AppHeader;
