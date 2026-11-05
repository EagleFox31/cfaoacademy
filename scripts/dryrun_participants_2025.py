#!/usr/bin/env python3
"""Dry-run import — Liste stagiaires 2025 → JSON MLD (sans écriture DB).

Aligné : docs/MERISE_MCD_PARTICIPANTS_2025.md (v3.4)
         docs/PATRON_IMPORT_TABULAIRE.md (parse ≠ apply)

Sorties (dossier --out) :
  report.json                 — rejets R1/R2/…, warnings, file de revue
  entities.json               — MLD normalisé (plateforme : identity / lms / operations)
  cfao_needs_referential.json — marques, pôles, filiales, codes catalogue pour cfao-needs
  README.md                   — cibles de consommation

Usage :
  py -3 scripts/dryrun_participants_2025.py
  py -3 scripts/dryrun_participants_2025.py --xlsx "docs/Liste des participants aux formations 2025.xlsx"
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
except ImportError as e:
    raise SystemExit("openpyxl requis : pip install openpyxl") from e

# ── Colonnes (1-based) ──────────────────────────────────────────────────────
COL = {
    "typ_client": 1,
    "pole": 2,
    "type_pedago": 3,
    "numero": 4,
    "ref": 5,
    "marque": 6,
    "designation": 7,
    "compte_rendu": 8,
    "animateur": 9,
    "date_debut": 10,
    "date_fin": 11,
    "lieu": 12,
    "nb_heures": 13,
    "civilite": 14,
    "nom": 15,
    "prenom": 16,
    "pays": 17,
    "presence": 18,
    "client": 19,
    "modalite": 20,
    "arrivee": 21,
    "heure_arrivee": 22,
    "vol_arrivee": 23,
    "depart": 24,
    "heure_depart": 25,
    "vol_depart": 26,
    "nuitees": 27,
    "lettre_inv": 28,
    "dejeuner": 29,
    "hotel_ht": 30,
    "hotel_ttc": 31,
    "navettes_ht": 32,
    "navettes_ttc": 33,
    "visa": 34,
    "pressing": 35,
    "parking": 36,
    "autres": 37,
    "totaux": 38,
    "appr_formation": 39,
    "appr_formateur": 40,
}

# Bandes commentaires → cible (lettre Excel → colonne 1-based approx via openpyxl)
FRAIS_POSTES_HT = {"hotel": ("hotel_ht", "hotel_ttc"), "navettes": ("navettes_ht", "navettes_ttc")}
FRAIS_POSTES_SOURCE = {
    "lettre_invitation": ("lettre_inv", "hors_taxe"),
    "dejeuner": ("dejeuner", "ttc"),
    "pressing": ("pressing", "hors_taxe"),
    "parking": ("parking", "hors_taxe"),
    "autres": ("autres", "hors_taxe"),
}


def norm(s) -> str:
    s = str(s or "").strip().upper()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return " ".join(s.split())


def slug_part(s: str) -> str:
    return norm(s).lower().replace(" ", "-")


def make_username(prenom: str, nom: str) -> str:
    sp, sn = slug_part(prenom), slug_part(nom)
    if sp and sn:
        return f"{sp}-{sn}"
    return sn or sp or "inconnu"


def cell(ws, r, key):
    return ws.cell(r, COL[key]).value


def is_blank(v) -> bool:
    if v is None:
        return True
    if isinstance(v, str) and not v.strip():
        return True
    return False


def parse_hours(v, row: int, errors: list, warnings: list):
    if is_blank(v):
        return None
    if isinstance(v, (datetime, date)):
        errors.append(
            {
                "code": "R6",
                "row": row,
                "column": "nb_heures",
                "value": str(v),
                "message": "nb_heures lu comme date/datetime — rejeter ou convertir explicitement",
            }
        )
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return int(v)
    s = str(v).strip().lower().replace("h", "").replace(",", ".")
    try:
        return int(float(s))
    except ValueError:
        errors.append(
            {
                "code": "R6",
                "row": row,
                "column": "nb_heures",
                "value": v,
                "message": f"nb_heures illisible : {v!r}",
            }
        )
        return None


def parse_date(v, row: int, column: str, warnings: list):
    if is_blank(v):
        return None, False
    if isinstance(v, datetime):
        return v.date().isoformat(), True
    if isinstance(v, date):
        return v.isoformat(), True
    s = str(v).strip()
    # formats usuels
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat(), True
        except ValueError:
            pass
    # texte FR libre → R11 warning (pas rejet dur pour dry-run, mais signalé)
    warnings.append(
        {
            "code": "R11",
            "row": row,
            "column": column,
            "value": s,
            "message": "date texte non parsée — nb_nuitees non recalculable",
        }
    )
    return s, False  # keep raw, flag unparsed


def money(v):
    if is_blank(v):
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if float(v) == 0:
            return None
        return float(v)
    try:
        x = float(str(v).replace(" ", "").replace(",", "."))
        return None if x == 0 else x
    except ValueError:
        return None


def derive_typ_client(raw, client_label: str) -> tuple[str | None, str | None]:
    t = (str(raw).strip().lower() if raw else "") or ""
    if t in ("interne", "externe"):
        return t, None
    cl = (client_label or "").upper()
    if "CFAO" in cl:
        return "interne", "derived_from_client_label"
    if cl.strip():
        return "externe", "derived_from_client_label"
    return None, None


def presence_norm(v) -> str | None:
    if is_blank(v):
        return None  # pas de DEFAULT present
    s = str(v).strip().lower()
    if s.startswith("présent") or s.startswith("present"):
        return "present"
    if s.startswith("absent"):
        return "absent"
    return "non_renseigne"


def cr_bool(v) -> bool | None:
    if is_blank(v):
        return None
    s = str(v).strip().lower()
    if s in ("oui", "yes", "1", "true"):
        return True
    if s in ("non", "no", "0", "false"):
        return False
    return None


def pole_code(v) -> str:
    s = norm(v)
    if "EQUIP" in s:
        return "EQUIPMENT"
    if "MOTOR" in s or "MOBIL" in s:
        return "MOBILITY"
    return s or "AUTRE"


def brand_code(v) -> str:
    return slug_part(v).replace("-", "_").upper() or ""


def client_nature(label: str, typ: str | None) -> str:
    if typ == "externe":
        return "externe_b2b"
    if "CFAO" in (label or "").upper():
        return "filiale_cfao"
    return "externe_b2b" if typ == "externe" else "filiale_cfao"


def org_code_from_label(label: str) -> str:
    s = slug_part(label)
    return s[:64] if s else "unknown"


def row_has_data(ws, r) -> bool:
    nom = cell(ws, r, "nom")
    num = cell(ws, r, "numero")
    if not is_blank(nom):
        return True
    if not is_blank(num):
        return True
    return False


def extract_comments(ws) -> list[dict]:
    out = []
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=40):
        for c in row:
            if not c.comment:
                continue
            letter = c.column_letter
            col = c.column
            # cible par bande
            if letter in ("D", "G"):
                cible = "session"
            elif 21 <= col <= 27:  # U–AA
                cible = "sejour"
            elif 28 <= col <= 38:  # AB–AL
                cible = "frais"
            else:
                cible = "participation"
            text = (c.comment.text or "").strip()
            data_row = row_has_data(ws, c.row) if c.row >= 2 else False
            if not data_row and c.row >= 2:
                cible = "orphelin"
            out.append(
                {
                    "cellule_source": c.coordinate,
                    "row": c.row,
                    "column_letter": letter,
                    "cible": cible,
                    "auteur": text.split("\n", 1)[0].rstrip(":") if text else "",
                    "texte": text,
                    "revue_manuelle": cible == "orphelin",
                    "data_row": data_row,
                }
            )
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[1]
    ap.add_argument(
        "--xlsx",
        type=Path,
        default=root / "docs" / "Liste des participants aux formations 2025.xlsx",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=root / "docs" / "dryrun_participants_2025",
    )
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    ws = wb["Liste stagiaires 2025"]
    wb_c = openpyxl.load_workbook(args.xlsx, data_only=False)
    ws_c = wb_c["Liste stagiaires 2025"]

    errors: list[dict] = []
    warnings: list[dict] = []
    review: dict[str, list] = {
        "slug_collisions": [],
        "multi_client": [],
        "sans_prenom": [],
        "etat_commentaires": [],
        "orphelins": [],
    }

    # ── Pass 1 : lignes brutes ──────────────────────────────────────────────
    raw_rows = []
    for r in range(2, ws.max_row + 1):
        if not row_has_data(ws, r):
            continue
        nom = cell(ws, r, "nom")
        prenom = cell(ws, r, "prenom")
        client = cell(ws, r, "client")
        numero = cell(ws, r, "numero")
        raw_rows.append(
            {
                "row": r,
                "nom": str(nom).strip() if nom else "",
                "prenom": str(prenom).strip() if prenom else "",
                "nom_n": norm(nom),
                "prenom_n": norm(prenom),
                "client": str(client).strip() if client else "",
                "client_n": norm(client),
                "numero": str(numero).strip() if not is_blank(numero) else "",
                "typ_client_raw": cell(ws, r, "typ_client"),
                "pole": cell(ws, r, "pole"),
                "type_pedago": cell(ws, r, "type_pedago"),
                "ref": cell(ws, r, "ref"),
                "marque": cell(ws, r, "marque"),
                "designation": cell(ws, r, "designation"),
                "compte_rendu": cell(ws, r, "compte_rendu"),
                "animateur": cell(ws, r, "animateur"),
                "date_debut": cell(ws, r, "date_debut"),
                "date_fin": cell(ws, r, "date_fin"),
                "lieu": cell(ws, r, "lieu"),
                "nb_heures": cell(ws, r, "nb_heures"),
                "civilite": cell(ws, r, "civilite"),
                "pays": cell(ws, r, "pays"),
                "presence": cell(ws, r, "presence"),
                "modalite": cell(ws, r, "modalite"),
                "arrivee": cell(ws, r, "arrivee"),
                "heure_arrivee": cell(ws, r, "heure_arrivee"),
                "vol_arrivee": cell(ws, r, "vol_arrivee"),
                "depart": cell(ws, r, "depart"),
                "heure_depart": cell(ws, r, "heure_depart"),
                "vol_depart": cell(ws, r, "vol_depart"),
                "nuitees": cell(ws, r, "nuitees"),
                "frais_cells": {k: cell(ws, r, k) for k in (
                    "lettre_inv", "dejeuner", "hotel_ht", "hotel_ttc",
                    "navettes_ht", "navettes_ttc", "visa", "pressing",
                    "parking", "autres", "totaux",
                )},
                "appr_formation": cell(ws, r, "appr_formation"),
                "appr_formateur": cell(ws, r, "appr_formateur"),
            }
        )

    # R1
    for row in raw_rows:
        if not row["numero"]:
            errors.append(
                {
                    "code": "R1",
                    "row": row["row"],
                    "column": "numero",
                    "value": None,
                    "message": "Pas de N° formation — participation rejetée",
                }
            )

    valid = [row for row in raw_rows if row["numero"]]

    # ── Apprenants : cluster (nom, prenom) sur TOUTES les lignes data ────────
    # R1 rejette la participation, pas la personne (MCD).
    by_person: dict[tuple[str, str], dict] = {}
    person_clients: dict[tuple[str, str], set] = defaultdict(set)
    for row in raw_rows:
        if not row["nom_n"] and not row["prenom_n"]:
            continue
        key = (row["nom_n"], row["prenom_n"])
        if key not in by_person:
            by_person[key] = {
                "nom": row["nom"],
                "prenom": row["prenom"],
                "civilite": row["civilite"],
                "pays": row["pays"],
                "rows": [],
            }
        by_person[key]["rows"].append(row["row"])
        if row["client_n"]:
            person_clients[key].add(row["client"])

    # multi-client + sans prénom
    for key, clients in person_clients.items():
        if len(clients) > 1:
            review["multi_client"].append(
                {
                    "nom_n": key[0],
                    "prenom_n": key[1],
                    "clients": sorted(clients),
                }
            )
    for key in by_person:
        if not key[1]:
            review["sans_prenom"].append({"nom_n": key[0], "rows": by_person[key]["rows"]})

    # slugs
    slug_to_keys: dict[str, list[tuple[str, str]]] = defaultdict(list)
    person_slug: dict[tuple[str, str], str] = {}
    for key in by_person:
        p = by_person[key]
        u = make_username(p["prenom"], p["nom"])
        person_slug[key] = u
        slug_to_keys[u].append(key)

    for slug, keys in slug_to_keys.items():
        if len(keys) > 1:
            review["slug_collisions"].append(
                {
                    "slug": slug,
                    "tuples": [
                        {
                            "nom": by_person[k]["nom"],
                            "prenom": by_person[k]["prenom"],
                            "nom_n": k[0],
                            "prenom_n": k[1],
                        }
                        for k in keys
                    ],
                    "action": "revue — ne pas appliquer -2 automatiquement",
                }
            )

    # assign provisional ids (stable within dry-run)
    apprenant_id: dict[tuple[str, str], str] = {}
    apprenants = []
    for i, key in enumerate(sorted(by_person.keys()), start=1):
        aid = f"apr-{i:04d}"
        apprenant_id[key] = aid
        p = by_person[key]
        typ_samples = []
        for row in raw_rows:
            if (row["nom_n"], row["prenom_n"]) == key:
                t, _ = derive_typ_client(row["typ_client_raw"], row["client"])
                if t:
                    typ_samples.append(t)
        apprenants.append(
            {
                "id": aid,
                "nom": p["nom"],
                "prenom": p["prenom"],
                "civilite": p["civilite"],
                "pays": str(p["pays"] or "").strip(),
                "username": person_slug[key],  # collision → même slug, revue
                "email": None,
                "matricule": None,
                "id_client_matricule": None,
                "telephone": None,
                "slug_collision": person_slug[key] in {c["slug"] for c in review["slug_collisions"]},
                "targets": ["cfao-core.identity", "cfao-needs.referential(org)/integrated"],
            }
        )

    # ── Clients ─────────────────────────────────────────────────────────────
    clients_map: dict[str, dict] = {}
    for row in raw_rows:
        if not row["client_n"]:
            continue
        if row["client_n"] not in clients_map:
            typ, _ = derive_typ_client(row["typ_client_raw"], row["client"])
            clients_map[row["client_n"]] = {
                "id": f"cli-{len(clients_map)+1:04d}",
                "libelle": row["client"],
                "nature": client_nature(row["client"], typ),
                "code": org_code_from_label(row["client"]),
            }
    clients = list(clients_map.values())

    # ── Formations / marques / pôles / sessions ─────────────────────────────
    marques: dict[str, dict] = {}
    formations: dict[tuple[str, str, str], dict] = {}
    sessions: dict[str, dict] = {}
    animateurs: dict[str, dict] = {}

    for row in valid:
        pc = pole_code(row["pole"])
        bc = brand_code(row["marque"]) if row["marque"] else ""
        if bc and bc not in marques:
            marques[bc] = {
                "code": bc,
                "label": str(row["marque"]).strip(),
                "pole": pc,
                "targets": ["cfao-core.identity.Brand", "cfao-needs.referential.Brand"],
            }
        ref = str(row["ref"]).strip() if not is_blank(row["ref"]) else ""
        fk = (pc, bc, ref or f"NOREF:{norm(row['designation'])[:40]}")
        if fk not in formations:
            formations[fk] = {
                "id": f"form-{len(formations)+1:04d}",
                "code": ref or None,
                "designation": str(row["designation"] or "").strip(),
                "type_pedago": str(row["type_pedago"] or "").strip(),
                "pole": pc,
                "marque": bc or None,
                "targets": ["cfao-core.lms.Course", "cfao-needs.catalog(code align)"],
            }
        anim = str(row["animateur"] or "").strip()
        if anim and anim not in animateurs:
            animateurs[anim] = {
                "id": f"anim-{len(animateurs)+1:03d}",
                "nom_affiche": anim,
                "targets": ["cfao-core.identity.User(trainer)"],
            }

        num = row["numero"]
        if num not in sessions:
            d0, ok0 = parse_date(row["date_debut"], row["row"], "date_debut", warnings)
            d1, ok1 = parse_date(row["date_fin"], row["row"], "date_fin", warnings)
            sessions[num] = {
                "id": f"ses-{len(sessions)+1:04d}",
                "numero": num,
                "date_debut": d0,
                "date_fin": d1,
                "dates_parsed": ok0 and ok1,
                "lieu": str(row["lieu"] or "").strip(),
                "nb_heures": parse_hours(row["nb_heures"], row["row"], errors, warnings),
                "modalite": str(row["modalite"] or "").strip(),
                "compte_rendu_fait": cr_bool(row["compte_rendu"]),
                "statut": "tenue",  # défaut As-Is — rendement dérivation commentaires = 0
                "statut_source": "defaut",
                "id_formation": formations[fk]["id"],
                "id_animateur": animateurs[anim]["id"] if anim in animateurs else None,
                "pole": pc,
                "targets": ["cfao-operations.sessions"],
            }

    # ── Participations + séjour + frais ─────────────────────────────────────
    # R2 doublons
    seen_part: dict[tuple[str, str], int] = {}
    participations = []
    sejours = []
    lignes_frais = []

    for row in valid:
        key = (row["nom_n"], row["prenom_n"])
        if key not in apprenant_id:
            errors.append(
                {
                    "code": "R1b",
                    "row": row["row"],
                    "column": "nom",
                    "value": None,
                    "message": "Ligne session sans nom/prénom — participation rejetée",
                }
            )
            continue
        aid = apprenant_id[key]
        sid = sessions[row["numero"]]["id"]
        pk = (aid, sid)
        if pk in seen_part:
            errors.append(
                {
                    "code": "R2",
                    "row": row["row"],
                    "column": "participation",
                    "value": f"{aid}/{row['numero']}",
                    "message": f"Doublon participation — première ligne {seen_part[pk]}",
                }
            )
            continue
        seen_part[pk] = row["row"]

        typ, der = derive_typ_client(row["typ_client_raw"], row["client"])
        cid = clients_map[row["client_n"]]["id"] if row["client_n"] in clients_map else None

        participations.append(
            {
                "id_apprenant": aid,
                "id_session": sid,
                "id_client": cid,
                "presence": presence_norm(row["presence"]),
                "appreciation_formation": row["appr_formation"],
                "appreciation_formateur": row["appr_formateur"],
                "type_client": typ,
                "type_client_source": der or "source",
                "source_row": row["row"],
                "targets": ["cfao-operations.sessions.participation"],
            }
        )

        # séjour si au moins une info voyage
        arr, ok_a = parse_date(row["arrivee"], row["row"], "arrivee", warnings)
        dep, ok_d = parse_date(row["depart"], row["row"], "depart", warnings)
        if any(
            not is_blank(row[k])
            for k in ("arrivee", "heure_arrivee", "vol_arrivee", "depart", "heure_depart", "vol_depart")
        ):
            sejours.append(
                {
                    "id_apprenant": aid,
                    "id_session": sid,
                    "date_arrivee": arr,
                    "heure_arrivee": row["heure_arrivee"],
                    "vol_arrivee": row["vol_arrivee"],
                    "date_depart": dep,
                    "heure_depart": row["heure_depart"],
                    "vol_depart": row["vol_depart"],
                    "nb_nuitees": None if not (ok_a and ok_d) else row["nuitees"],
                    "lieu_accueil": "Douala",
                    "targets": ["cfao-operations.sessions.sejour"],
                }
            )

        fc = row["frais_cells"]
        # HT postes
        for poste, (ht_k, ttc_k) in FRAIS_POSTES_HT.items():
            ht = money(fc[ht_k])
            if ht is not None:
                lignes_frais.append(
                    {
                        "id_apprenant": aid,
                        "id_session": sid,
                        "poste": poste,
                        "montant": ht,
                        "base": "ht",
                        "taux_tva": 0.1925,
                        "origine": "calcule",
                        "source_row": row["row"],
                    }
                )
        for poste, (col_k, base) in FRAIS_POSTES_SOURCE.items():
            m = money(fc[col_k])
            if m is not None:
                lignes_frais.append(
                    {
                        "id_apprenant": aid,
                        "id_session": sid,
                        "poste": poste,
                        "montant": m,
                        "base": base,
                        "taux_tva": None,
                        "origine": "saisi",
                        "source_row": row["row"],
                    }
                )
        # visa : jamais de ligne si 0 (MCD)
        # totaux forcés : signal si total non nul
        tot = money(fc["totaux"])
        if tot is not None:
            warnings.append(
                {
                    "code": "TOTAL_PRESENT",
                    "row": row["row"],
                    "column": "totaux",
                    "value": tot,
                    "message": "Total source présent — à rapprocher Σ lignes (origine saisi si divergence)",
                }
            )

    # ── Commentaires ────────────────────────────────────────────────────────
    comments = extract_comments(ws_c)
    for c in comments:
        if c["cible"] == "orphelin":
            review["orphelins"].append(c)
        low = c["texte"].lower()
        if any(x in low for x in ("annul", "report")):
            review["etat_commentaires"].append(
                {
                    "cellule": c["cellule_source"],
                    "cible": c["cible"],
                    "extrait": c["texte"][:160],
                    "note": "As-Is : aucun statut session auto (rendement dérivation = 0)",
                }
            )

    # ── Assemblage ──────────────────────────────────────────────────────────
    entities = {
        "meta": {
            "source": str(args.xlsx.name),
            "mcd": "docs/MERISE_MCD_PARTICIPANTS_2025.md",
            "version": "dryrun-v1",
            "write_db": False,
        },
        "apprenants": apprenants,
        "clients": clients,
        "marques": list(marques.values()),
        "poles": sorted({m["pole"] for m in marques.values()} | {s["pole"] for s in sessions.values()}),
        "formations": list(formations.values()),
        "animateurs": list(animateurs.values()),
        "sessions": list(sessions.values()),
        "participations": participations,
        "sejours": sejours,
        "lignes_frais": lignes_frais,
        "commentaires": comments,
    }

    # cfao-needs slice
    needs_ref = {
        "meta": {
            "note": (
                "Référentiel pour cfao-needs (standalone seed / integrated sync). "
                "L'historique PARTICIPATION reste dans cfao-operations ; needs consomme "
                "marques + org (filiales) + codes catalogue pour aligner les campagnes."
            ),
            "mode": "standalone_seed_candidate",
        },
        "brands": [
            {"code": m["code"], "label": m["label"], "pole": m["pole"]}
            for m in marques.values()
        ],
        "org_units": [
            {
                "code": c["code"],
                "label": c["libelle"],
                "nature": c["nature"],
                "is_cfao_branch": c["nature"] == "filiale_cfao",
            }
            for c in clients
            if c["nature"] == "filiale_cfao"
        ],
        "org_partners_b2b": [
            {"code": c["code"], "label": c["libelle"]}
            for c in clients
            if c["nature"] == "externe_b2b"
        ],
        "catalog_codes": sorted(
            {
                f["code"]
                for f in formations.values()
                if f["code"]
            }
        ),
        "participation_counts_by_org": {},  # filled below
    }
    # counts trained per client (for needs prioritization later)
    counts = defaultdict(int)
    id_to_client = {c["id"]: c for c in clients}
    for p in participations:
        if p["id_client"] and p["id_client"] in id_to_client:
            counts[id_to_client[p["id_client"]]["code"]] += 1
    needs_ref["participation_counts_by_org"] = dict(sorted(counts.items(), key=lambda x: -x[1]))

    r1 = sum(1 for e in errors if e["code"] == "R1")
    r2 = sum(1 for e in errors if e["code"] == "R2")
    report = {
        "status": "REJECTED" if (r1 or r2) else "OK_WITH_WARNINGS",
        "exit_nonzero_if": ["R1", "R2"],
        "counts": {
            "rows_data": len(raw_rows),
            "rows_with_session": len(valid),
            "apprenants_tuples": len(apprenants),
            "slugs_distinct": len(slug_to_keys),
            "slug_collisions": len(review["slug_collisions"]),
            "sessions": len(sessions),
            "participations_accepted": len(participations),
            "sejours": len(sejours),
            "lignes_frais": len(lignes_frais),
            "commentaires": len(comments),
            "orphelins": len(review["orphelins"]),
            "multi_client": len(review["multi_client"]),
            "sans_prenom": len(review["sans_prenom"]),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        "errors": errors,
        "warnings": warnings,
        "review_queue": review,
        "targets": {
            "cfao-core.identity": ["apprenants", "clients(filiales)", "marques", "animateurs"],
            "cfao-core.lms": ["formations"],
            "cfao-operations.sessions": [
                "sessions",
                "participations",
                "sejours",
                "lignes_frais",
                "commentaires",
            ],
            "cfao-needs.referential": [
                "brands",
                "org_units (filiales)",
                "catalog_codes",
                "participation_counts_by_org (aide priorisation)",
            ],
        },
    }

    # write
    (args.out / "entities.json").write_text(
        json.dumps(entities, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    (args.out / "cfao_needs_referential.json").write_text(
        json.dumps(needs_ref, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    (args.out / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    readme = f"""# Dry-run participants 2025

