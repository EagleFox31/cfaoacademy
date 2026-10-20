#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestion des Données de Formation 2026 CFAO Academy dans PostgreSQL.
Bases cibles :
1. cfao-needs-needs-db-1 (needs-db) :
   - Campagne 2026 avec statut ARBITRATED
   - Lignes de catalogue pédagogique 2026 (129 cours)
   - Clé de répartition & quotas filiales (494 quotas)
   - Demandes modulaires par filiale (470 attributions)
   - Sessions planifiées 2026 consolidées (180 sessions, Suzuki Août prioritaire)
   - Thématiques de formations non choisies (42 modules)
2. cfaoacademy-core-db-1 (core-db) :
   - LMS Courses & Modules (lms_course, lms_module)
3. cfaoacademy-ops-db-1 (ops-db) :
   - Sessions de formation opérationnelles 2026 (training_session)
"""

import os
import sys
import json
import uuid
import subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data", "normalized")


def gen_uuid(name: str) -> str:
    """Génère un UUID v5 déterministe basé sur un namespace fixe pour l'idempotence."""
    NAMESPACE_CFAO = uuid.UUID('12345678-1234-5678-1234-567812345678')
    return str(uuid.uuid5(NAMESPACE_CFAO, name))


def execute_sql_in_container(container: str, user: str, db: str, sql: str) -> str:
    """Exécute un script SQL via docker exec psql avec encodage UTF-8 strict."""
    cmd = ["docker", "exec", "-i", container, "psql", "-U", user, "-d", db]
    res = subprocess.run(cmd, input=sql.encode('utf-8'), capture_output=True, check=False)
    out = res.stdout.decode('utf-8', errors='replace')
    err = res.stderr.decode('utf-8', errors='replace')
    if res.returncode != 0:
        print(f"  [ERREUR code={res.returncode}] dans {container}/{db} : {err.strip()}")
        raise RuntimeError(f"Échec SQL dans {container}/{db}: {err.strip()}")
    if err.strip():
        print(f"  [AVERTISSEMENT SQL] {container}/{db} : {err.strip()}")
    return out


def escape_sql(val) -> str:
    """Échappe une valeur pour injection SQL sécurisée."""
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"


def step1_init_tables():
    print("\n--- [1/6] Initialisation des schémas SQL ---")
    sql_needs_path = os.path.join(BASE_DIR, "scripts", "ingestion", "init_database_tables.sql")
    sql_ops_path = os.path.join(BASE_DIR, "scripts", "ingestion", "init_ops_schema.sql")

    with open(sql_needs_path, "r", encoding="utf-8") as f:
        sql_needs = f.read()
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", sql_needs)
    print("  -> Schéma SQL appliqué avec succès dans cfao-needs-needs-db-1 (needs)")

    with open(sql_ops_path, "r", encoding="utf-8") as f:
        sql_ops = f.read()
    execute_sql_in_container("cfaoacademy-ops-db-1", "ops", "ops", sql_ops)
    print("  -> Schéma SQL appliqué avec succès dans cfaoacademy-ops-db-1 (ops)")


def step2_ingest_campaign_and_brands():
    print("\n--- [2/6] Enregistrement Campagne 2026 (Statut ARBITRATED) & Marques Référentielles ---")
    
    # 1. Marques complémentaires dans needs-db
    brands_sql = """
    INSERT INTO referential_brand (id, created_at, updated_at, code, label, pole, is_active, sort_order)
    VALUES 
        ('b0000001-0000-0000-0000-000000000001', NOW(), NOW(), 'stellantis', 'STELLANTIS', 'MOBILITY', true, 22),
        ('b0000002-0000-0000-0000-000000000002', NOW(), NOW(), 'bridgestone', 'BRIDGESTONE', 'MOBILITY', true, 23),
        ('b0000003-0000-0000-0000-000000000003', NOW(), NOW(), 'multi', 'MULTI-MARQUES', 'MOBILITY', true, 24)
    ON CONFLICT (code) DO NOTHING;
    """
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", brands_sql)
    print("  -> Marques complémentaires vérifiées dans referential_brand.")

    # 2. Campagne 2026 au statut ARBITRATED
    campaign_id = "20260000-0000-0000-0000-000000002026"
    campaign_sql = f"""
    INSERT INTO campaigns_campaign (id, created_at, updated_at, year, label, status, opens_at, closes_at, default_locale)
    VALUES (
        '{campaign_id}',
        NOW(), NOW(),
        2026,
        'Recueil et Arbitrage des Besoins 2026',
        'ARBITRATED',
        '2026-01-01 00:00:00+00',
        '2026-03-31 23:59:59+00',
        'fr'
    )
    ON CONFLICT (year) DO UPDATE SET
        label = EXCLUDED.label,
        status = 'ARBITRATED',
        updated_at = NOW();
    """
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", campaign_sql)
    print("  -> Campagne 2026 créée/mise à jour au statut ARBITRATED.")
    return campaign_id


