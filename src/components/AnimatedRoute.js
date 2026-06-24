import { Source, Layer } from 'react-map-gl/maplibre';

// The safe-route line, drawn as a MapLibre GeoJSON line layer.
// Dashed green to match the UH campus look; thicker while navigating.
export default function AnimatedRoute({ path, isNavigating })
{
  if (!path || path.length < 2) return null;

  // backend gives {lat,lng}; GeoJSON wants [lng,lat]
  const data = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: path.map((p) => [p.lng, p.lat]),
    },
  };

  return (
    <Source id="safe-route" type="geojson" data={data}>
      <Layer
        id="safe-route-line"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#22c55e',
          'line-width': isNavigating ? 6 : 4,
          'line-dasharray': [2, 1.5],
        }}
      />
    </Source>
  );
}