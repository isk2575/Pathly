import { useState } from 'react';
import DestinationPicker from './DestinationPicker';

export default function MobilePanel({ darkMode, userLocation, locations, isOffCampus = false, onRequestRoute, onRouteReady })
{
  const [preference, setPreference] = useState('safest');
  const [routeLoading, setRouteLoading] = useState(false);
  const [endId, setEndId] = useState('');
  const [routeFound, setRouteFound] = useState(false);

  // off-campus: the user picks which garage they'll park at; the green route
  // starts there and the blue ORS leg drives/walks them to it.
  const [parkingId, setParkingId] = useState('');
  const parkingSpots = locations.filter((l) => l.category === 'parking');

  const handleFindRoute = async () =>
  {
    if (!endId) return;

    // look up the chosen destination's coordinates
    const destination = locations.find((loc) => String(loc.id) === endId);
    if (!destination) return;

    // off-campus users must pick a parking spot first — that's the route start
    let startOverride = null;
    if (isOffCampus)
    {
      const spot = parkingSpots.find((p) => String(p.id) === parkingId);
      if (!spot) return; // button is disabled until a spot is picked
      startOverride = { lat: spot.lat, lng: spot.lng };
    }

    setRouteLoading(true);
    try
    {
      const path = await onRequestRoute(destination.lat, destination.lng, preference, startOverride);
      setRouteFound(!!path);
      if (path)
      {
        const start = startOverride || userLocation;
        // hand the route up — Map closes this picker and shows the floating
        // route card (Start Route + Why this route) on the map itself.
        if (onRouteReady)
        {
          onRouteReady({
            start,
            end: { lat: destination.lat, lng: destination.lng },
            name: destination.name,
            preference,
          });
        }
      }
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

      {/* Destination (To) — searchable picker */}
      <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-4">
        <p className="text-xs font-medium text-neutral-500 mb-2">To</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <DestinationPicker
              locations={locations}
              value={endId}
              onChange={(id) => { setEndId(id); setRouteFound(false); }}
              placeholder="Select destination…"
            />
          </div>
        </div>
      </div>

      {/* Off-campus: choose your parking spot — the route starts there and
          the blue leg guides you to it */}
      {isOffCampus && (
        <div className="bg-neutral-800 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400 shrink-0">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <p className="text-sm font-semibold text-white">
              You're a bit off campus
            </p>
          </div>
          <p className="text-xs text-neutral-400 mt-1.5">
            Choose where you'll park — your safe walk starts from there.
          </p>
          <div className="mt-3 bg-neutral-900 rounded-2xl px-4 py-3">
            <DestinationPicker
              locations={parkingSpots}
              value={parkingId}
              onChange={(id) => { setParkingId(id); setRouteFound(false); }}
              placeholder="Choose a parking spot…"
            />
          </div>
        </div>
      )}

      {/* Route preference — inverting pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setPreference('safest')}
          className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            preference === 'safest'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
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
            preference === 'fastest'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
              : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Fastest
        </button>
      </div>

      {/* Find Route — inverting primary pill */}
      <button
        onClick={handleFindRoute}
        disabled={routeLoading || !endId || (isOffCampus && !parkingId)}
        className="w-full bg-neutral-900 text-white dark:bg-white dark:text-black font-bold py-4 rounded-full text-base disabled:opacity-40 transition-colors active:bg-neutral-800 dark:active:bg-neutral-200 flex items-center justify-center gap-2"
      >
        {routeLoading ? 'Finding route...' : 'Find Safe Route'}
        {!routeLoading && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </button>

    </div>
  );
}