def step3_ingest_catalog_lines(campaign_id: str):
    print("\n--- [3/6] Ingestion du Catalogue Pédagogique (129 Formations) dans needs-db & core-db ---")
    courses_file = os.path.join(DATA_DIR, "courses_catalog_2026.json")
    with open(courses_file, "r", encoding="utf-8") as f:
        courses = json.load(f)

    # Récupérer les ID des familles de catalogue depuis needs-db
    family_query = "SELECT id, key FROM referential_catalogfamily;"
    family_res = execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", family_query)
    family_map = {}
    for line in family_res.strip().split("\n"):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) == 2 and "-" in parts[0]:
            family_map[parts[1]] = parts[0]

    # Récupérer les ID des marques depuis needs-db
    brand_query = "SELECT id, code FROM referential_brand;"
    brand_res = execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", brand_query)
    brand_map = {}
    for line in brand_res.strip().split("\n"):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) == 2 and "-" in parts[0]:
            brand_map[parts[1].lower()] = parts[0]

    # Préparer les inserts pour needs-db (campaigns_catalogline)
    seen_catlines = set()
    unique_catlines = []

    seen_core_courses = set()
    unique_core_courses = []
    unique_core_modules = []

    for idx, c in enumerate(courses, start=1):
        c_code = c.get("code") or f"MOD{idx}"
        c_brand_raw = c.get("brand", "MULTI").lower().replace(" & ", "-").replace(" ", "-")
        c_family_key = c.get("family_key", "techniques-motors")
        
        fam_id = family_map.get(c_family_key) or family_map.get("techniques-motors")
        br_id = brand_map.get(c_brand_raw)
        br_id_sql = f"'{br_id}'" if br_id else "NULL"

        line_id = gen_uuid(f"2026-catline-{c_code}-{c.get('brand')}-{c.get('pole')}")
        title = c.get("title", "")
        level = c.get("level", "STANDARD")
        tier = "CORE" if level in ["JUNIOR", "STANDARD"] else "ADVANCED"
        pop_json = json.dumps(c.get("target_public", ["Techniciens"])).replace("'", "''")

        if line_id not in seen_catlines:
            seen_catlines.add(line_id)
            unique_catlines.append(f"""(
                '{line_id}', NOW(), NOW(), {escape_sql(c_code)}, {escape_sql(title)},
                '{tier}', '{pop_json}'::jsonb, {idx},
                {br_id_sql}, '{campaign_id}', '{fam_id}', {escape_sql(title)}, {escape_sql(level)}
            )""")

        # Données pour lms_course dans core-db (dédoublonnées)
        core_course_id = gen_uuid(f"core-lms-course-{c_code}-{c.get('brand')}")
        if core_course_id not in seen_core_courses:
            seen_core_courses.add(core_course_id)
            summary = "; ".join(c.get("objectives", [title]))[:500]
            lvl_raw = level.lower()
            lvl_core = lvl_raw if lvl_raw in ["junior", "senior", "expert"] else ""
            unique_core_courses.append(f"""(
                NOW(), NOW(), '{core_course_id}', {escape_sql(title[:255])},
                {escape_sql(c.get('brand', 'MULTI')[:64])}, {escape_sql(c_family_key[:128])},
                {escape_sql(lvl_core)}, {escape_sql(summary)}, true
            )""")

            # Module rattaché dans lms_module
            core_mod_id = gen_uuid(f"core-lms-module-{c_code}-{c.get('brand')}")
            unique_core_modules.append(f"""(
                NOW(), NOW(), '{core_mod_id}', 1, {escape_sql(title[:255])},
                'elearning', {escape_sql(c_code[:255])}, '{core_course_id}'
            )""")

    # Exécution dans needs-db
    sql_needs_cat = f"""
    INSERT INTO campaigns_catalogline (
        id, created_at, updated_at, code, title, tier, populations, sort_order,
        brand_id, campaign_id, family_id, title_en, level_label
    ) VALUES {', '.join(unique_catlines)}
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        level_label = EXCLUDED.level_label,
        updated_at = NOW();
    """
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", sql_needs_cat)
    print(f"  -> {len(unique_catlines)} lignes de catalogue insérées/mises à jour dans needs-db.")

    # Exécution dans core-db (lms_course puis lms_module)
    sql_core_courses = f"""
    INSERT INTO lms_course (created_at, updated_at, id, title, brand, functional_group, level, summary, published)
    VALUES {', '.join(unique_core_courses)}
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        brand = EXCLUDED.brand,
        functional_group = EXCLUDED.functional_group,
        summary = EXCLUDED.summary,
        updated_at = NOW();
    """
    res_c = execute_sql_in_container("cfaoacademy-core-db-1", "core", "core", sql_core_courses)

    sql_core_modules = f"""
    INSERT INTO lms_module (created_at, updated_at, id, "order", title, kind, content_ref, course_id)
    VALUES {', '.join(unique_core_modules)}
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = NOW();
    """
    res_m = execute_sql_in_container("cfaoacademy-core-db-1", "core", "core", sql_core_modules)
    print(f"  -> {len(unique_core_courses)} cours et modules insérés dans core-db ({res_c.strip()} / {res_m.strip()}).")


