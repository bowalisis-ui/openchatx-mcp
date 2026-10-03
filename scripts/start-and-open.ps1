if (-not $env:CONTROL_PLANE_API_KEY) {
    $userKey = [Environment]::GetEnvironmentVariable("CONTROL_PLANE_API_KEY", "User")
    if ($userKey) {
        $env:CONTROL_PLANE_API_KEY = $userKey
    } else {
        throw "CONTROL_PLANE_API_KEY is not set. Configure it as a Windows user environment variable before launching OpenChatX."
    }
}

$configProfileDir = "$env:USERPROFILE\.config\tunnel-client"
$appDataProfile = "$env:APPDATA\tunnel-client\openchatx.yaml"
if (-not (Test-Path "$configProfileDir\openchatx.yaml") -and (Test-Path $appDataProfile)) {
    New-Item -ItemType Directory -Path $configProfileDir -Force | Out-Null
    Copy-Item $appDataProfile -Destination "$configProfileDir\openchatx.yaml" -Force
}

$isHealthy = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/healthz" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $isHealthy = $true
    }
} catch {
    $isHealthy = $false
}

if (-not $isHealthy) {
    Write-Host "[OpenChatX] Starting background services..." -ForegroundColor Cyan
    npm start
} else {
    Write-Host "[OpenChatX] Services are already running." -ForegroundColor Green
}

Write-Host "[OpenChatX] Opening Dashboard in browser..." -ForegroundColor Green
Start-Process "http://127.0.0.1:8001/ui"
