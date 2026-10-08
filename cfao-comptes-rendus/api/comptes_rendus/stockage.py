"""Conservation des comptes rendus en cours, dans la base du service.

Un brouillon est un document JSON opaque range sous (proprietaire, id).
Chaque ecriture recoit une revision ; une suppression retient la derniere,
pour qu'une copie restee sur un poste ne fasse pas revenir le brouillon.
Les revisions, et non l'heure des postes, departagent : l'horloge d'un
poste peut avancer ou retarder de plusieurs minutes.
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
    """Les brouillons d'un proprietaire, du plus recent au plus ancien, et
    les suppressions (id -> date, id -> revision supprimee) pour que chaque
    poste les applique."""
    brouillons = [b.contenu for b in Brouillon.objects.filter(owner=owner).order_by("-modifie_le")]
    traces = Suppression.objects.filter(owner=owner)
    supprimes = {s.ident: s.le for s in traces}
    revisions = {s.ident: s.revision for s in traces if s.revision is not None}
    return brouillons, supprimes, revisions


def copie_supprimee(supprime, base, modifie_le):
    """Une copie partie de la revision `base` descend-elle du brouillon supprime ?

    Une copie deja numerotee (`base` > 0) a vu une version que la
    suppression a retiree. Une copie jamais enregistree (`base` = 0) est un
    nouveau brouillon, sous le meme id : il est garde. Sans revision connue
    (suppression ancienne), seule la date departage.
    """
    if supprime.revision is None:
        return supprime.le >= modifie_le
    return base > 0


def lire(owner, ident):
    b = Brouillon.objects.filter(owner=owner, ident=ident).first()
    return b.contenu if b else None


def revision_de(contenu):
    try:
        return int((contenu or {}).get("revision") or 0)
    except (TypeError, ValueError):
        return 0


CONFLIT = "conflit"


def ecrire(owner, ident, contenu):
    """Enregistre le brouillon s'il prolonge la version conservee.

    Chaque ecriture acceptee recoit une revision (1, 2, 3...). L'appelant
    renvoie celle dont sa saisie est partie : si une autre ecriture est
    passee entre-temps — autre onglet, autre poste — sa copie est perimee
    et refusee (`CONFLIT`, avec la version gardee), quelle que soit sa
    date : l'horloge d'un poste ne dit pas qui a vu la derniere version.

    Un meme onglet (`ecrivain`) peut enchainer ses envois sans attendre
    la reponse du precedent : sa saisie prolonge sa propre ecriture.
    Entre deux de ses envois arrives dans le desordre, le plus ancien
    est ignore.
    """
    contenu = dict(contenu)
    contenu.setdefault("modifieLe", maintenant())
    modifie_le = str(contenu["modifieLe"])
    base = revision_de(contenu)
    with transaction.atomic():
        # Supprime ailleurs apres cette version : on ne le ressuscite pas.
        supprime = Suppression.objects.select_for_update().filter(owner=owner, ident=ident).first()
        if supprime and copie_supprimee(supprime, base, modifie_le):
            return None, False
        # Un brouillon qui revient repart apres la revision supprimee : les
        # numeros ne reculent jamais, sinon les copies des postes, plus
        # avancees, passeraient pour les plus recentes.
        plancher = (supprime.revision or 0) if supprime else 0
        if supprime:
            supprime.delete()
        actuel = Brouillon.objects.select_for_update().filter(owner=owner, ident=ident).first()
        if actuel:
            courante = revision_de(actuel.contenu)
            meme_ecrivain = bool(contenu.get("ecrivain")) \
                and actuel.contenu.get("ecrivain") == contenu.get("ecrivain")
            if base != courante and not meme_ecrivain:
                return actuel.contenu, CONFLIT
            if meme_ecrivain and actuel.modifie_le > modifie_le:
                return actuel.contenu, False
            contenu["revision"] = courante + 1
        else:
            contenu["revision"] = plancher + 1
        scope_node, brand = perimetre_du_contenu(contenu)
        Brouillon.objects.update_or_create(
            owner=owner, ident=ident,
            defaults={"contenu": contenu, "modifie_le": modifie_le,
                      "scope_node": scope_node, "brand": brand})
    return contenu, True


def supprimer(owner, ident):
    with transaction.atomic():
        actuel = Brouillon.objects.select_for_update().filter(owner=owner, ident=ident).first()
        ancienne = Suppression.objects.filter(owner=owner, ident=ident).first()
        # Jamais enregistre ici : aucune copie numerotee ne peut en descendre.
        revision = revision_de(actuel.contenu) if actuel else (ancienne.revision if ancienne else 0)
        if actuel:
            actuel.delete()
        Suppression.objects.update_or_create(owner=owner, ident=ident,
                                             defaults={"le": maintenant(), "revision": revision})
