# -*- coding: utf-8 -*-
"""Remarques de session : progression, acquisition, bilan.

Le moteur individuel (`moteur.py`) parle d'une personne ; celui-ci parle
du groupe, pour les deux constats de la diapositive 17 et les quatre
rubriques du bilan (diapositive 20).

Les regles restent celles du moteur individuel :

  1. **Le registre suit les chiffres.** Le niveau de depart, la
     progression, le taux d'acquisition choisissent les tournures.
  2. **Rien n'est invente.** Une variante qui cite une donnee absente est
     ecartee ; une phrase qui n'a plus de variante disparait.
  3. **Le texte est une proposition.** Il revient au formateur, qui le
     reprend a sa guise.

La variete vient de la grammaire du lexique (`lexique_session.py`) : des
choix imbriques dans chaque phrase, des phrases tirees dans un ordre
variable. La graine vient de l'appelant — une nouvelle a chaque clic sur
« Autre proposition » — et une graine donnee redonne le meme texte.
"""
import random
import re

from lexique_session import (
    AMELIORATIONS, CLIMAT, CONCLUSION_ACQUISITION, CONSTATER, CONTEXTE,
    ENTREE, EQUILIBRE, EVOLUTION, GROUPE, LECTURE, LIAISON, MEILLEURE_PROGRESSION,
    NIVEAU_ENTREE, PALIERS_GROUPE, PALIERS_PROGRESSION,
    PARTICIPANTS, POINTS_FORTS, PRATIQUE_EN_RETRAIT, QUALIFICATIF, REGRESSIONS,
    RESULTATS, RESULTATS_TAUX, RETRAIT_NOMME, REUSSITE, SATISFACTION, SESSION,
    SUITE_PRATIQUE, SUITES, TAUX, THEMATIQUES, VIGILANCE, en_mots, palier)
from regles import palier_au_seuil, seuil_de

FRAGMENTS = {
    'groupe': GROUPE, 'session': SESSION, 'participants': PARTICIPANTS,
    'constater': CONSTATER, 'session_maj': SESSION,
}
RE_CHOIX = re.compile(r'\[([^\[\]]*)\]')
RE_CHAMP = re.compile(r'\{(\w+)\}')
RE_ACCORD = re.compile(r'<([^<>|]*)\|([^<>|]*):(\w+)>')


class Tirage:
    """Le hasard d'une redaction, et les modeles deja employes."""

    def __init__(self, graine):
        self.rnd = random.Random(graine)
        self.vus = set()

    def un(self, options):
        libres = [o for o in options if o not in self.vus] or list(options)
        choix = self.rnd.choice(libres)
        self.vus.add(choix)
        return choix

    def peut_etre(self, probabilite):
        return self.rnd.random() < probabilite


def _cle(champ):
    return champ[0].lower() + champ[1:]


def _connu(champ, d):
    return d.get(_cle(champ)) not in (None, [])


def _developper(modele, d, t):
    """Une phrase tiree d'un modele, ou None s'il y manque une donnee."""
    texte = modele
    for nom, fragment in FRAGMENTS.items():
        for forme in (nom, nom[0].upper() + nom[1:]):
            texte = texte.replace('{' + forme + '}', fragment)
    # Les choix, du plus interieur au plus exterieur. Une option qui cite
    # une donnee absente n'est pas candidate.
    while True:
        m = RE_CHOIX.search(texte)
        if not m:
            break
        options = [o for o in m.group(1).split('|')
                   if all(_connu(c, d) for c in RE_CHAMP.findall(o))]
        if not options:
            return None
        texte = texte[:m.start()] + t.rnd.choice(options) + texte[m.end():]
    if not all(_connu(c, d) for c in RE_CHAMP.findall(texte)):
        return None
    texte = RE_CHAMP.sub(lambda m: str(d[_cle(m.group(1))]), texte)
    texte = RE_ACCORD.sub(
        lambda m: m.group(1) if d.get(m.group(3)) == 1 else m.group(2), texte)
    return _finir(texte)


