import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/PortalLayout.jsx'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalSectionEyebrow from '../../components/PortalSectionEyebrow.jsx'
import PortalSectionHead from '../../components/PortalSectionHead.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PlanEntryCard from '../../components/PlanEntryCard.jsx'
import GoogleDonutChart from '../../components/GoogleDonutChart.jsx'
import PortalModal from '../../components/PortalModal.jsx'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import useSuperadminGroupStats from '../../hooks/useSuperadminGroupStats.js'
import { LMS_BY_USER } from '../../data/mock_lms'
import useDeliveryState from '../../hooks/useDeliveryState.js'
import { computeProgress, computeTestStats } from '../../utils/deliveryAccess.js'
import {
  MEDACAP_PROFILE_CONFIG,
  describeProfile,
} from '../../config/medacapMatrix.js'
import { loadBuildState, buildStateKey } from '../../config/profileBuildStatus.js'

export const CFAO_ACADEMY_APPS_CONFIG = [
  {
    id: 'global',
    code: 'GLOBAL · SYNTHÈSE',
    title: 'Plateforme CFAO Academy',
    desc: 'Vision consolidée des modules métiers, du socle technique, des tests et des profils opérationnels.',
    kind: 'results',
    accentColor: '#e3001b',
    epics: null,
    statusChip: '68% DÉPLOYÉ',
    statusChipClass: 'done',
    progressPct: 68,
    liveParts: '14/61 parties live',
    testsOk: '38/48',
    testsTotal: 48,
    profilesOk: 8,
    profilesDraft: 3,
    profilesLabel: '8 OK · 3 DRAFT',
    profiles: [
      { name: 'Technicien / Apprenant', status: 'ok', role: 'learner' },
      { name: 'Key Instructor & PIC', status: 'ok', role: 'ki' },
      { name: 'Chef d’équipe & Atelier', status: 'ok', role: 'team_manager' },
      { name: 'Directeur Pièces & Services (DPS)', status: 'ok', role: 'dps' },
      { name: 'Directeur des Opérations (DOP)', status: 'ok', role: 'dop' },
      { name: 'RH Filiale', status: 'ok', role: 'branch_hr' },
      { name: 'Administrateur Filiale', status: 'ok', role: 'branch_admin' },
      { name: 'Super Admin Groupe', status: 'ok', role: 'superadmin' },
      { name: 'Formateur & Directeur Centre', status: 'draft', role: 'trainer' },
      { name: 'Directeur Général Filiale', status: 'draft', role: 'branch_director' },
      { name: 'RH Groupe & Arbitrage', status: 'draft', role: 'group_hr' },
    ],
    tests: [
      { type: 'TU (Tests Unitaires)', done: 16, total: 18, status: 'ok' },
      { type: 'TI (Tests d’Intégration)', done: 12, total: 14, status: 'ok' },
      { type: 'Contrats API & Schémas', done: 4, total: 6, status: 'ok' },
      { type: 'E2E (Parcours Métiers)', done: 6, total: 10, status: 'progress' },
    ],
    cta: 'Ouvrir le cockpit MOA',
    targetRoute: '/portail/delivery',
  },
  {
    id: 'app01',
    code: 'APP 01',
    title: 'Site Public & Catalogue',
    desc: 'Catalogue des formations multimarques, actualités, calendrier et formulaire de contact.',
    kind: 'learners',
    accentColor: '#059669',
    epics: ['01'],
    statusChip: 'LIVE · 100%',
    statusChipClass: 'done',
    progressPct: 100,
    liveParts: 'Catalogue & News live',
    testsOk: '5/5',
    testsTotal: 5,
    profilesOk: 2,
    profilesDraft: 0,
    profilesLabel: '2 OK · 0 DRAFT',
    profiles: [
      { name: 'Visiteurs externes & Collaborateurs', status: 'ok' },
      { name: 'Candidats & Postulants', status: 'ok' },
    ],
    tests: [
      { type: 'TU Composants UI', done: 2, total: 2, status: 'ok' },
      { type: 'TI Catalogue & Filtres', done: 2, total: 2, status: 'ok' },
      { type: 'E2E Navigation & Contact', done: 1, total: 1, status: 'ok' },
    ],
    cta: 'Consulter le site public',
    targetRoute: '/formations',
  },
  {
    id: 'app02',
    code: 'APP 02',
    title: 'Espace Apprenant (LMS)',
    desc: 'Parcours e-learning, évaluations QCM, attestations et progression individuelle.',
    kind: 'learners',
    accentColor: '#1a56db',
    epics: ['02'],
    statusChip: 'LIVE · 88%',
    statusChipClass: 'done',
    progressPct: 88,
    liveParts: '7/8 modules live',
    testsOk: '8/8',
    testsTotal: 8,
    profilesOk: 2,
    profilesDraft: 0,
    profilesLabel: '2 OK · 0 DRAFT',
    profiles: [
      { name: 'Technicien Maintenance & Réparation', status: 'ok' },
      { name: 'Carrossier & Peintre', status: 'ok' },
    ],
    tests: [
      { type: 'TU Évaluations & QCM', done: 3, total: 3, status: 'ok' },
      { type: 'TI Scoring & Notes', done: 3, total: 3, status: 'ok' },
      { type: 'E2E Parcours Apprenant', done: 2, total: 2, status: 'ok' },
    ],
    cta: 'Accéder au portail apprenant',
    targetRoute: '/portail',
  },
  {
    id: 'app03',
    code: 'APP 03',
    title: 'Espace Key Instructor & PIC',
    desc: 'Animation des formations internes filiales, suivi apprenants et validation terrain.',
    kind: 'sessions',
    accentColor: '#7c3aed',
    epics: ['03'],
    statusChip: 'LIVE · 75%',
    statusChipClass: 'done',
    progressPct: 75,
    liveParts: '6/8 écrans live',
    testsOk: '6/8',
    testsTotal: 8,
    profilesOk: 2,
    profilesDraft: 0,
    profilesLabel: '2 OK · 0 DRAFT',
    profiles: [
      { name: 'Key Instructor (KI)', status: 'ok' },
      { name: 'Formateur Suppléant (PIC)', status: 'ok' },
    ],
    tests: [
      { type: 'TU Validation terrain', done: 2, total: 3, status: 'progress' },
      { type: 'TI Roster apprenants', done: 3, total: 3, status: 'ok' },
      { type: 'E2E Enregistrement session', done: 1, total: 2, status: 'progress' },
    ],
    cta: 'Ouvrir l’espace KI',
    targetRoute: '/portail',
  },
  {
    id: 'app04',
    code: 'APP 04-05',
    title: 'Formateurs, Sessions & Salles',
    desc: 'Gestion des sessions présentielles, réservations de salles et feuilles d’émargement.',
    kind: 'sessions',
    accentColor: '#e67e00',
    epics: ['04', '05', '08'],
    statusChip: 'EN COURS · 62%',
    statusChipClass: 'progress',
    progressPct: 62,
    liveParts: '8/13 stories live',
    testsOk: '5/8',
    testsTotal: 8,
    profilesOk: 1,
    profilesDraft: 1,
    profilesLabel: '1 OK · 1 DRAFT',
    profiles: [
      { name: 'Formateur Référent', status: 'ok' },
      { name: 'Directeur de Centre de Formation', status: 'draft' },
    ],
    tests: [
      { type: 'TU Planning & Calendrier', done: 2, total: 3, status: 'progress' },
      { type: 'TI Réservation salles', done: 2, total: 3, status: 'progress' },
      { type: 'E2E Émargement & Convocations', done: 1, total: 2, status: 'progress' },
    ],
    cta: 'Voir les sessions',
    targetRoute: '/sessions',
  },
  {
    id: 'app06',
    code: 'APP 06',
    title: 'Assistance Formateurs & Hotline',
    desc: 'Hotline formateurs atelier, gestion des tickets d’incidents et support technique filiale.',
    kind: 'pif',
    accentColor: '#0d9488',
    epics: ['06'],
    statusChip: 'EN COURS · 50%',
    statusChipClass: 'progress',
    progressPct: 50,
    liveParts: 'Page tickets atelier live',
    testsOk: '4/6',
    testsTotal: 6,
    profilesOk: 0,
    profilesDraft: 1,
    profilesLabel: '0 OK · 1 DRAFT',
    profiles: [
      { name: 'Hotline Formateurs & Support Atelier', status: 'draft' },
    ],
    tests: [
      { type: 'TU Création ticket incident', done: 2, total: 2, status: 'ok' },
      { type: 'TI Escalade formateur référent', done: 1, total: 2, status: 'progress' },
      { type: 'E2E Clôture & Notification', done: 1, total: 2, status: 'progress' },
    ],
    cta: 'Consulter l’activité tickets',
    targetRoute: '#logs',
  },
  {
    id: 'app07',
    code: 'APP 07',
    title: 'Pilotage Réseau & Management (DPS)',
    desc: 'Consolidation filiales, suivi des compétences ateliers, résultats et arbitrage PIF.',
    kind: 'results',
    accentColor: '#14213d',
    epics: ['07', '10'],
    statusChip: 'LIVE · 90%',
    statusChipClass: 'done',
    progressPct: 90,
    liveParts: '9/10 modules live',
    testsOk: '7/7',
    testsTotal: 7,
    profilesOk: 2,
    profilesDraft: 1,
    profilesLabel: '2 OK · 1 DRAFT',
    profiles: [
      { name: 'Directeur Pièces & Services (DPS)', status: 'ok' },
      { name: 'Directeur des Opérations (DOP)', status: 'ok' },
      { name: 'Directeur Général Filiale', status: 'draft' },
    ],
    tests: [
      { type: 'TU Matrice compétences', done: 3, total: 3, status: 'ok' },
      { type: 'TI Arbitrage PIF filiale', done: 2, total: 2, status: 'ok' },
      { type: 'E2E Vue managériale', done: 2, total: 2, status: 'ok' },
    ],
    cta: 'Ouvrir la vue DPS',
    targetRoute: '/portail',
  },
  {
    id: 'app09',
    code: 'APP 09',
    title: 'Recrutement & Candidats',
    desc: 'Pipeline des candidatures, QCM pré-embauche et conversion automatique en apprenant.',
    kind: 'learners',
    accentColor: '#059669',
    epics: ['09'],
    statusChip: 'EN COURS · 35%',
    statusChipClass: 'progress',
    progressPct: 35,
    liveParts: 'Phase 2 en cours',
    testsOk: '3/7',
    testsTotal: 7,
    profilesOk: 0,
    profilesDraft: 2,
    profilesLabel: '0 OK · 2 DRAFT',
    profiles: [
      { name: 'Candidats & Postulants', status: 'draft' },
      { name: 'Responsable Recrutement RH', status: 'draft' },
    ],
    tests: [
      { type: 'TU Évaluation candidat', done: 2, total: 3, status: 'progress' },
      { type: 'TI Webhooks Recrutement↔LMS', done: 1, total: 2, status: 'progress' },
      { type: 'E2E Parcours embauche', done: 0, total: 2, status: 'progress' },
    ],
    cta: 'Voir les candidatures',
    targetRoute: '/formations',
  },
  {
    id: 'app11',
    code: 'APP 11-12',
    title: 'Administration RH & Plateforme',
    desc: 'Annuaire consolidé, gestion des comptes, habilitations, rôles et logs de sécurité.',
    kind: 'pif',
    accentColor: '#0284c7',
    epics: ['11', '12'],
    statusChip: 'EN COURS · 70%',
    statusChipClass: 'progress',
    progressPct: 70,
    liveParts: '7/10 stories live',
    testsOk: '6/8',
    testsTotal: 8,
    profilesOk: 2,
    profilesDraft: 0,
    profilesLabel: '2 OK · 0 DRAFT',
    profiles: [
      { name: 'Responsable RH Filiale', status: 'ok' },
      { name: 'Administrateur Filiale', status: 'ok' },
      { name: 'Admin Plateforme', status: 'ok' },
    ],
    tests: [
      { type: 'TU Gestion comptes & rôles', done: 2, total: 3, status: 'progress' },
      { type: 'TI Synchronisation Identity', done: 2, total: 3, status: 'progress' },
      { type: 'E2E Onboarding & Annuaire', done: 2, total: 2, status: 'ok' },
    ],
    cta: 'Consulter l’annuaire',
    targetRoute: '#directory',
  },
  {
    id: 'app13',
    code: 'APP 13-14',
    title: 'CMS Wagtail & Notifications',
    desc: 'Articles éditoriaux multimarques, actualités filiales et centre d’alertes in-app.',
    kind: 'sessions',
    accentColor: '#6366f1',
    epics: ['13', '14'],
    statusChip: 'EN COURS · 48%',
    statusChipClass: 'progress',
    progressPct: 48,
    liveParts: 'Socle Wagtail & Notifs',
    testsOk: '4/8',
    testsTotal: 8,
    profilesOk: 1,
    profilesDraft: 1,
    profilesLabel: '1 OK · 1 DRAFT',
    profiles: [
      { name: 'Rédacteur & Communication', status: 'ok' },
      { name: 'Destinataire Alertes / In-App', status: 'draft' },
    ],
    tests: [
      { type: 'TU Templates articles CMS', done: 2, total: 3, status: 'progress' },
      { type: 'TI Envoi notifications & emails', done: 1, total: 3, status: 'progress' },
      { type: 'E2E Flux publication', done: 1, total: 2, status: 'progress' },
    ],
    cta: 'Consulter le flux',
    targetRoute: '/actualites',
  },
  {
    id: 'app15',
    code: 'APP 15',
    title: 'Cockpit Pilotage Projet & MOA',
    desc: 'Roadmap PERT release 1, backlog epics, gate go-live et rapports hebdomadaires.',
    kind: 'results',
    accentColor: '#e3001b',
    epics: ['15'],
    statusChip: 'LIVE · 92%',
    statusChipClass: 'done',
    progressPct: 92,
    liveParts: 'Cockpit complet live',
    testsOk: '10/10',
    testsTotal: 10,
    profilesOk: 2,
    profilesDraft: 0,
    profilesLabel: '2 OK · 0 DRAFT',
    profiles: [
      { name: 'Super Admin Groupe', status: 'ok' },
      { name: 'Équipe Build / MOA', status: 'ok' },
    ],
    tests: [
      { type: 'TU PERT & Calculs', done: 4, total: 4, status: 'ok' },
      { type: 'TI Sync Git & Backlog', done: 3, total: 3, status: 'ok' },
      { type: 'E2E Validation Gate J', done: 3, total: 3, status: 'ok' },
    ],
    cta: 'Ouvrir le cockpit',
    targetRoute: '/portail/delivery',
  },
  {
    id: 'app16',
    code: 'APP 16',
    title: 'Recueil des Besoins de Formation',
    desc: 'Campagne pluri-annuelle 2027, circuit de validation, exports et consolidation groupe.',
    kind: 'pif',
    accentColor: '#d97706',
    epics: ['16'],
    statusChip: 'EN COURS · 42%',
    statusChipClass: 'progress',
    progressPct: 42,
    liveParts: 'Module N0 en cours',
    testsOk: '3/6',
    testsTotal: 6,
    profilesOk: 0,
    profilesDraft: 2,
    profilesLabel: '0 OK · 2 DRAFT',
    profiles: [
      { name: 'RH Groupe (Arbitrage)', status: 'draft' },
      { name: 'Managers de filiale (Saisie)', status: 'draft' },
    ],
    tests: [
      { type: 'TU Modèle recueil', done: 2, total: 2, status: 'ok' },
      { type: 'TI Export & Consolidation', done: 1, total: 2, status: 'progress' },
      { type: 'E2E Circuit d’approbation', done: 0, total: 2, status: 'progress' },
    ],
    cta: 'Voir le module N0',
    targetRoute: '/portail/delivery',
  },
]

