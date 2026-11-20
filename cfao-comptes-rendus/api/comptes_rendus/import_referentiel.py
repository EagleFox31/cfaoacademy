"""Import du fichier Excel « Liste des participants aux formations ».

Trois temps, sans etat partage :

    lignes = lire(fichier)             le fichier Excel, une ligne par stagiaire d'une session
    rapport = analyser(lignes)         l'essai : ce qui serait fait, rien n'est ecrit
    rapport = appliquer(lignes, ...)   l'application, en une transaction

Une ligne du fichier est un stagiaire d'une session. Les colonnes sont
reperees par leur titre (compare sans accents ni majuscules) : une colonne
renommee ou absente refuse l'import en la nommant. Les colonnes de frais,
de vols, d'hebergement et de notes sont ignorees.

L'import ne supprime jamais rien : un stagiaire absent du fichier est
signale, une formation dont le libelle differe est signalee et gardee.
Le fichier est lu en memoire et n'est jamais conserve.
"""
import re
import unicodedata
from collections import Counter
from datetime import date, datetime, timedelta

from django.db import transaction

from core.auth.identity import _profils_locaux

from .models import Animation, Formation, ImportReferentiel, Inscription, Session, Stagiaire

JOURS_MAX = 5


def _limite(*champs):
    """La plus petite longueur permise parmi des champs de modele (`Modele.champ`)."""
    return min(c.field.max_length for c in champs)


# Cle de la ligne lue -> longueur permise : lue sur les colonnes du modele, pour
# qu'une valeur trop longue soit signalee a l'analyse au lieu de lever une
# erreur de base a l'application.
LIMITES = {
    "numero": _limite(Session.numero),
    "reference": _limite(Formation.code),
    "marque": _limite(Formation.marque),
    "designation": _limite(Formation.libelle, Session.libelle_fichier),
    "lieu": _limite(Session.lieu),
    "nom": _limite(Stagiaire.nom),
    "prenom": _limite(Stagiaire.prenom),
    "pays": _limite(Stagiaire.pays, Session.pays),
}
LIMITE_CLE = _limite(Stagiaire.cle)
LIMITE_ANIMATEUR = _limite(Animation.nom_fichier)

# Titre attendu (comme dans le fichier) -> cle de la ligne lue.
# Les colonnes « cles » manquantes refusent l'import ; les autres sont facultatives.
COLONNES = {
    "N° de la Formation": "numero",
    "Référence": "reference",
    "Marques": "marque",
    "Désignation formation": "designation",
    "Animateurs": "animateurs",
    "Date début formation": "debut",
    "Date fin formation": "fin",
    "Lieu de la formation": "lieu",
    "Noms": "nom",
    "Prénoms": "prenom",
    "Pays stagiaires": "pays",
    "Présence à la formation": "presence",
}
CLES = ("numero", "reference", "designation", "debut", "fin", "nom", "prenom", "pays")
TITRE_PIVOT = "N° de la Formation"
LIGNES_TITRES_MAX = 60

# Graphies de pays (normalisees) -> forme retenue.
PAYS = {
    "Cameroun": ["cameroun", "cmr"],
    "Côte d'Ivoire": ["cote d ivoire", "cote divoire", "rci", "civ", "ivoire"],
    "RDC": ["rdc", "congo rdc", "rd congo", "republique democratique du congo",
            "congo kinshasa", "drc"],
    "Congo": ["congo", "congo brazzaville", "republique du congo", "rep du congo"],
    "Gabon": ["gabon"],
    "Sénégal": ["senegal"],
    "Bénin": ["benin"],
    "Togo": ["togo"],
    "Guinée équatoriale": ["guinee equatoriale", "guinee eq"],
    "Tchad": ["tchad"],
    "Centrafrique": ["centrafrique", "rca", "republique centrafricaine"],
    "Burkina Faso": ["burkina faso", "burkina"],
    "Mali": ["mali"],
    "Niger": ["niger"],
    "Guinée": ["guinee", "guinee conakry"],
    "Madagascar": ["madagascar"],
    "Nigeria": ["nigeria"],
    "Ghana": ["ghana"],
}
_PAYS_PAR_GRAPHIE = {g: p for p, graphies in PAYS.items() for g in graphies}


