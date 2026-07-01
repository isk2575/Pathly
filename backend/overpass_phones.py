#!/usr/bin/env python3
"""Pull UH emergency callboxes ("blue lights") from OpenStreetMap and emit
them in Pathly's blueLightPhones format.

Run this LOCALLY (the Overpass API isn't reachable from the build sandbox):

    pip install requests
    python overpass_phones.py

It queries every node tagged emergency=phone inside a box around UH, then
writes blue_lights.js. Heads up: OSM coverage is community-contributed and
almost certainly PARTIAL versus UH's ~240 official callboxes — so treat this
as a real-but-incomplete starting set. The authoritative full list comes from
UHPD / Facilities GIS (see the outreach email).
"""
import requests

# Bounding box around UH main campus: south, west, north, east
SOUTH, WEST, NORTH, EAST = 29.7110, -95.3500, 29.7290, -95.3350

QUERY = f"""
[out:json][timeout:30];
(
  node["emergency"="phone"]({SOUTH},{WEST},{NORTH},{EAST});
);
out body;
"""

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"


def main():
    print("Querying OpenStreetMap (Overpass) for emergency phones around UH...")
    resp = requests.post(
    OVERPASS_URL,
    data={"data": QUERY},
    headers={"User-Agent": "Pathly/1.0 (campus safety project)"},
    timeout=90,
    )
    resp.raise_for_status()
    elements = resp.json().get("elements", [])

    phones = [
        {"lat": el["lat"], "lng": el["lon"]}
        for el in elements
        if el.get("type") == "node" and "lat" in el and "lon" in el
    ]
    print(f"Found {len(phones)} emergency phone(s) in OSM within the UH box.")

    lines = [
        "// Emergency callbox locations from OpenStreetMap (emergency=phone).",
        "// NOTE: OSM coverage is likely partial vs UH's ~240 official callboxes.",
        "// For the full set, request the dataset from UHPD / Facilities GIS.",
        "export const blueLightPhones = [",
    ]
    for p in phones:
        lines.append(f"  {{ lat: {p['lat']}, lng: {p['lng']} }},")
    lines.append("];")
    lines.append("")

    with open("blue_lights.js", "w") as f:
        f.write("\n".join(lines))
    print("Wrote blue_lights.js")

    if not phones:
        print("\nNo phones found — OSM may not have UH's callboxes mapped yet.")
        print("Fallbacks: request the official set from UHPD/Facilities GIS,")
        print("or map them yourself in the OSM iD editor (tag emergency=phone).")


if __name__ == "__main__":
    main()