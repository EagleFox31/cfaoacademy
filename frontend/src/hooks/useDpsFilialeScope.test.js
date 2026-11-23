import { describe, expect, it, vi } from 'vitest'

const fallback = vi.fn(lms => ({ ...lms, fromLocalExtraction: true }))
vi.mock('../data/dps/cmrEquipmentPlanning.js', () => ({
  applyCmrEquipmentPifFallback: lms => fallback(lms),
}))

const { resolveDpsLms } = await import('./useDpsFilialeScope.js')
const { applyCmrEquipmentPifFallback } = await vi.importActual('../data/dps/cmrEquipmentPlanning.js')

const MOCK = {
  alerts: [{ id: 'n1' }],
  filialeTickets: [{ id: 't1' }],
  brandStats: [{ brand: 'hino', technicians: 99, avgScore: 88, evaluated: 9, tiers: { junior: { evaluated: 9, avgScore: 88 } } }],
  kpis: { totalTechnicians: 99 },
  collaboratorEvaluations: [{ id: 'mock-1', collaboratorName: 'Fictif' }],
  pifTechnicians: [{ id: 'mock-tech' }],
}

const LIVE = {
  brands: [{ slug: 'jcb', technicians: 3 }],
  brandStats: [{ brand: 'jcb', technicians: 3, avgScore: 61, evaluated: 2, tiers: { junior: { evaluated: 2, avgScore: 61 } } }],
  totalTechnicians: 3,
  technicians: [{ id: 'x', primaryTier: 'junior' }],
  brandPifStats: [{ brand: 'jcb', pifProposed: 4, pifValidated: 1 }],
  collaboratorEvaluations: [],
}

describe('resolveDpsLms : aucun mélange fictif + réel', () => {
  it('live MEDACAP : seules les données live, jamais le mock', () => {
    const lms = resolveDpsLms(LIVE, 'live', MOCK)
    expect(lms.brandStats.map(b => b.brand)).toEqual(['jcb'])
    expect(lms.brandStats[0]).toMatchObject({ technicians: 3, avgScore: 61, pifProposed: 4, pifValidated: 1 })
    expect(lms.kpis.totalTechnicians).toBe(3)
    expect(lms.collaboratorEvaluations).toEqual([])
    expect(lms.pifTechnicians).toEqual(LIVE.technicians)
    expect(fallback).not.toHaveBeenCalled()
  })

  it('live injoignable : LMS vide (« — »), pas de repli sur le mock', () => {
    const lms = resolveDpsLms(null, 'pending', MOCK)
    expect(lms.brandStats).toEqual([])
    expect(lms.technicians).toEqual([])
    expect(lms.kpis.totalTechnicians).toBeNull()
    expect(lms.collaboratorEvaluations).toEqual([])
    expect(lms.pifTechnicians).toEqual([])
  })

  it('garde alertes et tickets de la page (hors compétences)', () => {
    const lms = resolveDpsLms(null, 'pending', MOCK)
    expect(lms.alerts).toEqual(MOCK.alerts)
    expect(lms.filialeTickets).toEqual(MOCK.filialeTickets)
  })

  it('extraction PIF locale seulement si dps-pif.php n’a pas répondu', () => {
    fallback.mockClear()
    resolveDpsLms(LIVE, 'pending', MOCK)
    resolveDpsLms(LIVE, 'live', MOCK)
    expect(fallback).not.toHaveBeenCalled()
    expect(resolveDpsLms(LIVE, 'failed', MOCK).fromLocalExtraction).toBe(true)
  })
})

describe('applyCmrEquipmentPifFallback', () => {
  const extraction = {
    summary: { jcb: { total: 5, done: 2 } },
    pifStats: [{ brand: 'jcb', pifProposed: 7, pifValidated2025: 2 }, { brand: 'lovol', pifProposed: 1 }],
    technicians: [{ id: 't-local' }],
    meta: { planningYear: 2025 },
  }

  it('complète le PIF sans ajouter de marque ni toucher aux scores', () => {
    const lms = { brandStats: [{ brand: 'jcb', technicians: 3, avgScore: 61, pifProposed: 0 }], filialeBrands: ['jcb'] }
    const out = applyCmrEquipmentPifFallback(lms, extraction)
    expect(out.brandStats).toEqual([{ brand: 'jcb', technicians: 3, avgScore: 61, pifProposed: 7, pifValidated: 2 }])
    expect(out.filialeBrands).toEqual(['jcb'])
    expect(out.brandPlanningSummary).toEqual(extraction.summary)
    expect(out.pifTechnicians).toEqual(extraction.technicians)
  })

  it('sans extraction : LMS inchangé', () => {
    const lms = { brandStats: [] }
    expect(applyCmrEquipmentPifFallback(lms, { summary: {} })).toBe(lms)
  })
})
