"""La formule des certifications, sous le bilan."""
import re
import zipfile

import formule

BILAN = ('<p:spTree><p:sp><p:nvSpPr><p:cNvPr id="3" name="x"/><p:nvPr><p:ph idx="14"/></p:nvPr></p:nvSpPr>'
         '<p:spPr><a:xfrm><a:off x="6242304" y="1268730"/><a:ext cx="5583936" cy="5177790"/></a:xfrm></p:spPr>'
         '<a:t>{bilan_contexte}</a:t></p:sp></p:spTree>')
PHRASE = 'Nous rappelons que la certification TOYOTA pour chacun des niveaux est obtenue de la façon suivante :'


def test_la_formule_s_ajoute_au_bilan():
    xml = formule.ajouter_formule(BILAN, PHRASE)
    assert PHRASE in xml
    assert xml.count('prst="ellipse"') == 3
    assert '<a:t>+</a:t>' in xml and '<a:t>=</a:t>' in xml
    assert f'cy="{formule.HAUTEUR_TEXTE}"' in xml and 'cy="5177790"' not in xml
    assert xml.endswith('</p:sp></p:spTree>')


def test_les_identifiants_des_formes_sont_uniques():
    ids = re.findall(r'cNvPr id="(\d+)"', formule.ajouter_formule(BILAN, PHRASE))
    assert len(ids) == len(set(ids))


def test_sans_phrase_ou_hors_bilan_la_page_ne_change_pas():
    assert formule.ajouter_formule(BILAN, None) == BILAN
    autre = BILAN.replace('{bilan_contexte}', 'autre page')
    assert formule.ajouter_formule(autre, PHRASE) == autre


def test_la_formule_n_est_ajoutee_qu_une_fois():
    une_fois = formule.ajouter_formule(BILAN, PHRASE)
    assert formule.ajouter_formule(une_fois, PHRASE) == une_fois


def test_le_xml_obtenu_est_valide_et_les_caracteres_sont_echappes():
    from xml.dom.minidom import parseString
    xml = formule.ajouter_formule(BILAN, 'A & B <C>')
    parseString('<r xmlns:p="p" xmlns:a="a">' + xml + '</r>')
    assert 'A &amp; B &lt;C&gt;' in xml
