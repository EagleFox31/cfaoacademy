"""scripts/build_image.py : étiquettes de version et de nouveautés des images."""
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import build_image  # noqa: E402

# Dockerfiles des modules publiés sur Docker Hub (frontend/ : à ajouter, voir CHANGELOG).
DOCKERFILES = [
    "cfao-supervision/api/Dockerfile", "cfao-planning/api/Dockerfile", "cfao-core/Dockerfile",
    "cfao-needs/api/Dockerfile", "cfao-needs/gateway/Dockerfile",
    "cfao-comptes-rendus/api/Dockerfile", "cfao-comptes-rendus/gateway/Dockerfile",
    "cerbos/Dockerfile", "edge/Dockerfile", "keycloak/Dockerfile",
]


def _changelog(tmp_path, body):
    path = tmp_path / "CHANGELOG.md"
    path.write_text(f"# Nouveautés\n\n## [0.2.0] - 2026-12-01\n\n{body}\n\n## [0.1.0] - 2026-11-19\n\n- ancienne\n",
                    encoding="utf-8")
    return path


@pytest.mark.parametrize("tag, attendu", [("v0.1.0", "0.1.0"), ("1.2.3", "1.2.3")])
def test_tag_semver(tag, attendu):
    assert build_image.semver(tag) == attendu


@pytest.mark.parametrize("tag", ["latest", "v1.2", "v1.2.3-rc1", "dev"])
def test_tag_refuse(tag):
    with pytest.raises(SystemExit):
        build_image.semver(tag)


def test_section_de_la_version_seule(tmp_path):
    section = build_image.changelog_section("v0.2.0", _changelog(tmp_path, "- nouvelle"))
    assert section == "- nouvelle"


def test_version_sans_section_refusee(tmp_path):
    with pytest.raises(SystemExit, match=r"## \[0\.3\.0\]"):
        build_image.changelog_section("v0.3.0", _changelog(tmp_path, "- x"))


def test_section_longue_coupee_sur_une_ligne(tmp_path):
    lignes = [f"- nouveauté numéro {i} avec un peu de texte" for i in range(300)]
    section = build_image.changelog_section("v0.2.0", _changelog(tmp_path, "\n".join(lignes)))
    assert len(section) <= build_image.CHANGELOG_MAX
    assert section.endswith("\n…")
    assert section[:-2].split("\n")[-1] in lignes


def test_commande(tmp_path, monkeypatch):
    monkeypatch.setattr(build_image, "revision", lambda context: "abc123-dirty")
    monkeypatch.setattr(build_image, "created", lambda: "2026-11-19T15:00:00Z")
    cmd = build_image.command(tmp_path, "antifragile237/cfao-x-api", "v0.2.0", _changelog(tmp_path, "- a"),
                              Path("api/Dockerfile"), ["--pull"])
    assert cmd[:6] == ["docker", "build", "-t", "antifragile237/cfao-x-api:v0.2.0", "--build-arg", "VERSION=v0.2.0"]
    labels = [cmd[i + 1] for i, part in enumerate(cmd) if part == "--label"]
    assert labels == ["org.opencontainers.image.version=v0.2.0",
                      "org.opencontainers.image.revision=abc123-dirty",
                      "org.opencontainers.image.created=2026-11-19T15:00:00Z",
                      "org.cfao.changelog=- a"]
    assert cmd[-4:] == ["-f", str(Path("api/Dockerfile")), "--pull", str(tmp_path)]


def test_date_du_commit_stable(monkeypatch):
    monkeypatch.setattr(build_image, "_git", lambda *args: "1795100400")
    assert build_image.created() == build_image.created() == "2026-11-19T15:00:00Z"


class _Run:
    def __init__(self, code, err=""):
        self.returncode, self.stderr, self.stdout = code, err, ""


def _main_reel(monkeypatch, manifest, *options):
    appels = []

    def run(cmd, **kwargs):
        appels.append(cmd[:2])
        return manifest if cmd[:2] == ["docker", "manifest"] else _Run(0)
    monkeypatch.setattr(build_image.subprocess, "run", run)
    monkeypatch.setattr(build_image, "revision", lambda context: "abc")
    monkeypatch.setattr(build_image, "created", lambda: "2026-11-19T15:00:00Z")
    monkeypatch.setattr(build_image, "exiger_verrou", lambda context, who: None)
    code = build_image.main(["cfao-supervision/api", "img", "v0.1.0", "--changelog",
                             str(ROOT / "cfao-supervision" / "CHANGELOG.md"), *options])
    return code, appels


