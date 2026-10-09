"""La mise en page finale : rien sous les logos, des tailles de texte ecrites en clair."""
import re

import mise_en_page as M
import photos

CM = M.EMU_PAR_CM


def _zone(texte, y, cy, ajustement='<a:normAutofit lnSpcReduction="10000"/>', sz=1600, nom='Zone'):
    paragraphes = ''.join(f'<a:p><a:r><a:rPr lang="fr-FR" sz="{sz}"/><a:t>{t}</a:t></a:r></a:p>'
                          for t in texte)
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="2" name="{nom}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{CM}" y="{y}"/><a:ext cx="{14 * CM}" cy="{cy}"/></a:xfrm></p:spPr>'
            f'<p:txBody><a:bodyPr lIns="0" rIns="0">{ajustement}</a:bodyPr><a:lstStyle/>'
            f'{paragraphes}</p:txBody></p:sp>')


def _bas(forme):
    x, y, cx, cy = M._position(forme)
    return y + cy


def _corps(forme):
    return {int(v) for v in re.findall(r'<a:rPr[^>]*sz="(\d+)"', forme)}


def test_le_pied_de_page_est_retire():
    pied = ('<p:sp><p:nvSpPr><p:cNvPr id="3" name="Pied"/><p:cNvSpPr/>'
            '<p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr>'
            '<p:txBody><a:p><a:r><a:t>FORMATION DU 10/08 AU 14/08</a:t></a:r></a:p></p:txBody></p:sp>')
    xml = M.ajuster('<p:spTree>' + pied + _zone(['court'], 3 * CM, 2 * CM) + '</p:spTree>')
    assert 'FORMATION DU' not in xml and 'court' in xml


def test_un_texte_trop_long_est_reduit_et_ecrit_en_clair():
    lignes = ['Une thematique abordee pendant la journee, assez longue pour passer a la ligne'] * 30
    forme = M.ajuster_zone(_zone(lignes, round(3.33 * CM), round(14.57 * CM)))
    assert _bas(forme) <= M.LIMITE_BAS
    assert max(_corps(forme)) < 1600
    assert 'fontScale' not in forme and 'lnSpcReduction="10000"' in forme
    _, y, cx, cy = M._position(forme)
    paras = M.paragraphes(M._corps(forme).group(1))
    assert M.hauteur_paragraphes(paras, cx, 1.0, 10000) <= cy - 2 * 45720


def test_un_texte_qui_tient_garde_son_corps_mais_remonte_au_dessus_des_logos():
    forme = M.ajuster_zone(_zone(['Evaluation d’entree'], round(3.33 * CM), round(14.57 * CM)))
    assert _corps(forme) == {1600}
    assert _bas(forme) == M.LIMITE_BAS


def test_un_commentaire_qui_deborde_passe_a_12_points_et_remonte_au_besoin():
    texte = ['La moyenne passe de 87 % a 92 % en fin de session, soit une progression de 6 %. '
             'Ce gain mesure s’explique par un niveau de depart deja eleve : la marge restait limitee. '
             'A l’inverse, un participant ne progresse pas sur la partie theorique.']
    origine = _zone(texte, round(15.91 * CM), round(1.45 * CM), '<a:spAutoFit/>', sz=1400)
    forme = M.ajuster_cadre_auto(origine)
    assert _corps(forme) == {1200}
    assert _bas(forme) <= M.LIMITE_BAS
    assert M._position(forme)[1] >= round(15.91 * CM) - M.REMONTEE_MAX


def test_une_zone_placee_bas_par_le_modele_est_laissee():
    couverture = _zone(['Kinshasa, du 10 au 14 aout 2026'], round(17.38 * CM), round(0.94 * CM),
                       '<a:spAutoFit/>')
    assert M.ajuster_cadre_auto(couverture) == couverture


def test_un_tableau_cede_l_exces_a_sa_derniere_ligne():
    cadre = (f'<p:graphicFrame><p:xfrm><a:off x="{CM}" y="{round(3.52 * CM)}"/>'
             f'<a:ext cx="{14 * CM}" cy="{round(14.38 * CM)}"/></p:xfrm><a:graphic><a:graphicData>'
             f'<a:tbl><a:tr h="{round(2.85 * CM)}"></a:tr><a:tr h="{round(11.53 * CM)}"></a:tr></a:tbl>'
             '</a:graphicData></a:graphic></p:graphicFrame>')
    sortie = M.ajuster_tableau(cadre)
    assert _bas(sortie) == M.LIMITE_BAS
    hauteurs = [int(h) for h in re.findall(r'<a:tr h="(\d+)"', sortie)]
    assert hauteurs[0] == round(2.85 * CM) and sum(hauteurs) == M.LIMITE_BAS - round(3.52 * CM)


