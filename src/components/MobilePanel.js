import { useState } from 'react';
import axios from 'axios';

export default function MobilePanel({ darkMode, onRouteFound, onStartNavigation })
{
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
      const response = await axios.get(`https://pathly-gbgtejg8bxa8gffj.centralus-01.azurewebsites.net/route/${endpoint}`, {
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
    <div className="flex flex-col gap-4">

      {/* Destination select */}
      <select
        value={endId}
        onChange={(e) => { setEndId(e.target.value); setRouteFound(false); if (onRouteFound) onRouteFound(null); }}
        className="w-full bg-transparent text-white text-sm outline-none"
      >
        <option value="" className="bg-gray-900">Select destination...</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id} className="bg-gray-900">
            {loc.name}
          </option>
        ))}
      </select>

      {/* Route preference */}
      <div className="flex gap-2">
        <button
          onClick={() => setPreference('fastest')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
            preference === 'fastest' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
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
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
            preference === 'safest' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Safest
        </button>
      </div>

      {/* Find Route button */}
      <button
        onClick={handleFindRoute}
        disabled={routeLoading || !endId}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2"
      >
        {routeLoading ? 'Finding route...' : 'Find Safe Route'}
        {!routeLoading && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </button>

      {/* Start Route button */}
      {routeFound && (
        <button
          onClick={onStartNavigation}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Route
        </button>
      )}

    </div>
  );
}