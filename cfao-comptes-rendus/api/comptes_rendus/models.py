"""Les donnees propres au service des comptes rendus (base du service seule).

Chaque ligne porte son proprietaire (`owner` : `sub` Keycloak, ou id du
profil local en mode autonome) et, pour l'autorisation Cerbos, son
perimetre (`scope_node`, `brand`).
"""
from django.db import models


class Brouillon(models.Model):
    """Un compte rendu en cours : document JSON opaque, tel que le portail l'envoie."""
    owner = models.CharField(max_length=128)
    ident = models.CharField(max_length=80)
    contenu = models.JSONField()
    # Chaine ISO du navigateur, gardee telle quelle : « la plus recente
    # l'emporte » se decide par comparaison de chaines, comme avant.
    modifie_le = models.CharField(max_length=40, db_index=True)
    scope_node = models.CharField(max_length=64, blank=True, default="",
                                  help_text="Code agence ou filiale, ex: CMR ou CIV-ABJ")
    brand = models.CharField(max_length=64, blank=True, default="", help_text="Marque, ex: TOYOTA")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "ident"], name="brouillon_unique")]

    def __str__(self):
        return f"{self.ident} ({self.owner})"


class Suppression(models.Model):
    """Un brouillon supprime : sans elle, un poste qui en garde une copie le ferait revenir."""
    owner = models.CharField(max_length=128)
    ident = models.CharField(max_length=80)
    le = models.CharField(max_length=40)
    # La derniere revision du brouillon supprime ; inconnue (None) pour
    # une suppression anterieure aux revisions : seule la date departage.
    revision = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "ident"], name="suppression_unique")]


class Photo(models.Model):
    """Une photo envoyee ; le fichier reste sur disque (`rendu/photos.py`)."""
    owner = models.CharField(max_length=128)
    ident = models.CharField(max_length=32)
    scope_node = models.CharField(max_length=64, blank=True, default="")
    brand = models.CharField(max_length=64, blank=True, default="")
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "ident"], name="photo_unique")]


class TacheRapport(models.Model):
    """La production d'un rapport complet, suivie par le portail."""
    id = models.CharField(max_length=32, primary_key=True)
    owner = models.CharField(max_length=128)
    format = models.CharField(max_length=4)
    etat = models.CharField(max_length=10, default="en_cours")
    chemin = models.CharField(max_length=500, blank=True, default="")
    erreur = models.TextField(blank=True, default="")
    debut = models.FloatField()


class Erreur(models.Model):
    """Une erreur survenue chez un formateur, consultable par l'equipe technique.

    `origine` : « service » (rendu, rapport, route en echec) ou « portail »
    (ce que le navigateur a constate : delai, coupure, reponse en erreur).
    """
    le = models.DateTimeField(auto_now_add=True, db_index=True)
    origine = models.CharField(max_length=10)
    owner = models.CharField(max_length=128, blank=True, default="")
    nom = models.CharField(max_length=160, blank=True, default="")
    action = models.CharField(max_length=120)
    message = models.TextField(blank=True, default="")
    detail = models.TextField(blank=True, default="")
    contexte = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-le"]


# ── Referentiel des formations ─────────────────────────────────────────
# Alimente par l'import du fichier « Liste des participants » (voir
# `import_referentiel.py`). Le code d'une formation appartient au
# referentiel : seul l'administrateur le cree ou le corrige.

class Formation(models.Model):
    """Une formation du catalogue, reperee par son code (la « Reference » du fichier)."""
    code = models.CharField(max_length=40, unique=True)
    libelle = models.CharField(max_length=300, blank=True, default="")
    marque = models.CharField(max_length=80, blank=True, default="")
    type = models.CharField(max_length=40, blank=True, default="")
    seuil = models.PositiveSmallIntegerField(default=70)

    def __str__(self):
        return self.code


class Session(models.Model):
    """Une session : un numero du fichier (ex. M116-2026) a une date de debut donnee.

    `formation` reste vide tant que la Reference manque au fichier : la
    session est alors « a completer » et `libelle_fichier` garde la
    designation lue.
    """
    formation = models.ForeignKey(Formation, null=True, blank=True, on_delete=models.PROTECT,
                                  related_name="sessions")
    numero = models.CharField(max_length=40)
    debut = models.DateField()
    fin = models.DateField()
    lieu = models.CharField(max_length=200, blank=True, default="")
    pays = models.CharField(max_length=80, blank=True, default="")
    libelle_fichier = models.CharField(max_length=300, blank=True, default="")
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["numero", "debut"], name="session_unique")]
        ordering = ["-debut", "numero"]

    @property
    def jours(self):
        """Nombre de jours, bornes comprises. Plus de 5 : anomalie d'import, pas erreur de modele."""
        return (self.fin - self.debut).days + 1

    def __str__(self):
        return f"{self.numero} ({self.debut})"


class Stagiaire(models.Model):
    """Un stagiaire, reconnu par nom + prenom + pays normalises (`cle`)."""
    nom = models.CharField(max_length=120)
    prenom = models.CharField(max_length=120, blank=True, default="")
    pays = models.CharField(max_length=80, blank=True, default="")
    cle = models.CharField(max_length=320, unique=True)

    def __str__(self):
        return f"{self.nom} {self.prenom}".strip()


class Inscription(models.Model):
    """Un stagiaire dans une session. Jamais supprimee par l'import : on la marque absente."""
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="inscriptions")
    stagiaire = models.ForeignKey(Stagiaire, on_delete=models.PROTECT, related_name="inscriptions")
    absent = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["session", "stagiaire"], name="inscription_unique")]


class Animation(models.Model):
    """Un animateur d'une session, tel que nomme dans le fichier.

    `formateur_id` est l'id du compte (`request.user.id`) quand le nom
    correspond a un profil ; vide sinon, l'administrateur rattache.
    """
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="animations")
    nom_fichier = models.CharField(max_length=160)
    formateur_id = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["session", "nom_fichier"], name="animation_unique")]


class ImportReferentiel(models.Model):
    """La trace d'un import (essai ou application) et son rapport."""
    ESSAI, APPLIQUE = "essai", "applique"

    le = models.DateTimeField(auto_now_add=True)
    auteur = models.CharField(max_length=128, blank=True, default="")
    nom_fichier = models.CharField(max_length=255, blank=True, default="")
    etat = models.CharField(max_length=10, default=ESSAI)
    rapport = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-le"]