class FichierInvalide(Exception):
    """Le fichier ne peut pas etre importe ; le message dit pourquoi."""


# ── Normalisation ──────────────────────────────────────────────────────

def normaliser(texte):
    """Sans accents, en minuscules, ponctuation et espaces reduits a un espace."""
    texte = str(texte or "").replace("º", "°")
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", texte.lower()).strip()


def pays_normalise(brut):
    """(forme retenue, connu ?) ; une graphie inconnue est gardee telle quelle."""
    brut = " ".join(str(brut or "").split())
    connu = _PAYS_PAR_GRAPHIE.get(normaliser(brut))
    return (connu or brut), bool(connu) or not brut


def cle_stagiaire(nom, prenom, pays):
    return "|".join(normaliser(x) for x in (nom, prenom, pays))


def nom_affiche(nom):
    return " ".join(str(nom or "").split()).upper()


def prenom_affiche(prenom):
    return re.sub(r"[^\s\-']+", lambda m: m.group()[:1].upper() + m.group()[1:].lower(),
                  " ".join(str(prenom or "").split()))


def pays_de_lieu(lieu):
    """Le pays cite dans le lieu de la formation (« Douala, Cameroun »), sinon vide."""
    texte = f" {normaliser(lieu)} "
    for graphie in sorted(_PAYS_PAR_GRAPHIE, key=len, reverse=True):
        if f" {graphie} " in texte:
            return _PAYS_PAR_GRAPHIE[graphie]
    return ""


def animateurs_de(cellule):
    """Les noms d'une cellule « Animateurs » : separes par /, virgule, point-virgule, « et » ou retour a la ligne."""
    morceaux = re.split(r"\s*(?:/|,|;|\n|\r)\s*|\s+et\s+", str(cellule or ""), flags=re.I)
    return [" ".join(m.split()) for m in morceaux if m and m.strip()]


# ── Lecture du fichier ─────────────────────────────────────────────────

def _texte(valeur):
    if valeur is None:
        return ""
    if isinstance(valeur, float) and valeur.is_integer():
        return str(int(valeur))
    if isinstance(valeur, (datetime, date)):
        return valeur.strftime("%d/%m/%Y")
    return str(valeur).strip()


def lire_date(valeur):
    """Une date Excel (datetime) ou un texte jj/mm/aaaa ; None si illisible."""
    if isinstance(valeur, datetime):
        return valeur.date()
    if isinstance(valeur, date):
        return valeur
    if isinstance(valeur, (int, float)) and not isinstance(valeur, bool) and 20000 < valeur < 80000:
        from openpyxl.utils.datetime import from_excel
        return from_excel(valeur).date()
    m = re.fullmatch(r"\s*(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\s*", str(valeur or ""))
    if not m:
        return None
    jour, mois, annee = int(m[1]), int(m[2]), int(m[3])
    try:
        return date(annee + 2000 if annee < 100 else annee, mois, jour)
    except ValueError:
        return None


def _absent(presence):
    p = normaliser(presence)
    return p.startswith("absent") or p in ("non", "n", "0", "abs")


