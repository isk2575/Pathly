import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../Firebase';
import LeftPanel from '../components/LeftPanel';
import RightPanel from '../components/RightPanel';
import BottomBar from '../components/BottomBar';
import SOSButton from '../components/SOSButton';
import Navbar from '../components/Navbar';
import NavigationMode from '../components/NavigationMode';

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
  const polylineRef = useRef(null);
  const mapRef = useRef(null);

  // auth state
  useEffect(() =>
  {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) =>
    {
      setUser(currentUser);
    });
    return () => unsubscribe();
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
        bottom: 100,
        left: 300,
        right: 300,
      });
    }
  }, [route]);

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
        center={uhCenter}
        zoom={16}
        options={{
          restriction: isNavigating ? null : {
            latLngBounds: uhBounds,
            strictBounds: false,
          },
          styles: darkMode ? darkStyles : [],
          disableDefaultUI: isNavigating,
          zoomControl: !isNavigating,
        }}
        onLoad={(map) => { mapRef.current = map; }}
      >
        {blueLightPhones.map((phone) => (
          <Marker
            key={phone.id}
            position={{ lat: phone.lat, lng: phone.lng }}
            title={phone.name}
            icon={{
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="14" fill="#2563eb" stroke="white" strokeWidth="2"/>
                  <path d="M16 8L10 13v6c0 3.5 2.5 6.8 6 7.6 3.5-.8 6-4.1 6-7.6v-6l-6-5z" fill="white"/>
                </svg>
              `),
              scaledSize: { width: 32, height: 32 },
            }}
          />
        ))}

        <Polyline
          path={route ? route.map(node => ({ lat: node.lat, lng: node.lng })) : []}
          options={{
            strokeColor: '#22c55e',
            strokeOpacity: 1,
            strokeWeight: isNavigating ? 8 : 5,
            visible: !!route,
          }}
          onLoad={(polyline) => { polylineRef.current = polyline; }}
        />

      </GoogleMap>

      {/* Normal mode UI */}
      {!isNavigating && (
        <>
          <Navbar darkMode={darkMode} setDarkMode={setDarkMode} user={user} />
          <LeftPanel
            darkMode={darkMode}
            onRouteFound={setRoute}
            onStartNavigation={() => setIsNavigating(true)}
          />
          <RightPanel darkMode={darkMode} />
          <BottomBar darkMode={darkMode} />
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

      {/* SOS always visible */}
      <SOSButton />

    </div>
  );
}