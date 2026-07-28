import { Source, Layer } from 'react-map-gl/maplibre';

// The safe-route line, drawn as a MapLibre GeoJSON line layer.
// Thin dashed green to match the UH campus-map look — no wide casing ribbon,
// so the basemap shows through the dashes exactly like the reference. butt
// caps keep the dashes crisp (round caps blob together at thin widths).
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
        layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
        paint={{
          'line-color': '#22c55e',
          'line-width': isNavigating ? 4 : 3,
          'line-dasharray': [2, 1.75],
        }}
      />
    </Source>
  );
}