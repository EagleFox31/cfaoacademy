#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CFAO Needs - Script de déploiement automatique avec détection d'hôte LAN
# ==============================================================================

COMPOSE_FILE="${1:-docker-compose.prod.yml}"

# 1. Détection automatique de l'IP LAN de la machine hôte
if [ -z "${NEEDS_LAN_HOST:-}" ]; then
  # Tente de trouver l'IP routable principale (route vers l'extérieur ou première interface non-loopback)
  DETECTED_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' || true)
  if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  export NEEDS_LAN_HOST="${DETECTED_IP:-localhost}"
else
  echo "[deploy] NEEDS_LAN_HOST déjà défini par l'environnement : $NEEDS_LAN_HOST"
fi

echo "=========================================================="
echo " CFAO Needs - Déploiement Conteneurs"
echo "=========================================================="
echo " Fichier Compose  : $COMPOSE_FILE"
echo " Hôte LAN détecté : $NEEDS_LAN_HOST"
echo " Port Frontend    : 8082"
echo " Port Keycloak    : 8081"
echo " Accès local      : http://localhost:8082"
if [ "$NEEDS_LAN_HOST" != "localhost" ]; then
  echo " Accès réseau LAN : http://${NEEDS_LAN_HOST}:8082"
fi
echo "=========================================================="

docker compose -f "$COMPOSE_FILE" up -d
