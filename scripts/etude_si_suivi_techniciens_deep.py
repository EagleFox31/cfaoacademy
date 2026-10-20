"""Deep dive As-Is — feuilles clés Suivi Techniciens."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook

SRC = Path(r"C:\Users\jakaa\Downloads\cfaoacademy\docs\Suivi_Techniciens_02-09-2026_harmonise.xlsx")
OUT = Path(r"C:\Users\jakaa\Downloads\cfaoacademy\docs\etude-si-suivi-techniciens-2026-09-02")
RAW = json.loads((OUT / "as_is_raw.json").read_text(encoding="utf-8"))


def norm(s) -> str:
    if s is None:
        return ""
    t = str(s).strip().lower()
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t)


wb = load_workbook(SRC, data_only=True, read_only=False)

# Classify sheets
fiche_sheets = [n for n in wb.sheetnames if n.startswith("Fiche")]
other = [n for n in wb.sheetnames if not n.startswith("Fiche")]

KEY = [
    "Synthèse",
    "Sommaire des fiches",
    "Modules critiques G4",
    "Évolution planning",
    "Validation par type",
    "Avancement par domaine",
    "Activité & scores",
]

# Fix encoding issues - match by norm
by_norm = {norm(n): n for n in wb.sheetnames}


def resolve_key(label: str):
    n = norm(label)
    if n in by_norm:
        return by_norm[n]
    for k, v in by_norm.items():
        if n in k or k in n:
            return v
    return None


def dump_sheet(name: str, max_rows=80):
    ws = wb[name]
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        if i > max_rows:
            break
        rows.append([None if c is None else c for c in row])
    # trim empty trailing cols
    max_c = 0
    for r in rows:
        for j, c in enumerate(r):
            if c is not None and str(c).strip() != "":
                max_c = max(max_c, j + 1)
    rows = [r[:max_c] for r in rows]
    return {
        "name": name,
        "max_row": ws.max_row,
        "max_col": ws.max_column,
        "preview": rows,
    }


previews = {}
for label in KEY:
    real = resolve_key(label)
    if real:
        previews[label] = dump_sheet(real, 70 if "Modules" in label or "Synth" in label else 40)
    else:
        previews[label] = {"missing": True, "wanted": label}

# Sample one fiche
fiche_sample_name = next((n for n in fiche_sheets if "NGUEFACK" in n.upper() or "KITIO" in n.upper() or "EVINA" in n.upper()), fiche_sheets[0] if fiche_sheets else None)
fiche_preview = dump_sheet(fiche_sample_name, 55) if fiche_sample_name else None

# Extract technician names from Sommaire / Synthèse
names_from_fiches = sorted({n.replace("Fiche - ", "").strip() for n in fiche_sheets})

# Modules critiques G4 — try to detect grain
mod = resolve_key("Modules critiques G4")
modules_stats = {}
if mod:
    ws = wb[mod]
    rows = list(ws.iter_rows(values_only=True))
    # find header with module / code / technicien
    hdr_i = 0
    for i, row in enumerate(rows[:15]):
        joined = " ".join(norm(c) for c in row if c)
        if "module" in joined or "g4" in joined or "technicien" in joined or "nom" in joined:
            hdr_i = i
            break
    headers = [str(c).strip() if c else f"COL{j}" for j, c in enumerate(rows[hdr_i])]
    data = []
    for row in rows[hdr_i + 1:]:
        if not any(c is not None and str(c).strip() for c in row):
            continue
        data.append(row)
    modules_stats = {
        "header_row": hdr_i + 1,
        "headers": headers,
        "data_rows": len(data),
        "sample": [
            {headers[j]: row[j] for j in range(min(len(headers), len(row))) if row[j] is not None}
            for row in data[:8]
        ],
    }

# Synthèse — grades
syn = resolve_key("Synthèse") or resolve_key("Synthese")
synthese_stats = {}
if syn:
    ws = wb[syn]
    rows = list(ws.iter_rows(values_only=True))
    hdr_i = 0
    for i, row in enumerate(rows[:20]):
        joined = " ".join(norm(c) for c in row if c)
        if "nom" in joined or "grade" in joined or "atelier" in joined:
            hdr_i = i
            break
    headers = [str(c).strip() if c else f"COL{j}" for j, c in enumerate(rows[hdr_i])]
    data = []
    for row in rows[hdr_i + 1:]:
        if not any(c is not None and str(c).strip() for c in row):
            continue
        # skip totals-like
        data.append(row)
    grades_actuel = Counter()
    grades_cible = Counter()
    # find grade cols
    hnorm = [norm(h) for h in headers]
    ia = next((i for i, h in enumerate(hnorm) if "grade actuel" in h or h == "grade actuel"), None)
    ic = next((i for i, h in enumerate(hnorm) if "grade cible" in h), None)
    iname = next((i for i, h in enumerate(hnorm) if "nom" in h), None)
    for row in data:
        if ia is not None and ia < len(row) and row[ia] is not None:
            grades_actuel[str(row[ia]).strip()] += 1
        if ic is not None and ic < len(row) and row[ic] is not None:
            grades_cible[str(row[ic]).strip()] += 1
    synthese_stats = {
        "header_row": hdr_i + 1,
        "headers": headers,
        "data_rows": len(data),
        "grades_actuel": grades_actuel.most_common(),
        "grades_cible": grades_cible.most_common(),
        "sample": [
            {headers[j]: row[j] for j in range(min(len(headers), len(row))) if row[j] is not None}
            for row in data[:10]
        ],
    }

deep = {
    "fiche_count": len(fiche_sheets),
    "fiche_names": names_from_fiches,
    "other_sheets": other,
    "modules_critiques_g4": modules_stats,
    "synthese": synthese_stats,
    "fiche_sample_name": fiche_sample_name,
    "fiche_sample": fiche_preview,
    "key_previews": {k: {
        "name": v.get("name"),
        "max_row": v.get("max_row"),
        "max_col": v.get("max_col"),
        "preview_first_25": v.get("preview", [])[:25] if "preview" in v else v,
    } for k, v in previews.items()},
}

(OUT / "as_is_deep.json").write_text(
    json.dumps(deep, ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)

print("fiches:", len(fiche_sheets))
print("other sheets:", len(other))
for n in other:
    print(" -", n)
print("\nSynthese grades actuel:", synthese_stats.get("grades_actuel"))
print("Synthese grades cible:", synthese_stats.get("grades_cible"))
print("Modules G4 rows:", modules_stats.get("data_rows"), "headers:", modules_stats.get("headers"))
print("Sample fiche:", fiche_sample_name)
wb.close()
