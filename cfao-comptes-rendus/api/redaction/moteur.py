# -*- coding: utf-8 -*-
"""Redaction d'appreciations a partir des resultats d'un participant.

Le moteur assemble quatre mouvements, dans l'ordre ou les formateurs CFAO
les emploient :

    ouverture   ->  qui, et ou il arrive
    constat     ->  les chiffres, qualifies en accord avec leur valeur
    nuance      ->  ce qui tempere ou ce qui appuie
    cloture     ->  ce qui est attendu ensuite

Trois regles tenues par le code :

  1. **Le qualificatif suit la valeur.** Les sources portent « excellent taux
     de 60 % » : un copier-coller ou l'adjectif est reste d'une fiche a
     l'autre. Ici l'adjectif est derive de la note, il ne peut plus diverger.

  2. **Rien n'est invente.** Un champ absent retire le mouvement qui en
     depend, il n'est jamais comble par une formule creuse. Une appreciation
     sans domaine faible ne mentionne pas de domaine faible.

  3. **Le texte est une proposition.** `rediger()` renvoie un brouillon
     destine a la relecture du formateur, jamais un texte a publier tel quel :
     c'est un jugement sur une personne, il engage celui qui le signe.

La variete vient du tirage sans remise, ensemence par le participant : deux
fiches de la meme session ne se ressemblent pas, et la meme fiche regeneree
deux fois donne le meme texte.
"""
import hashlib
import random

from lexique import (ACCUEIL, CLOTURES, CONSTATS, ELEARNING, NUANCES,
                     OUVERTURES, PROGRESSION, QUALIFICATIF, SEUIL,
                     palier, palier_progression)


class Tirage:
    """Puise dans les listes sans repeter une formule dans un meme texte."""

    def __init__(self, graine):
        self.rnd = random.Random(graine)
        self.vus = set()

    def choisir(self, options):
        if not options:
            return None
        libres = [o for o in options if o not in self.vus]
        # Toutes vues : on repart du lot complet plutot que de ne rien rendre.
        choix = self.rnd.choice(libres or list(options))
        self.vus.add(choix)
        return choix


def _graine(participant):
    """Une graine stable, tiree de l'identite et des resultats.

    Deux participants differents tirent des formules differentes ; le meme
    participant regenere donne le meme texte, ce qui rend la relecture utile.
    """
    cle = "|".join(str(participant.get(c, "")) for c in
                   ("nom", "prenom", "acquisition", "theorie", "pratique"))
    return int(hashlib.sha256(cle.encode("utf-8")).hexdigest()[:8], 16)


def _nom_usage(p):
    """Le nom sous lequel on designe le participant dans le texte."""
    for cle in ("prenom", "nom_usage", "nom"):
        v = (p.get(cle) or "").strip()
        if v:
            return v
    return "Le participant"




def _accorder(texte, genre):
    """Accorde le texte au genre du participant, quand il est fourni.

    Le lexique est ecrit au masculin, forme la plus frequente dans les
    sources. Sans indication de genre, le texte reste tel quel : on ne
    devine pas le genre d'apres un prenom, un « Dominique » ou un
    « Benedicte » se trompe aussi souvent qu'il tombe juste, et se tromper
    sur la fiche de quelqu'un est pire qu'une tournure neutre.
    """
    if genre not in ("f", "feminin", "F"):
        return texte
    import re
    accords = [
        (r"\bil affiche\b", "elle affiche"), (r"\bIl affiche\b", "Elle affiche"),
        (r"\bil atteint\b", "elle atteint"), (r"\bIl atteint\b", "Elle atteint"),
        (r"\bil obtient\b", "elle obtient"), (r"\bIl obtient\b", "Elle obtient"),
        (r"\bIl est encouragé\b", "Elle est encouragée"),
        (r"\bil est encouragé\b", "elle est encouragée"),
        (r"\ble désigne\b", "la désigne"),
        (r"\bson équipe\b", "son équipe"),
        (r"\bses collègues\b", "ses collègues"),
        (r"\bencouragé à\b", "encouragée à"),
        (r"\bdistingué\b", "distinguée"),
        (r"\bIl a\b", "Elle a"), (r"\bil a\b", "elle a"),
        (r"\blui permettra\b", "lui permettra"),
    ]
    for motif, remplacement in accords:
        texte = re.sub(motif, remplacement, texte)
    return texte