def test_un_tableau_repartit_l_exces_sur_ses_lignes_sans_toucher_l_en_tete():
    # Liste des stagiaires (page 3) : une seule ligne amputee de 0,26 cm
    # descendait sous sa hauteur minimale, et LibreOffice la regrandissait.
    y, entete, ligne = round(7.14 * CM), round(0.86 * CM), round(0.83 * CM)
    hauteur = entete + 12 * ligne
    rangs = f'<a:tr h="{entete}"></a:tr>' + f'<a:tr h="{ligne}"></a:tr>' * 12
    cadre = (f'<p:graphicFrame><p:xfrm><a:off x="{CM}" y="{y}"/>'
             f'<a:ext cx="{14 * CM}" cy="{hauteur}"/></p:xfrm><a:graphic><a:graphicData>'
             f'<a:tbl>{rangs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>')
    sortie = M.ajuster_tableau(cadre)
    hauteurs = [int(h) for h in re.findall(r'<a:tr h="(\d+)"', sortie)]
    assert _bas(sortie) == M.LIMITE_BAS == y + sum(hauteurs)
    assert hauteurs[0] == entete
    assert max(hauteurs[1:]) - min(hauteurs[1:]) <= 1
    assert min(hauteurs[1:]) >= round(0.80 * CM)


def _numero(x, cx, chiffre='3'):
    return ('<p:sp><p:nvSpPr><p:cNvPr id="4" name="Numero"/><p:cNvSpPr/>'
            '<p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{x}" y="{round(18.18 * CM)}"/>'
            f'<a:ext cx="{cx}" cy="{round(0.3 * CM)}"/></a:xfrm></p:spPr>'
            '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{1}" type="slidenum">'
            f'<a:rPr lang="fr-FR"/><a:t>{chiffre}</a:t></a:fld></a:p></p:txBody></p:sp>')


def test_le_numero_de_page_affiche_est_celui_du_rapport():
    xml = ('<a:fld id="{1}" type="slidenum"><a:rPr lang="en-US"/><a:pPr/><a:t>11</a:t></a:fld>')
    assert '<a:t>4</a:t>' in M.numeroter(xml, 4)


def test_un_numero_a_deux_chiffres_tient_sur_une_ligne_au_meme_bord_droit():
    # 0,36 cm : la case que PowerPoint taille pour « 13 », ou LibreOffice casse « 1 » sur « 3 ».
    x, cx = round(29.02 * CM), round(0.36 * CM)
    sortie = M.numeroter(_numero(x, cx), 13)
    nx, _, ncx, _ = M._position(sortie)
    assert '<a:t>13</a:t>' in sortie
    assert ncx >= round(0.45 * CM) and nx + ncx == x + cx
    assert '<a:bodyPr/>' in sortie


def test_une_case_de_numero_assez_large_garde_sa_place():
    x, cx = round(28.68 * CM), round(0.70 * CM)
    sortie = M.numeroter(_numero(x, cx), 12)
    assert M._position(sortie)[::2] == (x, cx)


CADRE = (round(17.31 * CM), round(3.33 * CM), round(15.91 * CM), round(14.32 * CM))


def test_une_legende_vide_ne_laisse_pas_de_bande():
    haut = {'x': 0, 'y': 0, 'l': 1, 'h': 0.5, 'legende': ''}
    bas = {'x': 0, 'y': 0.5, 'l': 1, 'h': 0.5, 'legende': 'Explication des 7 etapes de diagnostic'}
    cases, poses = photos.disposer(CADRE, [haut, bas])
    assert cases[0][3] == cases[1][3]
    assert len(poses) == 1
    (x, y, l, h), texte, corps, rang = poses[0]
    assert rang == 1 and y == cases[1][1] + cases[1][3]
    assert y + h == CADRE[1] + CADRE[3]
    assert cases[1][1] == cases[0][1] + cases[0][3] + photos.ECART


def test_deux_voisines_de_meme_legende_n_en_portent_qu_une():
    texte = 'Expose par groupe des systemes de climatisation'
    liste = [{'x': 0, 'y': 0, 'l': 0.5, 'h': 1, 'legende': texte},
             {'x': 0.5, 'y': 0, 'l': 0.5, 'h': 1, 'legende': texte}]
    cases, poses = photos.disposer(CADRE, liste)
    assert len(poses) == 1
    (x, y, l, h), _, corps, _ = poses[0]
    assert (x, l) == (CADRE[0], CADRE[2]) and corps == photos.CORPS_COMMUNE


