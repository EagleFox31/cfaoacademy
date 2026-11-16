"""Le seuil de validation est un reglage du compte rendu, pas une constante."""
import pytest

from moteur import rediger, verifier
from moteur_certification import rediger_appreciation_certification, rediger_bilan_certification
from moteur_fiche import rediger_appreciation
from moteur_session import _donnees, rediger_bilan
from regles import SEUIL_DEFAUT, seuil_de


@pytest.mark.parametrize('valeur, attendu', [
    (None, 70), ('', 70), ('abc', 70), (0, 70), (101, 70), (-5, 70), (True, 70),
    (80, 80), ('80', 80), (' 85 ', 85), (80.0, 80), (79.6, 80), ('1', 1), (100, 100),
])
def test_seuil_de(valeur, attendu):
    assert seuil_de(valeur) == attendu
    assert SEUIL_DEFAUT == 70


def _apprec(**plus):
    return dict(nom='Durand', prenom='Alain', acquisition=75, theorie=75, pratique=75, **plus)


def test_fiche_seuil_80_traite_75_sous_le_seuil():
    texte = rediger_appreciation(_apprec(seuil=80), 1)
    assert 'seuil de validation de 80' in texte['texte'] or 'seuil de validation fixé à 80' in texte['texte']
    assert texte['registre'] == 'limite'


def test_fiche_sans_seuil_garde_70():
    sortie = rediger_appreciation(_apprec(), 1)
    assert sortie['registre'] == 'correct' and 'seuil' not in sortie['texte'].split('Nous')[0]
    assert sortie == rediger_appreciation(_apprec(seuil=70), 1)
    assert sortie == rediger_appreciation(_apprec(seuil=''), 1)


def test_moteur_verifie_l_eloge_au_seuil_de_la_requete():
    resultat = {'texte': "Le taux d'acquisition excellent de 75 %."}
    assert verifier(resultat, _apprec()) == []
    fautes = verifier(resultat, _apprec(seuil=80))
    assert len(fautes) == 1 and 'seuil de 80 %' in fautes[0]
    assert rediger(_apprec(seuil=80))['texte']


def _certif(**plus):
    return {"nom": "Durand", "prenom": "Alain", "pourcentage": 75, **plus}


def test_certification_seuil_80_traite_75_sous_le_seuil():
    for graine in range(20):
        texte = rediger_appreciation_certification(_certif(seuil=80), graine)['texte']
        assert 'valide la session pratique' not in texte
        assert 'seuil' in texte


def test_certification_sans_seuil_garde_70():
    for graine in range(20):
        texte = rediger_appreciation_certification(_certif(), graine)['texte']
        assert 'valide la session pratique' in texte or 'atteint le seuil de validation' in texte
    assert rediger_appreciation_certification(_certif(), 4) == \
        rediger_appreciation_certification(_certif(seuil=70), 4)


def test_certification_seuil_90_n_eloge_pas_un_resultat_sous_le_seuil():
    for graine in range(20):
        texte = rediger_appreciation_certification(_certif(pourcentage=85, seuil=90), graine)['texte']
        assert 'bonnes aptitudes' not in texte and 'bon niveau de maîtrise' not in texte


def test_bilan_certification_modules_faibles_selon_le_seuil():
    s = dict(effectif=5, reussis=5, modules_faibles=[{'intitule': 'Freinage', 'moyenne': 75}])
    defaut = rediger_bilan_certification(s, 1, 'vigilance')['vigilance']
    assert 'Freinage' not in defaut
    strict = rediger_bilan_certification(dict(s, seuil=80), 1, 'vigilance')['vigilance']
    assert 'Freinage' in strict


def test_session_lit_le_seuil_de_la_requete():
    s = dict(effectif=2, reussis=1, taux=75, participants=[
        {'nom': 'Ali', 'score': 75}, {'nom': 'Bea', 'score': 90}])
    assert _donnees(s)['seuil'] == 70 and 'noms_retrait' not in _donnees(s)
    d = _donnees(dict(s, seuil=80))
    assert d['seuil'] == 80 and d['noms_retrait'] == 'Ali'
    textes = {rediger_bilan(dict(s, seuil=80), g, 'paragraphe')['paragraphe'] for g in range(40)}
    assert any('seuil de 80 %' in t for t in textes)
    assert not any('seuil de 80 %' in rediger_bilan(s, g, 'paragraphe')['paragraphe'] for g in range(40))


def test_palier_fiche_sous_le_seuil_n_est_jamais_valide():
    from moteur_fiche import _palier
    assert _palier(82, 85) == 'limite'
    assert _palier(82) == 'bon'
    assert _palier(72) == 'correct'


def test_acquisition_session_sous_le_seuil_ne_dit_pas_le_seuil_franchi():
    from moteur_session import rediger_acquisition
    session = {'taux': 75, 'effectif': 4, 'reussis': 2, 'seuil': 80}
    for graine in range(20):
        texte = rediger_acquisition(session, graine=graine) or ''
        assert 'seuil est franchi' not in texte
        assert 'niveau requis est atteint' not in texte


def test_palier_au_seuil_suit_le_seuil_dans_les_deux_sens():
    from regles import palier_au_seuil
    assert palier_au_seuil(75, 80) == 'limite'
    assert palier_au_seuil(60, 50) == 'correct'
    assert palier_au_seuil(92, 70) == 'excellent'
    assert palier_au_seuil(40, 70) == 'faible'
    assert palier_au_seuil(None) is None
