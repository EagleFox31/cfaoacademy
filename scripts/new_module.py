#!/usr/bin/env python3
"""Générateur de module — l'« usine à apps » (étape 2).

Scaffolde un module Django **sécurisé par défaut** dans cfao-core + sa policy Cerbos
+ ses tests (dont les tests NÉGATIFS d'autorisation), à partir du patron /me.

Usage :
    python scripts/new_module.py <module> <Resource> [--route <slug>] [--dry-run]

Exemple :
    python scripts/new_module.py catalog Course
        → cfao-core/catalog/ (models/serializers/views/urls/tests)
        → cerbos/policies/resource_policies/course.yaml + cerbos/tests/course_test.yaml
        → câble "catalog" dans INSTALLED_APPS et la route dans config/urls.py

--dry-run : rend les fichiers dans un dossier temporaire, compile le Python, n'écrit
            rien dans l'arbre et ne câble rien (validation des gabarits).
"""
from __future__ import annotations

import argparse
import py_compile
import re
import sys
import tempfile
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / "cfao-core"
CERBOS = ROOT / "cerbos"


def camel_to_snake(name: str) -> str:
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s).lower()


# ── Gabarits ($placeholders) ─────────────────────────────────────────
T = {
    "cfao-core/$module/__init__.py": "",
    "cfao-core/$module/apps.py": """from django.apps import AppConfig


class ${ModuleCap}Config(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "$module"
""",
    "cfao-core/$module/models.py": """from django.db import models

from core.models import ScopedModel


class $Resource(ScopedModel):
    \"\"\"Ressource $kind du module $module — hérite du périmètre org (org_path/department/brand).\"\"\"

    name = models.CharField(max_length=255)
    # TODO: champs métier

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
""",
    "cfao-core/$module/serializers.py": """from rest_framework import serializers

from .models import $Resource


class ${Resource}Serializer(serializers.ModelSerializer):
    class Meta:
        model = $Resource
        fields = "__all__"
""",
    "cfao-core/$module/views.py": """from core.authz.viewsets import ScopedCerbosViewSet

from .models import $Resource
from .serializers import ${Resource}Serializer


class ${Resource}ViewSet(ScopedCerbosViewSet):
    \"\"\"CRUD $kind — PEP Cerbos (default-deny) + filtrage de liste par query plan.\"\"\"

    cerbos_resource_kind = "$kind"
    queryset = $Resource.objects.all()
    serializer_class = ${Resource}Serializer
""",
    "cfao-core/$module/urls.py": """from rest_framework.routers import SimpleRouter

from .views import ${Resource}ViewSet

router = SimpleRouter()
router.register(r"$route", ${Resource}ViewSet, basename="$kind")

urlpatterns = router.urls
""",
    "cfao-core/$module/tests/__init__.py": "",
    "cfao-core/$module/tests/test_$kind.py": """import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal

LIST_URL = "/api/v1/core/$route/"


def _principal(pid="u_1"):
    return Principal(id=pid, roles=["learner"], attr={"scopeNode": "groupe.cmr", "orgPath": ["groupe", "groupe.cmr"]})


@pytest.mark.django_db
def test_${kind}_anonyme_refuse():
    assert APIClient().get(LIST_URL).status_code in (401, 403)


@pytest.mark.django_db
def test_${kind}_liste_ok_si_plan_autorise(monkeypatch):
    monkeypatch.setattr("core.authz.viewsets.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_ALLOWED"})
    client = APIClient()
    client.force_authenticate(user=_principal())
    resp = client.get(LIST_URL)
    assert resp.status_code == 200


@pytest.mark.django_db
def test_${kind}_liste_vide_si_plan_refuse(monkeypatch):
    # Fail-closed : query plan « tout refusé » ⇒ liste vide, pas d'erreur.
    monkeypatch.setattr("core.authz.viewsets.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_DENIED"})
    client = APIClient()
    client.force_authenticate(user=_principal())
    resp = client.get(LIST_URL)
    assert resp.status_code == 200
    assert resp.json().get("results", []) == []
""",
    "cerbos/policies/resource_policies/$kind.yaml": """# Ressource « $kind » (module $module) — généré, default-deny.
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: default
  resource: $kind
  importDerivedRoles:
    - common_scope
  rules:
    - actions: ["view", "list"]
      effect: EFFECT_ALLOW
      derivedRoles:
        - within_org_scope
    - actions: ["create", "update", "delete"]
      effect: EFFECT_ALLOW
      derivedRoles:
        - admin_within_scope
""",
    "cerbos/tests/${kind}_test.yaml": """# Tests policy $kind (généré) — inclut le test NÉGATIF d'autorisation.
name: ${Resource}Suite
description: Contrôle d'accès $kind par périmètre org

principals:
  admin_cmr:
    id: a_1
    roles: ["branch_admin"]
    attr:
      scopeNode: "groupe.cmr"
      orgPath: ["groupe", "groupe.cmr"]
  admin_civ:
    id: a_2
    roles: ["branch_admin"]
    attr:
      scopeNode: "groupe.civ"
      orgPath: ["groupe", "groupe.civ"]

resources:
  ${kind}_cmr:
    kind: $kind
    id: r_1
    attr:
      orgPath: ["groupe", "groupe.cmr"]

tests:
  - name: admin voit la ressource DANS son périmètre
    input:
      principals: ["admin_cmr"]
      resources: ["${kind}_cmr"]
      actions: ["view", "update"]
    expected:
      - principal: admin_cmr
        resource: ${kind}_cmr
        actions: { "view": EFFECT_ALLOW, "update": EFFECT_ALLOW }

  - name: admin NE voit PAS hors de son périmètre (négatif)
    input:
      principals: ["admin_civ"]
      resources: ["${kind}_cmr"]
      actions: ["view", "update"]
    expected:
      - principal: admin_civ
        resource: ${kind}_cmr
        actions: { "view": EFFECT_DENY, "update": EFFECT_DENY }
""",
}


