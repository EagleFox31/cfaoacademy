# -*- coding: utf-8 -*-
"""L'appreciation du formateur sur la fiche individuelle (diapositive 27).

Le patron vient des fiches reelles (112 appreciations relevees dans les
comptes rendus CFAO) :

    « Kabongo obtient un taux d'acquisition des competences de 80 %,
      traduisant une assimilation satisfaisante des savoirs et savoir-faire
      transmis. Son niveau d'entree, deja eleve, laissait peu de marge de
      progression sur le test theorique. Il a evalue la qualite de la
      formation a 96 %. Nous l'encourageons a mettre rapidement en
      pratique ces acquis dans son activite quotidienne. »

Cinq mouvements, chacun omis quand ses chiffres manquent :

    acquisition   le taux et ce qu'il traduit, le seuil de 70 % quand il
                  n'est pas atteint ;
    detail        l'ecart theorie / pratique, s'il est net ;
    progression   lue au regard du niveau d'entree — une entree elevee
                  laisse peu de marge, une sortie sous l'entree se dit ;
    evaluation    la note que le stagiaire donne a la formation et a
                  l'accueil ;
    suite         ce qui est attendu ensuite, selon le resultat.

Regles tenues par le code :

  * le qualificatif suit la valeur (jamais « remarquable » pour une
    progression nulle ou negative) ;
  * aucun genre n'est suppose : pas de « il » ni d'accord, des tournures
    neutres (« son », « nous l'encourageons ») ;
  * une graine fournie par l'interface varie les tournures a chaque
    « Autre proposition » ; sans graine, le texte est stable.
"""
import hashlib
import random

from regles import SEUIL_DEFAUT as SEUIL, seuil_de  # noqa: E402
PCT = ' %'          # l'espace insecable tient le nombre et son signe


def _pct(v):
    return f'{int(round(v))}{PCT}'


def _palier(v, seuil=SEUIL):
    # Sous le seuil choisi, jamais un palier qui dirait la validation acquise.
    if v < seuil:
        return 'limite' if v >= 55 else 'faible'
    return 'excellent' if v >= 90 else 'bon' if v >= 80 else 'correct'


def _nom(p):
    """Le prenom, a defaut le nom ; les saisies en capitales reprennent une casse lisible."""
    for cle in ('prenom', 'nom'):
        v = (p.get(cle) or '').strip()
        if v:
            return ' '.join(m.capitalize() if m.isupper() else m for m in v.split())
    return 'Le stagiaire'


def _de(nom):
    """« de Alain » -> « d'Alain »."""
    return f"d'{nom}" if nom[:1].lower() in 'aeiouyàâéèêîôûh' else f'de {nom}'


# ── Ce que traduit le taux d'acquisition ─────────────────────────────────
ASSIMILATION = {
    'excellent': ['une très bonne assimilation', 'une excellente assimilation',
                  'une assimilation particulièrement solide'],
    'bon':       ['une bonne assimilation', 'une assimilation solide'],
    'correct':   ['une assimilation satisfaisante', 'une assimilation correcte'],
    'limite':    ['une assimilation encore partielle', 'une assimilation incomplète'],
    'faible':    ['une assimilation insuffisante', 'une assimilation encore fragile'],
}

ACQUISITION = [
    '{P} obtient un taux d\'acquisition des compétences de {acq}, traduisant '
    '{assim} des savoirs et savoir-faire transmis.',
    'Le taux d\'acquisition des compétences {deP} s\'établit à {acq}, ce qui '
    'reflète {assim} des savoirs et savoir-faire transmis.',
    'Avec un taux d\'acquisition des compétences de {acq}, {P} témoigne '
    'd\'{assim} des contenus de la formation.',
]

SOUS_SEUIL = [
    'Ce résultat reste en deçà du seuil de validation fixé à {seuil}.',
    'Le seuil de validation de {seuil} n\'est pas encore atteint.',
]

# ── Theorie / pratique, quand l'ecart est net ─────────────────────────────
PRATIQUE_DEVANT = [
    'Les travaux pratiques ({pr}) constituent son point fort, la théorie ({th}) '
    'restant à consolider.',
    'La pratique ({pr}) ressort nettement au-dessus de la théorie ({th}).',
]
THEORIE_DEVANT = [
    'La théorie ({th}) est mieux maîtrisée que la pratique ({pr}), '
    'qui demande davantage de gestes en atelier.',
    'Les acquis théoriques ({th}) devancent nettement la pratique ({pr}).',
]

# ── Progression, rapportee au niveau d'entree ─────────────────────────────
PROGRESSION = {
    'recul': [
        'Son test de sortie ({s}) reste en deçà de son test d\'entrée ({e}) : '
        'les notions théoriques gagneront à être reprises.',
        'Le test de sortie ({s}) ne confirme pas le niveau du test d\'entrée ({e}), '
        'un point à reprendre sur les notions théoriques.',
    ],
    'plafond': [
        'Son niveau d\'entrée, déjà élevé ({e}), laissait peu de marge de progression '
        'sur le test théorique.',
        'Sa progression de {prog} reste mesurée, son niveau d\'entrée ({e}) étant déjà élevé.',
    ],
    'nulle': [
        'Aucune progression n\'apparaît entre le test d\'entrée et le test de sortie ({e}).',
    ],
    'faible': [
        'Sa progression de {prog} entre le test d\'entrée et le test de sortie reste modeste.',
        'Entre le test d\'entrée ({e}) et le test de sortie ({s}), sa progression de '
        '{prog} reste mesurée.',
    ],
    'nette': [
        'Sa progression de {prog} entre le test d\'entrée et le test de sortie témoigne '
        'd\'un réel engagement durant la formation.',
        'Du test d\'entrée ({e}) au test de sortie ({s}), son parcours marque '
        'une progression nette de {prog}.',
    ],
    'forte': [
        'Sa progression de {prog} entre le test d\'entrée ({e}) et le test de sortie ({s}) '
        'est remarquable.',
        'Sa progression de {prog} entre le test d\'entrée et le test de sortie traduit '
        'un investissement remarquable tout au long de la formation.',
    ],
}

