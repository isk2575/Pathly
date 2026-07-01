import os
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, and_
from sqlalchemy.exc import IntegrityError
import networkx as nx

from database import get_db, init_db
from models import (
    Location, BlueLight, Incident, User, SavedPlace,
    Severity, IncidentSource, IncidentStatus, AlertComment, Confirmation,
)
import schemas

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # create tables if they don't exist yet (idempotent). Wrapped so a DB
    # hiccup doesn't take down routing, which doesn't depend on the DB.
    try:
        init_db()
    except Exception as e:
        print(f"[startup] init_db failed: {e}")


# ─── Routing graph (unchanged) ───────────────────────────────────────
SAFETY_WEIGHT = 2.0
GRAPH_PATH = os.path.join(os.path.dirname(__file__), "campus_graph.graphml")
graph = nx.read_graphml(GRAPH_PATH)

for node_id, data in graph.nodes(data=True):
    data["x"] = float(data["x"])
    data["y"] = float(data["y"])

for u, v, data in graph.edges(data=True):
    length = float(data.get("length", 0.0))
    penalty = float(data.get("safety_penalty", 0.0))
    data["length"] = length
    data["safe_cost"] = length + SAFETY_WEIGHT * penalty

IS_MULTI = graph.is_multigraph()

# ─── Incident-aware routing (applied to the safest route at request time) ───
INCIDENT_RADIUS_M = 70.0   # edges within this many metres of an incident get penalized
SEVERITY_PENALTY = {       # extra "virtual metres" added to a nearby edge, by severity
    "danger": 800.0,
    "warning": 300.0,
    "info": 80.0,
}
# Historical (resolved) incidents still mark a place as riskier, but less than
# a live alert, and they fade with age. These two knobs tune that.
HISTORICAL_WEIGHT = 0.35         # a resolved incident counts this fraction of a live one
HISTORICAL_MAX_AGE_DAYS = 365.0  # older than this contributes ~nothing (linear decay)

# ─── Alert lifetime ──────────────────────────────────────────────────
ALERT_TTL_HOURS = 24.0  # how long an alert stays live before it auto-resolves


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def nearest_node(lat, lng):
    best_id, best_dist = None, float("inf")
    for node_id, data in graph.nodes(data=True):
        d = haversine_m(lat, lng, data["y"], data["x"])
        if d < best_dist:
            best_dist, best_id = d, node_id
    return best_id


def edge_points(u, v):
    """Geometry points for edge u->v as [{lat,lng}], following the real path shape.

    The builder flattens each edge's OSM geometry into a 'pts' string
    ("lat,lng;lat,lng;..."). Here we parse it and orient it u->v.
    Returns None if the edge has no stored geometry.
    """
    data = graph.get_edge_data(u, v)
    if not data:
        return None

    # multigraph: pick the cheapest parallel edge (matches what Dijkstra used)
    if IS_MULTI:
        edge = min(data.values(), key=lambda e: float(e.get("safe_cost", e.get("length", 1e18))))
    else:
        edge = data

    pts = edge.get("pts")
    if not pts:
        return None

    points = []
    for pair in pts.split(";"):
        lat_str, lng_str = pair.split(",")
        points.append({"lat": float(lat_str), "lng": float(lng_str)})

    if len(points) < 2:
        return points

    # 'pts' may be stored u->v or v->u; orient it so it starts at u
    u_lat, u_lng = graph.nodes[u]["y"], graph.nodes[u]["x"]
    v_lat, v_lng = graph.nodes[v]["y"], graph.nodes[v]["x"]
    d_first_u = (points[0]["lat"] - u_lat) ** 2 + (points[0]["lng"] - u_lng) ** 2
    d_first_v = (points[0]["lat"] - v_lat) ** 2 + (points[0]["lng"] - v_lng) ** 2
    if d_first_v < d_first_u:
        points.reverse()
    return points


def build_route(start_lat, start_lng, end_lat, end_lng, weight_attr):
    origin = nearest_node(start_lat, start_lng)
    destination = nearest_node(end_lat, end_lng)
    if origin is None or destination is None:
        return None
    try:
        node_ids = nx.shortest_path(graph, origin, destination, weight=weight_attr)
    except nx.NetworkXNoPath:
        return None

    if len(node_ids) == 1:
        n = node_ids[0]
        return [{"lat": graph.nodes[n]["y"], "lng": graph.nodes[n]["x"]}]

    # stitch each edge's real geometry together into one smooth polyline
    coords = []
    for i in range(len(node_ids) - 1):
        u, v = node_ids[i], node_ids[i + 1]
        seg = edge_points(u, v)
        if not seg:
            # straight fallback if this edge has no stored geometry
            seg = [
                {"lat": graph.nodes[u]["y"], "lng": graph.nodes[u]["x"]},
                {"lat": graph.nodes[v]["y"], "lng": graph.nodes[v]["x"]},
            ]
        if coords and seg and coords[-1] == seg[0]:
            coords.extend(seg[1:])   # avoid duplicating the shared node
        else:
            coords.extend(seg)
    return coords


