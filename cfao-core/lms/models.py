"""LMS — socle acquisition : catalogue de formation.

Le catalogue est **global** (pas scopé org) et aligné sur le référentiel MEDACAP :
marque × groupe fonctionnel × palier (Junior/Senior/Expert). L'inscription d'un
apprenant (scopée) viendra à l'incrément suivant.
"""
from django.db import models

from core.models import ScopedModel, TimeStampedModel, UUIDModel

LEVELS = [("junior", "Junior"), ("senior", "Senior"), ("expert", "Expert")]
ENROLL_STATUS = [("assigned", "Attribué"), ("in_progress", "En cours"), ("completed", "Terminé")]
MODULE_KINDS = [
    ("elearning", "E-learning"),
    ("video", "Vidéo"),
    ("interactive", "Exercice interactif"),
    ("quiz", "QCM"),
]


class Course(UUIDModel, TimeStampedModel):
    """Cours du catalogue — aligné MEDACAP (marque · GF · palier)."""

    title = models.CharField(max_length=255)
    brand = models.CharField(max_length=64, blank=True)              # code marque (MEDACAP)
    functional_group = models.CharField(max_length=128, blank=True)  # GF / spécialité
    level = models.CharField(max_length=16, choices=LEVELS, blank=True)
    summary = models.TextField(blank=True)
    published = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Module(UUIDModel, TimeStampedModel):
    """Brique pédagogique ordonnée d'un cours (e-learning, vidéo, exercice, QCM)."""

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=MODULE_KINDS, default="elearning")
    content_ref = models.CharField(max_length=255, blank=True)       # SCORM / URL / id contenu

    class Meta:
        ordering = ["course", "order"]

    def __str__(self):
        return f"{self.course.title} · {self.order}. {self.title}"


class Enrollment(ScopedModel):
    """Inscription d'un apprenant à un cours — ressource SCOPÉE (périmètre de l'apprenant).

    `org_path` = scope_paths de l'apprenant (renseigné côté serveur) → un manager voit les
    inscriptions de son équipe ; l'apprenant voit/met à jour les siennes (règle « self »).
    """

    learner_sub = models.CharField(max_length=64)  # keycloak sub de l'apprenant
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=16, choices=ENROLL_STATUS, default="assigned")
    progress_pct = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("learner_sub", "course")]

    def __str__(self):
        return f"{self.learner_sub} · {self.course.title} ({self.progress_pct}%)"
