# -*- coding: utf-8 -*-
"""Remarques d'une certification pratique : appreciation d'un candidat, bilan.

Une certification ne se lit pas comme une formation : pas de test
d'entree ni de progression, mais une serie de modules pratiques notes
sur 100, un seuil de 70 %, et l'e-learning qui conditionne la
certification definitive. Les tournures reprennent celles des comptes
rendus G3 (Conakry, Douala) : profil du candidat, modules maitrises,
lacunes, puis ce qu'il reste a faire.

Les regles restent celles des autres moteurs : le registre suit les
chiffres, rien n'est invente (un module n'est cite que s'il est note),
et le texte est une proposition que le formateur reprend.
"""
import random

from moteur_session import _finir, _liste

SEUIL = 70


def _nombre(v):
    try:
        return None if v is None or v == '' else float(v)
    except (TypeError, ValueError):
        return None


class _Tirage:
    def __init__(self, graine):
        self.rnd = random.Random(graine)

    def un(self, *options):
        return self.rnd.choice([o for o in options if o])


def _modules_cites(intitules):
    """« a », « b » et « c » : des intitules de module, tels qu'ecrits."""
    l = [f'« {i.strip().rstrip(".")} »' for i in intitules if i and i.strip()]
    return l[0] if len(l) == 1 else ', '.join(l[:-1]) + ' et ' + l[-1]


def _modules(c):
    """Les modules notes, du mieux au moins bien reussi."""
    notes = [(m.get('intitule') or m.get('code') or '', _nombre(m.get('note')))
             for m in c.get('modules') or []]
    notes = [(i, n) for i, n in notes if i and n is not None]
    return sorted(notes, key=lambda x: -x[1])


def rediger_appreciation_certification(candidat, graine=None):
    """L'appreciation du formateur pour un candidat de certification.

    `candidat` : prenom, nom, filiale, niveau, pourcentage, pratique
    (« Validé » / « Échoué »), final, elearning {statut, taux}, modules
    [{intitule, note}]. Renvoie `{texte, relecture_requise}` ; `texte` est
    vide sans pourcentage.
    """
    c = dict(candidat or {})
    t = _Tirage(graine if graine is not None else random.randrange(2 ** 31))
    pct = _nombre(c.get('pourcentage'))
    if pct is None:
        return {'texte': '', 'relecture_requise': True}
    pct = int(round(pct))
    nom = ' '.join(x for x in (c.get('prenom'), c.get('nom')) if x).strip() or 'Le candidat'
    prenom = (c.get('prenom') or '').strip() or nom
    niveau = (c.get('niveau') or '').strip()
    certif = f'la certification {niveau}' if niveau else 'cette certification'
    filiale = (c.get('filiale') or '').strip()
    modules = _modules(c)
    forts = [i for i, n in modules if n >= 90][:3] or [i for i, n in modules if n >= 85][:2]
    faibles = [i for i, n in reversed(modules) if n < SEUIL][:3]
    ecart = modules[0][1] - modules[-1][1] if len(modules) > 1 else 0
    e = c.get('elearning') or {}
    statut = e.get('statut')
    phrases = []

    # Le profil, d'apres le pourcentage.
    if pct >= 90:
        phrases.append(t.un(
            f'{nom} réalise une excellente session pratique, avec {pct} % sur l’ensemble des modules de {certif}.',
            f'Avec {pct} %, {nom} livre une performance pratique remarquable lors de {certif}, '
            'témoignant d’une vraie maturité technique.'))
    elif pct >= 80:
        phrases.append(t.un(
            f'{nom} a démontré de bonnes aptitudes pratiques sur l’ensemble des modules de {certif}, avec {pct} %.',
            f'Avec {pct} %, {nom} valide la session pratique de {certif} avec un bon niveau de maîtrise.'))
    elif pct >= SEUIL:
        phrases.append(t.un(
            f'{nom} valide la session pratique de {certif} avec {pct} %, un résultat satisfaisant.',
            f'Avec {pct} %, {nom} atteint le seuil de validation de {certif}.'))
    elif pct >= 60:
        phrases.append(t.un(
            f'{nom} n’atteint pas le seuil de {SEUIL} % de {certif} ({pct} %), '
            'malgré des compétences réelles sur plusieurs modules.',
            f'Avec {pct} %, {nom} reste en dessous du seuil de validation de {certif}.'))
    else:
        phrases.append(t.un(
            f'{nom} n’a pas atteint le seuil de validation de {certif} ({pct} %) : '
            'les lacunes constatées touchent plusieurs fondamentaux du niveau.',
            f'Avec {pct} %, {nom} reste nettement en dessous du seuil de {SEUIL} % de {certif}.'))

    # Ce qui est maitrise, ce qui manque.
    if forts:
        phrases.append(t.un(
            f'Ses meilleurs résultats portent sur les modules {_modules_cites(forts)}.',
            f'La maîtrise est particulièrement nette sur les modules {_modules_cites(forts)}.'))
    if faibles:
        if pct >= SEUIL:
            phrases.append(t.un(
                f'Les lacunes observées sur les modules {_modules_cites(faibles)} pourront être comblées '
                'par un complément de pratique (coaching terrain ou e-learning Team GP).',
                f'Des marges de progression demeurent sur les modules {_modules_cites(faibles)}, '
                'à travailler en atelier.'))
        else:
            phrases.append(t.un(
                f'Les lacunes portent surtout sur les modules {_modules_cites(faibles)}.',
                f'{prenom} doit en priorité retravailler les modules {_modules_cites(faibles)}.'))
    if ecart >= 50 and faibles and forts:
        phrases.append(f'L’écart entre ses meilleurs et ses moins bons scores ({int(modules[0][1])} contre '
                       f'{int(modules[-1][1])}) indique un manque de régularité dans la maîtrise des gestes techniques.')

    # L'e-learning et la suite.
    if c.get('pratique') == 'Validé':
        if statut == 'Validé':
            fin = f' au sein de {filiale}' if filiale else ''
            phrases.append(t.un(
                f'Parcours e-learning validé : {prenom} obtient la certification et constitue un technicien '
                f'de bon niveau{fin}.',
                f'L’e-learning étant validé, la {certif[3:]} est acquise pour {prenom}.'))
        elif statut == 'Non finalisé':
            phrases.append(t.un(
                'Le parcours e-learning, encore non finalisé, est aujourd’hui le seul obstacle à la '
                f'délivrance de la certification : {prenom} gagnera à le terminer sans tarder.',
                f'Il reste à finaliser le parcours e-learning pour que cette performance soit officiellement reconnue.'))
    else:
        suite = t.un(
            'Un plan de remédiation ciblé est recommandé avant une nouvelle présentation à la certification.',
            'Une remise à niveau accompagnée, avec des exercices pratiques supervisés, est recommandée '
            'avant toute nouvelle tentative.')
        if statut == 'Non finalisé':
            suite += ' Le parcours e-learning, encore incomplet, est un point supplémentaire à régler.'
        phrases.append(suite)

    return {'texte': _finir(' '.join(phrases)), 'relecture_requise': True}


