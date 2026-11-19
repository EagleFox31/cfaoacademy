import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal

ALLOWED = {"platform_ops", "superadmin"}


@pytest.fixture
def fake_pdp(monkeypatch):
    """PDP de test : reproduit la politique supervision (testée pour de vrai dans cerbos/tests)."""
    calls = []

    def check(principal, kind, resource_id, attr, action):
        calls.append((principal["id"], kind, action))
        return kind.startswith("supervision_") and action == "read" and bool(ALLOWED & set(principal["roles"]))

    monkeypatch.setattr("core.authz.cerbos.check", check)
    return calls


def client_for(*roles):
    client = APIClient()
    client.force_authenticate(user=Principal(id="sub-test", roles=list(roles)))
    return client


@pytest.fixture
def ops(fake_pdp):
    return client_for("platform_ops")


@pytest.fixture
def trainer(fake_pdp):
    return client_for("trainer")


def summary(project, service, state="running", status="Up 2 minutes", number=1, cid=None, image="org/app:1.2.0",
            labels=None, ports=None, created=1_700_000_000):
    base = {"com.docker.compose.project": project, "com.docker.compose.service": service,
            "com.docker.compose.container-number": str(number)}
    base.update(labels or {})
    return {"Id": cid or f"id-{project}-{service}-{number}", "Names": [f"/{project}-{service}-{number}"],
            "Image": image, "ImageID": f"sha256:{image}", "Labels": base, "State": state, "Status": status,
            "Ports": ports or [], "Created": created, "HostConfig": {"NetworkMode": f"{project}_default"},
            "NetworkSettings": {"Networks": {f"{project}_default": {}}}}


def inspect_of(state="running", exit_code=0, started="2026-11-19T08:00:00.123456789Z",
               finished="0001-01-01T00:00:00Z", restart_policy="unless-stopped", restarts=0):
    return {"State": {"Status": state, "ExitCode": exit_code, "StartedAt": started, "FinishedAt": finished},
            "RestartCount": restarts, "HostConfig": {"RestartPolicy": {"Name": restart_policy}},
            "Config": {"ExposedPorts": {"8000/tcp": {}}, "Env": ["SECRET=ne-doit-jamais-sortir"]}}
