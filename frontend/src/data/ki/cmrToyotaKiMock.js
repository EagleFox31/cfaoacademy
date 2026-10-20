/** Scope filiale Toyota Cameroun — données mock pour le portail KI André YOGBA. */

export const CMR_TOYOTA_KI_SCOPE = {
  instructorBrand: 'toyota',
  filiale: 'CFAO MOTORS Cameroun',
  subsidiary: 'cmr-motors',
  department: 'motors',
}

const TECHNICIANS = [
  {
    id: 'cm-toy-001',
    name: 'Samuel NDJOCK',
    username: 'sa41nd',
    agency: 'Douala',
    assignedBrands: ['toyota'],
    primaryTier: 'junior',
    byBrand: { toyota: 4 },
    total: 4,
    pifCodes: ['TS08-G3', 'TS10-G3', 'TS11-G3', 'TS13-G3'],
    codesByBrand: { toyota: ['TS08-G3', 'TS10-G3', 'TS11-G3', 'TS13-G3'] },
  },
  {
    id: 'cm-toy-002',
    name: 'Grace ESSOMBA',
    username: 'gr52es',
    agency: 'Douala',
    assignedBrands: ['toyota'],
    primaryTier: 'senior',
    byBrand: { toyota: 3 },
    total: 3,
    pifCodes: ['TS08-G2', 'TS10-G2', 'TS14-G2'],
    codesByBrand: { toyota: ['TS08-G2', 'TS10-G2', 'TS14-G2'] },
  },
  {
    id: 'cm-toy-003',
    name: 'Jean-Pierre MBALLA',
    username: 'jp38mb',
    agency: 'Yaoundé',
    assignedBrands: ['toyota'],
    primaryTier: 'senior',
    byBrand: { toyota: 5 },
    total: 5,
    pifCodes: ['TS08-G2', 'TS09-G2', 'TS10-G2', 'TS11-G2', 'TS12-G2'],
    codesByBrand: { toyota: ['TS08-G2', 'TS09-G2', 'TS10-G2', 'TS11-G2', 'TS12-G2'] },
  },
  {
    id: 'cm-toy-004',
    name: 'Clarisse TCHOUAPI',
    username: 'cl44tc',
    agency: 'Douala',
    assignedBrands: ['toyota'],
    primaryTier: 'junior',
    byBrand: { toyota: 3 },
    total: 3,
    pifCodes: ['TS08-G3', 'TS10-G3', 'TS11-G3'],
    codesByBrand: { toyota: ['TS08-G3', 'TS10-G3', 'TS11-G3'] },
  },
  {
    id: 'cm-toy-005',
    name: 'Eric FOTSO',
    username: 'er39fo',
    agency: 'Bafoussam',
    assignedBrands: ['toyota'],
    primaryTier: 'expert',
    byBrand: { toyota: 2 },
    total: 2,
    pifCodes: ['TS15-G1', 'TS16-G1'],
    codesByBrand: { toyota: ['TS15-G1', 'TS16-G1'] },
  },
  {
    id: 'cm-toy-006',
    name: 'Marie TCHOKOU',
    username: 'ma47tc',
    agency: 'Garoua',
    assignedBrands: ['toyota'],
    primaryTier: 'junior',
    byBrand: { toyota: 4 },
    total: 4,
    pifCodes: ['TS08-G3', 'TS09-G3', 'TS10-G3', 'TS11-G3'],
    codesByBrand: { toyota: ['TS08-G3', 'TS09-G3', 'TS10-G3', 'TS11-G3'] },
  },
  {
    id: 'cm-toy-007',
    name: 'Paul ATANGANA',
    username: 'pa51at',
    agency: 'Yaoundé',
    assignedBrands: ['toyota'],
    primaryTier: 'senior',
    byBrand: { toyota: 3 },
    total: 3,
    pifCodes: ['TS08-G2', 'TS10-G2', 'TS12-G2'],
    codesByBrand: { toyota: ['TS08-G2', 'TS10-G2', 'TS12-G2'] },
  },
  {
    id: 'cm-toy-008',
    name: 'Sylvie KAMGA',
    username: 'sy43ka',
    agency: 'Douala',
    assignedBrands: ['toyota'],
    primaryTier: 'junior',
    byBrand: { toyota: 2 },
    total: 2,
    pifCodes: ['TS08-G3', 'TS10-G3'],
    codesByBrand: { toyota: ['TS08-G3', 'TS10-G3'] },
  },
]

