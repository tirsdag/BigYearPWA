# BigYearPWA Azure Container Apps Deployment Script
# Run this from the repo root: .\azure\deploy.ps1

# Ensure Azure CLI is in PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Variables
$RG = "rg-bigyearpwa-api"
$LOC = "northeurope"
$ENV = "bigyearpwa-env"
$APP = "app-bigyearpwa-api"
$ACR = "bigyearpwaacr"
$STORAGE = "bigyearpwastorage"
$FILESHARE = "bigyearpwa-sqlite"
$STORAGEMOUNT = "sqlitefiles"
$BLOB_CONTAINER = "bigyearpwa"
$CORS = "https://tirsdag.github.io,http://localhost:5173"

Write-Host "===== BigYearPWA Azure Deployment =====" -ForegroundColor Cyan
Write-Host "Resource Group: $RG" -ForegroundColor Yellow
Write-Host "Location: $LOC" -ForegroundColor Yellow
Write-Host "Container App: $APP" -ForegroundColor Yellow
Write-Host "Registry: $ACR" -ForegroundColor Yellow
Write-Host "Storage: $STORAGE" -ForegroundColor Yellow
Write-Host ""

# 1) Extension + Providers
Write-Host "[1/9] Installing Container Apps extension..." -ForegroundColor Green
az extension add -n containerapp --upgrade --allow-preview
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# 2) Resource Group
Write-Host "[2/9] Creating resource group..." -ForegroundColor Green
az group create --name $RG --location $LOC

# 3) Container Apps Environment
Write-Host "[3/9] Creating Container Apps environment..." -ForegroundColor Green
az containerapp env create --name $ENV --resource-group $RG --location $LOC

# 4) Storage Account
Write-Host "[4/9] Creating storage account..." -ForegroundColor Green
az storage account create `
  --resource-group $RG `
  --name $STORAGE `
  --location $LOC `
  --kind StorageV2 `
  --sku Standard_LRS `
  --enable-large-file-share

# 5) File Share
Write-Host "[5/9] Creating Azure Files share..." -ForegroundColor Green
az storage share-rm create `
  --resource-group $RG `
  --storage-account $STORAGE `
  --name $FILESHARE `
  --quota 1024 `
  --enabled-protocols SMB

$STORAGE_KEY = az storage account keys list -n $STORAGE --query "[0].value" -o tsv
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv

# 6) Blob Container
Write-Host "[6/9] Creating blob container..." -ForegroundColor Green
az storage container create --name $BLOB_CONTAINER --account-name $STORAGE --account-key $STORAGE_KEY

# 7) Link Azure Files to Container Apps Environment
Write-Host "[7/9] Linking Azure Files to Container Apps environment..." -ForegroundColor Green
az containerapp env storage set `
  --access-mode ReadWrite `
  --azure-file-account-name $STORAGE `
  --azure-file-account-key $STORAGE_KEY `
  --azure-file-share-name $FILESHARE `
  --storage-name $STORAGEMOUNT `
  --name $ENV `
  --resource-group $RG

# 8) Container Registry + Build
Write-Host "[8/9] Creating ACR and building image..." -ForegroundColor Green
az acr create --name $ACR --resource-group $RG --sku Basic
az acr build --registry $ACR --image bigyearpwa-backend:latest .\backend

$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# 9) Create Container App
Write-Host "[9/9] Creating Container App..." -ForegroundColor Green
az containerapp create `
  --name $APP `
  --resource-group $RG `
  --environment $ENV `
  --image "$ACR.azurecr.io/bigyearpwa-backend:latest" `
  --ingress external `
  --target-port 8000 `
  --min-replicas 1 `
  --max-replicas 1 `
  --registry-server "$ACR.azurecr.io" `
  --registry-username $ACR_USER `
  --registry-password $ACR_PASS `
  --secrets azureblobconn="$AZ_CONN" `
  --env-vars `
    PORT=8000 `
    CORS_ORIGINS="$CORS" `
    DATABASE_URL="sqlite:////data/app.db" `
    AZURE_STORAGE_CONNECTION_STRING=secretref:azureblobconn `
    AZURE_BLOB_CONTAINER="$BLOB_CONTAINER"

Write-Host ""
Write-Host "===== Deployment Complete! =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEP: Mount the Azure Files volume" -ForegroundColor Yellow
Write-Host "Run these commands:" -ForegroundColor Yellow
Write-Host "  az containerapp show --name $APP --resource-group $RG --output yaml > app.yaml" -ForegroundColor White
Write-Host "  # Edit app.yaml and merge snippet from azure/containerapp.mount.yaml" -ForegroundColor White
Write-Host "  az containerapp update --name $APP --resource-group $RG --yaml app.yaml" -ForegroundColor White
Write-Host ""
Write-Host "Your API URL:" -ForegroundColor Yellow
az containerapp show --name $APP --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
