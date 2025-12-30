import os
import re
from dataclasses import dataclass
from typing import Optional
from uuid import uuid4

from azure.core.exceptions import ResourceExistsError
from azure.storage.blob import BlobServiceClient


@dataclass(frozen=True)
class BlobConfig:
    connection_string: str
    container: str


def get_blob_config() -> Optional[BlobConfig]:
    conn = (os.getenv("AZURE_STORAGE_CONNECTION_STRING") or "").strip()
    container = (os.getenv("AZURE_BLOB_CONTAINER") or "").strip() or "bigyearpwa"

    if not conn:
        return None

    return BlobConfig(connection_string=conn, container=container)


def _safe_filename(name: str) -> str:
    base = (name or "").strip() or "file.bin"
    base = base.replace("\\", "/").split("/")[-1]
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    base = base.strip("._-") or "file.bin"
    return base[:120]


def make_blob_name(device_id: str, filename: str) -> str:
    safe = _safe_filename(filename)
    file_id = uuid4().hex
    return f"device/{device_id}/{file_id}-{safe}"


def get_container_client(config: BlobConfig):
    svc = BlobServiceClient.from_connection_string(config.connection_string)
    return svc.get_container_client(config.container)


def ensure_container_exists(config: BlobConfig) -> None:
    container = get_container_client(config)
    try:
        container.create_container()
    except ResourceExistsError:
        return