def expire_stale_incidents(db: Session) -> int:
    """Flip any active alert that's past its expiry into resolved.

    Expiry is expires_at when set, otherwise created_at + ALERT_TTL_HOURS.
    Returns how many were expired. Called at the top of the incident-fetching
    endpoints so the map self-cleans on read/poll — no background scheduler.

    The status flip is the whole feature: resolved alerts drop off the map
    (those views filter status == active) and at the same moment become
    historical data for routing (which reads status == resolved).
    """
    now = datetime.now(timezone.utc)

    active = (
        db.query(Incident)
        .filter(
            Incident.status == IncidentStatus.active,
            Incident.is_deleted.isnot(True),
        )
        .all()
    )

    expired = 0
    for inc in active:
        cutoff = inc.expires_at
        if cutoff is None:
            created = inc.created_at or now
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            cutoff = created + timedelta(hours=ALERT_TTL_HOURS)
        elif cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=timezone.utc)

        if now >= cutoff:
            inc.status = IncidentStatus.resolved
            expired += 1

    if expired:
        db.commit()
    return expired


def incident_risk_points(db: Session):
    """Every incident that should bend a safe route, as (lat, lng, severity, scale).

    - Active alerts:   scale = 1.0  (full weight)
    - Resolved alerts: scale = HISTORICAL_WEIGHT * age_decay  (a past hotspot
      still nudges routes, but less than a live alert, and fades with age)
    Pending/unverified reports are intentionally excluded — they aren't
    confirmed real, so they shouldn't influence routing.
    """
    points = []

    # live alerts — full weight
    active = (
        db.query(Incident)
        .filter(
            Incident.status == IncidentStatus.active,
            Incident.is_deleted.isnot(True),
            Incident.lat.isnot(None),
            Incident.lng.isnot(None),
        )
        .all()
    )
    for r in active:
        sev = getattr(r.severity, "value", str(r.severity))
        points.append((r.lat, r.lng, sev, 1.0))

    # resolved incidents — historical signal, reduced and age-decayed
    resolved = (
        db.query(Incident)
        .filter(
            Incident.status == IncidentStatus.resolved,
            Incident.is_deleted.isnot(True),
            Incident.lat.isnot(None),
            Incident.lng.isnot(None),
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for r in resolved:
        sev = getattr(r.severity, "value", str(r.severity))
        created = r.created_at
        if created is None:
            age_days = 0.0
        else:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age_days = (now - created).total_seconds() / 86400.0

        if age_days >= HISTORICAL_MAX_AGE_DAYS:
            continue  # too old to matter
        decay = 1.0 - (age_days / HISTORICAL_MAX_AGE_DAYS)  # 1.0 today -> 0.0 at max age
        scale = HISTORICAL_WEIGHT * decay
        if scale > 0.01:
            points.append((r.lat, r.lng, sev, scale))

    return points


def make_incident_weight(incidents):
    """Dijkstra weight = base safe_cost + penalty for passing near incidents.

    Each incident is (lat, lng, severity, scale). `scale` blends live alerts
    (1.0) with reduced/decayed historical ones. Penalty falls off linearly to
    zero at INCIDENT_RADIUS_M. A quick lat/lng box check skips far incidents
    before the haversine, keeping this fast inside Dijkstra's hot loop.
    """
    # ~0.001 deg ≈ 100m here, safely larger than the 70m radius, so anything
    # outside this box is definitely outside the penalty radius.
    BOX = 0.001

    def base_cost(d):
        if IS_MULTI:
            return min(float(e.get("safe_cost", e.get("length", 1.0))) for e in d.values())
        return float(d.get("safe_cost", d.get("length", 1.0)))

    def weight(u, v, d):
        base = base_cost(d)
        if not incidents:
            return base
        midy = (graph.nodes[u]["y"] + graph.nodes[v]["y"]) / 2.0
        midx = (graph.nodes[u]["x"] + graph.nodes[v]["x"]) / 2.0
        penalty = 0.0
        for (ilat, ilng, sev, scale) in incidents:
            # cheap rejection before the expensive haversine
            if abs(midy - ilat) > BOX or abs(midx - ilng) > BOX:
                continue
            dist = haversine_m(midy, midx, ilat, ilng)
            if dist < INCIDENT_RADIUS_M:
                w = SEVERITY_PENALTY.get(sev, SEVERITY_PENALTY["warning"])
                penalty += w * scale * (1.0 - dist / INCIDENT_RADIUS_M)
        return base + penalty

    return weight


def get_or_create_user(db: Session, firebase_uid: Optional[str]) -> Optional[User]:
    if not firebase_uid:
        return None
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if user is None:
        user = User(firebase_uid=firebase_uid)
        db.add(user)
        db.flush()  # assign an id without committing yet
    return user


# ─── API routes ──────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Pathly routing engine is running"}


@app.get("/locations", response_model=List[schemas.LocationOut])
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).order_by(Location.name).all()


@app.get("/bluelights", response_model=List[schemas.BlueLightOut])
def get_bluelights(db: Session = Depends(get_db)):
    return db.query(BlueLight).filter(BlueLight.is_active.is_(True)).all()


@app.get("/incidents", response_model=List[schemas.IncidentOut])
def get_incidents(db: Session = Depends(get_db)):
    """Live alerts for the Campus Alerts panel — active, newest first, each
    annotated with how many users confirmed it and how many comments it has.
    distinct() on each count keeps the two joins from inflating each other.

    Sweeps stale (24h) alerts to resolved first, so the live list is always
    current and expired ones become historical data in the same pass."""
    expire_stale_incidents(db)
    rows = (
        db.query(
            Incident,
            func.count(distinct(Confirmation.id)),
            func.count(distinct(AlertComment.id)),
        )
        .outerjoin(Confirmation, Confirmation.incident_id == Incident.id)
        .outerjoin(
            AlertComment,
            and_(AlertComment.incident_id == Incident.id, AlertComment.is_deleted.isnot(True)),
        )
        .filter(Incident.status == IncidentStatus.active, Incident.is_deleted.isnot(True))
        .group_by(Incident.id)
        .order_by(Incident.created_at.desc())
        .all()
    )
    out = []
    for incident, confirms, comments in rows:
        incident.confirmation_count = confirms
        incident.comment_count = comments
        out.append(incident)
    return out


@app.get("/zones")
def get_zones(db: Session = Depends(get_db)):
    """Incident points for the danger-zone heatmap.

    Includes BOTH active alerts and resolved/historical incidents (your app's
    reports + ingested UHPD crime-log entries), each with a weight derived from
    severity and recency. The frontend feeds these into a MapLibre heatmap so
    areas with more/worse/recent incidents glow hotter (red), quieter areas
    stay cool. Pending (unverified) reports are excluded — same as routing.
    """
    expire_stale_incidents(db)

    rows = (
        db.query(Incident)
        .filter(
            Incident.status.in_([IncidentStatus.active, IncidentStatus.resolved]),
            Incident.is_deleted.isnot(True),
            Incident.lat.isnot(None),
            Incident.lng.isnot(None),
        )
        .all()
    )

    now = datetime.now(timezone.utc)
    sev_base = {"danger": 1.0, "warning": 0.6, "info": 0.3}
    ZONE_MAX_AGE_DAYS = 365.0

    points = []
    for r in rows:
        sev = getattr(r.severity, "value", str(r.severity))
        base = sev_base.get(sev, 0.6)

        if r.status == IncidentStatus.active:
            recency = 1.0
        else:
            created = r.created_at or now
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age_days = (now - created).total_seconds() / 86400.0
            if age_days >= ZONE_MAX_AGE_DAYS:
                continue
            recency = max(0.15, 1.0 - age_days / ZONE_MAX_AGE_DAYS)

        points.append({
            "lat": r.lat,
            "lng": r.lng,
            "weight": round(base * recency, 3),
            "severity": sev,
        })

    return {"points": points, "count": len(points)}


@app.post("/reports", response_model=schemas.IncidentOut)
def create_report(payload: schemas.ReportCreate, db: Session = Depends(get_db)):
    """'Report an Issue' — comes in as a user-sourced, pending incident.
    expires_at is set now so the 24h clock starts at creation; once it's
    promoted/approved to active it lives out the remaining time."""
    try:
        severity = Severity(payload.severity)
    except ValueError:
        raise HTTPException(status_code=400, detail="severity must be info, warning, or danger")

    reporter = get_or_create_user(db, payload.firebase_uid)

    incident = Incident(
        type=payload.type,
        title=payload.title,
        description=payload.description,
        location_text=payload.location_text,
        photo_url=payload.photo_url,
        lat=payload.lat,
        lng=payload.lng,
        severity=severity,
        source=IncidentSource.user,
        status=IncidentStatus.pending,
        reported_by_id=reporter.id if reporter else None,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ALERT_TTL_HOURS),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    incident.confirmation_count = 0  # brand new — nobody's confirmed yet
    incident.comment_count = 0
    return incident


@app.get("/route/safest")
def get_safest_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float, db: Session = Depends(get_db)):
    # sweep stale alerts first so routing doesn't avoid a just-expired one
    expire_stale_incidents(db)
    incidents = incident_risk_points(db)
    weight = make_incident_weight(incidents)
    path = build_route(start_lat, start_lng, end_lat, end_lng, weight)
    if path is None:
        return {"error": "No route found"}
    live = sum(1 for p in incidents if p[3] >= 1.0)
    historical = len(incidents) - live
    return {
        "preference": "safest",
        "path": path,
        "avoided": live,            # live alerts (kept for frontend compatibility)
        "historical": historical,   # past incidents that also nudged the route
    }


