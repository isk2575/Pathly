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


def build_route(start_lat, start_lng, end_lat, end_lng, weight_attr):
    origin = nearest_node(start_lat, start_lng)
    destination = nearest_node(end_lat, end_lng)
    if origin is None or destination is None:
        return None
    try:
        node_ids = nx.shortest_path(graph, origin, destination, weight=weight_attr)
    except nx.NetworkXNoPath:
        return None
    return [{"lat": graph.nodes[n]["y"], "lng": graph.nodes[n]["x"]} for n in node_ids]


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
        .filter(Incident.status == IncidentStatus.active)
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
def get_safest_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    path = build_route(start_lat, start_lng, end_lat, end_lng, "safe_cost")
    if path is None:
        return {"error": "No route found"}
    return {"preference": "safest", "path": path}


@app.get("/route/fastest")
def get_fastest_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    path = build_route(start_lat, start_lng, end_lat, end_lng, "length")
    if path is None:
        return {"error": "No route found"}
    return {"preference": "fastest", "path": path}