import { useState } from 'react';

export default function RightPanel({ darkMode }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="absolute top-16 right-0 z-10 flex items-start">

      {/* Toggle Arrow */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-4 w-6 h-12 rounded-l-lg flex items-center justify-center transition-all ${
          darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-white hover:bg-gray-100 text-gray-600'
        } shadow-md`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {isOpen
            ? <polyline points="9 18 15 12 9 6"/>
            : <polyline points="15 18 9 12 15 6"/>
          }
        </svg>
      </button>

      {/* Panel */}
      <div className={`transition-all duration-300 ease-in-out ${
        isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'
      }`}>
        <div className={`w-72 rounded-l-2xl shadow-2xl ${
          darkMode ? 'bg-gray-900/95 border-l border-y border-gray-800' : 'bg-white/95 border-l border-y border-gray-200'
        } backdrop-blur-md p-5 flex flex-col gap-4 max-h-[calc(100vh-120px)] overflow-y-hidden hover:overflow-y-auto`}>

          {/* Safety Score Header */}
          <div className="flex items-center justify-between">
            <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Your Safety Score
            </h2>
            <button className="text-gray-400 hover:text-gray-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
            </button>
          </div>

          {/* Score Circle */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke={darkMode ? '#1f2937' : '#e5e7eb'} strokeWidth="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none"
                  stroke="#22c55e" strokeWidth="3"
                  strokeDasharray="89 100"
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#22c55e">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-green-400">89</span>
                <span className="text-gray-400 text-sm mb-1">/100</span>
              </div>
              <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full font-medium">High</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Well-lit paths</span>
              </div>
              <span className="text-green-400 text-sm font-medium">Good</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Blue Light Phones</span>
              </div>
              <span className="text-blue-400 text-sm font-medium">3 nearby</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Recent Alerts</span>
              </div>
              <span className="text-gray-400 text-sm font-medium">None on route</span>
            </div>
          </div>

          {/* View Route Details */}
          <button className={`w-full py-3 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-2 ${
            darkMode ? 'border-blue-700 text-blue-400 hover:bg-blue-900/30' : 'border-blue-300 text-blue-600 hover:bg-blue-50'
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
            View Route Details
          </button>

          {/* Campus Alerts */}
          <div className="flex items-center justify-between">
            <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Campus Alerts</h2>
            <button className="text-blue-400 text-xs font-medium hover:text-blue-300">View All</button>
          </div>

          {/* Alerts List */}
          {[
            { type: "Suspicious Activity", location: "Near Parking Lot B", time: "Today, 8:32 PM", distance: "0.3 mi", color: "yellow" },
            { type: "Theft Report", location: "Near Student Center", time: "Today, 6:15 PM", distance: "0.2 mi", color: "yellow" },
            { type: "Road Closed", location: "Near Engineering Building", time: "Today, 5:40 PM", distance: "0.4 mi", color: "red" },
            { type: "Maintenance", location: "Pathway near Cougar Woods", time: "Today, 4:20 PM", distance: "0.6 mi", color: "blue" },
          ].map((alert, i) => {
            const colors = {
              yellow: { bg: "bg-yellow-900/30", border: "border-yellow-800", text: "text-yellow-400", dot: "bg-yellow-500" },
              red: { bg: "bg-red-900/30", border: "border-red-800", text: "text-red-400", dot: "bg-red-500" },
              blue: { bg: "bg-blue-900/30", border: "border-blue-800", text: "text-blue-400", dot: "bg-blue-500" },
            }[alert.color];
            return (
              <div key={i} className={`rounded-xl p-3 border ${colors.bg} ${colors.border}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <p className={`text-sm font-medium ${colors.text}`}>{alert.type}</p>
                </div>
                <p className="text-xs text-gray-400">{alert.location}</p>
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">{alert.time}</p>
                  <p className="text-xs text-gray-500">{alert.distance}</p>
                </div>
              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}