# ── L'evaluation que le stagiaire donne de la session ─────────────────────
EVALUATION_DEUX = [
    '{P} a évalué la qualité de la formation à {f} et celle de l\'accueil à {a}.',
    'Son évaluation de la qualité de la formation s\'établit à {f}, celle de '
    'l\'accueil à {a}.',
]
EVALUATION_FORMATION = [
    '{P} a évalué la qualité de la formation à {f}.',
    'Son évaluation de la qualité de la formation s\'établit à {f}.',
]
ACCUEIL_BAS = [
    ' Les conditions d\'accueil appellent un point d\'attention.',
    ' Ses réserves sur l\'accueil méritent d\'être examinées.',
]

# ── La suite attendue ────────────────────────────────────────────────────
SUITE = {
    'excellent': [
        'Nous l\'encourageons à partager ces acquis avec ses collègues et à les mettre '
        'en pratique sans tarder.',
        'Ce niveau en fait un appui technique précieux au sein de son équipe.',
    ],
    'bon': [
        'Nous l\'encourageons à mettre rapidement en pratique ces acquis dans son '
        'activité quotidienne.',
        'La mise en pratique régulière de ces acquis en atelier en consolidera la maîtrise.',
    ],
    'correct': [
        'Une mise en pratique régulière permettra de consolider ces acquis.',
        'Nous l\'encourageons à consolider ces acquis par une pratique régulière et le '
        'suivi des modules e-learning.',
    ],
    'limite': [
        'Un renforcement ciblé, notamment via les modules e-learning, est recommandé '
        'avant une nouvelle évaluation.',
        'Nous recommandons la reprise des modules e-learning et un accompagnement sur '
        'le terrain pour atteindre le seuil requis.',
    ],
    'faible': [
        'Une remise à niveau structurée, appuyée sur les modules e-learning, est '
        'nécessaire avant une nouvelle session.',
        'Un accompagnement individualisé et la reprise des fondamentaux sont vivement '
        'recommandés.',
    ],
}


def _nombre(v):
    try:
        return None if v is None or v == '' else float(v)
    except (TypeError, ValueError):
        return None


def rediger_appreciation(participant, graine=None):
    """L'appreciation du formateur pour un stagiaire.

    `participant` : prenom, nom, acquisition, theorie, pratique, entree,
    sortie, taux_progression, satisfaction (formation), sat_accueil —
    tous sur 100, tous facultatifs sauf le nom.

    Renvoie `{texte, registre, relecture_requise}` ; `texte` est vide si
    aucun chiffre ne permet d'ecrire quoi que ce soit de fonde.
    """
    p = dict(participant or {})
    if graine is None:
        cle = '|'.join(str(p.get(c, '')) for c in
                       ('nom', 'prenom', 'acquisition', 'theorie', 'pratique', 'entree'))
        graine = int(hashlib.sha256(cle.encode('utf-8')).hexdigest()[:8], 16)
    rnd = random.Random(graine)
    nom = _nom(p)
    seuil = seuil_de(p.get('seuil'))
    acq, th, pr = (_nombre(p.get(c)) for c in ('acquisition', 'theorie', 'pratique'))
    e, s, prog = (_nombre(p.get(c)) for c in ('entree', 'sortie', 'taux_progression'))
    f, a = _nombre(p.get('satisfaction')), _nombre(p.get('sat_accueil'))
    phrases = []
    reg = _palier(acq, seuil) if acq is not None else None

    if acq is not None:
        phrases.append(rnd.choice(ACQUISITION).format(
            P=nom, deP=_de(nom), acq=_pct(acq), assim=rnd.choice(ASSIMILATION[reg])))
        if acq < seuil:
            phrases.append(rnd.choice(SOUS_SEUIL).format(seuil=_pct(seuil)))

    # Une sortie sous l'entree dit deja que la theorie est a reprendre :
    # l'ecart theorie / pratique, dans le meme sens, ferait doublon.
    recul = prog is not None and e is not None and prog < 0
    if th is not None and pr is not None and abs(th - pr) >= 15 and not (recul and pr > th):
        phrases.append(rnd.choice(PRATIQUE_DEVANT if pr > th else THEORIE_DEVANT)
                       .format(th=_pct(th), pr=_pct(pr)))

    if prog is not None and e is not None:
        if recul:
            cas = 'recul'
        elif e >= 75 and prog < 15:
            cas = 'plafond'
        elif round(prog) == 0:
            cas = 'nulle'
        elif prog < 20:
            cas = 'faible'
        elif prog < 50:
            cas = 'nette'
        else:
            cas = 'forte'
        modeles = [m for m in PROGRESSION[cas] if s is not None or '{s}' not in m]
        phrases.append(rnd.choice(modeles).format(
            e=_pct(e), s=_pct(s) if s is not None else '', prog=_pct(prog)))

    if f is not None:
        if a is not None:
            phrase = rnd.choice(EVALUATION_DEUX).format(P=nom, f=_pct(f), a=_pct(a))
            if a < 50 <= f:
                phrase += rnd.choice(ACCUEIL_BAS)
        else:
            phrase = rnd.choice(EVALUATION_FORMATION).format(P=nom, f=_pct(f))
        phrases.append(phrase)

    if reg:
        phrases.append(rnd.choice(SUITE[reg]))

    return {'texte': ' '.join(phrases), 'registre': reg, 'relecture_requise': True}
