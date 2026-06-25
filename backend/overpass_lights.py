#!/usr/bin/env python3
"""Pull UH street lights from OpenStreetMap and emit them in Pathly's
campusLights format (for the glowing night-map layer).

Run this LOCALLY (the Overpass API isn't reachable from the build sandbox):

    pip install requests
    python overpass_lights.py

It queries every node tagged highway=street_lamp inside a box around UH,
then writes campus_lights.js.

Heads up: OSM streetlight coverage is community-contributed and may be
PARTIAL (some campuses are mapped thoroughly, some barely). The count this
prints tells us how good the data is:
  - lots of lamps (100+)  -> real glowing dots look like a lit campus
  - sparse (a handful)    -> still real, but we may supplement visually
The authoritative full set would come from UH Facilities GIS.
"""
import requests

# Bounding box around UH main campus: south, west, north, east
SOUTH, WEST, NORTH, EAST = 29.7110, -95.3500, 29.7290, -95.3350

QUERY = f"""
[out:json][timeout:60];
(
  node["highway"="street_lamp"]({SOUTH},{WEST},{NORTH},{EAST});
);
out body;
"""

# Use the kumi mirror + a User-Agent — the main endpoint 406'd last time.
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
HEADERS = {"User-Agent": "Pathly-CampusSafety/1.0 (student project; contact via github.com/isk2575)"}


def main():
    print("Querying OpenStreetMap (Overpass) for street lamps around UH...")
    resp = requests.post(OVERPASS_URL, data={"data": QUERY}, headers=HEADERS, timeout=120)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])

    lights = [
        {"lat": el["lat"], "lng": el["lon"]}
        for el in elements
        if el.get("type") == "node" and "lat" in el and "lon" in el
    ]
    print(f"Found {len(lights)} street lamp(s) in OSM within the UH box.")

    lines = [
        "// Street-lamp locations from OpenStreetMap (highway=street_lamp).",
        "// Used by the night-map 'Campus Lights' glow layer.",
        "// NOTE: OSM coverage may be partial; full set would come from UH Facilities GIS.",
        "export const campusLights = [",
    ]
    for p in lights:
        lines.append(f"  {{ lat: {p['lat']}, lng: {p['lng']} }},")
    lines.append("];")
    lines.append("")

    with open("../src/campus_lights.js", "w") as f:
        f.write("\n".join(lines))
    print("Wrote ../src/campus_lights.js")

    if not lights:
        print("\n0 lamps found. OSM has no street_lamp data for this box.")
        print("Options: widen the box, or we generate lit-corridor glow along")
        print("the footpath geometry instead (decorative, not real lamp points).")


if __name__ == "__main__":
    main()