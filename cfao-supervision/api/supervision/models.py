"""Modèle de la supervision : ce que le collecteur observe, ce que l'écran affiche.

Aucune donnée n'est saisie à la main : le référentiel `Module` vient de
`inventory/modules.json` (commande bootstrap, jamais d'écrasement), le reste est
écrit par le collecteur. Seule adresse IP conservée : celle d'un poste refusé
par le pare-feu (RefusedAttempt, 7 jours).
"""
from django.db import models


class Module(models.Model):
    """Un module de la plateforme = un projet compose."""

    project = models.CharField(max_length=64, unique=True)
    display_name = models.CharField(max_length=120)
    sort_order = models.PositiveIntegerField(default=100)
    hidden = models.BooleanField(default=False)
    # Clients Keycloak dont une connexion vaut « connexion à ce module ».
    oidc_clients = models.JSONField(default=list, blank=True)
    # Valeurs du champ `module` des journaux de la passerelle (edge).
    edge_modules = models.JSONField(default=list, blank=True)
    public_prefix = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        ordering = ["sort_order", "project"]

    def __str__(self) -> str:
        return self.project


class Container(models.Model):
    """Dernier état connu d'un conteneur (service compose + numéro de réplique)."""

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="containers")
    service = models.CharField(max_length=120)
    number = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=200, blank=True, default="")
    docker_id = models.CharField(max_length=80, blank=True, default="")

    image_ref = models.CharField(max_length=300, blank=True, default="")
    image_tag = models.CharField(max_length=120, blank=True, default="")
    image_id = models.CharField(max_length=100, blank=True, default="")
    version_label = models.CharField(max_length=120, blank=True, default="")
    revision = models.CharField(max_length=80, blank=True, default="")
    changelog = models.TextField(blank=True, default="")
    image_created_at = models.DateTimeField(null=True, blank=True)

    created_at_docker = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    state = models.CharField(max_length=20, default="unknown")  # running, exited, restarting, absent…
    health = models.CharField(max_length=20, blank=True, default="")  # healthy, unhealthy, starting, ""
    exit_code = models.IntegerField(null=True, blank=True)
    restart_policy = models.CharField(max_length=40, blank=True, default="")
    restart_count = models.PositiveIntegerField(default=0)

    ports = models.JSONField(default=list, blank=True)  # [{"host": "127.0.0.1", "public": 8097, "private": 8000, "proto": "tcp"}]
    exposed = models.JSONField(default=list, blank=True)  # ports écoutés sans publication
    network_mode = models.CharField(max_length=80, blank=True, default="")
    networks = models.JSONField(default=list, blank=True)
    provides = models.CharField(max_length=500, blank=True, default="")  # label org.cfao.contracts.provides
    consumes = models.CharField(max_length=500, blank=True, default="")  # label org.cfao.contracts.consumes
    depends_on = models.JSONField(default=list, blank=True)

    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["module__sort_order", "service", "number"]
        constraints = [
            models.UniqueConstraint(fields=["module", "service", "number"], name="supervision_container_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.module.project}/{self.service}-{self.number}"


class ContainerEvent(models.Model):
    """Journal append-only des changements (état, santé, version)."""

    KINDS = [("state", "state"), ("health", "health"), ("version", "version"), ("absent", "absent")]

    container = models.ForeignKey(Container, on_delete=models.CASCADE, related_name="events")
    at = models.DateTimeField(db_index=True)
    kind = models.CharField(max_length=20, choices=KINDS)
    before = models.CharField(max_length=200, blank=True, default="")
    after = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["-at", "-id"]


class CollectRun(models.Model):
    """Dernière exécution réussie ou ratée de chaque source, et son curseur."""

    source = models.CharField(max_length=20, unique=True)  # docker, edge, keycloak, retention
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    ok = models.BooleanField(default=False)
    error = models.CharField(max_length=500, blank=True, default="")
    cursor = models.CharField(max_length=100, blank=True, default="")


class KnownUser(models.Model):
    """Compte vu par la supervision (identifiant Keycloak) et son nom lisible."""

    subject = models.CharField(max_length=64, primary_key=True)
    username = models.CharField(max_length=150, blank=True, default="")
    last_seen_at = models.DateTimeField(null=True, blank=True)


class RefusedAttempt(models.Model):
    """Refus du pare-feu du serveur, regroupés par poste, port et tranche de 5 min.

    Seule table qui garde une adresse IP : celle du poste refusé, pour le retrouver.
    Oubliée après REFUSED_RETENTION_DAYS.
    """

    src_ip = models.GenericIPAddressField()
    dst_port = models.PositiveIntegerField(null=True, blank=True)
    proto = models.CharField(max_length=10, blank=True, default="")
    bucket = models.DateTimeField(db_index=True)  # début de la tranche (UTC)
    count = models.PositiveIntegerField(default=0)
    first_at = models.DateTimeField()
    last_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["src_ip", "dst_port", "proto", "bucket"],
                                    name="supervision_refused_unique"),
        ]


class PublicProbe(models.Model):
    """Dernier résultat de chaque sonde d'adresse publique (SUPERVISION_PROBES).

    Une sonde retirée de la configuration est effacée à la passe suivante.
    """

    url = models.CharField(max_length=300, unique=True)
    position = models.PositiveIntegerField(default=0)
    expected = models.CharField(max_length=300)  # fragment du titre, ou adresse de redirection
    redirect = models.BooleanField(default=False)
    ok = models.BooleanField(null=True)
    status_code = models.PositiveIntegerField(null=True, blank=True)
    # Motif traduit par l'écran (collectors/probes.py:check) ; vide = detail est le titre lu.
    reason = models.CharField(max_length=20, blank=True, default="")
    detail = models.CharField(max_length=200, blank=True, default="")  # titre lu, redirection ou classe d'erreur
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)
    last_ok_at = models.DateTimeField(null=True, blank=True)
    fails = models.PositiveIntegerField(default=0)  # échecs consécutifs


class UserModuleAccess(models.Model):
    """Dernière connexion et dernière activité d'un compte sur un module. Aucune IP."""

    user = models.ForeignKey(KnownUser, on_delete=models.CASCADE, related_name="accesses")
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="accesses")
    last_login_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "module"], name="supervision_access_unique"),
        ]
