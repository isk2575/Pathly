export default function BottomBar({ darkMode }) {
  return (
    <div className={`absolute bottom-0 left-0 right-0 z-10 ${
      darkMode ? 'bg-gray-950/95 border-t border-gray-800' : 'bg-white/95 border-t border-gray-200'
    } backdrop-blur-md`}>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-8 py-3">

        {/* Share Location */}
        <button className={`flex items-center gap-2 text-sm font-medium transition-all ${
          darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share Location
        </button>

        {/* Divider */}
        <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

        {/* Emergency Contacts */}
        <button className={`flex items-center gap-2 text-sm font-medium transition-all ${
          darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Emergency Contacts
        </button>

        {/* Divider */}
        <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

        {/* Report an Issue */}
        <button className={`flex items-center gap-2 text-sm font-medium transition-all ${
          darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
        }`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Report an Issue
        </button>

      </div>

      {/* Footer */}
      <div className={`flex items-center justify-center gap-4 py-2 border-t ${
        darkMode ? 'border-gray-800' : 'border-gray-200'
      }`}>
        <span className="text-xs text-gray-500">© 2025 Pathly</span>
        <span className="text-gray-700 text-xs">·</span>
        <button className="text-xs text-gray-500 hover:text-gray-400 transition-all">Privacy Policy</button>
        <span className="text-gray-700 text-xs">·</span>
        <button className="text-xs text-gray-500 hover:text-gray-400 transition-all">Terms of Service</button>
        <span className="text-gray-700 text-xs">·</span>
        <button className="text-xs text-gray-500 hover:text-gray-400 transition-all">Contact</button>
      </div>

    </div>
  );
}