"""Diagnostic As-Is — Suivi_Techniciens_02-09-2026_harmonise.xlsx (skill etude-si)."""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook

SRC = Path(r"C:\Users\jakaa\Downloads\cfaoacademy\docs\Suivi_Techniciens_02-09-2026_harmonise.xlsx")
OUT = Path(r"C:\Users\jakaa\Downloads\cfaoacademy\docs\etude-si-suivi-techniciens-2026-09-02")
OUT.mkdir(parents=True, exist_ok=True)


def norm(s) -> str:
    if s is None:
        return ""
    t = str(s).strip().lower()
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"\s+", " ", t)
    return t


def is_formula_residue(v) -> bool:
    if v is None:
        return False
    s = str(v).strip().upper()
    return s.startswith("#") or s in {"#VALUE!", "#REF!", "#N/A", "#NAME?", "#DIV/0!", "#NULL!"}


def row_has_business_data(values) -> bool:
    for v in values:
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        if is_formula_residue(v):
            continue
        return True
    return False


def header_row(ws, max_scan=15):
    best = None
    best_score = -1
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=max_scan, values_only=True), start=1):
        vals = [c for c in row if c is not None and str(c).strip()]
        score = len(vals)
        # Prefer rows with several text headers
        textish = sum(1 for c in vals if isinstance(c, str) and len(str(c)) > 1)
        score += textish
        if score > best_score:
            best_score = score
            best = (i, row)
    return best


wb = load_workbook(SRC, data_only=True, read_only=True)

sheet_summary = []
for name in wb.sheetnames:
    ws = wb[name]
    # Approximate dimensions in read_only
    rows = list(ws.iter_rows(values_only=True))
    n_rows = len(rows)
    n_cols = max((len(r) for r in rows), default=0) if rows else 0
    hdr = header_row(ws) if False else None  # need re-open without consuming

    sheet_summary.append({
        "name": name,
        "approx_rows": n_rows,
        "approx_cols": n_cols,
    })

wb.close()

# Second pass: detailed analysis of each sheet with fresh workbook
wb = load_workbook(SRC, data_only=True, read_only=True)

detailed = []
global_cols = Counter()
person_keys = Counter()
brand_mentions = Counter()

for name in wb.sheetnames:
    ws = wb[name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        detailed.append({"name": name, "empty": True})
        continue

    # Find header
    hdr_idx = 0
    hdr = rows[0]
    best_score = -1
    for i, row in enumerate(rows[:20]):
        vals = [c for c in row if c is not None and str(c).strip()]
        textish = sum(1 for c in vals if isinstance(c, str) and len(str(c).strip()) > 1)
        score = len(vals) + textish
        if score > best_score:
            best_score = score
            hdr_idx = i
            hdr = row

    headers = []
    for j, h in enumerate(hdr):
        label = str(h).strip() if h is not None and str(h).strip() else f"COL_{j+1}"
        headers.append(label)
        global_cols[norm(label)] += 1

    data_rows = []
    formula_residues = 0
    empty_rows = 0
    for row in rows[hdr_idx + 1:]:
        # pad
        vals = list(row) + [None] * max(0, len(headers) - len(row))
        vals = vals[: len(headers)]
        if any(is_formula_residue(v) for v in vals):
            formula_residues += 1
        if not row_has_business_data(vals):
            empty_rows += 1
            continue
        data_rows.append(vals)

    # Heuristic identity columns
    hnorm = [norm(h) for h in headers]
    def find_col(*needles):
        for i, h in enumerate(hnorm):
            if any(n in h for n in needles):
                return i
        return None

    idx_nom = find_col("nom", "name", "technicien", "collaborateur", "apprenant")
    idx_prenom = find_col("prenom", "prénom")
    idx_agence = find_col("agence", "agency", "site")
    idx_marque = find_col("marque", "brand")
    idx_niveau = find_col("niveau", "level", "palier", "junior", "senior")
    idx_email = find_col("mail", "email", "e-mail")
    idx_matricule = find_col("matricule", "niu", "badge", "id")
    idx_code = find_col("code", "formation", "module")

    sample = []
    for vals in data_rows[:5]:
        sample.append({headers[i]: vals[i] for i in range(len(headers)) if vals[i] is not None})

    # Person key counts when possible
    distinct_people = set()
    for vals in data_rows:
        parts = []
        if idx_nom is not None:
            parts.append(norm(vals[idx_nom]))
        if idx_prenom is not None:
            parts.append(norm(vals[idx_prenom]))
        if parts and any(parts):
            key = "|".join(parts)
            distinct_people.add(key)
            person_keys[key] += 1
        if idx_marque is not None and vals[idx_marque] is not None:
            brand_mentions[norm(vals[idx_marque])] += 1

    detailed.append({
        "name": name,
        "header_row": hdr_idx + 1,
        "headers": headers,
        "data_rows": len(data_rows),
        "empty_rows_skipped": empty_rows,
        "formula_residue_rows": formula_residues,
        "cols_detected": {
            "nom": headers[idx_nom] if idx_nom is not None else None,
            "prenom": headers[idx_prenom] if idx_prenom is not None else None,
            "agence": headers[idx_agence] if idx_agence is not None else None,
            "marque": headers[idx_marque] if idx_marque is not None else None,
            "niveau": headers[idx_niveau] if idx_niveau is not None else None,
            "email": headers[idx_email] if idx_email is not None else None,
            "matricule": headers[idx_matricule] if idx_matricule is not None else None,
            "code": headers[idx_code] if idx_code is not None else None,
        },
        "distinct_people_heuristic": len(distinct_people) if distinct_people else None,
        "sample": sample,
    })

wb.close()

# Rank sheets by data volume
ranked = sorted(
    [d for d in detailed if not d.get("empty")],
    key=lambda d: d.get("data_rows", 0),
    reverse=True,
)

report = {
    "source": str(SRC),
    "sheet_count": len(detailed),
    "sheets_by_volume": [
        {"name": d["name"], "data_rows": d.get("data_rows", 0), "headers": d.get("headers", [])[:20]}
        for d in ranked[:30]
    ],
    "all_sheets": detailed,
    "header_labels_frequency_top40": global_cols.most_common(40),
    "top_brands": brand_mentions.most_common(30),
    "people_appearing_most": person_keys.most_common(20),
}

(OUT / "as_is_raw.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2, default=str),
    encoding="utf-8",
)

print(f"sheets={len(detailed)}")
print("TOP SHEETS BY DATA ROWS:")
for d in ranked[:25]:
    print(f"  {d['data_rows']:5d}  |  {d['name']}  |  cols={len(d.get('headers', []))}")
print("\nTOP HEADER LABELS:")
for h, c in global_cols.most_common(25):
    print(f"  {c:3d}  {h}")
print(f"\nWrote {OUT / 'as_is_raw.json'}")