function gfEval(userIdHex, name, tier, theory, practical) {
  const brand = 'toyota'
  return [
    {
      id: `medacap-gf-${userIdHex}-${brand}-${tier}-t`,
      kind: 'competency',
      competencyTier: tier,
      modality: 'theory',
      brand,
      brands: [brand],
      collaboratorName: name,
      agency: TECHNICIANS.find(t => t.name === name)?.agency ?? 'Douala',
      status: 'done',
      score: theory,
      scoreSource: 'gf',
    },
    {
      id: `medacap-gf-${userIdHex}-${brand}-${tier}-p`,
      kind: 'competency',
      competencyTier: tier,
      modality: 'practical',
      brand,
      brands: [brand],
      collaboratorName: name,
      agency: TECHNICIANS.find(t => t.name === name)?.agency ?? 'Douala',
      status: 'done',
      score: practical,
      scoreSource: 'gf',
    },
  ]
}

const COLLABORATOR_EVALUATIONS = [
  ...gfEval('cm-toy-001', 'Samuel NDJOCK', 'junior', 72, 68),
  ...gfEval('cm-toy-002', 'Grace ESSOMBA', 'senior', 81, 79),
  ...gfEval('cm-toy-003', 'Jean-Pierre MBALLA', 'senior', 76, 74),
  ...gfEval('cm-toy-004', 'Clarisse TCHOUAPI', 'junior', 69, 65),
  ...gfEval('cm-toy-005', 'Eric FOTSO', 'expert', 88, 85),
  ...gfEval('cm-toy-006', 'Marie TCHOKOU', 'junior', 74, 70),
  ...gfEval('cm-toy-007', 'Paul ATANGANA', 'senior', 78, 75),
  ...gfEval('cm-toy-008', 'Sylvie KAMGA', 'junior', 71, 67),
]

export const CMR_TOYOTA_KI_FILIALE = {
  kiScope: CMR_TOYOTA_KI_SCOPE,
  filialeBrands: ['toyota'],
  brandStats: [{
    brand: 'toyota',
    technicians: 24,
    evaluated: 18,
    avgScore: 76,
    pifProposed: 42,
    pifValidated: 28,
    tiers: {
      junior: { evaluated: 10, avgScore: 71 },
      senior: { evaluated: 6, avgScore: 78 },
      expert: { evaluated: 2, avgScore: 86 },
    },
  }],
  brandPifStats: [{
    brand: 'toyota',
    pifProposed: 42,
    pifValidated: 28,
  }],
  pifTechnicians: TECHNICIANS,
  collaboratorEvaluations: COLLABORATOR_EVALUATIONS,
  technicians: TECHNICIANS.map(row => ({
    id: row.id,
    name: row.name,
    username: row.username,
    agency: row.agency,
    brands: row.assignedBrands,
    primaryTier: row.primaryTier,
  })),
  brandPlanningSummary: {
    toyota: { total: 42, done: 28, byYear: { '2026': { total: 18, done: 6 } } },
  },
  planningStatus: {
    '2026-06-16|TS10-G3': 'inscrit',
    '2026-07-07|TS11-G3': 'a_inscrire',
    '2026-05-20|TS10-G2': 'en_cours',
    '2026-06-09|TS08-G2': 'fait',
    '2026-04-14|TS08-G3': 'fait',
    '2026-03-10|TS15-G1': 'fait',
  },
}

/** @deprecated Prototype KI-Gemini uniquement — le portail KI principal utilise l'API MEDACAP. */
export function mergeKiScopeWithLms(personalLms, user) {
  if (!personalLms) return personalLms
  const instructorBrand = user?.instructorBrands?.[0] ?? CMR_TOYOTA_KI_SCOPE.instructorBrand
  return {
    ...personalLms,
    ...CMR_TOYOTA_KI_FILIALE,
    kiScope: {
      ...CMR_TOYOTA_KI_SCOPE,
      instructorBrand,
    },
    formationsADispenser: personalLms.formationsADispenser ?? CMR_TOYOTA_KI_FILIALE.formationsADispenser,
    apprenants: personalLms.apprenants ?? CMR_TOYOTA_KI_FILIALE.apprenants,
    kiResults: personalLms.kiResults ?? CMR_TOYOTA_KI_FILIALE.kiResults,
  }
}
