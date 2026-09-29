import { describe, expect, it } from 'vitest'
import { clauseDuPlan, PlanNonTraduisible } from '../src/lib/plan.js'

const COLONNES = { ownerId: { colonne: 'owner_id' }, orgPath: { colonne: 'org_path', tableau: true } }
const v = (variable: string) => ({ variable })
const val = (value: unknown) => ({ value })
const ex = (operator: string, ...operands: object[]) => ({ expression: { operator, operands } })

describe('clauseDuPlan', () => {
  it('traduit les plans toujours autorises ou refuses', () => {
    expect(clauseDuPlan({ kind: 'KIND_ALWAYS_ALLOWED' }, COLONNES).sql).toBe('TRUE')
    expect(clauseDuPlan({ kind: 'KIND_ALWAYS_DENIED' }, COLONNES).sql).toBe('FALSE')
  })

  it('traduit la regle du proprietaire en parametre, jamais en texte', () => {
    const c = clauseDuPlan({
      kind: 'KIND_CONDITIONAL',
      condition: ex('eq', v('request.resource.attr.ownerId'), val("t_a' OR 1=1")),
    }, COLONNES)
    expect(c).toEqual({ sql: '(owner_id = $1)', values: ["t_a' OR 1=1"] })
  })

  it('deroule exists sur les perimetres du principal', () => {
    const c = clauseDuPlan({
      kind: 'KIND_CONDITIONAL',
      condition: ex('or',
        ex('eq', v('request.resource.attr.ownerId'), val('d_1')),
        ex('exists', val(['groupe.cmr', 'groupe.gab']),
          ex('lambda', ex('in', v('s'), v('request.resource.attr.orgPath')), v('s')))),
    }, COLONNES, 3)
    expect(c.sql).toBe('((owner_id = $3) OR (($4 = ANY(org_path)) OR ($5 = ANY(org_path))))')
    expect(c.values).toEqual(['d_1', 'groupe.cmr', 'groupe.gab'])
  })

  it('traduit in sur une liste connue', () => {
    const c = clauseDuPlan({
      kind: 'KIND_CONDITIONAL',
      condition: ex('in', val('groupe.cmr'), v('request.resource.attr.orgPath')),
    }, COLONNES)
    expect(c.sql).toBe('($1 = ANY(org_path))')
  })

  it('refuse un operateur ou un attribut inconnu (fail-closed)', () => {
    expect(() => clauseDuPlan({ kind: 'KIND_CONDITIONAL', condition: ex('lt', v('request.resource.attr.ownerId'), val(1)) }, COLONNES))
      .toThrow(PlanNonTraduisible)
    expect(() => clauseDuPlan({ kind: 'KIND_CONDITIONAL', condition: ex('eq', v('request.resource.attr.brand'), val('x')) }, COLONNES))
      .toThrow(PlanNonTraduisible)
  })
})
