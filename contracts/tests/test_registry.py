"""Tests du registre de contrats : règles semver, labels, can-i-deploy, couverture CI."""

import fnmatch
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import can_i_deploy  # noqa: E402
import check  # noqa: E402
import kit  # noqa: E402
import sync  # noqa: E402

CI = kit.ROOT / ".github" / "workflows" / "ci.yml"
NS = "org.cfao"


@pytest.mark.parametrize(
    ("version", "version_range", "expected"),
    [
        ("1.0.0", "^1", True),
        ("1.4.2", "^1.2", True),
        ("1.1.9", "^1.2", False),
        ("2.0.0", "^1", False),
        ("0.1.0", "0.1.0", True),
        ("0.1.1", "0.1.0", False),
    ],
)
def test_satisfies(version, version_range, expected):
    assert kit.satisfies(version, version_range) is expected


def test_label_round_trip():
    pairs = {"needs-analytics": "1.0.0", "mail-outbound": "0.1.0"}
    assert kit.parse_label(kit.format_label(pairs)) == pairs
    assert kit.parse_label("") == {}


def test_label_keys_follow_declared_namespace():
    assert kit.label_keys({"label_namespace": "com.acme"}) == (
        "com.acme.module", "com.acme.contracts.provides", "com.acme.contracts.consumes",
    )


@pytest.mark.parametrize(
    ("image", "repository"),
    [
        ("antifragile237/cfao-needs-api:v0.1.2", "antifragile237/cfao-needs-api"),
        ("registre:5000/org/app:v1@sha256:abc", "registre:5000/org/app"),
        ("app", "app"),
    ],
)
def test_image_repository(image, repository):
    assert kit.image_repository(image) == repository


def test_registry_is_consistent():
    assert check.check(base=None, require_tool=False) == []


# --- check : évolution et découverte de la base ---------------------------------

def _spec(version: str) -> dict:
    return {"info": {"version": version}, "paths": {"/x": {}}}


def _evolution(previous, spec, breaking, require_tool=True):
    return check.evolution_errors("c", previous, spec, kit.FORMATS["openapi"], breaking, require_tool)


def test_unchanged_or_new_contract_is_accepted():
    assert _evolution(None, _spec("1.0.0"), lambda: []) == []
    assert _evolution(_spec("1.0.0"), _spec("1.0.0"), lambda: ["x"]) == []


def test_change_without_version_bump_is_refused():
    changed = {**_spec("1.0.0"), "paths": {"/y": {}}}
    assert "sans hausse de version" in _evolution(_spec("1.0.0"), changed, lambda: [])[0]


def test_breaking_change_requires_major():
    assert _evolution(_spec("1.0.0"), _spec("1.1.0"), lambda: ["removed /x"])[0].startswith("c : rupture sans hausse de MAJOR")
    assert _evolution(_spec("1.0.0"), _spec("2.0.0"), lambda: ["removed /x"]) == []
    assert _evolution(_spec("1.0.0"), _spec("1.1.0"), lambda: []) == []


def test_missing_tool_fails_only_when_required():
    assert _evolution(_spec("1.0.0"), _spec("1.1.0"), lambda: None, True)
    assert _evolution(_spec("1.0.0"), _spec("1.1.0"), lambda: None, False) == []


def test_base_is_discovered_from_ci_environment():
    assert check.discover_base({"GITHUB_BASE_REF": "develop"}) == "origin/develop"


def test_unknown_format_is_refused(monkeypatch):
    registry = kit.load_registry()
    registry["contracts"][0] = {**registry["contracts"][0], "format": "graphql"}
    monkeypatch.setattr(kit, "load_registry", lambda: registry)
    assert any("format inconnu 'graphql'" in error for error in check.check(base=None, require_tool=False))


# --- sync : réconciliation idempotente des Dockerfiles ---------------------------

LABELS = {f"{NS}.module": "m", f"{NS}.contracts.provides": "c@1.0.0"}


def test_sync_inserts_block_after_last_from_and_converges():
    text = "FROM python AS build\nRUN make\n\nFROM python\nCMD run\n"
    once, conflicts = sync.reconcile(text, LABELS, NS)
    assert conflicts == []
    assert once.index(sync.MARK_BEGIN) > once.index("FROM python\n")
    assert once.index(sync.MARK_BEGIN) < once.index("CMD run")
    assert sync.reconcile(once, LABELS, NS) == (once, [])


def test_sync_updates_only_its_block():
    once, _ = sync.reconcile("FROM python\nLABEL vendor=x\n", LABELS, NS)
    updated, _ = sync.reconcile(once, {**LABELS, f"{NS}.contracts.provides": "c@1.1.0"}, NS)
    assert 'c@1.1.0' in updated and 'c@1.0.0' not in updated
    assert updated.replace("c@1.1.0", "c@1.0.0") == once


def test_sync_reports_foreign_labels_of_the_namespace():
    text = 'FROM python\nLABEL vendor="x" \\\n      org.cfao.module="m"\n'
    _, conflicts = sync.reconcile(text, LABELS, NS)
    assert conflicts == ["label org.cfao.module hors du bloc géré"]


