param(
  [string]$RootEnvPath = (Join-Path (Join-Path $PSScriptRoot "..") ".env"),
  [string]$BackendEnvPath = (Join-Path (Join-Path (Join-Path $PSScriptRoot "..") "backend") ".env"),
  [string]$FrontendEnvPath = (Join-Path (Join-Path (Join-Path $PSScriptRoot "..") "frontend") ".env")
)

if (!(Test-Path -LiteralPath $RootEnvPath)) {
  Write-Error "Root env file not found: $RootEnvPath"
  exit 1
}

$lines = Get-Content -LiteralPath $RootEnvPath -ErrorAction Stop

$backendOut = New-Object System.Collections.Generic.List[string]
$frontendOut = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
  $trim = $line.Trim()
  if ($trim.Length -eq 0) { continue }
  if ($trim.StartsWith("#")) { continue }

  if ($trim -match "^[A-Za-z_][A-Za-z0-9_]*=") {
    if ($trim.StartsWith("EXPO_PUBLIC_")) {
      $frontendOut.Add($trim)
    } else {
      $backendOut.Add($trim)
    }
  }
}

if ($backendOut.Count -gt 0) {
  $backendOut | Set-Content -LiteralPath $BackendEnvPath -Encoding UTF8
  Write-Host "Wrote backend env: $BackendEnvPath"
} else {
  Write-Warning "No backend variables found in root .env"
}

if ($frontendOut.Count -gt 0) {
  $frontendOut | Set-Content -LiteralPath $FrontendEnvPath -Encoding UTF8
  Write-Host "Wrote frontend env: $FrontendEnvPath"
} else {
  Write-Warning "No EXPO_PUBLIC_ variables found in root .env"
}
