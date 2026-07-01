#!/usr/bin/env python3
"""Pull UH campus buildings from OpenStreetMap to seed the building->coords
lookup the UHPD crime-log geocoder needs.

Run LOCALLY (Overpass isn't reachable from the build sandbox):
    pip install requests
    python overpass_buildings.py

Queries every named building/feature inside the UH box, then writes
uh_buildings.json: { "normalized name": {lat, lng, osm_name}, ... }.

OSM won't have every UH building, and names won't perfectly match the crime
log's wording — that's expected. This gets us most of the way; the matcher
(Part B) handles fuzzy matching and we hand-fill gaps in uh_buildings_extra.json.
"""
import json
import re
import requests

# UH main campus bounding box: south, west, north, east
SOUTH, WEST, NORTH, EAST = 29.7100, -95.3520, 29.7300, -95.3330

# named buildings, plus amenities/places that show up as incident locations
QUERY = f"""
[out:json][timeout:90];
(
  way["building"]["name"]({SOUTH},{WEST},{NORTH},{EAST});
  relation["building"]["name"]({SOUTH},{WEST},{NORTH},{EAST});
  node["amenity"]["name"]({SOUTH},{WEST},{NORTH},{EAST});
  way["amenity"]["name"]({SOUTH},{WEST},{NORTH},{EAST});
  way["leisure"]["name"]({SOUTH},{WEST},{NORTH},{EAST});
);
out center tags;
"""

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
HEADERS = {"User-Agent": "Pathly-CampusSafety/1.0 (student project; github.com/isk2575)"}


def normalize(name: str) -> str:
    """Lowercase, strip punctuation, collapse spaces — for matching keys."""
    n = name.lower().strip()
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def main():
    print("Querying OpenStreetMap (Overpass) for UH buildings...")
    resp = requests.post(OVERPASS_URL, data={"data": QUERY}, headers=HEADERS, timeout=120)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])

    buildings = {}
    for el in elements:
        name = el.get("tags", {}).get("name")
        if not name:
            continue
        # coordinates: nodes have lat/lon; ways/relations have 'center'
        if "lat" in el and "lon" in el:
            lat, lng = el["lat"], el["lon"]
        elif "center" in el:
            lat, lng = el["center"]["lat"], el["center"]["lon"]
        else:
            continue

        key = normalize(name)
        if key and key not in buildings:
            buildings[key] = {"lat": lat, "lng": lng, "osm_name": name}

    print(f"Found {len(buildings)} named buildings/places in OSM.")

    with open("uh_buildings.json", "w") as f:
        json.dump(buildings, f, indent=2, sort_keys=True)
    print("Wrote uh_buildings.json")

    # show a sample so you can eyeball coverage
    print("\nSample of what was found:")
    for k in list(buildings)[:15]:
        print(f"  {k}  ->  ({buildings[k]['lat']:.5f}, {buildings[k]['lng']:.5f})  [{buildings[k]['osm_name']}]")

    if len(buildings) < 20:
        print("\nNote: sparse coverage. We'll lean more on the hand-filled")
        print("uh_buildings_extra.json for buildings OSM is missing.")


if __name__ == "__main__":
    main()