from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ListRecord(SQLModel, table=True):
    __tablename__ = "lists"

    device_id: str = Field(index=True, primary_key=True)
    list_id: str = Field(primary_key=True)

    name: str
    created_at: str
    dimension_id: str
    species_classes_json: str


class EntryRecord(SQLModel, table=True):
    __tablename__ = "entries"

    device_id: str = Field(index=True, primary_key=True)
    entry_id: str = Field(primary_key=True)

    list_id: str = Field(index=True)
    species_id: str

    seen: bool
    seen_at: Optional[str] = None

    reference_link: Optional[str] = None
    comment: Optional[str] = None
