/**
 * AppHeader — Drake-style top navigation bar.
 */

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { NotificationBell } from './common/NotificationBell';



type NavItem = {
  to: string;
  label: string;
  admin?: boolean;
};

const strNavBase =
  'px-4 py-2 rounded-md text-lg font-semibold transition-all duration-200 cursor-pointer';

const strNavInactive =
  'text-[#1F2A44] hover:text-[#00703C] hover:bg-gray-50';

const strNavActive =
  'text-[#00703C] bg-green-50';

export function AppHeader() {
  const { objUser, logout } = useAuth();
  const navigate = useNavigate();

  const [bMenuOpen, setBMenuOpen] = useState(false);
  const [bIsLoggingOut, setBIsLoggingOut] = useState(false);

  const bIsAdmin =
    !!objUser &&
    (objUser.departments || []).some(
      (objDepartment) => objDepartment.role === 'owner'
    );

  const handleLogout = async () => {
    setBIsLoggingOut(true);

    try {
      await logout();
      navigate('/login');
    } catch (objErr) {
      console.error('Logout failed:', objErr);
    } finally {
      setBIsLoggingOut(false);
    }
  };
  console.log('User in AppHeader:', objUser);
  const lsNav: NavItem[] = [
    { to: '/expense', label: 'Expense Management' },
    { to: '/allowance', label: 'Allowance Details' },
    { to: '/profile', label: 'Profile' },
    { to: '/analytics', label: 'Analytics', admin: true },
    { to: '/settings', label: 'Settings', admin: true },
  ];

  const lsVisible = lsNav.filter(
    (objNav) => !objNav.admin || bIsAdmin
  );

  const strInitials =
    objUser?.name
      ?.split(' ')
      .map((strPart:String) => strPart[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'AN';

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-8 lg:px-12 h-[100px] flex items-center justify-between">

        {/* Left Section */}
        <div className="flex items-center gap-5">

          <img
            src='/favicon.png'
            alt="Logo"
            className="h-14 lg:h-16 w-auto object-contain"
          />

          <h1 className="text-2xl lg:text-3xl font-semibold text-gray-900 whitespace-nowrap">
            Expense Manager
          </h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6">
          {lsVisible.map((objNav) => (
            <NavLink
              key={objNav.to}
              to={objNav.to}
              className={({ isActive }) =>
                `${strNavBase} ${
                  isActive ? strNavActive : strNavInactive
                }`
              }
            >
              {objNav.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop Right Section */}
        <div className="hidden lg:flex items-center gap-5">

          <NotificationBell />

          {/* User Avatar with Hover Name */}
          <div className="relative group">
            <div
              className="
                w-12 h-12
                rounded-full
                bg-gray-600
                text-white
                flex
                items-center
                justify-center
                text-sm
                font-bold
                cursor-pointer
              "
            >
              {strInitials}
            </div>

            <div
              className="
                absolute
                top-full
                left-1/2
                -translate-x-1/2
                mt-2
                px-3
                py-1.5
                rounded-md
                bg-black
                text-white
                text-sm
                whitespace-nowrap
                opacity-0
                invisible
                group-hover:opacity-100
                group-hover:visible
                transition-all
                duration-200
                z-50
              "
            >
              {objUser?.name || 'User'}
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={bIsLoggingOut}
            className="
              px-5
              py-2.5
              border
              border-gray-300
              rounded-lg
              bg-white
              text-gray-700
              font-medium
              hover:bg-red-50
              hover:text-red-700
              hover:border-red-300
              transition-all
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {bIsLoggingOut ? 'Logging Out...' : 'Logout'}
          </button>
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-2 lg:hidden">

          <NotificationBell />

          <button
            onClick={() => setBMenuOpen((bPrev) => !bPrev)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            {bMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {bMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-4 flex flex-col gap-2">

            {lsVisible.map((objNav) => (
              <NavLink
                key={objNav.to}
                to={objNav.to}
                onClick={() => setBMenuOpen(false)}
                className={({ isActive }) =>
                  `${strNavBase} ${
                    isActive ? strNavActive : strNavInactive
                  }`
                }
              >
                {objNav.label}
              </NavLink>
            ))}

            <button
              onClick={() => {
                setBMenuOpen(false);
                handleLogout();
              }}
              disabled={bIsLoggingOut}
              className="
                flex
                items-center
                gap-2
                px-4
                py-3
                text-red-600
                hover:bg-red-50
                rounded-md
              "
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default AppHeader;