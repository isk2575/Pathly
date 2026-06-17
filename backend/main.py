import os
from math import radians, sin, cos, sqrt, atan2

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import networkx as nx

app = FastAPI()

# allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Tunables ────────────────────────────────────────────────────────
# How much we are willing to detour for safety.
#   0   = ignore safety, take the shortest path
#   2.0 = accept a longer route to stay near blue lights
# Edit and restart to retune. No graph rebuild needed.
SAFETY_WEIGHT = 2.0

# ─── Load the prebuilt campus walking graph ──────────────────────────
# campus_graph.graphml is generated offline by build_campus_graph.py.
# We load that file instead of calling OpenStreetMap at startup, so the
# app boots fast and never times out waiting on a network fetch.
GRAPH_PATH = os.path.join(os.path.dirname(__file__), "campus_graph.graphml")
graph = nx.read_graphml(GRAPH_PATH)

# GraphML stores every attribute as a string, so cast the ones we use.
for node_id, data in graph.nodes(data=True):
    data["x"] = float(data["x"])  # longitude
    data["y"] = float(data["y"])  # latitude

for u, v, data in graph.edges(data=True):
    length = float(data.get("length", 0.0))
    penalty = float(data.get("safety_penalty", 0.0))
    data["length"] = length
    # blended cost: real walking distance + a safety surcharge
    data["safe_cost"] = length + SAFETY_WEIGHT * penalty

# ─── Static campus data (markers + pickable destinations) ────────────
# Named places a user can route to. Routing snaps each lat/lng to the
# nearest real graph node, so these don't have to sit exactly on a path.
LOCATIONS = [
    {"id": "library",  "name": "MD Anderson Library", "lat": 29.7210, "lng": -95.3420},
    {"id": "studentc", "name": "Student Center",       "lat": 29.7197, "lng": -95.3432},
    {"id": "science",  "name": "Science Building",     "lat": 29.7220, "lng": -95.3415},
    {"id": "cougarv",  "name": "Cougar Village",       "lat": 29.7178, "lng": -95.3408},
    {"id": "stadium",  "name": "TDECU Stadium",        "lat": 29.7235, "lng": -95.3445},
    {"id": "garage",   "name": "Parking Garage",       "lat": 29.7188, "lng": -95.3398},
    {"id": "bauer",    "name": "CT Bauer College",     "lat": 29.7205, "lng": -95.3410},
    {"id": "plaza",    "name": "Cullen Family Plaza",  "lat": 29.7215, "lng": -95.3435},
    {"id": "moody",     "name": "Moody Towers",        "lat": 29.7173, "lng": -95.3416},
    {"id": "welcome",  "name": "UH Welcome Center",    "lat": 29.7193, "lng": -95.3425},
]

# Blue light emergency phones (lat, lng) — used as map markers.
# Keep this in sync with the BLUE_LIGHTS list in build_campus_graph.py.
BLUE_LIGHTS = [
    {"lat": 29.7210, "lng": -95.3420},
    {"lat": 29.7197, "lng": -95.3432},
    {"lat": 29.7178, "lng": -95.3408},
    {"lat": 29.7188, "lng": -95.3398},
    {"lat": 29.7215, "lng": -95.3435},
    {"lat": 29.7193, "lng": -95.3425},
]


# ─── Helpers ─────────────────────────────────────────────────────────
def haversine_m(lat1, lng1, lat2, lng2):
    """Straight-line distance in meters between two lat/lng points."""
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def nearest_node(lat, lng):
    """Find the graph node closest to a given coordinate."""
    best_id = None
    best_dist = float("inf")
    for node_id, data in graph.nodes(data=True):
        d = haversine_m(lat, lng, data["y"], data["x"])
        if d < best_dist:
            best_dist = d
            best_id = node_id
    return best_id


def build_route(start_lat, start_lng, end_lat, end_lng, weight_attr):
    """Snap start/end to the graph, run Dijkstra, return a list of lat/lng points."""
    origin = nearest_node(start_lat, start_lng)
    destination = nearest_node(end_lat, end_lng)

    if origin is None or destination is None:
        return None

    try:
        node_ids = nx.shortest_path(graph, origin, destination, weight=weight_attr)
    except nx.NetworkXNoPath:
        return None

    path = []
    for node_id in node_ids:
        node = graph.nodes[node_id]
        path.append({"lat": node["y"], "lng": node["x"]})
    return path


# ─── API routes ──────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Pathly routing engine is running"}


@app.get("/locations")
def get_locations():
    return LOCATIONS


@app.get("/bluelights")
def get_bluelights():
    return BLUE_LIGHTS


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