def test_une_zone_qui_deborde_descend_par_paliers_de_deux_points():
    titre = '<a:p><a:r><a:rPr lang="fr-FR" sz="2200" b="1"/><a:t>Jour 2</a:t></a:r></a:p>'
    lignes = ['Une thematique abordee pendant la journee, assez longue pour passer a la ligne'] * 14
    forme = _zone(lignes, round(3.33 * CM), round(14.57 * CM))
    forme = forme.replace('<a:lstStyle/>', '<a:lstStyle/>' + titre)
    corps = _corps(M.ajuster_zone(forme))
    retrait = 2200 - max(corps)
    assert retrait > 0 and retrait % M.PALIER == 0
    assert corps == {2200 - retrait, 1600 - retrait}


def _jour(lignes):
    titre = '<a:p><a:r><a:rPr lang="fr-FR" sz="2200" b="1"/><a:t>Thematiques</a:t></a:r></a:p>'
    forme = _zone(lignes, round(3.33 * CM), round(14.57 * CM), nom='Espace réservé du contenu 2')
    return '<p:spTree>' + forme.replace('<a:lstStyle/>', '<a:lstStyle/>' + titre) + '</p:spTree>'


def test_un_resume_de_jour_court_prend_la_taille_standard_14_20():
    assert _corps(M.ajuster(_jour(['Lecture du DTC']))) == {2000, 1400}


def test_tous_les_jours_prennent_la_taille_du_plus_long():
    long_ = _jour(['Une thematique abordee pendant la journee, assez longue pour passer a la ligne'] * 14)
    court = _jour(['Lecture du DTC'])
    communs = {}
    for xml in (long_, court):
        for cle, retrait in M.besoins(xml).items():
            communs[cle] = max(communs.get(cle, 0), retrait)
    assert list(communs.values()) == [2 * M.PALIER]
    assert _corps(M.ajuster(court, communs)) == _corps(M.ajuster(long_, communs)) == {1800, 1200}


def test_tous_les_commentaires_prennent_12_points_meme_quand_ils_tiennent():
    origine = _zone(['La moyenne progresse de 6 %.'], round(15.79 * CM), round(1.45 * CM),
                    '<a:spAutoFit/>', sz=1400, nom='Rectangle 21')
    forme = M.ajuster_cadre_auto(origine)
    assert _corps(forme) == {M.CORPS_COMMENTAIRE}
    assert M._position(forme)[1] == round(15.79 * CM)
    autre = _zone(['Objectifs'], round(3.52 * CM), round(1.8 * CM), '<a:spAutoFit/>', sz=1800,
                  nom='ZoneTexte 16')
    assert M.ajuster_cadre_auto(autre) == autre


def test_une_legende_pleine_largeur_prend_12_points_une_demi_11():
    liste = [{'x': 0, 'y': 0, 'l': 1, 'h': 0.5, 'legende': 'Banc de diagnostic'},
             {'x': 0, 'y': 0.5, 'l': 0.5, 'h': 0.5, 'legende': 'Lecture du schema'},
             {'x': 0.5, 'y': 0.5, 'l': 0.5, 'h': 0.5, 'legende': 'Mesure de pression'}]
    _, poses = photos.disposer(CADRE, liste)
    corps = {rang: c for _, _, c, rang in poses}
    assert corps == {0: photos.CORPS_COMMUNE, 1: photos.CORPS_LEGENDE, 2: photos.CORPS_LEGENDE}


def test_une_longue_legende_reduit_son_corps_et_agrandit_sa_bande():
    texte = ('Etude du principe de fonctionnement du systeme de climatisation des differents '
             'vehicules dans le manuel de reparation, puis lecture des schemas electriques')
    liste = [{'x': 0, 'y': 0, 'l': 0.5, 'h': 1, 'legende': texte},
             {'x': 0.5, 'y': 0, 'l': 0.5, 'h': 1, 'legende': 'Analyse des donnees'}]
    cases, poses = photos.disposer(CADRE, liste)
    assert {p[2] for p in poses} == {photos.CORPS_LEGENDE_MIN}
    bandes = {p[0][3] for p in poses}
    assert len(bandes) == 1 and bandes.pop() > photos.BANDE_LEGENDE
