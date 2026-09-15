#!/bin/sh
set -e

# Forward signals to the background Keycloak process for graceful shutdown
terminate() {
  echo "[bootstrap-keycloak] Signal received, forwarding SIGTERM to Keycloak (PID $KC_PID)..."
  if [ -n "$KC_PID" ]; then
    kill -TERM "$KC_PID" 2>/dev/null || true
  fi
}
trap terminate TERM INT QUIT

echo "[bootstrap-keycloak] Starting Keycloak server..."
/opt/keycloak/bin/kc.sh "$@" &
KC_PID=$!

# Run idempotent client configuration in background once Keycloak is ready
(
  echo "[bootstrap-keycloak] Background worker started, waiting for Keycloak readiness..."
  
  READY=0
  for i in $(seq 1 60); do
    if curl -sf -o /dev/null "http://localhost:8080/realms/master" 2>/dev/null || \
       curl -sf -o /dev/null "http://localhost:8080/health/ready" 2>/dev/null; then
      READY=1
      break
    fi
    sleep 2
  done

  if [ "$READY" -ne 1 ]; then
    echo "[bootstrap-keycloak] WARNING: Keycloak did not become ready within 120s. Skipping client bootstrap."
    exit 0
  fi

  echo "[bootstrap-keycloak] Keycloak is ready. Authenticating admin CLI..."
  
  ADMIN_USER="${KC_BOOTSTRAP_ADMIN_USERNAME:-${KEYCLOAK_ADMIN:-admin}}"
  ADMIN_PASS="${KC_BOOTSTRAP_ADMIN_PASSWORD:-${KEYCLOAK_ADMIN_PASSWORD}}"

  if [ -z "$ADMIN_PASS" ]; then
    echo "[bootstrap-keycloak] ERROR: No admin password configured. Cannot bootstrap client."
    exit 0
  fi

  # Login via kcadm.sh
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 \
    --realm master \
    --user "$ADMIN_USER" \
    --password "$ADMIN_PASS" >/dev/null 2>&1 || {
      echo "[bootstrap-keycloak] Failed to authenticate admin via kcadm.sh. Retrying in 3s..."
      sleep 3
      /opt/keycloak/bin/kcadm.sh config credentials \
        --server http://localhost:8080 \
        --realm master \
        --user "$ADMIN_USER" \
        --password "$ADMIN_PASS" || exit 0
    }

  # Verify cfao-needs realm exists
  REALM_EXISTS=$(/opt/keycloak/bin/kcadm.sh get realms/cfao-needs --fields id --format csv --noquotes 2>/dev/null || true)
  if [ -z "$REALM_EXISTS" ]; then
    echo "[bootstrap-keycloak] Realm 'cfao-needs' not found yet. Skipping client bootstrap."
    exit 0
  fi

  CLIENT_ID=$(/opt/keycloak/bin/kcadm.sh get clients -r cfao-needs -q clientId=needs-web --fields id --format csv --noquotes 2>/dev/null || true)
  if [ -z "$CLIENT_ID" ]; then
    echo "[bootstrap-keycloak] Client 'needs-web' not found in realm cfao-needs. Skipping."
    exit 0
  fi

  echo "[bootstrap-keycloak] Synchronizing client needs-web ($CLIENT_ID)..."

  # Build JSON payload dynamically
  # 1. Base local origins
  REDIRECT_JSON='["http://localhost:8080/*","http://localhost:8082/*","http://localhost:5174/*","http://127.0.0.1:8080/*","http://127.0.0.1:8082/*"]'
  WEB_ORIGINS_JSON='["http://localhost:8080","http://localhost:8082","http://localhost:5174","http://127.0.0.1:8080","http://127.0.0.1:8082"]'

  # 2. Host LAN IP (passed from host via NEEDS_LAN_HOST)
  if [ -n "$NEEDS_LAN_HOST" ]; then
    echo "[bootstrap-keycloak] Registering LAN host origins: $NEEDS_LAN_HOST"
    REDIRECT_JSON=$(echo "$REDIRECT_JSON" | sed "s/]$/,\"http:\/\/${NEEDS_LAN_HOST}:8082\/*\",\"http:\/\/${NEEDS_LAN_HOST}:8080\/*\"]/")
    WEB_ORIGINS_JSON=$(echo "$WEB_ORIGINS_JSON" | sed "s/]$/,\"http:\/\/${NEEDS_LAN_HOST}:8082\",\"http:\/\/${NEEDS_LAN_HOST}:8080\"]/")
  fi

  # 3. Public base URL (e.g. https://cfao-needs.zrok.io or https://academy.cfao.com)
  if [ -n "$NEEDS_PUBLIC_BASE_URL" ]; then
    CLEAN_URL=$(echo "$NEEDS_PUBLIC_BASE_URL" | sed 's:/*$::')
    echo "[bootstrap-keycloak] Registering public HTTPS base URL: $CLEAN_URL"
    REDIRECT_JSON=$(echo "$REDIRECT_JSON" | sed "s/]$/,\"${CLEAN_URL}\/*\"]/")
    WEB_ORIGINS_JSON=$(echo "$WEB_ORIGINS_JSON" | sed "s/]$/,\"${CLEAN_URL}\"]/")
  fi

  # 4. Additional explicit redirect URIs (e.g. zrok / CFAO domains)
  if [ -n "$KEYCLOAK_ADDITIONAL_REDIRECT_URIS" ]; then
    echo "[bootstrap-keycloak] Registering additional redirect URIs: $KEYCLOAK_ADDITIONAL_REDIRECT_URIS"
    OLD_IFS="$IFS"
    IFS=','
    for URI in $KEYCLOAK_ADDITIONAL_REDIRECT_URIS; do
      URI_TRIMMED=$(echo "$URI" | tr -d ' ')
      if [ -n "$URI_TRIMMED" ]; then
        REDIRECT_JSON=$(echo "$REDIRECT_JSON" | sed "s/]$/,\"${URI_TRIMMED}\"]/")
        ORIGIN=$(echo "$URI_TRIMMED" | sed 's:/\*$::')
        WEB_ORIGINS_JSON=$(echo "$WEB_ORIGINS_JSON" | sed "s/]$/,\"${ORIGIN}\"]/")
      fi
    done
    IFS="$OLD_IFS"
  fi

  # Always append "+" to webOrigins (inherits valid redirect URIs)
  WEB_ORIGINS_JSON=$(echo "$WEB_ORIGINS_JSON" | sed 's/]$/,"+\"]/')

  TMP_JSON="/tmp/needs-web-update.json"
  cat <<EOF > "$TMP_JSON"
{
  "redirectUris": $REDIRECT_JSON,
  "webOrigins": $WEB_ORIGINS_JSON,
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "+"
  }
}
EOF

  echo "[bootstrap-keycloak] Applying configuration payload:"
  cat "$TMP_JSON"

  /opt/keycloak/bin/kcadm.sh update "clients/$CLIENT_ID" -r cfao-needs -f "$TMP_JSON"
  rm -f "$TMP_JSON"

  echo "[bootstrap-keycloak] Successfully synchronized needs-web client in PostgreSQL DB!"
) &

# Wait on Keycloak process and forward exit status
wait "$KC_PID"
EXIT_CODE=$?
echo "[bootstrap-keycloak] Keycloak process exited with code $EXIT_CODE."
exit $EXIT_CODE
