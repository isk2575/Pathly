import { useState, useEffect } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { storage } from '../Firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const API_URL = process.env.REACT_APP_API_URL;

// centre the pin-drop mini-map on UH
const UH_CENTER = { lat: 29.7199, lng: -95.3422 };

// compact dark style for the pin-drop mini-map
const MINI_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

// "you are here" blue dot for the pin-drop map (matches navigation mode)
const USER_DOT =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
    '<circle cx="11" cy="11" r="10" fill="#3b82f6" fill-opacity="0.25"/>' +
    '<circle cx="11" cy="11" r="5" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>' +
    '</svg>'
  );

// map DB severity → flat alert accent colors (dot + label)
const severityStyles = {
  info:    { text: "text-blue-400",   dot: "bg-blue-500" },
  warning: { text: "text-yellow-400", dot: "bg-yellow-500" },
  danger:  { text: "text-red-400",    dot: "bg-red-500" },
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

export default function RightPanel({ darkMode, isMobile = false, isOpen = true, onClose, userLocation, firebaseUid, locations = [] })
{
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(true);
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

  // where the incident happened
  const [locMode, setLocMode] = useState('current'); // 'current' | 'spot' | 'pin'
  const [spotId, setSpotId] = useState('');
  const [pinPos, setPinPos] = useState(null);
  const [mapCenter, setMapCenter] = useState(UH_CENTER); // controls the pin-drop map view

  // optional photo on the report
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const handlePhotoSelect = (e) =>
  {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/'))
    {
      setSubmitStatus('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024)
    {
      setSubmitStatus('error');
      return;
    }
    setSubmitStatus(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () =>
  {
    if (photoPreview)
    {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  };
  const { isLoaded: mapLoaded } = useJsApiLoader({ googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY });

  const submitReport = async () =>
  {
    if (!reportTitle.trim())
    {
      setSubmitStatus('error');
      return;
    }

    // resolve where it happened
    let lat = null;
    let lng = null;
    if (locMode === 'current' && userLocation)
    {
      lat = userLocation.lat;
      lng = userLocation.lng;
    }
    else if (locMode === 'spot')
    {
      const loc = locations.find((l) => String(l.id) === spotId);
      if (loc)
      {
        lat = loc.lat;
        lng = loc.lng;
      }
    }
    else if (locMode === 'pin' && pinPos)
    {
      lat = pinPos.lat;
      lng = pinPos.lng;
    }

    if (lat == null)
    {
      setSubmitStatus('error');
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);

    // upload the photo first (if any), so its URL goes on the report
    let photoUrl = null;
    if (photoFile)
    {
      try
      {
        const safeName = photoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `incident-photos/${firebaseUid || 'anon'}/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }
      catch (err)
      {
        console.error('Photo upload failed:', err);
        setSubmitStatus('error');
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      type: reportType,
      title: reportTitle.trim(),
      description: reportDesc.trim() || null,
      photo_url: photoUrl,
      lat,
      lng,
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
      setLocMode('current');
      setSpotId('');
      setPinPos(null);
      setMapCenter(UH_CENTER);
      if (photoPreview)
      {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoFile(null);
      setPhotoPreview(null);
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

  // shared inner content (safety score + stats + alerts + report) used by both desktop and mobile
  const panelContent = (
    <>
      {/* Safety score + stats card */}
      <div className="bg-neutral-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Your Safety Score</h2>
          <span className="text-neutral-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4M12 8h.01"/>
            </svg>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3f3f46" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3"
                strokeDasharray="89 100" strokeLinecap="round"/>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-green-400 font-bold text-lg">89</span>
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 bg-green-500/15 text-green-400 text-xs rounded-full font-medium">High Safety</span>
            <p className="text-neutral-500 text-xs mt-1">based on alerts &amp; lighting</p>
          </div>
        </div>

        {/* stats */}
        <div className="flex flex-col gap-2.5 mt-4 pt-3 border-t border-neutral-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-neutral-300 text-sm">Well-lit paths</span>
            </div>
            <span className="text-green-400 text-sm font-medium">Good</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-neutral-300 text-sm">Blue Light Phones</span>
            </div>
            <span className="text-blue-400 text-sm font-medium">{blueLightLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-neutral-300 text-sm">Active Alerts</span>
            </div>
            <span className="text-neutral-400 text-sm font-medium">{loading ? '…' : `${alerts.length} on campus`}</span>
          </div>
        </div>
      </div>

      {/* Campus Alerts (collapsible) */}
      <button
        onClick={() => setAlertsOpen(!alertsOpen)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-sm">Campus Alerts</h2>
          {!loading && alerts.length > 0 && (
            <span className="text-xs text-neutral-300 bg-neutral-800 rounded-full px-2 py-0.5">{alerts.length}</span>
          )}
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-neutral-400 transition-transform ${alertsOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {alertsOpen && (
        <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
          {loading && (
            <p className="text-xs text-neutral-500">Loading alerts…</p>
          )}
          {!loading && alerts.length === 0 && (
            <p className="text-xs text-neutral-500">No active alerts on campus right now.</p>
          )}
          {alerts.map((alert) =>
          {
            const c = severityStyles[alert.severity] || severityStyles.warning;
            const dist = milesBetween(userLocation, { lat: alert.lat, lng: alert.lng });
            return (
              <div key={alert.id} className="bg-neutral-800 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <p className={`text-sm font-medium ${c.text}`}>{alert.type}</p>
                </div>
                {alert.location_text && <p className="text-xs text-neutral-400">{alert.location_text}</p>}
                {alert.photo_url && (
                  <img src={alert.photo_url} alt="" className="w-full h-28 object-cover rounded-xl mt-2" />
                )}
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-neutral-500">{timeAgo(alert.created_at)}</p>
                  {dist != null && <p className="text-xs text-neutral-500">{dist.toFixed(1)} mi</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report an Incident */}
      {!showReport && (
        <button
          onClick={() => { setShowReport(true); setSubmitStatus(null); }}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-red-400 bg-neutral-800 active:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
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
        <div className="rounded-2xl p-4 bg-neutral-800 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">Report an Incident</h2>
            <button onClick={() => setShowReport(false)} className="text-neutral-400 p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">Type</p>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm outline-none"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t} className="bg-neutral-900">{t}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">What happened?</p>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Brief summary"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm outline-none placeholder-neutral-500"
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">Details (optional)</p>
            <textarea
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              rows={2}
              placeholder="Add anything helpful"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm outline-none placeholder-neutral-500 resize-none"
            />
          </div>

          {/* Photo (optional) */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">Photo (optional)</p>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="preview" className="w-full h-32 object-cover rounded-xl" />
                <button
                  onClick={clearPhoto}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full bg-neutral-900 border border-dashed border-neutral-700 rounded-xl px-3 py-3 text-neutral-400 text-sm cursor-pointer active:bg-neutral-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Add a photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </label>
            )}
          </div>

          {/* Severity */}
          <div>
            <p className="text-xs text-neutral-400 mb-1">Severity</p>
            <div className="flex gap-2">
              {[
                { key: 'info', label: 'Info', active: 'bg-blue-500 text-white' },
                { key: 'warning', label: 'Warning', active: 'bg-yellow-500 text-black' },
                { key: 'danger', label: 'Danger', active: 'bg-red-500 text-white' },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setReportSeverity(s.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    reportSeverity === s.key ? s.active : 'bg-neutral-900 text-neutral-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Where did it happen? */}
          <div>
            <p className="text-xs text-neutral-400 mb-2">Where did it happen?</p>

            <div className="flex gap-2 mb-2">
              {[
                { key: 'current', label: 'My location' },
                { key: 'spot', label: 'Campus spot' },
                { key: 'pin', label: 'Drop a pin' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setLocMode(m.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    locMode === m.key ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {locMode === 'current' && (
              <p className="text-xs text-neutral-500">
                {userLocation ? 'Using your current GPS location.' : 'Location unavailable right now — pick another option.'}
              </p>
            )}

            {locMode === 'spot' && (
              <select
                value={spotId}
                onChange={(e) => setSpotId(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm outline-none"
              >
                <option value="" className="bg-neutral-900">Select a place...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-neutral-900">{loc.name}</option>
                ))}
              </select>
            )}

            {locMode === 'pin' && (
              <div>
                {mapLoaded ? (
                  <div className="rounded-xl overflow-hidden border border-neutral-700">
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '200px' }}
                      center={mapCenter}
                      zoom={16}
                      onClick={(e) =>
                      {
                        const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                        setPinPos(point);
                        setMapCenter(point);
                      }}
                      options={{ disableDefaultUI: true, gestureHandling: 'greedy', styles: MINI_DARK, clickableIcons: false }}
                    >
                      {userLocation && (
                        <Marker
                          position={userLocation}
                          icon={{
                            url: USER_DOT,
                            scaledSize: new window.google.maps.Size(22, 22),
                            anchor: new window.google.maps.Point(11, 11),
                          }}
                        />
                      )}
                      {pinPos && <Marker position={pinPos} />}
                    </GoogleMap>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">Loading map…</p>
                )}
                <p className="text-xs text-neutral-500 mt-1">
                  {pinPos ? 'Pin placed. Tap again to move it.' : 'Tap on campus where it happened. The blue dot is you.'}
                </p>
              </div>
            )}
          </div>

          {/* Submit — white pill */}
          <button
            onClick={submitReport}
            disabled={submitting || !reportTitle.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold text-black bg-white disabled:opacity-40 active:bg-neutral-200 transition-colors"
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
        <div className={`absolute top-0 right-0 bottom-0 z-30 w-80 max-w-[85vw] bg-neutral-900 border-l border-neutral-800 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-white font-bold text-lg">Safety</h2>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center active:bg-neutral-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div className="px-4 pb-8 flex flex-col gap-3 overflow-y-auto h-[calc(100%-64px)]">
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
        className="mt-4 w-6 h-12 rounded-l-lg flex items-center justify-center bg-neutral-800 text-neutral-300 active:bg-neutral-700 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {desktopOpen ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
        </svg>
      </button>

      <div className={`transition-all duration-300 ease-in-out ${desktopOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="w-72 rounded-l-2xl overflow-hidden bg-neutral-900 border-l border-y border-neutral-800">
          <div className="p-4 flex flex-col gap-3 max-h-[calc(100vh-120px)] overflow-y-auto">
            {panelContent}
          </div>
        </div>
      </div>
    </div>
  );
}