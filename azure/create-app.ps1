# BigYearPWA - Create Container App (final step)

# Ensure Azure CLI is in PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Variables
$RG = "rg-bigyearpwa-api"
$ENV = "bigyearpwa-env"
$APP = "app-bigyearpwa-api"
$ACR = "bigyearpwaacr"
$STORAGE = "bigyearpwastorage"
$BLOB_CONTAINER = "bigyearpwa"
$CORS = "https://tirsdag.github.io,http://localhost:5173"

Write-Host "Creating Container App..." -ForegroundColor Green

# Get credentials
$AZ_CONN = az storage account show-connection-string -g $RG -n $STORAGE --query connectionString -o tsv
$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

# Create Container App
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
Write-Host "===== Container App Created! =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your API URL:" -ForegroundColor Yellow
az containerapp show --name $APP --resource-group $RG --query properties.configuration.ingress.fqdn -o tsv
Write-Host ""
Write-Host "NEXT STEP: Mount the Azure Files volume" -ForegroundColor Yellow
Write-Host "Run: .\azure\mount-files.ps1" -ForegroundColor White
