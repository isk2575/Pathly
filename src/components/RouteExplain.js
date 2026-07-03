import { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

// "Why this route?" — a tap-to-reveal explanation of why the safest route is
// safer. Calls the backend (which asks Claude to narrate the real route facts:
// incidents avoided, blue lights passed). The LLM never re-routes; it only
// explains data the routing engine already produced.
//
// Only meaningful for the 'safest' preference. Fetches lazily on tap, so we
// don't spend an API call on every route — only when the user asks.
//
// Props: start {lat,lng}, end {lat,lng}, destinationName, darkMode
export default function RouteExplain({ start, end, destinationName, darkMode })
{
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(false);

  const explain = async () =>
  {
    // toggle closed if already open
    if (open)
    {
      setOpen(false);
      return;
    }

    setOpen(true);

    // already have it — don't refetch
    if (text) return;

    if (!start || !end)
    {
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);

    try
    {
      const res = await fetch(`${API_URL}/route/explain`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_lat: start.lat,
          start_lng: start.lng,
          end_lat: end.lat,
          end_lng: end.lng,
          destination_name: destinationName || null,
        }),
      });

      if (!res.ok) throw new Error(`explain failed: ${res.status}`);
      const data = await res.json();
      setText(data.explanation || 'No explanation available.');
    }
    catch (err)
    {
      console.error('Route explain failed:', err);
      setError(true);
    }
    finally
    {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={explain}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800 py-2.5 text-xs font-bold text-neutral-700 dark:text-neutral-200 active:bg-neutral-200 dark:active:bg-neutral-700"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {open ? 'Hide explanation' : 'Why this route?'}
      </button>

      {open && (
        <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3">
          {loading && (
            <p className="text-xs text-neutral-500">Analyzing the route…</p>
          )}
          {!loading && error && (
            <p className="text-xs text-neutral-500">
              Couldn't load an explanation right now.
            </p>
          )}
          {!loading && !error && text && (
            <>
              <p className="text-sm text-neutral-800 dark:text-neutral-100 leading-relaxed">
                {text}
              </p>
              <p className="mt-2 text-[10px] text-neutral-400">
                Based on reported incidents and blue-light phones along the route.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}