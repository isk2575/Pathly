"""Pydantic schemas for request/response shapes."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LocationOut(BaseModel):
    id: int
    slug: str
    name: str
    category: Optional[str] = None
    lat: float
    lng: float

    class Config:
        from_attributes = True


class BlueLightOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    is_active: bool

    class Config:
        from_attributes = True


class IncidentOut(BaseModel):
    id: int
    type: str
    title: str
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    severity: str
    source: str
    status: str
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReportCreate(BaseModel):
    """Payload for the 'Report an Issue' feature."""
    type: str
    title: str
    description: Optional[str] = None
    location_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    severity: str = "warning"          # info | warning | danger
    firebase_uid: Optional[str] = None  # present if the reporter is signed in


class SavedPlaceCreate(BaseModel):
    firebase_uid: str
    location_id: int