"""Cohérence statique de cfao-edge (sans docker) : routes, journaux, variables."""
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

RACINE = Path(__file__).resolve().parents[2]
EDGE = RACINE / "edge"
MODELES = sorted((EDGE / "templates").rglob("*.template"))


def _texte(chemin):
    return Path(chemin).read_text(encoding="utf-8")


def _locations(texte):
    return re.findall(r"^\s*location\s+(?:[=~^*]+\s+)?(\S+)\s*\{", texte, re.M)


def test_liste_blanche_des_routes():
    # Toute nouvelle route publique doit modifier ce test, donc être relue.
    trouvees = sorted(loc for m in MODELES for loc in _locations(_texte(m)))
    assert trouvees == sorted(["/", "/", "/", "/", "/auth/", "/auth", r"^/auth/(realms/cfao|resources)/", "/cr", "/cr/",
                                 "/api/v1/planning/", "/api/v1/planning/internal/", "/api/v1/core/", "/api/v1/supervision/",
                                 "/besoins", "/besoins/", "/api/v1/needs/",
                                 r"^/(marque/|relecture(/|$)|a-envoyer(/|$)|fiche/|campagnes/)"])


def test_routes_internes_jamais_publiees():
    modele = _texte(EDGE / "templates" / "routes" / "planning.conf.template")
    bloc = modele.split("location /api/v1/planning/internal/ {", 1)[1].split("}", 1)[0]
    assert bloc.split() == ["return", "404;"]


def test_needs_transparent():
    modele = _texte(EDGE / "templates" / "needs" / "relais.conf.template")
    bloc = modele.split("location / {", 1)[1]
    assert "X-Forwarded" not in bloc, "/ doit relayer les en-têtes reçus tels quels"
    # needs à la racine (public) et écoute LAN : le même relais, quelle que soit la racine.
    for modele in ("racine/needs.conf.template", "lan/needs.conf.template"):
        assert "include /tmp/conf.d/needs/relais.conf;" in _texte(EDGE / "templates" / modele), modele


def test_racine_choisie_par_edge_racine():
    edge = _texte(EDGE / "templates" / "edge.conf.template")
    assert "include /tmp/conf.d/racine/*.conf;" in edge
    actifs = _texte(EDGE / "entrypoint.d" / "25-modules-actifs.sh")
    assert ('if [ "${EDGE_RACINE:-needs}" = portail ]; then\n    rm -f "$racine/needs.conf"\nelse\n'
            '    rm -f "$racine/portail.conf" "$routes/needs.conf"\nfi') in actifs
    exiger = _texte(EDGE / "entrypoint.d" / "05-exiger-variables.sh")
    assert "EDGE_RACINE=portail mais EDGE_PORTAIL_UPSTREAM vide" in exiger
    portail = _texte(EDGE / "templates" / "racine" / "portail.conf.template")
    assert "proxy_pass http://${EDGE_PORTAIL_UPSTREAM};" in portail


def test_anciens_liens_needs_rediriges_sous_besoins():
    needs = _texte(EDGE / "templates" / "routes" / "needs.conf.template")
    bloc = needs.split("location ~ ", 1)[1].split("}", 1)[0]
    assert bloc.split("{", 1)[1].split() == ["set", "$edge_module", "needs;", "return", "308", "/besoins$request_uri;"]
    # Chemins partagés avec le portail : jamais redirigés.
    motif = re.compile(bloc.split()[0])
    for chemin in ("/", "/profil", "/callback", "/catalogues/x", "/assets/a.js", "/config.js", "/marques"):
        assert not motif.match(chemin), chemin
    for chemin in ("/marque/A", "/relecture", "/relecture/3", "/a-envoyer", "/fiche/1", "/campagnes/2027"):
        assert motif.match(chemin), chemin


def test_ecoutes_lan_sans_auth_ni_hsts():
    # Le LAN est en http direct : ni Keycloak (URL publique seule), ni HSTS.
    lan = sorted((EDGE / "templates" / "lan").glob("*.conf.template"))
    assert [m.name for m in lan] == ["cr.conf.template", "needs.conf.template", "portail.conf.template"]
    for m in lan:
        code = "\n".join(ligne for ligne in _texte(m).splitlines() if not ligne.lstrip().startswith("#"))
        for interdit in ("auth", "edge_hsts", "EDGE_PUBLIC"):
            assert interdit not in code, (m.name, interdit)
    cr = _texte(EDGE / "templates" / "lan" / "cr.conf.template")
    assert "set $edge_fwd_proto http;" in cr
    generateur = _texte(EDGE / "entrypoint.d" / "26-ecoutes-lan.sh")
    assert "absolute_redirect off" in generateur and "location" not in generateur