def test_sync_keeps_crlf_and_needs_a_from():
    once, _ = sync.reconcile("FROM python\r\nCMD run\r\n", LABELS, NS)
    assert "\n" not in once.replace("\r\n", "")
    assert sync.reconcile("CMD run\n", LABELS, NS) == ("CMD run\n", ["aucune instruction FROM"])


def test_repository_dockerfiles_are_converged():
    assert sync.sync(write=False) == ([], [])


# --- can-i-deploy : deux sens, images antérieures au registre ---------------------

REGISTRY = {
    "label_namespace": NS,
    "modules": {
        "cfao-needs": {"images": ["antifragile237/cfao-needs-api"]},
        "cfao-core": {"images": ["antifragile237/cfao-core-api"]},
    },
    "contracts": [
        {"id": "needs-analytics", "provider": "cfao-needs", "consumers": [{"module": "cfao-core", "range": "^1"}]},
    ],
}


def _labels(module, provides="", consumes=""):
    labels = {f"{NS}.module": module}
    if provides:
        labels[f"{NS}.contracts.provides"] = provides
    if consumes:
        labels[f"{NS}.contracts.consumes"] = consumes
    return labels


def _container(image, labels=None):
    return {"image": image, "labels": labels or {}}


RUNNING = {
    "needs-api": _container("antifragile237/cfao-needs-api:v1", _labels("cfao-needs", provides="needs-analytics@1.0.0")),
    "core-api": _container("antifragile237/cfao-core-api:v1", _labels("cfao-core", consumes="needs-analytics@^1")),
    "postgres": _container("postgres:16"),
}
NEEDS, CORE = "antifragile237/cfao-needs-api:new", "antifragile237/cfao-core-api:new"


def _evaluate(image, labels, running=RUNNING, allow_missing=False):
    return can_i_deploy.evaluate(image, labels, running, REGISTRY, allow_missing)


def test_compatible_deploy():
    assert _evaluate(NEEDS, _labels("cfao-needs", provides="needs-analytics@1.3.0")) == ([], [], [])
    assert _evaluate(CORE, _labels("cfao-core", consumes="needs-analytics@^1")) == ([], [], [])


def test_provider_major_breaks_running_consumer():
    errors, _, _ = _evaluate(NEEDS, _labels("cfao-needs", provides="needs-analytics@2.0.0"))
    assert errors == ["cfao-needs fournirait needs-analytics@2.0.0 mais core-api attend ^1"]


def test_consumer_needs_newer_provider():
    errors, _, _ = _evaluate(CORE, _labels("cfao-core", consumes="needs-analytics@^1.2"))
    assert errors == ["cfao-core consomme needs-analytics@^1.2 mais needs-api fournit 1.0.0"]


def test_missing_provider():
    candidate = _labels("cfao-core", consumes="needs-analytics@^1")
    running = {"core-api": RUNNING["core-api"]}
    assert _evaluate(CORE, candidate, running)[0]
    assert _evaluate(CORE, candidate, running, allow_missing=True)[0] == []


def test_unregistered_image_is_unknown():
    errors, unknown, _ = _evaluate("autre/app:1", {})
    assert errors == [] and "module inconnu" in unknown[0]


def test_legacy_provider_without_labels_is_unknown_not_missing():
    running = {**RUNNING, "needs-api": _container("antifragile237/cfao-needs-api:v0.1.2")}
    errors, unknown, _ = _evaluate(CORE, _labels("cfao-core", consumes="needs-analytics@^1"), running)
    assert errors == []
    assert unknown == ["cfao-core consomme needs-analytics@^1 : version servie par needs-api inconnue (sans labels)"]


def test_legacy_consumer_without_labels_is_unknown():
    running = {**RUNNING, "core-api": _container("antifragile237/cfao-core-api:v0.9")}
    errors, unknown, _ = _evaluate(NEEDS, _labels("cfao-needs", provides="needs-analytics@2.0.0"), running)
    assert errors == [] and "plage attendue par core-api inconnue" in unknown[0]


def test_legacy_candidate_is_identified_but_unknown():
    _, unknown, _ = _evaluate("antifragile237/cfao-needs-api:v0.1.2", {})
    assert unknown == ["antifragile237/cfao-needs-api:v0.1.2 : image de cfao-needs sans labels de contrat"]


# --- CI ---------------------------------------------------------------------------

def _ci_filter(name: str) -> list[str]:
    """Motifs d'un filtre dorny/paths-filter de ci.yml."""
    text = CI.read_text(encoding="utf-8")
    block = re.search(rf"^            {re.escape(name)}:\n((?:              - .+\n)+)", text, re.MULTILINE)
    assert block, f"filtre {name} absent de ci.yml"
    return re.findall(r"- '([^']+)'", block.group(1))


def _covered(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, pattern.replace("**/", "*").replace("**", "*")) for pattern in patterns)


def test_ci_filter_covers_every_registry_path():
    patterns = _ci_filter("contracts")
    registry = kit.load_registry()
    paths = ["contracts/registry.json"]
    paths += [module["dockerfile"] for module in registry["modules"].values()]
    for entry in registry["contracts"]:
        paths.append(entry["spec"])
        for consumer in entry["consumers"]:
            paths += consumer["client_files"] + consumer["tests"]
    assert [path for path in paths if not _covered(path, patterns)] == []
