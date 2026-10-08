"""Conservation des comptes rendus en cours, dans la base du service.

Memes regles que le stockage SQLite du service precedent : un brouillon
est un document JSON opaque range sous (proprietaire, id), la version la
plus recente l'emporte et une suppression n'est pas annulee par une copie
plus ancienne restee sur un poste.
"""
import re
from datetime import datetime, timezone

from django.db import transaction

from .models import Brouillon, Suppression
from .perimetre import perimetre_du_contenu

_IDENT = re.compile(r"[A-Za-z0-9._-]{1,80}")


def valide(ident):
    """Un identifiant sur : ni chemin, ni caractere de controle."""
    return bool(ident) and bool(_IDENT.fullmatch(str(ident)))


def maintenant():
    """L'instant present, au format des dates du navigateur (ISO, en Z)."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def lister(owner):
    """Les brouillons d'un proprietaire, du plus recent au plus ancien,
    et les suppressions (id -> date) pour que chaque poste les applique."""
    brouillons = [b.contenu for b in Brouillon.objects.filter(owner=owner).order_by("-modifie_le")]
    supprimes = dict(Suppression.objects.filter(owner=owner).values_list("ident", "le"))
    return brouillons, supprimes


def lire(owner, ident):
    b = Brouillon.objects.filter(owner=owner, ident=ident).first()
    return b.contenu if b else None


def ecrire(owner, ident, contenu):
    """Enregistre le brouillon ; la version la plus recente l'emporte.

    Deux postes ouverts sur le meme compte rendu : une ecriture plus
    ancienne que celle deja conservee est ignoree, et la version gardee
    est renvoyee pour que l'appelant se remette a jour.
    """
    contenu = dict(contenu)
    contenu.setdefault("modifieLe", maintenant())
    modifie_le = str(contenu["modifieLe"])
    with transaction.atomic():
        # Supprime ailleurs apres cette version : on ne le ressuscite pas.
        supprime = Suppression.objects.select_for_update().filter(owner=owner, ident=ident).first()
        if supprime and supprime.le >= modifie_le:
            return None, False
        if supprime:
            supprime.delete()
        actuel = Brouillon.objects.select_for_update().filter(owner=owner, ident=ident).first()
        if actuel and actuel.modifie_le > modifie_le:
            return actuel.contenu, False
        scope_node, brand = perimetre_du_contenu(contenu)
        Brouillon.objects.update_or_create(
            owner=owner, ident=ident,
            defaults={"contenu": contenu, "modifie_le": modifie_le,
                      "scope_node": scope_node, "brand": brand})
    return contenu, True


def supprimer(owner, ident):
    with transaction.atomic():
        Brouillon.objects.filter(owner=owner, ident=ident).delete()
        Suppression.objects.update_or_create(owner=owner, ident=ident, defaults={"le": maintenant()})
