const TIER_KEYS = ['junior', 'senior', 'expert']

function tierHasCompetencyData(tier) {
  if (!tier) return false
  return tier.avgScore != null || (tier.evaluated ?? 0) > 0
}

/** Fusionne paliers live + mock — mock utilisé si le live n’a pas de scores palier. */
function mergeBrandStatTiers(liveTiers = {}, mockTiers = {}) {
  const tiers = {}
  for (const key of TIER_KEYS) {
    const live = liveTiers[key]
    const mock = mockTiers[key]
    const useLive = tierHasCompetencyData(live)
    const useMock = !useLive && tierHasCompetencyData(mock)
    if (!useLive && !useMock) continue
    tiers[key] = {
      evaluated: useLive ? (live.evaluated ?? 0) : (mock?.evaluated ?? 0),
      avgScore: useLive ? live.avgScore : mock?.avgScore ?? null,
    }
  }
  return tiers
}

function mergeBrandStatRow(live, mock = {}) {
  const hasLiveGlobal = (live.evaluated ?? 0) > 0 || live.avgScore != null
  const tiers = mergeBrandStatTiers(live.tiers, mock.tiers)
  const hasTierData = Object.keys(tiers).length > 0

  return {
    ...mock,
    ...live,
    technicians: live.technicians ?? mock.technicians ?? 0,
    avgScore: hasLiveGlobal ? live.avgScore : (mock.avgScore ?? live.avgScore ?? null),
    evaluated: hasLiveGlobal ? live.evaluated : (mock.evaluated ?? live.evaluated ?? 0),
    tiers: hasTierData ? tiers : (mock.tiers ?? live.tiers ?? {}),
    pifProposed: live.pifProposed ?? mock.pifProposed ?? 0,
    pifValidated: live.pifValidated ?? mock.pifValidated ?? 0,
  }
}

/** Marques Mongo MEDACAP → slugs portail (miroir bootstrap.php). */
export const MEDACAP_BRAND_TO_SLUG = {
  'RENAULT TRUCK': 'renault-trucks',
  'RENAULT TRUCKS': 'renault-trucks',
  'KING LONG': 'king-long',
  'TOYOTA FORKLIFT': 'toyota-forklift',
  'TOYOTA BT': 'bt',
  'TOYOTA MATERIAL': 'toyota-forklift',
  HINO: 'hino',
  SINOTRUK: 'sinotruk',
  FUSO: 'fuso',
  JCB: 'jcb',
  LOVOL: 'lovol',
  SHACMAN: 'shacman',
  TOYOTA: 'toyota',
}

