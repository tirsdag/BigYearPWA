import json
import os
from typing import List

from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel import Session, delete, select

from azure.storage.blob._models import ContentSettings

from .blob_storage import ensure_container_exists, get_blob_config, get_container_client, make_blob_name
from .db import engine, init_db
from .models import EntryRecord, ListRecord
from .schemas import FileListResponse, FullSyncPayload, HealthResponse


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

    # Optional: if Blob Storage is configured, ensure the container exists.
    # If it's not configured, file endpoints will respond with 503.
    cfg = get_blob_config()
    if cfg:
        ensure_container_exists(cfg)


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


def _require_blob_config():
    cfg = get_blob_config()
    if not cfg:
        raise HTTPException(
            status_code=503,
            detail="Blob storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING.",
        )
    return cfg


@app.get("/api/v1/files", response_model=FileListResponse)
def list_files(
    device_id: str = Depends(get_device_id),
):
    cfg = _require_blob_config()
    container = get_container_client(cfg)
    prefix = f"device/{device_id}/"

    out = []
    for b in container.list_blobs(name_starts_with=prefix):
        name = str(getattr(b, "name", ""))
        file_name = name.split("/")[-1]
        size = int(getattr(b, "size", 0) or 0)
        content_settings = getattr(b, "content_settings", None)
        content_type = getattr(content_settings, "content_type", None) if content_settings else None
        last_modified = getattr(b, "last_modified", None)
        out.append(
            {
                "blobName": name,
                "fileName": file_name,
                "size": size,
                "contentType": str(content_type) if content_type else None,
                "etag": str(getattr(b, "etag", None) or "") or None,
                "lastModified": last_modified.isoformat() if last_modified else None,
            }
        )

    out.sort(key=lambda x: (x.get("lastModified") or "", x.get("fileName") or ""), reverse=True)
    return {"files": out}


@app.post("/api/v1/files")
async def upload_file(
    file: UploadFile,
    device_id: str = Depends(get_device_id),
):
    cfg = _require_blob_config()
    container = get_container_client(cfg)

    blob_name = make_blob_name(device_id, file.filename or "file.bin")
    blob = container.get_blob_client(blob_name)

    data = await file.read()
    blob.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=file.content_type or "application/octet-stream"),
    )

    return {"ok": True, "blobName": blob_name}


@app.get("/api/v1/files/{blob_name:path}")
def download_file(
    blob_name: str,
    device_id: str = Depends(get_device_id),
):
    cfg = _require_blob_config()
    if not blob_name.startswith(f"device/{device_id}/"):
        raise HTTPException(status_code=404, detail="Not found")

    container = get_container_client(cfg)
    blob = container.get_blob_client(blob_name)
    downloader = blob.download_blob()
    props = blob.get_blob_properties()

    ct = None
    try:
        ct = props.content_settings.content_type
    except Exception:
        ct = None

    return StreamingResponse(
        downloader.chunks(),
        media_type=ct or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename=\"{blob_name.split('/')[-1]}\""},
    )


@app.delete("/api/v1/files/{blob_name:path}")
def delete_file(
    blob_name: str,
    device_id: str = Depends(get_device_id),
):
    cfg = _require_blob_config()
    if not blob_name.startswith(f"device/{device_id}/"):
        raise HTTPException(status_code=404, detail="Not found")

    container = get_container_client(cfg)
    blob = container.get_blob_client(blob_name)
    blob.delete_blob(delete_snapshots="include")
    return {"ok": True}
