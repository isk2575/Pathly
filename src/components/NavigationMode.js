import { useState, useEffect, useRef } from 'react';
import SOSButton from './SOSButton';

// The campus parking garage — the transfer point where the off-campus
// (OpenRouteService) leg ends and the on-campus (safe-route) leg begins.
const PARKING_GARAGE = { lat: 29.7188, lng: -95.3398 };

// Campus-area check — must MATCH Map.js: a 1.5-mile walkable radius around
// campus center (covers Bayou Oaks, Cambridge Oaks, the Lofts, etc.), not a
// bounding box. Inside the radius you walk from where you are; beyond it the
// blue ORS leg guides you to the parking spot you chose.
const CAMPUS_CENTER = { lat: 29.7199, lng: -95.3422 };
const WALKABLE_RADIUS_MILES = 1.5;

const NAV_ZOOM = 19;             // how tight to zoom on the user when navigating
const RECENTER_THRESHOLD_M = 10; // follow the user once they've moved this far

function isInsideCampus(lat, lng)
{
  const R = 3958.8;
  const dLat = (lat - CAMPUS_CENTER.lat) * Math.PI / 180;
  const dLng = (lng - CAMPUS_CENTER.lng) * Math.PI / 180;
  const lat1 = CAMPUS_CENTER.lat * Math.PI / 180, lat2 = lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const miles = R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return miles <= WALKABLE_RADIUS_MILES;
}

