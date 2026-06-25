/**
 * App 15 — pilotage projet (cockpit MOA / build).
 * Source de vérité tant que l'API /api/v1/core/delivery/* n'existe pas.
 * Données fidèles à planning.md (PERT v2, phases §5, gate §4) et backlog.md (epics 00–15 + transverses).
 * Libellés de contenu : { fr, en, pt } (pt/en retombent sur fr via pickLocale).
 */

export const DELIVERY_STORAGE_KEY = 'cfao_delivery_state_v2'

/* ─── Chemin critique release 1 ──────────────────────────────────── */
export const PERT_CRITICAL_PATH = ['A', 'B', 'C', 'D', 'M', 'J']
export const CRITICAL_TE_TOTAL = '20,3'
export const CRITICAL_TE_TOTAL_EN = '20.3'

/* ─── Nœuds PERT = les « projets » à monter (planning.md §2) ─────── */
export const PERT_NODES = [
  {
    id: 'A',
    label: { fr: 'Infra + CI', en: 'Infra + CI', pt: 'Infra + CI' },
    module: { fr: 'Socle plateforme', en: 'Platform foundation', pt: 'Base da plataforma' },
    epics: [],
    status: 'done',  // infra sans stories backlog → statut porté au niveau du nœud
    te: 2.5,
    omp: { o: 2.0, m: 2.5, p: 3.0 },
    phase: '0',
    deps: [],
    critical: true,
    blocks: 'yes',
    note: {
      fr: 'Compose, Keycloak, Cerbos, BFF, gateway, 2× Postgres, pipeline CI.',
      en: 'Compose, Keycloak, Cerbos, BFF, gateway, 2× Postgres, CI pipeline.',
    },
  },
  {
    id: 'B',
    label: { fr: 'Identity', en: 'Identity', pt: 'Identity' },
    module: { fr: 'Identité & comptes', en: 'Identity & accounts', pt: 'Identidade & contas' },
    epics: ['11', '12'],
    te: 3.8,
    omp: { o: 3.0, m: 3.8, p: 4.6 },
    phase: '0',
    deps: ['A'],
    critical: true,
    blocks: 'yes',
    note: {
      fr: 'Arbre org, comptes, role_assignment (rôle + scope + marques).',
      en: 'Org tree, accounts, role_assignment (role + scope + brands).',
    },
  },
  {
    id: 'C',
    label: { fr: 'Authz Cerbos', en: 'Authz Cerbos', pt: 'Authz Cerbos' },
    module: { fr: 'Autorisation', en: 'Authorization', pt: 'Autorização' },
    epics: ['T'],
    te: 3.7,
    omp: { o: 2.9, m: 3.7, p: 4.5 },
    phase: '0',
    deps: ['B'],
    critical: true,
    blocks: 'yes',
    note: {
      fr: 'Policies Cerbos, PEP, filters.py (query plan → ORM).',
      en: 'Cerbos policies, PEP, filters.py (query plan → ORM).',
    },
  },
  {
    id: 'D',
    label: { fr: 'LMS', en: 'LMS', pt: 'LMS' },
    module: { fr: 'Apprenant · QCM · KI/PIC', en: 'Learner · QCM · KI/PIC', pt: 'Aprendiz · QCM · KI/PIC' },
    epics: ['01', '02', '03'],
    te: 6.2,
    omp: { o: 4.8, m: 6.2, p: 7.6 },
    phase: '1',
    deps: ['C'],
    critical: true,
    blocks: 'yes',
    note: {
      fr: 'Plus gros module : QCM, parcours, certifications, E2E apprenant.',
      en: 'Largest module: QCM, paths, certifications, learner E2E.',
    },
  },
  {
    id: 'E',
    label: { fr: 'Ops Node', en: 'Ops Node', pt: 'Ops Node' },
    module: { fr: 'Sessions · salles · tickets', en: 'Sessions · rooms · tickets', pt: 'Sessões · salas · tickets' },
    epics: ['04', '05', '06', '08'],
    te: 5.3,
    omp: { o: 4.2, m: 5.3, p: 6.4 },
    phase: '1',
    deps: ['C'],
    critical: false,
    blocks: 'conditional',
    blockNote: {
      fr: 'Bloque J seulement si sessions R1 + webhook session_completed dans le périmètre.',
      en: 'Blocks J only if R1 sessions + session_completed webhook are in scope.',
    },
    note: {
      fr: 'Service Node + contrat webhook E→D.',
      en: 'Node service + E→D webhook contract.',
    },
  },
  {
    id: 'F',
    label: { fr: 'CMS Wagtail', en: 'CMS Wagtail', pt: 'CMS Wagtail' },
    module: { fr: 'Vitrine & blog', en: 'Public site & blog', pt: 'Vitrine & blog' },
    epics: ['13'],
    te: 2.0,
    omp: { o: 1.5, m: 2.0, p: 2.5 },
    phase: '1bis',
    deps: ['A'],
    critical: false,
    blocks: 'partial',
    blockNote: {
      fr: 'Partiel : 00-3 (articles) ; découpable post-J.',
      en: 'Partial: 00-3 (articles); can be split off post-J.',
    },
    note: {
      fr: 'Wagtail intégré (rendu server-side SEO) + migration articles.',
      en: 'Integrated Wagtail (server-side SEO) + article migration.',
    },
  },
  {
    id: 'G',
    label: { fr: 'Recrutement', en: 'Recruitment', pt: 'Recrutamento' },
    module: { fr: 'Pipeline candidats', en: 'Candidate pipeline', pt: 'Pipeline de candidatos' },
    epics: ['09'],
    te: 3.0,
    omp: { o: 2.4, m: 3.0, p: 3.6 },
    phase: '2',
    deps: ['D'],
    critical: false,
    blocks: 'no',
    note: {
      fr: 'Démarre après le socle QCM du LMS — hors release 1 minimale.',
      en: 'Starts after the LMS QCM core — outside the minimal release 1.',
    },
  },
  {
    id: 'H',
    label: { fr: 'Analytics', en: 'Analytics', pt: 'Analytics' },
    module: { fr: 'Dashboards & reporting', en: 'Dashboards & reporting', pt: 'Dashboards & reporting' },
    epics: ['07', '10'],
    te: 3.2,
    omp: { o: 2.5, m: 3.2, p: 3.9 },
    phase: '1.1',
    deps: ['D'],
    critical: false,
    blocks: 'no',
    note: {
      fr: 'Read models + dashboards — release 1.1, post go-live.',
      en: 'Read models + dashboards — release 1.1, post go-live.',
    },
  },
  {
    id: 'I',
    label: { fr: 'Notifications', en: 'Notifications', pt: 'Notificações' },
    module: { fr: 'Emails & notifs in-app', en: 'Emails & in-app notifs', pt: 'Emails & notifs in-app' },
    epics: ['14'],
    te: 2.6,
    omp: { o: 2.0, m: 2.6, p: 3.2 },
    phase: '1.1',
    deps: ['D', 'E'],
    critical: false,
    blocks: 'no',
    blockNote: {
      fr: 'Non bloquant pour J ; socle email requis pour K₂.',
      en: 'Not blocking J; email core required for K₂.',
    },
    note: {
      fr: 'Socle ~0,8 + métier ~1,8 ; event-driven, worker asynchrone.',
      en: 'Core ~0.8 + business ~1.8; event-driven, async worker.',
    },
  },
  {
    id: 'M',
    label: { fr: 'Migration 00', en: 'Migration 00', pt: 'Migração 00' },
    module: { fr: 'Mise en production initiale', en: 'Initial go-to-prod', pt: 'Entrada em produção' },
    epics: ['00'],
    te: 3.6,
    omp: { o: 2.8, m: 3.6, p: 4.4 },
    phase: '1',
    deps: ['B', 'D', 'E', 'F'],
    critical: true,
    blocks: 'yes',
    note: {
      fr: 'Lots 00-x + smoke E2E 00-7. Attend D partiel + E partiel.',
      en: 'Lots 00-x + smoke E2E 00-7. Waits on partial D + partial E.',
    },
  },
  {
    id: 'J',
    label: { fr: 'Gate go-live', en: 'Go-live gate', pt: 'Gate go-live' },
    module: { fr: 'Ouverture utilisateurs', en: 'User opening', pt: 'Abertura utilizadores' },
    epics: ['00'],
    te: 0.5,
    omp: { o: 0.3, m: 0.5, p: 0.7 },
    phase: 'release',
    deps: ['M', 'D'],
    critical: true,
    blocks: 'gate',
    note: {
      fr: 'Checklist signée, validation MOA, rollback documenté.',
      en: 'Signed checklist, MOA validation, documented rollback.',
    },
  },
  {
    id: 'K1',
    label: { fr: 'Delivery socle', en: 'Delivery core', pt: 'Delivery base' },
    module: { fr: 'Cockpit & webhook Git', en: 'Cockpit & Git webhook', pt: 'Cockpit & webhook Git' },
    epics: ['15'],
    te: 1.4,
    omp: { o: 1.0, m: 1.4, p: 1.8 },
    phase: '1',
    deps: ['A', 'B', 'C'],
    critical: false,
    blocks: 'no',
    note: {
      fr: 'Démarre tôt (phase 1) ; ne bloque pas J. Visibilité build.',
      en: 'Starts early (phase 1); does not block J. Build visibility.',
    },
  },
  {
    id: 'K2',
    label: { fr: 'Reporting MOA', en: 'MOA reporting', pt: 'Reporting MOA' },
    module: { fr: 'Rapports jeudi/vendredi', en: 'Thursday/Friday reports', pt: 'Relatórios qui/sex' },
    epics: ['15'],
    te: 1.0,
    omp: { o: 0.7, m: 1.0, p: 1.3 },
    phase: '2',
    deps: ['K1', 'I'],
    critical: false,
    blocks: 'no',
    note: {
      fr: 'Rappel jeudi, rapport formel vendredi — après socle email I.',
      en: 'Thursday reminder, formal Friday report — after email core I.',
    },
  },
]

