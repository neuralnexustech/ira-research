# install.ps1
# IRA Research Native Host Windows Installer

param (
    [string]$ExtensionId = "hmpidmglgdggbjokobmldogocofmbkkj" # Fallback or supplied extension ID
)

Write-Host "IRA Research Installer initializing..." -ForegroundColor Magenta

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$DistHostDir = "$ProjectRoot\dist\host"

# Ensure dist/host directory exists
if (-not (Test-Path $DistHostDir)) {
    New-Item -ItemType Directory -Force -Path $DistHostDir | Out-Null
}

# Copy bat file to dist/host
Copy-Item "$ProjectRoot\host\ira-research.bat" "$DistHostDir\ira-research.bat" -Force

# Read manifest template, patch paths and extension IDs
$ManifestSource = "$ProjectRoot\host\com.ira.research.json"
$ManifestContent = Get-Content $ManifestSource -Raw | ConvertFrom-Json

# Resolve absolute path for the compiled BAT
$BatFullPath = "$DistHostDir\ira-research.bat" -replace '\\', '\\'
$ManifestContent.path = $BatFullPath

# Add unique extension ID if not already in allowed_origins
if (-not ($ManifestContent.allowed_origins -contains "chrome-extension://$ExtensionId/")) {
    $ManifestContent.allowed_origins += "chrome-extension://$ExtensionId/"
}

# Save finalized manifest to dist/host
$FinalManifestPath = "$DistHostDir\com.ira.research.json"
$ManifestContent | ConvertTo-Json -Depth 10 | Out-File $FinalManifestPath -Encoding utf8 -Force

Write-Host "Finalized Native Host manifest created at: $FinalManifestPath" -ForegroundColor Cyan

# Windows Registry settings
$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.ira.research"

# Create registry keys if not present
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}

# Point Default value to finalized json path
Set-Item -Path $RegistryPath -Value $FinalManifestPath -Force

Write-Host "Successfully registered com.ira.research in Windows Registry." -ForegroundColor Green
Write-Host "Allowed Chrome Extension ID: $ExtensionId" -ForegroundColor Cyan
Write-Host "IRA Native Messaging Bridge setup complete." -ForegroundColor Green
