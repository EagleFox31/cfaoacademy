# ==============================================================================
# CFAO Academy Mail - Déploiement (Windows)
# Idempotent : relancer donne le même résultat, .env n'est jamais réécrit.
# URL publique : variable d'environnement > .env > http://<IP LAN>:<MAIL_PUBLIC_PORT>
# ==============================================================================
param (
    [string]$ComposeFile = "docker-compose.yml",
    [string]$EnvFile = ".env",
    [switch]$DryRun  # affiche l'URL calculée sans lancer les conteneurs
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Get-EnvValue([string]$key) {
    if (Test-Path $EnvFile) {
        $match = (Get-Content $EnvFile | Where-Object { $_ -match "^$key=(.*)$" } | Select-Object -Last 1)
        if ($match -match "^$key=(.*)$") {
            return $matches[1].Trim()
        }
    }
    return $null
}

if (-not $env:MAIL_PUBLIC_BASE_URL) {
    $envPub = Get-EnvValue "MAIL_PUBLIC_BASE_URL"
    if ($envPub) {
        $env:MAIL_PUBLIC_BASE_URL = $envPub
    } else {
        if (-not $env:MAIL_LAN_HOST) {
            $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' -ErrorAction SilentlyContinue |
                   Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } |
                   Sort-Object IPAddress | Select-Object -First 1).IPAddress
            if (-not $ip) {
                throw "IP LAN introuvable : renseigner MAIL_PUBLIC_BASE_URL dans $EnvFile."
            }
            $env:MAIL_LAN_HOST = $ip
        }
        $port = $env:MAIL_PUBLIC_PORT
        if (-not $port) { $port = Get-EnvValue "MAIL_PUBLIC_PORT" }
        # Pas de port supposé : il dépend de l'hébergement attribué.
        if ($port -notmatch '^\d+$') {
            throw "Renseigner MAIL_PUBLIC_PORT (port d'accès à la plateforme) ou MAIL_PUBLIC_BASE_URL dans $EnvFile."
        }
        $suffix = if ($port -eq "80") { "" } else { ":$port" }
        $env:MAIL_PUBLIC_BASE_URL = "http://$($env:MAIL_LAN_HOST)$suffix"
    }
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " CFAO Academy Mail - Déploiement" -ForegroundColor Green
Write-Host " Fichier Compose : $ComposeFile"
Write-Host " URL publique    : $env:MAIL_PUBLIC_BASE_URL (hôte autorisé dans les liens)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
if ($DryRun) { exit 0 }

docker compose -f $ComposeFile --env-file $EnvFile up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose -f $ComposeFile --env-file $EnvFile ps
