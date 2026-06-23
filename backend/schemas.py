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
    photo_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    severity: str
    source: str
    status: str
    confirmation_count: int = 0
    comment_count: int = 0
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
    photo_url: Optional[str] = None     # Firebase Storage URL, set after upload
    lat: Optional[float] = None
    lng: Optional[float] = None
    severity: str = "warning"          # info | warning | danger
    firebase_uid: Optional[str] = None  # present if the reporter is signed in


class SavedPlaceCreate(BaseModel):
    firebase_uid: str
    location_id: int


class CommentOut(BaseModel):
    """A single comment in an alert's discussion thread."""
    id: int
    incident_id: int
    author_name: Optional[str] = None
    body: str
    created_at: datetime
    firebase_uid: Optional[str] = None  # lets the client mark "your" comments

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    """Payload when a signed-in student posts a comment on an alert."""
    body: str
    firebase_uid: str                   # required — only signed-in users can post
    author_name: Optional[str] = None   # display name (NOT email), e.g. Firebase displayName


class ConfirmResult(BaseModel):
    """Returned after a user confirms an alert."""
    incident_id: int
    confirmation_count: int
    status: str          # may flip to "active" once it crosses the threshold
    promoted: bool       # true on the vote that pushed a pending report live