// Importe dans ops-db les brouillons exportes de l'ancien stockage SQLite
// (services/apercu/exporter_brouillons.py). Story 04-5.2.
//
// Les brouillons etaient ranges sous le compte de demonstration (`u10`) ; ils
// passent sous le sub Keycloak du formateur, avec son perimetre :
//
//   node dist/scripts/importer-brouillons.js brouillons.json \
//     --compte "u10=<sub Keycloak>@groupe,groupe.cmr,groupe.cmr.douala"
//
// Un compte sans correspondance est ignore (et signale). La regle « la version la
// plus recente l'emporte » s'applique : relancer l'import ne duplique rien.
import { readFileSync } from 'node:fs'
import { getPool } from '../db/pool.js'
import { migrer } from '../db/migrations.js'
import * as repo from '../modules/reports/repo.js'

export interface Export {
  brouillons: Array<{ compte: string; id: string; contenu: repo.Contenu; modifieLe: string }>
  supprimes: Array<{ compte: string; id: string; le: string }>
}

export type Comptes = Record<string, { sub: string; orgPath: string[] }>

export function lireComptes(args: string[]): Comptes {
  const comptes: Comptes = {}
  args.forEach((a, i) => {
    if (a !== '--compte') return
    const m = /^([^=]+)=([^@]+)@(.*)$/.exec(args[i + 1] ?? '')
    if (!m) throw new Error(`--compte attendu sous la forme ancien=sub@noeud,noeud : ${args[i + 1]}`)
    comptes[m[1]] = { sub: m[2], orgPath: m[3].split(',').filter(Boolean) }
  })
  return comptes
}

export async function importer(donnees: Export, comptes: Comptes) {
  const bilan = { ecrits: 0, gardes: 0, supprimes: 0, ignores: [] as string[] }
  for (const b of donnees.brouillons) {
    const c = comptes[b.compte]
    if (!c) { bilan.ignores.push(`${b.compte}/${b.id}`); continue }
    // Les photos etaient servies sous /cr-donnees/photos : elles le sont sous /apercu/photos.
    const contenu = JSON.parse(JSON.stringify(b.contenu).replaceAll('/cr-donnees/photos/', '/apercu/photos/'))
    const { ecrit } = await repo.ecrire(c.sub, c.orgPath, b.id, { ...contenu, modifieLe: b.modifieLe })
    if (ecrit) bilan.ecrits += 1
    else bilan.gardes += 1
  }
  for (const s of donnees.supprimes) {
    const c = comptes[s.compte]
    if (!c) { bilan.ignores.push(`${s.compte}/${s.id} (suppression)`); continue }
    await getPool().query(
      `INSERT INTO trainer_report_deletions (owner_id, id, le) VALUES ($1, $2, $3)
       ON CONFLICT (owner_id, id) DO UPDATE SET le = CASE
         WHEN EXCLUDED.le > trainer_report_deletions.le THEN EXCLUDED.le ELSE trainer_report_deletions.le END`,
      [c.sub, s.id, s.le])
    bilan.supprimes += 1
  }
  return bilan
}

if (process.argv[1]?.endsWith('importer-brouillons.js') || process.argv[1]?.endsWith('importer-brouillons.ts')) {
  const [fichier, ...reste] = process.argv.slice(2)
  if (!fichier) throw new Error('fichier JSON attendu (sortie de exporter_brouillons.py)')
  await migrer(getPool())
  const bilan = await importer(JSON.parse(readFileSync(fichier, 'utf-8')), lireComptes(reste))
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(bilan, null, 1))
  process.exit(0)
}
