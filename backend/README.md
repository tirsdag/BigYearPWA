# BigYearPWA backend (FastAPI)

This backend persists user-owned BigYear lists and entries.

## Design (MVP)
- Each iPhone device is treated as a "user".
- The frontend sends `X-Device-Id` (a UUID stored in `localStorage`).
- The backend stores data per `device_id`.

Persistence model (Blob-only):
- The full sync payload is stored as one JSON document per device at `device/{deviceId}/sync/full.json`.
- Uploaded files are stored under `device/{deviceId}/...`.

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
# set CORS_ORIGINS=http://localhost:5173

uvicorn app.main:app --reload --port 8000
```

## Deploy to Azure Container Apps (MVP)

The MVP deployment uses:
- **Azure Container Apps** to host the FastAPI backend
- **Azure Blob Storage** for user-uploaded files and sync payloads (private per device)

This setup is offline-first friendly: the PWA works fully offline with IndexedDB, and optionally syncs to the backend when online.

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
$BLOB_CONTAINER = "bigyearpwa"

# IMPORTANT: set this to your frontend origin(s)
# CORS origins are scheme+host only (no path). For GitHub Pages,
# use https://<username>.github.io (NOT https://<username>.github.io/<repo>).
$CORS = "https://tirsdag.github.io,http://localhost:5173"

# 3) Resource group + Container Apps environment
az group create --name $RG --location $LOC
az containerapp env create --name $ENV --resource-group $RG --location $LOC

# 4) Storage account (Blob only)
az storage account create \
  --resource-group $RG \
  --name $STORAGE \
  --location $LOC \
  --kind StorageV2 \
  --sku Standard_LRS \
  --enable-large-file-share

$STORAGE_KEY = az storage account keys list -n $STORAGE --query "[0].value" -o tsv
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv

# Create the blob container for uploaded files
az storage container create --name $BLOB_CONTAINER --account-name $STORAGE --account-key $STORAGE_KEY

# 5) Container registry + build image
az acr create --name $ACR --resource-group $RG --sku Basic
az acr build --registry $ACR --image bigyearpwa-backend:latest .\backend

$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# 6) Create the Container App (1 replica) with secrets + env vars
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
    AZURE_STORAGE_CONNECTION_STRING=secretref:azureblobconn \
    AZURE_BLOB_CONTAINER="$BLOB_CONTAINER"

# 7) Show the public URL
az containerapp show --name $APP --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
```

## Environment variables
- `CORS_ORIGINS`
  - Comma-separated list of allowed origins.
  - Example: `https://<your-gh-pages-site>,http://localhost:5173`
- `AZURE_STORAGE_CONNECTION_STRING`
  - Enables storage endpoints backed by Azure Blob Storage.
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
