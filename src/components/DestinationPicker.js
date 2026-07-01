import { useState, useRef, useEffect, useMemo } from 'react';

// A searchable destination picker. Replaces a plain <select> (which can't hold
// a search box). Type to filter by name; category pills group the long list.
//
// On MOBILE it opens as a full-height bottom-sheet overlay (so the results have
// room to scroll — an inline dropdown gets trapped inside a short panel).
// On DESKTOP it opens as an inline dropdown beneath the field.
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
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() =>
  {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selected = useMemo(
    () => locations.find((l) => String(l.id) === String(value)),
    [locations, value]
  );

  const categories = useMemo(() =>
  {
    const set = new Set(locations.map((l) => l.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [locations]);

  const filtered = useMemo(() =>
  {
    const q = query.trim().toLowerCase();
    return locations
      .filter((l) => (cat === 'all' ? true : l.category === cat))
      .filter((l) => (q ? l.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, query, cat]);

  // desktop: close on outside click (mobile uses an explicit backdrop)
  useEffect(() =>
  {
    if (isMobile) return;
    const onDoc = (e) =>
    {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isMobile]);

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

  // the search + pills + results — shared by both layouts
  const listBody = (
    <>
      {/* search box */}
      <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2.5">
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
            className="flex-1 min-w-0 bg-transparent outline-none text-neutral-900 dark:text-white placeholder-neutral-500"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-neutral-500 shrink-0" aria-label="Clear">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* category pills */}
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
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-neutral-500">No matches.</p>
        ) : (
          filtered.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => pick(loc)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 active:bg-neutral-100 dark:active:bg-neutral-800 ${
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
    </>
  );

  return (
    <div ref={wrapRef} className="relative">

      {/* the field button */}
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

      {/* MOBILE: full-height bottom-sheet overlay (room to scroll) */}
      {open && isMobile && (
        <div className="fixed inset-0 z-[90]">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          {/* sheet */}
          <div className="absolute left-0 right-0 bottom-0 top-20 bg-white dark:bg-neutral-900 rounded-t-3xl border-t border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-base font-black text-neutral-900 dark:text-white">Choose destination</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {listBody}
          </div>
        </div>
      )}

      {/* DESKTOP: inline dropdown beneath the field */}
      {open && !isMobile && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl flex flex-col max-h-80 overflow-hidden">
          {listBody}
        </div>
      )}
    </div>
  );
}