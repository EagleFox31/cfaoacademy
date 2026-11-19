import pytest
from django.core.management import call_command

from supervision.collectors import docker_client, docker_collector
from supervision.models import Container, ContainerEvent, Module

from .conftest import inspect_of, summary

pytestmark = pytest.mark.django_db


@pytest.fixture
def docker(monkeypatch):
    """Faux Docker : `state["list"]` et `state["inspect"]` pilotent les réponses."""
    state = {"list": [], "inspect": {}, "inspected": []}

    def inspect(cid):
        state["inspected"].append(cid)
        return state["inspect"].get(cid, inspect_of())

    monkeypatch.setattr(docker_client, "list_containers", lambda: state["list"])
    monkeypatch.setattr(docker_client, "inspect", inspect)
    call_command("bootstrap")
    return state


def test_seuls_les_projets_surveilles_sont_lus(docker):
    docker["list"] = [summary("cfao-needs", "needs-api"), summary("jellyfin", "jellyfin"),
                      {"Id": "x", "Labels": {}, "State": "running"}]
    result = docker_collector.collect()
    assert result["seen"] == 1
    assert list(Container.objects.values_list("service", flat=True)) == ["needs-api"]


def test_premiere_vue_complete_le_conteneur_sans_variables_d_environnement(docker):
    docker["list"] = [summary("cfao-needs", "needs-api", status="Up 1 minute (healthy)",
                              image="antifragile237/cfao-needs-api:1.4.0",
                              labels={"org.opencontainers.image.version": "1.4.0",
                                      "org.cfao.changelog": "## 1.4.0\n- Export Excel",
                                      "org.cfao.contracts.provides": "needs-analytics@1.5.0",
                                      "com.docker.compose.depends_on": "needs-db:service_healthy:false"},
                              ports=[{"IP": "127.0.0.1", "PrivatePort": 8000, "PublicPort": 8092, "Type": "tcp"},
                                     {"IP": "::", "PrivatePort": 8000, "PublicPort": 8092, "Type": "tcp"}])]
    docker_collector.collect()
    container = Container.objects.get()
    assert container.module.project == "cfao-needs"
    assert (container.state, container.health, container.image_tag) == ("running", "healthy", "1.4.0")
    assert container.changelog.startswith("## 1.4.0")
    assert container.provides == "needs-analytics@1.5.0"
    assert container.depends_on == ["needs-db"]
    assert container.exposed == ["8000/tcp"]
    assert container.started_at.year == 2026
    assert len(container.ports) == 2  # 127.0.0.1 et toutes interfaces
    stored = str(Container.objects.values().get())
    assert "ne-doit-jamais-sortir" not in stored


def test_sans_changement_ni_inspect_ni_evenement(docker):
    docker["list"] = [summary("cfao-needs", "needs-api")]
    docker_collector.collect()
    docker["inspected"].clear()
    result = docker_collector.collect()
    assert docker["inspected"] == []
    assert result["events"] == 0


def test_arret_puis_disparition_journalises(docker):
    docker["list"] = [summary("cfao-needs", "needs-api")]
    docker_collector.collect()
    docker["list"] = [summary("cfao-needs", "needs-api", state="exited", status="Exited (1) 3 seconds ago")]
    docker["inspect"] = {"id-cfao-needs-needs-api-1": inspect_of("exited", exit_code=1,
                                                                finished="2026-11-19T09:00:00Z")}
    docker_collector.collect()
    container = Container.objects.get()
    assert (container.state, container.exit_code) == ("exited", 1)
    docker["list"] = []
    docker_collector.collect()
    kinds = list(ContainerEvent.objects.order_by("id").values_list("kind", "before", "after"))
    assert kinds == [("state", "running", "exited"), ("absent", "exited", "absent")]
    docker_collector.collect()
    assert ContainerEvent.objects.count() == 2  # disparu une seule fois


def test_nouvelle_image_journalisee(docker):
    docker["list"] = [summary("cfao-needs", "needs-api", image="org/needs:1.4.0")]
    docker_collector.collect()
    docker["list"] = [summary("cfao-needs", "needs-api", image="org/needs:1.5.0", cid="nouvel-id")]
    docker_collector.collect()
    event = ContainerEvent.objects.get(kind="version")
    assert (event.before, event.after) == ("1.4.0", "1.5.0")


def test_projet_inconnu_du_referentiel_cree_a_la_volee(docker, settings):
    settings.SUPERVISION_PROJECTS = ["cfao-nouveau"]
    docker["list"] = [summary("cfao-nouveau", "api")]
    docker_collector.collect()
    assert Module.objects.get(project="cfao-nouveau").display_name == "cfao-nouveau"


def test_bootstrap_idempotent_et_sans_ecrasement():
    call_command("bootstrap")
    module = Module.objects.get(project="cfao-needs")
    module.display_name = "Renommé en production"
    module.save()
    count = Module.objects.count()
    call_command("bootstrap")
    assert Module.objects.count() == count
    assert Module.objects.get(project="cfao-needs").display_name == "Renommé en production"
    call_command("bootstrap", demo=True)
    assert Module.objects.filter(project="cfao-recette").exists()


def test_flux_multiplexe_docker():
    frame = lambda stream, text: bytes([stream, 0, 0, 0]) + len(text).to_bytes(4, "big") + text  # noqa: E731
    raw = frame(1, b'{"a":1}\n') + frame(2, b"erreur\n") + frame(1, b'{"b":2}\n')
    assert docker_client.demux(raw) == b'{"a":1}\n{"b":2}\n'
    assert docker_client.demux(b'{"tty":1}\n') == b'{"tty":1}\n'


def test_journaux_reserves_a_la_passerelle(monkeypatch, settings):
    paths = []
    monkeypatch.setattr(docker_client, "_get", lambda path, params=None, raw=False: paths.append(path) or b"")
    docker_client.edge_logs(0)
    assert paths == [f"/containers/{settings.SUPERVISION_EDGE_CONTAINER}/logs"]
    settings.SUPERVISION_EDGE_CONTAINER = ""
    assert docker_client.edge_logs(0) == []
