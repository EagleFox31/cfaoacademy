# -*- coding: utf-8 -*-
"""Vocabulaire des appreciations, classe par registre.

Le vocabulaire est repris du style des formateurs CFAO ; les tournures sont
reecrites, jamais recopiees. Une phrase des comptes rendus source porte le
jugement d'un formateur sur une personne nommee : la reutiliser telle quelle
la ferait resurgir sur la fiche de quelqu'un d'autre.

Les registres suivent les paliers de resultat, du plus haut au plus bas :

    excellent   >= 90     eloge franc
    bon         >= 80     satisfaction nette
    correct     >= 70     validation sans relief  (seuil CFAO)
    limite      >= 55     en deca, mais des appuis
    faible      <  55     en retrait net

Chaque entree est une liste : le moteur y puise sans jamais reprendre deux
fois la meme formule dans un meme texte.
"""

# Seuil de validation CFAO, present dans tous les comptes rendus source.
SEUIL = 70

PALIERS = [(90, "excellent"), (80, "bon"), (70, "correct"),
           (55, "limite"), (0, "faible")]


def palier(note):
    """Le registre correspondant à une note sur 100."""
    if note is None:
        return None
    for borne, nom in PALIERS:
        if note >= borne:
            return nom
    return "faible"


# ── Qualificatifs d'un taux, accordes au palier ────────────────────────────
# Le defaut des sources : « excellent taux de 60 % ». Le qualificatif doit
# suivre la valeur, sinon il la contredit.
QUALIFICATIF = {
    "excellent": ["excellent", "remarquable", "très solide", "de premier ordre"],
    "bon":       ["bon", "solide", "appréciable", "convaincant"],
    "correct":   ["correct", "satisfaisant", "conforme aux attentes",
                  "suffisant"],
    "limite":    ["en retrait", "juste en deçà des attentes", "fragile",
                  "perfectible"],
    "faible":    ["insuffisant", "nettement en retrait", "très fragile",
                  "en deçà du niveau requis"],
}

# ── Qualificatifs d'une progression ────────────────────────────────────────
PROGRESSION = {
    "forte":   ["une progression remarquable", "une nette progression",
                "une progression très appréciable", "un net saut de niveau"],
    "moyenne": ["une progression régulière", "une progression constante",
                "une évolution nette", "une progression sensible"],
    "faible":  ["une progression mesurée", "une évolution limitée",
                "une progression contenue", "un gain modeste"],
}


def palier_progression(points):
    """Un gain en points de pourcentage, ramene à trois niveaux."""
    if points is None:
        return None
    if points >= 25:
        return "forte"
    return "moyenne" if points >= 10 else "faible"


# ── Ouvertures, par registre ───────────────────────────────────────────────
# `{p}` = prenom ou nom d'usage. Le moteur ne suppose aucun genre : les
# tournures evitent l'accord quand le genre n'est pas fourni.
OUVERTURES = {
    "excellent": [
        "{p} termine cette formation avec des résultats de premier plan",
        "{p} s'est distingué tout au long de la session",
        "Le parcours de {p} sur cette formation est pleinement réussi",
        "{p} figure parmi les participants les plus solides de cette session",
    ],
    "bon": [
        "{p} valide cette formation avec des résultats solides",
        "{p} a suivi cette formation avec sérieux et régularité",
        "Le bilan de {p} sur cette session est favorable",
        "{p} termine la formation avec un niveau bien assis",
    ],
    "correct": [
        "{p} valide cette formation",
        "{p} atteint les objectifs fixés pour cette session",
        "Le parcours de {p} répond aux attentes de la formation",
        "{p} termine la session avec un niveau conforme au requis",
    ],
    "limite": [
        "{p} termine cette formation avec des résultats contrastés",
        "Le parcours de {p} appelle quelques réserves",
        "{p} n'atteint pas tout à fait le niveau attendu sur cette session",
        "Les résultats de {p} restent en deçà du seuil de validation",
    ],
    "faible": [
        "{p} n'atteint pas le seuil de validation de cette formation",
        "Les résultats de {p} restent nettement insuffisants",
        "Le parcours de {p} sur cette session reste incomplet",
        "{p} termine la formation en deçà du niveau requis",
    ],
}

