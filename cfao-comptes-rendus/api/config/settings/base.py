"""Configuration du service des comptes rendus formateur (story 04-5).

Reprend celle du kit `template-service` : base propre au service, mode
`standalone` (developpement), `local` (poste unique sur le reseau interne,
comptes a mot de passe) ou `integrated` (plateforme), PDP Cerbos.
"""
import os
import sys
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Le rendu et la redaction s'importent « a plat » (`import photos`,
# `from service import ...`), comme avant leur arrivee ici : jamais en
# paquet (`rendu.photos`), sinon deux exemplaires du meme module
# coexisteraient, chacun avec son verrou LibreOffice.
for _dossier in ("redaction", "rendu"):
    _chemin = str(BASE_DIR / _dossier)
    if _chemin not in sys.path:
        sys.path.insert(0, _chemin)

# Ne vaut que pour le poste de dev : les modes local et integre la refusent.
CLE_DE_DEV = "cle-de-dev-non-secrete"

env = environ.Env(
    DEBUG=(bool, False),
    DEPLOYMENT_MODE=(str, "standalone"),
    SECRET_KEY=(str, CLE_DE_DEV),
    CERBOS_HTTP=(str, "http://localhost:3592"),
    PLATFORM_CORE_URL=(str, "http://localhost:8000"),
    OIDC_ISSUER=(str, ""),
    OIDC_AUDIENCE=(str, ""),
    OIDC_JWKS_URL=(str, ""),
    OIDC_CONNEXION=(str, "/oauth2/start?rd=/portail"),
    OIDC_DECONNEXION=(str, "/oauth2/sign_out?rd=/"),
    PROFILS_LOCAUX=(str, str(BASE_DIR / "profils-locaux.json")),
    COMPTES_LOCAUX=(str, ""),
    COOKIE_SESSION=(str, "cfao_session"),
    COOKIE_SECURE=(bool, False),
)

environ.Env.read_env(os.path.join(BASE_DIR.parent, ".env"))

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
DEPLOYMENT_MODE = env("DEPLOYMENT_MODE")
CERBOS_HTTP = env("CERBOS_HTTP")
PLATFORM_CORE_URL = env("PLATFORM_CORE_URL")

if DEPLOYMENT_MODE not in ("standalone", "local", "integrated"):
    raise ImproperlyConfigured("DEPLOYMENT_MODE : 'standalone', 'local' ou 'integrated'.")
# Le mode autonome identifie sans mot de passe : il ne sert qu'au poste de dev.
if DEPLOYMENT_MODE == "standalone" and not DEBUG:
    raise ImproperlyConfigured("DEPLOYMENT_MODE=standalone exige DEBUG=True (developpement seulement).")

# Identite OIDC (Keycloak) : jeton Bearer verifie par les cles JWKS.
OIDC_ISSUER = env("OIDC_ISSUER")
OIDC_AUDIENCE = env("OIDC_AUDIENCE")
OIDC_JWKS_URL = env("OIDC_JWKS_URL")
# Ou envoyer le navigateur pour se connecter / se deconnecter (oauth2-proxy).
OIDC_CONNEXION = env("OIDC_CONNEXION")
OIDC_DECONNEXION = env("OIDC_DECONNEXION")

# Le mode integre est expose : il refuse de demarrer sans vraie cle ni
# emetteur OIDC, plutot que de tourner avec une configuration de dev.
if DEPLOYMENT_MODE == "integrated":
    _manquants = [nom for nom, valeur in (("SECRET_KEY", SECRET_KEY != CLE_DE_DEV and SECRET_KEY),
                                          ("OIDC_ISSUER", OIDC_ISSUER),
                                          ("OIDC_AUDIENCE", OIDC_AUDIENCE),
                                          ("OIDC_JWKS_URL", OIDC_JWKS_URL)) if not valeur]
    if _manquants:
        raise ImproperlyConfigured("Mode integre : a renseigner : " + ", ".join(_manquants) + ".")
# Profils fictifs du mode autonome (aucun vrai nom dans le depot).
PROFILS_LOCAUX = env("PROFILS_LOCAUX")
# Mode local : empreintes des mots de passe (base SQLite hors depot).
COMPTES_LOCAUX = env("COMPTES_LOCAUX")

# Le mode local est expose au reseau interne : vraie cle, mots de passe,
# et jamais DEBUG (les pages d'erreur detaillees montreraient la configuration).
if DEPLOYMENT_MODE == "local":
    _manquants = [nom for nom, valeur in (("SECRET_KEY", SECRET_KEY != CLE_DE_DEV and SECRET_KEY),
                                          ("COMPTES_LOCAUX", COMPTES_LOCAUX)) if not valeur]
    if _manquants:
        raise ImproperlyConfigured("Mode local : a renseigner : " + ", ".join(_manquants) + ".")
    if DEBUG:
        raise ImproperlyConfigured("DEPLOYMENT_MODE=local exige DEBUG=False.")

# Cookie de session : meme hote, ports differents = meme site, donc un nom
# propre au module evite de croiser le cookie d'une autre application ;
# `Secure` s'active derriere HTTPS (COOKIE_SECURE=True).
COOKIE_SESSION = env("COOKIE_SESSION")
COOKIE_SECURE = env("COOKIE_SECURE")

# Origines des pages autorisees a ecrire (POST/PUT/PATCH/DELETE) avec le
# cookie de session : passerelle du module et serveur de dev de l'interface.
ORIGINES_AUTORISEES = [o.rstrip("/") for o in env.list("ORIGINES_AUTORISEES", default=[
    "http://localhost:8090", "http://127.0.0.1:8090",
    "http://localhost:5176", "http://127.0.0.1:5176"])]

# Les noms sous lesquels le service est appele (passerelle : son nom public).
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "core",
    "comptes_rendus",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "core.middleware.ControleOrigine",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default="sqlite:///db.sqlite3")
}
# SQLite ignore `select_for_update` : chaque transaction prend le verrou
# d'ecriture des son debut, sinon deux envois du meme brouillon liraient
# la meme revision. L'attente evite un « database is locked » immediat.
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    DATABASES["default"].setdefault("OPTIONS", {}).update(
        {"transaction_mode": "IMMEDIATE", "timeout": 20})

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
# Les routes reprennent celles du service precedent, sans barre finale.
APPEND_SLASH = False
# Une photo arrive entiere dans le corps de la requete.
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024

_AUTHENTIFICATION = {
    "integrated": "core.auth.oidc.KeycloakJWTAuthentication",
    "standalone": "core.auth.locale.LocaleAuthentication",
    "local": "core.auth.locale.LocaleAuthentication",
}

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [_AUTHENTIFICATION[DEPLOYMENT_MODE]],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "EXCEPTION_HANDLER": "core.exceptions.erreur_en_francais",
}
