"""
Run this ONCE on your laptop (not on Azure) to generate campus_graph.graphml.
Then commit that .graphml file alongside main.py so the backend loads it instantly.

    pip install osmnx
    python build_campus_graph.py
"""

import osmnx as ox
from math import radians, sin, cos, sqrt, atan2

# UH main campus center (lat, lng) and how far out to pull walkable paths
UH_CENTER = (29.7199, -95.3422)
RADIUS_M = 1500

# Your known blue light emergency phones (lat, lng).
# Edit these to match the real ones — accuracy of safety routing depends on it.
BLUE_LIGHTS = [
    (29.7210, -95.3420),
    (29.7197, -95.3432),
    (29.7178, -95.3408),
    (29.7188, -95.3398),
    (29.7215, -95.3435),
    (29.7193, -95.3425),
]


def haversine_m(lat1, lng1, lat2, lng2):
    """Straight-line distance in meters between two lat/lng points."""
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# 1. Pull the REAL walkable network around campus from OpenStreetMap.
print("Downloading UH walking network from OpenStreetMap...")
G = ox.graph_from_point(UH_CENTER, dist=RADIUS_M, network_type="walk")
print(f"Got {len(G.nodes)} nodes and {len(G.edges)} edges.")

# 2. For each edge, store the distance from its midpoint to the NEAREST blue light.
#    This is the raw safety signal: far from a light = higher penalty later.
for u, v, k, data in G.edges(keys=True, data=True):
    lat_u, lng_u = G.nodes[u]["y"], G.nodes[u]["x"]
    lat_v, lng_v = G.nodes[v]["y"], G.nodes[v]["x"]
    mid_lat = (lat_u + lat_v) / 2
    mid_lng = (lng_u + lng_v) / 2
    nearest = min(haversine_m(mid_lat, mid_lng, bl[0], bl[1]) for bl in BLUE_LIGHTS)
    data["safety_penalty"] = nearest

# 3. Save it so the backend can load it instantly, with NO live OSM call at startup.
ox.save_graphml(G, "campus_graph.graphml")
print("Saved campus_graph.graphml")

# 4. Draw it so you can eyeball coverage. This is your accuracy gate:
#    do the lines trace the real campus walkways, or are there big blank gaps?
try:
    ox.plot_graph(G, node_size=4, edge_linewidth=0.6, bgcolor="black")
except Exception as e:
    print(f"(Skipped plot: {e}) -- graph still saved fine.")