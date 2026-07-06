import { useState, useEffect, useRef, useMemo } from 'react';
import MapGL, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
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
import OffCampusRoute from '../components/OffCampusRoute';
import CampusLights from '../components/CampusLights';
import DangerZones from '../components/DangerZones';
import RouteExplain from '../components/RouteExplain';
import AlertDiscussion from '../components/AlertDiscussion';
import ImageLightbox from '../components/ImageLightbox';
import { blueLightPhones } from '../blue_lights';

// MapLibre styles — MapTiler hosted tiles (reliable, free tier, needs a key).
// Both keep building names + footpaths. streets-v2-dark is the proper dark twin
// of streets-v2 (unlike the old CARTO dark-matter, which hid paths and labels).
// Key comes from env (REACT_APP_MAPTILER_KEY).
const MAP_STYLE_LIGHT = `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.REACT_APP_MAPTILER_KEY}`;
const MAP_STYLE_DARK = `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${process.env.REACT_APP_MAPTILER_KEY}`;

const uhCenter = {
  lat: 29.7199,
  lng: -95.3422,
};

const API_URL = process.env.REACT_APP_API_URL;

// ── campus-area check: radius, not a box ────────────────────────────
// Students live all around campus (Bayou Oaks, Cambridge Oaks, the Lofts…)
// and walk in, so anyone within WALKABLE_RADIUS_MILES of campus center gets
// routed from their real location. Beyond that you're officially off-campus:
// the app asks where you'll park and routes from that garage instead.
const CAMPUS_CENTER = { lat: 29.7199, lng: -95.3422 };
const WALKABLE_RADIUS_MILES = 0.9;