def lire(fichier):
    """Les lignes du fichier Excel (chemin ou objet fichier) : une par stagiaire d'une session.

    Chaque ligne est un dict : `ligne` (numero Excel), `numero`, `reference`, `marque`,
    `designation`, `animateurs`, `debut`, `fin` (date ou None, avec `debut_brut` et
    `fin_brut`), `lieu`, `nom`, `prenom`, `pays`, `absent`.
    """
    from openpyxl import load_workbook
    try:
        classeur = load_workbook(fichier, read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001 — zip invalide, format inconnu...
        raise FichierInvalide("fichier Excel illisible (format .xlsx attendu)") from e
    try:
        attendus = {normaliser(t): cle for t, cle in COLONNES.items()}
        for feuille in classeur.worksheets:
            lignes = feuille.iter_rows(values_only=True)
            colonnes = None
            for i, valeurs in enumerate(lignes, start=1):
                if i > LIGNES_TITRES_MAX:
                    break
                titres = {normaliser(v): j for j, v in enumerate(valeurs) if v is not None}
                if normaliser(TITRE_PIVOT) in titres:
                    colonnes = {cle: titres[t] for t, cle in attendus.items() if t in titres}
                    break
            if colonnes is None:
                continue
            manquantes = [t for t, cle in COLONNES.items() if cle in CLES and cle not in colonnes]
            if manquantes:
                raise FichierInvalide("colonne(s) manquante(s) : "
                                      + ", ".join(f"« {t} »" for t in manquantes))
            sortie = []
            for numero_excel, valeurs in enumerate(lignes, start=i + 1):
                def cellule(cle, valeurs=valeurs):
                    j = colonnes.get(cle)
                    return valeurs[j] if j is not None and j < len(valeurs) else None
                if not any(v not in (None, "") and str(v).strip() for v in valeurs):
                    continue
                ligne = {"ligne": numero_excel}
                for cle in ("numero", "reference", "marque", "lieu", "pays"):
                    ligne[cle] = " ".join(_texte(cellule(cle)).split())
                ligne["designation"] = " ".join(_texte(cellule("designation")).split())
                ligne["animateurs"] = _texte(cellule("animateurs"))
                ligne["nom"] = " ".join(_texte(cellule("nom")).split())
                ligne["prenom"] = " ".join(_texte(cellule("prenom")).split())
                for cle in ("debut", "fin"):
                    ligne[cle] = lire_date(cellule(cle))
                    ligne[cle + "_brut"] = _texte(cellule(cle))
                ligne["absent"] = _absent(_texte(cellule("presence")))
                sortie.append(ligne)
            if not sortie:
                raise FichierInvalide("aucune ligne de stagiaire sous les titres")
            return sortie
        raise FichierInvalide(f"colonne « {TITRE_PIVOT} » introuvable : aucune feuille ne porte la ligne de titres")
    finally:
        classeur.close()


# ── Analyse ────────────────────────────────────────────────────────────

def _frequent(valeurs):
    valeurs = [v for v in valeurs if v]
    return Counter(valeurs).most_common(1)[0][0] if valeurs else ""


def _etiquette(numero, debut):
    return f"{numero} ({debut:%d/%m/%Y})"


_TITRES = {cle: titre for titre, cle in COLONNES.items()}


def _trop_longues(l):
    """[(titre de colonne, longueur, limite)] des valeurs de la ligne que la base ne peut pas garder.

    Les valeurs mesurees sont celles qui seraient ecrites (nom en majuscules,
    pays a sa graphie retenue)."""
    pays = pays_normalise(l["pays"])[0]
    valeurs = {**{c: l[c] for c in ("numero", "reference", "marque", "designation", "lieu")},
               "nom": nom_affiche(l["nom"]), "prenom": prenom_affiche(l["prenom"]), "pays": pays}
    trop = [(_TITRES[c], len(v), LIMITES[c]) for c, v in valeurs.items() if len(v) > LIMITES[c]]
    cle = cle_stagiaire(l["nom"], l["prenom"], pays)
    if not trop and len(cle) > LIMITE_CLE:
        trop.append((f"{_TITRES['nom']} / {_TITRES['prenom']} / {_TITRES['pays']}", len(cle), LIMITE_CLE))
    return trop


def _grouper(lignes):
    """(sessions, anomalies) : les lignes regroupees par (numero, debut)."""
    anomalies = []
    groupes = {}
    pays_inconnus = Counter()
    for l in lignes:
        if not l["numero"] or not l["nom"] or l["debut"] is None:
            raison = ("numero de formation absent" if not l["numero"]
                      else "nom absent" if not l["nom"] else "date de debut absente ou illisible")
            anomalies.append({"type": "ligne_ignoree", "session": l["numero"],
                              "message": f"ligne {l['ligne']} ignoree : {raison}"})
            continue
        trop = _trop_longues(l)
        if trop:
            for titre, n, limite in trop:
                anomalies.append({"type": "valeur_trop_longue", "session": l["numero"][:LIMITES["numero"]],
                                  "message": f"ligne {l['ligne']} ignoree : « {titre} » compte {n} caracteres "
                                             f"(au plus {limite})"})
            continue
        groupes.setdefault((l["numero"], l["debut"]), []).append(l)

    sessions = []
    for (numero, debut), rows in groupes.items():
        etiquette = _etiquette(numero, debut)

        def note(type_, message, etiquette=etiquette):
            anomalies.append({"type": type_, "session": etiquette, "message": message})

        references = Counter(r["reference"] for r in rows if r["reference"])
        if not references:
            note("reference_vide", "Reference vide : code de formation a completer")
        elif len({normaliser(r) for r in references}) > 1:
            note("references_multiples", "plusieurs references pour la meme session : "
                 + ", ".join(sorted(references)))
        reference = _frequent([r["reference"] for r in rows])

        libelles = {normaliser(r["designation"]): r["designation"] for r in rows if r["designation"]}
        if len(libelles) > 1:
            note("libelles_multiples", "deux libelles pour la meme session : "
                 + " / ".join(sorted(libelles.values())))
        designation = _frequent([r["designation"] for r in rows])

        fins = [r["fin"] for r in rows if r["fin"]]
        fin = _frequent(fins) if fins else None
        if len(set(fins)) > 1:
            note("fins_multiples", "dates de fin differentes pour la meme session")
        if fin is None:
            note("fin_absente", "date de fin absente ou illisible : fin ramenee au debut")
            fin = debut
        elif fin < debut:
            note("fin_avant_debut", f"fin ({fin:%d/%m/%Y}) avant le debut : fin ramenee au debut")
            fin = debut
        elif (ouvres := sum(1 for k in range((fin - debut).days + 1)
                            if (debut + timedelta(days=k)).weekday() < 5)) > JOURS_MAX:
            note("session_trop_longue", f"{ouvres} jours ouvres (plus de {JOURS_MAX}) : "
                 "une semaine de plus forme une autre session")

        lieu = _frequent([r["lieu"] for r in rows])
        animateurs, vus = [], set()
        for r in rows:
            for a in animateurs_de(r["animateurs"]):
                if normaliser(a) in vus:
                    continue
                vus.add(normaliser(a))
                if len(a) > LIMITE_ANIMATEUR:
                    note("valeur_trop_longue", f"ligne {r['ligne']} : « {_TITRES['animateurs']} » : un nom compte "
                         f"{len(a)} caracteres (au plus {LIMITE_ANIMATEUR}) : animateur ignore")
                    continue
                animateurs.append(a)

        stagiaires = {}
        for r in rows:
            pays, connu = pays_normalise(r["pays"])
            if not connu:
                pays_inconnus[pays] += 1
            cle = cle_stagiaire(r["nom"], r["prenom"], pays)
            if cle in stagiaires:
                note("homonyme", f"stagiaire present deux fois : {nom_affiche(r['nom'])} "
                     f"{prenom_affiche(r['prenom'])} ({pays or 'pays vide'})")
                continue
            stagiaires[cle] = {"nom": nom_affiche(r["nom"]), "prenom": prenom_affiche(r["prenom"]),
                               "pays": pays, "absent": r["absent"]}

        sessions.append({
            "numero": numero, "debut": debut, "fin": fin, "etiquette": etiquette,
            "reference": reference, "designation": designation, "marque": _frequent([r["marque"] for r in rows]),
            "lieu": lieu, "pays": pays_de_lieu(lieu), "animateurs": animateurs, "stagiaires": stagiaires,
        })
    for pays, n in sorted(pays_inconnus.items()):
        anomalies.append({"type": "pays_inconnu", "session": "",
                          "message": f"pays inconnu « {pays} » ({n} ligne{'s' if n > 1 else ''}) : garde tel quel"})
    return sessions, anomalies


def _index_profils():
    """nom normalise (« prenom nom » ou « nom prenom ») -> ids de profil locaux."""
    index = {}
    for p in _profils_locaux():
        if not p.get("id"):
            continue
        prenom, nom = p.get("firstName") or "", p.get("lastName") or ""
        for forme in (f"{prenom} {nom}", f"{nom} {prenom}"):
            n = normaliser(forme)
            if n:
                index.setdefault(n, set()).add(str(p["id"]))
    return index


def _formateur_id(nom, profils):
    ids = profils.get(normaliser(nom), set())
    return next(iter(ids)) if len(ids) == 1 else ""


def _executer(lignes, ecrire, nom_fichier=""):
    """Un seul chemin pour l'essai et l'application : le rapport est celui de ce qui est fait."""
    sessions, anomalies = _grouper(lignes)
    profils = _index_profils()
    formations = {f.code: f for f in Formation.objects.all()}
    existantes = {(s.numero, s.debut): s for s in Session.objects.select_related("formation")}
    stagiaires = {s.cle: s for s in Stagiaire.objects.all()}
    formations_neuves, stagiaires_neufs, libelles_signales = set(), set(), set()
    compte = {"sessions_a_creer": 0, "sessions_a_mettre_a_jour": 0, "sessions_inchangees": 0,
              "formations_a_creer": 0, "stagiaires_a_creer": 0, "inscriptions_a_creer": 0}
    detail, rattaches, non_rattaches = [], set(), set()

    for g in sessions:
        # Formation
        formation = None
        if g["reference"]:
            formation = formations.get(g["reference"])
            if formation is None:
                # Une formation neuve est comptee une fois, en essai comme a
                # l'application, quel que soit le nombre de sessions qui la partagent.
                if g["reference"] not in formations_neuves:
                    formations_neuves.add(g["reference"])
                    compte["formations_a_creer"] += 1
                if ecrire:
                    formation = Formation.objects.create(code=g["reference"], libelle=g["designation"],
                                                         marque=g["marque"])
                    formations[g["reference"]] = formation
            else:
                if formation.libelle and g["designation"] and \
                        normaliser(formation.libelle) != normaliser(g["designation"]) \
                        and formation.code not in libelles_signales:
                    libelles_signales.add(formation.code)
                    anomalies.append({"type": "libelle_different", "session": g["etiquette"],
                                      "message": f"formation {formation.code} : libelle du fichier « {g['designation']} » "
                                                 f"different de celui du referentiel « {formation.libelle} » (non modifie)"})
                if ecrire and ((not formation.libelle and g["designation"]) or (not formation.marque and g["marque"])):
                    formation.libelle = formation.libelle or g["designation"]
                    formation.marque = formation.marque or g["marque"]
                    formation.save()

        # Session
        session = existantes.get((g["numero"], g["debut"]))
        voulu = {"fin": g["fin"], "lieu": g["lieu"], "pays": g["pays"], "libelle_fichier": g["designation"]}
        if session is None:
            etat = "a_creer"
            if ecrire:
                session = Session.objects.create(formation=formation, numero=g["numero"], debut=g["debut"], **voulu)
        else:
            # Un champ vide dans le fichier n'efface pas ce que le referentiel garde.
            # Une formation neuve (essai : pas encore creee) differe forcement de l'actuelle.
            diff = any(v and getattr(session, k) != v for k, v in voulu.items()) \
                or (formation is not None and session.formation_id != formation.pk) \
                or (formation is None and bool(g["reference"]))
            if diff and session.source == Session.PLANNING:
                # Le planning fait foi : le fichier n'y ajoute que des stagiaires.
                diff = False
                anomalies.append({"type": "session_du_planning", "session": g["etiquette"],
                                  "message": f"session {g['numero']} tenue par le planning : formation, dates, "
                                             "lieu et animateurs non modifies"})
            etat = "a_mettre_a_jour" if diff else "inchangee"
            if diff and ecrire:
                for k, v in voulu.items():
                    if v:
                        setattr(session, k, v)
                if formation is not None:
                    session.formation = formation
                session.save()

        # Inscriptions
        deja = {}
        if session is not None and session.pk:
            deja = {i.stagiaire.cle: i for i in Inscription.objects.filter(session=session).select_related("stagiaire")}
        nouvelles = 0
        for cle, s in g["stagiaires"].items():
            stagiaire = stagiaires.get(cle)
            if stagiaire is None:
                if cle not in stagiaires_neufs:
                    stagiaires_neufs.add(cle)
                    compte["stagiaires_a_creer"] += 1
                if ecrire:
                    stagiaire = Stagiaire.objects.create(cle=cle, nom=s["nom"], prenom=s["prenom"], pays=s["pays"])
                    stagiaires[cle] = stagiaire
            if cle not in deja:
                nouvelles += 1
                compte["inscriptions_a_creer"] += 1
                if ecrire:
                    # La colonne Presence ne joue qu'a la creation : l'administrateur peut ensuite la corriger.
                    Inscription.objects.create(session=session, stagiaire=stagiaire, absent=s["absent"])
        for cle, insc in deja.items():
            if cle not in g["stagiaires"]:
                anomalies.append({"type": "stagiaire_absent_du_fichier", "session": g["etiquette"],
                                  "message": f"{insc.stagiaire.nom} {insc.stagiaire.prenom} ({insc.stagiaire.pays or 'pays vide'}) "
                                             "inscrit en base mais absent du fichier : conserve"})

        # Animations
        animations = {normaliser(a.nom_fichier): a for a in Animation.objects.filter(session=session)} \
            if session is not None and session.pk else {}
        animations_neuves = 0
        du_planning = session is not None and session.source == Session.PLANNING
        for nom in ([] if du_planning else g["animateurs"]):
            fid = _formateur_id(nom, profils)
            (rattaches if fid else non_rattaches).add(nom)
            existante = animations.get(normaliser(nom))
            if existante is None:
                animations_neuves += 1
                if ecrire:
                    Animation.objects.create(session=session, nom_fichier=nom, formateur_id=fid)
            elif fid and not existante.formateur_id:
                animations_neuves += 1
                if ecrire:
                    existante.formateur_id = fid
                    existante.save()

        if etat == "inchangee" and (nouvelles or animations_neuves):
            etat = "a_mettre_a_jour"
        compte[{"a_creer": "sessions_a_creer", "a_mettre_a_jour": "sessions_a_mettre_a_jour",
                "inchangee": "sessions_inchangees"}[etat]] += 1
        detail.append({"numero": g["numero"], "debut": g["debut"].isoformat(), "fin": g["fin"].isoformat(),
                       "reference": g["reference"], "etat": etat, "stagiaires": len(g["stagiaires"]),
                       "jours": (g["fin"] - g["debut"]).days + 1})

    return {
        "fichier": nom_fichier,
        "lignes_lues": len(lignes),
        **compte,
        "animateurs_rattaches": sorted(rattaches),
        "animateurs_non_rattaches": sorted(non_rattaches - rattaches),
        "sessions": detail,
        "anomalies": anomalies,
    }


def analyser(lignes, nom_fichier=""):
    """L'essai : le rapport de ce que l'application ferait. N'ecrit rien."""
    return {**_executer(lignes, False, nom_fichier), "etat": ImportReferentiel.ESSAI}


def appliquer(lignes, auteur="", nom_fichier=""):
    """L'application, en une transaction ; la trace est gardee dans `ImportReferentiel`."""
    with transaction.atomic():
        rapport = {**_executer(lignes, True, nom_fichier), "etat": ImportReferentiel.APPLIQUE}
        ImportReferentiel.objects.create(auteur=str(auteur or ""), nom_fichier=nom_fichier[:255],
                                         etat=ImportReferentiel.APPLIQUE, rapport=rapport)
    return rapport