/* ─── Phases recommandées (planning.md §5) ───────────────────────── */
export const DELIVERY_PHASES = [
  {
    key: '0',
    title: { fr: 'Phase 0 — Plateforme', en: 'Phase 0 — Platform', pt: 'Fase 0 — Plataforma' },
    nodes: ['A', 'B', 'C'],
    objective: {
      fr: 'Plateforme sécurisée, login BFF, CI active.',
      en: 'Secured platform, BFF login, active CI.',
      pt: 'Plataforma segura, login BFF, CI ativa.',
    },
    calendar: 'Sem. 1–10',
  },
  {
    key: '1',
    title: { fr: 'Phase 1 — MVP portail', en: 'Phase 1 — Portal MVP', pt: 'Fase 1 — MVP portal' },
    nodes: ['D', 'E', 'K1', 'M'],
    objective: {
      fr: 'LMS MVP + Ops sessions + pilotage Git/backlog + migration org/comptes.',
      en: 'LMS MVP + Ops sessions + Git/backlog tracking + org/account migration.',
      pt: 'LMS MVP + Ops sessões + pilotagem Git/backlog + migração org/contas.',
    },
    calendar: 'Sem. 8–18',
  },
  {
    key: '1bis',
    title: { fr: 'Phase 1 bis — CMS', en: 'Phase 1b — CMS', pt: 'Fase 1 bis — CMS' },
    nodes: ['F', 'M'],
    objective: {
      fr: 'Wagtail + catalogue/sessions migrés (00-3·4).',
      en: 'Wagtail + migrated catalogue/sessions (00-3·4).',
      pt: 'Wagtail + catálogo/sessões migrados (00-3·4).',
    },
    calendar: 'Sem. 10–18',
  },
  {
    key: '2',
    title: { fr: 'Phase 2 — Validation', en: 'Phase 2 — Validation', pt: 'Fase 2 — Validação' },
    nodes: ['M', 'I', 'K2'],
    objective: {
      fr: 'Validation migration (00-5·7), smoke E2E, socle notifs, premiers rapports MOA.',
      en: 'Migration validation (00-5·7), E2E smoke, notif core, first MOA reports.',
      pt: 'Validação da migração (00-5·7), smoke E2E, base de notifs, primeiros relatórios MOA.',
    },
    calendar: 'Sem. 16–20',
  },
  {
    key: 'release',
    title: { fr: 'Release — Gate J', en: 'Release — Gate J', pt: 'Release — Gate J' },
    nodes: ['J'],
    objective: {
      fr: 'Gate go-live utilisateurs — ~semaine 20 (TE critique ÷ effectif).',
      en: 'User go-live gate — ~week 20 (critical TE ÷ team size).',
      pt: 'Gate go-live utilizadores — ~semana 20 (TE crítica ÷ equipa).',
    },
    calendar: '~Sem. 20',
  },
  {
    key: '1.1',
    title: { fr: 'Phase 1.1 — Analytics & notifs', en: 'Phase 1.1 — Analytics & notifs', pt: 'Fase 1.1 — Analytics & notifs' },
    nodes: ['H', 'I'],
    objective: {
      fr: 'Dashboards + notifications formation complètes — post go-live.',
      en: 'Dashboards + full training notifications — post go-live.',
      pt: 'Dashboards + notificações de formação completas — pós go-live.',
    },
    calendar: 'Post-J',
  },
  {
    key: '2post',
    title: { fr: 'Phase 2 — Recrutement', en: 'Phase 2 — Recruitment', pt: 'Fase 2 — Recrutamento' },
    nodes: ['G'],
    objective: {
      fr: 'Recrutement candidats + webhooks D↔G — post-J ou parallèle tardif.',
      en: 'Candidate recruitment + D↔G webhooks — post-J or late parallel.',
      pt: 'Recrutamento de candidatos + webhooks D↔G — pós-J ou paralelo tardio.',
    },
    calendar: 'Post-J',
  },
]