def step4_ingest_quotas_and_allocations(campaign_id: str):
    print("\n--- [4/6] Ingestion des Quotas de Répartition (494) & Demandes Filiales (470) ---")
    
    # 1. Quotas filiales
    quotas_file = os.path.join(DATA_DIR, "branch_quotas_2026.json")
    with open(quotas_file, "r", encoding="utf-8") as f:
        quotas = json.load(f)

    quota_vals = []
    for q in quotas:
        qid = gen_uuid(f"2026-quota-{q['pole']}-{q['country']}-{q['brand']}")
        quota_vals.append(f"""(
            '{qid}', '{campaign_id}', {escape_sql(q['pole'])}, {escape_sql(q['country'])},
            {escape_sql(q['brand'])}, {q['total_branch_techs']}, {q['brand_tech_count']},
            {q['requested_needs']}, {q['allocated_seats']}, {escape_sql(q['source_file'])},
            NOW(), NOW()
        )""")

    sql_quotas = f"""
    INSERT INTO campaigns_branchbrandquota (
        id, campaign_id, pole, country, brand, total_branch_techs, brand_tech_count,
        requested_needs, allocated_seats, source_file, created_at, updated_at
    ) VALUES {', '.join(quota_vals)}
    ON CONFLICT (campaign_id, pole, country, brand) DO UPDATE SET
        total_branch_techs = EXCLUDED.total_branch_techs,
        brand_tech_count = EXCLUDED.brand_tech_count,
        requested_needs = EXCLUDED.requested_needs,
        allocated_seats = EXCLUDED.allocated_seats,
        updated_at = NOW();
    """
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", sql_quotas)
    print(f"  -> {len(quota_vals)} quotas filiales enregistrés dans campaigns_branchbrandquota.")

    # 2. Attributions modulaires
    allocs_file = os.path.join(DATA_DIR, "course_allocations_by_country_2026.json")
    with open(allocs_file, "r", encoding="utf-8") as f:
        allocs = json.load(f)

    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", f"DELETE FROM campaigns_courseallocation WHERE campaign_id = '{campaign_id}';")

    alloc_vals = []
    for idx, a in enumerate(allocs, start=1):
        aid = gen_uuid(f"2026-alloc-{idx}-{a['brand']}-{a['code']}-{a['country']}")
        alloc_vals.append(f"""(
            '{aid}', '{campaign_id}', {escape_sql(a['brand'])}, {escape_sql(a['code'])},
            {escape_sql(a['title'])}, {escape_sql(a['level'])}, {escape_sql(a['country'])},
            {a['allocated_seats']}, NOW(), NOW()
        )""")

    # Insérer par lots de 150 pour éviter les limites de taille de requête
    batch_size = 150
    for i in range(0, len(alloc_vals), batch_size):
        chunk = alloc_vals[i:i+batch_size]
        sql_alloc = f"""
        INSERT INTO campaigns_courseallocation (
            id, campaign_id, brand, code, title, level, country, allocated_seats, created_at, updated_at
        ) VALUES {', '.join(chunk)};
        """
        execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", sql_alloc)

    print(f"  -> {len(alloc_vals)} attributions de modules par filiale insérées dans campaigns_courseallocation.")


