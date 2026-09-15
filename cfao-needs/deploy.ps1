# ==============================================================================
# CFAO Needs - Script de déploiement automatique avec détection d'hôte LAN (Windows)
# ==============================================================================
param (
    [string]$ComposeFile = "docker-compose.prod.yml"
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

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " CFAO Needs - Déploiement Conteneurs (Windows)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Fichier Compose  : $ComposeFile"
Write-Host " Hôte LAN détecté : $env:NEEDS_LAN_HOST" -ForegroundColor Yellow
Write-Host " Port Frontend    : 8082"
Write-Host " Port Keycloak    : 8081"
Write-Host " Accès local      : http://localhost:8082"
if ($env:NEEDS_LAN_HOST -ne "localhost") {
    Write-Host " Accès réseau LAN : http://$($env:NEEDS_LAN_HOST):8082" -ForegroundColor Green
}
Write-Host "==========================================================" -ForegroundColor Green

docker compose -f $ComposeFile up -d