/* Frise calendaire (planning.md §5, échelle ~26 semaines) */
export const GANTT_SCALE = 26
export const GANTT_BARS = [
  { key: 'A', label: { fr: 'A · Infra + CI', en: 'A · Infra + CI' }, start: 1, end: 4, critical: true },
  { key: 'B', label: { fr: 'B · Identity', en: 'B · Identity' }, start: 4, end: 8, critical: true },
  { key: 'C', label: { fr: 'C · Authz', en: 'C · Authz' }, start: 6, end: 10, critical: true },
  { key: 'D', label: { fr: 'D · LMS', en: 'D · LMS' }, start: 8, end: 18, critical: true },
  { key: 'E', label: { fr: 'E · Ops', en: 'E · Ops' }, start: 8, end: 16, critical: false },
  { key: 'K1', label: { fr: 'K₁ · Delivery', en: 'K₁ · Delivery' }, start: 8, end: 12, critical: false },
  { key: 'M', label: { fr: 'M · Migration', en: 'M · Migration' }, start: 12, end: 20, critical: true },
  { key: 'K2I', label: { fr: 'K₂ · MOA / I socle', en: 'K₂ · MOA / I core' }, start: 16, end: 20, critical: false },
  { key: 'J', label: { fr: 'J · Gate go-live', en: 'J · Go-live gate' }, start: 20, end: 21, critical: true },
  { key: 'HG', label: { fr: 'H · G (optionnel)', en: 'H · G (optional)' }, start: 20, end: 26, critical: false, optional: true },
]

