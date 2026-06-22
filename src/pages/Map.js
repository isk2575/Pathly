import { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../Firebase';
import LeftPanel from '../components/LeftPanel';
import RightPanel from '../components/RightPanel';
import BottomBar from '../components/BottomBar';
import SOSButton from '../components/SOSButton';
import Navbar from '../components/Navbar';
import NavigationMode from '../components/NavigationMode';
import MobilePanel from '../components/MobilePanel';
import AnimatedRoute from '../components/AnimatedRoute';

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const uhCenter = {
  lat: 29.7199,
  lng: -95.3422,
};

const uhBounds = {
  north: 29.7300,
  south: 29.7100,
  east: -95.3300,
  west: -95.3550,
};

const API_URL = process.env.REACT_APP_API_URL;
const PARKING_GARAGE = { lat: 29.7188, lng: -95.3398 };

// inside the campus bounding box?
const isOnCampus = (loc) =>
{
  if (!loc) return false;
  return (
    loc.lat <= uhBounds.north &&
    loc.lat >= uhBounds.south &&
    loc.lng <= uhBounds.east &&
    loc.lng >= uhBounds.west
  );
};

const darkStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f2f2f" }] },
];

const blueLightPhones = [
  { id: 1, name: "Blue Light - MD Anderson Library", lat: 29.7210, lng: -95.3420 },
  { id: 2, name: "Blue Light - Student Center", lat: 29.7197, lng: -95.3432 },
  { id: 3, name: "Blue Light - Science Building", lat: 29.7220, lng: -95.3415 },
  { id: 4, name: "Blue Light - Cougar Village", lat: 29.7178, lng: -95.3408 },
  { id: 5, name: "Blue Light - Athletics", lat: 29.7235, lng: -95.3445 },
  { id: 6, name: "Blue Light - Parking Garage", lat: 29.7188, lng: -95.3398 },
];

// glowing blue-light marker (blurred halo behind a crisp marker)
const blueLightIcon =
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg width="46" height="46" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <circle cx="23" cy="23" r="13" fill="#3b82f6" opacity="0.9" filter="url(#glow)"/>
      <circle cx="23" cy="23" r="12" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
      <path d="M23 15 L17 20 v6 c0 3.4 2.4 6.6 6 7.4 3.6-.8 6-4 6-7.4 v-6 z" fill="#ffffff"/>
    </svg>
  `);

// glowing user-location dot
const userDotIcon =
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="ug" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <circle cx="17" cy="17" r="9" fill="#3b82f6" opacity="0.9" filter="url(#ug)"/>
      <circle cx="17" cy="17" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
      <circle cx="17" cy="17" r="3" fill="#ffffff"/>
    </svg>
  `);

