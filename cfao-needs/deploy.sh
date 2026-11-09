#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CFAO Needs - Script de déploiement automatique avec détection d'hôte LAN
# ==============================================================================

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

env_value() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tr -d '\r' | tail -n 1
}

# 1. Détection LAN
if [ -z "${NEEDS_LAN_HOST:-}" ]; then
  DETECTED_IP=$(ip -4 route get 1.1.1.1 2>/dev/null \
    | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' \
    | head -n1 \
    | tr -d '\r' || true)
  if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d '\r' || true)
  fi
  export NEEDS_LAN_HOST="${DETECTED_IP:-localhost}"
else
  echo "[deploy] NEEDS_LAN_HOST déjà défini par l'environnement : $NEEDS_LAN_HOST"
fi

# 2. Port frontend : variable shell > .env > fallback
NEEDS_PORT="${NEEDS_PORT:-$(env_value NEEDS_PORT)}"
NEEDS_PORT="${NEEDS_PORT:-8082}"
export NEEDS_PORT

# 3. URL publique : valeur explicite > .env > URL LAN calculée
NEEDS_PUBLIC_BASE_URL="${NEEDS_PUBLIC_BASE_URL:-$(env_value NEEDS_PUBLIC_BASE_URL)}"
if [ -z "$NEEDS_PUBLIC_BASE_URL" ]; then
  NEEDS_PUBLIC_BASE_URL="http://${NEEDS_LAN_HOST}:${NEEDS_PORT}"
fi
export NEEDS_PUBLIC_BASE_URL

# 4. Issuer OIDC : valeur explicite > .env. Jamais déduit de l'hôte : c'est
#    l'émetteur du Keycloak commun (KC_HOSTNAME + /realms/cfao).
OIDC_ISSUER="${OIDC_ISSUER:-$(env_value OIDC_ISSUER)}"
if [ -z "$OIDC_ISSUER" ]; then
  echo "[deploy] OIDC_ISSUER manquant (ex. https://<hote>/auth/realms/cfao)" >&2
  exit 1
fi
export OIDC_ISSUER

# Audience : vide = défaut du compose (cfao-needs-api). Un reste du realm de
# module (needs-web) ferait refuser tous les jetons par l'API.
OIDC_AUDIENCE="${OIDC_AUDIENCE:-$(env_value OIDC_AUDIENCE)}"
case ",${OIDC_AUDIENCE}," in
  ,,|*,cfao-needs-api,*) ;;
  *) echo "[deploy] OIDC_AUDIENCE=${OIDC_AUDIENCE} : doit être vide ou contenir cfao-needs-api" >&2
     exit 1 ;;
esac

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
echo " Issuer OIDC      : ${OIDC_ISSUER}"
echo "=========================================================="

if [ -f "$ENV_FILE" ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" up -d
fi