def test_ecoutes_lan_suivent_le_proxy_https_devant():
    # Caddy (HTTPS sur l'IP) ou zrok devant une écoute LAN : schéma et port déclarés
    # par le proxy, sinon le retour OIDC du CR et les URL du portail sont faux.
    for nom in ("cr.conf.template", "portail.conf.template"):
        code = _texte(EDGE / "templates" / "lan" / nom)
        assert "if ($http_x_forwarded_proto = https)" in code, nom
        assert "set $edge_fwd_port $http_x_forwarded_port;" in code, nom


def test_modules_sous_prefixe_recoivent_l_url_du_bloc_server():
    cr = _texte(EDGE / "templates" / "routes" / "cr.conf.template")
    needs = _texte(EDGE / "templates" / "routes" / "needs.conf.template")
    edge = _texte(EDGE / "templates" / "edge.conf.template")
    assert "EDGE_PUBLIC" not in cr and "EDGE_PUBLIC" not in needs and "EDGE_PUBLIC" not in edge.split("server {", 1)[1]
    for v in ("$edge_fwd_proto", "$edge_fwd_host", "$edge_fwd_port"):
        assert v in cr
        assert needs.count(v) == 2, v   # /besoins/ et /api/v1/needs/
        # Écoute publique : l'origine vient de la liste blanche (27-origines.sh).
        assert f"set {v} $edge_req_{v.rsplit('_', 1)[1]};" in " ".join(edge.split())
        assert f"set {v} " in _texte(EDGE / "templates" / "lan" / "cr.conf.template")


def test_chaque_proxy_pass_inclut_le_snippet_commun():
    for m in MODELES:
        for bloc in re.split(r"\n(?=\s*location )", _texte(m)):
            if "proxy_pass" in bloc:
                assert "snippets/proxy-commun.conf" in bloc, m.name


def test_page_d_attente_dans_chaque_bloc_server():
    inclusion = "include /etc/nginx/snippets/attente.conf;"
    assert inclusion in _texte(EDGE / "templates" / "edge.conf.template")
    assert inclusion in _texte(EDGE / "entrypoint.d" / "26-ecoutes-lan.sh")
    attente = _texte(EDGE / "snippets" / "attente.conf")
    # Seules les erreurs de passerelle : un 4xx du module n'est jamais masqué.
    assert re.search(r"^error_page 502 503 504 =503 /_edge/attente\.\$edge_attente;$", attente, re.M)
    assert sorted(_locations(attente)) == ["/_edge/attente.html", "/_edge/attente.json"]
    assert attente.count("internal;") == 2
    assert "COPY pages/ /usr/share/nginx/edge/" in _texte(EDGE / "Dockerfile")
    page = _texte(EDGE / "pages" / "attente.html")
    assert '<meta http-equiv="refresh" content="15">' in page and 'lang="en"' in page
    assert "http" not in page.split("<style>", 1)[1].split("</style>", 1)[0], "page autonome"


def test_api_garde_ses_propres_erreurs():
    # Un 503 de l'API garde son corps ; les routes HTML relaient la page d'attente.
    for api in ("planning", "core", "supervision"):
        assert "proxy_intercept_errors" not in "\n".join(
            ligne for ligne in _texte(EDGE / "templates" / "routes" / f"{api}.conf.template").splitlines()
            if not ligne.lstrip().startswith("#")), api
    for modele in ("routes/cr.conf.template", "routes/auth.conf.template", "needs/relais.conf.template",
                   "racine/portail.conf.template"):
        assert "proxy_intercept_errors on;" in _texte(EDGE / "templates" / modele), modele
    needs = _texte(EDGE / "templates" / "routes" / "needs.conf.template")
    assert "proxy_intercept_errors on;" in needs.split("location /besoins/ {", 1)[1].split("}", 1)[0]
    assert "proxy_intercept_errors on;" not in needs.split("location /api/v1/needs/ {", 1)[1].split("}", 1)[0]


def test_keycloak_n_utilise_jamais_le_host_recu():
    auth = _texte(EDGE / "templates" / "routes" / "auth.conf.template")
    assert "$http_host" not in auth and "$host" not in auth


