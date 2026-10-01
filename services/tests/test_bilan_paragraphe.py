"""Le bilan en un paragraphe : redaction et mise en page."""
import re

from moteur_certification import rediger_bilan_certification
from moteur_session import rediger_bilan, verifier
from service import substituer

SESSION = dict(intitule='Diagnostic des systèmes électriques', periode='du 3 au 7 août 2026',
               lieu='Centre CFAO Cameroun', effectif=12, reussis=9, entree=62, sortie=81,
               progression=19, taux=76, theorie=81, pratique=71, sat_formation=88)


def test_un_seul_paragraphe_sans_chiffre_invente():
    for graine in range(200):
        texte = rediger_bilan(SESSION, graine, 'paragraphe')['paragraphe']
        assert '\n' not in texte and 60 <= len(texte.split()) <= 200
        assert verifier(texte, SESSION) == []


def test_la_pratique_en_retrait_est_nuancee_sans_contradiction():
    for graine in range(200):
        texte = rediger_bilan(SESSION, graine, 'paragraphe')['paragraphe']
        assert re.search(r'(Toutefois|Cependant), ', texte)
        assert 'se répondent' not in texte


def test_une_pratique_elevee_n_est_pas_en_retrait():
    s = dict(SESSION, theorie=98, pratique=93)
    for graine in range(50):
        texte = rediger_bilan(s, graine, 'paragraphe')['paragraphe']
        assert 'score pratique' not in texte and 'en deçà de la théorie' not in texte


def test_un_groupe_qui_valide_finit_sur_une_suite():
    s = dict(SESSION, reussis=12, pratique=82)
    texte = rediger_bilan(s, 3, 'paragraphe')['paragraphe']
    assert 'seuil' in texte and 'Toutefois' not in texte


def test_meme_graine_meme_texte():
    assert rediger_bilan(SESSION, 7, 'paragraphe') == rediger_bilan(SESSION, 7, 'paragraphe')


def test_certification_en_un_paragraphe():
    s = dict(effectif=7, reussis=6, taux_reussite=86, moyenne=81, periode='du 11 au 15 mai 2026',
             candidats=[{'nom': 'X', 'pratique': 'Échoué'}])
    texte = rediger_bilan_certification(s, 1, 'paragraphe')['paragraphe']
    assert texte.startswith('La session de certification') or texte.startswith('7 candidats')
    assert 'n’atteint pas' in texte or 'X reste' in texte


def para(texte):
    return f'<a:p><a:r><a:t>{texte}</a:t></a:r></a:p>'


def test_les_intertitres_disparaissent_avec_leur_ligne():
    xml = ''.join(para(t) for t in ('Bilan de la formation', 'Contexte et appréciation',
                                    '{bilan_contexte}', 'Points de vigilance', '{bilan_vigilance}'))
    sortie = substituer(xml, {'{bilan_contexte}': 'Le bilan.',
                              '@retirer_paragraphes': ['Contexte et appréciation',
                                                       'Points de vigilance', '{bilan_vigilance}']})
    assert sortie == para('Bilan de la formation') + para('Le bilan.')
