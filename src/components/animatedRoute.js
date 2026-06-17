import { useEffect, useRef } from 'react';
import { Polyline } from '@react-google-maps/api';

// A glowing safe-route line with light particles flowing toward the destination.
export default function AnimatedRoute({ path, isNavigating })
{
  const flowRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() =>
  {
    const line = flowRef.current;
    if (!line || !window.google || !path || path.length === 0) return;

    // the moving "light particle" that streams along the route
    const particle = {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 2.4,
      fillColor: '#ffffff',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeOpacity: 0.9,
      strokeWeight: 0,
    };

    line.setOptions({ icons: [{ icon: particle, offset: '0%', repeat: '26px' }] });

    let offset = 0;
    let last = 0;

    const tick = (t) =>
    {
      if (t - last > 40)
      {
        offset = (offset + 1) % 100;
        const icons = line.get('icons');
        if (icons && icons[0])
        {
          icons[0].offset = offset + '%';
          line.set('icons', icons);
        }
        last = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () =>
    {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [path]);

  if (!path || path.length === 0) return null;

  return (
    <>
      {/* glow halo */}
      <Polyline
        path={path}
        options={{
          strokeColor: '#22c55e',
          strokeOpacity: 0.22,
          strokeWeight: isNavigating ? 20 : 14,
          clickable: false,
          zIndex: 1,
        }}
      />
      {/* core line */}
      <Polyline
        path={path}
        options={{
          strokeColor: '#22c55e',
          strokeOpacity: 1,
          strokeWeight: isNavigating ? 7 : 5,
          clickable: false,
          zIndex: 2,
        }}
      />
      {/* invisible line carrying the flowing light particles */}
      <Polyline
        path={path}
        onLoad={(p) => { flowRef.current = p; }}
        options={{
          strokeOpacity: 0,
          clickable: false,
          zIndex: 3,
        }}
      />
    </>
  );
  //changed
}