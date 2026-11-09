#!/bin/sh
# Écrit /config.js (émetteur et client OIDC du SPA) depuis l'environnement :
# aucun hôte dans l'image. Vide = valeurs par défaut du SPA (même origine).
set -eu

emetteur="${NEEDS_OIDC_ISSUER:-}"
client="${NEEDS_OIDC_CLIENT_ID:-}"

case "$emetteur" in
  "" | http://* | https://*) ;;
  *) echo "NEEDS_OIDC_ISSUER doit être une URL http(s) : « $emetteur »" >&2; exit 1 ;;
esac
# Écrites telles quelles dans du JavaScript : ni guillemet, ni espace, ni chevron.
for valeur in "$emetteur" "$client"; do
  case "$valeur" in
    *[!A-Za-z0-9._~:/@%+=-]*) echo "Caractère interdit dans la configuration OIDC : « $valeur »" >&2; exit 1 ;;
  esac
done

printf 'window.__NEEDS_CONFIG__ = {"oidcIssuer": "%s", "oidcClientId": "%s"};\n' \
  "$emetteur" "$client" > /etc/nginx/needs-config.js
