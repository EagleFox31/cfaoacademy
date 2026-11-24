// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { needsStatus } from './costKeyViews'

describe('needsStatus', () => {
  it('copie datée : besoins affichés, date donnée', () => {
    const at = '2026-11-10T08:00:00+00:00'
    expect(needsStatus({ needs_source: 'quota_import', warnings: [{ code: 'needs_snapshot_stale', value: at }] }))
      .toEqual({ missing: false, staleAt: at })
  })

  it('besoins absents ou libellé inconnu : couverture vide', () => {
    expect(needsStatus({ needs_source: 'none', warnings: [{ code: 'needs_unavailable' }] }).missing).toBe(true)
    expect(needsStatus({ needs_source: 'quota_import', warnings: [{ code: 'unknown_country', value: 'X' }] }).missing)
      .toBe(true)
  })

  it('besoins frais : aucun bandeau', () => {
    expect(needsStatus({ needs_source: 'quota_import', warnings: [] })).toEqual({ missing: false, staleAt: null })
  })
})
