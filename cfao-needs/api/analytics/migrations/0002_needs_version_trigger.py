"""Trigger qui compte les versions des besoins et remplit l'outbox.

Trigger de contrainte DIFFÉRÉ : il s'exécute au commit, une seule fois par
transaction (garde `analytics.needs_bumped` = txid), après toutes les écritures.
Le verrou de la ligne de version n'est donc pris qu'en fin de transaction : les
versions suivent l'ordre des commits, sans interblocage avec le reste.

Sur UPDATE, seules les colonnes lues par le snapshot comptent (clause WHEN) :
`updated_at`, `last_activity_at` ou un bootstrap rejoué ne créent pas de version.
TRUNCATE n'est pas couvert (aucun code applicatif ne l'utilise).

Postgres seulement : les tests SQLite n'ont ni trigger ni NOTIFY.
"""
from django.db import migrations

CHANNEL = "needs_changed"

# table → colonnes lues par analytics/snapshot.py
WATCHED = {
    "campaigns_needline": ["q1", "q2", "q3", "q4", "postponed", "catalog_line_id", "submission_id"],
    "campaigns_submission": ["status", "country", "campaign_id"],
    "campaigns_catalogline": ["code", "title", "brand_id", "family_id", "level_label", "tier",
                              "sort_order", "campaign_id"],
    "campaigns_branchbrandquota": ["country", "brand", "pole", "requested_needs", "brand_tech_count",
                                   "campaign_id"],
    "campaigns_campaign": ["year"],
    "referential_brand": ["label"],
    "referential_catalogfamily": ["key", "pole"],
}

FUNCTION = f"""
CREATE OR REPLACE FUNCTION analytics_bump_needs_version() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    tx text := txid_current()::text;
    v bigint;
BEGIN
    IF coalesce(current_setting('analytics.needs_bumped', true), '') = tx THEN
        RETURN NULL;
    END IF;
    PERFORM set_config('analytics.needs_bumped', tx, true);
    INSERT INTO analytics_needsstate (id, version, updated_at) VALUES (1, 1, now())
        ON CONFLICT (id) DO UPDATE
        SET version = analytics_needsstate.version + 1, updated_at = now()
        RETURNING version INTO v;
    INSERT INTO analytics_needsoutbox (version, created_at, next_attempt_at, attempts, last_error)
        VALUES (v, now(), now(), 0, '');
    PERFORM pg_notify('{CHANNEL}', v::text);
    RETURN NULL;
END;
$$;
"""


def _row(prefix: str, cols: list[str]) -> str:
    return "(" + ", ".join(f'{prefix}."{c}"' for c in cols) + ")"


def _create(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(FUNCTION)
    for table, cols in WATCHED.items():
        schema_editor.execute(f"""
            CREATE CONSTRAINT TRIGGER {table}_needs_version_rows
            AFTER INSERT OR DELETE ON {table}
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
            EXECUTE FUNCTION analytics_bump_needs_version()""")
        schema_editor.execute(f"""
            CREATE CONSTRAINT TRIGGER {table}_needs_version_update
            AFTER UPDATE ON {table}
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
            WHEN ({_row('OLD', cols)} IS DISTINCT FROM {_row('NEW', cols)})
            EXECUTE FUNCTION analytics_bump_needs_version()""")


def _drop(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in WATCHED:
        schema_editor.execute(f"DROP TRIGGER IF EXISTS {table}_needs_version_rows ON {table}")
        schema_editor.execute(f"DROP TRIGGER IF EXISTS {table}_needs_version_update ON {table}")
    schema_editor.execute("DROP FUNCTION IF EXISTS analytics_bump_needs_version()")


class Migration(migrations.Migration):

    dependencies = [
        ("analytics", "0001_initial"),
        ("campaigns", "0007_needline_postponed"),
        ("referential", "0004_alter_catalogfamily_section"),
    ]

    operations = [migrations.RunPython(_create, _drop)]
