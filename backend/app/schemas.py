from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ListDto(BaseModel):
    ListId: str
    Name: str
    CreatedAt: str
    DimensionId: str
    SpeciesClasses: List[str] = Field(default_factory=list)


class EntryDto(BaseModel):
    EntryId: str
    ListId: str
    SpeciesId: str

    Seen: bool
    SeenAt: Optional[str] = None

    ReferenceLink: Optional[str] = None
    Comment: Optional[str] = None


class FullSyncPayload(BaseModel):
    lists: List[ListDto] = Field(default_factory=list)
    entries: List[EntryDto] = Field(default_factory=list)


class HealthResponse(BaseModel):
    ok: bool