export const OPERATIONAL_PROFILES_CONFIG = [
  {
    id: 'prof-learner',
    role: 'learner',
    title: 'Technicien / Apprenant',
    kicker: 'MÉTIER · NIVEAUX G1-G4',
    image: '/assets/technicien-travaillant.png',
    scope: 'Individuel (Atelier)',
    desc: 'Passage des tests de positionnement, progression sur parcours e-learning, attestations et fiches de progrès.',
    status: 'OPÉRATIONNEL',
    statusClass: 'done',
    accentColor: '#1a56db',
    modulesCount: '8 modules live',
    targetRoute: '/portail',
  },
  {
    id: 'prof-ki',
    role: 'ki',
    title: 'Key Instructor & PIC',
    kicker: 'FORMATION · TERRAIN FILIALE',
    image: '/assets/KI.png',
    scope: 'Filiale / Ateliers',
    desc: 'Animation des formations internes filiales, accompagnement terrain des techniciens et validation des évaluations.',
    status: 'OPÉRATIONNEL',
    statusClass: 'done',
    accentColor: '#7c3aed',
    modulesCount: 'Formateur relais',
    targetRoute: '/portail',
  },
  {
    id: 'prof-carrossier',
    role: 'carrossier',
    title: 'Carrossier & Peintre',
    kicker: 'MÉTIER · SPÉCIALITÉ ATELIER',
    image: '/assets/carrossier_peintre.jpg',
    scope: 'Individuel (Carrosserie)',
    desc: 'Redressage acier, préparation de surface, colorimétrie, finitions peinture et conformité normes constructeurs.',
    status: 'OPÉRATIONNEL',
    statusClass: 'done',
    accentColor: '#ea580c',
    modulesCount: '5 niveaux N1-N5',
    targetRoute: '/portail',
  },
  {
    id: 'prof-manager',
    role: 'team_manager',
    title: 'Chef d’équipe & Atelier',
    kicker: 'MANAGEMENT · ATELIER',
    image: '/assets/chef-equipe.png',
    scope: 'Équipe / Atelier',
    desc: 'Attribution des ordres de réparation, suivi du PIF individuel et validation des acquis opérationnels de l’équipe.',
    status: 'OPÉRATIONNEL',
    statusClass: 'done',
    accentColor: '#2563eb',
    modulesCount: 'Supervision directe',
    targetRoute: '/portail',
  },
  {
    id: 'prof-dps',
    role: 'dps',
    title: 'Directeur Pièces & Services (DPS)',
    kicker: 'DIRECTION · APRÈS-VENTE FILIALE',
    image: '/assets/dps-noir.png',
    scope: 'Filiale entière',
    desc: 'Pilotage global de l’après-vente filiale, matrice des compétences atelier, plan de formation et reporting DOP.',
    status: 'OPÉRATIONNEL',
    statusClass: 'done',
    accentColor: '#14213d',
    modulesCount: 'Cockpit DPS & KPIs',
    targetRoute: '/portail',
  },
  {
    id: 'prof-dop',
    role: 'dop',
    title: 'Directeur des Opérations (DOP)',
    kicker: 'DIRECTION · PÔLE RÉGIONAL',
    image: '/assets/dop-noir.png',
    scope: 'Zone régionale',
    desc: 'Supervision transversale multi-filiales (Equipment & Mobility), allocation des quotas et gouvernance réseau.',
    status: 'OPÉRATIONNEL',
    statusClass: 'done',
    accentColor: '#0f172a',
    modulesCount: 'Multi-filiales',
    targetRoute: '/portail',
  },
  {
    id: 'prof-hr',
    role: 'branch_hr',
    title: 'RH Filiale & Développement RH',
    kicker: 'RESSOURCES HUMAINES · TALENTS',
    image: '/assets/respon_sav.jpg',
    scope: 'Filiale (Collaborateurs)',
    desc: 'Planification des campagnes d’évaluation, gestion des parcours certifiants, conformité et interface siège.',
    status: 'CONFIGURABLE',
    statusClass: 'progress',
    accentColor: '#059669',
    modulesCount: 'Campagnes & Annuaire',
    targetRoute: '/portail/admin/builder',
  },
  {
    id: 'prof-trainer',
    role: 'trainer',
    title: 'Formateur & Directeur Centre',
    kicker: 'ACADÉMIE · HUB RÉGIONAL',
    image: '/assets/formation_motorisation_centre_formation.jpg',
    scope: 'Centres régionaux CFAO',
    desc: 'Conception des cursus constructeurs, gestion des plateaux techniques régionaux et certification des Key Instructors.',
    status: 'CONFIGURABLE',
    statusClass: 'progress',
    accentColor: '#d97706',
    modulesCount: 'Plateaux techniques',
    targetRoute: '/portail/admin/builder',
  },
]

