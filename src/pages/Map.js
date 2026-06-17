import { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
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

export default function Map()
{
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [locations, setLocations] = useState([]);
  const polylineRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedPhone, setSelectedPhone] = useState(null);

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

  // load pickable destinations from the backend
  useEffect(() =>
  {
    fetch(`${API_URL}/locations`)
      .then((res) => res.json())
      .then((data) => setLocations(data))
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  // hide/show polyline
  useEffect(() =>
  {
    if (polylineRef.current)
    {
      polylineRef.current.setVisible(route !== null);
    }
  }, [route]);

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
        }}
        onLoad={(map) =>
        {
          mapRef.current = map;
          map.setCenter(uhCenter);
          map.setZoom(16);
        }}
      >
        {blueLightPhones.map((phone) => (
          <Marker
            key={phone.id}
            position={{ lat: phone.lat, lng: phone.lng }}
            title={phone.name}
            onClick={() => setSelectedPhone(phone)}
            icon={{
                url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                  <svg width="46" height="46" viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
                    <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
                    <circle cx="23" cy="23" r="13" fill="#3b82f6" opacity="0.9" filter="url(#glow)"/>
                    <circle cx="23" cy="23" r="12" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
                    <path d="M23 15 L17 20 v6 c0 3.4 2.4 6.6 6 7.4 3.6-.8 6-4 6-7.4 v-6 z" fill="#ffffff"/>
                  </svg>
                `),
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

        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
                url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                  <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
                    <defs><filter id="ug" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
                    <circle cx="17" cy="17" r="9" fill="#3b82f6" opacity="0.9" filter="url(#ug)"/>
                    <circle cx="17" cy="17" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
                    <circle cx="17" cy="17" r="3" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: { width: 30, height: 30 },
              }}
          />
        )}
      </GoogleMap>

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
          <RightPanel darkMode={darkMode} />
          <BottomBar darkMode={darkMode} />
        </>
      )}

      {/* MOBILE — Normal mode UI */}
      {!isNavigating && isMobile && (
        <>
          {/* Mobile Navbar — simplified */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gray-950/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-gray-800/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Pathly</p>
                <p className="text-gray-400 text-xs">Stay Safe. Stay Connected.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-800 text-gray-300"
              >
                {darkMode
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                }
              </button>
            </div>
          </div>

          {/* Mobile bottom sheet trigger */}
          {!showMobilePanel && (
            <button
              onClick={() => setShowMobilePanel(true)}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-2xl shadow-2xl shadow-blue-900/40 flex items-center gap-2 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Find Safe Route
            </button>
          )}

          {/* Mobile bottom sheet */}
          {showMobilePanel && (
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gray-950/95 backdrop-blur-xl rounded-t-3xl border-t border-gray-800/50 shadow-2xl">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-600 rounded-full" />
              </div>

              {/* Close button */}
              <div className="flex items-center justify-between px-5 py-2">
                <h2 className="text-white font-bold text-base">Find Safe Route</h2>
                <button
                  onClick={() => setShowMobilePanel(false)}
                  className="text-gray-400 p-1"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Route finder content */}
              <div className="px-5 pb-8 flex flex-col gap-4">

                {/* From */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">From</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-white text-sm font-medium">My Current Location</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 ml-4">GPS location</p>
                </div>

                {/* To */}
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-2">To</p>
                  <MobilePanel
                    darkMode={darkMode}
                    userLocation={userLocation}
                    locations={locations}
                    onRequestRoute={requestRoute}
                    onStartNavigation={() => { setShowMobilePanel(false); setIsNavigating(true); }}
                  />
                </div>

              </div>
            </div>
          )}
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

      {/* SOS — moves up when mobile panel is open */}
        <div className={`transition-all duration-300 ${
          showMobilePanel && isMobile ? 'hidden' : ''
        }`}>
          <SOSButton />
        </div>

    </div>
  );
}