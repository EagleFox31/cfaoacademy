#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CFAO Needs - Script de déploiement automatique avec détection d'hôte LAN
# ==============================================================================

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

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

env_value() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1
}

# Port frontend : variable shell > .env > fallback
NEEDS_PORT="${NEEDS_PORT:-$(env_value NEEDS_PORT)}"
NEEDS_PORT="${NEEDS_PORT:-8082}"
export NEEDS_PORT

# URL publique : valeur explicite > .env > URL LAN calculée
NEEDS_PUBLIC_BASE_URL="${NEEDS_PUBLIC_BASE_URL:-$(env_value NEEDS_PUBLIC_BASE_URL)}"

if [ -z "$NEEDS_PUBLIC_BASE_URL" ]; then
  NEEDS_PUBLIC_BASE_URL="http://${NEEDS_LAN_HOST}:${NEEDS_PORT}"
fi

export NEEDS_PUBLIC_BASE_URL

echo "=========================================================="
echo " CFAO Needs - Déploiement Conteneurs"
echo "=========================================================="
echo " Fichier Compose  : $COMPOSE_FILE"
echo " Fichier d'env    : $ENV_FILE"
echo " Hôte LAN détecté : $NEEDS_LAN_HOST"
echo " Port Frontend    : ${NEEDS_PORT}"
echo " Accès local      : http://localhost:${NEEDS_PORT}"
echo " Accès réseau LAN : http://${NEEDS_LAN_HOST}:${NEEDS_PORT}"
echo " URL publique     : ${NEEDS_PUBLIC_BASE_URL}"
echo "=========================================================="

if [ -f "$ENV_FILE" ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d
fi

