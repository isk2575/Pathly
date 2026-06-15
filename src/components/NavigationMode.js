import { useState, useEffect, useRef } from 'react';

// The campus parking garage — the transfer point where the off-campus (Google)
// leg ends and the on-campus (safe-route) leg begins.
const PARKING_GARAGE = { lat: 29.7188, lng: -95.3398 };

// Campus bounding box — used to decide whether the user is on campus.
const CAMPUS_BOUNDS = { north: 29.7300, south: 29.7100, east: -95.3300, west: -95.3550 };

const RECENTER_THRESHOLD_M = 15; // only follow the user once they've moved this far

function isInsideCampus(lat, lng)
{
  return (
    lat <= CAMPUS_BOUNDS.north &&
    lat >= CAMPUS_BOUNDS.south &&
    lng <= CAMPUS_BOUNDS.east &&
    lng >= CAMPUS_BOUNDS.west
  );
}

export default function NavigationMode({ route, onExit, mapRef, darkMode, destinationName })
{
  const [phase, setPhase] = useState('off_campus');
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [distanceRemaining, setDistanceRemaining] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [offCampusDistance, setOffCampusDistance] = useState(null);
  const [offCampusTime, setOffCampusTime] = useState(null);

  const watchRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const phaseRef = useRef('off_campus');
  const lastRecenterRef = useRef(null);

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

  // recenter the camera on the user, but only when they've actually moved.
  // never touches zoom, so manual zoom sticks.
  const followUser = (userLat, userLng) =>
  {
    if (!mapRef.current) return;
    const last = lastRecenterRef.current;
    const moved = last ? getDistance(last.lat, last.lng, userLat, userLng) : Infinity;
    if (moved > RECENTER_THRESHOLD_M)
    {
      mapRef.current.panTo({ lat: userLat, lng: userLng });
      lastRecenterRef.current = { lat: userLat, lng: userLng };
    }
  };

  // Off-campus leg: Google walking directions from the user to the parking garage.
  const getOffCampusDirections = (userLat, userLng) =>
  {
    if (!window.google || !mapRef.current) return;

    if (directionsRendererRef.current)
    {
      directionsRendererRef.current.setMap(null);
    }

    const renderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#3b82f6',
        strokeWeight: 6,
        strokeOpacity: 0.9,
      },
    });
    renderer.setMap(mapRef.current);
    directionsRendererRef.current = renderer;

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: userLat, lng: userLng },
        destination: PARKING_GARAGE,
        travelMode: window.google.maps.TravelMode.WALKING,
      },
      (result, status) =>
      {
        if (status === 'OK')
        {
          renderer.setDirections(result);
          const leg = result.routes[0].legs[0];
          setOffCampusDistance(leg.distance.text);
          setOffCampusTime(leg.duration.text);

          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend({ lat: userLat, lng: userLng });
          bounds.extend(PARKING_GARAGE);
          mapRef.current.fitBounds(bounds, { top: 120, bottom: 200, left: 40, right: 40 });
        }
        else
        {
          console.error('Off-campus directions failed:', status);
          mapRef.current.panTo({ lat: userLat, lng: userLng });
          mapRef.current.setZoom(15);
        }
      }
    );
  };

  const switchToOnCampus = () =>
  {
    if (phaseRef.current === 'on_campus') return;

    phaseRef.current = 'on_campus';
    setPhase('on_campus');

    if (directionsRendererRef.current)
    {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }

    if (mapRef.current && route && route.length > 0)
    {
      mapRef.current.panTo({ lat: route[0].lat, lng: route[0].lng });
      mapRef.current.setZoom(18);
      lastRecenterRef.current = { lat: route[0].lat, lng: route[0].lng };
    }

    const dist = calculateRouteDistance(0);
    setDistanceRemaining(dist);
    setTimeRemaining(Math.ceil(dist / 1.4 / 60));
  };

  useEffect(() =>
  {
    if (!route || route.length === 0) return;

    // get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) =>
      {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        if (isInsideCampus(userLat, userLng))
        {
          switchToOnCampus();
        }
        else
        {
          phaseRef.current = 'off_campus';
          setPhase('off_campus');
          getOffCampusDirections(userLat, userLng);
          lastRecenterRef.current = { lat: userLat, lng: userLng };
        }
      },
      () => { switchToOnCampus(); },
      { enableHighAccuracy: true, timeout: 8000 }
    );

    // continuously watch position
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) =>
      {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        // follow user gently (only on real movement, no zoom changes)
        followUser(userLat, userLng);

        if (isInsideCampus(userLat, userLng))
        {
          // crossed onto campus — switch from the Google leg to the safe route
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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () =>
    {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
    };
  }, []);

  const formatDistance = (meters) =>
  {
    if (!meters && meters !== 0) return '...';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

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
      <div className="absolute top-0 left-0 right-0 z-20 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/40 shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">

          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
              phase === 'off_campus' ? 'bg-blue-600 shadow-blue-900/40' : 'bg-green-600 shadow-green-900/40'
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
              <p className={`text-xs font-bold uppercase tracking-wider ${
                phase === 'off_campus' ? 'text-blue-400' : 'text-green-400'
              }`}>
                {phase === 'off_campus' ? 'Heading to Campus Parking' : 'On Campus — Safe Route Active'}
              </p>
              <p className="text-white font-bold text-sm leading-tight">{destLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {phase === 'off_campus'
              ? <>
                  <div className="text-right">
                    <p className="text-white font-black text-xl leading-none">{offCampusDistance ?? '...'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">to parking</p>
                  </div>
                  <div className="w-px h-8 bg-gray-700" />
                  <div className="text-right">
                    <p className="text-white font-black text-xl leading-none">{offCampusTime ?? '...'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">walk</p>
                  </div>
                </>
              : <>
                  <div className="text-right">
                    <p className="text-white font-black text-xl leading-none">{formatDistance(distanceRemaining)}</p>
                    <p className="text-gray-500 text-xs mt-0.5">remaining</p>
                  </div>
                  <div className="w-px h-8 bg-gray-700" />
                  <div className="text-right">
                    <p className="text-white font-black text-xl leading-none">{timeRemaining ?? '...'}</p>
                    <p className="text-gray-500 text-xs mt-0.5">min</p>
                  </div>
                </>
            }
            <button
              onClick={onExit}
              className="ml-1 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              End
            </button>
          </div>
        </div>

        {phase === 'on_campus' && (
          <div className="px-5 pb-3">
            <div className="w-full bg-gray-800/60 rounded-full h-1">
              <div
                className="bg-green-500 h-1 rounded-full transition-all duration-700"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CARD */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="bg-gray-950/80 backdrop-blur-xl border-t border-gray-800/40 shadow-2xl px-5 pt-4 pb-6">

          {phase === 'off_campus'
            ? <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5"/>
                      <polyline points="5 12 12 5 19 12"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Walking to</p>
                    <p className="text-white font-bold text-base">Campus Parking Garage</p>
                    <p className="text-gray-500 text-xs">Safe route activates automatically when you reach campus</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-blue-950/40 border border-blue-900/40 rounded-xl px-3 py-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#3b82f6">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-blue-400 text-xs">Following Google Maps walking directions to campus parking</p>
                </div>
              </div>

            : <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Heading to</p>
                    <p className="text-white font-bold text-base">{destLabel}</p>
                    <p className="text-gray-500 text-xs">{formatDistance(distanceRemaining)} remaining on safe route</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-green-950/40 border border-green-900/40 rounded-xl px-3 py-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#22c55e">
                    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
                  </svg>
                  <p className="text-green-400 text-xs">Safest route active — prioritizes lighting and blue light phones</p>
                </div>
              </div>
          }
        </div>
      </div>
    </>
  );
}