@app.get("/route/fastest")
def get_fastest_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    path = build_route(start_lat, start_lng, end_lat, end_lng, "length")
    if path is None:
        return {"error": "No route found"}
    return {"preference": "fastest", "path": path}


# ─── Admin moderation ────────────────────────────────────────────────
# Admins are identified by their Firebase UID being in the ADMIN_UIDS env var
# (comma-separated). NOTE: this trusts the uid the client sends — fine for an
# MVP, but production should verify a Firebase ID token with firebase-admin.
ADMIN_UIDS = set(u.strip() for u in os.environ.get("ADMIN_UIDS", "").split(",") if u.strip())


def is_admin(uid: Optional[str]) -> bool:
    return bool(uid) and uid in ADMIN_UIDS


def require_admin(firebase_uid: Optional[str]):
    if not is_admin(firebase_uid):
        raise HTTPException(status_code=403, detail="Admin access required")


@app.get("/admin/check")
def admin_check(firebase_uid: str = ""):
    """Lets the frontend show admin controls only to admins."""
    return {"is_admin": is_admin(firebase_uid)}


@app.get("/admin/pending", response_model=List[schemas.IncidentOut])
def admin_pending(firebase_uid: str = "", db: Session = Depends(get_db)):
    """Reports awaiting review (pending, not soft-deleted), newest first."""
    require_admin(firebase_uid)
    rows = (
        db.query(Incident, func.count(Confirmation.id))
        .outerjoin(Confirmation, Confirmation.incident_id == Incident.id)
        .filter(Incident.status == IncidentStatus.pending, Incident.is_deleted.isnot(True))
        .group_by(Incident.id)
        .order_by(Incident.created_at.desc())
        .all()
    )
    out = []
    for incident, count in rows:
        incident.confirmation_count = count
        incident.comment_count = 0
        out.append(incident)
    return out


