import { useState, useEffect } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';

const API_URL = process.env.REACT_APP_API_URL;

// Danger-zone heatmap. Pulls incident points from /zones (your reports +
// UHPD historical) and renders a MapLibre heatmap: areas with more/worse/
// recent incidents glow red -> yellow, quieter areas stay green/transparent.
//
// MapLibre's heatmap layer does the spatial blending for us from the points;
// we just map the per-point `weight` to intensity and pick the color ramp.
//
// Shown only when `show` is true (the "Danger Zones" toggle).
export default function DangerZones({ show })
{
  const [points, setPoints] = useState([]);

  // load zone points when first shown; refresh every 30s while visible
  useEffect(() =>
  {
    if (!show) return;
    let cancelled = false;

    const load = () =>
    {
      fetch(`${API_URL}/zones`)
        .then((res) => res.json())
        .then((data) =>
        {
          if (cancelled) return;
          setPoints(Array.isArray(data.points) ? data.points : []);
        })
        .catch((err) => { if (!cancelled) console.error('Failed to load zones:', err); });
    };

    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [show]);

  if (!show || points.length === 0) return null;

  const data = {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { weight: p.weight || 0.5 },
    })),
  };

  return (
    <Source id="danger-zones" type="geojson" data={data}>
      <Layer
        id="danger-heat"
        type="heatmap"
        paint={{
          // each point's contribution, driven by its weight (severity x recency)
          'heatmap-weight': ['get', 'weight'],
          // overall intensity grows a bit as you zoom in
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 18, 1.6],
          // green (low) -> yellow -> orange -> red (high)
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.2,  'rgba(34,197,94,0.35)',   // green
            0.45, 'rgba(234,179,8,0.55)',   // yellow
            0.7,  'rgba(249,115,22,0.7)',   // orange
            1,    'rgba(239,68,68,0.85)',   // red
          ],
          // radius grows with zoom so blobs stay sensible at any scale
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 13, 18, 16, 35, 18, 60],
          'heatmap-opacity': 0.75,
        }}
      />
    </Source>
  );
}