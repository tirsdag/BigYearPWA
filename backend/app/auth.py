import json
import os
from functools import lru_cache

import firebase_admin
from fastapi import Header, HTTPException
from firebase_admin import auth, credentials


@lru_cache(maxsize=1)
def _get_firebase_app():
    """Initialize Firebase Admin once.

    Configure credentials using one of:
    - FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string)
    - GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS_PATH (path to service account JSON)
    - Application Default Credentials (managed identity / workload identity)
    """

    try:
        return firebase_admin.get_app()
    except ValueError:
        # Not initialized yet.
        pass

    sa_json = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    cred_path = (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("FIREBASE_CREDENTIALS_PATH") or "").strip()

    cred = None

    if sa_json:
        try:
            info = json.loads(sa_json)
        except Exception as exc:
            raise RuntimeError("Invalid FIREBASE_SERVICE_ACCOUNT_JSON") from exc
        cred = credentials.Certificate(info)
    elif cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        # Will work in environments with ADC configured.
        cred = credentials.ApplicationDefault()

    return firebase_admin.initialize_app(cred)


def get_user_id(authorization: str | None = Header(default=None)) -> str:
    """Authorize request via Firebase ID token.

    Expects:
      Authorization: Bearer <firebase-id-token>

    Returns Firebase uid.
    """

    raw = (authorization or "").strip()
    if not raw:
        raise HTTPException(status_code=401, detail="Missing Authorization")

    parts = raw.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization")

    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid Authorization")

    try:
        _get_firebase_app()
    except Exception:
        raise HTTPException(status_code=503, detail="Auth is not configured")

    try:
        decoded = auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uid = (decoded.get("uid") or decoded.get("sub") or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")

    if len(uid) > 200:
        raise HTTPException(status_code=401, detail="Invalid token")

    return uid
