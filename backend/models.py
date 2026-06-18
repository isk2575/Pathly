"""SQLAlchemy models for Pathly (PostgreSQL)."""
import enum
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Float, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────────
class Severity(str, enum.Enum):
    info = "info"        # blue  — informational (maintenance, closures)
    warning = "warning"  # amber — caution (suspicious activity, theft)
    danger = "danger"    # red   — urgent


class IncidentSource(str, enum.Enum):
    official = "official"  # posted by campus/admin
    user = "user"          # submitted via "Report an Issue"


class IncidentStatus(str, enum.Enum):
    pending = "pending"    # user report awaiting review — not shown on map yet
    active = "active"      # live alert, shown to everyone
    resolved = "resolved"  # cleared / expired


# ── Tables ───────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    display_name: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    saved_places: Mapped[List["SavedPlace"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reports: Mapped[List["Incident"]] = relationship(back_populates="reporter")
    routes: Mapped[List["RouteHistory"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # e.g. "moody"
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[Optional[str]] = mapped_column(String(40))  # dorm, dining, academic, parking…
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    saved_by: Mapped[List["SavedPlace"]] = relationship(back_populates="location", cascade="all, delete-orphan")


class BlueLight(Base):
    __tablename__ = "blue_lights"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Incident(Base):
    """Live safety alerts AND user-submitted reports share this table.
    Official posts come in as source=official, status=active.
    User reports come in as source=user, status=pending (until reviewed)."""
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(60))            # "Suspicious Activity", "Theft", …
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[Optional[str]] = mapped_column(Text)
    location_text: Mapped[Optional[str]] = mapped_column(String(160))  # "Near Parking Lot B"
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), default=Severity.warning)
    source: Mapped[IncidentSource] = mapped_column(Enum(IncidentSource), default=IncidentSource.official)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.active)
    reported_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    reporter: Mapped[Optional["User"]] = relationship(back_populates="reports")


class SavedPlace(Base):
    __tablename__ = "saved_places"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="saved_places")
    location: Mapped["Location"] = relationship(back_populates="saved_by")


class RouteHistory(Base):
    __tablename__ = "route_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    start_lat: Mapped[float] = mapped_column(Float)
    start_lng: Mapped[float] = mapped_column(Float)
    end_lat: Mapped[float] = mapped_column(Float)
    end_lng: Mapped[float] = mapped_column(Float)
    preference: Mapped[str] = mapped_column(String(20))  # "safest" | "fastest"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    user: Mapped[Optional["User"]] = relationship(back_populates="routes")