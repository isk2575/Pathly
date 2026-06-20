"""
Rebuild Pathly's campus walking graph from REAL OpenStreetMap pedestrian paths.

Why: the old hand-placed graph had sparse nodes that didn't sit on real
sidewalks, so routes cut across awkwardly. OSM gives the actual footways,
paths, and walkable streets, so the route follows real paths.

Run this LOCALLY (it needs internet to pull OSM data):

    pip install osmnx
    python build_campus_graph.py

Then commit the regenerated campus_graph.graphml and redeploy the backend.

NOTE: osmnx is only needed to BUILD the graph. The running API only needs
networkx to read the .graphml — so do NOT add osmnx to requirements.txt.
"""

import osmnx as ox
from math import radians, sin, cos, atan2, sqrt

# ── Campus area ──────────────────────────────────────────────────────
UH_CENTER = (29.7199, -95.3422)   # (lat, lng) — centre of UH main campus
RADIUS_M = 1000                   # how far around the centre to pull paths

# Your blue-light phone locations (same ones used in the app).
# Edges far from any blue light are treated as slightly less safe.
BLUE_LIGHTS = [
    (29.7210, -95.3420),
    (29.7197, -95.3432),
    (29.7220, -95.3415),
    (29.7178, -95.3408),
    (29.7235, -95.3445),
    (29.7188, -95.3398),
]

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
    # 1. Pull the REAL walking network (footways, paths, walkable streets).
    #    simplify=False keeps every path node, so edges are short straight
    #    segments that hug the actual paths — that's what fixes the awkward,
    #    cut-across look.
    print("Downloading walking network around UH...")
    graph = ox.graph_from_point(
        UH_CENTER,
        dist=RADIUS_M,
        network_type="walk",
        simplify=False,
        truncate_by_edge=True,
    )

    # 2. Tag each edge with a safety_penalty from blue-light proximity.
    #    (Live incidents are applied at request time, so they are NOT baked in.)
    for u, v, k, data in graph.edges(keys=True, data=True):
        u_lat, u_lng = graph.nodes[u]["y"], graph.nodes[u]["x"]
        v_lat, v_lng = graph.nodes[v]["y"], graph.nodes[v]["x"]
        mid_lat = (u_lat + v_lat) / 2.0
        mid_lng = (u_lng + v_lng) / 2.0

        bl_dist = nearest_bluelight_m(mid_lat, mid_lng)
        if bl_dist <= SAFE_RADIUS_M:
            penalty = 0.0
        else:
            penalty = min((bl_dist - SAFE_RADIUS_M) / 12.0, MAX_PENALTY)

        data["safety_penalty"] = round(penalty, 2)
        # 'length' (metres) is already added by osmnx, which main.py reads as-is.

    # 3. Save. ox.save_graphml writes a .graphml that networkx can read,
    #    and main.py loads it unchanged (it reads x, y, length, safety_penalty).
    ox.save_graphml(graph, "campus_graph.graphml")
    print(
        f"Saved campus_graph.graphml — "
        f"{graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges"
    )


if __name__ == "__main__":
    main()