import elearningToyota from './elearning_toyota.json'

export const PLAN_MODALITIES = ['presentiel', 'distanciel', 'elearning', 'coaching', 'mentoring']

export const ELEARNING_BY_CODE = Object.fromEntries(
  elearningToyota.map(m => [m.code, m])
)

const el = ELEARNING_BY_CODE

function doneModule(id, code, completedDate) {
  return {
    id, brand: 'toyota', code,
    status: 'done', progress: 100, completedDate,
    ...el[code],
  }
}

function doneFormationEvals(code, date, idBase) {
  return [
    {
      id: `${idBase}t`, kind: 'formation', modality: 'theory',
      brand: 'toyota', code, status: 'done', date,
      score: 84, passMark: 70, questions: 32, attempts: 1, feedback: null,
    },
    {
      id: `${idBase}p`, kind: 'formation', modality: 'practical',
      brand: 'toyota', code, status: 'done', date,
      score: 80, passMark: 60, questions: 14, attempts: 1, feedback: null,
    },
  ]
}

/** Statut module LMS → statut carte plan pluri annuel (e-learning : à son rythme, pas « programmé »). */
function moduleStatusToPlanStatus(moduleStatus) {
  if (moduleStatus === 'done') return 'done'
  if (moduleStatus === 'progress') return 'progress'
  return 'todo'
}

/** Catalogue e-learning Toyota → entrées plan (année 2026). */
function buildElearningPlanAssignments(userModules = [], assignedBy = 'Fatou Mbaye') {
  const byCode = Object.fromEntries(userModules.map(m => [m.code, m]))
  return elearningToyota.map(course => ({
    id: `plan-el-${course.code}`,
    brand: course.brand,
    code: course.code,
    title: course.title,
    modality: 'elearning',
    level: course.level,
    year: 2026,
    status: moduleStatusToPlanStatus(byCode[course.code]?.status),
    assignedBy,
  }))
}

const U1_MODULES = [
  doneModule('m-g4-1', 'EL-TS01-G4', '18 janv. 2024'),
  doneModule('m-g4-2', 'EL-TS02-G4', '2 févr. 2024'),
  doneModule('m-g3-1', 'EL-TS03-G3', '12 juin 2024'),
  doneModule('m-g3-2', 'EL-TS04-G3', '8 juil. 2024'),
  doneModule('m-g3-3', 'EL-TS05-G3', '16 sept. 2024'),
  doneModule('m-g3-4', 'EL-TS06-G3', '21 oct. 2024'),
  doneModule('m-g3-5', 'EL-TS07-G3', '15 mars 2025'),
  doneModule('m1', 'EL-TS08-G2', '6 févr. 2026'),
  doneModule('m2', 'EL-TS09-G2', '14 févr. 2026'),
  {
    id: 'm3', brand: 'toyota', code: 'EL-TS10-G2',
    status: 'progress', progress: 45, completedDate: null,
    ...el['EL-TS10-G2'],
  },
  {
    id: 'm4', brand: 'toyota', code: 'EL-TS11-G2',
    status: 'todo', progress: 0, completedDate: null,
    ...el['EL-TS11-G2'],
  },
  {
    id: 'm5', brand: 'toyota', code: 'EL-TS12-G2',
    status: 'todo', progress: 0, completedDate: null,
    ...el['EL-TS12-G2'],
  },
]

