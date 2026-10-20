"""Substitution des drapeaux, lignes repetees et code couleur du modele."""
import re
import shutil
import zipfile

import pytest

import service
from service import VIDE, colorer, lignes_de, repeter_lignes, retirer_lignes, substituer


def run(texte):
    return f'<a:r><a:t>{texte}</a:t></a:r>'


def case(texte, fond='FFFFFF', sz=1000):
    return (f'<a:tc><a:txBody><a:p><a:r><a:rPr sz="{sz}"/><a:t>{texte}</a:t></a:r></a:p></a:txBody>'
            f'<a:tcPr marL="36000" marR="36000" marT="18000" marB="18000">'
            f'<a:solidFill><a:srgbClr val="{fond}"/></a:solidFill></a:tcPr></a:tc>')


def tableau(lignes, cy):
    """Un cadre de tableau a deux colonnes, suivi d'une forme 2 000 000 EMU plus bas."""
    return ('<p:graphicFrame><p:xfrm><a:off x="0" y="0"/><a:ext cx="5000000" cy="%d"/></p:xfrm>'
            '<a:tbl><a:tblGrid><a:gridCol w="4000000"/><a:gridCol w="1000000"/></a:tblGrid>%s'
            '</a:tbl></p:graphicFrame>'
            '<p:sp><a:off x="0" y="2000000"/><a:ext cx="5000000" cy="300000"/></p:sp>') % (cy, ''.join(lignes))


PORTEUSE = '<a:tr h="180000">' + case('{code}: {intitule} / 100') + case('{note}') + '</a:tr>'


class TestSubstituer:
    def test_remplace_un_drapeau(self):
        assert substituer(run('{nom_complet}'), {'{nom_complet}': 'Paul KAMGA'}) == run('Paul KAMGA')

    def test_laisse_en_place_une_donnee_absente(self):
        assert substituer(run('{lieu}'), {}) == run('{lieu}')

    def test_vide_efface_le_mot_du_modele(self):
        assert substituer(run('{sous_titre}'), {'{sous_titre}': VIDE}) == run('')

    def test_sous_titre_vide_retire_sa_ligne_et_centre_la_couverture(self):
        zone = ('<p:sp><p:txBody><a:bodyPr wrap="square" anchor="b"/>'
                '<a:p>' + run('Titre') + '</a:p><a:p>' + run('Sous titre') + '</a:p>'
                '<a:p>' + run('lieu') + '</a:p></p:txBody></p:sp>')
        xml = substituer(zone, {'Titre': 'TS08', 'Sous titre': VIDE, 'lieu': 'Abidjan'})
        assert xml.count('<a:p>') == 2
        assert 'anchor="ctr"' in xml and 'anchor="b"' not in xml

    def test_sous_titre_saisi_garde_la_couverture_telle_quelle(self):
        zone = ('<p:sp><p:txBody><a:bodyPr anchor="b"/>'
                '<a:p>' + run('Sous titre') + '</a:p><a:p>' + run('lieu') + '</a:p></p:txBody></p:sp>')
        xml = substituer(zone, {'Sous titre': 'Freinage', 'lieu': 'Abidjan'})
        assert xml.count('<a:p>') == 2 and 'anchor="b"' in xml

    def test_echappe_le_texte_saisi(self):
        assert substituer(run('{x}'), {'{x}': 'A & B'}) == run('A &amp; B')


class TestCouleurs:
    def test_ok_passe_le_rouge_du_modele_au_vert(self):
        xml = case('{resultat_final}', fond='C0392B')
        assert 'val="92D050"' in colorer(xml, {'{resultat_final}': 'ok'})

    def test_ko_passe_au_rouge_vif(self):
        xml = case('{resultat_final}', fond='C0392B')
        assert 'val="FF0000"' in colorer(xml, {'{resultat_final}': 'ko'})

    def test_alerte_rougit_une_case_blanche(self):
        assert 'val="FF0000"' in colorer(case('{note}'), {'{note}': 'alerte'})

    def test_ne_touche_pas_une_case_sans_drapeau(self):
        xml = case('Total')
        assert colorer(xml, {'{note}': 'alerte'}) == xml


