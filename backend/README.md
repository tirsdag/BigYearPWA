# BigYearPWA backend (FastAPI)

This backend persists user-owned BigYear lists and entries.

## Design (MVP)
- Each iPhone device is treated as a "user".
- The frontend sends `X-Device-Id` (a UUID stored in `localStorage`).
- The backend stores data per `device_id`.

This avoids building login UI initially. If you want real multi-device accounts later, we can add auth (email+password/JWT or Apple Sign-In) and map devices to users.

## Run locally

From the repo root (recommended):

```bash
npm run dev:api
```

This uses the repo venv at `.venv` and starts:
- `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`

Or run directly inside `backend/`:

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt

# Optional:
# set DATABASE_URL=sqlite:///./app.db
# set CORS_ORIGINS=http://localhost:5173

uvicorn app.main:app --reload --port 8000
```

## Deploy on FastAPI Cloud (high level)

1. Create a new FastAPI Cloud app and point it at this repository.
2. Set the app root / working directory to `backend/` (so it can see `requirements.txt`).
3. Set the start command to:
  - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Configure environment variables:
  - `DATABASE_URL` (Postgres recommended for production)
  - `CORS_ORIGINS` (include your GitHub Pages / custom domain)

Then copy your FastAPI Cloud public URL into the frontend as `VITE_API_BASE_URL`.

## Environment variables
- `DATABASE_URL`
  - Default: `sqlite:///./app.db`
  - For Postgres (FastAPI Cloud): e.g. `postgresql+psycopg://USER:PASS@HOST:5432/DBNAME`
- `CORS_ORIGINS`
  - Comma-separated list of allowed origins.
  - Example: `https://<your-gh-pages-site>,http://localhost:5173`

## Frontend configuration

The frontend only uses the backend if `VITE_API_BASE_URL` is set at build time.

Examples:
- Local dev:
  - `VITE_API_BASE_URL=http://localhost:8000`
- Production:
  - `VITE_API_BASE_URL=https://<your-fastapi-cloud-app>`

## API
- `GET /api/v1/healthz`
- `GET /api/v1/sync/full` (returns `{ lists, entries }`)
- `POST /api/v1/sync/full` (replaces all lists+entries for device)

Request header required:
- `X-Device-Id: <uuid>`
