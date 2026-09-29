// Traduction du query plan Cerbos en clause SQL (architecture.md §5.3, etape 3b).
//
// Cerbos n'a pas d'adaptateur pour node-postgres : on traduit l'arbre de la condition.
// Seuls les operateurs dont on connait la semantique sont traduits ; tout autre
// operateur, ou un attribut sans colonne connue, fait refuser la liste entiere
// (fail-closed) plutot que d'exposer une ressource hors perimetre.
import type { PlanFilter } from './cerbos.js'

interface Operand {
  value?: unknown
  variable?: string
  expression?: { operator: string; operands?: Operand[] }
}

export interface Clause {
  sql: string
  values: unknown[]
}

export class PlanNonTraduisible extends Error {}

const PREFIXE = 'request.resource.attr.'

/**
 * `colonnes` associe un attribut de ressource (`ownerId`) a sa colonne SQL,
 * avec son type : scalaire ou tableau (`TEXT[]`). `depart` est l'indice du
 * premier parametre ($n) disponible.
 */
export function clauseDuPlan(
  filtre: PlanFilter,
  colonnes: Record<string, { colonne: string; tableau?: boolean }>,
  depart = 1,
): Clause {
  if (filtre.kind === 'KIND_ALWAYS_ALLOWED') return { sql: 'TRUE', values: [] }
  if (filtre.kind !== 'KIND_CONDITIONAL') return { sql: 'FALSE', values: [] }
  const values: unknown[] = []
  const param = (v: unknown) => {
    values.push(v)
    return `$${depart + values.length - 1}`
  }

  const colonne = (variable: string) => {
    const attr = variable.startsWith(PREFIXE) ? variable.slice(PREFIXE.length) : null
    const c = attr ? colonnes[attr] : undefined
    if (!c) throw new PlanNonTraduisible(`attribut sans colonne : ${variable}`)
    return c
  }

  // Les variables liees par un lambda (`s` dans exists(s, …)) prennent une valeur connue.
  const traduire = (o: Operand, lies: Record<string, unknown>): string => {
    if (o.variable !== undefined && o.variable in lies) return param(lies[o.variable])
    if (o.variable !== undefined) return colonne(o.variable).colonne
    if (o.expression) return expression(o.expression.operator, o.expression.operands ?? [], lies)
    if ('value' in o) {
      if (typeof o.value === 'boolean') return o.value ? 'TRUE' : 'FALSE'
      return param(o.value)
    }
    throw new PlanNonTraduisible('operande vide')
  }

  const estTableau = (o: Operand, lies: Record<string, unknown>) =>
    o.variable !== undefined && !(o.variable in lies) && o.variable.startsWith(PREFIXE)
    && !!colonnes[o.variable.slice(PREFIXE.length)]?.tableau

  const expression = (op: string, ops: Operand[], lies: Record<string, unknown>): string => {
    switch (op) {
      case 'and':
      case 'or':
        if (!ops.length) throw new PlanNonTraduisible(`${op} sans operande`)
        return `(${ops.map(x => traduire(x, lies)).join(op === 'and' ? ' AND ' : ' OR ')})`
      case 'not':
        return `(NOT ${traduire(ops[0], lies)})`
      case 'eq':
      case 'ne': {
        const [a, b] = ops.map(x => traduire(x, lies))
        return `(${a} ${op === 'eq' ? '=' : '<>'} ${b})`
      }
      case 'in': {
        // x in liste : la liste est soit une colonne tableau, soit une valeur connue.
        const [x, liste] = ops
        if (estTableau(liste, lies)) {
          return `(${traduire(x, lies)} = ANY(${traduire(liste, lies)}))`
        }
        if ('value' in liste && Array.isArray(liste.value)) {
          return `(${traduire(x, lies)} = ANY(${param(liste.value)}))`
        }
        throw new PlanNonTraduisible('in : liste non traduisible')
      }
      case 'exists': {
        // liste_connue.exists(s, corps) : OU du corps pour chaque element.
        const [liste, lambda] = ops
        if (!('value' in liste) || !Array.isArray(liste.value)) {
          throw new PlanNonTraduisible('exists sur une liste inconnue')
        }
        const [corps, lie] = lambda.expression?.operator === 'lambda' ? lambda.expression.operands ?? [] : []
        if (!corps || lie?.variable === undefined) throw new PlanNonTraduisible('exists sans lambda')
        if (!liste.value.length) return 'FALSE'
        return `(${liste.value.map(v => traduire(corps, { ...lies, [lie.variable!]: v })).join(' OR ')})`
      }
      default:
        throw new PlanNonTraduisible(`operateur non traduit : ${op}`)
    }
  }

  const condition = filtre.condition as Operand | undefined
  if (!condition) throw new PlanNonTraduisible('condition absente')
  return { sql: traduire(condition, {}), values }
}