/* ─── Epics (backlog.md) → un nœud, une phase ────────────────────── */
export const DELIVERY_EPICS = [
  { id: '00', title: { fr: 'Migration & initialisation', en: 'Migration & bootstrap', pt: 'Migração & inicialização' }, node: 'M', phase: '1' },
  { id: '01', title: { fr: 'Site public', en: 'Public site', pt: 'Site público' }, node: 'D', phase: '1' },
  { id: '02', title: { fr: 'Espace apprenant (LMS)', en: 'Learner space (LMS)', pt: 'Espaço aprendiz (LMS)' }, node: 'D', phase: '1' },
  { id: '03', title: { fr: 'Espace KI / PIC', en: 'KI / PIC space', pt: 'Espaço KI / PIC' }, node: 'D', phase: '1' },
  { id: '04', title: { fr: 'Espace formateur', en: 'Trainer space', pt: 'Espaço formador' }, node: 'E', phase: '1' },
  { id: '05', title: { fr: 'Planning & salles', en: 'Planning & rooms', pt: 'Planeamento & salas' }, node: 'E', phase: '1' },
  { id: '06', title: { fr: 'Assistance formateurs', en: 'Trainer support', pt: 'Assistência formadores' }, node: 'E', phase: '1' },
  { id: '07', title: { fr: 'Tableau de bord management', en: 'Management dashboard', pt: 'Painel de gestão' }, node: 'H', phase: '1.1' },
  { id: '08', title: { fr: 'Gestion des sessions', en: 'Session management', pt: 'Gestão de sessões' }, node: 'E', phase: '1' },
  { id: '09', title: { fr: 'Recrutement & candidats', en: 'Recruitment & candidates', pt: 'Recrutamento & candidatos' }, node: 'G', phase: '2' },
  { id: '10', title: { fr: 'Reporting formation', en: 'Training reporting', pt: 'Reporting de formação' }, node: 'H', phase: '1.1' },
  { id: '11', title: { fr: 'Administration RH & comptes', en: 'HR & account admin', pt: 'Administração RH & contas' }, node: 'B', phase: '0' },
  { id: '12', title: { fr: 'Administration plateforme', en: 'Platform administration', pt: 'Administração plataforma' }, node: 'B', phase: '0' },
  { id: '13', title: { fr: 'Blog / CMS (Wagtail)', en: 'Blog / CMS (Wagtail)', pt: 'Blog / CMS (Wagtail)' }, node: 'F', phase: '1bis' },
  { id: '14', title: { fr: 'Notifications', en: 'Notifications', pt: 'Notificações' }, node: 'I', phase: '1.1' },
  { id: '15', title: { fr: 'Pilotage projet & reporting', en: 'Project delivery & reporting', pt: 'Gestão de projeto & reporting' }, node: 'K1', phase: '1' },
  { id: 'T', title: { fr: 'Stories transverses', en: 'Cross-cutting stories', pt: 'Stories transversais' }, node: 'C', phase: '0' },
]

/* ─── Stories (backlog.md complet) ───────────────────────────────── */
/* status par défaut 'todo' ; tests par défaut TU/TI 'pending', contrat/E2E 'na'.
   `c` = contrat 'pending', `e` = e2e 'pending' (raccourcis de seed). */
const S = (id, epic, fr, en, opts = {}) => ({ id, epic, label: { fr, en }, ...opts })

