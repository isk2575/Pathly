#!/usr/bin/env python3
"""Export the campus graph's walkable edges as a lightweight GeoJSON-ish JS
file for the frontend's night-map 'Lit Pathways' glow layer.

Run this LOCALLY (needs the graphml + networkx, same as build_campus_graph.py):

    pip install networkx
    python export_lit_paths.py

It reads campus_graph.graphml, pulls every edge's two endpoint coordinates,
and writes ../src/lit_paths.js as an array of [[lng,lat],[lng,lat]] segments.
The frontend draws a soft warm glow along these — the walkable network at
night. (Honest framing: these are the walkable paths, shown as "lit pathways";
swap in real UH Facilities lamp data later without touching the visual layer.)
"""
import json
import networkx as nx

GRAPH_FILE = "campus_graph.graphml"
OUT_FILE = "../src/lit_paths.js"


def node_coord(g, n):
    """Return [lng, lat] for a node, tolerant of attribute naming."""
    d = g.nodes[n]
    # graphml stores everything as strings; handle common key names
    lat = d.get("y") or d.get("lat") or d.get("latitude")
    lng = d.get("x") or d.get("lng") or d.get("lon") or d.get("longitude")
    if lat is None or lng is None:
        return None
    return [float(lng), float(lat)]


def main():
    print(f"Reading {GRAPH_FILE}...")
    g = nx.read_graphml(GRAPH_FILE)
    print(f"Graph: {g.number_of_nodes()} nodes, {g.number_of_edges()} edges")

    segments = []
    skipped = 0
    for u, v in g.edges():
        a = node_coord(g, u)
        b = node_coord(g, v)
        if a is None or b is None:
            skipped += 1
            continue
        segments.append([a, b])

    print(f"Exported {len(segments)} edge segments ({skipped} skipped for missing coords).")

    # write as a JS module the frontend can import
    with open(OUT_FILE, "w") as f:
        f.write("// Walkable campus path segments from campus_graph.graphml.\n")
        f.write("// Each item is [[lng,lat],[lng,lat]] — drawn as the night-map\n")
        f.write("// 'Lit Pathways' glow. Regenerate with backend/export_lit_paths.py.\n")
        f.write("export const litPaths = ")
        json.dump(segments, f, separators=(",", ":"))
        f.write(";\n")

    print(f"Wrote {OUT_FILE}")
    if not segments:
        print("\n0 segments — check that node coords use x/y or lat/lng attributes.")


if __name__ == "__main__":
    main()