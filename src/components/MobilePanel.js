import { useState } from 'react';
import DestinationPicker from './DestinationPicker';
import RouteExplain from './RouteExplain';

export default function MobilePanel({ darkMode, userLocation, locations, isOffCampus = false, onRequestRoute, onStartNavigation })
{
  const [preference, setPreference] = useState('safest');
  const [routeLoading, setRouteLoading] = useState(false);
  const [endId, setEndId] = useState('');
  const [routeFound, setRouteFound] = useState(false);
  const [lastRoute, setLastRoute] = useState(null); // {start, end, name} for 'Why this route?'

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
        setLastRoute({
          start,
          end: { lat: destination.lat, lng: destination.lng },
          name: destination.name,
        });
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
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4">
          <p className="text-sm font-bold text-neutral-900 dark:text-white">
            Looks like you're not on campus
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Choose where you'll park — your safe walking route starts from there.
          </p>
          <div className="mt-3 bg-white dark:bg-neutral-950 rounded-2xl px-4 py-3 border border-neutral-200 dark:border-neutral-800">
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

      {/* Start Route — green pill (stays green in both themes; it's a go signal) */}
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

      {/* Why this route? — only for the safest route (the fastest one isn't
          chosen for safety, so explaining its safety would be misleading) */}
      {routeFound && preference === 'safest' && lastRoute && (
        <RouteExplain
          start={lastRoute.start}
          end={lastRoute.end}
          destinationName={lastRoute.name}
          darkMode={darkMode}
        />
      )}

    </div>
  );
}