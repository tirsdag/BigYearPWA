import json
import os

from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContentSettings
from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .auth import get_user_id
from .blob_storage import ensure_container_exists, get_blob_config, get_container_client, make_blob_name
from .schemas import FileListResponse, FullSyncPayload, HealthResponse


def _sync_blob_name(user_id: str) -> str:
    # Store the entire replace-all payload as a single JSON document per user.
    return f"user/{user_id}/sync/full.json"


app = FastAPI(title="BigYearPWA API", version="0.1.0")

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("startup")
def _startup():
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
    user_id: str = Depends(get_user_id),
):
    cfg = _require_blob_config()
    container = get_container_client(cfg)
    blob = container.get_blob_client(_sync_blob_name(user_id))

    try:
        downloaded = blob.download_blob()
        data = downloaded.readall()
    except ResourceNotFoundError:
        return {"lists": [], "entries": []}

    try:
        raw = json.loads(data.decode("utf-8"))
    except Exception:
        return {"lists": [], "entries": []}

    lists = raw.get("lists") if isinstance(raw, dict) else None
    entries = raw.get("entries") if isinstance(raw, dict) else None
    return {
        "lists": lists if isinstance(lists, list) else [],
        "entries": entries if isinstance(entries, list) else [],
    }


@app.post("/api/v1/sync/full")
def sync_full_post(
    payload: FullSyncPayload,
    user_id: str = Depends(get_user_id),
):
    # Replace-all strategy (MVP).
    # Persist the entire payload as a single JSON document per user in Blob Storage.
    cfg = _require_blob_config()
    container = get_container_client(cfg)
    blob = container.get_blob_client(_sync_blob_name(user_id))

    body = json.dumps(payload.model_dump(), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    blob.upload_blob(
        body,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json; charset=utf-8"),
    )

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
    user_id: str = Depends(get_user_id),
):
    cfg = _require_blob_config()
    container = get_container_client(cfg)
    prefix = f"user/{user_id}/"

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
    user_id: str = Depends(get_user_id),
):
    cfg = _require_blob_config()
    container = get_container_client(cfg)

    blob_name = make_blob_name(user_id, file.filename or "file.bin")
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
    user_id: str = Depends(get_user_id),
):
    cfg = _require_blob_config()
    if not blob_name.startswith(f"user/{user_id}/"):
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
    user_id: str = Depends(get_user_id),
):
    cfg = _require_blob_config()
    if not blob_name.startswith(f"user/{user_id}/"):
        raise HTTPException(status_code=404, detail="Not found")

    container = get_container_client(cfg)
    blob = container.get_blob_client(blob_name)
    blob.delete_blob(delete_snapshots="include")
    return {"ok": True}