# ── Constat chiffre ────────────────────────────────────────────────────────
# `{taux}` acquisition, `{q}` qualificatif accorde, `{th}` / `{pr}` detail.
CONSTATS = {
    "avec_detail": [
        "Son taux d'acquisition s'établit à {taux} %, "
        "porté par {th} % en théorie et {pr} % en pratique.",
        "Il atteint {taux} % d'acquisition, avec {th} % au test théorique "
        "et {pr} % sur les travaux pratiques.",
        "Le taux d'acquisition ressort à {taux} % : {th} % en théorie, "
        "{pr} % en pratique.",
    ],
    "sans_detail": [
        "Son taux d'acquisition des compétences atteint {taux} %, "
        "un résultat {q}.",
        "Le taux d'acquisition s'établit à {taux} %, niveau {q}.",
        "Il obtient {taux} % d'acquisition des compétences, "
        "résultat {q} au regard des objectifs.",
    ],
    "progression": [
        "Entre le test d'entrée et le test de sortie, il affiche {prog}.",
        "L'écart entre l'entrée et la sortie traduit {prog}.",
        "La comparaison des tests d'entrée et de sortie montre {prog}.",
    ],
}

# ── Nuance : ce qui tempere ou ce qui appuie ───────────────────────────────
NUANCES = {
    "reserve": [
        "Des fragilités subsistent toutefois sur {domaine}.",
        "Les résultats sur {domaine} restent en revanche à consolider.",
        "Un écart demeure cependant sur {domaine}.",
        "La maîtrise de {domaine} reste en retrait du reste du parcours.",
    ],
    "appui": [
        "Les acquis sont particulièrement nets sur {domaine}.",
        "La maîtrise de {domaine} constitue un point d'appui solide.",
        "Les compétences sur {domaine} sont bien installées.",
        "{domaine} ressort comme un point fort du parcours.",
    ],
    "contraste": [
        "Le profil reste contraste : {domaine} est acquis, "
        "quand d'autres volets demandent encore du travail.",
        "L'écart entre les meilleurs et les moins bons résultats "
        "signale une maîtrise encore irrégulière.",
    ],
}

# ── E-learning, quand le parcours est renseigne ────────────────────────────
ELEARNING = {
    "complet": [
        "Le parcours e-learning est achevé ({valides} modules sur {requis}).",
        "Les modules e-learning sont validés dans leur totalité "
        "({valides}/{requis}).",
    ],
    "partiel": [
        "Le parcours e-learning reste à terminer : {valides} modules "
        "validés sur {requis}.",
        "Côté e-learning, {valides} modules sur {requis} sont validés ; "
        "le solde reste à traiter.",
        "Le suivi e-learning est engagé sans être achevé "
        "({valides}/{requis} modules).",
    ],
    "absent": [
        "Le parcours e-learning n'a pas été engagé à ce stade.",
        "Aucun module e-learning n'est validé pour l'instant.",
    ],
}

# ── Cloture : ce qui est attendu ensuite ───────────────────────────────────
CLOTURES = {
    "excellent": [
        "Ce niveau le désigne naturellement comme appui technique "
        "au sein de son équipe.",
        "Il est encouragé à faire vivre ces acquis auprès de ses collègues.",
        "Une montée en compétence vers le niveau supérieur peut "
        "être envisagée des à present.",
    ],
    "bon": [
        "La mise en pratique rapide de ces acquis en consolidera la maîtrise.",
        "Il est encouragé à poursuivre sur cette voie.",
        "Ces acquis gagneront à être mobilisés rapidement en atelier.",
    ],
    "correct": [
        "Une mise en pratique régulière permettra d'assurer ces acquis.",
        "Le suivi des modules e-learning consolidera utilement ce niveau.",
        "Un accompagnement de proximité aidera à stabiliser ces compétences.",
    ],
    "limite": [
        "Un renforcement ciblé sur {domaine} est recommandé "
        "avant toute nouvelle évaluation.",
        "La reprise des modules e-learning constitue la première étape "
        "à engager.",
        "Un accompagnement suivi lui permettra de combler cet écart.",
    ],
    "faible": [
        "Une remise à niveau structurée est nécessaire avant "
        "une nouvelle présentation.",
        "Un accompagnement individualisé, précédé des prérequis e-learning, "
        "est à prévoir.",
        "La reprise des fondamentaux doit précéder toute nouvelle session.",
    ],
}

# ── Appreciation de la formation et de l'accueil (fiche B, page 27) ────────
ACCUEIL = {
    "haut": [
        "La formation et l'accueil ont été jugés très satisfaisants.",
        "Le participant exprime une satisfaction élevée sur "
        "le déroulement et les conditions d'accueil.",
    ],
    "moyen": [
        "La formation et l'accueil recueillent une appreciation favorable.",
        "Le déroulement de la session est juge satisfaisant.",
    ],
    "bas": [
        "L'appreciation portee sur les conditions de la session "
        "appelle des aménagements.",
        "Le participant signale des points d'amelioration sur "
        "l'organisation de la session.",
    ],
}


def qualificatif(note):
    """Le qualificatif accorde à la note : jamais « excellent » pour 60 %."""
    p = palier(note)
    return QUALIFICATIF.get(p, QUALIFICATIF["correct"])
