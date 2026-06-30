#!/usr/bin/env python3
"""Match a messy UHPD crime-log location string to a lat/lng.

This is the brain of the UHPD pipeline. Real crime-log locations look like:
  "Science and Research 2 bike rack"
  "Moody Towers Grounds (East Sidewalk)"
  "Welcome Center Parking Garage"
  "Hampton Inn La Grange, TX"        <- off-campus, must be skipped
  "Public street at MLK and Calhoun" <- approximate, may not match a building

Strategy:
  1. Reject obvious off-campus rows.
  2. Strip modifiers ("bike rack", "garage", "grounds", parentheticals, etc.).
  3. Look up the cleaned name in the building table (exact, then fuzzy).
  4. Return (lat, lng, matched_name) or None if we can't place it confidently.

The building table = uh_buildings.json (from OSM) + uh_buildings_extra.json
(hand-filled). Extra overrides OSM so you can correct/add anything.
"""
import json
import os
import re
from difflib import SequenceMatcher

HERE = os.path.dirname(__file__)

# words/phrases that mean "this row isn't a campus building location"
OFF_CAMPUS_HINTS = [
    "la grange", "hampton inn", "off-campus", "off campus", " pd ",
    "another city", "houston pd",
]

# modifier words/phrases to strip — they describe a spot AT a building,
# not a different place. Order matters a little; we strip all of them.
MODIFIERS = [
    "bike rack", "bike racks", "parking garage", "garage", "parking lot",
    "parking", "lot", "grounds", "loading docks", "loading dock", "dock",
    "construction site", "sidewalk", "east sidewalk", "west sidewalk",
    "north sidewalk", "south sidewalk", "breezeway", "entrance", "lobby",
    "stairwell", "elevator", "courtyard", "plaza level", "bus stop",
]


def normalize(name: str) -> str:
    n = name.lower().strip()
    n = re.sub(r"\(.*?\)", " ", n)          # drop parentheticals: "(East Sidewalk)"
    n = re.sub(r"[^a-z0-9 ]", " ", n)        # punctuation -> space
    n = re.sub(r"\s+", " ", n).strip()
    return n


def load_buildings():
    table = {}
    for fname in ("uh_buildings.json", "uh_buildings_extra.json"):
        path = os.path.join(HERE, fname)
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            # extra overrides osm (loaded second)
            table.update(data)
    return table


def is_off_campus(raw: str) -> bool:
    low = f" {raw.lower()} "
    return any(h in low for h in OFF_CAMPUS_HINTS)


def strip_modifiers(name: str) -> str:
    n = name
    # strip each modifier as a whole word/phrase, repeatedly
    changed = True
    while changed:
        changed = False
        for m in MODIFIERS:
            pattern = r"\b" + re.escape(m) + r"\b"
            new = re.sub(pattern, " ", n)
            if new != n:
                n = new
                changed = True
    return re.sub(r"\s+", " ", n).strip()


def best_fuzzy(cleaned: str, table: dict, threshold: float = 0.78):
    """Closest building key by similarity ratio, if above threshold."""
    best_key, best_score = None, 0.0
    for key in table:
        score = SequenceMatcher(None, cleaned, key).ratio()
        # also reward containment ("moody" in "moody towers")
        if cleaned and (cleaned in key or key in cleaned):
            score = max(score, 0.9)
        if score > best_score:
            best_key, best_score = key, score
    if best_score >= threshold:
        return best_key, best_score
    return None, best_score


def geocode_location(raw: str, table: dict):
    """Return dict {lat, lng, matched, score, raw} or None if unplaceable."""
    if not raw or not raw.strip():
        return None
    if is_off_campus(raw):
        return None

    norm = normalize(raw)
    cleaned = strip_modifiers(norm) or norm  # if stripping emptied it, fall back

    # 1. exact hit on cleaned name
    if cleaned in table:
        b = table[cleaned]
        return {"lat": b["lat"], "lng": b["lng"], "matched": cleaned, "score": 1.0, "raw": raw}

    # 2. exact hit on the un-stripped normalized name
    if norm in table:
        b = table[norm]
        return {"lat": b["lat"], "lng": b["lng"], "matched": norm, "score": 1.0, "raw": raw}

    # 3. fuzzy
    key, score = best_fuzzy(cleaned, table)
    if key:
        b = table[key]
        return {"lat": b["lat"], "lng": b["lng"], "matched": key, "score": round(score, 2), "raw": raw}

    return None


if __name__ == "__main__":
    # self-test against the REAL location strings from the pasted crime log,
    # using a tiny fake building table so it runs without the OSM file.
    fake = {
        "campus recreation and wellness center": {"lat": 29.7185, "lng": -95.3410},
        "science and research 2": {"lat": 29.7176, "lng": -95.3433},
        "welcome center": {"lat": 29.7210, "lng": -95.3450},
        "tdecu stadium": {"lat": 29.7215, "lng": -95.3490},
        "moody towers": {"lat": 29.7220, "lng": -95.3400},
        "butler plaza": {"lat": 29.7195, "lng": -95.3420},
        "cougar place": {"lat": 29.7230, "lng": -95.3470},
        "the quad": {"lat": 29.7200, "lng": -95.3440},
        "university lofts": {"lat": 29.7250, "lng": -95.3460},
    }
    samples = [
        "Campus Recreation and Wellness Center",
        "Science and Research 2 bike rack",
        "Welcome Center Parking Garage",
        "TDECU Stadium bike rack",
        "Moody Towers Grounds (East Sidewalk)",
        "Butler Plaza bike rack",
        "Cougar Place",
        "The Quad (Bike Rack)",
        "University Lofts",
        "Hampton Inn La Grange, TX",       # should skip (off-campus)
        "Public street at MLK and Calhoun",# likely no match
    ]
    print("Matcher self-test on real crime-log strings:\n")
    for s in samples:
        r = geocode_location(s, fake)
        if r:
            print(f"  OK    '{s}'\n          -> {r['matched']}  ({r['lat']}, {r['lng']})  score={r['score']}")
        else:
            print(f"  SKIP  '{s}'  (off-campus or no confident match)")