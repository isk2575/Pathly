import { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL;

// map DB severity → the glass alert colors
const severityStyles = {
  info:    { bg: "bg-blue-500/10",   border: "border-blue-500/30",   text: "text-blue-400",   dot: "bg-blue-500",   glow: "shadow-[0_0_16px_rgba(59,130,246,0.18)]" },
  warning: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-500", glow: "shadow-[0_0_16px_rgba(234,179,8,0.18)]" },
  danger:  { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    dot: "bg-red-500",    glow: "shadow-[0_0_16px_rgba(239,68,68,0.2)]" },
};

// relative time like "12m ago"
function timeAgo(iso)
{
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// straight-line miles between the user and an incident (if both have coords)
function milesBetween(a, b)
{
  if (!a || !b || b.lat == null || b.lng == null) return null;
  const R = 3958.8;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function RightPanel({ darkMode, isMobile = false, isOpen = true, onClose, userLocation, firebaseUid })
{
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [blueLights, setBlueLights] = useState([]);
  const [loading, setLoading] = useState(true);

  // live alerts from the database
  useEffect(() =>
  {
    fetch(`${API_URL}/incidents`)
      .then((res) => res.json())
      .then((data) => { setAlerts(Array.isArray(data) ? data : []); setLoading(false); })
      .catch((err) => { console.error("Failed to load incidents:", err); setLoading(false); });
  }, []);

  // live blue-light phones from the database
  useEffect(() =>
  {
    fetch(`${API_URL}/bluelights`)
      .then((res) => res.json())
      .then((data) => setBlueLights(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load blue lights:", err));
  }, []);

  // how many blue lights are near the user — or the campus total if we have no location
  const NEARBY_MILES = 0.3;
  let blueLightLabel;
  if (blueLights.length === 0)
  {
    blueLightLabel = '…';
  }
  else if (userLocation)
  {
    const near = blueLights.filter((bl) =>
    {
      const d = milesBetween(userLocation, { lat: bl.lat, lng: bl.lng });
      return d != null && d <= NEARBY_MILES;
    }).length;
    blueLightLabel = `${near} nearby`;
  }
  else
  {
    blueLightLabel = `${blueLights.length} on campus`;
  }

  // ── Report an incident ──────────────────────────────────────────────
  const REPORT_TYPES = ["Suspicious Activity", "Theft", "Harassment", "Hazard", "Poor Lighting", "Other"];
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState(REPORT_TYPES[0]);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSeverity, setReportSeverity] = useState('warning');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // null | 'success' | 'error'

  const submitReport = async () =>
  {
    if (!reportTitle.trim())
    {
      setSubmitStatus('error');
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);

    const payload = {
      type: reportType,
      title: reportTitle.trim(),
      description: reportDesc.trim() || null,
      lat: userLocation ? userLocation.lat : null,
      lng: userLocation ? userLocation.lng : null,
      severity: reportSeverity,
      firebase_uid: firebaseUid || null,
    };

    try
    {
      const res = await fetch(`${API_URL}/reports`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      setSubmitStatus('success');
      setReportTitle('');
      setReportDesc('');
      setReportSeverity('warning');
      setReportType(REPORT_TYPES[0]);
    }
    catch (err)
    {
      console.error('Report failed:', err);
      setSubmitStatus('error');
    }
    finally
    {
      setSubmitting(false);
    }
  };

  // shared inner content (safety score + stats + alerts) used by both desktop and mobile
  const panelContent = (
    <>
      {/* Safety Score Header */}
      <div className="flex items-center justify-between">
        <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Your Safety Score</h2>
        <button className="text-gray-400 hover:text-gray-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
        </button>
      </div>

      {/* Score Circle */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-green-500/25 blur-xl" />
          <svg viewBox="0 0 36 36" className="relative w-16 h-16 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={darkMode ? '#1f2937' : '#e5e7eb'} strokeWidth="3"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3"
              strokeDasharray="89 100" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px rgba(34,197,94,0.85))' }}/>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#22c55e">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
            </svg>
          </div>
        </div>
        <div>
          <div className="flex items-end gap-1">
            <span className="text-4xl font-bold text-green-400" style={{ textShadow: '0 0 18px rgba(34,197,94,0.5)' }}>89</span>
            <span className="text-gray-400 text-sm mb-1">/100</span>
          </div>
          <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-medium border border-green-500/30">High</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.9)]" />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Well-lit paths</span>
          </div>
          <span className="text-green-400 text-sm font-medium">Good</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.9)]" />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Blue Light Phones</span>
          </div>
          <span className="text-blue-400 text-sm font-medium">{blueLightLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Active Alerts</span>
          </div>
          <span className="text-gray-400 text-sm font-medium">{loading ? '…' : `${alerts.length} on campus`}</span>
        </div>
      </div>

      {/* View Route Details */}
      <button className="relative w-full py-3 rounded-xl text-sm font-semibold text-blue-300 bg-white/5 backdrop-blur-md border border-blue-400/30 transition-all hover:bg-white/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] flex items-center justify-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
        View Route Details
      </button>

      {/* Campus Alerts */}
      <div className="flex items-center justify-between">
        <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Campus Alerts</h2>
        <button className="text-blue-400 text-xs font-medium hover:text-blue-300">View All</button>
      </div>

      {/* Alerts List — fed by the database */}
      {loading && (
        <p className="text-xs text-gray-500">Loading alerts…</p>
      )}
      {!loading && alerts.length === 0 && (
        <p className="text-xs text-gray-500">No active alerts on campus right now.</p>
      )}
      {alerts.map((alert) =>
      {
        const c = severityStyles[alert.severity] || severityStyles.warning;
        const dist = milesBetween(userLocation, { lat: alert.lat, lng: alert.lng });
        return (
          <div key={alert.id} className={`relative rounded-xl p-3 border backdrop-blur-md ${c.bg} ${c.border} ${c.glow}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
              <p className={`text-sm font-medium ${c.text}`}>{alert.type}</p>
            </div>
            {alert.location_text && <p className="text-xs text-gray-400">{alert.location_text}</p>}
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">{timeAgo(alert.created_at)}</p>
              {dist != null && <p className="text-xs text-gray-500">{dist.toFixed(1)} mi</p>}
            </div>
          </div>
        );
      })}

      {/* Report an Incident */}
      <div className="pt-1 border-t border-white/10 mt-1">
        {!showReport && (
          <button
            onClick={() => { setShowReport(true); setSubmitStatus(null); }}
            className="relative w-full mt-3 py-3 rounded-xl text-sm font-semibold text-red-300 bg-red-500/10 backdrop-blur-md border border-red-400/30 transition-all hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Report an Incident
          </button>
        )}

        {showReport && (
          <div className="mt-3 rounded-2xl p-4 bg-white/5 backdrop-blur-md border border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Report an Incident</h2>
              <button onClick={() => setShowReport(false)} className="text-gray-400 p-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Type */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Type</p>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-gray-900">{t}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <p className="text-xs text-gray-400 mb-1">What happened?</p>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Brief summary"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none placeholder-gray-500"
              />
            </div>

            {/* Description */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Details (optional)</p>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                rows={2}
                placeholder="Add anything helpful"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none placeholder-gray-500 resize-none"
              />
            </div>

            {/* Severity */}
            <div>
              <p className="text-xs text-gray-400 mb-1">Severity</p>
              <div className="flex gap-2">
                {[
                  { key: 'info', label: 'Info', active: 'bg-blue-500/20 border-blue-400/50 text-blue-300' },
                  { key: 'warning', label: 'Warning', active: 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300' },
                  { key: 'danger', label: 'Danger', active: 'bg-red-500/20 border-red-400/50 text-red-300' },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setReportSeverity(s.key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                      reportSeverity === s.key ? s.active : 'bg-white/5 border-white/10 text-gray-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location note */}
            <p className="text-xs text-gray-500">
              {userLocation ? 'Reported at your current location.' : 'No location yet — report will have no map pin.'}
            </p>

            {/* Submit */}
            <button
              onClick={submitReport}
              disabled={submitting || !reportTitle.trim()}
              className="relative w-full py-3 rounded-xl text-sm font-bold text-white bg-blue-600/80 backdrop-blur-md border border-blue-400/40 disabled:opacity-40 transition-all hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.45)] flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>

            {submitStatus === 'success' && (
              <p className="text-xs text-green-400">Thanks — your report was submitted and is pending review.</p>
            )}
            {submitStatus === 'error' && (
              <p className="text-xs text-red-400">Couldn't submit. Add a summary and try again.</p>
            )}
          </div>
        )}
      </div>
    </>
  );

  // ── MOBILE: slide-in drawer from the right ──────────────────────────
  if (isMobile)
  {
    return (
      <>
        {/* backdrop */}
        <div
          onClick={onClose}
          className={`absolute inset-0 z-20 bg-black/50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
        {/* drawer */}
        <div className={`absolute top-0 right-0 bottom-0 z-30 w-80 max-w-[85vw] bg-gray-900/70 backdrop-blur-2xl border-l border-white/10 shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <span className="pointer-events-none absolute inset-y-8 left-0 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h2 className="text-white font-bold text-base">Safety</h2>
            <button onClick={onClose} className="text-gray-400 p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="px-5 pb-8 flex flex-col gap-4 overflow-y-auto h-[calc(100%-56px)]">
            {panelContent}
          </div>
        </div>
      </>
    );
  }

  // ── DESKTOP: toggle-arrow + panel ───────────────────────────────────
  return (
    <div className="absolute top-16 right-0 z-10 flex items-start">
      <button
        onClick={() => setDesktopOpen(!desktopOpen)}
        className={`mt-4 w-6 h-12 rounded-l-lg flex items-center justify-center transition-all backdrop-blur-md border ${
          darkMode ? 'bg-white/10 hover:bg-white/15 text-gray-300 border-white/10' : 'bg-white/70 hover:bg-white text-gray-600 border-gray-200'
        } shadow-lg`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {desktopOpen ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
        </svg>
      </button>

      <div className={`transition-all duration-300 ease-in-out ${desktopOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className={`relative w-72 rounded-l-2xl overflow-hidden shadow-2xl backdrop-blur-xl ${
          darkMode ? 'bg-gray-900/60 border-l border-y border-white/10' : 'bg-white/70 border-l border-y border-gray-200'
        }`}>
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="p-5 flex flex-col gap-4 max-h-[calc(100vh-120px)] overflow-y-hidden hover:overflow-y-auto">
            {panelContent}
          </div>
        </div>
      </div>
    </div>
  );
}