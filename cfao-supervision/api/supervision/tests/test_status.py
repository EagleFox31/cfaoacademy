import pytest

from supervision import contracts
from supervision import status as rules


@pytest.mark.parametrize("state,health,code,service,expected", [
    ("running", "", None, "api", "ok"),
    ("running", "healthy", None, "api", "ok"),
    ("running", "starting", None, "api", "starting"),
    ("running", "unhealthy", None, "api", "degraded"),
    ("restarting", "", 1, "api", "crashloop"),
    ("exited", "", 0, "planning-migrate", "done"),
    ("exited", "", 0, "config", "done"),
    ("exited", "", 1, "planning-migrate", "down"),
    ("exited", "", 0, "api", "down"),  # un service permanent arrêté reste une panne
    ("exited", "", 137, "api", "down"),
    ("dead", "", None, "api", "down"),
    ("paused", "", None, "api", "down"),
])
def test_etat_conteneur(state, health, code, service, expected):
    assert rules.container_status(state, health, code, service) == expected


def test_etat_module_est_le_pire():
    assert rules.module_status(["ok", "done", "starting"]) == "starting"
    assert rules.module_status(["ok", "degraded"]) == "degraded"
    assert rules.module_status(["ok", "down", "degraded"]) == "down"
    assert rules.module_status([]) == "down"


@pytest.mark.parametrize("ref,tag", [
    ("antifragile237/cfao-needs-api:1.4.0", "1.4.0"),
    ("registry:5000/org/app:2.0.1@sha256:abc", "2.0.1"),
    ("postgres", "latest"),
    ("sha256:deadbeef", ""),
])
def test_etiquette_image(ref, tag):
    assert rules.image_tag(ref) == tag


@pytest.mark.parametrize("tag,label,expected", [
    ("1.4.0", "", ("1.4.0", None)),
    ("1.4.0", "1.4.0", ("1.4.0", None)),
    ("1.4.0", "v1.4.0", ("1.4.0", None)),
    ("1.4.0", "1.5.0", ("1.4.0", "1.5.0")),
    ("latest", "1.5.0", ("1.5.0", None)),
    ("recette", "dev", (None, None)),
    ("latest", "", (None, None)),
])
def test_version_affichee(tag, label, expected):
    assert rules.version_display(tag, label) == expected


NS = ("antifragile237/",)


@pytest.mark.parametrize("image_ref,expected", [
    ("cfao-planning-planning-api", True),            # construite par le projet
    ("antifragile237/cfao-planning-api:v0.3.0", True),
    ("registre:5000/antifragile237/cfao-x:1.0", False),  # autre registre : pas l'espace déclaré
    ("postgres:16-alpine", False),
    ("ghcr.io/cerbos/cerbos:0.40.0", False),
    ("cfao-planning:latest", False),                 # même début, mais pas `<projet>-`
    ("sha256:4d94db6a48", False),
    ("", False),
])
def test_image_de_la_plateforme(image_ref, expected):
    assert rules.is_own_image(image_ref, "cfao-planning", NS) is expected


def test_version_du_module_ignore_les_images_tierces():
    """Régression : l'API en « dev » laissait la base postgres donner « 16-alpine »."""
    containers = [
        {"image_ref": "cfao-planning-planning-api", "image_tag": "latest", "version_label": "dev"},
        {"image_ref": "postgres:16-alpine", "image_tag": "16-alpine", "version_label": ""},
    ]
    assert rules.module_version(containers, "cfao-planning", NS) == (None, None)


def test_version_du_module_publiee():
    containers = [
        {"image_ref": "ghcr.io/cerbos/cerbos:0.40.0", "image_tag": "0.40.0", "version_label": "0.40.0"},
        {"image_ref": "antifragile237/cfao-needs-api:v0.1.2", "image_tag": "v0.1.2", "version_label": "0.1.0"},
    ]
    assert rules.module_version(containers, "cfao-needs", NS) == ("v0.1.2", "0.1.0")


@pytest.mark.parametrize("version,version_range,expected", [
    ("1.5.0", "^1", True),
    ("1.5.0", "^1.5", True),
    ("1.4.9", "^1.5", False),
    ("2.0.0", "^1", False),
    ("0.2.0", "0.2.0", True),
    ("0.2.1", "0.2.0", False),
    ("dev", "^1", None),
])
def test_accord_de_versions_aligne_sur_contracts_kit(version, version_range, expected):
    assert contracts.satisfies(version, version_range) is expected


def test_lecture_label_de_contrat():
    assert contracts.parse_label("a@1.0.0, b@^2") == {"a": "1.0.0", "b": "^2"}
    assert contracts.parse_label("") == {}
