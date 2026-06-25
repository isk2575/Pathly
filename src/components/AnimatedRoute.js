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
      {/* casing — a darker, wider line underneath so the route stays crisp on
          both light and dark basemaps (the "snapped to path" ribbon look) */}
      <Layer
        id="safe-route-casing"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#065f46',
          'line-width': isNavigating ? 10 : 7,
          'line-opacity': 0.55,
        }}
      />
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