export const LMS_BY_USER = {
  u1: {
    certGoals: [
      {
        brand: 'toyota',
        targetLevel: 'G2',
        currentLevel: 'G3',
        targetDate: 'Oct. 2026',
      },
    ],
    alerts: [],
    discover: [
      {
        id: 'd1', title: el['EL-TS11-G2'].title, brand: 'toyota', code: 'EL-TS11-G2',
        duration: '5j', reason: 'Suite parcours diagnostic G2',
      },
      {
        id: 'd2', title: el['EL-TS12-G2'].title, brand: 'toyota', code: 'EL-TS12-G2',
        duration: '5j', reason: 'Certification G2 — étape finale',
      },
    ],
    modules: U1_MODULES,
    evaluations: [
      {
        id: 'cm-jt', kind: 'competency', competencyTier: 'junior', modality: 'theory',
        brand: 'toyota', certLevel: 'G4', status: 'done', date: '10 janv. 2024',
        score: 82, passMark: 70, questions: 30, attempts: 1,
        feedback: 'Palier maintenance validé.',
      },
      {
        id: 'cm-jp', kind: 'competency', competencyTier: 'junior', modality: 'practical',
        brand: 'toyota', certLevel: 'G4', status: 'done', date: '24 janv. 2024',
        score: 78, passMark: 60, questions: 12, attempts: 1,
        feedback: null,
      },
      {
        id: 'cm-st', kind: 'competency', competencyTier: 'senior', modality: 'theory',
        brand: 'toyota', certLevel: 'G3', status: 'done', date: '18 mai 2025',
        score: 85, passMark: 70, questions: 35, attempts: 1,
        feedback: 'Palier réparation validé.',
      },
      {
        id: 'cm-sp', kind: 'competency', competencyTier: 'senior', modality: 'practical',
        brand: 'toyota', certLevel: 'G3', status: 'done', date: '22 mars 2025',
        score: 81, passMark: 60, questions: 15, attempts: 1,
        feedback: null,
      },
      {
        id: 'cm-et', kind: 'competency', competencyTier: 'expert', modality: 'theory',
        brand: 'toyota', certLevel: 'G2', status: 'progress', date: '—',
        score: null, passMark: 70, questions: 40, questionsAnswered: 18, attempts: 1,
        feedback: null,
      },
      {
        id: 'cm-ep', kind: 'competency', competencyTier: 'expert', modality: 'practical',
        brand: 'toyota', certLevel: 'G2', status: 'todo', date: '—',
        score: null, passMark: 60, questions: 18, attempts: 0,
        feedback: null,
      },
      ...doneFormationEvals('TS01-G4', '20 janv. 2024', 'fm-ts01'),
      ...doneFormationEvals('TS02-G4', '5 févr. 2024', 'fm-ts02'),
      ...doneFormationEvals('TS03-G3', '14 juin 2024', 'fm-ts03'),
      ...doneFormationEvals('TS04-G3', '10 juil. 2024', 'fm-ts04'),
      ...doneFormationEvals('TS05-G3', '18 sept. 2024', 'fm-ts05'),
      ...doneFormationEvals('TS06-G3', '23 oct. 2024', 'fm-ts06'),
      ...doneFormationEvals('TS07-G3', '18 mars 2025', 'fm-ts07'),
      ...doneFormationEvals('TS08-G2', '7 févr. 2026', 'fm-ts08'),
      ...doneFormationEvals('TS09-G2', '14 févr. 2026', 'fm-ts09'),
      {
        id: 'fm-ts10t', kind: 'formation', modality: 'theory',
        brand: 'toyota', code: 'TS10-G2', status: 'todo', date: '—',
        score: null, passMark: 70, questions: 38, attempts: 0,
        feedback: null,
      },
      {
        id: 'fm-ts10p', kind: 'formation', modality: 'practical',
        brand: 'toyota', code: 'TS10-G2', status: 'todo', date: '—',
        score: null, passMark: 60, questions: 16, attempts: 0,
        feedback: null,
      },
    ],
    certifications: [
      {
        id: 'c1', title: 'Toyota G3 — Réparation (Senior)', brand: 'toyota', date: '22 mars 2025',
        level: 'G3', certId: 'TOY-G3-CI-2025-0087', validUntil: '22 mars 2028',
      },
    ],
    /** E-learning : catalogue Toyota, année 2026 (statuts alignés sur modules LMS). */
    assignedTrainings: buildElearningPlanAssignments(U1_MODULES),
    planAssignedBy: 'Fatou Mbaye',
    /** Parcours plan pluri annuel — modules G2 + G1 (fait / à faire). */
    planPathway: [
      { code: 'TS08-G2', date: '2026-02-02', annualStatus: 'fait' },
      { code: 'TS09-G2', date: '2026-02-09', annualStatus: 'fait' },
      { code: 'TS10-G2', date: '2026-07-13', annualStatus: 'inscrit' },
      { code: 'TS11-G2', date: '2026-07-20', annualStatus: 'a_inscrire' },
      { code: 'TS12-G2', date: '2026-10-12', annualStatus: 'a_inscrire' },
      { code: 'TS13-G1', date: '2026-09-07', annualStatus: 'a_inscrire' },
      { code: 'TS14-G1', date: '2026-11-10', annualStatus: 'a_inscrire' },
      { code: 'TS15-G1', annualStatus: 'a_programmer' },
      { code: 'TS16-G1', annualStatus: 'a_programmer' },
    ],
    /** Statuts inscription — clé `date|code`. G4/G3 : historique fait (tests débloqués). */
    planningStatus: {
      '2024-01-15|TS01-G4': 'fait',
      '2024-02-05|TS02-G4': 'fait',
      '2024-06-12|TS03-G3': 'fait',
      '2024-07-08|TS04-G3': 'fait',
      '2024-09-16|TS05-G3': 'fait',
      '2024-10-21|TS06-G3': 'fait',
      '2025-03-15|TS07-G3': 'fait',
      '2026-02-02|TS08-G2': 'fait',
      '2026-02-09|TS09-G2': 'fait',
      '2026-07-13|TS10-G2': 'inscrit',
      '2026-07-20|TS11-G2': 'a_inscrire',
      '2026-10-12|TS12-G2': 'a_inscrire',
      '2026-09-07|TS13-G1': 'a_inscrire',
      '2026-11-10|TS14-G1': 'a_inscrire',
      '|TS15-G1': 'a_programmer',
      '|TS16-G1': 'a_programmer',
    },
  },

  u2: {
    certGoals: [
      {
        brand: 'toyota',
        targetLevel: 'G1',
        currentLevel: 'G2',
        targetDate: 'Déc. 2026',
      },
    ],
    kiResults: {
      testsValidated: 12,
      avgScore: 84,
      learnersAssessed: 3,
    },
    modules: [
      doneModule('m1', 'EL-TS08-G2', '15 janv. 2026'),
      doneModule('m2', 'EL-TS09-G2', '22 janv. 2026'),
      {
        id: 'm3', brand: 'toyota', code: 'EL-TS10-G2',
        status: 'progress', progress: 70, completedDate: null,
        ...el['EL-TS10-G2'],
      },
      {
        id: 'm4', brand: 'toyota', code: 'EL-TS11-G2',
        status: 'todo', progress: 0, completedDate: null,
        ...el['EL-TS11-G2'],
      },
    ],
    evaluations: [
      {
        id: 'cm-st', kind: 'competency', competencyTier: 'senior', modality: 'theory',
        brand: 'toyota', certLevel: 'G2', status: 'done', date: '12 janv. 2026',
        score: 92, passMark: 70, questions: 35, attempts: 1,
        feedback: 'Palier réparation G2 validé.',
      },
      {
        id: 'cm-sp', kind: 'competency', competencyTier: 'senior', modality: 'practical',
        brand: 'toyota', certLevel: 'G2', status: 'done', date: '15 janv. 2026',
        score: 88, passMark: 60, questions: 14, attempts: 1,
        feedback: null,
      },
      {
        id: 'cm-et', kind: 'competency', competencyTier: 'expert', modality: 'theory',
        brand: 'toyota', certLevel: 'G1', status: 'todo', date: '—',
        score: null, passMark: 70, questions: 40, attempts: 0,
        feedback: null,
      },
      ...doneFormationEvals('TS08-G2', '18 janv. 2026', 'fm-u2-ts08'),
      ...doneFormationEvals('TS09-G2', '24 janv. 2026', 'fm-u2-ts09'),
      {
        id: 'fm-u2-ts10t', kind: 'formation', modality: 'theory',
        brand: 'toyota', code: 'TS10-G2', status: 'upcoming', date: '25 juin 2026',
        score: null, passMark: 70, questions: 38, attempts: 0,
        feedback: null,
      },
      {
        id: 'fm-u2-ts10p', kind: 'formation', modality: 'practical',
        brand: 'toyota', code: 'TS10-G2', status: 'todo', date: '—',
        score: null, passMark: 60, questions: 16, attempts: 0,
        feedback: null,
      },
    ],
    certifications: [
      {
        id: 'c1', title: 'Toyota G2 — Technicien Confirmé', brand: 'toyota', date: '15 janv. 2026',
        level: 'G2', certId: 'TOY-G2-MA-2026-0042', validUntil: '15 janv. 2029',
      },
      {
        id: 'c2', title: 'KI Habilitation — Formateur Suppléant Niv.2', brand: 'toyota', date: '10 fév. 2026',
        level: 'KI Niv.2', certId: 'KI-TOY-MA-2026-0008', validUntil: '10 fév. 2029',
      },
    ],
    assignedTrainings: buildElearningPlanAssignments([
      doneModule('m1', 'EL-TS08-G2', '15 janv. 2026'),
      doneModule('m2', 'EL-TS09-G2', '22 janv. 2026'),
      { id: 'm3', brand: 'toyota', code: 'EL-TS10-G2', status: 'progress', progress: 70, ...el['EL-TS10-G2'] },
      { id: 'm4', brand: 'toyota', code: 'EL-TS11-G2', status: 'todo', progress: 0, ...el['EL-TS11-G2'] },
    ]),
    planPathway: [
      { code: 'TS10-G2', date: '2026-06-22', annualStatus: 'inscrit' },
      { code: 'TS11-G2', date: '2026-07-06', annualStatus: 'a_inscrire' },
    ],
    planningStatus: {
      '2026-01-15|TS08-G2': 'fait',
      '2026-01-22|TS09-G2': 'fait',
      '2026-06-22|TS10-G2': 'inscrit',
      '2026-07-06|TS11-G2': 'a_inscrire',
    },
    formationsADispenser: [
      { id: 'fad1', title: 'Formation G1 Toyota — Initiation', apprenants: 3, date: '22 juin 2026', statut: 'planifie' },
      { id: 'fad2', title: 'Formation G2 Toyota — Technicien', apprenants: 2, date: 'En attente', statut: 'attente' },
    ],
    apprenants: [
      { id: 'a1', nom: 'Rachid Benali', niveau: 'G1', progress: 30, lastActivity: "Aujourd'hui" },
      { id: 'a2', nom: 'Hassan Ouazzani', niveau: 'G1', progress: 65, lastActivity: 'Hier' },
      { id: 'a3', nom: 'Karim Fassi', niveau: 'G1', progress: 15, lastActivity: 'Il y a 4 j' },
    ],
  },

  u3: {
    team: [
      {
        id: 'a1', nom: 'Ibrahima Sow', brand: 'toyota', certLevel: 'G3', targetLevel: 'G2',
        modulesTotal: 5, modulesDone: 3, progress: 60,
        competencyDone: 5, competencyTotal: 8, competencyPct: 63,
        pathwayDone: 3, pathwayTotal: 5, certified: false, lastActivity: 'Hier',
        evaluations: [
          { id: 'a1-cm-st', kind: 'competency', competencyTier: 'senior', modality: 'theory', brand: 'toyota', certLevel: 'G3', status: 'done', score: 84 },
          { id: 'a1-cm-sp', kind: 'competency', competencyTier: 'senior', modality: 'practical', brand: 'toyota', certLevel: 'G3', status: 'todo' },
          { id: 'a1-fm-t', kind: 'formation', modality: 'theory', brand: 'toyota', code: 'TS08-G2', status: 'done', score: 78 },
        ],
        planPathway: [
          { code: 'TS10-G3', date: '2026-07-13', annualStatus: 'inscrit' },
          { code: 'TS11-G3', date: '2026-09-07', annualStatus: 'a_inscrire' },
        ],
      },
      {
        id: 'a2', nom: 'Aissatou Baldé', brand: 'toyota', certLevel: 'G2', targetLevel: 'G2',
        modulesTotal: 5, modulesDone: 5, progress: 100,
        competencyDone: 8, competencyTotal: 8, competencyPct: 100,
        pathwayDone: 5, pathwayTotal: 5, certified: true, lastActivity: "Aujourd'hui",
        evaluations: [
          { id: 'a2-cm-st', kind: 'competency', competencyTier: 'senior', modality: 'theory', brand: 'toyota', certLevel: 'G2', status: 'done', score: 92 },
          { id: 'a2-cm-sp', kind: 'competency', competencyTier: 'senior', modality: 'practical', brand: 'toyota', certLevel: 'G2', status: 'done', score: 88 },
        ],
        planPathway: [
          { code: 'TS08-G2', date: '2026-02-02', annualStatus: 'fait' },
        ],
      },
      {
        id: 'a3', nom: 'Moussa Camara', brand: 'suzuki', certLevel: 'G4', targetLevel: 'G3',
        modulesTotal: 5, modulesDone: 2, progress: 40,
        competencyDone: 3, competencyTotal: 8, competencyPct: 38,
        pathwayDone: 2, pathwayTotal: 5, certified: false, lastActivity: 'Il y a 3 j',
        evaluations: [
          { id: 'a3-cm-jt', kind: 'competency', competencyTier: 'junior', modality: 'theory', brand: 'suzuki', certLevel: 'G4', status: 'done', score: 71 },
          { id: 'a3-fm-t', kind: 'formation', modality: 'theory', brand: 'suzuki', code: 'SS05', status: 'todo' },
        ],
        planPathway: [
          { code: 'SS06', date: '2026-08-18', annualStatus: 'a_inscrire' },
        ],
      },
      {
        id: 'a4', nom: 'Ndèye Fall', brand: 'toyota', certLevel: 'G4', targetLevel: 'G3',
        modulesTotal: 5, modulesDone: 0, progress: 0,
        competencyDone: 0, competencyTotal: 8, competencyPct: 0,
        pathwayDone: 0, pathwayTotal: 5, certified: false, lastActivity: 'Il y a 35 j', alert: true,
        evaluations: [],
        planPathway: [
          { code: 'TS01-G4', date: '2026-03-10', annualStatus: 'a_inscrire' },
        ],
      },
      {
        id: 'a5', nom: 'Omar Diop', brand: 'suzuki', certLevel: 'G3', targetLevel: 'G2',
        modulesTotal: 5, modulesDone: 4, progress: 80,
        competencyDone: 6, competencyTotal: 8, competencyPct: 75,
        pathwayDone: 4, pathwayTotal: 5, certified: false, lastActivity: "Aujourd'hui",
        evaluations: [
          { id: 'a5-cm-st', kind: 'competency', competencyTier: 'senior', modality: 'theory', brand: 'suzuki', certLevel: 'G3', status: 'done', score: 86 },
          { id: 'a5-cm-sp', kind: 'competency', competencyTier: 'senior', modality: 'practical', brand: 'suzuki', certLevel: 'G3', status: 'todo' },
          { id: 'a5-fm-p', kind: 'formation', modality: 'practical', brand: 'suzuki', code: 'SS08', status: 'done', score: 80 },
        ],
        planPathway: [
          { code: 'SS09', date: '2026-06-22', annualStatus: 'inscrit' },
        ],
      },
    ],
    pendingValidations: [
      {
        id: 'pv-a1-senior-p',
        memberId: 'a1',
        memberName: 'Ibrahima Sow',
        brand: 'toyota',
        kind: 'competency',
        modality: 'practical',
        competencyTier: 'senior',
        certLevel: 'G3',
      },
      {
        id: 'pv-a5-expert-p',
        memberId: 'a5',
        memberName: 'Omar Diop',
        brand: 'suzuki',
        kind: 'competency',
        modality: 'practical',
        competencyTier: 'senior',
        certLevel: 'G3',
      },
    ],
    certStats: [
      { brand: 'toyota', certified: 1, total: 3 },
      { brand: 'suzuki', certified: 0, total: 2 },
    ],
  },

  u4: {
    kpis: { certificationRate: 28, totalLearners: 8, overdue: 2, activeSessions: 1 },
    teams: [
      {
        chef: 'Seydou Diallo', label: 'Équipe Toyota / Suzuki',
        membres: [
          { id: 'a1', nom: 'Ibrahima Sow', brand: 'toyota', progress: 60, certified: false, lastActivity: 'Hier' },
          { id: 'a2', nom: 'Aissatou Baldé', brand: 'toyota', progress: 100, certified: true, lastActivity: "Aujourd'hui" },
          { id: 'a3', nom: 'Moussa Camara', brand: 'suzuki', progress: 40, certified: false, lastActivity: 'Il y a 3 j' },
          { id: 'a4', nom: 'Ndèye Fall', brand: 'toyota', progress: 0, certified: false, lastActivity: 'Il y a 35 j', alert: true },
          { id: 'a5', nom: 'Omar Diop', brand: 'suzuki', progress: 80, certified: false, lastActivity: "Aujourd'hui" },
        ],
      },
      {
        chef: 'Mamadou Sy', label: 'Équipe Toyota',
        membres: [
          { id: 'b1', nom: 'Pape Diagne', brand: 'toyota', progress: 55, certified: false, lastActivity: 'Hier' },
          { id: 'b2', nom: 'Rokhaya Ndiaye', brand: 'toyota', progress: 100, certified: true, lastActivity: 'Il y a 2 j' },
          { id: 'b3', nom: 'Lamine Guèye', brand: 'toyota', progress: 20, certified: false, lastActivity: 'Il y a 7 j' },
        ],
      },
    ],
  },

  u5: {
    collaborateurs: [
      { id: 'c1', nom: 'Kouamé Assi', role: 'learner', brand: 'toyota', progress: 45, dept: 'Motors', lastLogin: "Aujourd'hui" },
      { id: 'c2', nom: 'Adjoua Yao', role: 'learner', brand: 'toyota', progress: 80, dept: 'Motors', lastLogin: 'Hier' },
      { id: 'c3', nom: 'Koffi Kouassi', role: 'ki', brand: 'toyota', progress: 72, dept: 'Motors', lastLogin: 'Il y a 2 j' },
      { id: 'c4', nom: 'Ama Boateng', role: 'learner', brand: 'suzuki', progress: 30, dept: 'Motors', lastLogin: 'Hier' },
      { id: 'c5', nom: 'Félix Tapé', role: 'team_manager', brand: 'suzuki', progress: 0, dept: 'Motors', lastLogin: 'Il y a 5 j' },
      { id: 'c6', nom: 'Bintou Coulibaly', role: 'learner', brand: 'fuso', progress: 55, dept: 'Equipment', lastLogin: "Aujourd'hui" },
      { id: 'c7', nom: 'Serge Ahoué', role: 'learner', brand: 'toyota', progress: 15, dept: 'Motors', lastLogin: 'Il y a 12 j', alert: true },
      { id: 'c8', nom: 'Christiane N\'Guessan', role: 'center_assistant', brand: null, progress: null, dept: 'Academy', lastLogin: "Aujourd'hui" },
      { id: 'c9', nom: 'Jean-Baptiste Koné', role: 'workshop_manager', brand: 'toyota', progress: 60, dept: 'Motors', lastLogin: 'Hier' },
      { id: 'c10', nom: 'Siaka Traoré', role: 'learner', brand: 'suzuki', progress: 90, dept: 'Motors', lastLogin: "Aujourd'hui" },
      { id: 'c11', nom: 'Mariam Diomandé', role: 'learner', brand: 'toyota', progress: 100, dept: 'Motors', lastLogin: 'Il y a 3 j' },
      { id: 'c12', nom: 'Didier Gnahoré', role: 'learner', brand: 'hino', progress: 35, dept: 'Equipment', lastLogin: 'Il y a 8 j' },
    ],
  },

  u9: {
    // Persona MEDACAP live (an52ng) — mock minimal ; tests compétence via API.
    certGoals: [
      {
        brand: 'king-long',
        currentLevel: 'JUNIOR',
        targetLevel: 'SENIOR',
        targetDate: '—',
      },
    ],
    alerts: [],
    modules: [],
    discover: [],
    evaluations: [],
    certifications: [],
    planPathway: [],
    planningStatus: {},
  },

  u6: {
    globalKpis: {
      totalApprenants: 2847,
      tauxCertification: 41,
      sessionsActives: 18,
      filialesActives: 12,
    },
    filialesStats: [
      { filiale: "Côte d'Ivoire", apprenants: 342, pct: 48 },
      { filiale: 'Maroc', apprenants: 287, pct: 39 },
      { filiale: 'Sénégal', apprenants: 198, pct: 35 },
      { filiale: 'Cameroun', apprenants: 256, pct: 44 },
      { filiale: 'Ghana', apprenants: 189, pct: 51 },
    ],
    recentLogs: [
      { time: '09:14', text: 'Aminata Koné a inscrit 3 collaborateurs à la session Renault EV du 25 juin' },
      { time: '08:52', text: 'Certification Toyota G3 délivrée à Brahim Tahir (Maroc)' },
      { time: '08:30', text: 'Nouvelle session planifiée : Toyota TNGA — Centre CFAO Dakar, 30 juin' },
      { time: 'Hier', text: 'Import réussi : 28 nouveaux comptes apprenants (filiale Ghana)' },
      { time: 'Hier', text: 'Alerte : 7 apprenants sans activité depuis > 30 j (filiale Cameroun)' },
    ],
  },
}