export const DELIVERY_STORIES = [
  // 00 · Migration
  S('00-1', '00', 'Initialiser la structure organisationnelle (org, agences, départements, marques)', 'Bootstrap org structure (orgs, agencies, departments, brands)', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('00-2', '00', 'Importer les comptes collaborateurs existants', 'Import existing staff accounts', { e: true }),
  S('00-3', '00', 'Migrer les articles React → Wagtail', 'Migrate React articles → Wagtail'),
  S('00-4', '00', 'Migrer le catalogue de formations et les sessions', 'Migrate the training catalogue and sessions', { c: true }),
  S('00-5', '00', 'Valider chaque lot migré (intégrité, rôles, scopes)', 'Validate each migrated lot (integrity, roles, scopes)', { e: true }),
  S('00-6', '00', 'Initialiser le realm Keycloak via config-as-code', 'Bootstrap the Keycloak realm via config-as-code', { status: 'done', tests: { tu: 'na', ti: 'done', contract: 'na', e2e: 'na' } }),
  S('00-7', '00', 'Smoke tests post-migration : 1 compte par rôle', 'Post-migration smoke tests: one account per role', { e: true }),
  S('00-8', '00', 'Gate go-live : checklist + smoke + rollback', 'Go-live gate: checklist + smoke + rollback', { e: true }),
  // 01 · Site public
  S('01-1', '01', 'Parcourir le catalogue des formations', 'Browse the training catalogue', { e: true }),
  S('01-2', '01', 'Consulter les sessions ouvertes et le calendrier', 'View open sessions and the calendar', { e: true }),
  S('01-3', '01', 'Lire les actualités', 'Read the news'),
  S('01-4', '01', 'Envoyer un message via le formulaire de contact', 'Send a message via the contact form', { e: true }),
  S('01-5', '01', 'Accéder à mon portail selon mon rôle', 'Access my role-based portal', { e: true }),
  // 02 · Espace apprenant
  S('02-1', '02', 'Voir mes modules attribués', 'View my assigned modules', { e: true }),
  S('02-2', '02', 'Suivre des modules e-learning', 'Follow e-learning modules', { e: true }),
  S('02-3', '02', 'Passer mes évaluations (QCM)', 'Take my assessments (QCM)', { e: true }),
  S('02-4', '02', 'Suivre ma progression', 'Track my progress'),
  S('02-5', '02', 'Télécharger mes attestations et certifications', 'Download my certificates'),
  S('02-6', '02', 'KI/PIC : suivre mon propre parcours d’apprenant', 'KI/PIC: follow my own learner path'),
  S('02-7', '02', 'Chef d’équipe/atelier : consulter la progression de mon équipe', 'Team/workshop manager: view my team progress'),
  S('02-8', '02', 'RH/Admin : consulter les dossiers de formation', 'HR/Admin: view training records'),
  // 03 · Espace KI/PIC
  S('03-1', '03', 'KI/PIC : voir les formations que je dois dispenser', 'KI/PIC: view trainings I must deliver'),
  S('03-2', '03', 'KI/PIC : voir mes apprenants assignés', 'KI/PIC: view my assigned learners'),
  S('03-3', '03', 'Animer et enregistrer une formation interne en filiale', 'Run and log an in-branch internal training', { e: true }),
  S('03-4', '03', 'Saisir les évaluations de mes apprenants', 'Enter my learners’ assessments'),
  S('03-5', '03', 'Valider les compétences terrain', 'Validate field competencies'),
  S('03-6', '03', 'Consulter les contenus pédagogiques de référence', 'Access reference training content'),
  S('03-7', '03', 'Chef d’atelier : voir les KI/PIC et leurs apprenants', 'Workshop manager: view KI/PIC and their learners'),
  S('03-8', '03', 'Admin filiale : gérer les habilitations KI/PIC', 'Branch admin: manage KI/PIC accreditations'),
  // 04 · Espace formateur
  S('04-1', '04', 'Voir mes sessions à animer', 'View my sessions to deliver'),
  S('04-2', '04', 'Gérer mes contenus pédagogiques', 'Manage my training content'),
  S('04-3', '04', 'Gérer les feuilles d’émargement', 'Manage attendance sheets'),
  S('04-4', '04', 'Évaluer les stagiaires', 'Assess trainees'),
  S('04-5', '04', 'Rédiger un rapport post-formation', 'Write a post-training report'),
  S('04-6', '04', 'Assistante : planning et affectations logistiques', 'Assistant: scheduling and logistics assignments'),
  S('04-7', '04', 'Directeur centre : valider contenus et affecter sessions', 'Center director: validate content and assign sessions'),
  // 05 · Planning & salles
  S('05-1', '05', 'Réserver un créneau, une salle ou un équipement', 'Book a slot, room or equipment', { c: true }),
  S('05-2', '05', 'Voir le planning général et l’occupation', 'View overall schedule and occupancy'),
  S('05-3', '05', 'Assistante : gérer le planning et arbitrer les conflits', 'Assistant: manage schedule and resolve conflicts'),
  S('05-4', '05', 'Directeur centre : valider et vue d’ensemble', 'Center director: validate and overview'),
  // 06 · Assistance / tickets
  S('06-1', '06', 'Créer un ticket (logistique, pédagogique, technique)', 'Create a ticket (logistics, training, technical)'),
  S('06-2', '06', 'Suivre la résolution et clôturer mon ticket', 'Track resolution and close my ticket'),
  S('06-3', '06', 'Assistante : traiter, répondre, affecter, clôturer', 'Assistant: handle, reply, assign, close', { c: true }),
  S('06-4', '06', 'Directeur centre : superviser et escalader', 'Center director: supervise and escalate'),
  // 07 · Tableau de bord management
  S('07-1', '07', 'Manager : KPIs de mon équipe filtrés par périmètre', 'Manager: my team KPIs scoped'),
  S('07-2', '07', 'Directeur : vue consolidée selon mon périmètre org', 'Director: consolidated view by org scope'),
  S('07-3', '07', 'Formateur : stats de mes sessions', 'Trainer: my session stats'),
  S('07-4', '07', 'Directeur centre : performance Academy et formateurs', 'Center director: Academy and trainer performance'),
  S('07-5', '07', 'Super admin : configurer les KPIs', 'Super admin: configure KPIs'),
  // 08 · Gestion des sessions
  S('08-1', '08', 'Créer/modifier une session, ouvrir les inscriptions', 'Create/edit a session, open registrations', { c: true, e: true }),
  S('08-2', '08', 'Gérer la liste des stagiaires', 'Manage the trainee list'),
  S('08-3', '08', 'RH/Admin : inscrire des collaborateurs', 'HR/Admin: enroll staff', { c: true }),
  S('08-4', '08', 'Chef d’atelier : proposer des inscriptions', 'Workshop manager: propose enrollments'),
  S('08-5', '08', 'Formateur : saisir présences et résultats', 'Trainer: enter attendance and results', { c: true, e: true }),
  S('08-6', '08', 'Directeur centre : annuler/modifier en profondeur', 'Center director: cancel/deeply edit'),
  // 09 · Recrutement
  S('09-1', '09', 'Candidat : compléter mon dossier de candidature', 'Candidate: complete my application'),
  S('09-2', '09', 'Candidat : passer mes évaluations et voir mes résultats', 'Candidate: take assessments and see results', { c: true, e: true }),
  S('09-3', '09', 'RH : créer un dossier et assigner des évals par marque', 'HR: create a file and assign brand assessments'),
  S('09-4', '09', 'Correcteur : saisir les résultats des évaluations', 'Grader: enter assessment results'),
  S('09-5', '09', 'Directeur filiale : valider une décision de recrutement', 'Branch director: validate a hiring decision'),
  S('09-6', '09', 'Système : basculer le candidat embauché vers son rôle terrain', 'System: switch hired candidate to field role', { c: true }),
  S('09-7', '09', 'RH groupe : benchmarks inter-filiales', 'Group HR: cross-branch benchmarks'),
  // 10 · Reporting formation
  S('10-1', '10', 'Consulter les analytics consolidés sur mon périmètre', 'View consolidated analytics for my scope'),
  S('10-2', '10', 'Ventiler les données par org et par marque', 'Break down data by org and brand'),
  S('10-3', '10', 'Super admin : exporter et configurer les rapports', 'Super admin: export and configure reports'),
  // 11 · Admin RH & comptes
  S('11-1', '11', 'Créer/modifier un compte et assigner rôle + scope', 'Create/edit an account and assign role + scope', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('11-2', '11', 'Attribuer des fonctionnalités spécifiques à une personne', 'Grant specific features to a person'),
  S('11-3', '11', 'RH : mettre à jour les infos RH d’un collaborateur', 'HR: update a staff member’s HR info'),
  S('11-4', '11', 'Assistante : gérer inscriptions et convocations', 'Assistant: manage enrollments and invitations'),
  S('11-5', '11', 'Consulter les historiques', 'View histories'),
  // 12 · Admin plateforme
  S('12-1', '12', 'Créer/modifier filiales, agences, départements', 'Create/edit branches, agencies, departments', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('12-2', '12', 'Gérer les marques assignées par département', 'Manage brands assigned per department', { status: 'in_progress', tests: { tu: 'done', ti: 'pending', contract: 'na', e2e: 'na' } }),
  S('12-3', '12', 'Super admin : gérer les rôles système', 'Super admin: manage system roles'),
  S('12-4', '12', 'Super admin : consulter les logs d’audit', 'Super admin: view audit logs', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('12-5', '12', 'Super admin : configurer branding et intégrations', 'Super admin: configure branding and integrations'),
  // 13 · Blog / CMS
  S('13-1', '13', 'Rédiger un article (événement, certification, nouveauté)', 'Write an article (event, certification, news)'),
  S('13-2', '13', 'Gérer les médias et images', 'Manage media and images'),
  S('13-3', '13', 'Workflow brouillon → relecture → publication', 'Draft → review → publish workflow'),
  S('13-4', '13', 'Visiteur : lire les articles (rendu server-side Wagtail/SEO)', 'Visitor: read articles (server-side Wagtail/SEO)', { e: true }),
  S('13-5', '13', 'Portail : derniers articles via API headless (optionnel)', 'Portal: latest articles via headless API (optional)', { c: true }),
  // 14 · Notifications
  S('14-1', '14', 'Confirmation d’inscription à une session', 'Session registration confirmation'),
  S('14-2', '14', 'Rappel avant une session', 'Pre-session reminder'),
  S('14-3', '14', 'Notification de certification délivrée', 'Certificate issued notification'),
  S('14-4', '14', 'Notification de ticket résolu', 'Ticket resolved notification'),
  S('14-5', '14', 'Notification d’évaluation assignée (candidat)', 'Assessment assigned notification (candidate)'),
  S('14-6', '14', 'Notification de formation à dispenser (KI/PIC)', 'Training-to-deliver notification (KI/PIC)'),
  S('14-7', '14', 'Notification de session affectée (formateur)', 'Session assigned notification (trainer)'),
  S('14-8', '14', 'Préférences de notification (opt-in/opt-out)', 'Notification preferences (opt-in/opt-out)'),
  S('14-9', '14', 'Centre de notifications in-app', 'In-app notification center'),
  S('14-10', '14', 'Envoi asynchrone et événementiel', 'Async, event-driven sending', { c: true }),
  S('14-11', '14', 'Scheduler de notifications temporelles', 'Scheduler for time-based notifications'),
  // 15 · Pilotage projet
  S('15-1', '15', 'Visualiser la roadmap (epics, phases, PERT)', 'View the roadmap (epics, phases, PERT)', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('15-2', '15', 'Synchroniser/saisir le statut des stories', 'Sync/enter story status', { status: 'in_progress', tests: { tu: 'done', ti: 'pending', contract: 'na', e2e: 'na' } }),
  S('15-3', '15', 'Marquer l’état des tests TU→TI→contrat→E2E', 'Mark test state UT→IT→contract→E2E', { status: 'in_progress', tests: { tu: 'done', ti: 'pending', contract: 'na', e2e: 'na' } }),
  S('15-4', '15', 'Connecter le dépôt Git (URL, token, secret webhook)', 'Connect the Git repo (URL, token, webhook secret)', { c: true }),
  S('15-5', '15', 'Recevoir les webhooks push et persister les commits', 'Receive push webhooks and persist commits', { c: true }),
  S('15-6', '15', 'Mapper les auteurs Git aux membres de l’équipe', 'Map Git authors to team members'),
  S('15-7', '15', 'Extraire IDs story et sections structurées des commits', 'Extract story IDs and structured sections from commits'),
  S('15-8', '15', 'Configurer destinataires MOA et calendrier d’envoi', 'Configure MOA recipients and send schedule'),
  S('15-9', '15', 'Rapport MOA formel hebdomadaire (vendredi)', 'Weekly formal MOA report (Friday)', { c: true }),
  S('15-10', '15', 'Consulter l’historique des rapports et prévisualiser', 'View report history and preview'),
  S('15-11', '15', 'Directeur groupe : vue exécutive (jalons, % done, gate)', 'Group director: executive view (milestones, % done, gate)'),
  S('15-12', '15', 'Email de rappel aux devs (jeudi)', 'Developer reminder email (Thursday)'),
  S('15-13', '15', 'Tech lead : relire et valider le brouillon vendredi', 'Tech lead: review and approve the Friday draft'),
  // Transverses
  S('T-1', 'T', 'Connexion via SSO (Keycloak puis Okta)', 'SSO login (Keycloak then Okta)', { status: 'done', tests: { tu: 'na', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('T-2', 'T', 'Résoudre le périmètre 3D (org × département × marque)', 'Resolve the 3D scope (org × department × brand)', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'na', e2e: 'done' } }),
  S('T-3', 'T', 'Appeler Cerbos (check / query plan) sur chaque requête', 'Call Cerbos (check / query plan) on each request', { status: 'done', tests: { tu: 'done', ti: 'done', contract: 'done', e2e: 'done' } }),
  S('T-4', 'T', 'Propager org_restructured (recalcul des périmètres)', 'Propagate org_restructured (recompute scopes)', { c: true }),
]

const DEFAULT_TESTS = { tu: 'pending', ti: 'pending', contract: 'na', e2e: 'na' }

/** Normalise une story : applique les tests par défaut + raccourcis c/e. */
export function normalizeStory(story) {
  if (story.tests) return { status: 'todo', ...story }
  const tests = { ...DEFAULT_TESTS }
  if (story.c) tests.contract = 'pending'
  if (story.e) tests.e2e = 'pending'
  return { status: 'todo', ...story, tests }
}

export const NORMALIZED_STORIES = DELIVERY_STORIES.map(normalizeStory)

/* ─── Gate J — critères de passage (planning.md §4) ──────────────── */
export const GATE_CHECKLIST = [
  { id: 'g1', done: false, label: { fr: '00-5 — tous les lots migrés validés (org, comptes, contenus, catalogue)', en: '00-5 — all migrated lots validated (org, accounts, content, catalogue)', pt: '00-5 — todos os lotes migrados validados' } },
  { id: 'g2', done: false, label: { fr: '00-7 — smoke E2E vert pour chaque rôle du périmètre R1', en: '00-7 — green E2E smoke per R1 role', pt: '00-7 — smoke E2E verde por perfil R1' } },
  { id: 'g3', done: false, label: { fr: 'Chemin critique A→B→C→D livré (QCM + parcours apprenant minimum)', en: 'Critical path A→B→C→D delivered (QCM + minimum learner path)', pt: 'Caminho crítico A→B→C→D entregue' } },
  { id: 'g4', done: false, label: { fr: 'E partiel : inscriptions + webhook E→D (session_completed) testé — si sessions R1', en: 'Partial E: registrations + tested E→D webhook (session_completed) — if R1 sessions', pt: 'E parcial: inscrições + webhook E→D testado — se sessões R1' } },
  { id: 'g5', done: false, label: { fr: 'Suite TU→TI→contrat→E2E verte sur le périmètre R1', en: 'UT→IT→contract→E2E suite green on R1 scope', pt: 'Suite TU→TI→contrato→E2E verde no âmbito R1' } },
  { id: 'g6', done: false, label: { fr: 'Webhook D→G (assessment_completed) — uniquement si recrutement dans R1', en: 'D→G webhook (assessment_completed) — only if recruitment in R1', pt: 'Webhook D→G — apenas se recrutamento em R1' } },
  { id: 'g7', done: false, label: { fr: 'Sauvegarde + procédure de restauration Keycloak & Postgres documentées', en: 'Backup + Keycloak & Postgres restore procedure documented', pt: 'Cópia de segurança + restauro Keycloak & Postgres documentados' } },
  { id: 'g8', done: false, label: { fr: 'Pas d’ouverture prod sans gate J explicitement signée', en: 'No prod opening without an explicitly signed gate J', pt: 'Sem abertura em produção sem gate J assinada' } },
]

/* ─── Événements & webhooks inter-services (planning.md §3) ──────── */
export const DELIVERY_EVENTS = [
  { event: 'session_completed', from: 'Ops', to: 'LMS', arrow: 'E ⇢ D', kind: 'webhook', effect: { fr: 'Résultats de session → compétences & certifications', en: 'Session results → competencies & certifications' } },
  { event: 'assessment_completed', from: 'LMS', to: 'Recrutement', arrow: 'D ⇢ G', kind: 'signal', effect: { fr: 'Score QCM candidat → dossier de recrutement', en: 'Candidate QCM score → recruitment file' } },
  { event: 'candidate_hired', from: 'Recrutement', to: 'Identity + LMS', arrow: 'G ⇢ B', kind: 'signal', effect: { fr: 'Bascule candidat → learner + parcours initial', en: 'Candidate → learner switch + initial path' } },
  { event: 'assessment_assigned', from: 'Recrutement', to: 'Notifications', arrow: 'G ⇢ I', kind: 'event', effect: { fr: 'Email/notif au candidat', en: 'Email/notif to candidate' } },
  { event: 'session_assigned', from: 'Ops', to: 'Notifications', arrow: 'E ⇢ I', kind: 'event', effect: { fr: 'Notification au formateur', en: 'Notification to trainer' } },
  { event: 'ticket_resolved', from: 'Ops', to: 'Notifications', arrow: 'E ⇢ I', kind: 'event', effect: { fr: 'Notification au demandeur', en: 'Notification to requester' } },
  { event: 'enrollment_created', from: 'LMS', to: 'Analytics', arrow: 'D ⇢ H', kind: 'signal', effect: { fr: 'Rafraîchit les read models', en: 'Refreshes read models' } },
  { event: 'certificate_issued', from: 'LMS', to: 'Analytics', arrow: 'D ⇢ H', kind: 'signal', effect: { fr: 'Rafraîchit les read models', en: 'Refreshes read models' } },
  { event: 'ki_training_assigned', from: 'LMS', to: 'Notifications', arrow: 'D ⇢ I', kind: 'event', effect: { fr: 'Notif KI/PIC (formation à dispenser)', en: 'KI/PIC notif (training to deliver)' } },
  { event: 'org_restructured', from: 'Identity', to: 'Ops + Analytics', arrow: 'B ⇢ E, H', kind: 'event', effect: { fr: 'Recalcul batch des orgPath (rare)', en: 'Batch recompute of orgPath (rare)' } },
]

/* ─── Reporting MOA / Git (inchangé pour l'essentiel) ────────────── */
export const GIT_CONFIG = {
  provider: 'github',
  repoUrl: 'https://github.com/cfao/cfao-academy',
  webhookUrl: '/api/v1/core/delivery/webhooks/git',
  connected: false,
  lastPushAt: null,
}

export const DIGEST_SCHEDULE = {
  devReminderDay: 'thursday',
  devReminderTime: '16:00',
  moaReportDay: 'friday',
  moaReportTime: '09:00',
  timezone: 'Africa/Douala',
}

export const DIGEST_RECIPIENTS = [
  { id: 'r1', email: 'moa@cfao.com', name: 'Comité de pilotage' },
  { id: 'r2', email: 'direction.projet@cfao.com', name: 'Direction projet' },
]

export const DIGEST_HISTORY = [
  { id: 'd-2026-w22', week: '2026-W22', sentAt: '30 mai 2026', status: 'sent', previewKey: 'digest_preview_w22' },
]

export const RECENT_COMMITS = [
  {
    id: 'c1', sha: 'a3f91c2', author: 'Équipe build', date: '4 juin 2026',
    subject: '15-1: maquette cockpit pilotage projet',
    avancement: 'Mise en place de l’interface de suivi de la roadmap et du backlog pour le comité de pilotage.',
    storyIds: ['15-1'],
  },
  {
    id: 'c2', sha: 'b8e204f', author: 'Équipe build', date: '3 juin 2026',
    subject: 'docs: planning PERT v2 et annexe O/M/P',
    avancement: 'Documentation de la planification projet et des estimations pour faciliter le recalibrage après le sprint 0.',
    storyIds: [],
  },
]

export const WEEKLY_STATUS_DRAFT = {
  week: '2026-W23',
  avancements: [
    'Démarrage de l’app 15 — gestionnaire de projet dans le portail.',
    'Documentation CONTRIBUTING pour les rapports hebdomadaires MOA.',
  ],
  objectifsEnCours: [
    'Scaffolding infra Docker (nœud A du PERT).',
    'Connexion du dépôt Git à l’environnement de staging.',
  ],
  objectifsSemaineProchaine: [
    'Premier healthcheck cfao-core et cfao-operations.',
    'Pipeline CI avec tests unitaires sur les squelettes.',
  ],
  goulots: [
    'Dépôt Git et environnement staging à finaliser.',
  ],
}

/* ─── Merge état local (localStorage) ────────────────────────────── */
export function mergeDeliveryState(baseStories, stored) {
  if (!stored?.stories) return baseStories
  return baseStories.map(s => {
    const patch = stored.stories[s.id]
    if (!patch) return s
    return { ...s, ...patch, tests: { ...s.tests, ...patch.tests } }
  })
}

export function mergeGateState(base, stored) {
  if (!stored?.gate) return base
  return base.map(item => ({ ...item, done: stored.gate[item.id] ?? item.done }))
}
