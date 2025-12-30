# BigYearPWA Azure Deployment - Continue from failures
# Run after providers are registered

# Ensure Azure CLI is in PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Variables (must match deploy.ps1)
$RG = "rg-bigyearpwa-api"
$LOC = "northeurope"
$ENV = "bigyearpwa-env"
$APP = "app-bigyearpwa-api"
$ACR = "bigyearpwaacr"
$STORAGE = "bigyearpwastorage"
$BLOB_CONTAINER = "bigyearpwa"
$CORS = "https://tirsdag.github.io,http://localhost:5173"

Write-Host "===== Continuing BigYearPWA Deployment =====" -ForegroundColor Cyan

# Get storage key and connection string (already created)
Write-Host "Retrieving storage credentials..." -ForegroundColor Green
$STORAGE_KEY = az storage account keys list -n $STORAGE --query "[0].value" -o tsv
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv

# Step 7: Create ACR and build image
Write-Host "[7/8] Creating ACR and building image..." -ForegroundColor Green
az acr create --name $ACR --resource-group $RG --sku Basic
az acr build --registry $ACR --image bigyearpwa-backend:latest .\backend

$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# Step 8: Create Container App
Write-Host "[8/8] Creating Container App..." -ForegroundColor Green
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
Write-Host "Your API URL:" -ForegroundColor Yellow
az containerapp show --name $APP --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
