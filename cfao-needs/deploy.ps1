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

# Issuer OIDC : valeur explicite > .env > dérivé de NEEDS_PUBLIC_BASE_URL
if (-not $env:OIDC_ISSUER) {
    $envIssuer = Get-EnvValue "OIDC_ISSUER"
    if ($envIssuer) {
        $env:OIDC_ISSUER = $envIssuer
    } else {
        $env:OIDC_ISSUER = "$($env:NEEDS_PUBLIC_BASE_URL)/realms/cfao-needs"
    }
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
