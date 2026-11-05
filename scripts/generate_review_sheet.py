#!/usr/bin/env python3
"""Génère un classeur Excel de revue à partir du report.json du dry-run.

Sorties : docs/dryrun_participants_2025/revue_arbitrages.xlsx
  - Onglet « Collisions slug »       (3 cas)
  - Onglet « Multi-client »          (60 cas)
  - Onglet « Sans prénom »           (21 cas)
  - Onglet « Signaux état session »  (6 cas)
  - Onglet « Orphelins »             (4 cas)

Chaque onglet a une colonne « Décision » vide à remplir par l'équipe RH / ops.
"""
from __future__ import annotations

import json
from pathlib import Path

try:
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
except ImportError as e:
    raise SystemExit("openpyxl requis : pip install openpyxl") from e

ROOT = Path(__file__).resolve().parents[1]
DRYRUN = ROOT / "docs" / "dryrun_participants_2025"
REPORT = DRYRUN / "report.json"
OUT = DRYRUN / "revue_arbitrages.xlsx"

HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=11)
WRAP = Alignment(wrap_text=True, vertical="top")
DECISION_FILL = PatternFill("solid", fgColor="FFF2CC")


def auto_width(ws):
    for col_cells in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col_cells[0].column)
        for c in col_cells:
            val = str(c.value or "")
            max_len = max(max_len, min(len(val), 60))
        ws.column_dimensions[col_letter].width = max_len + 4


def add_header(ws, headers):
    ws.append(headers)
    for i, _ in enumerate(headers, 1):
        c = ws.cell(1, i)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = WRAP
    ws.freeze_panes = "A2"


def main():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    rq = report["review_queue"]

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # ── 1. Collisions slug ──────────────────────────────────────────────────
    ws = wb.create_sheet("Collisions slug")
    add_header(ws, [
        "Slug", "Tuple A — Nom", "Tuple A — Prénom",
        "Tuple B — Nom", "Tuple B — Prénom",
        "Même personne ? (O/N)", "Décision (fusionner / garder 2 comptes / autre)",
    ])
    for item in rq["slug_collisions"]:
        tuples = item["tuples"]
        a = tuples[0] if len(tuples) > 0 else {}
        b = tuples[1] if len(tuples) > 1 else {}
        ws.append([
            item["slug"],
            a.get("nom", ""), a.get("prenom", ""),
            b.get("nom", ""), b.get("prenom", ""),
            "",  # O/N
            "",  # Décision
        ])
    for row in ws.iter_rows(min_row=2, min_col=6, max_col=7):
        for c in row:
            c.fill = DECISION_FILL
    auto_width(ws)

    # ── 2. Multi-client ─────────────────────────────────────────────────────
    ws = wb.create_sheet("Multi-client")
    add_header(ws, [
        "Nom (normalisé)", "Prénom (normalisé)", "Clients observés",
        "Nb clients", "Explication (changement employeur, variante libellé…)",
        "Client de référence à retenir", "Décision",
    ])
    for item in rq["multi_client"]:
        ws.append([
            item["nom_n"], item["prenom_n"],
            " | ".join(item["clients"]),
            len(item["clients"]),
            "",  # Explication
            "",  # Client ref
            "",  # Décision
        ])
    for row in ws.iter_rows(min_row=2, min_col=5, max_col=7):
        for c in row:
            c.fill = DECISION_FILL
    auto_width(ws)

    # ── 3. Sans prénom ──────────────────────────────────────────────────────
    ws = wb.create_sheet("Sans prénom")
    add_header(ws, [
        "Nom (normalisé)", "Lignes source (Excel)",
        "Prénom corrigé", "Décision",
    ])
    for item in rq["sans_prenom"]:
        ws.append([
            item["nom_n"],
            ", ".join(str(r) for r in item["rows"]),
            "",  # Prénom corrigé
            "",  # Décision
        ])
    for row in ws.iter_rows(min_row=2, min_col=3, max_col=4):
        for c in row:
            c.fill = DECISION_FILL
    auto_width(ws)

    # ── 4. Signaux état session ─────────────────────────────────────────────
    ws = wb.create_sheet("Signaux état session")
    add_header(ws, [
        "Cellule source", "Cible détectée", "Extrait commentaire",
        "Session concernée (N°)", "Statut réel (tenue / annulée / reportée)",
        "Décision",
    ])
    for item in rq["etat_commentaires"]:
        ws.append([
            item["cellule"], item["cible"],
            item["extrait"],
            "",  # N° session (à remplir manuellement)
            "",  # Statut réel
            "",  # Décision
        ])
    for row in ws.iter_rows(min_row=2, min_col=4, max_col=6):
        for c in row:
            c.fill = DECISION_FILL
    auto_width(ws)

    # ── 5. Orphelins ────────────────────────────────────────────────────────
    ws = wb.create_sheet("Orphelins")
    add_header(ws, [
        "Cellule source", "Colonne", "Cible",
        "Texte commentaire",
        "Session / personne retrouvée ?", "Décision",
    ])
    for item in rq["orphelins"]:
        ws.append([
            item["cellule_source"], item["column_letter"], item["cible"],
            item["texte"],
            "",  # retrouvé ?
            "",  # Décision
        ])
    for row in ws.iter_rows(min_row=2, min_col=5, max_col=6):
        for c in row:
            c.fill = DECISION_FILL
    auto_width(ws)

    wb.save(OUT)
    print(f"Revue generee -> {OUT}")
    counts = {name: ws.max_row - 1 for name, ws in zip(
        ["collisions", "multi_client", "sans_prenom", "etat_session", "orphelins"],
        wb.worksheets,
    )}
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
