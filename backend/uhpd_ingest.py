#!/usr/bin/env python3
"""Ingest UHPD Daily Crime Log rows into Pathly's incidents table as
historical (resolved) incidents tagged 'official', geocoded by building name.

FORMAT: crime_rows.txt holds 7 lines per entry (one field per line):
  1 crime type        e.g. "Aggravated Assault"
  2 case number       e.g. "26-0786"
  3 report date       e.g. "6/16/2026"
  4 start datetime    e.g. "6/16/2026, 4:00:00 PM"
  5 end datetime      e.g. "6/16/2026, 4:00:00 PM"
  6 location          e.g. "Science and Teaching Lab"
  7 disposition       e.g. "Closed - Lack of Prosecution"

(crime_rows.txt is already pre-filtered to serious crimes, but the filters
below run again as a safety net.)

Run LOCALLY against the same DATABASE_URL the app uses:
  Windows PowerShell:  $env:DATABASE_URL="...";  python uhpd_ingest.py
  then add --commit to actually insert:           python uhpd_ingest.py --commit

Stored as: source=official, status=resolved (feeds historical routing & the
danger-zone heatmap, not the live map). created_at = occurrence date.
Dedup by case number embedded in the title.
"""
import os
import sys
from datetime import datetime, timezone

from uhpd_geocode import load_buildings, geocode_location

ROWS_FILE = os.path.join(os.path.dirname(__file__), "crime_rows.txt")
COMMIT = "--commit" in sys.argv

SKIP_DISPOSITIONS = {"information"}  # CSA/historical info-only entries

# ── serious-crimes filter (safety net; the file is already pre-filtered) ──
SERIOUS_KEYWORDS = [
    "assault", "aggravated", "sexual", "robbery", "burglary",
    "firearm", "weapon", "deadly", "discharge", "shooting", "gun",
    "terroristic", "threat", "stalking", "harassment", "kidnap",
    "indecent exposure", "homicide", "murder", "arson",
    "driving while intoxicated", "dwi", "reckless driving",
]


def is_serious(crime_type: str) -> bool:
    low = crime_type.lower()
    if "burglary" in low and "vehicle" in low:   # vehicle burglary = property crime
        return False
    return any(k in low for k in SERIOUS_KEYWORDS)


# ── severity mapping ─────────────────────────────────────────────────
SEVERITY_BY_KEYWORD = [
    ("danger",  ["assault", "aggravated", "sexual", "robbery", "firearm", "weapon",
                 "deadly", "discharge", "terroristic", "burglary", "kidnap", "homicide"]),
    ("warning", ["harassment", "stalking", "threat", "indecent", "intoxicat",
                 "reckless", "trespass", "mischief"]),
]
DEFAULT_SEVERITY = "warning"


def severity_for(crime_type: str) -> str:
    low = crime_type.lower()
    for sev, words in SEVERITY_BY_KEYWORD:
        if any(w in low for w in words):
            return sev
    return DEFAULT_SEVERITY


def parse_occurrence(dt_str: str):
    dt_str = (dt_str or "").strip()
    for fmt in ("%m/%d/%Y, %I:%M:%S %p", "%m/%d/%Y", "%m/%d/%Y %I:%M:%S %p"):
        try:
            return datetime.strptime(dt_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def parse_rows(text: str):
    """Split into 7-line records. Tolerant of blank lines and a trailing
    'The report is current as of ...' header line if present."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # drop any leading header line that isn't a crime entry
    if lines and lines[0].lower().startswith("the report is current"):
        lines = lines[1:]
    records = []
    for i in range(0, len(lines) - 6, 7):
        chunk = lines[i:i + 7]
        if len(chunk) < 7:
            break
        records.append({
            "type": chunk[0],
            "case": chunk[1],
            "report_date": chunk[2],
            "start_dt": chunk[3],
            "end_dt": chunk[4],
            "location": chunk[5],
            "disposition": chunk[6],
        })
    return records


def main():
    if not os.path.exists(ROWS_FILE):
        print(f"Paste crime-log rows into {ROWS_FILE} first (7 lines per entry).")
        return

    table = load_buildings()
    if not table:
        print("No building table found. Run overpass_buildings.py first.")
        return
    print(f"Loaded {len(table)} buildings for geocoding.")

    with open(ROWS_FILE, encoding="utf-8") as f:
        text = f.read()

    records = parse_rows(text)
    print(f"Parsed {len(records)} records.\n")

    geocoded, skipped = [], []
    for r in records:
        if r["disposition"].strip().lower() in SKIP_DISPOSITIONS:
            skipped.append((r, "information-only"))
            continue
        if not is_serious(r["type"]):
            skipped.append((r, "petty / not safety-critical"))
            continue
        hit = geocode_location(r["location"], table)
        if not hit:
            skipped.append((r, "unplaceable / off-campus"))
            continue
        occ = parse_occurrence(r["start_dt"]) or parse_occurrence(r["report_date"])
        geocoded.append({
            "case": r["case"], "type": r["type"], "location_text": r["location"],
            "lat": hit["lat"], "lng": hit["lng"], "matched": hit["matched"],
            "score": hit["score"], "severity": severity_for(r["type"]),
            "occurred_at": occ,
        })

    print(f"Geocoded {len(geocoded)}, skipped {len(skipped)}.\n")
    print("=== Geocoded (will be inserted) ===")
    for g in geocoded:
        when = g["occurred_at"].date().isoformat() if g["occurred_at"] else "?"
        print(f"  [{g['case']}] {g['type'][:26]:26s} {g['severity']:7s} {when}  "
              f"-> {g['matched']} ({g['score']})")
    if skipped:
        print("\n=== Skipped ===")
        for r, why in skipped:
            print(f"  [{r['case']}] {r['location'][:42]:42s}  ({why})")

    if not COMMIT:
        print("\nDry run. Re-run with --commit to insert into the DB.")
        return

    from database import SessionLocal
    from models import Incident, IncidentSource, IncidentStatus, Severity

    db = SessionLocal()
    inserted, deduped = 0, 0
    try:
        for g in geocoded:
            tag = f"[UHPD {g['case']}]"
            exists = db.query(Incident).filter(Incident.title.like(f"%{tag}%")).first()
            if exists:
                deduped += 1
                continue
            db.add(Incident(
                type=g["type"][:60],
                title=f"{g['type'][:140]} {tag}",
                description=f"UHPD Daily Crime Log. Location: {g['location_text']}.",
                location_text=g["location_text"][:160],
                lat=g["lat"], lng=g["lng"],
                severity=Severity(g["severity"]),
                source=IncidentSource.official,
                status=IncidentStatus.resolved,
                created_at=g["occurred_at"] or datetime.now(timezone.utc),
            ))
            inserted += 1
        db.commit()
        print(f"\nInserted {inserted} new UHPD incidents ({deduped} already existed).")
    except Exception as e:
        db.rollback()
        print(f"\nDB error, rolled back: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    main()