def test_tag_deja_publie_refuse(monkeypatch):
    with pytest.raises(SystemExit, match="déjà publié"):
        _main_reel(monkeypatch, _Run(0))


def test_tag_deja_publie_force(monkeypatch):
    code, appels = _main_reel(monkeypatch, _Run(0), "--force")
    assert code == 0 and appels == [["docker", "build"]]


def test_tag_nouveau_construit(monkeypatch):
    code, appels = _main_reel(monkeypatch, _Run(1, "no such manifest: docker.io/img:v0.1.0"))
    assert code == 0 and appels == [["docker", "manifest"], ["docker", "build"]]


def test_registre_injoignable_bloque(monkeypatch):
    # Doute = pas de build : on ne republie pas un tag faute d'avoir pu vérifier.
    with pytest.raises(SystemExit, match="injoignable"):
        _main_reel(monkeypatch, _Run(1, "dial tcp: lookup registry-1.docker.io: no such host"))


def _verrou(monkeypatch, verrou):
    import coord
    monkeypatch.setattr(coord, "chemin_verrou", lambda ressource: ressource)
    monkeypatch.setattr(coord, "lire_verrou", lambda chemin: verrou)


def test_build_sans_nom_de_session_refuse():
    with pytest.raises(SystemExit, match="verrou requis"):
        build_image.exiger_verrou(ROOT / "cfao-supervision" / "api", "")


def test_build_sans_verrou_refuse(monkeypatch):
    _verrou(monkeypatch, None)
    with pytest.raises(SystemExit, match="n'est pas verrouillé"):
        build_image.exiger_verrou(ROOT / "cfao-supervision" / "api", "cf")


def test_build_avec_le_verrou_d_un_autre_refuse(monkeypatch):
    _verrou(monkeypatch, {"qui": "fd", "pourquoi": "lot"})
    with pytest.raises(SystemExit, match="pris par fd"):
        build_image.exiger_verrou(ROOT / "cfao-supervision" / "api", "cf")


def test_build_avec_son_verrou_passe(monkeypatch):
    _verrou(monkeypatch, {"qui": "cf", "pourquoi": "lot"})
    build_image.exiger_verrou(ROOT / "cfao-supervision" / "api", "cf")


def test_build_hors_du_depot_refuse(tmp_path):
    with pytest.raises(SystemExit, match="hors du dépôt"):
        build_image.exiger_verrou(tmp_path, "cf")


def test_dry_run_ne_lance_rien(capsys, monkeypatch):
    monkeypatch.setattr(build_image.subprocess, "run", None)  # un vrai build échouerait ici
    monkeypatch.setattr(build_image, "revision", lambda context: "abc")
    monkeypatch.setattr(build_image, "created", lambda: "2026-11-19T15:00:00Z")
    assert build_image.main(["cfao-supervision/api", "img", "v0.1.0", "--changelog",
                             str(ROOT / "cfao-supervision" / "CHANGELOG.md"), "--dry-run"]) == 0
    assert "org.cfao.changelog=" in capsys.readouterr().out


@pytest.mark.parametrize("dockerfile", DOCKERFILES)
def test_dockerfile_porte_la_version(dockerfile):
    texte = (ROOT / dockerfile).read_text(encoding="utf-8")
    assert re.search(r"^ARG VERSION=dev$", texte, re.M), dockerfile
    assert 'org.opencontainers.image.version="${VERSION}"' in texte, dockerfile


@pytest.mark.parametrize("module", ["cfao-supervision", "cfao-planning", "cfao-needs", "cfao-core",
                                    "cfao-comptes-rendus", "edge", "keycloak", "cerbos"])
def test_chaque_module_a_ses_nouveautes(module):
    texte = (ROOT / module / "CHANGELOG.md").read_text(encoding="utf-8")
    assert re.search(r"^## \[(Unreleased|\d+\.\d+\.\d+)\]", texte, re.M), module


def test_version_par_defaut_de_la_supervision_a_ses_nouveautes():
    compose = (ROOT / "cfao-supervision" / "docker-compose.prod.yml").read_text(encoding="utf-8")
    tag = re.search(r"SUPERVISION_VERSION:-(v[\d.]+)", compose).group(1)
    assert build_image.changelog_section(tag, ROOT / "cfao-supervision" / "CHANGELOG.md")
