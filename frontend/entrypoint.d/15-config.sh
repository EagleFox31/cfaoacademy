#!/bin/sh
# Écrit /config.js (window.__PORTAIL_CONFIG__) depuis l'environnement : aucun hôte
# dans l'image. Vide = valeurs du build (variables Vite), comme sur le poste.
set -eu

emetteur="${PORTAIL_OIDC_ISSUER:-}"
client="${PORTAIL_OIDC_CLIENT_ID:-}"
cr="${PORTAIL_CR_URL:-}"
medacap="${PORTAIL_MEDACAP_URL:-}"
besoins="${PORTAIL_NEEDS_URL:-}"

for valeur in "$emetteur" "$cr" "$medacap" "$besoins"; do
  case "$valeur" in
    "" | http://* | https://*) ;;
    *) echo "Adresse http(s) attendue : « $valeur »" >&2; exit 1 ;;
  esac
done
# Écrites telles quelles dans du JavaScript : ni guillemet, ni espace, ni chevron.
for valeur in "$emetteur" "$client" "$cr" "$medacap" "$besoins"; do
  case "$valeur" in
    *[!A-Za-z0-9._~:/@%+=-]*) echo "Caractère interdit dans la configuration : « $valeur »" >&2; exit 1 ;;
  esac
done

# Émetteur sur une autre origine que le portail : connexion par la page Keycloak seule.
seul=false
[ -n "$emetteur" ] && seul=true

printf 'window.__PORTAIL_CONFIG__ = {"oidcIssuer": "%s", "oidcClientId": "%s", "crUrl": "%s", "medacapUrl": "%s", "needsUrl": "%s", "keycloakSeul": %s};\n' \
  "$emetteur" "$client" "$cr" "$medacap" "$besoins" "$seul" > /tmp/portail-config.js
