import { Source, Layer } from 'react-map-gl/maplibre';
import { litPaths } from '../lit_paths';

// "Lit Pathways" night-map glow. Draws a warm, layered glow along the campus
// walkable network (the graph edges). Three stacked line layers give the
// glowing-light look: a wide soft halo, a mid warm band, then a bright core.
//
// Honest framing: these trace the WALKABLE PATHS (where you'd walk at night),
// shown as lit corridors — not individual physical lamps. When real UH
// Facilities lamp data arrives, swap the source; the visual layer stays.
//
// Rendered only in dark mode, and only when the "Campus Lights" toggle is on.
export default function CampusLights({ show })
{
  if (!show || !litPaths || litPaths.length === 0) return null;

  const data = {
    type: 'FeatureCollection',
    features: litPaths.map((seg) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: seg },
    })),
  };

  return (
    <Source id="campus-lights" type="geojson" data={data}>
      {/* outer halo — wide, very soft, warm */}
      <Layer
        id="lights-halo"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#fde68a',
          'line-width': 9,
          'line-blur': 8,
          'line-opacity': 0.18,
        }}
      />
      {/* mid warm band */}
      <Layer
        id="lights-mid"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#fcd34d',
          'line-width': 3.5,
          'line-blur': 3,
          'line-opacity': 0.35,
        }}
      />
      {/* bright core — thin, near-white warm center */}
      <Layer
        id="lights-core"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#fff7e0',
          'line-width': 1.2,
          'line-opacity': 0.7,
        }}
      />
    </Source>
  );
}