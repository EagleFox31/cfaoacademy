// Schema de ops-db, en migrations numerotees appliquees au demarrage.
// Une migration publiee ne se modifie plus : on en ajoute une nouvelle.
import type { Queryable } from './pool.js'

export const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    // Story 04-5.2 : brouillons des rapports formateur (auparavant en SQLite dans le service de rendu).
    // Le contenu est le document JSON de l'assistant, opaque pour le service.
    // `modifie_le` garde la date ISO du navigateur : la version la plus recente l'emporte,
    // comparee comme chaine (format constant AAAA-MM-JJTHH:MM:SS.mmmZ).
    id: '001_rapports_formateur',
    sql: `
      CREATE TABLE IF NOT EXISTS trainer_report_drafts (
        owner_id   TEXT   NOT NULL,
        id         TEXT   NOT NULL,
        org_path   TEXT[] NOT NULL DEFAULT '{}',
        contenu    JSONB  NOT NULL,
        modifie_le TEXT   NOT NULL,
        PRIMARY KEY (owner_id, id)
      );
      -- Les suppressions sont gardees : sans elles, un poste qui a encore une copie
      -- du brouillon le ferait revenir a sa prochaine synchronisation.
      CREATE TABLE IF NOT EXISTS trainer_report_deletions (
        owner_id TEXT NOT NULL,
        id       TEXT NOT NULL,
        le       TEXT NOT NULL,
        PRIMARY KEY (owner_id, id)
      );`,
  },
]

export async function migrer(db: Queryable): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY, applique_le TIMESTAMPTZ NOT NULL DEFAULT now())`)
  const faites = new Set((await db.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map(r => r.id))
  const appliquees: string[] = []
  for (const m of MIGRATIONS) {
    if (faites.has(m.id)) continue
    await db.query(m.sql)
    await db.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id])
    appliquees.push(m.id)
  }
  return appliquees
}
