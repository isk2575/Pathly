import os
from math import radians, sin, cos, sqrt, atan2
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import networkx as nx

from database import get_db, init_db
from models import (
    Location, BlueLight, Incident, User, SavedPlace,
    Severity, IncidentSource, IncidentStatus,
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

# ─── Live-incident avoidance (applied to the safest route at request time) ───
INCIDENT_RADIUS_M = 70.0   # edges within this many metres of an active alert get penalized
SEVERITY_PENALTY = {       # extra "virtual metres" added to a nearby edge, by severity
    "danger": 800.0,
    "warning": 300.0,
    "info": 80.0,
}


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


def active_incident_points(db: Session):
    """Active alerts that have coordinates — the places to route around."""
    rows = (
        db.query(Incident)
        .filter(
            Incident.status == IncidentStatus.active,
            Incident.is_deleted.isnot(True),
            Incident.lat.isnot(None),
            Incident.lng.isnot(None),
        )
        .all()
    )
    points = []
    for r in rows:
        sev = getattr(r.severity, "value", str(r.severity))
        points.append((r.lat, r.lng, sev))
    return points


def make_incident_weight(incidents):
    """Dijkstra weight = base safe_cost + penalty for passing near active alerts."""
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
        for (ilat, ilng, sev) in incidents:
            dist = haversine_m(midy, midx, ilat, ilng)
            if dist < INCIDENT_RADIUS_M:
                w = SEVERITY_PENALTY.get(sev, SEVERITY_PENALTY["warning"])
                penalty += w * (1.0 - dist / INCIDENT_RADIUS_M)
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
    """Live alerts for the Campus Alerts panel — active, newest first."""
    return (
        db.query(Incident)
        .filter(Incident.status == IncidentStatus.active, Incident.is_deleted.isnot(True))
        .order_by(Incident.created_at.desc())
        .all()
    )


@app.post("/reports", response_model=schemas.IncidentOut)
def create_report(payload: schemas.ReportCreate, db: Session = Depends(get_db)):
    """'Report an Issue' — comes in as a user-sourced, pending incident."""
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
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@app.get("/route/safest")
def get_safest_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float, db: Session = Depends(get_db)):
    incidents = active_incident_points(db)
    weight = make_incident_weight(incidents)
    path = build_route(start_lat, start_lng, end_lat, end_lng, weight)
    if path is None:
        return {"error": "No route found"}
    return {"preference": "safest", "path": path, "avoided": len(incidents)}


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
    return (
        db.query(Incident)
        .filter(Incident.status == IncidentStatus.pending, Incident.is_deleted.isnot(True))
        .order_by(Incident.created_at.desc())
        .all()
    )


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
    return incident