def _elider(texte):
    """« de Abdoulaye » -> « d'Abdoulaye », devant voyelle."""
    import re
    return re.sub(r"\bde ([AEIOUYÀÂÉÈÊÎÔÛaeiouy])", r"d'\1", texte)


def _contracter(texte):
    """Applique les contractions que l'insertion d'un libelle impose.

    Les libelles de domaine arrivent avec leur article (« les travaux de
    mesure », « la metrologie »). Colles derriere « de » ou « sur », ils
    donnent « de les travaux » : il faut contracter.
    """
    import re
    regles = [
        (r"\bde les\b", "des"), (r"\bDe les\b", "Des"),
        (r"\bde le\b", "du"), (r"\bDe le\b", "Du"),
        (r"\bde l'", "de l'"),
        (r"\ba les\b", "aux"), (r"\bA les\b", "Aux"),
        (r"\ba le\b", "au"), (r"\bA le\b", "Au"),
        # « de la metrologie » est correct, on n'y touche pas.
    ]
    for motif, remplacement in regles:
        texte = re.sub(motif, remplacement, texte)
    # Majuscule en tete de phrase, quand un libelle ouvre la phrase.
    return re.sub(r"(^|[.!?]\s+)([a-zà-ÿ])",
                  lambda m: m.group(1) + m.group(2).upper(), texte)


def rediger(participant, longueur="standard"):
    """Redige une proposition d'appreciation.

    `participant` accepte, tous facultatifs sauf le nom :

        nom, prenom          designation
        acquisition          taux global sur 100
        theorie, pratique    detail des deux epreuves
        entree, sortie       tests, pour calculer la progression
        domaine_fort         libelle, ex. « la metrologie »
        domaine_faible       libelle
        modules_requis       e-learning
        modules_valides      e-learning
        satisfaction         appreciation de la session, sur 100
        genre                "f" pour accorder au feminin ; absent,
                             le texte reste au masculin generique

    `longueur` vaut "courte" (2 phrases), "standard" (3-4) ou "longue" (5).

    Renvoie un dictionnaire : le texte, mais aussi ce qui a servi a le
    construire, pour que le formateur voie sur quoi repose le propos.
    """
    p = dict(participant)
    t = Tirage(_graine(p))
    nom = _nom_usage(p)

    acquisition = p.get("acquisition")
    reg = palier(acquisition) or "correct"
    phrases, appuis = [], []

    # ── ouverture
    ouverture = t.choisir(OUVERTURES[reg])
    phrases.append(ouverture.format(p=nom) + ".")
    appuis.append(f"registre « {reg} » deduit du taux d'acquisition")

    # ── constat chiffre : seulement si les chiffres existent
    if acquisition is not None:
        th, pr = p.get("theorie"), p.get("pratique")
        if th is not None and pr is not None:
            modele = t.choisir(CONSTATS["avec_detail"])
            phrases.append(modele.format(taux=acquisition, th=th, pr=pr))
            appuis.append("theorie et pratique renseignees")
        else:
            modele = t.choisir(CONSTATS["sans_detail"])
            q = t.choisir(QUALIFICATIF[reg])
            phrases.append(modele.format(taux=acquisition, q=q))
            appuis.append(f"qualificatif « {q} » accorde au palier")

    # ── progression, si les deux tests sont fournis
    entree, sortie = p.get("entree"), p.get("sortie")
    if entree is not None and sortie is not None and longueur != "courte":
        gain = sortie - entree
        niveau = palier_progression(gain)
        prog = t.choisir(PROGRESSION[niveau])
        phrases.append(t.choisir(CONSTATS["progression"]).format(prog=prog))
        appuis.append(f"progression de {gain:+d} points, palier « {niveau} »")

    # ── nuance : ce qui appuie ou ce qui tempere
    if longueur != "courte":
        faible, fort = p.get("domaine_faible"), p.get("domaine_fort")
        if faible and reg in ("limite", "faible", "correct"):
            phrases.append(t.choisir(NUANCES["reserve"]).format(domaine=faible))
            appuis.append("domaine en retrait signale")
        elif fort:
            phrases.append(t.choisir(NUANCES["appui"]).format(domaine=fort))
            appuis.append("domaine maitrise signale")
        elif faible and fort:
            phrases.append(t.choisir(NUANCES["contraste"]))

    # ── e-learning, si le parcours est renseigne
    requis, valides = p.get("modules_requis"), p.get("modules_valides")
    if requis and valides is not None and longueur in ("standard", "longue"):
        etat = ("complet" if valides >= requis
                else "absent" if valides == 0 else "partiel")
        phrases.append(t.choisir(ELEARNING[etat]).format(
            valides=valides, requis=requis))
        appuis.append(f"e-learning {valides}/{requis}")

    # ── cloture
    cloture = t.choisir(CLOTURES[reg])
    domaine = p.get("domaine_faible") or "les points en retrait"
    phrases.append(cloture.format(domaine=domaine))

    texte = _accorder(_elider(_contracter(" ".join(phrases))),
                      p.get("genre"))
    return {
        "texte": texte,
        "registre": reg,
        "appuis": appuis,
        "signes": len(texte),
        "relecture_requise": True,
    }


