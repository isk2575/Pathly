import { useState } from 'react';
import axios from 'axios';

export default function LeftPanel({ darkMode, onRouteFound, onStartNavigation }) {
  const [isOpen, setIsOpen] = useState(true);
  const [preference, setPreference] = useState('safest');
  const [routeLoading, setRouteLoading] = useState(false);
  const [endId, setEndId] = useState('');
  const [routeFound, setRouteFound] = useState(false);

  const locations = [
    { id: 'n1', name: 'MD Anderson Library' },
    { id: 'n2', name: 'Student Center' },
    { id: 'n3', name: 'Science Building' },
    { id: 'n4', name: 'Cougar Village' },
    { id: 'n5', name: 'Athletics / TDECU Stadium' },
    { id: 'n6', name: 'Parking Garage' },
    { id: 'n7', name: 'CT Bauer College' },
    { id: 'n8', name: 'Cullen Family Plaza' },
    { id: 'n9', name: 'Moody Towers' },
    { id: 'n10', name: 'UH Welcome Center' },
  ];

  const handleFindRoute = async () =>
{
  if (!endId) return;
  setRouteLoading(true);
  try
  {
    const endpoint = preference === 'safest' ? 'safest' : 'fastest';
    const response = await axios.get(`http://10.0.0.141:8000/route/${endpoint}`, {
      params: { start: 'n1', end: endId }
    });
    if (onRouteFound) onRouteFound(response.data.path);
    setRouteFound(true);
  }
  catch (err)
  {
    console.error('Route error:', err);
  }
  finally
  {
    setRouteLoading(false);
  }
};

  return (
    <div className="absolute top-16 left-0 z-10 flex items-start">

      {/* Panel */}
      <div className={`transition-all duration-300 ease-in-out ${
        isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'
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

          {/* From - Current Location */}
          <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-1">From</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className={`text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                My Current Location
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 ml-4">GPS location</p>
          </div>

          {/* To */}
          <div className={`rounded-xl p-3 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <p className="text-xs text-gray-400 mb-1">To</p>
            <select
              value={endId}
              onChange={(e) =>
              {
                setEndId(e.target.value);
                if (onRouteFound) onRouteFound(null);
                setRouteFound(false);
              }}
              className={`w-full bg-transparent text-sm outline-none ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              <option value="" className="bg-gray-900">Select destination...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id} className="bg-gray-900">
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Route Preference */}
          <div>
            <p className={`text-xs mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Route Preference
            </p>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Fastest
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Safest
              </button>
            </div>
          </div>

          {/* Find Route Button */}
          <button
            onClick={handleFindRoute}
            disabled={routeLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            {routeLoading ? 'Finding route...' : 'Find Safe Route'}
            {!routeLoading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            )}
          </button>

          {/* Start Route Button */}
          {routeFound && (
            <button
              onClick={onStartNavigation}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start Route
            </button>
          )}

          {/* How it works */}
          <div className={`rounded-xl p-3 ${darkMode ? 'bg-blue-950/50 border border-blue-900' : 'bg-blue-50 border border-blue-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={darkMode ? 'text-blue-300' : 'text-blue-700'}>
                <line x1="9" y1="18" x2="15" y2="18"/>
                <line x1="10" y1="22" x2="14" y2="22"/>
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
              </svg>
              <p className={`text-xs font-medium ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                How it works
              </p>
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