def rediger_bilan_certification(session, graine=None, rubrique=None):
    """Les quatre rubriques du bilan d'une certification.

    `session` : intitule, niveau, periode, lieu, pays, effectif, reussis,
    taux_reussite, moyenne, certifies, elearning_a_finir, candidats
    [{nom, pourcentage, pratique}], modules_forts / modules_faibles
    [{intitule, moyenne}]. Avec `rubrique`, seule celle-ci est redigee.
    """
    s = dict(session or {})
    t = _Tirage(graine if graine is not None else random.randrange(2 ** 31))
    effectif = s.get('effectif') or 0
    reussis = s.get('reussis') or 0
    niveau = (s.get('niveau') or '').strip()
    nom = f'certification {niveau}' if niveau else 'certification'
    candidats = s.get('candidats') or []
    en_retrait = [c['nom'] for c in candidats if c.get('pratique') == 'Échoué']
    forts = [m['intitule'] for m in s.get('modules_forts') or []]
    faibles = [m['intitule'] for m in s.get('modules_faibles') or [] if (m.get('moyenne') or 0) < SEUIL]

    r = {}
    lieu = f' au Centre CFAO {s["pays"]}' if s.get('pays') else ''
    if effectif:
        r['contexte'] = t.un(
            f'La session de {nom} s’est tenue {s.get("periode") or ""}{lieu}, '
            f'avec {effectif} candidat{"s" if effectif > 1 else ""} évalué{"s" if effectif > 1 else ""} '
            'sur les modules pratiques du niveau.',
            f'{effectif} candidat{"s" if effectif > 1 else ""} {"ont" if effectif > 1 else "a"} présenté '
            f'la {nom} {s.get("periode") or ""}{lieu}.')
        taux = s.get('taux_reussite')
        moy = s.get('moyenne')
        res = t.un(
            f'La session affiche un taux de réussite de {taux} % : {reussis} candidat{"s" if reussis > 1 else ""} '
            f'sur {effectif} valide{"nt" if reussis > 1 else ""} la partie pratique',
            f'{reussis} candidat{"s" if reussis > 1 else ""} sur {effectif} '
            f'valide{"nt" if reussis > 1 else ""} la partie pratique, soit {taux} % de réussite')
        res += f', pour une moyenne de {moy} %.' if moy is not None else '.'
        if forts:
            res += ' ' + t.un(f'Le groupe réussit collectivement les modules {_modules_cites(forts)}.',
                              f'Les meilleurs résultats portent sur les modules {_modules_cites(forts)}.')
        r['resultats'] = res
        vig = []
        if en_retrait:
            vig.append(t.un(
                f'{_liste(en_retrait, maximum=6, minuscule=False)} '
                f'{"restent" if len(en_retrait) > 1 else "reste"} sous le seuil de {SEUIL} %.',
                f'{len(en_retrait)} candidat{"s" if len(en_retrait) > 1 else ""} '
                f'n’atteigne{"nt" if len(en_retrait) > 1 else ""} pas le seuil de validation.'))
        else:
            vig.append('L’ensemble des candidats atteint le seuil de validation de la partie pratique.')
        if faibles:
            vig.append(t.un(f'Des lacunes communes apparaissent sur les modules {_modules_cites(faibles)}.',
                            f'Les modules les moins réussis : {_modules_cites(faibles)}.'))
        r['vigilance'] = ' '.join(vig)
        sui = []
        if en_retrait:
            sui.append('Un plan de remédiation individuel, avec un tuteur technique désigné, '
                       'est recommandé avant une nouvelle présentation à la certification.')
        if faibles:
            sui.append(f'E-learning Team GP et exercices supervisés recommandés sur les modules '
                       f'{_modules_cites(faibles)}.')
        a_finir = s.get('elearning_a_finir') or 0
        if a_finir:
            sui.append(f'{a_finir} candidat{"s" if a_finir > 1 else ""} '
                       f'doi{"vent" if a_finir > 1 else "t"} finaliser le parcours e-learning '
                       'avant de recevoir la certification définitive.')
        sui.append('La certification est obtenue lorsque la session pratique et le parcours '
                   'e-learning sont validés.')
        r['suites'] = ' '.join(sui)
    r = {k: _finir(v) for k, v in r.items()}
    return {rubrique: r.get(rubrique, '')} if rubrique else r