// warning-sign icon for reported alerts, coloured by severity
const ALERT_COLORS = { danger: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

const alertIcon = (severity) =>
{
  const color = ALERT_COLORS[severity] || ALERT_COLORS.warning;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg width="38" height="38" viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 5 L34 32 L4 32 Z" fill="${color}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="17.3" y="15" width="3.4" height="9" rx="1.7" fill="#ffffff"/>
      <circle cx="19" cy="28" r="1.9" fill="#ffffff"/>
    </svg>
  `);
};

// "x min ago" for the alert detail popup
const timeAgo = (iso) =>
{
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export default function Map()
{
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [locations, setLocations] = useState([]);
  const mapRef = useRef(null);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [alertCount, setAlertCount] = useState(null);
  const [hasDanger, setHasDanger] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // how many reports are waiting for an admin to approve/delete.
  // RightPanel owns the actual queue and reports the number up here,
  // so this count stays correct as the admin works through it.
  const [pendingCount, setPendingCount] = useState(0);
  // bumping this number tells RightPanel to force itself open — that's
  // how the notification reveals the pending section on desktop.
  const [panelOpenSignal, setPanelOpenSignal] = useState(0);

  // detect mobile
  useEffect(() =>
  {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // auth state
  useEffect(() =>
  {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) =>
    {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // ask the backend whether this signed-in account is an admin.
  // we re-run whenever the user changes (login / logout) so the
  // delete controls only ever show up for allowlisted accounts.
  useEffect(() =>
  {
    if (!user)
    {
      setIsAdmin(false);
      return;
    }

    fetch(`${API_URL}/admin/check?firebase_uid=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.is_admin === true))
      .catch(() => setIsAdmin(false));
  }, [user]);

  // soft-delete an ACTIVE alert straight from its map popup.
  // the backend flips is_deleted=true (the row stays for the audit
  // trail), and /incidents already filters those out. but the map
  // was fetched once on load, so we ALSO drop it from local state
  // here — that's what makes the pin vanish instantly instead of
  // waiting for a reload.
  const deleteAlert = (id) =>
  {
    if (!user) return;

    fetch(`${API_URL}/admin/incidents/${id}/delete?firebase_uid=${user.uid}`, { method: 'POST' })
      .then((res) =>
      {
        if (!res.ok) throw new Error('delete failed');
        return res.json();
      })
      .then(() =>
      {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        setSelectedAlert(null);
      })
      .catch((err) => console.error('Could not delete alert:', err));
  };

  // clicking the top-right notification: open the safety panel (the
  // mobile drawer via showRightPanel, the desktop panel via the signal)
  // so the admin lands on the "Pending review" section that sits at its top.
  const openPendingPanel = () =>
  {
    setShowRightPanel(true);
    setPanelOpenSignal((n) => n + 1);
  };

  // load pickable destinations from the backend
  useEffect(() =>
  {
    fetch(`${API_URL}/locations`)
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  // active-alert count for the home Campus Safety card
  useEffect(() =>
  {
    fetch(`${API_URL}/incidents`)
      .then((res) => res.json())
      .then((data) =>
      {
        const list = Array.isArray(data) ? data : [];
        setAlerts(list);
        setAlertCount(list.length);
        setHasDanger(list.some((a) => a.severity === 'danger'));
      })
      .catch((err) => console.error("Failed to load alert count:", err));
  }, []);

  // zoom to fit route
  useEffect(() =>
  {
    if (route && mapRef.current && window.google && !isNavigating)
    {
      const bounds = new window.google.maps.LatLngBounds();
      route.forEach(node =>
      {
        bounds.extend({ lat: node.lat, lng: node.lng });
      });
      mapRef.current.fitBounds(bounds, {
        top: 100,
        bottom: isMobile ? 300 : 100,
        left: isMobile ? 40 : 300,
        right: isMobile ? 40 : 300,
      });

      // show mobile panel after route found
      if (isMobile) setShowMobilePanel(true);
    }
  }, [route]);

  // GPS tracking (throttled so tiny jitters don't re-render constantly)
  useEffect(() =>
  {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) =>
      {
        setUserLocation((prev) =>
        {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!prev) return next;
          const moved = Math.hypot(next.lat - prev.lat, next.lng - prev.lng);
          if (moved < 0.00005) return prev; // ~5 meters; ignore jitter
          return next;
        });
      },
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // fetch a route from the backend and store it
  const requestRoute = async (endLat, endLng, preference = "safest") =>
  {
    // on campus → start from where you are; off campus → start from the garage (where the blue leg drops you)
    const start = isOnCampus(userLocation) ? userLocation : PARKING_GARAGE;

    const params = new URLSearchParams({
      start_lat: start.lat,
      start_lng: start.lng,
      end_lat: endLat,
      end_lng: endLng,
    });

    try
    {
      const res = await fetch(`${API_URL}/route/${preference}?${params}`);
      const data = await res.json();

      if (data.error)
      {
        console.error("Route error:", data.error);
        return null;
      }

      // the backend route ends at the nearest path node — extend it to the exact
      // destination so the green line actually reaches the place you picked
      const path = Array.isArray(data.path) ? data.path : [];
      const fullPath = path.length > 0 ? [...path, { lat: endLat, lng: endLng }] : path;

      setRoute(fullPath);
      return fullPath;
    }
    catch (err)
    {
      console.error("Failed to fetch route:", err);
      return null;
    }
  };

  // build the polyline points once per route change, not on every render
  const routePath = useMemo(
    () => (route ? route.map((node) => ({ lat: node.lat, lng: node.lng })) : []),
    [route]
  );

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });

  if (!isLoaded)
  {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white text-sm">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">

      {/* Map — always full screen */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        options={{
          restriction: isNavigating ? null : {
            latLngBounds: uhBounds,
            strictBounds: false,
          },
          styles: isNavigating ? darkStyles : darkMode ? darkStyles : [],
          disableDefaultUI: isNavigating,
          zoomControl: !isNavigating && !isMobile,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        }}
        onLoad={(map) =>
        {
          mapRef.current = map;
          map.setCenter(uhCenter);
          map.setZoom(16);
        }}
        onClick={() =>
        {
          // tapping empty map closes whatever popup is open (and its
          // photo). taps inside an InfoWindow or on another marker
          // don't reach here, so only a tap on the map itself dismisses.
          setSelectedAlert(null);
          setSelectedPhone(null);
        }}
      >
        {blueLightPhones.map((phone) => (
          <Marker
            key={phone.id}
            position={{ lat: phone.lat, lng: phone.lng }}
            title={phone.name}
            onClick={() => setSelectedPhone(phone)}
            icon={{
              url: blueLightIcon,
              scaledSize: { width: 44, height: 44 },
            }}
          />
        ))}

        {selectedPhone && (
          <InfoWindow
            position={{ lat: selectedPhone.lat, lng: selectedPhone.lng }}
            onCloseClick={() => setSelectedPhone(null)}
          >
            <div style={{ color: '#111', fontWeight: 600, fontSize: '13px' }}>
              {selectedPhone.name}
            </div>
          </InfoWindow>
        )}

        <AnimatedRoute path={routePath} isNavigating={isNavigating} />

        {alerts
          .filter((a) => a.lat != null && a.lng != null)
          .map((alert) => (
            <Marker
              key={`alert-${alert.id}`}
              position={{ lat: alert.lat, lng: alert.lng }}
              onClick={() => setSelectedAlert(alert)}
              icon={{
                url: alertIcon(alert.severity),
                scaledSize: { width: 36, height: 36 },
              }}
              zIndex={300}
            />
          ))}

        {selectedAlert && (
          <InfoWindow
            position={{ lat: selectedAlert.lat, lng: selectedAlert.lng }}
            onCloseClick={() => setSelectedAlert(null)}
          >
            <div style={{ maxWidth: '220px', color: '#111' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '9999px', background: ALERT_COLORS[selectedAlert.severity] || ALERT_COLORS.warning, display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: '13px' }}>{selectedAlert.type}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{selectedAlert.title}</div>
              {selectedAlert.description && (
                <div style={{ fontSize: '12px', color: '#444', marginBottom: '4px' }}>{selectedAlert.description}</div>
              )}
              {selectedAlert.location_text && (
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{selectedAlert.location_text}</div>
              )}
              {selectedAlert.photo_url && (
                <img src={selectedAlert.photo_url} alt="" style={{ width: '100%', borderRadius: '8px', marginBottom: '4px' }} />
              )}
              <div style={{ fontSize: '11px', color: '#888' }}>{timeAgo(selectedAlert.created_at)}</div>
              {isAdmin && (
                <button
                  onClick={() => deleteAlert(selectedAlert.id)}
                  style={{ marginTop: '8px', width: '100%', padding: '6px 0', fontSize: '12px', fontWeight: 600, color: '#fff', background: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Delete alert
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url: userDotIcon,
              scaledSize: { width: 30, height: 30 },
            }}
          />
        )}
      </GoogleMap>

      {/* Admin-only: a notification that appears when reports are waiting
          for review. Tapping it opens the panel to the pending queue.
          Hidden for everyone else, and hidden when the queue is empty. */}
      {isAdmin && pendingCount > 0 && (
        <button
          onClick={openPendingPanel}
          className="absolute top-16 right-4 md:top-4 z-[60] flex items-center gap-2.5 bg-neutral-900/95 backdrop-blur border border-neutral-700 rounded-full pl-3 pr-4 py-2 shadow-lg active:scale-95 transition-transform max-w-[calc(100vw-2rem)]"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-white text-xs font-semibold">New alerts pending review</span>
            <span className="block text-neutral-400 text-[11px]">
              {pendingCount} report{pendingCount === 1 ? '' : 's'} — tap to review
            </span>
          </span>
        </button>
      )}

      {/* DESKTOP — Normal mode UI */}
      {!isNavigating && !isMobile && (
        <>
          <Navbar darkMode={darkMode} setDarkMode={setDarkMode} user={user} />
          <LeftPanel
            darkMode={darkMode}
            userLocation={userLocation}
            locations={locations}
            onRequestRoute={requestRoute}
            onStartNavigation={() => setIsNavigating(true)}
          />
          <RightPanel darkMode={darkMode} userLocation={userLocation} firebaseUid={user?.uid} locations={locations} openSignal={panelOpenSignal} onPendingCountChange={setPendingCount} />
          <BottomBar darkMode={darkMode} />
        </>
      )}

      {/* MOBILE — Normal mode UI */}
      {!isNavigating && isMobile && (
        <>
          {/* Mobile header — clean */}
          <div className="absolute top-0 left-0 right-0 z-10 px-5 pt-3 pb-6 flex items-center justify-between bg-gradient-to-b from-black via-black/60 to-transparent">
            <h1 className="text-white text-2xl font-extrabold tracking-tight">Pathly</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                aria-label="Toggle theme"
                className="w-10 h-10 rounded-full bg-neutral-800 text-white flex items-center justify-center active:bg-neutral-700 transition-colors"
              >
                {darkMode
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                }
              </button>
              <button
                onClick={() => setShowRightPanel(true)}
                aria-label="Open safety panel"
                className="relative w-10 h-10 rounded-full bg-neutral-800 text-white flex items-center justify-center active:bg-neutral-700 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {alertCount > 0 && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile bottom stack — clean */}
          {!showMobilePanel && (
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 space-y-3">

              {/* SOS */}
              <div className="flex justify-center pb-1">
                <SOSButton inline />
              </div>

              {/* Campus Safety summary — opens the safety drawer */}
              <button
                onClick={() => setShowRightPanel(true)}
                className="w-full bg-neutral-800 rounded-3xl p-4 flex items-center justify-between text-left active:bg-neutral-700 transition-colors"
              >
                <div>
                  <p className="text-neutral-400 text-sm font-medium">Campus Safety</p>
                  <p className={`text-2xl font-bold leading-tight ${hasDanger ? 'text-amber-400' : 'text-green-400'}`}>
                    {hasDanger ? 'Caution' : 'Good'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-neutral-400 text-xs">
                      {alertCount === null ? 'Loading…' : `${alertCount} active alert${alertCount === 1 ? '' : 's'}`}
                    </span>
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>

              {/* Find Safe Route — primary white pill */}
              <button
                onClick={() => setShowMobilePanel(true)}
                className="w-full bg-white rounded-full py-4 flex items-center justify-center gap-2.5 active:bg-neutral-200 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                <span className="text-black font-bold text-base">Find Safe Route</span>
              </button>
            </div>
          )}

          {/* Mobile bottom sheet */}
          {showMobilePanel && (
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-neutral-900 rounded-t-3xl border-t border-neutral-800">

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-neutral-700 rounded-full" />
              </div>

              {/* Close button */}
              <div className="flex items-center justify-between px-5 py-2">
                <h2 className="text-white font-bold text-lg">Find Safe Route</h2>
                <button
                  onClick={() => setShowMobilePanel(false)}
                  className="w-9 h-9 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center active:bg-neutral-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Route finder content */}
              <div className="px-5 pb-8 flex flex-col gap-3">

                {/* From */}
                <div className="bg-neutral-800 rounded-2xl p-4">
                  <p className="text-xs text-neutral-400 mb-1">From</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-white text-sm font-medium">My Current Location</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 ml-4">GPS location</p>
                </div>

                {/* Destination + route options */}
                <MobilePanel
                  darkMode={darkMode}
                  userLocation={userLocation}
                  locations={locations}
                  onRequestRoute={requestRoute}
                  onStartNavigation={() => { setShowMobilePanel(false); setIsNavigating(true); }}
                />

              </div>
            </div>
          )}

          {/* Mobile Safety drawer — opens from the hamburger */}
          <RightPanel
            darkMode={darkMode}
            isMobile
            isOpen={showRightPanel}
            onClose={() => setShowRightPanel(false)}
            userLocation={userLocation}
            firebaseUid={user?.uid}
            locations={locations}
            openSignal={panelOpenSignal}
            onPendingCountChange={setPendingCount}
          />
        </>
      )}

      {/* Navigation mode UI */}
      {isNavigating && (
        <NavigationMode
          route={route}
          mapRef={mapRef}
          darkMode={darkMode}
          onExit={() =>
          {
            setIsNavigating(false);
            if (mapRef.current)
            {
              mapRef.current.setZoom(16);
              mapRef.current.panTo(uhCenter);
            }
          }}
        />
      )}

      {/* SOS — desktop main screen only (mobile renders it in the bottom stack; nav renders its own) */}
      {!isMobile && !isNavigating && <SOSButton />}

    </div>
  );
}