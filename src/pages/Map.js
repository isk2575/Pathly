import { useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import SOSButton from '../components/SOSButton';
import Navbar from '../components/Navbar';

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

export default function Map() {
  const [darkMode, setDarkMode] = useState(true);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white text-sm">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={uhCenter}
        zoom={16}
        options={{
          restriction: {
            latLngBounds: uhBounds,
            strictBounds: false,
          },
          styles: darkMode ? darkStyles : [],
        }}
      />
      <SOSButton />
    </div>
  );
}