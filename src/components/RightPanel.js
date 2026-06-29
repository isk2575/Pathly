import { useState, useEffect } from 'react';
import MapGL, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { auth, storage } from '../Firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut } from 'firebase/auth';

const API_URL = process.env.REACT_APP_API_URL;

// centre the pin-drop mini-map on UH
const UH_CENTER = { lat: 29.7199, lng: -95.3422 };
// reports must fall within this many miles of campus center. anything
// further out almost certainly isn't a UH incident, so we reject it
// rather than dropping a pin in the middle of nowhere. easy to tune.
const MAX_REPORT_MILES = 1;

// light vector style for the pin-drop mini-map — MapTiler hosted (reliable,
// free tier). Key from env (REACT_APP_MAPTILER_KEY). NOTE: backticks required
// so the key actually interpolates — single quotes ship "${...}" literally.
const MINI_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.REACT_APP_MAPTILER_KEY}`;

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

export default function RightPanel({ darkMode, isMobile = false, isOpen = true, onClose, userLocation, firebaseUid, locations = [], openSignal = 0, onPendingCountChange, onOpenDiscussion, onImageClick })
{
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [blueLights, setBlueLights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pending, setPending] = useState([]);

  // "Unconfirmed nearby": pending community reports waiting on confirmations.
  // CONFIRM_THRESHOLD mirrors the backend — 3 distinct users posts it live.
  const CONFIRM_THRESHOLD = 3;
  const [unconfirmed, setUnconfirmed] = useState([]);
  const [confirmedIds, setConfirmedIds] = useState(() => new Set());
  const [alertSort, setAlertSort] = useState('recent'); // 'recent' | 'trending'

  // live alerts from the database — POLLS every 8s so the feed stays current
  // (new alerts in, expired 24h alerts out, fresh confirmation counts).
  useEffect(() =>
  {
    let cancelled = false;

    const loadAlerts = () =>
    {
      fetch(`${API_URL}/incidents`)
        .then((res) => res.json())
        .then((data) => { if (!cancelled) { setAlerts(Array.isArray(data) ? data : []); setLoading(false); } })
        .catch((err) => { if (!cancelled) { console.error("Failed to load incidents:", err); setLoading(false); } });
    };

    loadAlerts();
    const id = setInterval(loadAlerts, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // the unconfirmed feed — reports not yet posted to the map. POLLS every 8s
  // so community reports (and their confirmation progress) stay live.
  useEffect(() =>
  {
    let cancelled = false;

    const loadUnconfirmed = () =>
    {
      fetch(`${API_URL}/incidents/unconfirmed`)
        .then((res) => res.json())
        .then((data) => { if (!cancelled) setUnconfirmed(Array.isArray(data) ? data : []); })
        .catch((err) => { if (!cancelled) console.error("Failed to load unconfirmed reports:", err); });
    };

    loadUnconfirmed();
    const id = setInterval(loadUnconfirmed, 8000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // live blue-light phones from the database
  useEffect(() =>
  {
    fetch(`${API_URL}/bluelights`)
      .then((res) => res.json())
      .then((data) => setBlueLights(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load blue lights:", err));
  }, []);

  // is this user an admin? if so, load + POLL the pending-review queue every
  // 8s so new reports show up for review live (this drives the notification).
  useEffect(() =>
  {
    if (!firebaseUid)
    {
      setIsAdmin(false);
      setPending([]);
      return;
    }

    let cancelled = false;
    let intervalId = null;

    fetch(`${API_URL}/admin/check?firebase_uid=${encodeURIComponent(firebaseUid)}`)
      .then((res) => res.json())
      .then((data) =>
      {
        if (cancelled) return;
        const admin = !!(data && data.is_admin);
        setIsAdmin(admin);
        if (admin)
        {
          const loadPending = () =>
          {
            fetch(`${API_URL}/admin/pending?firebase_uid=${encodeURIComponent(firebaseUid)}`)
              .then((r) => r.json())
              .then((list) => { if (!cancelled) setPending(Array.isArray(list) ? list : []); })
              .catch((err) => { if (!cancelled) console.error('Failed to load pending reports:', err); });
          };
          loadPending();
          intervalId = setInterval(loadPending, 8000);
        }
      })
      .catch((err) => { if (!cancelled) console.error('Admin check failed:', err); });

    return () => { cancelled = true; if (intervalId) clearInterval(intervalId); };
  }, [firebaseUid]);

  // tell the parent how many reports are waiting, so it can show the
  // notification with an accurate number. this fires on first load AND
  // every time the queue changes (an approve/delete shrinks `pending`),
  // so the badge counts down as the admin works — no separate fetch,
  // one source of truth.
  useEffect(() =>
  {
    if (onPendingCountChange) onPendingCountChange(isAdmin ? pending.length : 0);
  }, [pending, isAdmin, onPendingCountChange]);

  // the notification bumps openSignal; when it changes we force the
  // desktop panel open so the pending section is actually visible.
  // (the mobile drawer is opened by the parent via isOpen instead.)
  // we skip the initial 0 so the panel isn't forced open on first render.
  useEffect(() =>
  {
    if (openSignal > 0) setDesktopOpen(true);
  }, [openSignal]);

  // confirm an already-live alert from the Campus Alerts list. unlike the
  // feed version, this one just bumps the count in place (it's already posted).
  const confirmActiveAlert = async (id) =>
  {
    if (!firebaseUid) return;

    try
    {
      const res = await fetch(`${API_URL}/incidents/${id}/confirm?firebase_uid=${encodeURIComponent(firebaseUid)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Confirm failed: ${res.status}`);
      const data = await res.json();

      setConfirmedIds((prev) =>
      {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, confirmation_count: data.confirmation_count } : a)));
    }
    catch (err)
    {
      console.error('Confirm failed:', err);
    }
  };

  // a user confirms a report in the unconfirmed feed. updates its count;
  // when the backend says it crossed the threshold (promoted), it's now a
  // live alert, so we drop it from this feed — it'll show on the map.
  const confirmReport = async (id) =>
  {
    if (!firebaseUid) return;

    try
    {
      const res = await fetch(`${API_URL}/incidents/${id}/confirm?firebase_uid=${encodeURIComponent(firebaseUid)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Confirm failed: ${res.status}`);
      const data = await res.json();

      setConfirmedIds((prev) =>
      {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      if (data.promoted)
      {
        setUnconfirmed((prev) => prev.filter((r) => r.id !== id));
      }
      else
      {
        setUnconfirmed((prev) => prev.map((r) => (r.id === id ? { ...r, confirmation_count: data.confirmation_count } : r)));
      }
    }
    catch (err)
    {
      console.error('Confirm failed:', err);
    }
  };

  const approveReport = async (id) =>
  {
    try
    {
      const res = await fetch(`${API_URL}/admin/incidents/${id}/approve?firebase_uid=${encodeURIComponent(firebaseUid)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
      setPending((prev) => prev.filter((r) => r.id !== id));
    }
    catch (err)
    {
      console.error('Approve failed:', err);
    }
  };

  const deleteReport = async (id) =>
  {
    try
    {
      const res = await fetch(`${API_URL}/admin/incidents/${id}/delete?firebase_uid=${encodeURIComponent(firebaseUid)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      setPending((prev) => prev.filter((r) => r.id !== id));
    }
    catch (err)
    {
      console.error('Delete failed:', err);
    }
  };

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
  const [submitErrorMsg, setSubmitErrorMsg] = useState(null); // optional custom error text

  // where the incident happened
  const [locMode, setLocMode] = useState('current'); // 'current' | 'spot' | 'pin'
  const [spotId, setSpotId] = useState('');
  const [pinPos, setPinPos] = useState(null);
  const [pinError, setPinError] = useState(null); // shown when a pin lands too far from campus
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
      setSubmitErrorMsg(null);
      setSubmitStatus('error');
      return;
    }

    // final safety net across every mode (current / spot / pin):
    // refuse anything outside the valid zone so a far-away GPS fix
    // can't drop an incident 10 miles from campus.
    const distFromUH = milesBetween(UH_CENTER, { lat, lng });
    if (distFromUH != null && distFromUH > MAX_REPORT_MILES)
    {
      setSubmitErrorMsg('That location is too far from campus. Please choose a UH area or a valid zone.');
      setSubmitStatus('error');
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);
    setSubmitErrorMsg(null);

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
      setPinError(null);
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
    {/* Live Safety Header */}
    <div className="rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
            UH Campus
          </p>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white mt-1">
            Live Safety
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Real-time reports around campus
          </p>
        </div>

        <div className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-500">
          Safe
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-900 p-3">
          <p className="text-2xl font-black text-green-500">89</p>
          <p className="text-[11px] text-neutral-500 font-medium">Score</p>
        </div>

        <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-900 p-3">
          <p className="text-2xl font-black text-neutral-900 dark:text-white">
            {loading ? "…" : alerts.length}
          </p>
          <p className="text-[11px] text-neutral-500 font-medium">Alerts</p>
        </div>

        <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-900 p-3">
          <p className="text-sm font-black text-blue-500 truncate">
            {blueLightLabel}
          </p>
          <p className="text-[11px] text-neutral-500 font-medium">Blue lights</p>
        </div>
      </div>
    </div>

    {/* Admin Pending Review */}
    {isAdmin && (
      <div className="rounded-3xl bg-amber-500/10 border border-amber-500/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white">
              Pending Review
            </p>
            <p className="text-xs text-neutral-500">
              Reports waiting for approval
            </p>
          </div>

          <span className="rounded-full bg-white dark:bg-neutral-900 px-3 py-1 text-xs font-bold text-amber-500">
            {pending.length}
          </span>
        </div>

        {pending.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 max-h-80 overflow-y-auto">
            {pending.map((r) => {
              const c = severityStyles[r.severity] || severityStyles.warning;

              return (
                <div key={r.id} className="rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                    <p className="text-sm font-bold text-neutral-900 dark:text-white">
                      {r.type}
                    </p>
                    <span className="ml-auto text-xs text-neutral-400">
                      {timeAgo(r.created_at)}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
                    {r.title}
                  </p>

                  {r.description && (
                    <p className="text-xs text-neutral-500 mt-1">
                      {r.description}
                    </p>
                  )}

                  {r.photo_url && (
                    <img
                      src={r.photo_url}
                      alt=""
                      onClick={() => onImageClick && onImageClick(r.photo_url)}
                      className="mt-3 h-28 w-full rounded-2xl object-cover cursor-pointer"
                    />
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => approveReport(r.id)}
                      className="flex-1 rounded-full bg-green-500 py-2 text-xs font-bold text-black"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => deleteReport(r.id)}
                      className="flex-1 rounded-full bg-red-500/10 py-2 text-xs font-bold text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* Feed Header */}
    <div className="flex items-center justify-between pt-1">
      <div>
        <h2 className="text-lg font-black text-neutral-900 dark:text-white">
          Campus Alerts
        </h2>
        <p className="text-xs text-neutral-500">
          Verified incidents and updates
        </p>
      </div>

      {!loading && alerts.length > 0 && (
        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">
          {alerts.length} live
        </span>
      )}
    </div>

    {/* Sort Toggle */}
    {!loading && alerts.length > 1 && (
      <div className="flex w-full rounded-full bg-neutral-100 dark:bg-neutral-900 p-1">
        <button
          onClick={() => setAlertSort("recent")}
          className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
            alertSort === "recent"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
              : "text-neutral-500"
          }`}
        >
          Recent
        </button>

        <button
          onClick={() => setAlertSort("trending")}
          className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
            alertSort === "trending"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
              : "text-neutral-500"
          }`}
        >
          Trending
        </button>
      </div>
    )}

    {/* Alerts Feed */}
    <div className="flex flex-col gap-3">
      {loading && (
        <div className="rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5">
          <p className="text-sm text-neutral-500">Loading campus alerts…</p>
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5">
          <p className="text-sm font-bold text-neutral-900 dark:text-white">
            No active alerts
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            Campus looks quiet right now.
          </p>
        </div>
      )}

      {(() => {
        const score = (a) => (a.confirmation_count || 0) + (a.comment_count || 0);
        const ordered =
          alertSort === "trending"
            ? [...alerts].sort((a, b) => score(b) - score(a))
            : alerts;

        return ordered.map((alert, idx) => {
          const c = severityStyles[alert.severity] || severityStyles.warning;
          const dist = milesBetween(userLocation, { lat: alert.lat, lng: alert.lng });
          const confirms = alert.confirmation_count || 0;
          const comments = alert.comment_count || 0;
          const mine = confirmedIds.has(alert.id);
          const isTop = alertSort === "trending" && idx === 0 && score(alert) > 0;

          return (
            <div
              key={alert.id}
              className="rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${c.dot}`} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-neutral-900 dark:text-white">
                      {alert.type}
                    </p>

                    {isTop && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                        Trending
                      </span>
                    )}

                    <span className="ml-auto text-xs text-neutral-400">
                      {timeAgo(alert.created_at)}
                    </span>
                  </div>

                  {alert.title && (
                    <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                      {alert.title}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                    {alert.location_text && <span>{alert.location_text}</span>}
                    {dist != null && <span>• {dist.toFixed(1)} mi</span>}
                  </div>

                  {alert.photo_url && (
                    <img
                      src={alert.photo_url}
                      alt=""
                      onClick={() => onImageClick && onImageClick(alert.photo_url)}
                      className="mt-3 h-32 w-full rounded-2xl object-cover cursor-pointer"
                    />
                  )}

                  {(confirms > 0 || comments > 0) && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
                      {confirms > 0 && <span>{confirms} confirmed</span>}
                      {comments > 0 && (
                        <span>
                          {comments} comment{comments === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => confirmActiveAlert(alert.id)}
                      disabled={!firebaseUid || mine}
                      className={`flex-1 rounded-full py-2 text-xs font-bold ${
                        mine
                          ? "bg-green-500/15 text-green-500"
                          : "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-white disabled:opacity-40"
                      }`}
                    >
                      {mine ? "Confirmed" : "Confirm"}
                    </button>

                    <button
                      onClick={() => onOpenDiscussion && onOpenDiscussion(alert)}
                      className="flex-1 rounded-full bg-neutral-900 py-2 text-xs font-bold text-white dark:bg-white dark:text-black"
                    >
                      Discussion
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        });
      })()}
    </div>

    {/* Unconfirmed Feed */}
    {unconfirmed.length > 0 && (
      <div className="rounded-3xl bg-neutral-100 dark:bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-neutral-900 dark:text-white">
              Unconfirmed Nearby
            </h2>
            <p className="text-xs text-neutral-500">
              Help verify community reports
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 max-h-72 overflow-y-auto">
          {unconfirmed.map((rep) => {
            const count = rep.confirmation_count || 0;
            const mine = confirmedIds.has(rep.id);
            const dist = milesBetween(userLocation, { lat: rep.lat, lng: rep.lng });

            return (
              <div key={rep.id} className="rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
                    {rep.type}
                  </p>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                    Unconfirmed
                  </span>
                </div>

                {rep.title && (
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                    {rep.title}
                  </p>
                )}

                <p className="mt-2 text-xs text-neutral-500">
                  {count}/{CONFIRM_THRESHOLD} confirmed
                  {dist != null && ` · ${dist.toFixed(1)} mi`}
                </p>

                <button
                  onClick={() => confirmReport(rep.id)}
                  disabled={!firebaseUid || mine}
                  className={`mt-3 w-full rounded-full py-2 text-xs font-bold ${
                    mine
                      ? "bg-green-500/15 text-green-500"
                      : "bg-neutral-900 text-white dark:bg-white dark:text-black disabled:opacity-40"
                  }`}
                >
                  {mine ? "Confirmed" : "I see it too"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Report Button */}
    {!showReport && (
      <button
        onClick={() => {
          setShowReport(true);
          setSubmitStatus(null);
        }}
        className="w-full rounded-3xl bg-red-500 py-4 text-sm font-black text-white shadow-lg shadow-red-500/20 active:bg-red-600 flex items-center justify-center gap-2"
      >
        Report an Incident
      </button>
    )}

    {/* Report Form */}
    {showReport && (
      <div className="rounded-3xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-neutral-900 dark:text-white">
              Report Incident
            </h2>
            <p className="text-xs text-neutral-500">
              Help keep campus aware
            </p>
          </div>

          <button
            onClick={() => setShowReport(false)}
            className="h-9 w-9 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-500 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-4 py-3 text-base font-semibold text-neutral-900 dark:text-white outline-none"
        >
          {REPORT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={reportTitle}
          onChange={(e) => setReportTitle(e.target.value)}
          placeholder="What happened?"
          className="w-full rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-4 py-3 text-base text-neutral-900 dark:text-white outline-none placeholder-neutral-500"
        />

        <textarea
          value={reportDesc}
          onChange={(e) => setReportDesc(e.target.value)}
          rows={3}
          placeholder="Add details, location, or anything helpful"
          className="w-full resize-none rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-4 py-3 text-base text-neutral-900 dark:text-white outline-none placeholder-neutral-500"
        />

        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "info", label: "Info", active: "bg-blue-500 text-white" },
            { key: "warning", label: "Warning", active: "bg-yellow-400 text-black" },
            { key: "danger", label: "Danger", active: "bg-red-500 text-white" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setReportSeverity(s.key)}
              className={`rounded-2xl py-2 text-xs font-bold ${
                reportSeverity === s.key
                  ? s.active
                  : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Where did it happen? */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Where did it happen?
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "current", label: "My location" },
              { key: "spot", label: "Campus spot" },
              { key: "pin", label: "Drop a pin" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => setLocMode(m.key)}
                className={`rounded-2xl py-2 text-xs font-bold transition ${
                  locMode === m.key
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {locMode === "current" && (
            <p className="text-xs text-neutral-500">
              {userLocation
                ? "Using your current GPS location."
                : "Location unavailable right now — pick another option."}
            </p>
          )}

          {locMode === "spot" && (
            <select
              value={spotId}
              onChange={(e) => setSpotId(e.target.value)}
              className="w-full rounded-2xl bg-neutral-100 dark:bg-neutral-900 px-4 py-3 text-base text-neutral-900 dark:text-white outline-none"
            >
              <option value="">Select a place…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          )}

          {locMode === "pin" && (
            <div className="flex flex-col gap-1">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <MapGL
                  initialViewState={{ longitude: UH_CENTER.lng, latitude: UH_CENTER.lat, zoom: 16 }}
                  style={{ width: "100%", height: "200px" }}
                  mapStyle={MINI_STYLE}
                  attributionControl={false}
                  onClick={(e) =>
                  {
                    const point = { lat: e.lngLat.lat, lng: e.lngLat.lng };
                    const dist = milesBetween(UH_CENTER, point);
                    // reject taps outside the valid zone — tell the user to pick
                    // a campus spot and don't place the pin
                    if (dist != null && dist > MAX_REPORT_MILES)
                    {
                      setPinError("That spot is too far from campus. Please pick a UH area.");
                      return;
                    }
                    setPinError(null);
                    setPinPos(point);
                  }}
                >
                  {userLocation && (
                    <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
                      <img src={USER_DOT} width={22} height={22} alt="" style={{ display: "block" }} />
                    </Marker>
                  )}
                  {pinPos && (
                    <Marker longitude={pinPos.lng} latitude={pinPos.lat} anchor="bottom">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#ef4444" stroke="#fff" strokeWidth="1.5">
                        <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none" />
                      </svg>
                    </Marker>
                  )}
                </MapGL>
              </div>
              <p className="text-xs text-neutral-500">
                {pinPos ? "Pin placed. Tap again to move it." : "Tap where it happened. The blue dot is you."}
              </p>
              {pinError && <p className="text-xs font-semibold text-red-500">{pinError}</p>}
            </div>
          )}
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-500">
          {photoPreview ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        </label>

        {photoPreview && (
          <div className="relative">
            <img src={photoPreview} alt="preview" className="h-36 w-full rounded-2xl object-cover" />
            <button
              onClick={clearPhoto}
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/70 text-white"
            >
              ×
            </button>
          </div>
        )}

        <button
          onClick={submitReport}
          disabled={submitting || !reportTitle.trim()}
          className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-black text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>

        {submitStatus === "success" && (
          <p className="text-xs font-semibold text-green-500">
            Thanks — your report was submitted for review.
          </p>
        )}

        {submitStatus === "error" && (
          <p className="text-xs font-semibold text-red-500">
            {submitErrorMsg || "Could not submit. Add a summary and try again."}
          </p>
        )}
      </div>
    )}

    {/* Logout */}
    <button
      onClick={() => signOut(auth).catch((err) => console.error("Logout failed:", err))}
      className="self-end flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-red-500 active:bg-red-500/10"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Log out
    </button>
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
        <div className={`absolute top-0 right-0 bottom-0 z-30 w-80 max-w-[85vw] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-neutral-900 dark:text-white font-bold text-lg">Safety</h2>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center justify-center active:bg-neutral-200 dark:bg-neutral-700">
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
        className="mt-4 w-6 h-12 rounded-l-lg flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 active:bg-neutral-200 dark:bg-neutral-700 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {desktopOpen ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
        </svg>
      </button>

      <div className={`transition-all duration-300 ease-in-out ${desktopOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="w-72 rounded-l-2xl overflow-hidden bg-white dark:bg-neutral-900 border-l border-y border-neutral-200 dark:border-neutral-800">
          <div className="p-4 flex flex-col gap-3 max-h-[calc(100vh-120px)] overflow-y-auto">
            {panelContent}
          </div>
        </div>
      </div>
    </div>
  );
}