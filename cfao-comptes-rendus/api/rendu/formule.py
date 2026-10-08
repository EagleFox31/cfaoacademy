"""La formule des comptes rendus de certification : tests e-learning + tests pratique = certification.

Les comptes rendus de reference la dessinent sous le bilan, en rouge :
une phrase, trois ellipses et les signes « + » et « = ». Le modele de
formation n'en a pas : le service l'ajoute a la page du bilan d'une
certification (diapositive 20), au meme endroit et aux memes mesures que
dans les comptes rendus de G3, et rogne la zone de texte pour lui laisser
la place.
"""
import html
import re

ROUGE = 'FF0000'
# La zone de texte du bilan garde la hauteur qu'elle a dans les comptes
# rendus de reference, pour que le texte ne descende pas sur la formule.
HAUTEUR_TEXTE = 3773568
PREMIER_ID = 9001

_STYLE_ELLIPSE = (
    '<p:style><a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef>'
    '<a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>'
    '<a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>'
    '<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef></p:style>')


def _phrase(texte, ident):
    run = (f'<a:r><a:rPr lang="fr-FR" sz="1200" b="1" dirty="0"><a:solidFill><a:srgbClr val="{ROUGE}"/>'
           f'</a:solidFill></a:rPr><a:t>{html.escape(texte, quote=False)}</a:t></a:r>')
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{ident}" name="Formule certification : phrase"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        '<p:spPr><a:xfrm><a:off x="6041663" y="5090468"/><a:ext cx="6096000" cy="460000"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        f'<p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/>{run}</a:p></p:txBody></p:sp>')


def _ellipse(lignes, x, y, l, h, taille, ident):
    paragraphes = ''.join(
        f'<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="{taille}" b="1" dirty="0"/>'
        f'<a:t>{html.escape(t, quote=False)}</a:t></a:r></a:p>' for t in lignes)
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{ident}" name="Formule certification : {html.escape(lignes[-1], quote=True)}"/>'
        '<p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{l}" cy="{h}"/></a:xfrm>'
        f'<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="{ROUGE}"/></a:solidFill>'
        f'<a:ln><a:noFill/></a:ln></p:spPr>{_STYLE_ELLIPSE}'
        f'<p:txBody><a:bodyPr lIns="0" rIns="0" tIns="0" bIns="0" rtlCol="0" anchor="ctr"/><a:lstStyle/>{paragraphes}</p:txBody></p:sp>')


def _signe(signe, x, l, ident):
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{ident}" name="Formule certification : {signe}"/>'
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="5340311"/><a:ext cx="{l}" cy="1200329"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
        '<p:txBody><a:bodyPr wrap="none" rtlCol="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p>'
        f'<a:r><a:rPr lang="fr-FR" sz="7200" b="1" dirty="0"><a:solidFill><a:srgbClr val="{ROUGE}"/></a:solidFill></a:rPr>'
        f'<a:t>{signe}</a:t></a:r></a:p></p:txBody></p:sp>')


def formes(phrase):
    """Les formes de la formule, avec `phrase` pour legende."""
    i = PREMIER_ID
    return ''.join([
        _phrase(phrase, i),
        _ellipse(['Tests ', 'E-learning'], 6264986, 5543962, 1462613, 737628, 1400, i + 1),
        _signe('+', 7675836, 401078, i + 2),
        _ellipse(['Tests', 'Pratique'], 8342792, 5581497, 1391018, 737628, 1400, i + 3),
        _signe('=', 9695897, 363501, i + 4),
        _ellipse(['Certification'], 10359504, 5581497, 1701150, 737628, 1300, i + 5),
    ])


def ajouter_formule(xml, phrase):
    """La page du bilan avec la formule ; sans `phrase`, la page telle quelle."""
    if not phrase or '{bilan_contexte}' not in xml or 'Formule certification' in xml:
        return xml
    # La zone de texte du bilan est le seul espace reserve au contenu.
    xml = re.sub(
        r'(<p:ph idx="14"/>.*?<a:ext cx="\d+" cy=")\d+(")',
        lambda m: f'{m.group(1)}{HAUTEUR_TEXTE}{m.group(2)}', xml, count=1, flags=re.S)
    return xml.replace('</p:spTree>', formes(phrase) + '</p:spTree>', 1)