class TestLignesRepetees:
    def test_une_ligne_par_element_et_couleur_propre(self):
        xml = tableau([PORTEUSE], 180000)
        lignes = [{'{code}': 'G1', '{intitule}': 'Freins', '{note}': '90', '@couleurs': {}},
                  {'{code}': 'G2', '{intitule}': 'Piston', '{note}': '23',
                   '@couleurs': {'{note}': 'alerte'}}]
        sortie = repeter_lignes(xml, {'{code}': lignes}, etendre=('{code}',))
        assert sortie.count('<a:tr ') == 2
        assert 'G1: Freins / 100' in sortie and 'G2: Piston / 100' in sortie
        assert sortie.count('val="FF0000"') == 1
        assert '@couleurs' not in sortie

    def test_un_intitule_long_prend_deux_lignes(self):
        xml = tableau([PORTEUSE], 180000)
        long = 'Dépose et pose des composants à l’aide d’un compresseur de ressort hélicoïdal'
        sortie = repeter_lignes(xml, {'{code}': [{'{code}': 'G13', '{intitule}': long, '{note}': '94'}]},
                                etendre=('{code}',))
        assert int(re.search(r'<a:tr h="(\d+)"', sortie).group(1)) > 180000

    def test_resserre_quand_la_place_manque(self):
        xml = tableau([PORTEUSE], 180000)
        lignes = [{'{code}': f'G{i}', '{intitule}': 'Module', '{note}': '80'} for i in range(30)]
        sortie = repeter_lignes(xml, {'{code}': lignes}, etendre=('{code}',))
        hauteurs = [int(h) for h in re.findall(r'<a:tr h="(\d+)"', sortie)]
        assert sum(hauteurs) <= 2000000
        assert all(int(s) < 1000 for s in re.findall(r'sz="(\d+)"', sortie))

    def test_retire_les_lignes_designees(self):
        xml = '<a:tr h="1"><a:t>{a}</a:t></a:tr><a:tr h="1"><a:t>{b}</a:t></a:tr>'
        assert retirer_lignes(xml, ['{b}']) == '<a:tr h="1"><a:t>{a}</a:t></a:tr>'


def test_lignes_de_replie_mot_a_mot():
    assert lignes_de('un deux trois', 20) == 1
    assert lignes_de('un deux trois', 8) == 2


class TestModeleDuDepot:
    """Le rapport ne depend d'aucun dossier externe : le modele est versionne."""

    def test_le_modele_est_present(self):
        assert service.MODELE.exists(), f'modele absent : {service.MODELE}'

    def test_la_fiche_de_certification_porte_ses_drapeaux(self):
        with zipfile.ZipFile(service.MODELE) as z:
            xml = z.read('ppt/slides/slide26.xml').decode('utf8')
        for drapeau in ('{filiale}', '{code_module_1}', '{note_1}', '{total_points}',
                        '{pourcentage}', '{resultat_pratique}', '{resultat_final}'):
            assert drapeau in xml, drapeau


@pytest.mark.skipif(not service.Path(service.SOFFICE).exists(), reason='LibreOffice absent')
def test_rendu_d_une_fiche(tmp_path, monkeypatch):
    """Integration : la fiche de certification se convertit en image."""
    monkeypatch.setattr(service, 'CACHE', tmp_path)
    chemin = service.image_de(26, {'{nom_complet}': 'Paul KAMGA', '{filiale}': 'CFAO MOBILITY CAMEROUN'})
    assert service.Path(chemin).stat().st_size > 10000


def test_poser_vignette_montre_la_couverture_dans_l_explorateur(tmp_path):
    from PIL import Image
    pptx = tmp_path / 'r.pptx'
    shutil.copy(service.MODELE, pptx)
    image = tmp_path / 'c.png'
    Image.new('RGB', (1280, 720), 'navy').save(image)
    service.poser_vignette(pptx, image)
    service.poser_vignette(pptx, image)
    with zipfile.ZipFile(pptx) as z:
        assert z.read('_rels/.rels').decode().count(service.TYPE_VIGNETTE) == 1
        assert z.read('[Content_Types].xml').decode().lower().count('extension="jpeg"') == 1
        assert z.namelist().count('docProps/thumbnail.jpeg') == 1
        with Image.open(z.open('docProps/thumbnail.jpeg')) as v:
            assert (v.format, v.size) == ('JPEG', (256, 144))


def test_l_apercu_change_quand_sa_photo_arrive_ou_change(tmp_path, monkeypatch):
    import photos
    monkeypatch.setattr(photos, 'PERMANENT', tmp_path / 'photos')
    monkeypatch.setattr(service, 'CACHE', tmp_path / 'cache')
    valeurs = {'@photos': {'9': [{'id': 'c' * 16}]}}
    absente = service.empreinte(9, valeurs)
    fichier = tmp_path / 'photos' / ('c' * 16 + '.jpg')
    fichier.write_bytes(b'jpeg-1')
    arrivee = service.empreinte(9, valeurs)
    fichier.write_bytes(b'jpeg-22')
    remplacee = service.empreinte(9, valeurs)
    assert len({absente, arrivee, remplacee}) == 3
    assert service.empreinte(9, valeurs) == remplacee


def test_le_menage_efface_les_apercus_inutilises(tmp_path, monkeypatch):
    import os
    import time

    monkeypatch.setattr(service, 'CACHE', tmp_path)
    monkeypatch.setattr(service, '_dernier_menage', 0.0)
    (tmp_path / 'classeurs').mkdir()
    vieux, recent, autre = tmp_path / 'a.png', tmp_path / 'b.png', tmp_path / 'c.pptx'
    classeur_vieux, classeur_recent = tmp_path / 'classeurs' / 'd.png', tmp_path / 'classeurs' / 'e.png'
    for f in (vieux, recent, autre, classeur_vieux, classeur_recent):
        f.write_bytes(b'x')
    il_y_a_un_mois = time.time() - 30 * 24 * 3600
    for f in (vieux, autre, classeur_vieux):
        os.utime(f, (il_y_a_un_mois, il_y_a_un_mois))
    service.menage_des_apercus()
    assert not vieux.exists() and recent.exists() and autre.exists()
    assert not classeur_vieux.exists() and classeur_recent.exists()
