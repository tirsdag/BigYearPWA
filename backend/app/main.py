import json
import os
from typing import List

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, delete, select

from .db import engine, init_db
from .models import EntryRecord, ListRecord
from .schemas import FullSyncPayload, HealthResponse


def get_session():
    with Session(engine) as session:
        yield session


def get_device_id(x_device_id: str | None = Header(default=None)) -> str:
    device_id = (x_device_id or "").strip()
    if not device_id:
        raise HTTPException(status_code=400, detail="Missing X-Device-Id")
    if len(device_id) > 200:
        raise HTTPException(status_code=400, detail="Invalid X-Device-Id")
    return device_id


app = FastAPI(title="BigYearPWA API", version="0.1.0")

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["*"] ,
        allow_headers=["*"] ,
    )


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/api/v1/healthz", response_model=HealthResponse)
def healthz():
    return HealthResponse(ok=True)


@app.get("/api/v1/sync/full", response_model=FullSyncPayload)
def sync_full_get(
    device_id: str = Depends(get_device_id),
    session: Session = Depends(get_session),
):
    lists = session.exec(select(ListRecord).where(ListRecord.device_id == device_id)).all()
    entries = session.exec(select(EntryRecord).where(EntryRecord.device_id == device_id)).all()

    out_lists = []
    for l in lists:
        try:
            classes = json.loads(l.species_classes_json) if l.species_classes_json else []
            if not isinstance(classes, list):
                classes = []
        except Exception:
            classes = []

        out_lists.append(
            {
                "ListId": l.list_id,
                "Name": l.name,
                "CreatedAt": l.created_at,
                "DimensionId": l.dimension_id,
                "SpeciesClasses": [str(x) for x in classes],
            }
        )

    out_entries = []
    for e in entries:
        out_entries.append(
            {
                "EntryId": e.entry_id,
                "ListId": e.list_id,
                "SpeciesId": e.species_id,
                "Seen": bool(e.seen),
                "SeenAt": e.seen_at,
                "ReferenceLink": e.reference_link,
                "Comment": e.comment,
            }
        )

    return {"lists": out_lists, "entries": out_entries}


@app.post("/api/v1/sync/full")
def sync_full_post(
    payload: FullSyncPayload,
    device_id: str = Depends(get_device_id),
    session: Session = Depends(get_session),
):
    # Replace-all strategy (MVP).
    # This keeps the client simple and works well for a single-device user.

    session.exec(delete(EntryRecord).where(EntryRecord.device_id == device_id))
    session.exec(delete(ListRecord).where(ListRecord.device_id == device_id))

    for l in payload.lists:
        session.add(
            ListRecord(
                device_id=device_id,
                list_id=str(l.ListId),
                name=str(l.Name),
                created_at=str(l.CreatedAt),
                dimension_id=str(l.DimensionId),
                species_classes_json=json.dumps([str(x) for x in (l.SpeciesClasses or [])]),
            )
        )

    for e in payload.entries:
        session.add(
            EntryRecord(
                device_id=device_id,
                entry_id=str(e.EntryId),
                list_id=str(e.ListId),
                species_id=str(e.SpeciesId),
                seen=bool(e.Seen),
                seen_at=e.SeenAt,
                reference_link=e.ReferenceLink,
                comment=e.Comment,
            )
        )

    session.commit()
    return {"ok": True}