def test_journal_sans_donnee_sensible():
    conf = _texte(EDGE / "nginx.conf")
    format_ = conf.split("log_format", 1)[1].split(";", 1)[0]
    for interdit in ("$request_uri", "$args", "$query_string", "$http_referer",
                     "$http_cookie", "$http_authorization", "$request "):
        assert interdit not in format_, interdit
    assert "server_tokens off" in conf
    # Du jeton, seuls `sub` et `azp` sont journalisés (supervision des connexions).
    assert re.findall(r"\$edge_(sub|azp)\b", format_) == ["sub", "azp"]
    assert re.findall(r"^\s*js_set \$(\w+) jeton\.(\w+);", conf, re.M) == [("edge_sub", "sub"), ("edge_azp", "azp")]
    njs = _texte(EDGE / "njs" / "sub.js")
    assert re.findall(r"pick\(r, '(\w+)'", njs) == ["sub", "azp"]
    assert "COPY njs/ /etc/nginx/njs/" in _texte(EDGE / "Dockerfile")


def test_route_supervision_optionnelle_et_servie_sur_le_portail():
    actifs = _texte(EDGE / "entrypoint.d" / "25-modules-actifs.sh")
    assert 'EDGE_SUPERVISION_UPSTREAM:-' in actifs and 'rm -f "$routes/supervision.conf"' in actifs
    assert "include /tmp/conf.d/routes/supervision.con[f];" in _texte(EDGE / "templates" / "lan" / "portail.conf.template")


def test_directives_de_securite():
    edge = _texte(EDGE / "templates" / "edge.conf.template")
    assert "absolute_redirect off" in edge
    hsts = re.search(r"\$edge_hsts \{(.*?)\n\}", edge, re.S).group(1)
    assert 'https   "max-age=31536000";' in hsts
    assert "includeSubDomains" not in edge and "preload" not in edge


def test_variables_declarees_partout():
    utilisees = set()
    for m in MODELES:
        utilisees |= set(re.findall(r"\$\{(EDGE_[A-Z_]+)\}", _texte(m)))
    compose = yaml.safe_load(_texte(EDGE / "compose.prod.yml"))["services"]["edge"]["environment"]
    exemple = _texte(EDGE / ".env.prod.example")
    exiger = _texte(EDGE / "entrypoint.d" / "05-exiger-variables.sh")
    optionnelles = {"EDGE_KEYCLOAK_UPSTREAM", "EDGE_CR_UPSTREAM", "EDGE_PLANNING_UPSTREAM", "EDGE_CORE_UPSTREAM",
                    "EDGE_PORTAIL_UPSTREAM", "EDGE_SUPERVISION_UPSTREAM"}
    for v in utilisees:
        assert v in compose, v
        assert re.search(rf"^{v}=", exemple, re.M), v
        assert v in exiger or v in optionnelles, v
    for v in utilisees - optionnelles:
        assert re.fullmatch(r"\$\{[A-Z_]+:\?.+\}", compose[v]), v
    for v in optionnelles | {"EDGE_LAN", "EDGE_RACINE", "EDGE_ORIGINES"}:
        assert compose[v].endswith(":-}"), v
    # Vides dans le modèle : une écoute LAN exige d'abord de libérer le port ; la
    # racine portail et les origines suivent la bascule « une adresse ».
    for v in ("EDGE_LAN", "EDGE_RACINE", "EDGE_ORIGINES"):
        assert re.search(rf"^{v}=$", exemple, re.M), v


def test_modeles_d_environnement_suivis_par_git():
    # Le CI lit ces modèles : ignorés par `.env.*`, ils manqueraient au clone.
    for modele in ("edge/.env.prod.example", "keycloak/.env.prod.example"):
        suivi = subprocess.run(["git", "ls-files", "--error-unmatch", modele],
                               cwd=RACINE, capture_output=True)
        assert suivi.returncode == 0, f"{modele} absent du dépôt"


def test_compose_durci():
    edge = yaml.safe_load(_texte(EDGE / "compose.prod.yml"))["services"]["edge"]
    assert edge["network_mode"] == "host" and "ports" not in edge
    assert edge["read_only"] is True and edge["cap_drop"] == ["ALL"]
    assert edge["mem_limit"] and edge["logging"]["options"]["max-size"]
    assert "no-new-privileges:true" in edge["security_opt"]


def test_image():
    dockerfile = _texte(EDGE / "Dockerfile")
    assert re.search(r"^FROM nginxinc/nginx-unprivileged:\d+\.\d+-alpine$", dockerfile, re.M)
    assert "NGINX_ENVSUBST_FILTER=^EDGE_" in dockerfile and "--chmod=0755" in dockerfile
    assert "edge/** text=auto eol=lf" in _texte(RACINE / ".gitattributes")
    for script in (EDGE / "entrypoint.d").glob("*.sh"):
        assert b"\r" not in script.read_bytes(), script.name


