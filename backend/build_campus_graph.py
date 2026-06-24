"""
Rebuild Pathly's campus walking graph from real OpenStreetMap pedestrian paths.

This keeps the graph SMALL (simplify=True) but stores each edge's real path
shape in a 'pts' attribute, so main.py can draw the route following the actual
curves instead of straight chords. Small fast graph + smooth accurate routes.

Run LOCALLY (needs internet for OSM):

    pip install osmnx
    python build_campus_graph.py

Then commit the regenerated campus_graph.graphml into backend/ and redeploy.
osmnx is only needed to BUILD the graph; the API only needs networkx to read it.
"""

import os
import re
import osmnx as ox
from math import radians, sin, cos, sqrt, atan2

# ── Campus area ──────────────────────────────────────────────────────
UH_CENTER = (29.7199, -95.3422)   # (lat, lng) — centre of UH main campus
RADIUS_M = 1500                   # simplify=True keeps this small, so 1500 is fine

# Blue-light phone locations come from the SAME file the frontend uses
# (src/blue_lights.js), so the map pins and the routing weights can never
# drift apart. Update the phones once, rebuild, and both stay in sync.
def load_bluelights():
    # path relative to THIS script, so it works no matter where it's run from
    js_path = os.path.join(os.path.dirname(__file__), "..", "src", "blue_lights.js")
    if not os.path.exists(js_path):
        raise FileNotFoundError(
            f"Could not find {js_path}. Adjust the path to wherever blue_lights.js lives."
        )
    text = open(js_path, "r", encoding="utf-8").read()
    # match { lat: 29.71.., lng: -95.34.. }
    pairs = re.findall(r"lat:\s*(-?\d+\.?\d*)\s*,\s*lng:\s*(-?\d+\.?\d*)", text)
    coords = [(float(la), float(ln)) for la, ln in pairs]
    if not coords:
        raise ValueError("No blue-light coordinates parsed from blue_lights.js")
    return coords


BLUE_LIGHTS = load_bluelights()

SAFE_RADIUS_M = 60.0    # within this distance of a blue light = no penalty
MAX_PENALTY = 60.0      # cap so one dark stretch can't dominate the cost


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def nearest_bluelight_m(lat, lng):
    return min(haversine_m(lat, lng, bl[0], bl[1]) for bl in BLUE_LIGHTS)


def main():
    # 1. Pull the real walking network. simplify=True => few nodes (intersections),
    #    with the real path shape kept as edge geometry.
    print("Downloading walking network around UH...")
    print(f"Loaded {len(BLUE_LIGHTS)} blue-light phones from blue_lights.js")
    graph = ox.graph_from_point(UH_CENTER, dist=RADIUS_M, network_type="walk")
    print(f"Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

    for u, v, k, data in graph.edges(keys=True, data=True):
        # 2. safety_penalty from blue-light proximity (incidents are applied live).
        u_lat, u_lng = graph.nodes[u]["y"], graph.nodes[u]["x"]
        v_lat, v_lng = graph.nodes[v]["y"], graph.nodes[v]["x"]
        mid_lat, mid_lng = (u_lat + v_lat) / 2.0, (u_lng + v_lng) / 2.0
        bl_dist = nearest_bluelight_m(mid_lat, mid_lng)
        if bl_dist <= SAFE_RADIUS_M:
            penalty = 0.0
        else:
            penalty = min((bl_dist - SAFE_RADIUS_M) / 12.0, MAX_PENALTY)
        data["safety_penalty"] = round(penalty, 2)

        # 3. Flatten the edge's real shape into "lat,lng;lat,lng;..." for drawing.
        #    osmnx stores curved edges as a shapely LineString in 'geometry';
        #    straight edges have none, so we fall back to the two endpoints.
        geom = data.get("geometry")
        if geom is not None:
            # shapely coords are (x=lng, y=lat)
            data["pts"] = ";".join(f"{y:.6f},{x:.6f}" for x, y in geom.coords)
        else:
            data["pts"] = f"{u_lat:.6f},{u_lng:.6f};{v_lat:.6f},{v_lng:.6f}"

        # 4. Drop the shapely geometry so graphml serializes cleanly (we have pts now).
        if "geometry" in data:
            del data["geometry"]

    ox.save_graphml(graph, "campus_graph.graphml")
    print(f"Saved campus_graph.graphml — {graph.number_of_nodes()} nodes")


if __name__ == "__main__":
    main()