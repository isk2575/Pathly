import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../Firebase';
import { useNavigate } from 'react-router-dom';

// Desktop top bar. Matches the mobile header: floating/transparent over the
// map, flat brand mark, round icon buttons. Theme-aware via dark: classes.
// No search box. Keeps the desktop-only profile dropdown + sign out.
export default function Navbar({ darkMode, setDarkMode, user }) {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 pt-3 pb-6 bg-gradient-to-b from-white/90 via-white/50 to-transparent dark:from-neutral-950/80 dark:via-neutral-950/40 dark:to-transparent">

      {/* Left — flat brand mark */}
      <div className="min-w-fit">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
          Pathly
        </h1>
      </div>

      {/* Right — theme toggle, bell, avatar */}
      <div className="flex items-center gap-2 min-w-fit">

        {/* Theme toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Toggle theme"
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-neutral-100 text-neutral-700 active:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:active:bg-neutral-700"
        >
          {darkMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Alerts bell */}
        <button
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-neutral-100 text-neutral-700 active:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:active:bg-neutral-700"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
            3
          </span>
        </button>

        {/* User avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 pl-1.5 pr-2 h-10 rounded-full transition-colors bg-neutral-100 active:bg-neutral-200 dark:bg-neutral-800 dark:active:bg-neutral-700"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {getInitials()}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-600 dark:text-white">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-12 w-40 rounded-xl shadow-xl overflow-hidden z-[100] border bg-white border-neutral-200 dark:bg-neutral-900 dark:border-neutral-700">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 text-left text-sm text-red-500 active:bg-neutral-100 dark:text-red-400 dark:active:bg-neutral-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}