def test_job_ci_edge_filtre_sur_ses_chemins():
    ci = _texte(RACINE / ".github" / "workflows" / "ci.yml")
    filtres = ci.split("            edge:\n", 1)[1].split("\n\n", 1)[0].split("\n  cerbos:", 1)[0]
    for chemin in ("edge/**", "keycloak/**"):
        assert f"'{chemin}'" in filtres, chemin
    job = ci.split("\n  edge:\n", 1)[1].split("\n  core:\n", 1)[0]
    assert "needs.changes.outputs.edge == 'true'" in job
    assert "smoke_edge.py" in job and "nginx -t" in job


MAILLAGE = "cfao-maillage"
# Serveurs qui appellent des API du maillage sans être une API de module (liste nominative :
# une base ou un service nouveau reste refusé tant qu'il n'est pas ajouté ici, avec sa raison).
APPELANTS = {
    "keycloak",          # mails de Keycloak par le hub (mail-api)
    "needs-relay",       # pousse la copie des besoins à planning-api
    "planning-migrate",  # premier rattrapage de la copie des besoins depuis needs-api
    "cerbos",            # PDP commun en prod (cerbos/compose.prod.yml), joint par toutes les API
}


def _composes_du_maillage():
    # Fichiers suivis et nouveaux : un module en cours de création est contrôlé aussi.
    sortie = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "*compose*.yml", "*compose*.yaml"],
        cwd=RACINE, capture_output=True, text=True, check=True).stdout
    chemins = [f for f in sortie.splitlines() if (RACINE / f).is_file()]
    return {f: texte for f in chemins if "maillage" in (texte := _texte(RACINE / f))}


def _ecarts_maillage(composes):
    ecarts, modules_par_nom = [], {}
    for fichier, texte in composes.items():
        compose = yaml.safe_load(texte) or {}
        for cle, reseau in (compose.get("networks") or {}).items():
            # Nom différent = deux réseaux disjoints sans aucune erreur ;
            # `external` = un module ne démarre plus seul.
            if "maillage" in f"{cle} {(reseau or {}).get('name', '')}" and (cle, reseau) != (MAILLAGE, {"name": MAILLAGE}):
                ecarts.append(f"{fichier} : réseau {cle} = {reseau}")
        for nom, service in (compose.get("services") or {}).items():
            reseaux = service.get("networks") or []
            if MAILLAGE not in reseaux:
                continue
            if not nom.endswith("-api") and nom not in APPELANTS:
                ecarts.append(f"{fichier} : {nom} n'est pas une API, il reste hors du maillage")
            options = reseaux[MAILLAGE] if isinstance(reseaux, dict) else None
            for joignable in [nom, *((options or {}).get("aliases") or [])]:
                modules_par_nom.setdefault(joignable, set()).add(str(Path(fichier).parent))
    # Deux modules sous un même nom : la résolution DNS tomberait au hasard sur l'un ou l'autre.
    ecarts += [f"{n} porté par plusieurs modules : {sorted(m)}" for n, m in modules_par_nom.items() if len(m) > 1]
    return ecarts


def _compose(service="a-api", cle=MAILLAGE, reseau=None):
    return yaml.safe_dump({"services": {service: {"networks": ["default", cle]}},
                           "networks": {cle: reseau or {"name": MAILLAGE}}})


def test_maillage_inter_modules():
    composes = _composes_du_maillage()
    assert {"cfao-planning/docker-compose.yml", "cfao-needs/docker-compose.yml",
            "cfao-needs/docker-compose.prod.yml", "template-service/docker-compose.yml",
            "cfao-academy-mail/docker-compose.yml", "edge/compose.dev.yml"} <= set(composes)
    assert _ecarts_maillage(composes) == []


@pytest.mark.parametrize("composes", [
    {"a/c.yml": _compose(reseau={"name": MAILLAGE, "external": True})},
    {"a/c.yml": _compose(reseau={"name": "cfao-maillage-2"})},
    {"a/c.yml": _compose(cle="maillage")},
    {"a/c.yml": _compose(service="a-db")},
    {"a/c.yml": _compose(service="keycloak-db")},
    {"a/c.yml": _compose(), "b/c.yml": _compose()},
], ids=["external", "autre-nom", "autre-cle", "base-sur-le-reseau", "base-de-keycloak", "nom-en-double"])
def test_maillage_refuse_les_ecarts(composes):
    assert _ecarts_maillage(composes)