@app.post("/admin/incidents/{incident_id}/approve", response_model=schemas.IncidentOut)
def admin_approve(incident_id: int, firebase_uid: str = "", db: Session = Depends(get_db)):
    """Approve a report so it goes live on the map and routing."""
    require_admin(firebase_uid)
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = IncidentStatus.active
    db.commit()
    db.refresh(incident)
    incident.confirmation_count = count_confirmations(db, incident.id)
    incident.comment_count = 0
    return incident


@app.post("/admin/incidents/{incident_id}/delete", response_model=schemas.IncidentOut)
def admin_delete(incident_id: int, firebase_uid: str = "", db: Session = Depends(get_db)):
    """Soft-delete a report: hidden everywhere, but the row stays in the database."""
    require_admin(firebase_uid)
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.is_deleted = True
    db.commit()
    db.refresh(incident)
    incident.confirmation_count = count_confirmations(db, incident.id)
    incident.comment_count = 0
    return incident


# ── Alert discussion (student comments) ──────────────────────────────
MAX_COMMENT_LEN = 600  # keep comments short and on-topic


@app.get("/incidents/{incident_id}/comments", response_model=List[schemas.CommentOut])
def get_comments(incident_id: int, db: Session = Depends(get_db)):
    """Public: the discussion thread for an alert, oldest first."""
    return (
        db.query(AlertComment)
        .filter(
            AlertComment.incident_id == incident_id,
            AlertComment.is_deleted.isnot(True),
        )
        .order_by(AlertComment.created_at.asc())
        .all()
    )