/**
 * Portail Super Admin — vitrine groupe (référence DPS, aucun tableau).
 *
 * Nav (dans data/index.js) : #bilan · #branches · #directory · #logs
 * Chaque section = PortalReveal + container + PortalSectionHead + PortalStaggerGrid + PlanEntryCard.
 */
export default function SuperAdminDashboard() {
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const { t: td } = useLocale('delivery')
  const navigate = useNavigate()
  const mockLms = LMS_BY_USER[user?.demoKey]
  // BU active du switcher hero. Remontée ici pour piloter le refetch du hook
  // API : chaque changement de BU déclenche un nouveau GET group-stats?bu=…
  const [activeBu, setActiveBu] = useState('all')
  const { stats: apiStats } = useSuperadminGroupStats(user, { bu: activeBu })
  const [selectedAppDetail, setSelectedAppDetail] = useState(null)

  const { stories } = useDeliveryState()
  const buildSummary = useMemo(() => summarizeBuild(), [])

  const apps = useMemo(() => {
    return CFAO_ACADEMY_APPS_CONFIG.map(app => {
      const appStories = app.epics ? stories.filter(s => app.epics.includes(s.epic)) : stories
      const prog = computeProgress(appStories)
      const testStats = computeTestStats(appStories)

      const doneTests = Object.values(testStats).reduce((a, b) => a + b.done, 0)
      const totalTests = Object.values(testStats).reduce((a, b) => a + b.total, 0)

      let progressPct = app.progressPct
      if (prog.total > 0 && prog.done > 0) {
        progressPct = Math.max(app.progressPct, prog.pct)
      }

      let liveParts = app.liveParts
      if (app.id === 'global') {
        liveParts = `${buildSummary.liveCount}/${buildSummary.totalSections} parties live`
      }

      let profilesOk = app.profilesOk
      let profilesDraft = app.profilesDraft
      let profilesLabel = app.profilesLabel

      if (app.id === 'global') {
        profilesOk = buildSummary.profilesOkCount
        profilesDraft = buildSummary.profilesDraftCount
        profilesLabel = `${profilesOk} OK · ${profilesDraft} DRAFT`
      }

      let statusChipClass = progressPct >= 75 ? 'done' : progressPct >= 40 ? 'progress' : 'accent'
      let statusChip = progressPct >= 75 ? `LIVE · ${progressPct}%` : `EN COURS · ${progressPct}%`
      if (app.id === 'global') {
        statusChip = `${progressPct}% DÉPLOYÉ`
      }

      const dynamicTests = [
        { type: 'TU (Tests Unitaires)', done: testStats.tu?.done ?? 0, total: testStats.tu?.total ?? 0, status: testStats.tu?.done === testStats.tu?.total && testStats.tu?.total > 0 ? 'ok' : 'progress' },
        { type: 'TI (Tests d’Intégration)', done: testStats.ti?.done ?? 0, total: testStats.ti?.total ?? 0, status: testStats.ti?.done === testStats.ti?.total && testStats.ti?.total > 0 ? 'ok' : 'progress' },
        { type: 'Contrats API & Schémas', done: testStats.contract?.done ?? 0, total: testStats.contract?.total ?? 0, status: testStats.contract?.done === testStats.contract?.total && testStats.contract?.total > 0 ? 'ok' : 'progress' },
        { type: 'E2E (Parcours Métiers)', done: testStats.e2e?.done ?? 0, total: testStats.e2e?.total ?? 0, status: testStats.e2e?.done === testStats.e2e?.total && testStats.e2e?.total > 0 ? 'ok' : 'progress' },
      ].filter(tItem => tItem.total > 0)

      const tests = dynamicTests.length > 0 ? dynamicTests : app.tests
      const testsOk = totalTests > 0 ? `${doneTests}/${totalTests}` : app.testsOk

      return {
        ...app,
        progressPct,
        liveParts,
        testsOk,
        testsTotal: totalTests > 0 ? totalTests : app.testsTotal,
        profilesOk,
        profilesDraft,
        profilesLabel,
        statusChip,
        statusChipClass,
        tests,
      }
    })
  }, [stories, buildSummary])

  // Hydrate le lms avec les vrais chiffres MEDACAP dès qu'ils arrivent.
  // Fallback silencieux sur le mock si l'endpoint est indisponible.
  const lms = useMemo(() => {
    if (!mockLms) return null
    if (!apiStats) return mockLms
    return {
      ...mockLms,
      globalKpis: {
        ...mockLms.globalKpis,
        totalApprenants: apiStats.learnerCount,
        filialesActives: apiStats.branchCount,
        brandsCount:     apiStats.brandCount,
        sessionsActives: apiStats.trainingCount,
        trainingYear:    apiStats.trainingYear,
      },
      // Breakdown filiales × BU pour le strip sous le hero (Item 2).
      filialesLearners: apiStats.filiales?.length ? apiStats.filiales : null,
      // Places allouées 2026 par pays (Item 4, source cfao-needs).
      allocationsPerBranch: apiStats.allocationsPerBranch?.length ? apiStats.allocationsPerBranch : null,
    }
  }, [mockLms, apiStats])

  if (!user || !lms) return null

  const [comingSoonToast, setComingSoonToast] = useState(null)

  const triggerComingSoon = (filialeTitle, context = 'sessions') => {
    setComingSoonToast({
      title: filialeTitle,
      context,
      message: context === 'sessions'
        ? `L'espace détaillé des sessions et du calendrier pour ${filialeTitle} sera accessible prochainement.`
        : `La cartographie détaillée des compétences MEDACAP pour ${filialeTitle} sera accessible prochainement.`,
    })
  }

  useEffect(() => {
    if (!comingSoonToast) return
    const timer = setTimeout(() => setComingSoonToast(null), 3800)
    return () => clearTimeout(timer)
  }, [comingSoonToast])

  const { globalKpis, filialesStats, recentLogs, filialesFormations, filialesCompetences } = lms

  const filteredFormations = useMemo(() => {
    const list = filialesFormations || filialesStats || []
    if (activeBu === 'all') return list

    return list
      .filter(item => {
        if (item.isGroupOverview) return true
        const itemBu = item.bu || (item.countryCode === 'rw' || item.filiale === 'Rwanda' ? ['motors'] : ['equipment', 'motors'])
        return itemBu.includes(activeBu)
      })
      .map(item => {
        if (!item.isGroupOverview) return item
        if (activeBu === 'equipment') {
          return {
            ...item,
            filiale: 'Toutes les filiales Equipment',
            kicker: 'Pôle Equipment · 17 filiales',
            apprenants: 486,
            participations: 718,
            y2025: { apprenants: 486, participations: 718, label: 'Bilan 2025' },
            y2026: { placesAttribuees: 1042, label: 'Plan 2026' },
            pct: 85,
            statusChip: '85% RÉALISÉ',
            sites: '17 filiales · 11 marques Equipment',
          }
        }
        if (activeBu === 'motors') {
          return {
            ...item,
            filiale: 'Toutes les filiales Motors',
            kicker: 'Pôle Motors · 18 filiales',
            apprenants: 641,
            participations: 954,
            y2025: { apprenants: 641, participations: 954, label: 'Bilan 2025' },
            y2026: { placesAttribuees: 1285, label: 'Plan 2026' },
            pct: 83,
            statusChip: '83% RÉALISÉ',
            sites: '18 filiales · 9 marques Motors',
          }
        }
        return item
      })
  }, [filialesFormations, filialesStats, activeBu])

  const filteredCompetences = useMemo(() => {
    const list = filialesCompetences || []
    if (activeBu === 'all') return list

    return list
      .filter(item => {
        if (item.isGroupOverview) return true
        const itemBu = item.bu || (item.countryCode === 'rw' || item.filiale === 'Rwanda' ? ['motors'] : ['equipment', 'motors'])
        return itemBu.includes(activeBu)
      })
      .map(item => {
        if (!item.isGroupOverview) return item
        if (activeBu === 'equipment') {
          return {
            ...item,
            filiale: '11 Filiales Equipment',
            kicker: undefined,
            techniciensTestes: 118,
            techniciensEval: 118,
            techniciensTotal: 312,
            pct: 38,
            statusChip: '38% COUVERT',
            sites: '11 filiales testées · 11 marques Equipment',
          }
        }
        if (activeBu === 'motors') {
          return {
            ...item,
            filiale: '12 Filiales Motors',
            kicker: undefined,
            techniciensTestes: 135,
            techniciensEval: 135,
            techniciensTotal: 376,
            pct: 36,
            statusChip: '36% COUVERT',
            sites: '12 filiales testées · 9 marques Motors',
          }
        }
        return item
      })
  }, [filialesCompetences, activeBu])

  const branchesFormations = filteredFormations
  const branchesCompetences = filteredCompetences

  const filialesCountFormations = branchesFormations.filter(f => !f.isGroupOverview).length || branchesFormations.length
  const filialesCountCompetences = branchesCompetences.filter(f => !f.isGroupOverview).length || branchesCompetences.length

  const buSuffixTitle = activeBu === 'equipment' ? ' Equipment' : activeBu === 'motors' ? ' Motors' : ''
  const buMethodTextFormations = activeBu === 'equipment'
    ? 'Bilan 2025 et quotas 2026 pour le Pôle Equipment (11 marques partenaires).'
    : activeBu === 'motors'
      ? 'Bilan 2025 et quotas 2026 pour le Pôle Motors (9 marques partenaires).'
      : 'Bilan consolidé des formations 2025 et attributions prévisionnelles 2026 selon la Clé de répartition.'

  const buMethodTextCompetences = activeBu === 'equipment'
    ? 'Taux de couverture des techniciens testés en atelier pour le Pôle Equipment.'
    : activeBu === 'motors'
      ? 'Taux de couverture des techniciens testés en atelier pour le Pôle Motors.'
      : 'Taux de couverture des techniciens testés et positionnement technique en atelier (source MEDACAP).'

  const detailModal = selectedAppDetail ? (
    <PortalModal
      title={`${selectedAppDetail.code} · ${selectedAppDetail.title}`}
      onClose={() => setSelectedAppDetail(null)}
    >
      <div className="portal-app-modal-content">
        <div className="portal-app-modal-header-card">
          <div>
            <span className={`portal-status-chip ${selectedAppDetail.statusChipClass}`}>
              {selectedAppDetail.statusChip}
            </span>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: '13px', lineHeight: 1.4 }}>
              {selectedAppDetail.desc}
            </p>
          </div>
          <div style={{ textAlign: 'right', minWidth: '100px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: selectedAppDetail.accentColor, fontFamily: 'Space Grotesk, sans-serif' }}>
              {selectedAppDetail.progressPct}%
            </span>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Avancement</div>
          </div>
        </div>

        <div className="portal-app-modal-stats-grid">
          <div className="portal-app-modal-stat-box">
            <div className="portal-app-modal-stat-val">{selectedAppDetail.liveParts}</div>
            <div className="portal-app-modal-stat-lbl">Déploiement</div>
          </div>
          <div className="portal-app-modal-stat-box">
            <div className="portal-app-modal-stat-val" style={{ color: '#10b981' }}>{selectedAppDetail.testsOk}</div>
            <div className="portal-app-modal-stat-lbl">Tests validés</div>
          </div>
          <div className="portal-app-modal-stat-box">
            <div className="portal-app-modal-stat-val">{selectedAppDetail.profilesLabel}</div>
            <div className="portal-app-modal-stat-lbl">Profils associés</div>
          </div>
        </div>

        <div>
          <h4 className="portal-app-modal-section-title">Profils utilisateurs</h4>
          <div className="portal-app-modal-profiles-list">
            {selectedAppDetail.profiles.map((p, i) => (
              <div key={i} className="portal-app-modal-profile-item">
                <span className="portal-app-modal-profile-name">{p.name}</span>
                <span className={`portal-status-chip ${p.status === 'ok' ? 'done' : 'progress'}`}>
                  {p.status === 'ok' ? '✓ OPÉRATIONNEL' : '⏳ EN DRAFT'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="portal-app-modal-section-title">Couverture des tests</h4>
          <div className="portal-app-modal-tests-list">
            {selectedAppDetail.tests.map((tItem, i) => (
              <div key={i} className="portal-app-modal-test-item">
                <span>{tItem.type}</span>
                <span style={{ color: tItem.status === 'ok' ? '#10b981' : '#d97706' }}>
                  {tItem.done}/{tItem.total} OK
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="portal-app-modal-actions">
          <button
            type="button"
            className="btn"
            style={{ padding: '8px 16px', background: '#e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
            onClick={() => setSelectedAppDetail(null)}
          >
            Fermer
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '8px 20px', borderRadius: '8px', background: selectedAppDetail.accentColor, cursor: 'pointer' }}
            onClick={() => {
              const route = selectedAppDetail.targetRoute
              setSelectedAppDetail(null)
              if (route.startsWith('#')) {
                const el = document.querySelector(route)
                el?.scrollIntoView({ behavior: 'smooth' })
              } else {
                navigate(route)
              }
            }}
          >
            {selectedAppDetail.cta} →
          </button>
        </div>
      </div>
    </PortalModal>
  ) : null

  return (
    <PortalLayout
      user={user}
      lms={lms}
      headerProps={{
        activeBu,
        onBuChange: setActiveBu,
      }}
      modal={detailModal}
    >
      {/* ═════════════ Applications groupe — Pilotage & Évolution ═════════════ */}
      <PortalReveal id="bilan">
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="cog" label={t.superadmin_tools_eyebrow ?? 'Outils groupe'} />}
            title={t.superadmin_tools_title ?? 'Vos outils de pilotage'}
            methodText="État d’avancement consolidé, déploiement des applications et couverture des tests."
            t={t}
          />
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            {apps.map((app) => (
              <PlanEntryCard
                key={app.id}
                kind={app.kind}
                kicker={app.code}
                title={app.title}
                className={app.id === 'global' ? 'portal-card--global-overview' : ''}
                statusChip={
                  <span className={`portal-status-chip ${app.statusChipClass}`}>
                    {app.statusChip}
                  </span>
                }
                desc={app.desc}
                meta={(
                  <div className="portal-superadmin-card-metrics">
                    <div className="portal-superadmin-metric-row">
                      <span className="portal-superadmin-metric-lbl">Avancement</span>
                      <span className="portal-superadmin-metric-val">{app.progressPct}%</span>
                    </div>
                    <div className="portal-superadmin-progress-bar">
                      <div
                        className="portal-superadmin-progress-fill"
                        style={{ width: `${app.progressPct}%`, backgroundColor: app.accentColor }}
                      />
                    </div>
                    <div className="portal-superadmin-metric-badges">
                      <span className="portal-superadmin-badge-stat live-badge" title="Parties & modules live">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                        {app.liveParts}
                      </span>
                      <span className="portal-superadmin-badge-stat" title="Tests validés">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        {app.testsOk} tests OK
                      </span>
                      <span className={`portal-superadmin-badge-stat ${app.profilesDraft > 0 ? 'has-draft' : 'all-ok'}`} title="Profils opérationnels / en draft">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {app.profilesLabel}
                      </span>
                    </div>
                  </div>
                )}
                cta={app.cta}
                hoverHint="Cliquer pour voir le détail complet"
                onOpen={() => setSelectedAppDetail(app)}
                accentColor={app.accentColor}
                corner
              />
            ))}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ═════════════ #branches — Réalisation des plans de formation ═════════════ */}
      <PortalReveal id="branches">
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="building" label="DÉLIVRANCE & PARTICIPATIONS" />}
            title={`État d’avancement de la réalisation des Plans de formation de vos ${filialesCountFormations} filiales${buSuffixTitle}`}
            methodText={buMethodTextFormations}
            t={t}
          />
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            {branchesFormations.map(f => {
              const y2025Apprenants = f.y2025?.apprenants ?? f.apprenants
              const y2025Parts = f.y2025?.participations ?? f.participations ?? y2025Apprenants
              const y2026Seats = f.y2026?.placesAttribuees ?? (f.participations ? Math.round(f.participations * 1.1) : null)
              const isComplete = f.pct >= 100

              return (
                <PlanEntryCard
                  key={f.filiale}
                  kind="results"
                  title={f.filiale}
                  kicker={f.kicker ?? (f.isGroupOverview ? 'Réseau panafricain' : undefined)}
                  flagSrc={f.flagSrc}
                  countryFlag={f.countryCode ?? f.filiale}
                  className={f.isGroupOverview ? 'portal-card--global-overview' : ''}
                  statusChip={
                    <span className={`portal-status-chip ${isComplete ? 'status--complete' : 'status--inprogress'}`}>
                      {isComplete ? '100% · COMPLET' : `${f.pct}%`}
                    </span>
                  }
                  meta={(
                    <div className="portal-plan-entry-meta portal-plan-multiyear">
                      {/* Ligne Bilan 2025 */}
                      <div className="portal-multiyear-row">
                        <span className="portal-year-pill y2025">2025</span>
                        <span className="portal-multiyear-text">
                          <strong>{y2025Apprenants.toLocaleString('fr')}</strong> collaborateurs formés
                        </span>
                      </div>

                      {/* Ligne Plan 2026 avec pastille (i) Clé de répartition */}
                      {y2026Seats != null && (
                        <div className="portal-multiyear-row">
                          <span className="portal-year-pill y2026">2026</span>
                          <span className="portal-multiyear-text">
                            <strong>{y2026Seats.toLocaleString('fr')}</strong> places allouées
                            <span
                              className="portal-info-tooltip-badge"
                              tabIndex="0"
                              role="button"
                              aria-label="Clé de répartition 2026"
                              title={f.isGroupOverview
                                ? "Clé de répartition 2026 : 2 327 places allouées sur 3 530 demandes consolidées pour les 16 filiales"
                                : `Clé de répartition 2026 : Quota alloué (${y2026Seats} places) selon l'effectif atelier et les besoins constructeurs`}
                            >
                              i
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Barre d'avancement avec libellé explicite */}
                      <div className="portal-multiyear-progress-block">
                        <div className="portal-multiyear-progress-header">
                          <span className="portal-multiyear-progress-lbl">Taux de réalisation du plan pluriannuel</span>
                          <span className="portal-inline-pct">{f.pct}%</span>
                        </div>
                        <div className="portal-inline-track">
                          <div
                            className="portal-inline-fill"
                            style={{
                              width: `${f.pct}%`,
                              background: isComplete ? '#1a56db' : '#3b82f6',
                            }}
                          />
                        </div>
                      </div>

                      {/* Sites */}
                      {f.sites && (
                        <p className="portal-card-sites-line" title={f.sites}>
                          {f.sites}
                        </p>
                      )}
                    </div>
                  )}
                  isComingSoon={true}
                  cta={f.isGroupOverview ? "Vue consolidée" : "Voir les sessions"}
                  hoverHint={f.isGroupOverview ? "Consulter la consolidation groupe" : "Consulter les sessions de formation de la filiale"}
                  onOpen={() => triggerComingSoon(f.filiale, 'sessions')}
                  accentColor={isComplete ? '#1a56db' : '#64748b'}
                  corner
                />
              )
            })}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ═════════════ #competences — Mesure des compétences par filiale (MEDACAP) ═════════════ */}
      <PortalReveal id="competences">
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="clipboard" label="MESURE DES COMPÉTENCES · MEDACAP" />}
            title={`Progression de la mesure des compétences dans vos ${filialesCountCompetences} filiales${buSuffixTitle}`}
            methodText={buMethodTextCompetences}
            t={t}
          />
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            {branchesCompetences.map(f => {
              const testes = f.techniciensTestes ?? f.techniciensEval ?? 0
              const total = f.techniciensTotal ?? 0
              const isComplete = f.pct >= 100
              const waitingEnrollement = Math.max(0, total - testes)

              return (
                <PlanEntryCard
                  key={`comp-${f.filiale}`}
                  kind="learners"
                  title={f.filiale}
                  kicker={f.kicker}
                  flagSrc={f.flagSrc}
                  countryFlag={f.countryCode ?? f.filiale}
                  className={f.isGroupOverview ? 'portal-card--global-overview' : ''}
                  statusChip={
                    <span className={`portal-status-chip ${isComplete ? 'status--complete' : 'status--inprogress'}`}>
                      {isComplete ? '100% · COMPLET' : `${f.pct}%`}
                    </span>
                  }
                  meta={(
                    <div className="portal-plan-entry-meta portal-plan-multiyear">
                      {/* Chiffre clé strict : techniciens testés avec infobulle Clé de répartition */}
                      <div className="portal-multiyear-headline" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>
                          <strong>{testes.toLocaleString('fr')}</strong> / {total.toLocaleString('fr')} <span className="portal-techs-tested-lbl">techniciens testés</span>
                        </span>
                        <span
                          className="portal-info-tooltip-badge"
                          tabIndex="0"
                          role="button"
                          aria-label="Clé de répartition 2026"
                          title={f.isGroupOverview
                            ? `Clé de répartition 2026 : Effectif consolidé de ${total} techniciens atelier répertoriés dans les ${filialesCountCompetences} filiales testées`
                            : `Clé de répartition 2026 : Effectif atelier de référence (${total} techniciens répertoriés en atelier selon la clé)`}
                        >
                          i
                        </span>
                      </div>

                      {/* Donut interactif Google avec remplissage épais (thick) & Taux en % en dessous */}
                      <GoogleDonutChart
                        pct={f.pct}
                        label="Taux de couverture des tests"
                        detailHint={`${testes.toLocaleString('fr')} / ${total.toLocaleString('fr')} testés`}
                        todoHint={waitingEnrollement > 0 ? `${waitingEnrollement.toLocaleString('fr')} en attente` : undefined}
                        strokeWidth={16}
                        size={88}
                        doneColor={isComplete ? '#1a56db' : '#1a73e8'}
                        trackColor="#eaedf2"
                      />

                      {/* Raison d'inachèvement / confirmation d'enrôlement */}
                      <div className={`portal-enrollement-reason ${isComplete ? 'is-complete' : 'is-waiting'}`}>
                        <span className="portal-enrollement-dot" aria-hidden="true" />
                        <span className="portal-enrollement-text">
                          {isComplete
                            ? "100% de l'effectif atelier enrôlé & testé"
                            : `${waitingEnrollement.toLocaleString('fr')} technicien${waitingEnrollement > 1 ? 's' : ''} en attente d'enrôlement en base`}
                        </span>
                      </div>

                      {/* Sites */}
                      {f.sites && (
                        <p className="portal-card-sites-line" title={f.sites}>
                          {f.sites}
                        </p>
                      )}
                    </div>
                  )}
                  isComingSoon={true}
                  cta={f.isGroupOverview ? "Bilan groupe" : "Voir les compétences"}
                  hoverHint={f.isGroupOverview ? "Consulter la cartographie groupe MEDACAP" : "Consulter les compétences et résultats des tests de la filiale"}
                  onOpen={() => triggerComingSoon(f.filiale, 'competences')}
                  accentColor={isComplete ? '#1a56db' : '#64748b'}
                  corner
                />
              )
            })}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ═════════════ #logs — Activités filiales en format cartes ═════════════ */}
      <PortalReveal id="logs">
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="activity" label="ACTIVITÉS FILIALES · TEMPS RÉEL" />}
            title="Dernières actions de vos collaborateurs sur la plateforme"
            lead="Flux en direct des inscriptions, évaluations MEDACAP et validations opérationnelles."
            methodText="Horodatage en temps réel des dernières actions enregistrées par filiale."
            t={t}
          />
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            {/* Carte 1 : Toutes les filiales (Vue consolidée) */}
            <PlanEntryCard
              kind="results"
              title="Toutes les filiales"
              kicker="Réseau panafricain · Activité globale"
              flagSrc="/assets/flags/africa-cfao-network.jpg"
              className="portal-card--global-overview"
              statusChip={
                <span className="portal-status-chip done">
                  EN DIRECT · 38 ACTIONS
                </span>
              }
              meta={(
                <div className="portal-plan-entry-meta portal-activity-card-meta">
                  <div className="portal-activity-datetime">
                    <span className="portal-activity-pulse" aria-hidden="true" />
                    <span><strong>Dernière activité :</strong> Aujourd’hui à 09:14</span>
                  </div>
                  <div className="portal-activity-highlight">
                    <strong>Flux consolidé réseau :</strong> 38 actions enregistrées ce jour sur les espaces LMS, MEDACAP et PIF.
                  </div>
                  <p className="portal-activity-subtext">
                    Dernière action : Aminata Koné a inscrit 3 collaborateurs (Renault EV).
                  </p>
                  <p className="portal-card-sites-line" title="16 filiales actives · Pôles Mobility & Equipment">
                    16 filiales actives · Pôles Mobility & Equipment
                  </p>
                </div>
              )}
              isComingSoon={true}
              cta="Voir le journal global"
              hoverHint="Consulter le flux consolidé des 16 filiales"
              onOpen={() => triggerComingSoon('Toutes les filiales', 'activite')}
              accentColor="#1a56db"
              corner
            />

            {/* Carte 2 : Cameroun (avec les tests en cours sur MEDACAP) */}
            <PlanEntryCard
              kind="learners"
              title="Cameroun"
              kicker="Filiale la plus active · MEDACAP"
              flagSrc="/assets/flags/cameroon.svg"
              countryFlag="Cameroun"
              statusChip={
                <span className="portal-status-chip progress">
                  TESTS EN COURS
                </span>
              }
              meta={(
                <div className="portal-plan-entry-meta portal-activity-card-meta">
                  <div className="portal-activity-datetime">
                    <span className="portal-activity-pulse" aria-hidden="true" />
                    <span><strong>Dernière activité :</strong> Aujourd’hui à 08:52</span>
                  </div>
                  <div className="portal-activity-highlight">
                    <strong>Tests en cours sur MEDACAP :</strong> 160 techniciens atelier en cours d'évaluation de positionnement.
                  </div>
                  <p className="portal-activity-subtext">
                    Certification Toyota G3 délivrée & 7 apprenants réengagés sur module hybride.
                  </p>
                  <p className="portal-card-sites-line" title="Douala, Yaoundé, Garoua, Bertoua, Ngaoundéré">
                    Douala, Yaoundé, Garoua, Bertoua, Ngaoundéré
                  </p>
                </div>
              )}
              isComingSoon={true}
              cta="Consulter l'activité"
              hoverHint="Consulter les tests et actions récentes au Cameroun"
              onOpen={() => triggerComingSoon('Cameroun', 'activite')}
              accentColor="#1a56db"
              corner
            />

            {/* Carte 3 : Côte d'Ivoire */}
            <PlanEntryCard
              kind="sessions"
              title="Côte d'Ivoire"
              kicker="Filiale active · Formations"
              flagSrc="/assets/flags/ivory-coast.svg"
              countryFlag="Côte d'Ivoire"
              statusChip={
                <span className="portal-status-chip done">
                  ACTIF · 14 SESSIONS
                </span>
              }
              meta={(
                <div className="portal-plan-entry-meta portal-activity-card-meta">
                  <div className="portal-activity-datetime">
                    <span className="portal-activity-pulse" aria-hidden="true" />
                    <span><strong>Dernière activité :</strong> Aujourd’hui à 08:30</span>
                  </div>
                  <div className="portal-activity-highlight">
                    <strong>Sessions & Inscriptions :</strong> 14 collaborateurs en session présentielle Renault EV.
                  </div>
                  <p className="portal-activity-subtext">
                    Validation de 3 nouvelles inscriptions par le chef d’équipe atelier.
                  </p>
                  <p className="portal-card-sites-line" title="Abidjan Vridi & Boulevard de Marseille">
                    Abidjan Vridi & Boulevard de Marseille
                  </p>
                </div>
              )}
              isComingSoon={true}
              cta="Consulter l'activité"
              hoverHint="Consulter les sessions et activités en Côte d'Ivoire"
              onOpen={() => triggerComingSoon("Côte d'Ivoire", 'activite')}
              accentColor="#1a56db"
              corner
            />

            {/* Carte 4 : Sénégal */}
            <PlanEntryCard
              kind="sessions"
              title="Sénégal"
              kicker="Filiale active · Centre Dakar"
              flagSrc="/assets/flags/senegal.svg"
              countryFlag="Sénégal"
              statusChip={
                <span className="portal-status-chip done">
                  ACTIF · HUB REGIONAL
                </span>
              }
              meta={(
                <div className="portal-plan-entry-meta portal-activity-card-meta">
                  <div className="portal-activity-datetime">
                    <span className="portal-activity-pulse" aria-hidden="true" />
                    <span><strong>Dernière activité :</strong> Hier à 17:45</span>
                  </div>
                  <div className="portal-activity-highlight">
                    <strong>Session Hub Régional :</strong> Toyota TNGA planifiée au Centre CFAO Dakar.
                  </div>
                  <p className="portal-activity-subtext">
                    Planning validé pour 18 stagiaires multi-filiales zone Afrique de l'Ouest.
                  </p>
                  <p className="portal-card-sites-line" title="Dakar Km 2,5 & Rufisque">
                    Dakar Km 2,5 & Rufisque
                  </p>
                </div>
              )}
              isComingSoon={true}
              cta="Consulter l'activité"
              hoverHint="Consulter les plannings du Centre CFAO Dakar"
              onOpen={() => triggerComingSoon('Sénégal', 'activite')}
              accentColor="#1a56db"
              corner
            />
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ═════════════ #profiles — Création et gestion des profils opérationnels ═════════════ */}
      <PortalReveal id="profiles">
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="users" label="GOUVERNANCE & RÔLES · PROFILES BUILDER" />}
            title="Création et paramétrage des profils opérationnels"
            lead="Gestion des habilitations, matrices de compétences MEDACAP et cockpits métiers pour l'ensemble des collaborateurs du réseau."
            methodText="8 profils métiers configurés avec périmètres d'action et dashboards dédiés."
            t={t}
          />
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            {OPERATIONAL_PROFILES_CONFIG.map((p) => (
              <PlanEntryCard
                key={p.id}
                kind="learners"
                title={p.title}
                kicker={p.kicker}
                cardMedia={(
                  <div className="pv-card-img portal-plan-entry-card-img portal-profile-media-img">
                    <img src={p.image} alt={p.title} loading="lazy" />
                    <div className="portal-eval-img-tags">
                      <span className={`portal-status-chip ${p.statusClass}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                )}
                desc={p.desc}
                meta={(
                  <div className="portal-plan-entry-meta portal-profile-meta">
                    <div className="portal-profile-meta-item">
                      <span>Périmètre :</span>
                      <strong className="portal-profile-meta-val">{p.scope}</strong>
                    </div>
                    <div className="portal-profile-meta-item">
                      <span>Modules / Rôle :</span>
                      <strong className="portal-profile-meta-val">{p.modulesCount}</strong>
                    </div>
                  </div>
                )}
                cta={p.statusClass === 'done' ? 'Accéder au profil' : 'Configurer le profil'}
                hoverHint={`Gérer le profil ${p.title}`}
                onOpen={() => {
                  if (p.targetRoute.startsWith('/portail/admin')) {
                    navigate(p.targetRoute)
                  } else {
                    navigate(p.targetRoute)
                  }
                }}
                accentColor={p.accentColor}
                corner
              />
            ))}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ═════════════ Toast Flottant "Bientôt disponible" ═════════════ */}
      {comingSoonToast && (
        <div className="portal-coming-soon-toast" role="status" aria-live="polite">
          <div className="portal-coming-soon-toast-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div className="portal-coming-soon-toast-body">
            <div className="portal-coming-soon-toast-title">
              Bientôt disponible · {comingSoonToast.title}
            </div>
            <div className="portal-coming-soon-toast-desc">
              {comingSoonToast.message}
            </div>
          </div>
          <button
            type="button"
            className="portal-coming-soon-toast-close"
            onClick={() => setComingSoonToast(null)}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}
    </PortalLayout>
  )
}

/**
 * Résumé build state pour la carte compacte Builder dans #bilan.
 */
function summarizeBuild() {
  const state = loadBuildState()
  const profiles = Object.keys(MEDACAP_PROFILE_CONFIG).map(describeProfile).filter(Boolean)
  let totalSections = 0, liveCount = 0, readyCount = 0, draftCount = 0, p0Pending = 0
  let profilesOkCount = 0, profilesDraftCount = 0

  for (const p of profiles) {
    let profileHasLive = false
    for (const section of p.sections) {
      totalSections++
      const key = buildStateKey(p.profileKey, section.id)
      const entry = state[key] ?? { status: 'idea', priority: 'P2' }
      if (entry.status === 'live') {
        liveCount++
        profileHasLive = true
      }
      if (entry.status === 'ready') {
        readyCount++
        profileHasLive = true
      }
      if (entry.status === 'draft') draftCount++
      if (entry.priority === 'P0' && entry.status !== 'live') p0Pending++
    }
    if (profileHasLive) profilesOkCount++
    else profilesDraftCount++
  }
  return { totalSections, liveCount, readyCount, draftCount, p0Pending, profilesOkCount, profilesDraftCount }
}