export function medacapBrandToSlug(name) {
  const upper = String(name ?? '').trim().toUpperCase()
  if (MEDACAP_BRAND_TO_SLUG[upper]) return MEDACAP_BRAND_TO_SLUG[upper]
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function brandsFromEvaluation(entry) {
  if (entry.brands?.length) return entry.brands
  if (entry.brand) return [entry.brand]
  return []
}

function isGfBrandEvaluation(entry) {
  if (entry?.scoreSource === 'technicianBrandScores' || entry?.scoreSource === 'gf') return true
  return String(entry?.id ?? '').startsWith('medacap-gf-')
}

function isLegacyMultiBrandEvaluation(entry) {
  if (entry?.kind !== 'competency') return false
  if (isGfBrandEvaluation(entry)) return false
  const brands = brandsFromEvaluation(entry)
  return brands.length > 1 && String(entry?.id ?? '').startsWith('medacap-')
}

/**
 * Retire les évaluations « test entier × toutes les marques » lorsque des scores GF par marque existent.
 */
export function sanitizeCollaboratorEvaluations(evaluations) {
  const rows = evaluations ?? []
  const gfSlotKeys = new Set()

  for (const entry of rows) {
    if (!isGfBrandEvaluation(entry)) continue
    const name = String(entry.collaboratorName ?? '').trim().toLowerCase()
    if (!name) continue
    const tier = entry.competencyTier ?? 'junior'
    const modality = entry.modality ?? 'theory'
    for (const brand of brandsFromEvaluation(entry)) {
      gfSlotKeys.add(`${name}|${tier}|${modality}|${brand}`)
    }
  }

  if (!gfSlotKeys.size) return rows

  return rows.filter(entry => {
    if (isLegacyMultiBrandEvaluation(entry)) return false

    if (!isGfBrandEvaluation(entry) && String(entry?.id ?? '').startsWith('medacap-')) {
      const name = String(entry.collaboratorName ?? '').trim().toLowerCase()
      const tier = entry.competencyTier ?? 'junior'
      const modality = entry.modality ?? 'theory'
      for (const brand of brandsFromEvaluation(entry)) {
        if (gfSlotKeys.has(`${name}|${tier}|${modality}|${brand}`)) return false
      }
    }

    return true
  })
}

/** Clé stable — fusion mock/live par technicien × marque × palier × modalité. */
function collaboratorEvaluationMergeKey(entry) {
  const brands = brandsFromEvaluation(entry).slice().sort().join(',')
  const name = String(entry.collaboratorName ?? entry.medacap?.userId ?? entry.id ?? '')
    .trim()
    .toLowerCase()
  const tier = entry.competencyTier ?? 'junior'
  const modality = entry.modality ?? 'theory'
  const kind = entry.kind ?? 'competency'
  return `${kind}|${name}|${brands}|${tier}|${modality}`
}

/** Complète les évaluations live avec le mock local (technicien par technicien). */
function mergeCollaboratorEvaluations(scopeEvals, mockEvals) {
  const live = scopeEvals ?? []
  const mock = mockEvals ?? []
  if (!live.length) return mock
  if (!mock.length) return live

  const liveKeys = new Set(live.map(collaboratorEvaluationMergeKey))
  const supplemental = mock.filter(entry => !liveKeys.has(collaboratorEvaluationMergeKey(entry)))
  const merged = supplemental.length ? [...live, ...supplemental] : live
  return sanitizeCollaboratorEvaluations(merged)
}

/**
 * Fusionne le périmètre live (marques ≥ 1 technicien) avec le mock KPI/PIF.
 */
export function mergeDpsScopeWithMock(scope, mockLms) {
  if (!scope?.brands?.length || !mockLms) {
    return mockLms
  }

  const mockByBrand = Object.fromEntries(
    (mockLms.brandStats ?? []).map(b => [b.brand, b]),
  )

  const pifByBrand = Object.fromEntries(
    (scope.brandPifStats ?? []).map(b => [b.brand, b]),
  )

  const livePlanningStatus = scope.planningStatus && Object.keys(scope.planningStatus).length
    ? scope.planningStatus
    : null

  const brandStats = scope.brandStats?.length
    ? scope.brandStats.map(live => mergeBrandStatRow(live, {
      ...mockByBrand[live.brand],
      pifProposed: pifByBrand[live.brand]?.pifProposed ?? mockByBrand[live.brand]?.pifProposed,
      pifValidated: pifByBrand[live.brand]?.pifValidated ?? mockByBrand[live.brand]?.pifValidated,
    }))
    : scope.brands.map(b => {
      const mock = mockByBrand[b.slug] ?? {}
      return mergeBrandStatRow({
        brand: b.slug,
        technicians: b.technicians,
        avgScore: null,
        evaluated: 0,
        pifProposed: pifByBrand[b.slug]?.pifProposed ?? 0,
        pifValidated: pifByBrand[b.slug]?.pifValidated ?? 0,
        tiers: {},
      }, mock)
    })

  const liveBrandIds = new Set(brandStats.map(row => row.brand))
  for (const mock of mockLms.brandStats ?? []) {
    if (liveBrandIds.has(mock.brand)) continue
    brandStats.push({
      ...mock,
      pifProposed: pifByBrand[mock.brand]?.pifProposed ?? mock.pifProposed ?? 0,
      pifValidated: pifByBrand[mock.brand]?.pifValidated ?? mock.pifValidated ?? 0,
    })
  }

  const mockAgencyById = Object.fromEntries(
    (mockLms.agencies ?? []).map(a => [a.id, a]),
  )

  const agencies = (scope.agencies ?? []).map(a => {
    const mock = mockAgencyById[a.id] ?? {}
    return {
      id: a.id,
      name: a.name,
      technicians: a.technicians,
      measuredPct: mock.measuredPct ?? 0,
      junior: mock.junior ?? 0,
      senior: mock.senior ?? 0,
      expert: mock.expert ?? 0,
    }
  })

  const tierCounts = (scope.technicians ?? []).reduce((acc, row) => {
    const tier = row.primaryTier ?? 'junior'
    if (acc[tier] != null) acc[tier] += 1
    return acc
  }, { junior: 0, senior: 0, expert: 0 })

  return {
    ...mockLms,
    brandStats,
    agencies,
    technicians: scope.technicians ?? [],
    planningStatus: livePlanningStatus ?? mockLms.planningStatus ?? {},
    brandPlanningSummary: scope.brandPlanningSummary ?? {},
    collaboratorEvaluations: mergeCollaboratorEvaluations(
      scope.collaboratorEvaluations,
      mockLms.collaboratorEvaluations,
    ),
    recentLogs: scope.recentLogs?.length ? scope.recentLogs : mockLms.recentLogs,
    kpis: {
      ...mockLms.kpis,
      totalTechnicians: scope.totalTechnicians ?? mockLms.kpis?.totalTechnicians,
      juniorCount: tierCounts.junior || mockLms.kpis?.juniorCount,
      seniorCount: tierCounts.senior || mockLms.kpis?.seniorCount,
      expertCount: tierCounts.expert || mockLms.kpis?.expertCount,
    },
    filialeBrands: brandStats.map(b => b.brand),
  }
}

export function resolveDpsFilialeBrandIds(lms) {
  if (lms?.filialeBrands?.length) return lms.filialeBrands
  return (lms?.brandStats ?? [])
    .filter(b => (b.technicians ?? 0) > 0)
    .map(b => b.brand)
}

/** Construit un objet LMS portail depuis le scope API — sans mock local. */
export function buildLmsFromDpsScope(scope) {
  if (!scope?.brands?.length) return null

  const pifByBrand = Object.fromEntries(
    (scope.brandPifStats ?? []).map(b => [b.brand, b]),
  )

  const brandStats = scope.brandStats?.length
    ? scope.brandStats.map(live => mergeBrandStatRow(live, {}))
    : scope.brands.map(b => mergeBrandStatRow({
      brand: b.slug,
      technicians: b.technicians,
      avgScore: null,
      evaluated: 0,
      pifProposed: pifByBrand[b.slug]?.pifProposed ?? 0,
      pifValidated: pifByBrand[b.slug]?.pifValidated ?? 0,
      tiers: {},
    }, {}))

  const agencies = (scope.agencies ?? []).map(a => ({
    id: a.id,
    name: a.name,
    technicians: a.technicians,
    measuredPct: 0,
    junior: 0,
    senior: 0,
    expert: 0,
  }))

  const tierCounts = (scope.technicians ?? []).reduce((acc, row) => {
    const tier = row.primaryTier ?? 'junior'
    if (acc[tier] != null) acc[tier] += 1
    return acc
  }, { junior: 0, senior: 0, expert: 0 })

  return {
    brandStats,
    agencies,
    technicians: scope.technicians ?? [],
    planningStatus: scope.planningStatus ?? {},
    brandPlanningSummary: scope.brandPlanningSummary ?? {},
    collaboratorEvaluations: sanitizeCollaboratorEvaluations(scope.collaboratorEvaluations ?? []),
    recentLogs: scope.recentLogs ?? [],
    kpis: {
      totalTechnicians: scope.totalTechnicians ?? 0,
      juniorCount: tierCounts.junior,
      seniorCount: tierCounts.senior,
      expertCount: tierCounts.expert,
    },
    filialeBrands: brandStats.map(b => b.brand),
    pifTechnicians: scope.pifTechnicians ?? scope.technicians ?? [],
    kiScope: scope.kiScope ?? {},
    formationsADispenser: scope.formationsADispenser ?? [],
    brandPifStats: scope.brandPifStats ?? [],
  }
}