def test_maillage_accepte_dev_et_prod_d_un_meme_module():
    assert _ecarts_maillage({"a/docker-compose.yml": _compose(), "a/docker-compose.prod.yml": _compose()}) == []


SH = shutil.which("sh")
BASE = {"EDGE_LISTEN": "127.0.0.1:1", "EDGE_PUBLIC_PROTO": "https", "EDGE_PUBLIC_HOST": "academy.exemple",
        "EDGE_PUBLIC_PORT": "443", "EDGE_NEEDS_UPSTREAM": "127.0.0.1:2"}


def _lancer(script, sortie, **env):
    return subprocess.run([SH, str(EDGE / "entrypoint.d" / script)], capture_output=True, encoding="utf-8",
                          env={"PATH": os.environ["PATH"], "NGINX_ENVSUBST_OUTPUT_DIR": str(sortie), **BASE, **env})


def _maps(sortie, **env):
    r = _lancer("27-origines.sh", sortie, **env)
    assert r.returncode == 0, r.stderr
    texte = (sortie / "origines.conf").read_text(encoding="utf-8")
    maps = {}
    for nom, corps in re.findall(r"map \$edge_req_cle \$edge_req_(\w+) \{\n(.*?)\}", texte, re.S):
        maps[nom] = dict(re.findall(r'^\s+"?([^"\s]+)"? (\S+);$', corps, re.M))
    assert 'map $http_x_forwarded_host $edge_req_cle {\n    ""      $http_host;' in texte
    return maps


@pytest.mark.skipif(SH is None, reason="sh absent")
def test_origines_liste_blanche(tmp_path):
    # 0 origine : seule l'URL publique, quel que soit l'hôte reçu.
    assert _maps(tmp_path) == {n: {"default": v} for n, v in
                               (("proto", "https"), ("host", "academy.exemple"), ("port", "443"))}
    # 1 origine sur un port non standard : une seule clé hôte:port.
    m = _maps(tmp_path, EDGE_ORIGINES="https://192.168.10.155:8444")
    assert m["proto"] == {"default": "https", "192.168.10.155:8444": "https"}
    assert m["host"]["192.168.10.155:8444"] == "192.168.10.155" and m["port"]["192.168.10.155:8444"] == "8444"
    # 2 origines, port par défaut : clé avec et sans port ; majuscules ramenées.
    m = _maps(tmp_path, EDGE_ORIGINES="http://Recette.Local, https://10.0.0.1:8444")
    assert m["proto"] == {"default": "https", "recette.local:80": "http", "recette.local": "http",
                          "10.0.0.1:8444": "https"}
    assert m["port"]["recette.local"] == "80" and m["host"]["recette.local:80"] == "recette.local"


@pytest.mark.skipif(SH is None, reason="sh absent")
@pytest.mark.parametrize("env, motif", [
    ({"EDGE_ORIGINES": "ftp://h"}, "proto://hôte[:port]"),
    ({"EDGE_ORIGINES": "https://h/chemin"}, "proto://hôte[:port]"),
    ({"EDGE_ORIGINES": "https://h;evil"}, "proto://hôte[:port]"),
    ({"EDGE_ORIGINES": 'https://h"'}, "proto://hôte[:port]"),
    ({"EDGE_ORIGINES": "https://h https://H:443"}, "en double"),
    ({"EDGE_ORIGINES": "https://h http://h"}, "en double"),
    ({"EDGE_RACINE": "autre"}, "needs ou portail"),
    ({"EDGE_RACINE": "portail"}, "EDGE_PORTAIL_UPSTREAM vide"),
    ({"EDGE_PUBLIC_HOST": "h;x"}, "nom d'hôte"),
    ({"EDGE_PUBLIC_PORT": "44a"}, "n'est pas un port"),
])
def test_origines_et_racine_invalides_bloquent_le_demarrage(tmp_path, env, motif):
    r = _lancer("05-exiger-variables.sh", tmp_path, **env)
    assert r.returncode != 0 and motif in r.stderr, r.stderr


@pytest.mark.skipif(SH is None, reason="sh absent")
def test_origines_et_racine_valides_acceptees(tmp_path):
    r = _lancer("05-exiger-variables.sh", tmp_path, EDGE_RACINE="portail", EDGE_PORTAIL_UPSTREAM="127.0.0.1:3",
                EDGE_ORIGINES="https://192.168.10.155:8444 https://192.168.10.155 http://192.168.10.155:8080")
    assert r.returncode == 0, r.stderr
