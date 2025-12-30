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
$FILESHARE = "bigyearpwa-sqlite"
$STORAGEMOUNT = "sqlitefiles"
$BLOB_CONTAINER = "bigyearpwa"
$CORS = "https://tirsdag.github.io,http://localhost:5173"

Write-Host "===== Continuing BigYearPWA Deployment =====" -ForegroundColor Cyan

# Get storage key and connection string (already created)
Write-Host "Retrieving storage credentials..." -ForegroundColor Green
$STORAGE_KEY = az storage account keys list -n $STORAGE --query "[0].value" -o tsv
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv

# Step 7: Link Azure Files to Container Apps Environment
Write-Host "[7/9] Linking Azure Files to Container Apps environment..." -ForegroundColor Green
az containerapp env storage set `
  --access-mode ReadWrite `
  --azure-file-account-name $STORAGE `
  --azure-file-account-key $STORAGE_KEY `
  --azure-file-share-name $FILESHARE `
  --storage-name $STORAGEMOUNT `
  --name $ENV `
  --resource-group $RG

# Step 8: Create ACR and build image
Write-Host "[8/9] Creating ACR and building image..." -ForegroundColor Green
az acr create --name $ACR --resource-group $RG --sku Basic
az acr build --registry $ACR --image bigyearpwa-backend:latest .\backend

$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# Step 9: Create Container App
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
