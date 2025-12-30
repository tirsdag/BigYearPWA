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

## Deploy as a container (Docker)

This backend is container-ready and can be hosted on any platform that runs OCI/Docker images:
- Azure Container Apps (recommended — see below)
- Google Cloud Run
- Fly.io
- Render
- Railway
- DigitalOcean App Platform
- AWS ECS/Fargate

Build locally:

```bash
cd backend
docker build -t bigyearpwa-backend:local .
```

Run locally:

```bash
docker run --rm -p 8000:8000 \
  -e DATABASE_URL="sqlite:///./app.db" \
  -e CORS_ORIGINS="http://localhost:5173" \
  bigyearpwa-backend:local
```

Notes:
- For production, use Postgres and set `DATABASE_URL` accordingly.
- Some hosts (e.g. Cloud Run) inject a `PORT` env var; the container respects `PORT`.

## Azure Container Apps (MVP)

This is a good MVP host for this backend on Azure.

Two storage concerns:
- **Lists/entries DB**: for an MVP with a few users, you can run **SQLite** on an **Azure Files** mount and keep the app pinned to **1 replica**.
  - If you ever want multiple replicas / scale-out, switch to Postgres.
- **User files**: store in **Azure Blob Storage** (enabled by `AZURE_STORAGE_CONNECTION_STRING`).

### Prereqs
- Install Azure CLI.
- Ensure the Container Apps extension is up-to-date: `az extension add -n containerapp --upgrade`

### One-time setup + deploy (PowerShell)

Fill in the variables and run from any PowerShell where you have `az` installed.

```powershell
# 1) Login + providers
az login
az extension add -n containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# 2) Names (pick your own)
$RG = "bigyearpwa-rg"
$LOC = "northeurope"
$ENV = "bigyearpwa-env"
$APP = "bigyearpwa-api"   # must be lowercase, <= 32 chars
$ACR = "bigyearpwaacr"    # must be globally unique, lowercase

$STORAGE = "bigyearpwastorage"  # must be globally unique, lowercase
$FILESHARE = "bigyearpwa-sqlite"
$STORAGEMOUNT = "sqlitefiles"   # name of the env storage link

$BLOB_CONTAINER = "bigyearpwa"

# IMPORTANT: set this to your frontend origin(s)
# CORS origins are scheme+host only (no path). For GitHub Pages,
# use https://<username>.github.io (NOT https://<username>.github.io/<repo>).
$CORS = "https://tirsdag.github.io,http://localhost:5173"

# 3) Resource group + Container Apps environment
az group create --name $RG --location $LOC
az containerapp env create --name $ENV --resource-group $RG --location $LOC

# 4) Storage account (used for BOTH Azure Files (SQLite) + Blob (user files))
az storage account create \
  --resource-group $RG \
  --name $STORAGE \
  --location $LOC \
  --kind StorageV2 \
  --sku Standard_LRS \
  --enable-large-file-share

az storage share-rm create \
  --resource-group $RG \
  --storage-account $STORAGE \
  --name $FILESHARE \
  --quota 1024 \
  --enabled-protocols SMB

$STORAGE_KEY = az storage account keys list -n $STORAGE --query "[0].value" -o tsv
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv

# Create the blob container for uploaded files
az storage container create --name $BLOB_CONTAINER --account-name $STORAGE --account-key $STORAGE_KEY

# 5) Link Azure Files share into the Container Apps environment
az containerapp env storage set \
  --access-mode ReadWrite \
  --azure-file-account-name $STORAGE \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name $FILESHARE \
  --storage-name $STORAGEMOUNT \
  --name $ENV \
  --resource-group $RG

# 6) Container registry + build image
az acr create --name $ACR --resource-group $RG --sku Basic
az acr build --registry $ACR --image bigyearpwa-backend:latest .\backend

$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# 7) Create the Container App (1 replica) with secrets + env vars
az containerapp create \
  --name $APP \
  --resource-group $RG \
  --environment $ENV \
  --image "$ACR.azurecr.io/bigyearpwa-backend:latest" \
  --ingress external \
  --target-port 8000 \
  --min-replicas 1 \
  --max-replicas 1 \
  --registry-server "$ACR.azurecr.io" \
  --registry-username $ACR_USER \
  --registry-password $ACR_PASS \
  --secrets azureblobconn="$AZ_CONN" \
  --env-vars \
    PORT=8000 \
    CORS_ORIGINS="$CORS" \
    DATABASE_URL="sqlite:////data/app.db" \
    AZURE_STORAGE_CONNECTION_STRING=secretref:azureblobconn \
    AZURE_BLOB_CONTAINER="$BLOB_CONTAINER"

# 8) Mount the Azure Files volume to /data (for SQLite)
az containerapp show --name $APP --resource-group $RG --output yaml > app.yaml

  # Merge the mount snippet from azure/containerapp.mount.yaml into app.yaml under `template:`
  # (replace <your-container-name> with the container name from app.yaml), then:

az containerapp update --name $APP --resource-group $RG --yaml app.yaml

# 9) Show the public URL
az containerapp show --name $APP --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
```

### YAML snippet for the Azure Files mount

Use the snippet in `azure/containerapp.mount.yaml`.

Notes:
- `storageName` must match the `--storage-name` you used with `az containerapp env storage set`.
- Keeping `minReplicas=maxReplicas=1` avoids SQLite multi-writer issues.

## Environment variables
- `DATABASE_URL`
  - Default: `sqlite:///./app.db`
  - For production with Postgres: e.g. `postgresql+psycopg://USER:PASS@HOST:5432/DBNAME`
- `CORS_ORIGINS`
  - Comma-separated list of allowed origins.
  - Example: `https://<your-gh-pages-site>,http://localhost:5173`
- `AZURE_STORAGE_CONNECTION_STRING`
  - If set, enables file storage endpoints backed by Azure Blob Storage.
- `AZURE_BLOB_CONTAINER`
  - Optional container name.
  - Default: `bigyearpwa`

## Frontend configuration

The frontend only uses the backend if `VITE_API_BASE_URL` is set at build time.

Examples:
- Local dev:
  - `VITE_API_BASE_URL=http://localhost:8000`
- Production (Azure Container Apps):
  - `VITE_API_BASE_URL=https://<your-container-app-fqdn>`

## API
- `GET /api/v1/healthz`
- `GET /api/v1/sync/full` (returns `{ lists, entries }`)
- `POST /api/v1/sync/full` (replaces all lists+entries for device)
- `GET /api/v1/files` (lists uploaded files for device)
- `POST /api/v1/files` (multipart upload; returns `blobName`)
- `GET /api/v1/files/{blob_name}` (download)
- `DELETE /api/v1/files/{blob_name}` (delete)

Request header required:
- `X-Device-Id: <uuid>`
