#!/bin/sh
# Compare needs servi en direct et derrière cfao-edge, avant de basculer zrok.
#   edge/scripts/comparer.sh http://127.0.0.1:8080 http://127.0.0.1:8086 academy-server.shares.zrok.io
# Pour chaque chemin, deux passes : Host identique des deux côtés (comme le LAN),
# puis en-têtes du partage zrok (Host public, X-Forwarded-*). Compare le statut,
# Location, Content-Type et l'empreinte du corps. Code de sortie 1 au premier écart.
# Lecture seule : uniquement des GET.
set -eu

if [ $# -lt 3 ]; then
    echo "usage : $0 URL_DIRECTE URL_PASSERELLE HOTE_PUBLIC [chemin...]" >&2
    exit 2
fi
directe=${1%/}
passerelle=${2%/}
public=$3
shift 3
chemins=${*:-/ /index.html /inexistant /api/v1/needs/healthz /api/v1/needs/
    /realms/cfao-needs/.well-known/openid-configuration
    /realms/cfao-needs/protocol/openid-connect/certs /resources/inexistant /catalogues/}

empreinte() {
    # $1 : URL ; le reste : options curl (en-têtes).
    url=$1
    shift
    tmp=$(mktemp)
    meta=$(curl -sS -o "$tmp" --max-time 20 "$@" \
        -w '%{http_code} loc=%header{location} type=%header{content-type}' "$url") || meta="ERREUR"
    echo "$meta corps=$(sha256sum < "$tmp" | cut -c1-16)"
    rm -f "$tmp"
}

hote_lan=${directe#*://}
ecarts=0
for chemin in $chemins; do
    for passe in lan zrok; do
        if [ "$passe" = lan ]; then
            set -- -H "Host: $hote_lan"
        else
            set -- -H "Host: $public" -H "X-Forwarded-Proto: https" \
                   -H "X-Forwarded-Host: $public" -H "X-Forwarded-Port: 443"
        fi
        a=$(empreinte "$directe$chemin" "$@")
        b=$(empreinte "$passerelle$chemin" "$@")
        if [ "$a" = "$b" ]; then
            echo "OK     $passe $chemin  $a"
        else
            echo "ÉCART  $passe $chemin"
            echo "   direct     : $a"
            echo "   passerelle : $b"
            ecarts=$((ecarts + 1))
        fi
    done
done

[ "$ecarts" -eq 0 ] && echo "Aucun écart." || { echo "$ecarts écart(s)." >&2; exit 1; }
