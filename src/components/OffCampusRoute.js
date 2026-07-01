import { Source, Layer } from 'react-map-gl/maplibre';

// The off-campus walking leg (user -> campus edge), from OpenRouteService.
// Drawn as a solid blue MapLibre line — the counterpart to the green safe
// route. Coordinates arrive already as [lng, lat] (ORS / GeoJSON order).
export default function OffCampusRoute({ coordinates })
{
  if (!coordinates || coordinates.length < 2) return null;

  const data = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
  };

  return (
    <Source id="off-campus-route" type="geojson" data={data}>
      {/* casing for crispness on light + dark basemaps */}
      <Layer
        id="off-campus-casing"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#1e3a8a', 'line-width': 9, 'line-opacity': 0.55 }}
      />
      <Layer
        id="off-campus-line"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.95 }}
      />
    </Source>
  );
}