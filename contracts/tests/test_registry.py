"""Tests du registre de contrats : règles semver, can-i-deploy, couverture CI."""

import fnmatch
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import can_i_deploy  # noqa: E402
import check  # noqa: E402
import kit  # noqa: E402

CI = kit.ROOT / ".github" / "workflows" / "ci.yml"


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


def test_registry_is_consistent():
    assert check.check(base=None, require_oasdiff=False) == []


def _spec(version: str) -> dict:
    return {"info": {"version": version}, "paths": {"/x": {}}}


def test_unchanged_or_new_contract_is_accepted():
    assert check.evolution_errors("c", None, _spec("1.0.0"), lambda: [], True) == []
    assert check.evolution_errors("c", _spec("1.0.0"), _spec("1.0.0"), lambda: ["x"], True) == []


def test_change_without_version_bump_is_refused():
    changed = {**_spec("1.0.0"), "paths": {"/y": {}}}
    assert "sans hausse de version" in check.evolution_errors("c", _spec("1.0.0"), changed, lambda: [], True)[0]


def test_breaking_change_requires_major():
    assert check.evolution_errors("c", _spec("1.0.0"), _spec("1.1.0"), lambda: ["removed /x"], True)[0].startswith(
        "c : rupture sans hausse de MAJOR"
    )
    assert check.evolution_errors("c", _spec("1.0.0"), _spec("2.0.0"), lambda: ["removed /x"], True) == []
    assert check.evolution_errors("c", _spec("1.0.0"), _spec("1.1.0"), lambda: [], True) == []


def test_missing_oasdiff_fails_only_when_required():
    assert check.evolution_errors("c", _spec("1.0.0"), _spec("1.1.0"), lambda: None, True)
    assert check.evolution_errors("c", _spec("1.0.0"), _spec("1.1.0"), lambda: None, False) == []


def _labels(module, provides="", consumes=""):
    return {kit.LABEL_MODULE: module, kit.LABEL_PROVIDES: provides, kit.LABEL_CONSUMES: consumes}


RUNNING = {
    "needs-api": _labels("cfao-needs", provides="needs-analytics@1.0.0"),
    "core-api": _labels("cfao-core", consumes="needs-analytics@^1"),
    "postgres": {},
}


def test_compatible_deploy():
    assert can_i_deploy.evaluate(_labels("cfao-needs", provides="needs-analytics@1.3.0"), RUNNING) == ([], [])
    assert can_i_deploy.evaluate(_labels("cfao-core", consumes="needs-analytics@^1"), RUNNING) == ([], [])


def test_provider_major_breaks_running_consumer():
    errors, _ = can_i_deploy.evaluate(_labels("cfao-needs", provides="needs-analytics@2.0.0"), RUNNING)
    assert errors == ["cfao-needs fournirait needs-analytics@2.0.0 mais core-api attend ^1"]


def test_consumer_needs_newer_provider():
    errors, _ = can_i_deploy.evaluate(_labels("cfao-core", consumes="needs-analytics@^1.2"), RUNNING)
    assert errors == ["cfao-core consomme needs-analytics@^1.2 mais needs-api fournit 1.0.0"]


def test_missing_provider():
    candidate = _labels("cfao-core", consumes="needs-analytics@^1")
    running = {"core-api": RUNNING["core-api"]}
    assert can_i_deploy.evaluate(candidate, running)[0]
    assert can_i_deploy.evaluate(candidate, running, allow_missing=True)[0] == []


def test_image_without_labels_is_unknown():
    assert "compatibilité inconnue" in can_i_deploy.evaluate({}, RUNNING)[0][0]


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
