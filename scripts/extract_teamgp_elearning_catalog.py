# -*- coding: utf-8 -*-
"""Extract TEAM-GP e-learning catalog by level + match Excel ↔ MEDACAP (KI Cameroun)."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "docs" / "Suivi_Techniciens_02-09-2026_harmonise.xlsx"
OUT_DIR = ROOT / "frontend" / "src" / "data" / "toyota"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def norm(s) -> str:
    if s is None:
        return ""
    t = str(s).strip().lower()
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def parse_xy(val):
    """Parse '117 / 117' or '—' → (done, assigned) or None."""
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in {"—", "-", "–", "n/a", "N/A"}:
        return None
    m = re.match(r"^\s*(\d+)\s*/\s*(\d+)\s*$", s)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def find_sheet(wb, *needles):
    for name in wb.sheetnames:
        n = norm(name)
        if all(norm(x) in n for x in needles):
            return name
    for name in wb.sheetnames:
        n = norm(name)
        if any(norm(x) in n for x in needles):
            return name
    return None


wb = load_workbook(XLSX, data_only=True)

# ── Synthèse ──────────────────────────────────────────
syn_name = find_sheet(wb, "synthese") or find_sheet(wb, "synth")
ws = wb[syn_name]
rows = list(ws.iter_rows(values_only=True))

hdr_i = 0
for i, row in enumerate(rows[:25]):
    joined = " ".join(norm(c) for c in row if c)
    if "noms" in joined and "grade" in joined:
        hdr_i = i
        break

headers = [str(c).strip() if c else f"COL{j}" for j, c in enumerate(rows[hdr_i])]
hn = [norm(h) for h in headers]


def col(*needles):
    for i, h in enumerate(hn):
        if all(n in h for n in needles):
            return i
    for i, h in enumerate(hn):
        if any(n in h for n in needles):
            return i
    return None


i_name = col("noms")
i_id = col("team", "gp") or col("id team")
i_atelier = col("atelier")
i_grade = col("grade actuel")
i_vise = col("grade vise") or col("grade cible")
i_niveau = col("niveau", "parcours") or col("niveau")
i_online = col("formation en ligne") or col("en ligne")
i_prat = col("evaluations pratiques") or col("pratiques")
i_term = col("modules", "termines")
i_ass = col("modules", "assignes")
i_statut = col("statut")

techs_excel = []
assigned_by_level = defaultdict(list)  # level -> list of assigned online counts
done_by_level = defaultdict(list)

for row in rows[hdr_i + 1 :]:
    if not row or i_name is None or not row[i_name]:
        continue
    name = str(row[i_name]).strip()
    if norm(name) in {"total", "moyenne", "rang"}:
        continue
    niveau = str(row[i_niveau]).strip().upper() if i_niveau is not None and row[i_niveau] else None
    if niveau and not re.match(r"^G[1-4]$", niveau):
        # keep as-is if looks like Gx
        m = re.search(r"G[1-4]", niveau)
        niveau = m.group(0) if m else niveau

    xy = parse_xy(row[i_online]) if i_online is not None else None
    prat = parse_xy(row[i_prat]) if i_prat is not None else None
    term = row[i_term] if i_term is not None else None
    ass = row[i_ass] if i_ass is not None else None

    rec = {
        "name": name,
        "nameNorm": norm(name),
        "teamGpId": str(row[i_id]).strip() if i_id is not None and row[i_id] else None,
        "atelier": str(row[i_atelier]).strip() if i_atelier is not None and row[i_atelier] else None,
        "gradeActuel": str(row[i_grade]).strip() if i_grade is not None and row[i_grade] else None,
        "gradeVise": str(row[i_vise]).strip() if i_vise is not None and row[i_vise] else None,
        "niveauAnalyse": niveau,
        "modulesTermines": int(term) if isinstance(term, (int, float)) else None,
        "modulesAssignes": int(ass) if isinstance(ass, (int, float)) else None,
        "onlineDone": xy[0] if xy else None,
        "onlineAssigned": xy[1] if xy else None,
        "practicalDone": prat[0] if prat else None,
        "practicalAssigned": prat[1] if prat else None,
        "statut": str(row[i_statut]).strip() if i_statut is not None and row[i_statut] else None,
    }
    techs_excel.append(rec)
    if niveau in {"G1", "G2", "G3", "G4"} and xy:
        assigned_by_level[niveau].append(xy[1])
        done_by_level[niveau].append(xy[0])


def mode_or_max(values):
    if not values:
        return None
    c = Counter(values)
    # prefer most common assigned count (catalog size for that level)
    return c.most_common(1)[0][0]


catalog = {}
for level in ["G4", "G3", "G2", "G1"]:
    vals = assigned_by_level.get(level, [])
    catalog[level] = {
        "level": level,
        "onlineAssignedTypical": mode_or_max(vals),
        "onlineAssignedMax": max(vals) if vals else None,
        "onlineAssignedMin": min(vals) if vals else None,
        "sampleSize": len(vals),
        # e-learning obligatoire = taille typique du parcours en ligne pour ce niveau
        "elearningRequired": mode_or_max(vals),
    }

# Enrich from fiches: e-learning / e-test (done + assigned) + last activity, keyed by TEAM-GP id
from datetime import datetime, date

def to_iso_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date().isoformat()
    if isinstance(val, date):
        return val.isoformat()
    s = str(val).strip()
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", s)
    if m:
        return m.group(1)
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


def parse_done_assigned(row):
    """Fiche row: label | done | assigned | … → (done, assigned) or (None, None)."""
    if not row or len(row) < 3:
        return None, None
    try:
        done = int(row[1]) if row[1] is not None else None
        assigned = int(row[2]) if row[2] is not None else None
    except (TypeError, ValueError):
        return None, None
    return done, assigned


fiche_level_el = defaultdict(list)
fiche_level_etest = defaultdict(list)
fiche_by_team_id = {}

for name in wb.sheetnames:
    if not name.startswith("Fiche"):
        continue
    fws = wb[name]
    frows = list(fws.iter_rows(values_only=True))
    niveau = None
    team_id = None
    last_act = None
    el_done = el_ass = et_done = et_ass = None
    prat_done = prat_ass = others_done = others_ass = None

    for row in frows:
        if not row or row[0] is None:
            continue
        a0 = norm(row[0])

        if a0 in {"id team gp", "id team-gp"} and len(row) > 1 and row[1]:
            team_id = str(row[1]).strip()

        if "derniere activite" in a0 and "team" in a0:
            last_act = to_iso_date(row[1] if len(row) > 1 else None)

        if "niveau de formation analyse" in a0 or a0 == "niveau de formation analyse":
            vals = [c for c in row if c is not None]
            if len(vals) > 1:
                m = re.search(r"G[1-4]", str(vals[1]).upper())
                if m:
                    niveau = m.group(0)

        if len(row) >= 8:
            for j, c in enumerate(row):
                if c and norm(c) in {
                    "niveau de formation analyse",
                    "niveau du parcours de formation analyse",
                }:
                    nxt = row[j + 1] if j + 1 < len(row) else None
                    if nxt:
                        m = re.search(r"G[1-4]", str(nxt).upper())
                        if m:
                            niveau = m.group(0)

        if a0 in {"e-learning", "e learning"}:
            el_done, el_ass = parse_done_assigned(row)
            if el_ass is not None and niveau:
                fiche_level_el.setdefault(niveau + "_el_only", []).append(el_ass)

        if a0 in {"e-test", "e test"}:
            et_done, et_ass = parse_done_assigned(row)
            if et_ass is not None and niveau:
                fiche_level_etest[niveau].append(et_ass)

        if a0.startswith("modules de formation en ligne"):
            _online_done, online_ass = parse_done_assigned(row)
            if online_ass is not None and niveau:
                fiche_level_el[niveau].append(online_ass)

        if "evaluations pratiques" in a0 or a0.startswith("evaluations pratiques"):
            prat_done, prat_ass = parse_done_assigned(row)

        if "complementaire" in a0 or "others" in a0:
            others_done, others_ass = parse_done_assigned(row)

    if team_id:
        fiche_by_team_id[team_id] = {
            "elearningDone": el_done,
            "elearningAssigned": el_ass,
            "etestDone": et_done,
            "etestAssigned": et_ass,
            "practicalDone": prat_done,
            "practicalAssigned": prat_ass,
            "othersDone": others_done,
            "othersAssigned": others_ass,
            "lastActivityAt": last_act,
            "niveauAnalyse": niveau,
        }

for level in ["G4", "G3", "G2", "G1"]:
    el_only = fiche_level_el.get(level + "_el_only") or []
    et_only = fiche_level_etest.get(level) or []
    if el_only:
        catalog[level]["elearningModulesTypical"] = mode_or_max(el_only)
    if et_only:
        catalog[level]["etestModulesTypical"] = mode_or_max(et_only)
    # Prefer explicit e-learning + e-test sum for required "ligne"
    if catalog[level].get("elearningModulesTypical") and catalog[level].get("etestModulesTypical"):
        catalog[level]["elearningRequired"] = (
            catalog[level]["elearningModulesTypical"] + catalog[level]["etestModulesTypical"]
        )
    elif catalog[level].get("elearningRequired") is None:
        catalog[level]["elearningRequired"] = catalog[level].get("onlineAssignedTypical")

# Fill missing levels by propagating from nearest higher level if needed (document, don't invent silently)
for level in ["G4", "G3", "G2", "G1"]:
    if catalog[level].get("elearningRequired") is None:
        catalog[level]["elearningRequired"] = None
        catalog[level]["note"] = "Aucune observation Excel pour ce niveau — à compléter métier"

catalog_payload = {
    "meta": {
        "source": XLSX.name,
        "extractedAt": "2026-09-04",
        "definition": (
            "elearningRequired = modules e-learning (+ e-test si connu) typiques "
            "du parcours TEAM-GP pour le niveau analysé. Sans nominatif."
        ),
    },
    "byLevel": catalog,
}

(OUT_DIR / "teamgp-elearning-by-level.json").write_text(
    json.dumps(catalog_payload, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

# Progress by tech — Synthèse + détail fiche (e-learning / e-test)
progress_by_teamgp = {}
for t in techs_excel:
    if not t["teamGpId"]:
        continue
    tid = t["teamGpId"]
    fiche = fiche_by_team_id.get(tid) or {}
    last_act = fiche.get("lastActivityAt")
    t["lastActivityAt"] = last_act
    t["elearningDone"] = fiche.get("elearningDone")
    t["elearningAssigned"] = fiche.get("elearningAssigned")
    t["etestDone"] = fiche.get("etestDone")
    t["etestAssigned"] = fiche.get("etestAssigned")
    # Synthèse pratiques en priorité ; fallback fiche
    prat_done = t.get("practicalDone")
    prat_ass = t.get("practicalAssigned")
    if prat_done is None:
        prat_done = fiche.get("practicalDone")
    if prat_ass is None:
        prat_ass = fiche.get("practicalAssigned")
    t["practicalDone"] = prat_done
    t["practicalAssigned"] = prat_ass
    t["othersDone"] = fiche.get("othersDone")
    t["othersAssigned"] = fiche.get("othersAssigned")
    progress_by_teamgp[tid] = {
        "teamGpId": tid,
        "niveauAnalyse": t["niveauAnalyse"],
        "gradeVise": t["gradeVise"],
        "onlineDone": t["onlineDone"],
        "onlineAssigned": t["onlineAssigned"],
        "elearningDone": fiche.get("elearningDone"),
        "elearningAssigned": fiche.get("elearningAssigned"),
        "etestDone": fiche.get("etestDone"),
        "etestAssigned": fiche.get("etestAssigned"),
        "practicalDone": prat_done,
        "practicalAssigned": prat_ass,
        "othersDone": fiche.get("othersDone"),
        "othersAssigned": fiche.get("othersAssigned"),
        "modulesTermines": t["modulesTermines"],
        "modulesAssignes": t["modulesAssignes"],
        "lastActivityAt": last_act,
    }

(OUT_DIR / "teamgp-progress-by-id.json").write_text(
    json.dumps(
        {
            "meta": {
                "source": XLSX.name,
                "note": (
                    "Index TEAM-GP. "
                    "path = e-learning + e-test + pratiques + others (modulesTermines/Assignes). "
                    "online* = col. Synthèse « formation en ligne » ; "
                    "elearning*/etest* = fiches ; practical* = Synthèse/fiche ; others* = fiche."
                ),
            },
            "byTeamGpId": progress_by_teamgp,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)

# Excel techs for match script
(OUT_DIR / "_excel_techs_norm.json").write_text(
    json.dumps(techs_excel, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

with_el = sum(1 for p in progress_by_teamgp.values() if p.get("elearningAssigned") is not None)
with_et = sum(1 for p in progress_by_teamgp.values() if p.get("etestAssigned") is not None)
print("catalog:")
print(json.dumps(catalog, ensure_ascii=False, indent=2))
print(f"excel techs: {len(techs_excel)}")
print(f"fiches with e-learning: {with_el}, e-test: {with_et}")
print(f"wrote {OUT_DIR}")
wb.close()
