import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../Firebase';
import { useNavigate } from 'react-router-dom';

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
    <div className={`absolute top-0 left-0 right-0 z-10 flex items-center px-6 py-3 gap-4 ${
      darkMode ? 'bg-gray-950/90' : 'bg-white/90'
    } backdrop-blur-md shadow-md`}>

      {/* Left - Logo */}
      <div className="flex items-center gap-3 min-w-fit">
        {/* Shield Icon */}
        <div className="relative">
          <span className="absolute -inset-1 rounded-lg animate-pulse bg-blue-500/30 blur-sm" />
          <div className="relative w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
            </svg>
          </div>
        </div>

        {/* Brand */}
        <div>
          <h1 className={`text-lg font-bold leading-none ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>Pathly</h1>
          <p className="text-xs text-gray-400 leading-none mt-0.5">Stay Safe. Stay Connected.</p>
        </div>
      </div>

      {/* Center - Search Bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
          darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-100 border border-gray-200'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            className="text-gray-400" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Where do you want to go?"
            className={`flex-1 bg-transparent text-sm outline-none ${
              darkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
            }`}
          />
        </div>
      </div>

      {/* Right - Alerts + Dark mode + Avatar */}
      <div className="flex items-center gap-3 min-w-fit">

        {/* Dark/Light toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`p-2 rounded-lg transition-all ${
            darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        {/* Alerts Bell */}
        <button className="relative p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {/* Badge */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            3
          </span>
        </button>

        {/* User Avatar + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              {getInitials()}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 top-12 w-40 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-100">
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-gray-800 transition-all"
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