// straight-line miles between two points (haversine)
const milesBetween = (a, b) =>
{
  if (!a || !b) return null;
  const R = 3958.8;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// inside the walkable campus area?
const isOnCampus = (loc) =>
{
  if (!loc) return false;
  const d = milesBetween(CAMPUS_CENTER, loc);
  return d != null && d <= WALKABLE_RADIUS_MILES;
};

// blueLightPhones now comes from ../blue_lights (real OSM emergency callboxes)

// glowing blue-light marker (blurred halo behind a crisp marker)
const blueLightIcon =
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="bls" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#0b1220" flood-opacity="0.35"/>
        </filter>
      </defs>
      <circle cx="20" cy="20" r="13" fill="#2563eb" stroke="#ffffff" stroke-width="2.5" filter="url(#bls)"/>
      <g transform="translate(20,20) scale(0.62) translate(-12,-12)">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#ffffff"/>
      </g>
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
  const [showLights, setShowLights] = useState(true); // "Campus Lights" night glow
  const [showZones, setShowZones] = useState(false); // "Danger Zones" heatmap
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  // mobile: when a route is found we close the picker and show a floating card
  // on the map with Start Route + Why this route. This holds that card's data.
  const [mobileRouteCard, setMobileRouteCard] = useState(null); // {start, end, name, preference} | null
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [locations, setLocations] = useState([]);
  const mapRef = useRef(null);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [alertCount, setAlertCount] = useState(null);
  const [hasDanger, setHasDanger] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [discussionAlert, setDiscussionAlert] = useState(null); // alert whose comment thread is open
  const [confirmedIds, setConfirmedIds] = useState(() => new Set()); // alerts this user confirmed this session
  const [lightboxSrc, setLightboxSrc] = useState(null); // full-size image overlay
  const [offCampusCoords, setOffCampusCoords] = useState([]); // ORS blue leg, [lng,lat][]
  const [journeyMarkers, setJourneyMarkers] = useState([]); // A/C/D pins during nav
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

  // a user vouches for an alert ("still happening"). updates the count
  // in place and marks it confirmed so the button locks. for a pending
  // community report, the backend may flip it live at the threshold.
  const confirmAlert = (id) =>
  {
    if (!user) return; // composer/popup already nudges to sign in

    fetch(`${API_URL}/incidents/${id}/confirm?firebase_uid=${user.uid}`, { method: 'POST' })
      .then((res) =>
      {
        if (!res.ok) throw new Error('confirm failed');
        return res.json();
      })
      .then((data) =>
      {
        setConfirmedIds((prev) =>
        {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, confirmation_count: data.confirmation_count } : a)));
        setSelectedAlert((prev) => (prev && prev.id === id ? { ...prev, confirmation_count: data.confirmation_count } : prev));
      })
      .catch((err) => console.error('Could not confirm alert:', err));
  };

  // snap the camera back to campus (used by the recenter button). same
  // framing as the opening shot, available anytime now that the map roams free.
  const recenterOnUH = () =>
  {
    if (mapRef.current)
    {
      // MapLibre takes [lng, lat], not {lat, lng}
      mapRef.current.flyTo({ center: [uhCenter.lng, uhCenter.lat], zoom: 16 });
    }
  };

  // load pickable destinations from the backend
  useEffect(() =>
  {
    fetch(`${API_URL}/locations`)
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  // active-alert count for the home Campus Safety card.
  // POLLS every 8s so the map stays live — new alerts appear, expired ones
  // (24h) drop off, and confirmation counts refresh without a page reload.
  // We refresh the open popup's data too so its count stays in sync.
  useEffect(() =>
  {
    let cancelled = false;

    const loadAlerts = () =>
    {
      fetch(`${API_URL}/incidents`)
        .then((res) => res.json())
        .then((data) =>
        {
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setAlerts(list);
          setAlertCount(list.length);
          setHasDanger(list.some((a) => a.severity === 'danger'));
          // keep the open alert popup fresh (e.g. confirmation count) if it's
          // still live; if it expired or was removed, close the popup.
          setSelectedAlert((prev) =>
          {
            if (!prev) return prev;
            const updated = list.find((a) => a.id === prev.id);
            return updated || null;
          });
        })
        .catch((err) => { if (!cancelled) console.error("Failed to load alerts:", err); });
    };

    loadAlerts();                          // immediate
    const id = setInterval(loadAlerts, 8000); // then every 8s
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // zoom to fit route
  useEffect(() =>
  {
    if (route && mapRef.current && route.length > 0 && !isNavigating)
    {
      // compute [[minLng,minLat],[maxLng,maxLat]] from the path
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      route.forEach((node) =>
      {
        if (node.lng < minLng) minLng = node.lng;
        if (node.lat < minLat) minLat = node.lat;
        if (node.lng > maxLng) maxLng = node.lng;
        if (node.lat > maxLat) maxLat = node.lat;
      });

      mapRef.current.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        {
          padding: isMobile
            ? { top: 100, bottom: 300, left: 40, right: 40 }
            : { top: 100, bottom: 100, left: 300, right: 300 },
        }
      );

      // (mobile no longer re-opens the picker here — when a route is found the
      // picker closes and a floating route card shows on the map instead)
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

  // fetch a route from the backend and store it.
  // startOverride: when the user is off-campus (beyond the walkable radius),
  // the panels ask them to pick a parking spot and pass its coords here — the
  // green route starts from that garage, and the blue ORS leg automatically
  // targets it (NavigationMode aims the blue leg at route[0]).
  const requestRoute = async (endLat, endLng, preference = "safest", startOverride = null) =>
  {
    // campus area → start from where you are; off campus → start from the
    // garage the user picked (startOverride)
    const start = startOverride || (isOnCampus(userLocation) ? userLocation : null);
    if (!start)
    {
      console.error("No start point: off-campus without a chosen parking spot.");
      return null;
    }

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

  return (
    <div className={`relative w-full h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}>

      {/* Map — always full screen (MapLibre + free OSM style) */}
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: uhCenter.lng, latitude: uhCenter.lat, zoom: 16 }}
        style={{ width: '100%', height: '100vh' }}
        mapStyle={darkMode ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        attributionControl={false}
        onClick={() =>
        {
          // tapping empty map closes whatever popup is open. taps on a
          // marker stop propagation, so only a bare map tap dismisses.
          setSelectedAlert(null);
          setSelectedPhone(null);
        }}
      >
        {!isNavigating && !isMobile && <NavigationControl position="bottom-right" />}

        {blueLightPhones.map((phone, i) => (
          <Marker
            key={`bl-${i}`}
            longitude={phone.lng}
            latitude={phone.lat}
            onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedPhone(phone); }}
          >
            <img src={blueLightIcon} width={36} height={36} alt="" style={{ cursor: 'pointer', display: 'block' }} />
          </Marker>
        ))}

        {selectedPhone && (
          <Popup
            longitude={selectedPhone.lng}
            latitude={selectedPhone.lat}
            anchor="bottom"
            offset={22}
            closeOnClick={false}
            onClose={() => setSelectedPhone(null)}
          >
            <div style={{ color: '#111', fontWeight: 600, fontSize: '13px' }}>
              Emergency Callbox
            </div>
          </Popup>
        )}

        {/* danger-zone heatmap — your reports + UHPD historical, toggleable */}
        <DangerZones show={showZones} />

        {/* night-map 'Lit Pathways' glow — dark mode only, toggleable */}
        <CampusLights show={darkMode && showLights} />

        <AnimatedRoute path={routePath} isNavigating={isNavigating} />

        {/* Start + end markers so it's clear where the route goes from/to.
            Shown when a route exists and we're not yet navigating (during nav,
            the live position + journey pins take over). route[0] is the start
            (your location or chosen parking spot), the last point is the
            destination. */}
        {routePath.length > 1 && !isNavigating && (
          <>
            <Marker longitude={routePath[0].lng} latitude={routePath[0].lat} anchor="center">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: '#111', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', marginBottom: '3px', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  Start
                </div>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', border: '3px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
              </div>
            </Marker>

            <Marker longitude={routePath[routePath.length - 1].lng} latitude={routePath[routePath.length - 1].lat} anchor="bottom">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ background: '#16a34a', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', marginBottom: '3px', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  Destination
                </div>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#16a34a" stroke="#fff" strokeWidth="1.5">
                  <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none" />
                </svg>
              </div>
            </Marker>
          </>
        )}

        {/* off-campus walking leg (blue) + journey pins, during navigation */}
        <OffCampusRoute coordinates={offCampusCoords} />
        {journeyMarkers.map((m) => (
          <Marker key={m.letter} longitude={m.lng} latitude={m.lat}>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: m.color, border: '2px solid #fff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {m.letter}
            </div>
          </Marker>
        ))}

        {alerts
          .filter((a) => a.lat != null && a.lng != null)
          .map((alert) => (
            <Marker
              key={`alert-${alert.id}`}
              longitude={alert.lng}
              latitude={alert.lat}
              onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedAlert(alert); }}
            >
              <img src={alertIcon(alert.severity)} width={36} height={36} alt="" style={{ cursor: 'pointer', display: 'block' }} />
            </Marker>
          ))}

        {selectedAlert && (
          <Popup
            longitude={selectedAlert.lng}
            latitude={selectedAlert.lat}
            anchor="bottom"
            offset={20}
            maxWidth="260px"
            closeOnClick={false}
            onClose={() => setSelectedAlert(null)}
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
                <img src={selectedAlert.photo_url} alt="" onClick={() => setLightboxSrc(selectedAlert.photo_url)} style={{ width: '100%', height: '120px', objectFit: 'cover', background: '#f3f4f6', borderRadius: '8px', marginBottom: '4px', cursor: 'pointer' }} />
              )}
              <div style={{ fontSize: '11px', color: '#888' }}>{timeAgo(selectedAlert.created_at)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => confirmAlert(selectedAlert.id)}
                  disabled={!user || confirmedIds.has(selectedAlert.id)}
                  style={{ flex: 1, padding: '6px 0', fontSize: '12px', fontWeight: 600, color: confirmedIds.has(selectedAlert.id) ? '#16a34a' : '#111', background: confirmedIds.has(selectedAlert.id) ? '#dcfce7' : '#f3f4f6', border: '1px solid ' + (confirmedIds.has(selectedAlert.id) ? '#bbf7d0' : '#e5e7eb'), borderRadius: '8px', cursor: (!user || confirmedIds.has(selectedAlert.id)) ? 'default' : 'pointer', opacity: !user ? 0.5 : 1 }}
                >
                  {confirmedIds.has(selectedAlert.id) ? '✓ Confirmed' : 'Confirm · still happening'}
                </button>
                {selectedAlert.confirmation_count > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#444', whiteSpace: 'nowrap' }}>
                    {selectedAlert.confirmation_count} confirmed
                  </span>
                )}
              </div>
              <button
                onClick={() => setDiscussionAlert(selectedAlert)}
                style={{ marginTop: '8px', width: '100%', padding: '6px 0', fontSize: '12px', fontWeight: 600, color: '#111', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Discussion
              </button>
              {isAdmin && (
                <button
                  onClick={() => deleteAlert(selectedAlert.id)}
                  style={{ marginTop: '8px', width: '100%', padding: '6px 0', fontSize: '12px', fontWeight: 600, color: '#fff', background: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Delete alert
                </button>
              )}
            </div>
          </Popup>
        )}

        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
            <img src={userDotIcon} width={30} height={30} alt="" style={{ display: 'block' }} />
          </Marker>
        )}
      </MapGL>

      {/* Danger Zones toggle — shows the incident heatmap (your reports +
          UHPD historical). Red = more/worse/recent incidents, green = calm. */}
      {!isNavigating && !showMobilePanel && !showRightPanel && (
        <button
          onClick={() => setShowZones((v) => !v)}
          aria-label={showZones ? 'Hide danger zones' : 'Show danger zones'}
          aria-pressed={showZones}
          className={`absolute right-4 top-1/2 -translate-y-1/2 -mt-28 z-[55] w-11 h-11 rounded-full backdrop-blur border flex items-center justify-center shadow-lg transition-colors ${
            showZones
              ? 'bg-red-500/90 border-red-400 text-white'
              : 'bg-neutral-900/90 border-neutral-700 text-neutral-400 active:bg-neutral-800'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      )}

      {/* Campus Lights toggle — only meaningful at night, so dark mode only.
          Sits just above the recenter button; warm/lit when on, muted when off. */}
      {darkMode && !isNavigating && !showMobilePanel && !showRightPanel && (
        <button
          onClick={() => setShowLights((v) => !v)}
          aria-label={showLights ? 'Hide campus lights' : 'Show campus lights'}
          aria-pressed={showLights}
          className={`absolute right-4 top-1/2 -translate-y-1/2 -mt-14 z-[55] w-11 h-11 rounded-full backdrop-blur border flex items-center justify-center shadow-lg transition-colors ${
            showLights
              ? 'bg-amber-400/90 border-amber-300 text-neutral-900'
              : 'bg-neutral-900/90 border-neutral-700 text-neutral-400 active:bg-neutral-800'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
          </svg>
        </button>
      )}

      {/* Recenter on campus — the map roams free now, this brings it home.
          Hidden in navigation mode (which drives the camera itself) and
          whenever a panel is open over the map, so it never floats on top. */}
      {!isNavigating && !showMobilePanel && !showRightPanel && (
        <button
          onClick={recenterOnUH}
          aria-label="Recenter on campus"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-[55] w-11 h-11 rounded-full bg-neutral-900/90 backdrop-blur border border-neutral-700 text-white flex items-center justify-center shadow-lg active:bg-neutral-800"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      )}
      {discussionAlert && (
        <AlertDiscussion
          alert={discussionAlert}
          firebaseUid={user?.uid}
          authorName={user?.displayName || ''}
          isAdmin={isAdmin}
          onClose={() => setDiscussionAlert(null)}
        />
      )}

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

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
            isOffCampus={!!userLocation && !isOnCampus(userLocation)}
            onRequestRoute={requestRoute}
            onStartNavigation={() => setIsNavigating(true)}
          />
          <RightPanel darkMode={darkMode} userLocation={userLocation} firebaseUid={user?.uid} locations={locations} openSignal={panelOpenSignal} onPendingCountChange={setPendingCount} onOpenDiscussion={setDiscussionAlert} onImageClick={setLightboxSrc} onFocusLocation={(lat, lng) => { if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 17 }); }} />
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
                  onClick={() => { setShowMobilePanel(false); setRoute(null); }}
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
                  isOffCampus={!!userLocation && !isOnCampus(userLocation)}
                  onRequestRoute={requestRoute}
                  onRouteReady={(info) =>
                  {
                    setShowMobilePanel(false);   // close the picker
                    setMobileRouteCard(info);    // show the floating route card
                  }}
                />

              </div>
            </div>
          )}

              {/* Floating route card — shows on the map once a route is found, so
              the map (with the drawn route) is visible. Holds Start Route +
              Why this route. Replaces the old in-panel buttons. */}
          {mobileRouteCard && !showMobilePanel && (
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-neutral-900 rounded-t-3xl border-t border-neutral-800 px-5 pt-4 pb-8 flex flex-col gap-3">

              {/* destination + dismiss */}
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500">Route to</p>
                  <p className="text-white font-bold text-lg truncate">
                    {mobileRouteCard.name || 'your destination'}
                  </p>
                </div>
                <button
                  onClick={() =>
                  {
                    setMobileRouteCard(null);
                    setRoute(null);
                    setShowMobilePanel(true); // back to the picker
                  }}
                  aria-label="Cancel route"
                  className="w-9 h-9 shrink-0 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center active:bg-neutral-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Why this route? — safest only */}
              {mobileRouteCard.preference === 'safest' && (
                <RouteExplain
                  start={mobileRouteCard.start}
                  end={mobileRouteCard.end}
                  destinationName={mobileRouteCard.name}
                  darkMode={darkMode}
                />
              )}

              {/* Start Route */}
              <button
                onClick={() => { setMobileRouteCard(null); setIsNavigating(true); }}
                className="w-full bg-green-500 text-black font-bold py-4 rounded-full text-base active:bg-green-400 flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start Route
              </button>
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
            onOpenDiscussion={setDiscussionAlert}
            onImageClick={setLightboxSrc}
            onFocusLocation={(lat, lng) =>
            {
              setShowRightPanel(false); // close the drawer so the map is visible
              if (mapRef.current) mapRef.current.flyTo({ center: [lng, lat], zoom: 17 });
            }}
          />
        </>
      )}

      {/* Navigation mode UI */}
      {isNavigating && (
        <NavigationMode
          route={route}
          mapRef={mapRef}
          darkMode={darkMode}
          onOffCampusRoute={setOffCampusCoords}
          onJourneyMarkers={setJourneyMarkers}
          onExit={() =>
          {
            setIsNavigating(false);
            setRoute(null);           // clear the green route line so it doesn't linger
            setOffCampusCoords([]);
            setJourneyMarkers([]);
            if (mapRef.current)
            {
              mapRef.current.flyTo({ center: [uhCenter.lng, uhCenter.lat], zoom: 16 });
            }
          }}
        />
      )}

      {/* SOS — desktop main screen only (mobile renders it in the bottom stack; nav renders its own) */}
      {!isMobile && !isNavigating && <SOSButton />}

    </div>
  );
}