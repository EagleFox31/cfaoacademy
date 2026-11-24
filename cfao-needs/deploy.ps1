# ==============================================================================
# CFAO Needs - Script de déploiement automatique avec détection d'hôte LAN (Windows)
# ==============================================================================
param (
    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$EnvFile = ".env"
)

# 1. Détection automatique de l'IP LAN de la machine hôte Windows
if (-not $env:NEEDS_LAN_HOST) {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' |
               Where-Object { $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.' } |
               Select-Object -First 1).IPAddress
        if ($ip) {
            $env:NEEDS_LAN_HOST = $ip
        } else {
            $env:NEEDS_LAN_HOST = "localhost"
        }
    } catch {
        $env:NEEDS_LAN_HOST = "localhost"
    }
} else {
    Write-Host "[deploy] NEEDS_LAN_HOST déjà défini par l'environnement : $env:NEEDS_LAN_HOST" -ForegroundColor Cyan
}

function Get-EnvValue([string]$key) {
    if (Test-Path $EnvFile) {
        $match = (Get-Content $EnvFile | Where-Object { $_ -match "^$key=(.*)$" } | Select-Object -Last 1)
        if ($match -match "^$key=(.*)$") {
            return $matches[1].Trim()
        }
    }
    return $null
}

# Port frontend : variable d'environnement > .env > fallback 8082
if (-not $env:NEEDS_PORT) {
    $envPort = Get-EnvValue "NEEDS_PORT"
    if ($envPort) {
        $env:NEEDS_PORT = $envPort
    } else {
        $env:NEEDS_PORT = "8082"
    }
}

# URL publique : valeur explicite > .env > URL LAN calculée
if (-not $env:NEEDS_PUBLIC_BASE_URL) {
    $envPub = Get-EnvValue "NEEDS_PUBLIC_BASE_URL"
    if ($envPub) {
        $env:NEEDS_PUBLIC_BASE_URL = $envPub
    } else {
        $env:NEEDS_PUBLIC_BASE_URL = "http://$($env:NEEDS_LAN_HOST):$($env:NEEDS_PORT)"
    }
}

# Issuer OIDC : valeur explicite > .env. Jamais déduit de l'hôte : c'est
# l'émetteur du Keycloak commun (KC_HOSTNAME + /realms/cfao).
if (-not $env:OIDC_ISSUER) {
    $env:OIDC_ISSUER = Get-EnvValue "OIDC_ISSUER"
}
if (-not $env:OIDC_ISSUER) {
    Write-Error "OIDC_ISSUER manquant (ex. https://<hote>/auth/realms/cfao)"
    exit 1
}

# Audience : vide = défaut du compose (cfao-needs-api). Un reste du realm de
# module (needs-web) ferait refuser tous les jetons par l'API.
if (-not $env:OIDC_AUDIENCE) {
    $env:OIDC_AUDIENCE = Get-EnvValue "OIDC_AUDIENCE"
}
if ($env:OIDC_AUDIENCE -and (($env:OIDC_AUDIENCE -split ',') -notcontains 'cfao-needs-api')) {
    Write-Error "OIDC_AUDIENCE=$($env:OIDC_AUDIENCE) : doit être vide ou contenir cfao-needs-api"
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " CFAO Needs - Déploiement Conteneurs (Windows)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Fichier Compose  : $ComposeFile"
Write-Host " Fichier d'env    : $EnvFile"
Write-Host " Hôte LAN détecté : $env:NEEDS_LAN_HOST" -ForegroundColor Yellow
Write-Host " Port Frontend    : $env:NEEDS_PORT"
Write-Host " Accès local      : http://localhost:$($env:NEEDS_PORT)"
Write-Host " Accès réseau LAN : http://$($env:NEEDS_LAN_HOST):$($env:NEEDS_PORT)" -ForegroundColor Green
Write-Host " URL publique     : $env:NEEDS_PUBLIC_BASE_URL" -ForegroundColor Cyan
Write-Host " Issuer OIDC      : $env:OIDC_ISSUER" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green

if (Test-Path $EnvFile) {
    docker compose --env-file $EnvFile -f $ComposeFile pull
    docker compose --env-file $EnvFile -f $ComposeFile up -d
} else {
    docker compose -f $ComposeFile pull
    docker compose -f $ComposeFile up -d
}