Généré par `scripts/dryrun_participants_2025.py` — **aucune écriture DB**.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `entities.json` | MLD plateforme (identity / lms / operations) |
| `cfao_needs_referential.json` | Marques, filiales, codes catalogue + volumes par org pour **cfao-needs** |
| `report.json` | Rejets, warnings, files de revue |

## Qui consomme quoi

- **cfao-core identity** : apprenants (username slug), clients, marques, animateurs  
- **cfao-core lms** : formations (codes)  
- **cfao-operations** : sessions, participations, séjours, frais, commentaires  
- **cfao-needs** : référentiel (`Brand`, `OrgUnitRef`) + codes pour aligner campagnes ; les counts par org aident la priorisation — l’historique détaillé reste operations jusqu’au mode `integrated`

## Statut ce run

- status: **{report['status']}**
- tuples apprenants: {report['counts']['apprenants_tuples']} · slugs distincts: {report['counts']['slugs_distinct']} · collisions: {report['counts']['slug_collisions']}
- R1 (sans N°): {r1} · R2 (doublons): {r2}
- orphelins: {report['counts']['orphelins']} · multi-client: {report['counts']['multi_client']}

Exit code script: **1** si R1 ou R2 > 0, sinon **0**.
"""
    (args.out / "README.md").write_text(readme, encoding="utf-8")

    print(json.dumps(report["counts"], indent=2))
    print(f"status={report['status']} -> {args.out}")
    raise SystemExit(1 if (r1 or r2) else 0)


if __name__ == "__main__":
    main()
