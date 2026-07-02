import { useState } from 'react';
import DestinationPicker from './DestinationPicker';

export default function LeftPanel({ darkMode, locations, isOffCampus = false, onRequestRoute, onStartNavigation })
{
  const [isOpen, setIsOpen] = useState(true);
  const [preference, setPreference] = useState('safest');
  const [routeLoading, setRouteLoading] = useState(false);
  const [endId, setEndId] = useState('');
  const [routeFound, setRouteFound] = useState(false);

  const t = darkMode
    ? {
        panel: 'bg-neutral-900 border-neutral-800',
        card: 'bg-neutral-800',
        textMain: 'text-white',
        textSub: 'text-neutral-400',
        textHint: 'text-neutral-500',
        segBg: 'bg-neutral-800',
        segOn: 'bg-white text-black',
        segOff: 'text-neutral-400',
        primary: 'bg-white text-black active:bg-neutral-200',
        primaryStroke: 'black',
        iconBox: 'bg-neutral-800 border-neutral-700',
        iconStroke: 'white',
        toggle: 'bg-neutral-800 text-neutral-400 active:bg-neutral-700',
        optBg: 'bg-neutral-900',
      }
    : {
        panel: 'bg-white border-neutral-200',
        card: 'bg-neutral-100',
        textMain: 'text-neutral-900',
        textSub: 'text-neutral-500',
        textHint: 'text-neutral-400',
        segBg: 'bg-neutral-100',
        segOn: 'bg-white text-neutral-900 shadow-sm',
        segOff: 'text-neutral-500',
        primary: 'bg-neutral-900 text-white active:bg-neutral-800',
        primaryStroke: 'white',
        iconBox: 'bg-neutral-100 border-neutral-200',
        iconStroke: 'black',
        toggle: 'bg-neutral-100 text-neutral-500 active:bg-neutral-200',
        optBg: 'bg-white',
      };

  // off-campus: pick which garage you'll park at — the route starts there
  const [parkingId, setParkingId] = useState('');
  const parkingSpots = locations.filter((l) => l.category === 'parking');

  const handleFindRoute = async () =>
  {
    if (!endId) return;

    const destination = locations.find((loc) => String(loc.id) === endId);
    if (!destination) return;

    // off-campus users must pick a parking spot first
    let startOverride = null;
    if (isOffCampus)
    {
      const spot = parkingSpots.find((p) => String(p.id) === parkingId);
      if (!spot) return;
      startOverride = { lat: spot.lat, lng: spot.lng };
    }

    setRouteLoading(true);

    try
    {
      const path = await onRequestRoute(destination.lat, destination.lng, preference, startOverride);
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
    <div className="absolute top-16 left-0 z-10 flex items-start">

      <div className={`transition-all duration-300 ease-in-out ${
        isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'
      }`}>
        <div className={`w-72 rounded-r-3xl shadow-2xl border-r border-y ${t.panel} p-4 flex flex-col gap-3 max-h-[calc(100vh-120px)] overflow-y-hidden hover:overflow-y-auto`}>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.16em] ${t.textHint}`}>
                Pathly
              </p>
              <h2 className={`text-xl font-black ${t.textMain}`}>
                Route
              </h2>
            </div>

            <div className={`w-10 h-10 rounded-2xl border ${t.iconBox} flex items-center justify-center`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.iconStroke} strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>

          {/* Route Stack */}
          <div className={`rounded-3xl p-4 ${t.card}`}>
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <div className="w-px flex-1 bg-neutral-400/30 my-2" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>

              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <p className={`text-xs ${t.textSub}`}>From</p>
                  <p className={`text-sm font-semibold ${t.textMain}`}>
                    My Current Location
                  </p>
                  <p className={`text-xs ${t.textHint}`}>GPS location</p>
                </div>

                <div>
                  <p className={`text-xs ${t.textSub} mb-1`}>To</p>
                  <DestinationPicker
                    locations={locations}
                    value={endId}
                    onChange={(id) =>
                    {
                      setEndId(id);
                      setRouteFound(false);
                    }}
                    placeholder="Select destination…"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Off-campus: choose your parking spot */}
          {isOffCampus && (
            <div className="rounded-3xl bg-amber-500/10 border border-amber-500/25 p-4">
              <p className={`text-sm font-bold ${t.textMain}`}>
                Looks like you're not on campus
              </p>
              <p className={`text-xs mt-1 ${t.textHint}`}>
                Choose where you'll park — your safe walking route starts from there.
              </p>
              <div className={`mt-3 rounded-2xl px-3 py-2.5 ${t.card}`}>
                <DestinationPicker
                  locations={parkingSpots}
                  value={parkingId}
                  onChange={(id) => { setParkingId(id); setRouteFound(false); }}
                  placeholder="Choose a parking spot…"
                />
              </div>
            </div>
          )}

          {/* Preference */}
          <div className={`rounded-full p-1 ${t.segBg}`}>
            <div className="flex gap-1">
              <button
                onClick={() => setPreference('fastest')}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                  preference === 'fastest' ? t.segOn : t.segOff
                }`}
              >
                Fastest
              </button>

              <button
                onClick={() => setPreference('safest')}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                  preference === 'safest' ? t.segOn : t.segOff
                }`}
              >
                Safest
              </button>
            </div>
          </div>

          {/* CTA */}
          {!routeFound ? (
            <button
              onClick={handleFindRoute}
              disabled={routeLoading || !endId || (isOffCampus && !parkingId)}
              className={`w-full font-black py-3.5 rounded-3xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2 ${t.primary}`}
            >
              {routeLoading ? 'Finding route...' : 'Find Safe Route'}

              {!routeLoading && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.primaryStroke} strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              )}
            </button>
          ) : (
            <button
              onClick={onStartNavigation}
              className="w-full bg-green-600 text-white font-black py-3.5 rounded-3xl text-sm transition-colors active:bg-green-700 flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start Route
            </button>
          )}

          {/* Small Info Card */}
          <div className={`rounded-3xl p-4 ${t.card}`}>
            <p className={`text-sm font-bold ${t.textMain}`}>
              Safer campus routing
            </p>
            <p className={`text-xs mt-1 leading-relaxed ${t.textHint}`}>
              Pathly uses campus paths, safety data, and route preference to suggest a better walk.
            </p>
          </div>

        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-4 w-6 h-12 rounded-r-xl flex items-center justify-center transition-colors shadow-md ${t.toggle}`}
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