import { useState } from 'react';

export default function LeftPanel({ darkMode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [destination, setDestination] = useState('');
  const [preference, setPreference] = useState('safest');

  return (
    <div className={`absolute top-16 left-0 z-10 flex items-start`}>
      
      {/* Panel */}
      <div className={`transition-all duration-300 ease-in-out ${
        isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden '
      }`}>
        <div className={`w-72 rounded-r-2xl shadow-2xl ${
          darkMode ? 'bg-gray-900/95 border-r border-y border-gray-800' : 'bg-white/95 border-r border-y border-gray-200'
        } backdrop-blur-md p-5 flex flex-col gap-4 max-h-[calc(100vh-120px)] overflow-y-hidden hover:overflow-y-auto`}>

          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Find Safe Route
            </h2>
          </div>

          {/* From */}
          <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-1">From</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>My Current Location</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 ml-4">You are here</p>
          </div>

          {/* To */}
          <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-1">To</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter destination..."
                className={`flex-1 bg-transparent text-sm outline-none ${
                  darkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                }`}
              />
              {destination && (
                <button onClick={() => setDestination('')} className="text-gray-500 hover:text-gray-300">✕</button>
              )}
            </div>
          </div>

          {/* Route Preference */}
          <div>
            <p className={`text-xs mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Route Preference</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPreference('fastest')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                  preference === 'fastest'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : darkMode
                    ? 'bg-gray-800 border-gray-700 text-gray-400'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                ⏱ Fastest
              </button>
              <button
                onClick={() => setPreference('safest')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                  preference === 'safest'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : darkMode
                    ? 'bg-gray-800 border-gray-700 text-gray-400'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                🛡 Safest
              </button>
            </div>
          </div>

          {/* Find Route Button */}
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
            Find Safe Route
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          {/* How it works */}
          <div className={`rounded-xl p-3 ${darkMode ? 'bg-blue-950/50 border border-blue-900' : 'bg-blue-50 border border-blue-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span>💡</span>
              <p className={`text-xs font-medium ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>How it works</p>
            </div>
            <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              We find the safest route using real campus safety data and smart algorithms.
            </p>
          </div>

        </div>
      </div>

      {/* Toggle Arrow */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-4 w-6 h-12 rounded-r-lg flex items-center justify-center transition-all ${
          darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-white hover:bg-gray-100 text-gray-600'
        } shadow-md`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {isOpen
            ? <polyline points="15 18 9 12 15 6"/>
            : <polyline points="9 18 15 12 9 6"/>
          }
        </svg>
      </button>

    </div>
  );
}