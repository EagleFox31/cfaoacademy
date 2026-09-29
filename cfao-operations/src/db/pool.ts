// Connexion a ops-db (PostgreSQL). Une seule reserve de connexions pour le service ;
// les tests la remplacent par une base en memoire (pg-mem) via `setPool`.
import pg from 'pg'
import { config } from '../config/index.js'

export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string, values?: unknown[]): Promise<pg.QueryResult<R>>
}

let pool: Queryable | null = null

export function getPool(): Queryable {
  if (!pool) pool = new pg.Pool(config.db)
  return pool
}

export function setPool(p: Queryable): void {
  pool = p
}