def _finir(texte):
    """Elisions, espaces et majuscules en tete de phrase."""
    texte = re.sub(r"\b([Dd]e|[Qq]ue) ([AEIOUYÉÈÊÀÂÎÔaeiouyéèêàâîô])",
                   lambda m: m.group(1)[0] + ('’' if m.group(1).lower() == 'de' else 'u’')
                   + m.group(2), texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    texte = re.sub(r' ([,.])', r'\1', texte)
    return re.sub(r'(^|[.!?]\s+)([a-zà-ÿ])',
                  lambda m: m.group(1) + m.group(2).upper(), texte)


def _phrase(modeles, d, t):
    """Une phrase tiree d'une liste de modeles, les inutilisables ecartes."""
    candidats = list(modeles)
    t.rnd.shuffle(candidats)
    candidats.sort(key=lambda m: m in t.vus)
    for modele in candidats:
        texte = _developper(modele, d, t)
        if texte:
            t.vus.add(modele)
            return texte
    return None


def _liste(elements, maximum=3, minuscule=True):
    """« a, b et c », en minuscule initiale quand c'est un mot courant.

    Les noms de personnes gardent leur majuscule : `minuscule=False`.
    """
    vus, propres = set(), []
    for e in elements or []:
        e = str(e).strip().rstrip('.;')
        if not e or e.lower() in vus:
            continue
        vus.add(e.lower())
        if minuscule and len(e) > 1 and e[1].islower():
            e = e[0].lower() + e[1:]
        propres.append(e)
    propres = propres[:maximum]
    if not propres:
        return None
    return propres[0] if len(propres) == 1 else ', '.join(propres[:-1]) + ' et ' + propres[-1]


def _entier(v):
    return None if v is None or v == '' else int(round(float(v)))


def _donnees(session):
    """Les champs des modeles, tires de la session et completes."""
    s = dict(session or {})
    d = {'seuil': seuil_de(s.get('seuil'))}
    for champ in ('entree', 'sortie', 'progression', 'taux', 'theorie', 'pratique',
                  'effectif', 'reussis', 'sat_formation', 'sat_accueil'):
        d[champ] = _entier(s.get(champ))
    d['intitule'] = (s.get('intitule') or '').strip() or None
    d['periode'] = (s.get('periode') or '').strip() or None
    lieu = (s.get('lieu') or '').strip()
    if lieu:
        centre = lieu.lower().startswith('centre')
        d['lieu'] = (' au ' if centre else ' à ') + lieu
        d['lieu_sujet'] = ('le ' + lieu) if centre else None
    else:
        d['lieu'] = ''
    if d['effectif'] is not None:
        d['effectif_mot'] = en_mots(d['effectif'])
    if d['effectif'] is not None and d['reussis'] is not None:
        d['n_retrait'] = d['effectif'] - d['reussis']
        d['reussis_mot'] = en_mots(d['reussis'])
        d['n_retrait_mot'] = en_mots(d['n_retrait'])
    participants = s.get('participants') or []
    retrait = [p.get('nom') for p in participants
               if p.get('score') is not None and float(p['score']) < d['seuil'] and p.get('nom')]
    # Les noms ne sont cites que s'ils couvrent tous les participants en
    # retrait : une liste partielle ferait croire qu'ils sont les seuls.
    if 1 <= len(retrait) <= 3 and len(retrait) == d.get('n_retrait'):
        d['noms_retrait'] = _liste(retrait, minuscule=False)
        d['n_noms'] = len(retrait)
    progressions = [(float(p['progression']), p.get('nom')) for p in participants
                    if p.get('progression') is not None and p.get('nom')]
    if len(progressions) >= 3:
        haut = max(progressions)
        if haut[0] >= 15:
            d['top_prog'] = int(round(haut[0]))
            d['top_nom'] = haut[1]
        recul = sum(1 for v, _ in progressions if v < 0)
        if recul:
            d['n_recul'] = recul
            d['n_recul_mot'] = en_mots(recul)
    d['thematiques'] = _liste(s.get('thematiques'))
    d['forts'] = _liste(s.get('forts'))
    d['ameliorations'] = _liste(s.get('ameliorations'))
    return d


def _assembler(parties):
    return ' '.join(p for p in parties if p)


# ── Progression ─────────────────────────────────────────────────────────
def rediger_progression(session, graine=None):
    """Le constat pose sous le graphique de progression (diapositive 17)."""
    d = _donnees(session)
    if d['entree'] is None or d['sortie'] is None or d['progression'] is None:
        return None
    t = Tirage(graine)
    niveau = palier(d['entree'], NIVEAU_ENTREE)
    rang = palier(d['progression'], PALIERS_PROGRESSION)
    sens = rang if rang in ('recul', 'stable') else 'hausse'

    avec_entree = t.peut_etre(0.55)
    entree = _phrase(ENTREE[niveau], d, t) if avec_entree else None
    # L'entree deja citee, l'evolution ne repete pas son chiffre.
    evolutions = [m for m in EVOLUTION[sens] if not entree or '{entree}' not in m] \
        or EVOLUTION[sens]
    evolution = _phrase(evolutions, d, t)
    lecture = _phrase(LECTURE.get((niveau, rang)) or LECTURE.get(rang) or [], d, t)
    extras = []
    if rang not in ('recul',) and d.get('top_nom') and t.peut_etre(0.5):
        extras.append(_phrase(MEILLEURE_PROGRESSION, d, t))
    if d.get('n_recul') and rang != 'recul' and t.peut_etre(0.7):
        extras.append(_phrase(REGRESSIONS, d, t))

    ordres = [[entree, evolution, lecture], [evolution, lecture], [evolution, entree, lecture]]
    corps = t.rnd.choice(ordres if entree else ordres[1:2])
    return _assembler(corps + extras[:1])


# ── Acquisition ─────────────────────────────────────────────────────────
def rediger_acquisition(session, graine=None):
    """Le constat pose sous le graphique d'acquisition (diapositive 17)."""
    d = _donnees(session)
    if d['taux'] is None or d['effectif'] in (None, 0) or d['reussis'] is None:
        return None
    t = Tirage(graine)
    # Le registre suit le seuil choisi, dans les deux sens.
    rang = palier_au_seuil(d['taux'], d['seuil'])
    d['qualificatif'] = _developper(t.un(QUALIFICATIF[rang]), d, t).rstrip('.')
    d['qualificatif'] = d['qualificatif'][0].lower() + d['qualificatif'][1:]
    cas = ('tous' if d['reussis'] == d['effectif'] else
           'aucun' if d['reussis'] == 0 else 'partiel')

    reussite = _phrase(REUSSITE[cas], d, t)
    taux = _phrase(TAUX, d, t)
    parties = [reussite, taux] if t.peut_etre(0.7) else [taux, reussite]
    if d['theorie'] is not None and d['pratique'] is not None and t.peut_etre(0.75):
        ecart = d['pratique'] - d['theorie']
        cle = 'pratique' if ecart >= 8 else 'theorie' if ecart <= -8 else 'equilibre'
        parties.append(_phrase(EQUILIBRE[cle], d, t))
    if cas == 'partiel' and d.get('noms_retrait') and t.peut_etre(0.6):
        parties.append(_phrase(RETRAIT_NOMME, d, t))
    if len(parties) < 4 and t.peut_etre(0.75):
        parties.append(_phrase(CONCLUSION_ACQUISITION[rang], d, t))
    return _assembler(parties)


# ── Bilan ───────────────────────────────────────────────────────────────
RUBRIQUES = ('contexte', 'resultats', 'vigilance', 'suites')


def rediger_bilan(session, graine=None, rubrique=None):
    """Les rubriques du bilan ; une seule si `rubrique` est donnee.

    Chaque rubrique a son propre tirage : en regenerer une ne change pas
    les autres. `rubrique='paragraphe'` donne le bilan d'un seul tenant,
    comme dans les comptes rendus (`{'paragraphe': texte}`).
    """
    d = _donnees(session)
    if d['effectif'] and d['reussis'] is not None:
        d['taux_reussite'] = round(100 * d['reussis'] / d['effectif'])
    if rubrique == 'paragraphe':
        return {'paragraphe': _bilan_paragraphe(d, Tirage(graine))}
    base = random.Random(graine).randrange(1 << 30)
    voulues = [rubrique] if rubrique in RUBRIQUES else list(RUBRIQUES)
    sortie = {}
    for i, nom in enumerate(RUBRIQUES):
        if nom in voulues:
            sortie[nom] = globals()['_bilan_' + nom](d, Tirage(base + i)) or ''
    return sortie


def _bilan_contexte(d, t):
    parties = [_phrase(CONTEXTE, d, t)]
    if d['sat_formation'] is not None and t.peut_etre(0.8):
        parties.append(_phrase(SATISFACTION, d, t))
    if d.get('taux_reussite') is not None:
        parties.append(_phrase(CLIMAT[palier(d['taux_reussite'], PALIERS_GROUPE)], d, t))
    if d['forts'] and t.peut_etre(0.7):
        parties.append(_phrase(POINTS_FORTS, d, t))
    return _assembler(parties)


def _bilan_resultats(d, t):
    parties = []
    if d['entree'] is not None and d['sortie'] is not None and d['progression'] is not None:
        parties.append(_phrase(RESULTATS, d, t))
    if d['taux'] is not None:
        parties.append(_phrase(RESULTATS_TAUX, d, t))
    if d['thematiques'] and t.peut_etre(0.7):
        parties.insert(0 if t.peut_etre(0.4) else len(parties), _phrase(THEMATIQUES, d, t))
    return _assembler(parties)


def _bilan_vigilance(d, t):
    parties = []
    n, eff = d.get('n_retrait'), d['effectif']
    if n is not None and eff:
        cle = 'aucun' if n == 0 else 'majorite' if n > eff / 2 else 'quelques_uns'
        parties.append(_phrase(VIGILANCE[cle], d, t))
    if d['ameliorations']:
        parties.append(_phrase(AMELIORATIONS, d, t))
    return _assembler(parties)


def _bilan_suites(d, t):
    parties = []
    n = d.get('n_retrait')
    if n:
        parties.append(_phrase(SUITES['remediation'], d, t))
        if t.peut_etre(0.5):
            parties.append(_phrase(SUITES['consolidation'], d, t))
    elif n == 0:
        parties.append(_phrase(SUITES['consolidation'], d, t))
        if (d['taux'] or 0) >= 85 and t.peut_etre(0.5):
            parties.append(_phrase(SUITES['certification'], d, t))
    return _assembler(parties)


def _lier(liaison, phrase):
    """« Toutefois, » devant une phrase, dont la majuscule tombe."""
    if not phrase or not liaison:
        return phrase
    return liaison + phrase[0].lower() + phrase[1:]


def _bilan_paragraphe(d, t):
    """Le bilan d'un seul tenant, sur le modele des comptes rendus.

    Contexte et satisfaction, resultats chiffres, puis la nuance (pratique
    en retrait, participants sous le seuil) et la recommandation qui en
    decoule. Les listes des journees (points forts, themes) restent aux
    pages jour : elles alourdiraient le paragraphe.
    """
    parties = [_phrase(CONTEXTE, d, t)]
    if d['sat_formation'] is not None:
        parties.append(_phrase(SATISFACTION, d, t))
    if d['entree'] is not None and d['sortie'] is not None and d['progression'] is not None:
        parties.append(_phrase(RESULTATS, d, t))
    pratique, theorie = d['pratique'], d['theorie']
    # Une pratique a 93 % n'est pas « en retrait », meme sous une theorie a 98 %.
    en_retrait = (pratique is not None and theorie is not None
                  and pratique < 80 and pratique <= theorie - 5)
    if d['taux'] is not None:
        # « La theorie et la pratique se repondent » contredirait la nuance.
        parties.append(_phrase([m for m in RESULTATS_TAUX
                                if not (en_retrait and 'se répondent' in m)], d, t))
    if en_retrait:
        parties.append(_phrase(PRATIQUE_EN_RETRAIT, d, t))
    n, eff = d.get('n_retrait'), d['effectif']
    if n is not None and eff:
        cle = 'aucun' if n == 0 else 'majorite' if n > eff / 2 else 'quelques_uns'
        liaison = ('reussite' if n == 0 else 'retrait_suite' if en_retrait else 'retrait')
        parties.append(_lier(t.rnd.choice(LIAISON[liaison]), _phrase(VIGILANCE[cle], d, t)))
    if en_retrait and not n:
        parties.append(_phrase(SUITE_PRATIQUE, d, t))
    else:
        suites = _bilan_suites(d, t)
        if suites:
            parties.append(_lier(t.rnd.choice(LIAISON['suites']), suites))
    return _assembler(parties)


def verifier(texte, session):
    """Les chiffres du texte qui ne viennent pas de la session."""
    d = _donnees(session)
    connus = {str(v) for v in d.values() if isinstance(v, int)}
    return [n for n in re.findall(r'(\d+)\s?%', texte or '') if n not in connus]
