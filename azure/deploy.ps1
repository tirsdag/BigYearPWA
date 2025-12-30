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

$STORAGE_KEY = az storage account keys list -n $STORAGE --query "[0].value" -o tsv
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv

# 5) Blob Container
Write-Host "[5/8] Creating blob container..." -ForegroundColor Green
az storage container create --name $BLOB_CONTAINER --account-name $STORAGE --account-key $STORAGE_KEY

# 6) Container Registry + Build
Write-Host "[6/8] Creating ACR and building image..." -ForegroundColor Green
az acr create --name $ACR --resource-group $RG --sku Basic
az acr build --registry $ACR --image bigyearpwa-backend:latest .\backend

$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# 7) Create Container App
Write-Host "[7/8] Creating Container App..." -ForegroundColor Green
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
    AZURE_STORAGE_CONNECTION_STRING=secretref:azureblobconn `
    AZURE_BLOB_CONTAINER="$BLOB_CONTAINER"

Write-Host ""
Write-Host "===== Deployment Complete! =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "[8/8] Your API URL:" -ForegroundColor Yellow
az containerapp show --name $APP --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