def step5_ingest_planned_sessions():
    print("\n--- [5/6] Ingestion des 180 Sessions Planifiées 2026 (Consolidées avec priorité Suzuki Août) ---")
    sessions_file = os.path.join(DATA_DIR, "planned_sessions_2026.json")
    with open(sessions_file, "r", encoding="utf-8") as f:
        sessions = json.load(f)

    session_vals = []
    for s in sessions:
        sid = gen_uuid(f"2026-session-{s['session_index']}")
        d_deb = escape_sql(s['start_date']) if s['start_date'] else "NULL"
        d_fin = escape_sql(s['end_date']) if s['end_date'] else "NULL"
        duree = s['duration_days'] if s['duration_days'] is not None else "NULL"

        session_vals.append(f"""(
            '{sid}', {s['session_index']}, 2026, {escape_sql(s['pole'])}, {escape_sql(s['brand'])},
            {escape_sql(s['code'])}, {escape_sql(s['title'])}, {escape_sql(s['training_type'])},
            {escape_sql(s['location'])}, {d_deb}, {d_fin}, {duree}, {escape_sql(s['trainer'])},
            {escape_sql(s['client_scope'])}, {escape_sql(s['version_source'])}, {str(s['is_authoritative']).lower()},
            NOW(), NOW()
        )""")

    # 1. Dans needs-db (campaigns_trainingsession)
    sql_needs_sessions = f"""
    INSERT INTO campaigns_trainingsession (
        id, session_index, year, pole, brand, code, title, training_type, location,
        start_date, end_date, duration_days, trainer, client_scope, version_source,
        is_authoritative, created_at, updated_at
    ) VALUES {', '.join(session_vals)}
    ON CONFLICT (year, session_index) DO UPDATE SET
        pole = EXCLUDED.pole,
        brand = EXCLUDED.brand,
        code = EXCLUDED.code,
        title = EXCLUDED.title,
        training_type = EXCLUDED.training_type,
        location = EXCLUDED.location,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        duration_days = EXCLUDED.duration_days,
        trainer = EXCLUDED.trainer,
        client_scope = EXCLUDED.client_scope,
        version_source = EXCLUDED.version_source,
        is_authoritative = EXCLUDED.is_authoritative,
        updated_at = NOW();
    """
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", sql_needs_sessions)
    print("  -> 180 sessions enregistrées dans cfao-needs-needs-db-1 (campaigns_trainingsession).")

    # 2. Dans ops-db (training_session)
    ops_session_vals = []
    for s in sessions:
        sid = gen_uuid(f"2026-session-{s['session_index']}")
        d_deb = escape_sql(s['start_date']) if s['start_date'] else "NULL"
        d_fin = escape_sql(s['end_date']) if s['end_date'] else "NULL"
        duree = s['duration_days'] if s['duration_days'] is not None else "NULL"

        ops_session_vals.append(f"""(
            '{sid}', {s['session_index']}, 2026, {escape_sql(s['pole'])}, {escape_sql(s['brand'])},
            {escape_sql(s['code'])}, {escape_sql(s['title'])}, {escape_sql(s['training_type'])},
            {escape_sql(s['location'])}, {d_deb}, {d_fin}, {duree}, {escape_sql(s['trainer'])},
            {escape_sql(s['client_scope'])}, {escape_sql(s['version_source'])}, {str(s['is_authoritative']).lower()},
            'PLANNED', NOW(), NOW()
        )""")

    sql_ops_sessions = f"""
    INSERT INTO training_session (
        id, session_index, year, pole, brand, code, title, training_type, location,
        start_date, end_date, duration_days, trainer, client_scope, version_source,
        is_authoritative, status, created_at, updated_at
    ) VALUES {', '.join(ops_session_vals)}
    ON CONFLICT (year, session_index) DO UPDATE SET
        pole = EXCLUDED.pole,
        brand = EXCLUDED.brand,
        code = EXCLUDED.code,
        title = EXCLUDED.title,
        training_type = EXCLUDED.training_type,
        location = EXCLUDED.location,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        duration_days = EXCLUDED.duration_days,
        trainer = EXCLUDED.trainer,
        client_scope = EXCLUDED.client_scope,
        version_source = EXCLUDED.version_source,
        is_authoritative = EXCLUDED.is_authoritative,
        updated_at = NOW();
    """
    execute_sql_in_container("cfaoacademy-ops-db-1", "ops", "ops", sql_ops_sessions)
    print("  -> 180 sessions enregistrées dans cfaoacademy-ops-db-1 (training_session).")


