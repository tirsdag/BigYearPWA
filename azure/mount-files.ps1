# BigYearPWA - Mount Azure Files for SQLite persistence

# Ensure Azure CLI is in PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Variables
$RG = "rg-bigyearpwa-api"
$APP = "app-bigyearpwa-api"
$CONTAINER_NAME = "app-bigyearpwa-api"  # From Container App creation

Write-Host "===== Mounting Azure Files to Container App =====" -ForegroundColor Cyan
Write-Host ""

# Export current app config
Write-Host "[1/3] Exporting current app configuration..." -ForegroundColor Green
az containerapp show --name $APP --resource-group $RG --output yaml > app.yaml

# Read the current YAML
Write-Host "[2/3] Adding Azure Files volume mount..." -ForegroundColor Green
$yaml = Get-Content app.yaml -Raw

# Replace "volumes: null" with actual volume configuration
$volumeConfig = @"
  volumes:
  - name: sqlite-data
    storageType: AzureFile
    storageName: sqlitefiles
"@

$yaml = $yaml -replace '\s+volumes:\s+null', "`n$volumeConfig"

# Add volumeMounts to the container (insert after "name: app-bigyearpwa-api")
$volumeMountConfig = @"
      volumeMounts:
      - volumeName: sqlite-data
        mountPath: /data
"@

# Find the container section and add volumeMounts after resources
$yaml = $yaml -replace '(?s)(name:\s+app-bigyearpwa-api\s+resources:.*?memory:\s+[^\n]+)', "`$1`n$volumeMountConfig"

# Save modified YAML
$yaml | Set-Content app.yaml -NoNewline

Write-Host "[3/3] Applying updated configuration..." -ForegroundColor Green
az containerapp update --name $APP --resource-group $RG --yaml app.yaml

Write-Host ""
Write-Host "===== Azure Files Mount Complete! =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your backend is now fully deployed with:" -ForegroundColor Green
Write-Host "  - SQLite DB persisted on Azure Files (/data/app.db)" -ForegroundColor White
Write-Host "  - Blob Storage for user files" -ForegroundColor White
Write-Host "  - CORS configured for GitHub Pages" -ForegroundColor White
Write-Host ""
Write-Host "API URL: https://app-bigyearpwa-api.orangegrass-53a5a44b.northeurope.azurecontainerapps.io" -ForegroundColor Yellow
Write-Host ""
Write-Host "Set this in your frontend .env:" -ForegroundColor Yellow
Write-Host "  VITE_API_BASE_URL=https://app-bigyearpwa-api.orangegrass-53a5a44b.northeurope.azurecontainerapps.io" -ForegroundColor White
