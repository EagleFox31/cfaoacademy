"""Cohérence statique de cfao-edge (sans docker) : routes, journaux, variables."""
import re
import subprocess
from pathlib import Path

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
    assert trouvees == sorted(["/", "/", "/auth/", "/auth", r"^/auth/(realms/cfao|resources)/", "/cr", "/cr/"])


def test_needs_transparent():
    modele = _texte(EDGE / "templates" / "racine" / "needs.conf.template")
    bloc = modele.split("location / {", 1)[1]
    assert "X-Forwarded" not in bloc, "/ doit relayer les en-têtes reçus tels quels"


def test_ecoutes_lan_sans_auth_ni_hsts():
    # Le LAN est en http direct : ni Keycloak (URL publique seule), ni HSTS.
    lan = sorted((EDGE / "templates" / "lan").glob("*.conf.template"))
    assert [m.name for m in lan] == ["cr.conf.template", "needs.conf.template"]
    for m in lan:
        code = "\n".join(ligne for ligne in _texte(m).splitlines() if not ligne.lstrip().startswith("#"))
        for interdit in ("auth", "edge_hsts", "EDGE_PUBLIC"):
            assert interdit not in code, (m.name, interdit)
    cr = _texte(EDGE / "templates" / "lan" / "cr.conf.template")
    assert "set $edge_fwd_proto http;" in cr
    generateur = _texte(EDGE / "entrypoint.d" / "26-ecoutes-lan.sh")
    assert "absolute_redirect off" in generateur and "location" not in generateur


def test_modules_sous_prefixe_recoivent_l_url_du_bloc_server():
    cr = _texte(EDGE / "templates" / "routes" / "cr.conf.template")
    assert "EDGE_PUBLIC" not in cr
    for v in ("$edge_fwd_proto", "$edge_fwd_host", "$edge_fwd_port"):
        assert v in cr
        assert f"set {v} " in _texte(EDGE / "templates" / "edge.conf.template")
        assert f"set {v} " in _texte(EDGE / "templates" / "lan" / "cr.conf.template")


def test_chaque_proxy_pass_inclut_le_snippet_commun():
    for m in MODELES:
        for bloc in re.split(r"\n(?=\s*location )", _texte(m)):
            if "proxy_pass" in bloc:
                assert "snippets/proxy-commun.conf" in bloc, m.name


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
    optionnelles = {"EDGE_KEYCLOAK_UPSTREAM", "EDGE_CR_UPSTREAM"}
    for v in utilisees:
        assert v in compose, v
        assert re.search(rf"^{v}=", exemple, re.M), v
        assert v in exiger or v in optionnelles, v
    for v in utilisees - optionnelles:
        assert re.fullmatch(r"\$\{[A-Z_]+:\?.+\}", compose[v]), v
    for v in optionnelles | {"EDGE_LAN"}:
        assert compose[v].endswith(":-}"), v
    # Vide dans le modèle : une écoute LAN exige d'abord de libérer le port.
    assert re.search(r"^EDGE_LAN=$", exemple, re.M)


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
