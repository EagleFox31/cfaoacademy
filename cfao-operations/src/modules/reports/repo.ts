// Brouillons des rapports formateur (story 04-5.2) : acces a ops-db.
import { getPool } from '../../db/pool.js'
import type { Clause } from '../../lib/plan.js'

export type Contenu = Record<string, unknown> & { modifieLe?: string }

export interface Brouillon {
  ownerId: string
  id: string
  orgPath: string[]
  contenu: Contenu
}

// Attributs Cerbos de la ressource `trainer_report` -> colonnes.
export const COLONNES = {
  ownerId: { colonne: 'owner_id' },
  orgPath: { colonne: 'org_path', tableau: true },
}

const maintenant = () => new Date().toISOString()

interface Ligne { owner_id: string; id: string; org_path: string[]; contenu: Contenu }
const brouillon = (l: Ligne): Brouillon => ({ ownerId: l.owner_id, id: l.id, orgPath: l.org_path, contenu: l.contenu })

/** Les brouillons visibles (clause du query plan), les plus recents d'abord. */
export async function lister(visibles: Clause, proprietaire?: string): Promise<Brouillon[]> {
  const values = [...visibles.values]
  let sql = `SELECT owner_id, id, org_path, contenu FROM trainer_report_drafts WHERE ${visibles.sql}`
  if (proprietaire) {
    values.push(proprietaire)
    sql += ` AND owner_id = $${values.length}`
  }
  const r = await getPool().query<Ligne>(`${sql} ORDER BY modifie_le DESC`, values)
  return r.rows.map(brouillon)
}

/** Les suppressions d'un proprietaire (id -> date), que chaque poste applique. */
export async function suppressions(proprietaire: string): Promise<Record<string, string>> {
  const r = await getPool().query<{ id: string; le: string }>(
    'SELECT id, le FROM trainer_report_deletions WHERE owner_id = $1', [proprietaire])
  return Object.fromEntries(r.rows.map(l => [l.id, l.le]))
}

export async function lire(proprietaire: string, id: string): Promise<Brouillon | null> {
  const r = await getPool().query<Ligne>(
    'SELECT owner_id, id, org_path, contenu FROM trainer_report_drafts WHERE owner_id = $1 AND id = $2',
    [proprietaire, id])
  return r.rows[0] ? brouillon(r.rows[0]) : null
}

/**
 * Enregistre le brouillon ; la version la plus recente l'emporte.
 *
 * Deux postes ouverts sur le meme rapport : une ecriture plus ancienne que la
 * version gardee est ignoree, et la version gardee est renvoyee pour que
 * l'appelant se remette a jour. Un brouillon supprime apres cette version ne
 * revient pas.
 */
export async function ecrire(
  proprietaire: string, orgPath: string[], id: string, recu: Contenu,
): Promise<{ garde: Contenu | null; ecrit: boolean }> {
  const contenu: Contenu = { ...recu, modifieLe: recu.modifieLe || maintenant() }
  const db = getPool()
  const supprime = await db.query<{ le: string }>(
    'SELECT le FROM trainer_report_deletions WHERE owner_id = $1 AND id = $2', [proprietaire, id])
  if (supprime.rows[0] && supprime.rows[0].le >= contenu.modifieLe!) return { garde: null, ecrit: false }
  await db.query('DELETE FROM trainer_report_deletions WHERE owner_id = $1 AND id = $2', [proprietaire, id])

  const actuel = await lire(proprietaire, id)
  if (actuel && String(actuel.contenu.modifieLe ?? '') > contenu.modifieLe!) {
    return { garde: actuel.contenu, ecrit: false }
  }
  // Le perimetre reste celui de la creation : un brouillon ne change pas de filiale.
  await db.query(
    `INSERT INTO trainer_report_drafts (owner_id, id, org_path, contenu, modifie_le)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (owner_id, id) DO UPDATE SET contenu = EXCLUDED.contenu, modifie_le = EXCLUDED.modifie_le`,
    [proprietaire, id, orgPath, JSON.stringify(contenu), contenu.modifieLe])
  return { garde: contenu, ecrit: true }
}

export async function supprimer(proprietaire: string, id: string): Promise<void> {
  const db = getPool()
  await db.query('DELETE FROM trainer_report_drafts WHERE owner_id = $1 AND id = $2', [proprietaire, id])
  await db.query(
    `INSERT INTO trainer_report_deletions (owner_id, id, le) VALUES ($1, $2, $3)
     ON CONFLICT (owner_id, id) DO UPDATE SET le = EXCLUDED.le`,
    [proprietaire, id, maintenant()])
}
