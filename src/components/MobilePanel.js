import { useState } from 'react';

export default function MobilePanel({ darkMode, locations, onRequestRoute, onStartNavigation })
{
  const [preference, setPreference] = useState('safest');
  const [routeLoading, setRouteLoading] = useState(false);
  const [endId, setEndId] = useState('');
  const [routeFound, setRouteFound] = useState(false);

  const handleFindRoute = async () =>
  {
    if (!endId) return;

    // look up the chosen destination's coordinates
    const destination = locations.find((loc) => String(loc.id) === endId);
    if (!destination) return;

    setRouteLoading(true);
    try
    {
      const path = await onRequestRoute(destination.lat, destination.lng, preference);
      setRouteFound(!!path);
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
    <div className="flex flex-col gap-3">

      {/* Destination (To) */}
      <div className="bg-neutral-800 rounded-2xl p-4">
        <p className="text-xs text-neutral-400 mb-2">To</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <select
            value={endId}
            onChange={(e) => { setEndId(e.target.value); setRouteFound(false); }}
            className="flex-1 bg-transparent text-white text-sm font-medium outline-none"
          >
            <option value="" className="bg-neutral-900">Select destination...</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id} className="bg-neutral-900">
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Route preference */}
      <div className="flex gap-2">
        <button
          onClick={() => setPreference('safest')}
          className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            preference === 'safest' ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Safest
        </button>
        <button
          onClick={() => setPreference('fastest')}
          className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            preference === 'fastest' ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-400'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Fastest
        </button>
      </div>

      {/* Find Route — white pill */}
      <button
        onClick={handleFindRoute}
        disabled={routeLoading || !endId}
        className="w-full bg-white text-black font-bold py-4 rounded-full text-base disabled:opacity-40 transition-colors active:bg-neutral-200 flex items-center justify-center gap-2"
      >
        {routeLoading ? 'Finding route...' : 'Find Safe Route'}
        {!routeLoading && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </button>

      {/* Start Route — green pill */}
      {routeFound && (
        <button
          onClick={onStartNavigation}
          className="w-full bg-green-500 text-black font-bold py-4 rounded-full text-base transition-colors active:bg-green-400 flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Route
        </button>
      )}

    </div>
  );
}