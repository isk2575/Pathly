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
    <div className="flex flex-col gap-4">

      {/* Destination select */}
      <select
        value={endId}
        onChange={(e) => { setEndId(e.target.value); setRouteFound(false); }}
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
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-md transition-all flex items-center justify-center gap-1.5 ${
            preference === 'fastest'
              ? 'bg-blue-500/20 border-blue-400/50 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]'
              : 'bg-white/5 border-white/10 text-gray-400'
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
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-md transition-all flex items-center justify-center gap-1.5 ${
            preference === 'safest'
              ? 'bg-green-500/20 border-green-400/50 text-white shadow-[0_0_18px_rgba(34,197,94,0.35)]'
              : 'bg-white/5 border-white/10 text-gray-400'
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
        className="relative w-full bg-blue-600/80 backdrop-blur-md border border-blue-400/40 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base transition-all hover:shadow-[0_0_24px_rgba(59,130,246,0.5)] hover:bg-blue-600 flex items-center justify-center gap-2"
      >
        <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
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
          className="relative w-full bg-green-600/80 backdrop-blur-md border border-green-400/40 text-white font-bold py-4 rounded-2xl text-base transition-all hover:shadow-[0_0_24px_rgba(34,197,94,0.5)] hover:bg-green-600 flex items-center justify-center gap-2"
        >
          <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Route
        </button>
      )}

    </div>
  );
}