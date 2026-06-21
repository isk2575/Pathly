import { Polyline } from '@react-google-maps/api';

// A clean dashed safe-route line (no glow) — styled like the UH campus map.
export default function AnimatedRoute({ path, isNavigating })
{
  if (!path || path.length === 0) return null;

  // a single dash; repeated along the line to form the dashed pattern
  const dash = {
    path: 'M 0,-1 0,1',
    strokeColor: '#22c55e',
    strokeOpacity: 1,
    strokeWeight: isNavigating ? 5 : 4,
    scale: isNavigating ? 4 : 3,
  };

  return (
    <Polyline
      path={path}
      options={{
        strokeOpacity: 0,        // hide the solid base line
        clickable: false,
        zIndex: 2,
        icons: [
          {
            icon: dash,
            offset: '0',
            repeat: '18px',      // distance between dashes
          },
        ],
      }}
    />
  );
}