import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from django.core.management import call_command

from supervision.collectors import docker_client, docker_collector
from supervision.models import Container, ContainerEvent, Module

from .conftest import summary

pytestmark = pytest.mark.django_db
MODULE_DIR = Path(__file__).resolve().parents[3]
T0 = datetime(2026, 11, 19, 9, 0, tzinfo=timezone.utc)


@pytest.fixture
def docker(monkeypatch):
    """Faux Docker : `state["list"]` pilote la liste ; tout autre appel au proxy est noté."""
    state = {"list": [], "paths": []}
    monkeypatch.setattr(docker_client, "list_containers", lambda: state["list"])
    monkeypatch.setattr(docker_client, "_get", lambda path, params=None, raw=False: state["paths"].append(path))
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
                                     {"IP": "::", "PrivatePort": 8000, "PublicPort": 8092, "Type": "tcp"},
                                     {"PrivatePort": 9000, "Type": "tcp"}])]
    docker_collector.collect(now=T0)
    container = Container.objects.get()
    assert container.module.project == "cfao-needs"
    assert (container.state, container.health, container.image_tag) == ("running", "healthy", "1.4.0")
    assert container.changelog.startswith("## 1.4.0")
    assert container.provides == "needs-analytics@1.5.0"
    assert container.depends_on == ["needs-db"]
    assert container.exposed == ["9000/tcp"]
    assert container.started_at == T0 - timedelta(minutes=1)
    assert len(container.ports) == 2  # 127.0.0.1 et toutes interfaces


def test_seule_la_liste_est_demandee_au_proxy(docker):
    """Jamais d'inspect : il renverrait l'Env (secrets) de chaque conteneur."""
    docker["list"] = [summary("cfao-needs", "needs-api")]
    docker_collector.collect()
    docker["list"] = [summary("cfao-needs", "needs-api", state="exited", status="Exited (1) 2 seconds ago")]
    result = docker_collector.collect()
    assert docker["paths"] == []
    assert result["changed"] == 1
    result = docker_collector.collect()
    assert (result["changed"], result["events"]) == (0, 0)


@pytest.mark.parametrize("compose", ["docker-compose.yml", "docker-compose.prod.yml"])
def test_proxy_du_socket_sans_inspect(compose):
    text = (MODULE_DIR / compose).read_text(encoding="utf-8")
    allow = re.search(r'-allowGET=(\S+?)"', text).group(1)
    allow = allow.replace("${SUPERVISION_EDGE_CONTAINER:-", "").replace("}/logs", "/logs")
    pattern = re.compile(allow)
    assert pattern.match("/v1.47/containers/json")
    assert not pattern.match("/v1.47/containers/0123abcd/json")
    assert not pattern.match("/containers/cfao-needs-needs-api-1/json")


@pytest.mark.parametrize("status, age", [
    ("Up 5 seconds", 5), ("Up About a minute (healthy)", 60), ("Up 3 hours (unhealthy)", 10800),
    ("Up Less than a second", 0), ("Exited (0) 2 days ago", 172800), ("Exited (137) About an hour ago", 3600),
    ("Restarting (1) 4 seconds ago", 4), ("Created", None), ("", None),
])
def test_age_lu_dans_le_statut(status, age):
    assert docker_collector.age_from_status(status) == age


def test_redemarrages_comptes_sur_le_meme_conteneur(docker):
    docker["list"] = [summary("cfao-needs", "needs-api")]
    docker_collector.collect(now=T0)
    for state, status in [("restarting", "Restarting (1) 1 second ago"), ("running", "Up 2 seconds"),
                          ("exited", "Exited (1) 1 second ago"), ("running", "Up 1 second")]:
        docker["list"] = [summary("cfao-needs", "needs-api", state=state, status=status)]
        docker_collector.collect(now=T0)
    assert Container.objects.get().restart_count == 2
    docker["list"] = [summary("cfao-needs", "needs-api", cid="recree")]
    docker_collector.collect(now=T0)
    assert Container.objects.get().restart_count == 0


def test_arret_puis_disparition_journalises(docker):
    docker["list"] = [summary("cfao-needs", "needs-api")]
    docker_collector.collect(now=T0)
    docker["list"] = [summary("cfao-needs", "needs-api", state="exited", status="Exited (1) 3 seconds ago")]
    docker_collector.collect(now=T0)
    container = Container.objects.get()
    assert (container.state, container.exit_code) == ("exited", 1)
    assert container.finished_at == T0 - timedelta(seconds=3)
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
