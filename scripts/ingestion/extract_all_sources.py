#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extraction & Normalisation des Données de Formation 2026 CFAO Academy.
Sources traitées :
1. Catalogue de Formation Technique Carrosserie 2026.pdf
2. Catalogue_de_Formation_Process_SAV_PART_MOBILITY_2026.docx
3. Catalogue_de_Formation_Process_SAV_PART_EQUIPMENT_2026.docx
4. Liste des Formations Motors & Equipment 2026.xlsx
5. Classeur1-Mises a jour prog suzuki aout 2026.xlsx (PRIORITÉ ABSOLUE SUR SUZUKI)
6. Thématiques de Formations Non Choisies Motors et Equipment.xlsx
7. Clés de Répartition Equipment & Motors (.xlsm)
"""

import os
import sys
import re
import json
import zipfile
import datetime
import unicodedata
import xml.etree.ElementTree as ET
import fitz
import openpyxl

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUTPUT_DIR = os.path.join(BASE_DIR, "data", "normalized")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def clean_text(s):
    if s is None:
        return ""
    text = str(s).strip()
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_carrosserie_pdf():
    pdf_path = os.path.join(BASE_DIR, "Catalogue de Formation Technique Carrosserie 2026.pdf")
    print(f"[1/6] Extraction de {os.path.basename(pdf_path)}...")
    if not os.path.exists(pdf_path):
        print(f"  Erreur : fichier introuvable {pdf_path}")
        return []

    doc = fitz.open(pdf_path)
    modules = []

    for p_num in range(7, len(doc)):
        page = doc[p_num]
        text = page.get_text()
        lines = [clean_text(l) for l in text.split("\n") if clean_text(l)]
        if not lines:
            continue

        code = ""
        level = "JUNIOR"
        title_lines = []
        is_obj, is_prereq, is_public, is_duree = False, False, False, False
        objectives, prerequisites, target_public = [], [], []
        duration = "3 jours / 21h"

        for idx, l in enumerate(lines):
            if l in ["01N1", "02N1", "03N1", "04N1", "05N1", "01N2", "02N2", "01N3", "02N3"]:
                code = l
                if "N1" in code:
                    level = "JUNIOR"
                elif "N2" in code:
                    level = "SENIOR"
                elif "N3" in code:
                    level = "EXPERT"

                if idx + 1 < len(lines):
                    title_lines.append(lines[idx + 1])
                if idx + 2 < len(lines) and not any(k in lines[idx + 2].upper() for k in ["OBJECTIF", "PUBLIC", "DURÉE", "PRÉREQUIS"]):
                    title_lines.append(lines[idx + 2])

            if "OBJECTIF" in l.upper():
                is_obj, is_prereq, is_public, is_duree = True, False, False, False
                continue
            elif "PRÉREQUIS" in l.upper() or "PREREQUIS" in l.upper():
                is_obj, is_prereq, is_public, is_duree = False, True, False, False
                continue
            elif "PUBLIC" in l.upper():
                is_obj, is_prereq, is_public, is_duree = False, False, True, False
                continue
            elif "DURÉE" in l.upper() or "DUREE" in l.upper():
                is_obj, is_prereq, is_public, is_duree = False, False, False, True
                continue

            if is_obj and len(objectives) < 6:
                objectives.append(l)
            elif is_prereq and len(prerequisites) < 4:
                prerequisites.append(l)
            elif is_public and len(target_public) < 3:
                target_public.append(l)
            elif is_duree and "jour" in l.lower():
                duration = l

        if code:
            title = clean_text(" ".join(title_lines))
            modules.append({
                "pole": "CARROSSERIE",
                "family_key": "techniques-carrosserie",
                "brand": "MULTI",
                "code": code,
                "title": title or f"Formation Carrosserie {code}",
                "level": level,
                "duration": duration,
                "target_public": target_public or ["Carrossiers", "Peintres en carrosserie"],
                "prerequisites": prerequisites or ["Connaissances de base en carrosserie"],
                "objectives": objectives,
                "source_file": os.path.basename(pdf_path),
                "page": p_num + 1
            })

    print(f"  -> {len(modules)} modules Carrosserie extraits.")
    return modules


def parse_docx_modules(docx_filename, pole, family_sav, family_parts):
    docx_path = os.path.join(BASE_DIR, docx_filename)
    print(f"[2/6] Extraction de {docx_filename}...")
    if not os.path.exists(docx_path):
        print(f"  Erreur : fichier introuvable {docx_path}")
        return []

    with zipfile.ZipFile(docx_path) as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        paragraphs = []
        for p in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            p_text = ''.join(t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text)
            cleaned = clean_text(p_text)
            if cleaned:
                paragraphs.append(cleaned)

    known_codes = [
        "TSKR01", "TFT01", "TTG01", "TSA01", 
        "FO01", "FO02", "FO03", "FO04", "FO05", "FO06",
        "TP01", "TP02", "TP03", "SPC01", "PART01",
        "TM01", "TM02", "TM03", "TM04", "TM05"
    ]

    modules = []
    current_section = "SAV"

    i = 0
    while i < len(paragraphs):
        p = paragraphs[i]
        if "PROCESS PARTS" in p.upper():
            current_section = "PARTS"
        elif "PROCESS SAV" in p.upper():
            current_section = "SAV"

        matched_code = None
        for kc in known_codes:
            if p == kc or p.startswith(kc + " ") or p.startswith(kc + ":") or p.startswith(kc + " -"):
                matched_code = kc
                break

        if matched_code and i > 250:
            code = matched_code
            title = ""
            objectives, prerequisites, target_public = [], [], []
            duration = "2 jours / 14h"

            j = i + 1
            section_mode = "TITLE"
            while j < min(i + 45, len(paragraphs)):
                next_p = paragraphs[j]
                if any(next_p == kc or next_p.startswith(kc + " ") for kc in known_codes):
                    break
                if "OBJECTIF" in next_p.upper():
                    section_mode = "OBJ"
                    j += 1
                    continue
                elif "PRÉREQUIS" in next_p.upper() or "PREREQUIS" in next_p.upper():
                    section_mode = "PREREQ"
                    j += 1
                    continue
                elif "PUBLIC" in next_p.upper():
                    section_mode = "PUBLIC"
                    j += 1
                    continue
                elif "DURÉE" in next_p.upper() or "DUREE" in next_p.upper():
                    section_mode = "DUREE"
                    j += 1
                    continue
                elif "CONTENU" in next_p.upper() or "PROGRAMME" in next_p.upper():
                    section_mode = "CONTENU"
                    j += 1
                    continue

                if section_mode == "TITLE" and not title and len(next_p) > 5 and not next_p.startswith("Page"):
                    title = next_p
                elif section_mode == "OBJ" and len(objectives) < 6:
                    objectives.append(next_p)
                elif section_mode == "PREREQ" and len(prerequisites) < 4:
                    prerequisites.append(next_p)
                elif section_mode == "PUBLIC" and len(target_public) < 3:
                    target_public.append(next_p)
                elif section_mode == "DUREE" and "jour" in next_p.lower():
                    duration = next_p

                j += 1

            family_key = family_parts if current_section == "PARTS" or code.startswith("TP") or code in ["SPC01", "PART01"] or code.startswith("TM") else family_sav
            
            if not any(m["code"] == code and m["pole"] == pole for m in modules):
                modules.append({
                    "pole": pole,
                    "family_key": family_key,
                    "brand": "MULTI",
                    "code": code,
                    "title": title or f"Process {current_section} {code}",
                    "level": "STANDARD",
                    "duration": duration,
                    "target_public": target_public or [f"Personnel {current_section}"],
                    "prerequisites": prerequisites or ["Collaborateurs CFAO réseau"],
                    "objectives": objectives,
                    "source_file": docx_filename
                })
        i += 1

    print(f"  -> {len(modules)} modules Process extraits pour {pole}.")
    return modules


def parse_themathiques_non_choisies():
    xlsx_path = os.path.join(BASE_DIR, "Thématiques de Formations Non Choisies Motors et Equipment.xlsx")
    print(f"[3/6] Extraction de {os.path.basename(xlsx_path)}...")
    if not os.path.exists(xlsx_path):
        print(f"  Erreur : fichier introuvable {xlsx_path}")
        return []

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["FORMATIONS NON CHOISIES"]
    rows = list(ws.iter_rows(values_only=True))

    non_choisies = []
    current_bu = "MOTORS"
    current_marque = ""
    current_niveau = "JUNIOR"

    for r in rows[1:]:
        if not any(r):
            continue
        if r[0]: current_bu = clean_text(r[0]).upper()
        if r[1]: current_marque = clean_text(r[1]).upper()
        if r[2]: current_niveau = clean_text(r[2]).upper()
        code = clean_text(r[3])
        title = clean_text(r[4])
        if code:
            non_choisies.append({
                "bu": current_bu,
                "brand": current_marque,
                "level": current_niveau,
                "code": code,
                "title": title,
                "status": "NON_CHOISIE_06_02_2026",
                "source_file": os.path.basename(xlsx_path)
            })

    print(f"  -> {len(non_choisies)} modules non choisis extraits.")
    return non_choisies


def parse_planned_sessions_with_suzuki_priority():
    """
    Consolide les sessions de formation 2026 avec arbitrage absolu :
    - Liste de base : Liste des Formations Motors & Equipment 2026.xlsx
    - Règle stricte : la version d'Août de Suzuki (Classeur1-Mises a jour prog suzuki aout 2026.xlsx)
      remplace intégralement les sessions Suzuki de Mars 2026 !
    """
    liste_path = os.path.join(BASE_DIR, "Liste des Formations Motors & Equipment 2026.xlsx")
    suzuki_path = os.path.join(BASE_DIR, "Classeur1-Mises a jour prog suzuki aout 2026.xlsx")
    print(f"[4/6] Consolidation des sessions 2026 avec priorité Suzuki Août...")

    wb_liste = openpyxl.load_workbook(liste_path, data_only=True)
    ws_liste = wb_liste["Liste des Formations"]

    wb_suzuki = openpyxl.load_workbook(suzuki_path, data_only=True)
    ws_suzuki = wb_suzuki["French"]

    consolidated_sessions = []
    skipped_march_suzuki_count = 0

    # 1. Traiter Liste des Formations (Exclure Suzuki pour substituer la version Août)
    for idx, r in enumerate(list(ws_liste.iter_rows(values_only=True))[1:], start=2):
        if not any(r):
            continue
        pole = clean_text(r[0]) or "Motors"
        marque = clean_text(r[1])
        code = clean_text(r[2])
        formation = clean_text(r[3])
        type_form = clean_text(r[4]) or "Présentiel"
        lieu = clean_text(r[5]) or "Douala"
        debut = r[6].strftime("%Y-%m-%d") if isinstance(r[6], (datetime.date, datetime.datetime)) else (str(r[6])[:10] if r[6] else None)
        fin = r[7].strftime("%Y-%m-%d") if isinstance(r[7], (datetime.date, datetime.datetime)) else (str(r[7])[:10] if r[7] else None)
        formateur = clean_text(r[8])
        client = clean_text(r[9])

        if marque.upper() == "SUZUKI":
            skipped_march_suzuki_count += 1
            continue

        consolidated_sessions.append({
            "session_index": len(consolidated_sessions) + 1,
            "pole": pole,
            "brand": marque,
            "code": code,
            "title": formation,
            "training_type": type_form,
            "location": lieu,
            "start_date": debut,
            "end_date": fin,
            "duration_days": None,
            "trainer": formateur,
            "client_scope": client,
            "version_source": "LISTE_ANNUELLE_MARS_2026",
            "is_authoritative": True
        })

    print(f"  -> {len(consolidated_sessions)} sessions hors-Suzuki conservées ({skipped_march_suzuki_count} sessions Suzuki de Mars écartées).")

    # 2. Injecter les 25 sessions officielles Suzuki d'Août 2026
    suzuki_august_count = 0
    for idx, r in enumerate(list(ws_suzuki.iter_rows(values_only=True))[1:], start=2):
        if not any(r):
            continue
        pole = clean_text(r[0]) or "Motors"
        marque = clean_text(r[1]) or "Suzuki"
        code = clean_text(r[2])
        formation = clean_text(r[3])
        lieu_raw = clean_text(r[4]) or "ACADEMY"
        debut = r[5].strftime("%Y-%m-%d") if isinstance(r[5], (datetime.date, datetime.datetime)) else (str(r[5])[:10] if r[5] else None)
        fin = r[6].strftime("%Y-%m-%d") if isinstance(r[6], (datetime.date, datetime.datetime)) else (str(r[6])[:10] if r[6] else None)
        duree = int(r[7]) if r[7] and str(r[7]).isdigit() else None

        if lieu_raw.upper() in ["EN LIGNE", "DISTANCIEL"]:
            training_type = "Distanciel"
            lieu = "En ligne"
        elif lieu_raw.upper() == "ACADEMY":
            training_type = "Présentiel"
            lieu = "Douala (CFR Academy)"
        else:
            training_type = "Présentiel (Délocalisé)"
            lieu = lieu_raw

        formateur = "CEDRIC PAKO"
        if "EPC" in code or "SNAPON" in formation.upper():
            formateur = "GEROLD SADIO"

        consolidated_sessions.append({
            "session_index": len(consolidated_sessions) + 1,
            "pole": pole,
            "brand": "Suzuki",
            "code": code,
            "title": formation,
            "training_type": training_type,
            "location": lieu,
            "start_date": debut,
            "end_date": fin,
            "duration_days": duree,
            "trainer": formateur,
            "client_scope": "Réseau Suzuki CFAO",
            "version_source": "CLASSEUR1_SUZUKI_AOUT_2026 (AUTHORITATIVE)",
            "is_authoritative": True
        })
        suzuki_august_count += 1

    print(f"  -> {suzuki_august_count} sessions Suzuki officielles (Août 2026) injectées.")
    print(f"  => TOTAL sessions planifiées 2026 consolidées : {len(consolidated_sessions)}")
    return consolidated_sessions


def consolidate_courses_catalog(catalog_modules, planned_sessions):
    """
    Consolide l'intégralité des modules de formation (Carrosserie + Process + Techniques Marques).
    """
    all_courses = list(catalog_modules)
    existing_keys = set((m["brand"].upper(), m["code"].upper()) for m in all_courses if m.get("code"))

    for s in planned_sessions:
        code = clean_text(s.get("code"))
        brand = clean_text(s.get("brand")) or "MULTI"
        title = clean_text(s.get("title"))
        pole = clean_text(s.get("pole")) or "Motors"

        if not code or not title:
            continue

        key = (brand.upper(), code.upper())
        if key not in existing_keys:
            pole_upper = pole.upper()
            if "EQUIPMENT" in pole_upper:
                family_key = "techniques-equipment"
            elif "CARROSSERIE" in pole_upper:
                family_key = "techniques-carrosserie"
            elif brand.upper() == "YAMAHA":
                family_key = "techniques-yamaha"
            else:
                family_key = "techniques-motors"

            level = "STANDARD"
            if any(w in code.upper() or w in title.upper() for w in ["BRONZE", "G1", "JUNIOR", "01N1", "02N1"]):
                level = "JUNIOR"
            elif any(w in code.upper() or w in title.upper() for w in ["SILVER", "G2", "SENIOR", "01N2"]):
                level = "SENIOR"
            elif any(w in code.upper() or w in title.upper() for w in ["GOLD", "G3", "EXPERT", "01N3", "DIAGNOSTIC"]):
                level = "EXPERT"

            all_courses.append({
                "pole": "EQUIPMENT" if "EQUIPMENT" in pole_upper else ("CARROSSERIE" if "CARROSSERIE" in pole_upper else "MOBILITY"),
                "family_key": family_key,
                "brand": brand,
                "code": code,
                "title": title,
                "level": level,
                "duration": f"{s.get('duration_days', 5)} jours" if s.get('duration_days') else "5 jours / 35h",
                "target_public": [f"Techniciens {brand}"],
                "prerequisites": ["Prérequis constructeur"],
                "objectives": [f"Maîtriser {title}"],
                "source_file": "Consolidé depuis Planning Sessions 2026"
            })
            existing_keys.add(key)

    print(f"  -> Master catalogue consolidé : {len(all_courses)} formations uniques.")
    return all_courses


def parse_branch_quotas():
    eq_path = os.path.join(BASE_DIR, "Clé de Répartition + Formation 2026 par Pays + Formation par Marque (Equipment).xlsm")
    mot_path = os.path.join(BASE_DIR, "Copie de Clé de Répartition + Formation par pays + formation par marque (Motors) 2026.xlsm")
    print(f"[5/6] Extraction des clés de répartition (quotas & effectifs filiales)...")

    quotas = []

    # 1. Equipment
    wb_eq = openpyxl.load_workbook(eq_path, data_only=True)
    ws_eq = wb_eq["TOUS LES PAYS"]
    rows_eq = list(ws_eq.iter_rows(values_only=True))

    r0 = rows_eq[0]
    brand_cols_eq = []
    col = 2
    while col < len(r0):
        b_name = r0[col]
        if b_name:
            clean_b = clean_text(b_name).upper()
            brand_cols_eq.append((clean_b, col))
        col += 3

    for r in rows_eq[2:]:
        if not r[0] or clean_text(r[0]).upper() in ["TOTAL", "MOYENNE"]:
            continue
        country = clean_text(r[0]).upper()
        total_techs = int(r[1]) if r[1] and str(r[1]).isdigit() else 0

        for b_name, c_idx in brand_cols_eq:
            besoin = int(r[c_idx]) if c_idx < len(r) and r[c_idx] and str(r[c_idx]).isdigit() else 0
            tech = int(r[c_idx + 1]) if c_idx + 1 < len(r) and r[c_idx + 1] and str(r[c_idx + 1]).isdigit() else 0
            reel = int(r[c_idx + 2]) if c_idx + 2 < len(r) and r[c_idx + 2] and str(r[c_idx + 2]).isdigit() else 0

            if total_techs > 0 or besoin > 0 or reel > 0:
                quotas.append({
                    "pole": "EQUIPMENT",
                    "country": country,
                    "brand": b_name,
                    "total_branch_techs": total_techs,
                    "brand_tech_count": tech,
                    "requested_needs": besoin,
                    "allocated_seats": reel,
                    "source_file": os.path.basename(eq_path)
                })

    # 2. Motors
    wb_mot = openpyxl.load_workbook(mot_path, data_only=True)
    ws_mot = wb_mot["MOTORS GLOBAL"]
    rows_mot = list(ws_mot.iter_rows(values_only=True))

    r0_m = rows_mot[0]
    brand_cols_mot = []
    col = 2
    while col < len(r0_m):
        b_name = r0_m[col]
        if b_name:
            clean_b = clean_text(b_name).upper()
            brand_cols_mot.append((clean_b, col))
        col += 3

    for r in rows_mot[2:]:
        if not r[0] or clean_text(r[0]).upper() in ["TOTAL", "MOYENNE"]:
            continue
        country = clean_text(r[0]).upper()
        total_techs = int(r[1]) if r[1] and str(r[1]).isdigit() else 0

        for b_name, c_idx in brand_cols_mot:
            besoin = int(r[c_idx]) if c_idx < len(r) and r[c_idx] and str(r[c_idx]).isdigit() else 0
            tech = int(r[c_idx + 1]) if c_idx + 1 < len(r) and r[c_idx + 1] and str(r[c_idx + 1]).isdigit() else 0
            attrib = int(r[c_idx + 2]) if c_idx + 2 < len(r) and r[c_idx + 2] and str(r[c_idx + 2]).isdigit() else 0

            if total_techs > 0 or besoin > 0 or attrib > 0:
                quotas.append({
                    "pole": "MOTORS",
                    "country": country,
                    "brand": b_name,
                    "total_branch_techs": total_techs,
                    "brand_tech_count": tech,
                    "requested_needs": besoin,
                    "allocated_seats": attrib,
                    "source_file": os.path.basename(mot_path)
                })

    print(f"  -> {len(quotas)} lignes de quotas et effectifs extraites (Equipment + Motors).")
    return quotas


def parse_course_allocations_from_brand_sheets():
    print(f"[6/6] Extraction des demandes par module et par filiale...")
    mot_path = os.path.join(BASE_DIR, "Copie de Clé de Répartition + Formation par pays + formation par marque (Motors) 2026.xlsm")
    wb = openpyxl.load_workbook(mot_path, data_only=True)

    allocations = []
    brand_sheets = ["SUZUKI", "TOYOTA", "BYD", "MITSUBISHI", "STELLANTIS", "MERCEDES"]

    for bname in brand_sheets:
        if bname not in wb.sheetnames:
            continue
        ws = wb[bname]
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            continue

        headers = rows[0]
        countries = []
        for c_idx in range(4, len(headers)):
            c_val = headers[c_idx]
            if c_val and clean_text(c_val):
                countries.append((clean_text(c_val).upper(), c_idx))

        current_level = "JUNIOR"
        for r in rows[1:]:
            if not any(r):
                continue
            if r[1]:
                current_level = clean_text(r[1]).upper()
            code = clean_text(r[2])
            title = clean_text(r[3])
            if not code or code.upper() in ["TOTAL", "CODE"]:
                continue

            for country_name, c_idx in countries:
                val = r[c_idx] if c_idx < len(r) else None
                if val and str(val).strip().isdigit() and int(val) > 0:
                    allocations.append({
                        "brand": bname,
                        "level": current_level,
                        "code": code,
                        "title": title,
                        "country": country_name,
                        "allocated_seats": int(val)
                    })

    print(f"  -> {len(allocations)} attributions modulaires filiales extraites.")
    return allocations


def main():
    print("=" * 70)
    print("NORMALISATION GLOBALE DES DONNÉES DE FORMATION 2026 CFAO ACADEMY")
    print("=" * 70)

    # 1. Catalogues pédagogiques (PDF, DOCX)
    carrosserie = parse_carrosserie_pdf()
    sav_mob = parse_docx_modules("Catalogue_de_Formation_Process_SAV_PART_MOBILITY_2026.docx", "MOBILITY", "process-sav-motors", "process-parts-motors")
    sav_eq = parse_docx_modules("Catalogue_de_Formation_Process_SAV_PART_EQUIPMENT_2026.docx", "EQUIPMENT", "process-sav-equipment", "process-parts-equipment")
    initial_catalog = carrosserie + sav_mob + sav_eq

    # 2. Thématiques non choisies
    non_choisies = parse_themathiques_non_choisies()

    # 3. Sessions planifiées 2026 avec priorité Suzuki Août
    sessions = parse_planned_sessions_with_suzuki_priority()

    # 4. Master catalogue consolidé (avec les cours techniques du planning)
    all_catalog_courses = consolidate_courses_catalog(initial_catalog, sessions)

    # 5. Quotas & Clés de répartition filiales
    quotas = parse_branch_quotas()

    # 6. Attributions modulaires par pays
    course_allocs = parse_course_allocations_from_brand_sheets()

    # Sauvegarde des JSON normalisés
    f_courses = os.path.join(OUTPUT_DIR, "courses_catalog_2026.json")
    with open(f_courses, "w", encoding="utf-8") as f:
        json.dump(all_catalog_courses, f, indent=2, ensure_ascii=False)
    print(f"\n[OK] Écrit : {f_courses} ({len(all_catalog_courses)} formations)")

    f_sessions = os.path.join(OUTPUT_DIR, "planned_sessions_2026.json")
    with open(f_sessions, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2, ensure_ascii=False)
    print(f"[OK] Écrit : {f_sessions} ({len(sessions)} sessions consolidées)")

    f_non_choisies = os.path.join(OUTPUT_DIR, "themathiques_non_choisies_2026.json")
    with open(f_non_choisies, "w", encoding="utf-8") as f:
        json.dump(non_choisies, f, indent=2, ensure_ascii=False)
    print(f"[OK] Écrit : {f_non_choisies} ({len(non_choisies)} modules non retenus)")

    f_quotas = os.path.join(OUTPUT_DIR, "branch_quotas_2026.json")
    with open(f_quotas, "w", encoding="utf-8") as f:
        json.dump(quotas, f, indent=2, ensure_ascii=False)
    print(f"[OK] Écrit : {f_quotas} ({len(quotas)} lignes de quotas filiales)")

    f_allocs = os.path.join(OUTPUT_DIR, "course_allocations_by_country_2026.json")
    with open(f_allocs, "w", encoding="utf-8") as f:
        json.dump(course_allocs, f, indent=2, ensure_ascii=False)
    print(f"[OK] Écrit : {f_allocs} ({len(course_allocs)} attributions par pays)")

    print("\n" + "=" * 70)
    print("EXTRACTION ET NORMALISATION TERMINÉES AVEC SUCCÈS !")
    print("=" * 70)


if __name__ == "__main__":
    main()
