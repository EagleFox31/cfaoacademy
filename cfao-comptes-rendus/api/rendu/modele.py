# -*- coding: utf-8 -*-
"""Correspondance entre les parties du rapport et les diapositives du modele.

Le modele `MODELE-REFERENCES.pptx` enchaine vingt-huit diapositives :
des intercalaires, puis une ou plusieurs pages par partie. L'assistant
raisonne en parties (`couverture`, `objectifs`, ...) ; la conversion
raisonne en numeros de diapositive. Cette table fait le lien.

Les parties a repetition — le deroule journalier, les fiches
individuelles — pointent vers une diapositive gabarit qu'on duplique
autant de fois que necessaire.
"""

# Partie -> diapositives du modele, dans l'ordre du document.
DIAPOS = {
    'couverture': [1],
    'objectifs': [5, 9],
    'participants': [3, 4],
    'deroule': [10, 11],
    'resultats': [16, 17, 18, 19],
    'bilan': [20],
    'fiches': [25, 27],
    'cloture': [28],
}

# Les parties qui existent en plusieurs variantes : le modele en porte
# une par forme, l'assistant choisit celle qui sert. Les objectifs ont
# une page par marquage de liste (6 romain, 7 puces, 8 les deux) et une
# page en tableau des qu'il y a des photos (9).
VARIANTES = {
    'objectifs': {'remplace': 9, 'possibles': {6, 7, 8, 9}},
}

# Les parties dont le nombre de pages depend des donnees saisies.
# Toutes les pages jour suivent le meme sens : texte a gauche, photos a
# droite (11). L'alternance du modele (13 les jours pairs) a ete refusee.
GABARITS = {
    'deroule': {'fixe': [10], 'repete': (11,)},
    'fiches': {'fixe': [25], 'repete': 27},
}


def diapos_pour(parties_retenues, nb_jours=0, nb_participants=0,
                variantes=None):
    """Les numeros de diapositive a produire, dans l'ordre du rapport.

    `variantes` dit, pour une partie qui en a plusieurs, la diapositive
    retenue ; faute de choix, la partie garde sa page par defaut.

    `parties_retenues` suit l'ordre de `PARTIES_RAPPORT` cote interface ;
    on le respecte pour que l'apercu corresponde au document final.
    """
    ordre = ['couverture', 'participants', 'objectifs', 'deroule',
             'resultats', 'bilan', 'fiches', 'cloture']
    numeros = []
    for partie in ordre:
        if partie not in parties_retenues:
            continue
        if partie == 'deroule' and nb_jours:
            numeros += GABARITS['deroule']['fixe']
            alterne = GABARITS['deroule']['repete']
            numeros += [alterne[j % len(alterne)] for j in range(nb_jours)]
        elif partie == 'fiches' and nb_participants:
            numeros += GABARITS['fiches']['fixe']
            numeros += [GABARITS['fiches']['repete']] * nb_participants
        else:
            numeros += [_variante(partie, n, variantes)
                        for n in DIAPOS.get(partie, [])]
    return numeros


def _variante(partie, numero, variantes):
    """La diapositive retenue a la place de `numero`, si elle est permise."""
    regle = VARIANTES.get(partie)
    choix = (variantes or {}).get(partie)
    if regle and numero == regle['remplace'] and choix in regle['possibles']:
        return choix
    return numero