@app.post("/incidents/{incident_id}/comments", response_model=schemas.CommentOut)
def create_comment(incident_id: int, payload: schemas.CommentCreate, db: Session = Depends(get_db)):
    """Auth-gated: a signed-in student posts a comment on an active alert."""
    # only signed-in users may post
    if not payload.firebase_uid:
        raise HTTPException(status_code=401, detail="Sign in to comment")

    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Comment can't be empty")
    if len(body) > MAX_COMMENT_LEN:
        raise HTTPException(status_code=400, detail=f"Comment must be under {MAX_COMMENT_LEN} characters")

    # the alert has to exist, be live, and not be deleted
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None or incident.is_deleted or incident.status != IncidentStatus.active:
        raise HTTPException(status_code=404, detail="Alert not found")

    name = (payload.author_name or "").strip() or "Student"
    comment = AlertComment(
        incident_id=incident_id,
        firebase_uid=payload.firebase_uid,
        author_name=name[:120],
        body=body,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.post("/admin/comments/{comment_id}/delete", response_model=schemas.CommentOut)
def admin_delete_comment(comment_id: int, firebase_uid: str = "", db: Session = Depends(get_db)):
    """Admin moderation: soft-delete a comment (row stays for the audit trail)."""
    require_admin(firebase_uid)
    comment = db.query(AlertComment).filter(AlertComment.id == comment_id).first()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_deleted = True
    db.commit()
    db.refresh(comment)
    return comment


# ── Confirmations / upvotes ──────────────────────────────────────────
CONFIRM_THRESHOLD = 3  # distinct user confirmations that auto-post a pending report


def count_confirmations(db: Session, incident_id: int) -> int:
    """How many distinct users have confirmed this incident."""
    return (
        db.query(func.count(Confirmation.id))
        .filter(Confirmation.incident_id == incident_id)
        .scalar()
    ) or 0


@app.get("/incidents/unconfirmed", response_model=List[schemas.IncidentOut])
def get_unconfirmed(db: Session = Depends(get_db)):
    """The 'Unconfirmed nearby' feed: user reports that are still pending
    (not yet posted to the map), each with its confirmation count so the
    UI can show progress toward the threshold."""
    rows = (
        db.query(Incident, func.count(Confirmation.id))
        .outerjoin(Confirmation, Confirmation.incident_id == Incident.id)
        .filter(
            Incident.status == IncidentStatus.pending,
            Incident.source == IncidentSource.user,
            Incident.is_deleted.isnot(True),
        )
        .group_by(Incident.id)
        .order_by(Incident.created_at.desc())
        .all()
    )
    out = []
    for incident, count in rows:
        incident.confirmation_count = count
        incident.comment_count = 0
        out.append(incident)
    return out


@app.post("/incidents/{incident_id}/confirm", response_model=schemas.ConfirmResult)
def confirm_incident(incident_id: int, firebase_uid: str = "", db: Session = Depends(get_db)):
    """A user confirms an alert ('still happening' / 'I see it too').

    One vote per user (enforced by a unique constraint — a repeat tap is a
    no-op, not an error). When a pending USER report reaches the threshold
    of distinct confirmations, it auto-promotes to active and posts to the map."""
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Sign in to confirm")

    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None or incident.is_deleted:
        raise HTTPException(status_code=404, detail="Alert not found")

    # record the vote; if this user already confirmed, just move on
    try:
        db.add(Confirmation(incident_id=incident_id, firebase_uid=firebase_uid))
        db.commit()
    except IntegrityError:
        db.rollback()  # duplicate (incident_id, firebase_uid) — already confirmed

    count = count_confirmations(db, incident_id)

    # auto-promote a pending community report once enough people back it
    promoted = False
    if (
        incident.source == IncidentSource.user
        and incident.status == IncidentStatus.pending
        and count >= CONFIRM_THRESHOLD
    ):
        incident.status = IncidentStatus.active
        db.commit()
        db.refresh(incident)
        promoted = True

    return schemas.ConfirmResult(
        incident_id=incident_id,
        confirmation_count=count,
        status=incident.status.value if hasattr(incident.status, "value") else str(incident.status),
        promoted=promoted,
    )