export default function NavigationMode({ route, onExit, mapRef, darkMode, destinationName, onOffCampusRoute, onJourneyMarkers })
{
  const [phase, setPhase] = useState('off_campus');
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [offCampusDistance, setOffCampusDistance] = useState(null);
  const [offCampusTime, setOffCampusTime] = useState(null);

  const watchRef = useRef(null);
  const phaseRef = useRef('off_campus');
  const lastRecenterRef = useRef(null);
  const userPosRef = useRef(null); // always holds the latest GPS fix

  const destLabel = destinationName || 'Your destination';

  const getDistance = (lat1, lng1, lat2, lng2) =>
  {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateRouteDistance = (fromIndex) =>
  {
    if (!route || route.length === 0) return 0;
    let total = 0;
    for (let i = fromIndex; i < route.length - 1; i++)
    {
      total += getDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
    }
    return total;
  };

  const formatDistance = (meters) =>
  {
    if (!meters && meters !== 0) return '...';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // snap the camera in close on the user and start the follow tracking
  const zoomToUser = (userLat, userLng) =>
  {
    if (!mapRef.current) return;
    // single combined move — separate panTo + setZoom calls can interrupt each
    // other mid-animation and land the camera in the wrong place
    mapRef.current.flyTo({ center: [userLng, userLat], zoom: NAV_ZOOM, duration: 800 });
    lastRecenterRef.current = { lat: userLat, lng: userLng };
  };

  // recenter on the user as they move, but only on real movement.
  // never touches zoom, so manual zoom sticks.
  const followUser = (userLat, userLng) =>
  {
    if (!mapRef.current) return;
    const last = lastRecenterRef.current;
    const moved = last ? getDistance(last.lat, last.lng, userLat, userLng) : Infinity;
    if (moved > RECENTER_THRESHOLD_M)
    {
      mapRef.current.easeTo({ center: [userLng, userLat], duration: 600 });
      lastRecenterRef.current = { lat: userLat, lng: userLng };
    }
  };

  // manual recenter — snap the camera back onto the user at full nav zoom
  const recenter = () =>
  {
    if (!mapRef.current) return;
    const p = userPosRef.current;
    if (!p) return;
    mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: NAV_ZOOM, duration: 800 });
    lastRecenterRef.current = { lat: p.lat, lng: p.lng };
  };

  // the arrival pin (D) is shown the whole time
  const arrivalMarker = () =>
    ({ lat: route[route.length - 1].lat, lng: route[route.length - 1].lng, letter: 'D', color: '#22c55e' });

  // Off-campus leg: OpenRouteService foot-walking from the user to where the
  // green safe route begins, drawn (by Map.js) as a blue MapLibre line.
  const fetchOffCampusRoute = async (userLat, userLng) =>
  {
    const dest = (route && route.length > 0) ? route[0] : PARKING_GARAGE;
    const key = process.env.REACT_APP_ORS_KEY;
    if (!key)
    {
      console.error('Missing REACT_APP_ORS_KEY — off-campus leg unavailable.');
      return;
    }

    try
    {
      const res = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
      {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [[userLng, userLat], [dest.lng, dest.lat]] }),
      });
      if (!res.ok) throw new Error(`ORS ${res.status}`);

      const data = await res.json();
      const feat = data.features && data.features[0];
      if (!feat) throw new Error('No route in ORS response');

      // hand the [lng,lat] coordinate list up to Map.js to draw the blue line
      if (onOffCampusRoute) onOffCampusRoute(feat.geometry.coordinates);

      const sum = feat.properties && feat.properties.summary;
      if (sum)
      {
        setOffCampusDistance(formatDistance(sum.distance));
        setOffCampusTime(`${Math.max(1, Math.round(sum.duration / 60))} min`);
      }
    }
    catch (err)
    {
      console.error('Off-campus route (ORS) failed:', err);
    }
  };

  const switchToOnCampus = () =>
  {
    if (phaseRef.current === 'on_campus') return;

    phaseRef.current = 'on_campus';
    setPhase('on_campus');

    // crossed onto campus — drop the blue leg + the A/C pins, keep arrival
    if (onOffCampusRoute) onOffCampusRoute([]);
    if (onJourneyMarkers && route && route.length) onJourneyMarkers([arrivalMarker()]);

    const dist = calculateRouteDistance(0);
    setDistanceRemaining(dist);
    setTimeRemaining(Math.ceil(dist / 1.4 / 60));
  };

  useEffect(() =>
  {
    if (!route || route.length === 0) return;

    const D = arrivalMarker();

    // get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) =>
      {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        userPosRef.current = { lat: userLat, lng: userLng };

        // zoom in tight on the user the moment navigation starts
        zoomToUser(userLat, userLng);

        if (isInsideCampus(userLat, userLng))
        {
          if (onJourneyMarkers) onJourneyMarkers([D]);
          if (onOffCampusRoute) onOffCampusRoute([]);
          switchToOnCampus();
        }
        else
        {
          phaseRef.current = 'off_campus';
          setPhase('off_campus');

          // A start → C campus departure → D arrival
          const A = { lat: userLat, lng: userLng, letter: 'A', color: '#3b82f6' };
          const C = { lat: route[0].lat, lng: route[0].lng, letter: 'C', color: '#22c55e' };
          if (onJourneyMarkers) onJourneyMarkers([A, C, D]);

          fetchOffCampusRoute(userLat, userLng);
        }
      },
      () =>
      {
        // geolocation failed — don't guess where the user is. fall back to the
        // on-campus route so navigation still works without a fake position.
        if (onJourneyMarkers) onJourneyMarkers([D]);
        switchToOnCampus();
      },
      // generous timeout + allow a recent cached fix so slow laptops and the
      // DevTools Sensors override actually resolve instead of timing out.
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
    );

    // continuously watch position
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) =>
      {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        userPosRef.current = { lat: userLat, lng: userLng };

        // follow the user as they move (no zoom changes)
        followUser(userLat, userLng);

        if (isInsideCampus(userLat, userLng))
        {
          // crossed onto campus — switch from the blue leg to the safe route
          if (phaseRef.current === 'off_campus')
          {
            switchToOnCampus();
          }

          // find closest point on route
          let closestIndex = 0;
          let closestDist = Infinity;
          route.forEach((node, i) =>
          {
            const d = getDistance(userLat, userLng, node.lat, node.lng);
            if (d < closestDist)
            {
              closestDist = d;
              closestIndex = i;
            }
          });

          setCurrentNodeIndex(closestIndex);
          const remaining = calculateRouteDistance(closestIndex);
          setDistanceRemaining(remaining);
          setTimeRemaining(Math.ceil(remaining / 1.4 / 60));

          // arrival detection
          if (closestIndex >= route.length - 1 && closestDist < 15)
          {
            setArrived(true);
            navigator.geolocation.clearWatch(watchRef.current);
          }
        }
      },
      (err) => { console.log('GPS watch error:', err.message); },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
    );

    return () =>
    {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      // clear the lifted line + pins so nothing lingers after nav ends
      if (onOffCampusRoute) onOffCampusRoute([]);
      if (onJourneyMarkers) onJourneyMarkers([]);
    };
  }, []);

  const progress = route && route.length > 1 ? (currentNodeIndex / (route.length - 1)) * 100 : 0;

  // arrived screen
  if (arrived)
  {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
        <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-10 max-w-sm w-full mx-4 text-center shadow-2xl">
          <div className="relative mx-auto mb-6 w-24 h-24">
            <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center shadow-2xl shadow-green-900/50">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="white">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span className="absolute -inset-2 rounded-full animate-ping bg-green-600/20" />
          </div>
          <h2 className="text-white text-3xl font-bold mb-1">Arrived.</h2>
          <p className="text-green-400 font-medium mb-1">{destLabel}</p>
          <p className="text-gray-500 text-sm mb-8">You made it safely. Stay aware.</p>
          <div className="flex flex-col gap-3">
            <button onClick={onExit} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all">
              End Navigation
            </button>
            <button onClick={onExit} className="w-full bg-gray-800/80 hover:bg-gray-700 text-gray-300 font-medium py-4 rounded-2xl transition-all text-sm">
              Find Another Route
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
  <>
    {/* TOP BAR */}
    <div className="absolute top-0 left-0 right-0 z-20 bg-neutral-950 border-b border-neutral-800 shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4">

        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-3xl flex items-center justify-center shrink-0 ${
            phase === 'off_campus' ? 'bg-blue-600' : 'bg-green-600'
          }`}>
            {phase === 'off_campus'
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
                </svg>
            }
          </div>

          <div>
            <p className={`text-xs font-black uppercase tracking-[0.18em] ${
              phase === 'off_campus' ? 'text-blue-400' : 'text-green-400'
            }`}>
              {phase === 'off_campus' ? 'To Campus Parking' : 'Safe Route Active'}
            </p>
            <p className="text-white font-black text-lg leading-tight">{destLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-5">
            <div className="text-right">
              <p className="text-white font-black text-xl leading-none">
                {phase === 'off_campus' ? (offCampusDistance ?? '...') : formatDistance(distanceRemaining)}
              </p>
              <p className="text-neutral-500 text-xs mt-1">
                {phase === 'off_campus' ? 'to parking' : 'remaining'}
              </p>
            </div>

            <div className="w-px h-9 bg-neutral-800" />

            <div className="text-right">
              <p className="text-white font-black text-xl leading-none">
                {phase === 'off_campus' ? (offCampusTime ?? '...') : `${timeRemaining ?? '...'} min`}
              </p>
              <p className="text-neutral-500 text-xs mt-1">walk</p>
            </div>
          </div>

          <button
            onClick={onExit}
            className="px-5 py-3 bg-red-500 text-white text-sm font-black rounded-3xl active:bg-red-600"
          >
            End
          </button>
        </div>
      </div>

      {phase === 'on_campus' && (
        <div className="px-5 pb-4">
          <div className="w-full bg-neutral-800 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
        </div>
      )}
    </div>

    {/* BOTTOM CARD */}
    <div className="absolute bottom-0 left-0 right-0 z-20">

      <SOSButton isNavigating />

      <button
        onClick={recenter}
        aria-label="Recenter on my location"
        className="absolute -top-16 right-5 z-30 w-12 h-12 rounded-full bg-neutral-950 border border-neutral-800 text-blue-400 shadow-2xl flex items-center justify-center active:scale-95"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="12" cy="12" r="8"/>
          <line x1="12" y1="1" x2="12" y2="4"/>
          <line x1="12" y1="20" x2="12" y2="23"/>
          <line x1="1" y1="12" x2="4" y2="12"/>
          <line x1="20" y1="12" x2="23" y2="12"/>
        </svg>
      </button>

      <div className="bg-neutral-950 border-t border-neutral-800 px-5 pt-4 pb-6 shadow-2xl">

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-3xl flex items-center justify-center shrink-0 ${
            phase === 'off_campus' ? 'bg-blue-600' : 'bg-green-600'
          }`}>
            {phase === 'off_campus'
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
                </svg>
            }
          </div>

          <div>
            <p className="text-neutral-500 text-xs font-black uppercase tracking-[0.18em]">
              {phase === 'off_campus' ? 'Walking to' : 'Heading to'}
            </p>
            <p className="text-white font-black text-lg leading-tight">
              {phase === 'off_campus' ? 'Campus Parking Garage' : destLabel}
            </p>
            <p className="text-neutral-500 text-sm">
              {phase === 'off_campus'
                ? 'Safe campus route starts when you arrive'
                : `${formatDistance(distanceRemaining)} remaining on Pathly safe route`}
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 rounded-3xl px-4 py-3 border ${
          phase === 'off_campus'
            ? 'bg-blue-500/10 border-blue-500/20'
            : 'bg-green-500/10 border-green-500/20'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${
            phase === 'off_campus' ? 'bg-blue-500' : 'bg-green-500'
          }`} />

          <p className={`text-sm font-semibold ${
            phase === 'off_campus' ? 'text-blue-400' : 'text-green-400'
          }`}>
            {phase === 'off_campus'
              ? 'Walking to campus parking before Pathly routing begins'
              : 'Pathly safe route active — prioritizing lighting and blue light phones'}
          </p>
        </div>
      </div>
    </div>
  </>
);
}