def render(ctx: dict) -> dict[str, str]:
    """Retourne {chemin_relatif: contenu} avec les placeholders substitués."""
    out = {}
    for path_tpl, body_tpl in T.items():
        path = Template(path_tpl).substitute(ctx)
        body = Template(body_tpl).substitute(ctx)
        out[path] = body
    return out


def wire(marker_file: Path, marker: str, line: str, present_check: str) -> str:
    """Insère `line` juste avant `marker` si `present_check` n'est pas déjà là. Idempotent."""
    text = marker_file.read_text(encoding="utf-8")
    if present_check in text:
        return "déjà câblé"
    if marker not in text:
        return f"ANCRE ABSENTE ({marker}) — câbler à la main"
    text = text.replace(marker, line + "\n    " + marker)
    marker_file.write_text(text, encoding="utf-8")
    return "câblé"


def main() -> int:
    ap = argparse.ArgumentParser(description="Générateur de module sécurisé (usine à apps).")
    ap.add_argument("module", help="nom du module Django (snake_case), ex. catalog")
    ap.add_argument("Resource", help="ressource principale (PascalCase), ex. Course")
    ap.add_argument("--route", help="slug d'URL (défaut: nom du module)")
    ap.add_argument("--dry-run", action="store_true", help="valide les gabarits sans rien écrire")
    args = ap.parse_args()

    module = args.module
    resource = args.Resource
    kind = camel_to_snake(resource)
    ctx = {
        "module": module,
        "Resource": resource,
        "ModuleCap": module.replace("_", " ").title().replace(" ", ""),
        "kind": kind,
        "route": args.route or module,
    }
    files = render(ctx)

    if args.dry_run:
        tmp = Path(tempfile.mkdtemp(prefix="newmod_"))
        print(f"[dry-run] rendu dans {tmp}\n")
        for rel, body in files.items():
            dest = tmp / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(body, encoding="utf-8")
            tag = ""
            if rel.endswith(".py") and body.strip():
                try:
                    py_compile.compile(str(dest), doraise=True)
                    tag = "  [ok] compile"
                except py_compile.PyCompileError as exc:
                    tag = f"  [ERR] {exc}"
            print(f"  {rel}{tag}")
        print("\n[dry-run] OK — aucun fichier écrit, aucun câblage.")
        return 0

    # Écriture réelle
    if (CORE / module).exists():
        print(f"ERREUR : le module {module} existe déjà ({CORE / module}).")
        return 1
    for rel, body in files.items():
        dest = ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(body, encoding="utf-8")
        print(f"  créé  {rel}")

    # Câblage idempotent
    apps_res = wire(
        CORE / "config/settings/base.py",
        "# <generated-apps>",
        f'"{module}",',
        f'"{module}",',
    )
    urls_res = wire(
        CORE / "config/urls.py",
        "# <generated-routes>",
        f'path("api/v1/core/", include("{module}.urls")),',
        f'include("{module}.urls")',
    )
    print(f"\n  INSTALLED_APPS : {apps_res}")
    print(f"  config/urls.py : {urls_res}")
    print(
        f"\nModule '{module}' généré (ressource {resource}/{kind}).\n"
        "Prochaines étapes :\n"
        f"  cd cfao-core && python manage.py makemigrations {module}\n"
        "  docker compose run --rm core-migrate   # ou `docker compose up` (AGENTS.md section 7)\n"
        f"  pytest {module}\n"
        f"  docker run --rm -v \"$PWD/cerbos:/cerbos\" ghcr.io/cerbos/cerbos:0.40.0 "
        "compile --tests=/cerbos/tests /cerbos/policies"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
