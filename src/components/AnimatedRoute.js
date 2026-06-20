import { Polyline } from '@react-google-maps/api';

// A clean, solid safe-route line (no glow, no particles) — styled like the UH campus map.
export default function AnimatedRoute({ path, isNavigating })
{
  if (!path || path.length === 0) return null;

  return (
    <Polyline
      path={path}
      options={{
        strokeColor: '#22c55e',
        strokeOpacity: 1,
        strokeWeight: isNavigating ? 5 : 4,
        clickable: false,
        zIndex: 2,
      }}
    />
  );
}