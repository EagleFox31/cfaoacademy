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
    'resultats': [16, 17, 18],
    'bilan': [20],
    'fiches': [25, 26, 27],
    'cloture': [28],
}

# Les parties dont le nombre de pages depend des donnees saisies.
GABARITS = {
    'deroule': {'fixe': [10], 'repete': 11},
    'fiches': {'fixe': [25], 'repete': 26},
}


def diapos_pour(parties_retenues, nb_jours=0, nb_participants=0):
    """Les numeros de diapositive a produire, dans l'ordre du rapport.

    `parties_retenues` suit l'ordre de `PARTIES_RAPPORT` cote interface ;
    on le respecte pour que l'apercu corresponde au document final.
    """
    ordre = ['couverture', 'objectifs', 'participants', 'deroule',
             'resultats', 'bilan', 'fiches', 'cloture']
    numeros = []
    for partie in ordre:
        if partie not in parties_retenues:
            continue
        if partie == 'deroule' and nb_jours:
            numeros += GABARITS['deroule']['fixe']
            numeros += [GABARITS['deroule']['repete']] * nb_jours
        elif partie == 'fiches' and nb_participants:
            numeros += GABARITS['fiches']['fixe']
            numeros += [GABARITS['fiches']['repete']] * nb_participants
        else:
            numeros += DIAPOS.get(partie, [])
    return numeros
