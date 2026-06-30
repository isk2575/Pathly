import { useState, useRef, useEffect, useMemo } from 'react';

// A searchable destination picker. Replaces a plain <select> (which can't hold
// a search box) with a button that opens a filterable list. Type to narrow by
// name; optional category pills group the long list. Theme-aware (Citizen).
//
// Props:
//   locations     [{id, name, category, lat, lng}]
//   value         selected id (string) or ''
//   onChange      (id) => void
//   placeholder   button text when nothing is picked
export default function DestinationPicker({ locations = [], value, onChange, placeholder = 'Select destination…' })
{
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // the currently selected location (to show its name on the button)
  const selected = useMemo(
    () => locations.find((l) => String(l.id) === String(value)),
    [locations, value]
  );

  // distinct categories present, for the filter pills
  const categories = useMemo(() =>
  {
    const set = new Set(locations.map((l) => l.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [locations]);

  // filtered + sorted list: category first, then text match on name
  const filtered = useMemo(() =>
  {
    const q = query.trim().toLowerCase();
    return locations
      .filter((l) => (cat === 'all' ? true : l.category === cat))
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, query, cat]);

  // close on outside click
  useEffect(() =>
  {
    const onDoc = (e) =>
    {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // focus the search box when the list opens
  useEffect(() =>
  {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const pick = (loc) =>
  {
    onChange(String(loc.id));
    setOpen(false);
    setQuery('');
    setCat('all');
  };

  return (
    <div ref={wrapRef} className="relative">

      {/* the button that opens the picker */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className={`text-base font-medium truncate ${selected ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-neutral-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* the dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">

          {/* search box */}
          <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500 shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search destinations…"
                style={{ fontSize: '16px' }}
                className="flex-1 bg-transparent outline-none text-neutral-900 dark:text-white placeholder-neutral-500"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-neutral-500 shrink-0" aria-label="Clear">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* category pills (only if there's more than one category) */}
            {categories.length > 2 && (
              <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCat(c)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors ${
                      cat === c
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* results */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-neutral-500">No matches.</p>
            ) : (
              filtered.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => pick(loc)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 active:bg-neutral-100 dark:active:bg-neutral-800 ${
                    String(loc.id) === String(value) ? 'bg-neutral-100 dark:bg-neutral-800' : ''
                  }`}
                >
                  <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">{loc.name}</span>
                  {loc.category && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-neutral-400">{loc.category}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}