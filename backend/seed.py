"""One-time seed: load campus locations, blue lights, and sample alerts.

Run locally (or once against the Azure DB):
    DATABASE_URL="postgresql+psycopg2://...:5432/pathly?sslmode=require" python seed.py

Safe to re-run: it skips tables that already have rows.
"""
from datetime import datetime, timedelta

from database import engine, SessionLocal, init_db
from models import Location, BlueLight, Incident, Severity, IncidentSource, IncidentStatus

LOCATIONS = [
    ("library",  "MD Anderson Library", "academic", 29.7210, -95.3420),
    ("studentc", "Student Center",      "campus",   29.7197, -95.3432),
    ("science",  "Science Building",    "academic", 29.7220, -95.3415),
    ("cougarv",  "Cougar Village",      "dorm",     29.7178, -95.3408),
    ("stadium",  "TDECU Stadium",       "athletics",29.7235, -95.3445),
    ("garage",   "Parking Garage",      "parking",  29.7188, -95.3398),
    ("bauer",    "CT Bauer College",    "academic", 29.7205, -95.3410),
    ("plaza",    "Cullen Family Plaza", "campus",   29.7215, -95.3435),
    ("moody",    "Moody Towers",        "dorm",     29.7173, -95.3416),  # corrected
    ("welcome",  "UH Welcome Center",   "campus",   29.7193, -95.3425),
]

BLUE_LIGHTS = [
    ("Blue Light - MD Anderson Library", 29.7210, -95.3420),
    ("Blue Light - Student Center",      29.7197, -95.3432),
    ("Blue Light - Science Building",    29.7220, -95.3415),
    ("Blue Light - Cougar Village",      29.7178, -95.3408),
    ("Blue Light - Athletics",           29.7235, -95.3445),
    ("Blue Light - Parking Garage",      29.7188, -95.3398),
]

SAMPLE_INCIDENTS = [
    ("Suspicious Activity", "Suspicious activity reported", "Near Parking Lot B",
     Severity.warning, 29.7188, -95.3398),
    ("Theft Report", "Bike theft reported", "Near Student Center",
     Severity.warning, 29.7197, -95.3432),
    ("Road Closed", "Pathway closed for repairs", "Near Engineering Building",
     Severity.danger, 29.7220, -95.3415),
    ("Maintenance", "Lighting maintenance in progress", "Pathway near Cougar Woods",
     Severity.info, 29.7178, -95.3408),
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        if db.query(Location).count() == 0:
            for slug, name, cat, lat, lng in LOCATIONS:
                db.add(Location(slug=slug, name=name, category=cat, lat=lat, lng=lng))
            print(f"Seeded {len(LOCATIONS)} locations")
        else:
            print("Locations already present — skipping")

        if db.query(BlueLight).count() == 0:
            for name, lat, lng in BLUE_LIGHTS:
                db.add(BlueLight(name=name, lat=lat, lng=lng, is_active=True))
            print(f"Seeded {len(BLUE_LIGHTS)} blue lights")
        else:
            print("Blue lights already present — skipping")

        if db.query(Incident).count() == 0:
            for itype, title, loc_text, sev, lat, lng in SAMPLE_INCIDENTS:
                db.add(Incident(
                    type=itype, title=title, location_text=loc_text,
                    severity=sev, source=IncidentSource.official,
                    status=IncidentStatus.active, lat=lat, lng=lng,
                    expires_at=datetime.utcnow() + timedelta(days=2),
                ))
            print(f"Seeded {len(SAMPLE_INCIDENTS)} incidents")
        else:
            print("Incidents already present — skipping")

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()