def rediger_accueil(participant):
    """Appreciation de la formation et de l'accueil (fiche B, page 27)."""
    p = dict(participant)
    t = Tirage(_graine(p) + 7)
    s = p.get("satisfaction")
    niveau = "moyen" if s is None else (
        "haut" if s >= 85 else "moyen" if s >= 60 else "bas")
    phrases = [t.choisir(ACCUEIL[niveau])]
    prog = p.get("taux_progression")
    if prog is not None:
        nom = _nom_usage(p)
        gain = palier_progression(prog)
        phrases.insert(0, f"{nom} affiche un taux de progression de "
                          f"{prog} %, soit {PROGRESSION[gain][0]}.")
    texte = _accorder(
        _elider(_contracter(" ".join(x for x in phrases if x))),
        p.get("genre"))
    return {"texte": texte, "registre": niveau, "relecture_requise": True}


def verifier(resultat, participant):
    """Controles de coherence : le texte ne doit pas contredire les chiffres.

    Renvoie la liste des anomalies. Une liste vide vaut feu vert.
    """
    fautes = []
    texte = resultat["texte"].lower()
    acq = participant.get("acquisition")

    # Le defaut des sources : un eloge sur une note en retrait. On ne
    # regarde que les eloges portant sur le RESULTAT ; « une progression
    # remarquable » reste juste a 58 %, c'est meme le cas le plus frequent
    # des participants partis de tres bas.
    if acq is not None:
        eloges = ("taux d'acquisition excellent", "resultat excellent",
                  "résultat excellent", "premier ordre", "s'est distingué",
                  "pleinement réussi", "les plus solides")
        if acq < SEUIL and any(e in texte for e in eloges):
            fautes.append(f"eloge du resultat alors que le taux ({acq} %) "
                          f"est sous le seuil de {SEUIL} %")
        reserves = ("insuffisant", "en deçà", "remise à niveau",
                    "n'atteint pas")
        if acq >= 90 and any(r in texte for r in reserves):
            fautes.append(f"reserve alors que le taux ({acq} %) est eleve")

    # Aucun chiffre ne doit apparaitre s'il n'a pas ete fourni.
    import re
    for n in re.findall(r"\b(\d{1,3})\s?%", resultat["texte"]):
        valeurs = {str(participant.get(c)) for c in
                   ("acquisition", "theorie", "pratique", "entree",
                    "sortie", "satisfaction", "taux_progression")}
        if n not in valeurs:
            fautes.append(f"le taux {n} % n'a pas ete fourni")

    # Une progression impossible : les sources portent « 150 % ».
    e, s = participant.get("entree"), participant.get("sortie")
    if e is not None and s is not None and s < e:
        fautes.append("le test de sortie est inferieur au test d'entree")

    return fautes