def step6_ingest_themathiques_non_choisies():
    print("\n--- [6/6] Ingestion des 42 Thématiques Non Choisies dans needs-db ---")
    nc_file = os.path.join(DATA_DIR, "themathiques_non_choisies_2026.json")
    with open(nc_file, "r", encoding="utf-8") as f:
        non_choisies = json.load(f)

    # Réinitialiser pour éviter doublons
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", "DELETE FROM campaigns_coursenonchoisie WHERE year = 2026;")

    nc_vals = []
    for nc in non_choisies:
        nc_id = gen_uuid(f"2026-nc-{nc['brand']}-{nc['code']}")
        nc_vals.append(f"""(
            '{nc_id}', 2026, {escape_sql(nc['bu'])}, {escape_sql(nc['brand'])},
            {escape_sql(nc['level'])}, {escape_sql(nc['code'])}, {escape_sql(nc['title'])},
            {escape_sql(nc['status'])}, {escape_sql(nc['source_file'])}, NOW()
        )""")

    sql_nc = f"""
    INSERT INTO campaigns_coursenonchoisie (
        id, year, bu, brand, level, code, title, status, source_file, created_at
    ) VALUES {', '.join(nc_vals)};
    """
    execute_sql_in_container("cfao-needs-needs-db-1", "needs", "needs", sql_nc)
    print(f"  -> {len(nc_vals)} modules non retenus enregistrés dans campaigns_coursenonchoisie.")


def verify_database_state():
    print("\n" + "=" * 70)
    print("VÉRIFICATION ET STATISTIQUES FINALES DANS LES BASES DE DONNÉES")
    print("=" * 70)

    # 1. Vérification Campagnes dans needs-db
    res_camp = execute_sql_in_container(
        "cfao-needs-needs-db-1", "needs", "needs",
        "SELECT year, label, status FROM campaigns_campaign ORDER BY year DESC;"
    )
    print("[needs-db] Campagnes :")
    print(res_camp.strip())

    # 2. Vérification Sessions par Marque dans needs-db
    res_sess = execute_sql_in_container(
        "cfao-needs-needs-db-1", "needs", "needs",
        """
        SELECT brand, count(*) as sessions_count, 
               min(start_date) as premiere_session, max(end_date) as derniere_session
        FROM campaigns_trainingsession 
        WHERE year = 2026
        GROUP BY brand 
        ORDER BY sessions_count DESC LIMIT 10;
        """
    )
    print("\n[needs-db] Top marques en nombre de sessions 2026 :")
    print(res_sess.strip())

    # 3. Vérification de la règle Suzuki Août
    res_suz = execute_sql_in_container(
        "cfao-needs-needs-db-1", "needs", "needs",
        """
        SELECT brand, version_source, count(*) 
        FROM campaigns_trainingsession 
        WHERE brand = 'Suzuki' 
        GROUP BY brand, version_source;
        """
    )
    print("\n[needs-db] Contrôle d'autorité des sessions Suzuki :")
    print(res_suz.strip())

    # 4. Vérification Quotas par Pays (Clé de répartition)
    res_quotas = execute_sql_in_container(
        "cfao-needs-needs-db-1", "needs", "needs",
        """
        SELECT country, sum(total_branch_techs) as techs, sum(requested_needs) as besoins, sum(allocated_seats) as attribues
        FROM campaigns_branchbrandquota
        GROUP BY country
        ORDER BY attribues DESC LIMIT 8;
        """
    )
    print("\n[needs-db] Top pays par attributions (Clé de répartition) :")
    print(res_quotas.strip())

    # 5. Vérification Core LMS Courses
    res_core = execute_sql_in_container(
        "cfaoacademy-core-db-1", "core", "core",
        "SELECT count(*) as total_courses_lms FROM lms_course;"
    )
    print("\n[core-db] Nombre total de cours LMS :")
    print(res_core.strip())

    # 6. Vérification Ops Sessions
    res_ops = execute_sql_in_container(
        "cfaoacademy-ops-db-1", "ops", "ops",
        "SELECT count(*) as total_sessions_ops FROM training_session;"
    )
    print("\n[ops-db] Nombre total de sessions opérationnelles :")
    print(res_ops.strip())


def main():
    print("=" * 70)
    print("INGESTION NORMALISÉE DES DONNÉES EN BASES POSTGRESQL (CFAO ACADEMY)")
    print("=" * 70)
    
    step1_init_tables()
    campaign_id = step2_ingest_campaign_and_brands()
    step3_ingest_catalog_lines(campaign_id)
    step4_ingest_quotas_and_allocations(campaign_id)
    step5_ingest_planned_sessions()
    step6_ingest_themathiques_non_choisies()
    verify_database_state()

    print("\n" + "=" * 70)
    print("INGESTION TERMINÉE AVEC SUCCÈS SUR TOUS LES SERVICES !")
    print("=" * 70)


if __name__ == "__main__":
    main()
