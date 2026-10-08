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
