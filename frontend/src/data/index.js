// Source de vérité unique — catalogue CFAO Academy 2026
import { isPlMedacapVariant } from '../utils/portalVariant.js'
import { isMedacapLearner, medacapLearnerSections } from '../utils/medacapLearner.js'
import { sessionsDuFormateur } from './mock_sessions_formateur.js'

/** Masqué temporairement — section #sessions accueil + entrée navbar */
export const HOME_SESSIONS_SECTION_VISIBLE = false

export const STATS = {
  sessions: 253,
  jours: 1114,
  bu: 5,
  marques: 22,
  experts: 28,
  ki: 18,
  picMulti: 22,
  picDev: 35,
  paysActifs: 29,
  paysPotentiels: 4,
}

/** Liens navbar — ordre des sections principales de l’accueil */
const NAV_ITEMS = [
  { label: 'Actualités',  to: '/#actualites', hash: 'actualites', key: 'actualites' },
  { label: 'Publics',     to: '/#publics',    hash: 'publics',    key: 'publics' },
  { label: 'Nos Offres',  to: '/#offres',     hash: 'offres',     key: 'offres' },
  { label: 'Sessions',    to: '/#sessions',   hash: 'sessions',   key: 'sessions' },
  { label: "L'Academy",   to: '/#expertise',  hash: 'expertise',  key: 'academy' },
]
export const NAV = HOME_SESSIONS_SECTION_VISIBLE
  ? NAV_ITEMS
  : NAV_ITEMS.filter((n) => n.key !== 'sessions')

/** Priorité de rôle portal (le plus haut gagne) */
export const ROLE_PRIORITY = [
  'superadmin','build_team','group_admin','group_hr',
  'branch_director','branch_hr','branch_admin',
  'dop','dps','workshop_manager','team_manager',
  'ki','pic','trainer','center_director','center_assistant',
]

export function getPrimaryRole(roles = []) {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r
  }
  return 'learner'
}

/** Sections du portail par rôle — affichées dans la navbar */
export const PORTAL_NAV_SECTIONS = {
  learner: [
    { key: 'priorities', id: 'next-actions', labelKey: 'nav_sec_priorities' },
    { key: 'tests',      id: 'tests',      labelKey: 'nav_sec_tests' },
    { key: 'resultats',  id: 'resultats',  labelKey: 'nav_sec_competency_results' },
    { key: 'pif',        id: 'pif',        labelKey: 'nav_sec_pif' },
    { key: 'suggested',  id: 'formations-suggerees', labelKey: 'nav_sec_suggested_trainings' },
    { key: 'certifs',    id: 'certifs',    labelKey: 'nav_sec_certifs' },
    { key: 'assistance', id: 'assistance', labelKey: 'nav_sec_assistance' },
  ],
  ki: [
    { key: 'bilan',      id: 'bilan',      labelKey: 'nav_sec_ki_overview' },
    { key: 'fad',        id: 'fad',        labelKey: 'nav_sec_fad' },
    { key: 'apprenants', id: 'apprenants', labelKey: 'nav_sec_apprenants' },
    { key: 'parcours',   id: 'parcours',   labelKey: 'nav_sec_ki_path' },
  ],
  pic: [
    { key: 'bilan',      id: 'bilan',      labelKey: 'nav_sec_bilan' },
    { key: 'fad',        id: 'fad',        labelKey: 'nav_sec_fad' },
    { key: 'apprenants', id: 'apprenants', labelKey: 'nav_sec_apprenants' },
  ],
  team_manager: [
    { key: 'equipe',     id: 'equipe',     labelKey: 'nav_sec_equipe' },
    { key: 'resultats',  id: 'resultats',  labelKey: 'nav_sec_resultats' },
    { key: 'plans',      id: 'plans',      labelKey: 'nav_sec_tm_plans' },
    { key: 'assistance', id: 'assistance', labelKey: 'nav_sec_assistance' },
  ],
  workshop_manager: [
    { key: 'equipes',    id: 'equipes',    labelKey: 'nav_sec_equipes' },
    { key: 'resultats',  id: 'resultats',  labelKey: 'nav_sec_resultats' },
    { key: 'plans',      id: 'plans',      labelKey: 'nav_sec_tm_plans' },
    { key: 'assistance', id: 'assistance', labelKey: 'nav_sec_assistance' },
  ],
  dps: [
    { key: 'bilan',      id: 'bilan',      labelKey: 'nav_sec_bilan' },
    { key: 'equipe',     id: 'equipe',     labelKey: 'nav_sec_equipe' },
  ],
  dop: [
    { key: 'bilan',  id: 'bilan',  labelKey: 'nav_sec_bilan' },
    { key: 'equipe', id: 'equipe', labelKey: 'nav_sec_equipe' },
  ],
  branch_director: [
    { key: 'bilan',   id: 'bilan',   labelKey: 'nav_sec_bilan' },
    { key: 'equipe',  id: 'equipe',  labelKey: 'nav_sec_equipe' },
    { key: 'certifs', id: 'certifs', labelKey: 'nav_sec_certifs' },
  ],
  branch_hr: [
    { key: 'bilan',     id: 'bilan',     labelKey: 'nav_sec_bilan' },
    { key: 'directory', id: 'directory', labelKey: 'nav_sec_directory' },
  ],
  branch_admin: [
    { key: 'bilan',     id: 'bilan',     labelKey: 'nav_sec_bilan' },
    { key: 'directory', id: 'directory', labelKey: 'nav_sec_directory' },
  ],
  group_hr: [
    { key: 'bilan',     id: 'bilan',     labelKey: 'nav_sec_bilan' },
    { key: 'branches',  id: 'branches',  labelKey: 'nav_sec_branches' },
    { key: 'directory', id: 'directory', labelKey: 'nav_sec_directory' },
  ],
  group_admin: [
    { key: 'bilan',     id: 'bilan',     labelKey: 'nav_sec_bilan' },
    { key: 'branches',  id: 'branches',  labelKey: 'nav_sec_branches' },
    { key: 'directory', id: 'directory', labelKey: 'nav_sec_directory' },
    { key: 'logs',      id: 'logs',      labelKey: 'nav_sec_logs' },
  ],
  superadmin: [
    { key: 'bilan',     id: 'bilan',     labelKey: 'nav_sec_bilan' },
    { key: 'branches',  id: 'branches',  labelKey: 'nav_sec_branches' },
    { key: 'directory', id: 'directory', labelKey: 'nav_sec_directory' },
    { key: 'logs',      id: 'logs',      labelKey: 'nav_sec_logs' },
  ],
  trainer: [
    { key: 'a-documenter',     id: 'a-documenter',     labelKey: 'nav_sec_a_documenter' },
    { key: 'comptes-rendus',   id: 'comptes-rendus',   labelKey: 'nav_sec_comptes_rendus' },
    { key: 'sessions-a-venir', id: 'sessions-a-venir', labelKey: 'nav_sec_sessions_animees' },
  ],
}

export function getPortalNavSections(roles) {
  const role = getPrimaryRole(roles)
  return PORTAL_NAV_SECTIONS[role] ?? PORTAL_NAV_SECTIONS.learner
}

/**
 * Conditions d'affichage des sections apprenant optionnelles.
 * Une section absente de cette table est toujours visible.
 * Chaque prédicat reçoit le profil LMS et répond « cette section a-t-elle du
 * contenu ? » — la navbar reste ainsi alignée sur ce que la page rend vraiment.
 */
const LEARNER_SECTION_VISIBILITY = {
  certifs:   ({ lms }) => Boolean(lms?.certifications?.length),
  suggested: ({ lms }) => isPlMedacapVariant(lms),
  // Même condition que la page : un learner MEDACAP ne voit le PIF que si la
  // section est effectivement rendue (cf. LearnerDashboard).
  pif: ({ lms, user }) => !isMedacapLearner(user) || medacapLearnerSections(lms).pif,
}

/**
 * Sections de navbar réellement affichables pour un utilisateur donné.
 * `lms` est le profil LMS du portail (peut être absent : on retombe alors sur
 * les sections du rôle, sans filtrage).
 */
export function resolvePortalNavSections(roles, lms, user) {
  const sections = getPortalNavSections(roles)
  // Formateur : l'onglet des sessions suit la section, absente sans session a venir.
  if (getPrimaryRole(roles) === 'trainer') {
    const aVenir = sessionsDuFormateur(user).some(s => s.statut === 'en_cours' || s.statut === 'a_venir')
    return aVenir ? sections : sections.filter(s => s.key !== 'sessions-a-venir')
  }
  if (getPrimaryRole(roles) !== 'learner' || !lms) return sections
  return sections.filter(section => {
    const isVisible = LEARNER_SECTION_VISIBILITY[section.key]
    return isVisible ? isVisible({ lms, user }) : true
  })
}

/** Sections observées au scroll (ordre page) → clé NAV */
const NAV_SPY_ITEMS = [
  { key: 'actualites', id: 'actualites' },
  { key: 'publics', id: 'publics' },
  { key: 'offres', id: 'offres' },
  { key: 'offres', id: 'formations-equipment' },
  { key: 'offres', id: 'formations-carrosserie' },
  { key: 'offres', id: 'formations-sav-motors' },
  { key: 'offres', id: 'formations-sav-equipment' },
  { key: 'sessions', id: 'sessions' },
  { key: 'academy', id: 'expertise' },
]
export const NAV_SPY_SECTIONS = HOME_SESSIONS_SECTION_VISIBLE
  ? NAV_SPY_ITEMS
  : NAV_SPY_ITEMS.filter((s) => s.key !== 'sessions')

const MOIS_SHORT = ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOUT', 'SEPT', 'OCT', 'NOV', 'DEC']

export const BU = [
  { id: 'Techniques Motors',         short: 'Motors',      n: 113, meta: 'VL · Moto',                         tag: 'motors' },
  { id: 'Techniques Equipment',      short: 'Equipment',   n: 72,  meta: 'Camions · Bus · Engins · Chariots', tag: 'equipment' },
  { id: 'Techniques Carrosserie',    short: 'Carrosserie', n: 29,  meta: 'N1 - N5',                           tag: 'carrosserie' },
  { id: 'Parts & Process Motors',    short: 'SAV Motors',    n: 25,  meta: 'Audit · Standard',                  tag: 'parts-motors' },
  { id: 'Parts & Process Equipment', short: 'SAV Equipment', n: 14,  meta: 'Plateformes pièces',                tag: 'parts-eq' },
]

export const PUBLICS = [
  {
    name: 'Techniciens Voitures',
    kicker: 'Atelier · VL',
    niv: 'Junior → Expert',
    img: '/assets/hero/cta_hover_vl.jpg',
    meta: 'Maintenance préventive, réparation et diagnostic sur véhicules légers — parcours certifiant G4 → G1 multi-marques Motors.',
    famille: 'Atelier',
    color: '#f97316',
  },
  {
    name: 'Techniciens Poids lourds, Engins, Chariots & Bus',
    kicker: 'Atelier · Equipment',
    niv: 'Junior → Expert',
    img: '/assets/hero/cta_hover_pl.jpg',
    meta: 'Compétences techniciens sur poids lourds, engins de chantier, chariots élévateurs et bus — standards constructeurs Equipment.',
    famille: 'Atelier',
    color: '#ea580c',
  },
  { name: 'Carrossiers',          kicker: 'Atelier · N1-N5', niv: 'Junior → Expert', img: '/assets/hero/cta_hover_carrosserie.png',        meta: 'Redressage acier, préparation de surface, remplacement de vitrages et raccords multicouches — du débourrage N1 à la maîtrise des teintes N5.',         famille: 'Atelier',       color: '#f97316' },
  { name: 'Parts',                kicker: 'Pièces',          niv: 'Comptoir · Stock',      img: '/assets/hero/cta_hover_sav.jpg',      meta: 'Organisation du département pièces, référencement, gestion de stock et argumentation technique selon les standards constructeurs.',             famille: 'Process & SAV', color: '#059669' },
  { name: 'Technico-commerciaux', kicker: 'Vente',           niv: 'Produit · Vente', img: '/assets/publics/technico-commerciaux.jpg',   meta: 'Maîtrise produit et argumentation technique de vente — pour les vendeurs qui allient connaissance véhicule et performance commerciale.',                    famille: 'Vente',         color: '#1a56db' },
  { name: 'Commerciaux',          kicker: 'Vente',           niv: 'Réception · SAV', img: '/assets/publics/commerciaux.jpg',   meta: 'Accueil, prise en charge et accompagnement client au SAV — du réceptionnaire au conseiller service confirmé.',               famille: 'Vente',         color: '#1a56db' },
  { name: 'Process SAV & Parts',  kicker: 'Process',         niv: 'Standards · KPI',    img: '/assets/hero/cta_hover_sav.jpg',    meta: 'Application des standards constructeurs, pilotage des indicateurs SAV et Parts, conformité aux exigences réseau KI/PIC.',                   famille: 'Process & SAV', color: '#059669' },
  { name: 'Clients',              kicker: 'Client B2B',      niv: 'Partenaires B2B',       img: '/assets/hero/cta_hover_b2b.jpg',       meta: 'Techniciens, carrossiers et gestionnaires pièces des entreprises clientes — les mêmes formations, dispensées aux partenaires et flottes de CFAO Mobility et Equipment.',                famille: 'Clients',       color: '#7c3aed' },
]

export const BRAND_CATS = [
  { id: 'all',      label: 'Toutes' },
  { id: 'vl',       label: 'VL' },
  { id: 'moto',     label: 'Moto & Bateaux' },
  { id: 'camions',  label: 'Camions' },
  { id: 'bus',      label: 'Bus' },
  { id: 'chariots', label: 'Chariots' },
  { id: 'engins',   label: 'Engins' },
]

export const BRANDS = [
  { name: 'Toyota',         logo: '/assets/logos/toyota.png',          cat: 'VL · G4-G1',                    group: 'vl',       bu: 'motors',       n: 48, niveaux: 'G4 - G1' },
  { name: 'Mercedes-Benz',  logo: '/assets/logos/mercedes.png',        cat: 'VL · BASIC-CERTIFIED',          group: 'vl',       bu: 'motors',       n: 12, niveaux: 'BASIC - CERTIFIED' },
  { name: 'Suzuki',         logo: '/assets/logos/suzuki.png',          cat: 'VL · Bronze-Gold',              group: 'vl',       bu: 'motors',       n: 14, niveaux: 'Bronze - Gold' },
  { name: 'BYD',            logo: '/assets/logos/byd.png',             cat: 'VL · BEV',                      group: 'vl',       bu: 'motors',       n: 9,  niveaux: 'Électrique' },
  { name: 'Mitsubishi',     logo: '/assets/logos/mitsubishi.png',      cat: 'VL · Step 1-3',                 group: 'vl',       bu: 'motors',       n: 7,  niveaux: 'Step 1 - Step 3' },
  { name: 'Omoda & Jaecoo', logo: '/assets/logos/omoda.png',           cat: 'VL · OJEV',                     group: 'vl',       bu: 'motors',       n: 5,  niveaux: 'OJEV01–03' },
  { name: 'Stellantis',     logo: '/assets/logos/stellantis.png',      cat: 'VL · Citroën·Peugeot·Jeep·Fiat',group: 'vl',       bu: 'motors',       n: 8,  niveaux: 'SID' },
  { name: 'Citroën',        logo: '/assets/logos/citroen.png',         cat: 'VL · Stellantis',               group: 'vl',       bu: 'motors',       n: 4,  niveaux: 'SID' },
  { name: 'Yamaha',         logo: '/assets/logos/yamaha.png',          cat: 'Moto & Bateaux',                group: 'moto',     bu: 'motors',     n: 6,  niveaux: 'Burkina Faso' },
  { name: 'Renault Trucks', logo: '/assets/logos/renault-trucks.png',  cat: 'Camions',                       group: 'camions',  bu: 'equipment',  n: 9,  niveaux: 'Maint. - Diag.' },
  { name: 'Hino',           logo: '/assets/logos/hino.png',            cat: 'Camions',                       group: 'camions',  bu: 'equipment',  n: 11, niveaux: 'Maint. - Diag.' },
  { name: 'Fuso',           logo: '/assets/logos/fuso.png',            cat: 'Camions · Utilitaires',         group: 'camions',  bu: 'equipment',  n: 6,  niveaux: 'Maint. - Diag.' },
  { name: 'Sinotruk',       logo: '/assets/logos/sinotruk.png',        cat: 'Camions lourds',                group: 'camions',  bu: 'equipment',  n: 18, niveaux: 'Maint. - Diag.' },
  { name: 'Shacman',        logo: '/assets/logos/shacman.png',         cat: 'Camions BTP',                   group: 'camions',  bu: 'equipment',  n: 7,  niveaux: 'Maint. - Diag.' },
  { name: 'Mercedes Trucks',logo: '/assets/logos/mercedes.png',        cat: 'Camions',                       group: 'camions',  bu: 'equipment',  n: 6,  niveaux: 'Maint. - Diag.' },
  { name: 'King Long',      logo: '/assets/logos/kinglong.png',        cat: 'Bus · Transport',               group: 'bus',      bu: 'equipment',      n: 4,  niveaux: 'Maint. - Diag.' },
  { name: 'BT',             logo: '/assets/logos/bt.png',              cat: 'Chariots · Forklift',           group: 'chariots', bu: 'equipment', n: 3,  niveaux: 'Maint. - Diag.' },
  { name: 'Toyota Material',logo: '/assets/logos/toyota-forklift.png', cat: 'Chariots · Forklift',           group: 'chariots', bu: 'equipment', n: 8,  niveaux: 'Maint. - Diag.' },
  { name: 'JCB',            logo: '/assets/logos/jcb.png',             cat: 'Engins TP',                     group: 'engins',   bu: 'equipment',   n: 8,  niveaux: 'Maint. - Diag.' },
  { name: 'Lovol',          logo: '/assets/logos/lovol.png',           cat: 'Engins · Agri',                 group: 'engins',   bu: 'equipment',   n: 11, niveaux: 'Maint. - Diag.' },
]

export { SESSIONS } from './sessions.js'

export const NEWS_CATS = [
  { id: 'all',           label: 'À la une' },
  { id: 'Formation',     label: 'Formation' },
  { id: 'Certification', label: 'Certification' },
  { id: 'Evènements',  label: 'Evènements' },
]

export const NEWS = [
  { cat:'Formation',    date:'2026-01-15', readtime:'3 min', views:0, tone:'t1', brand:'TOYOTA',       h:'Toyota G3 · Diagnostic châssis et freinage — session 5 jours à Douala',                        p:'Douze techniciens ont suivi le cycle G3 complet sur les systèmes de freinage ABS et la lecture de codes défauts.' },
  { cat:'Formation',    date:'2026-04-12', readtime:'2 min', views:0, tone:'t3', brand:'BYD',           h:'BYD : premier cursus haute tension en Afrique francophone, 8 techniciens formés',                             p:'Huit techniciens désormais habilités à intervenir sur les batteries haute-tension des véhicules BYD.' },
  { cat:'Formation',    date:'2026-04-27',                          views:0, tone:'t1', brand:'MITSUBISHI',    h:'Mitsubishi Step 2 — cycle complet moteur et transmission, Nigeria',       p:'Quinze techniciens ont validé les modules 4N14 et boîte de transfert lors de cette session de cinq jours au Nigeria.' },
  { cat:'Formation',    date:'2026-01-22', readtime:'2 min', views:0, tone:'t2', brand:'SINOTRUK',      h:'SINOTRUK WD615 · Maîtrise du diagnostic moteur en conditions terrain, Togo',        p:'Session déployée directement sur site avec accès aux véhicules en service actif. Retour positif des ateliers partenaires au Togo.' },
  { cat:'Certification',date:'2026-02-20',                          views:0, tone:'t1', brand:'TOYOTA',        h:'9 techniciens Toyota G3 certifiés à Douala — promotion janvier 2026',       p:'Neuf techniciens ont validé les modules châssis, électrique et diagnostic avancé pour décrocher leur certification G3.' },
  { cat:'Certification',date:'2026-03-30', readtime:'3 min', views:0, tone:'t2', brand:'SUZUKI',        h:'Suzuki Z12E · 6 experts en démontage / remontage moteur diplômés',       p:'Six techniciens maîtrisent le démontage complet du Z12E dans les temps impartis par le standard Suzuki.' },
  { cat:'Certification',date:'2026-04-18',                          views:0, tone:'t2', brand:'MERCEDES-BENZ', h:'Mercedes-Benz BASIC → CERTIFIED : 4 techniciens agréés, Côte d\'Ivoire', p:'Après validation du diagnostic SDS et des procédures moteur OM651, quatre techniciens franchissent le palier CERTIFIED.' },
  { cat:'Evènements',  date:'2026-03-05', readtime:'4 min', views:0, tone:'t4', brand:null,          h:'L\'Academy présente son catalogue 2026 au Salon de l\'Auto d\'Abidjan', p:'L\'Academy était présente pour la première fois au salon avec son catalogue 2026 et ses nouvelles offres Equipment.' },
  { cat:'Evènements',  date:'2026-05-10', readtime:'3 min', views:0, tone:'t2', brand:'LOVOL',       h:'Lancement du pôle Equipment : LOVOL et JCB désormais au programme',       p:'Onze techniciens certifiés sur les niveleuses et chargeuses LOVOL — une première dans le réseau Equipment de CFAO.' },
  { cat:'Evènements',  date:'2026-04-30', readtime:'4 min', views:0, tone:'t4', brand:null,          h:'Atelier carrosserie Côte d\'Ivoire — session inaugurale N1, 12 stagiaires',    p:'Douze stagiaires ont suivi la première session carrosserie N1 organisée en RCI, avec résultats au-delà des attentes.' },
]

export const TEAM = [
  { name:'Laurent GONIN',         role:'Directeur formation',           lieu:'',             pole:'Supports',         photo:'/assets/team/laurent-gonin.png' },
  { name:'André Yves BOKALLY',    role:'Coordinateur',                  lieu:'Cameroun',     pole:'Supports',         photo:'/assets/team/andre-yves-bokally.png' },
  { name:'Claudia EYINGA',        role:'Assistante formation',          lieu:'Cameroun',     pole:'Supports',         photo:'/assets/team/claudia-eyinga.png' },
  { name:"Jennifer AKA'A",        role:'Analyste programmeuse',         lieu:'Cameroun',     pole:'Supports',         photo:'/assets/team/jennifer-akaa.png' },
  { name:'Eugène EBENE',          role:'Formateur Toyota',              lieu:'Cameroun',     pole:'Toyota',           photo:'/assets/team/eugene-ebene.png' },
  { name:'Alassane DIALLO',       role:'Formateur Toyota',              lieu:'Sénégal',      pole:'Toyota',           photo:'/assets/team/alassane-diallo.png' },
  { name:'Jacques MAVILA',        role:'Formateur Toyota & Suzuki',     lieu:'RDC',          pole:'Toyota',           photo:'/assets/team/jacques-mavila.png' },
  { name:'Brice NECHI',           role:'Formateur Stellantis & Toyota', lieu:'Cameroun',     pole:'Toyota',           photo:'/assets/team/brice-nechi.png' },
  { name:'Cédric PAKO',           role:'Suzuki, BYD & Omoda',           lieu:'Cameroun',     pole:'Autres marques',   photo:'/assets/team/cedric-pako.png' },
  { name:'Hatem BEN ABID',        role:'Mercedes-Benz',                 lieu:"Côte d'Ivoire",pole:'Autres marques',   photo:'/assets/team/hatem-ben-abid.png' },
  { name:'Mohammed COLY',         role:'Suzuki',                        lieu:'Sénégal',      pole:'Autres marques',   photo:'/assets/team/mohammed-coly.png' },
  { name:'Bomba COULIBALY',       role:'Mitsubishi, Suzuki & BYD',      lieu:"Côte d'Ivoire",pole:'Autres marques',   photo:'/assets/team/bomba-coulibaly.png' },
  { name:'Olakunle SUNMONU',      role:'Mitsubishi',                    lieu:'Nigeria',      pole:'Autres marques',   photo:'/assets/team/olakunle-sunmonu.png' },
  { name:'Marcia MAVOUALA',       role:'Suzuki',                        lieu:'Congo',        pole:'Autres marques',   photo:'/assets/team/marcia-mavouala.png' },
  { name:'Kossi AFATSAWO',        role:'Suzuki',                        lieu:'Togo',         pole:'Autres marques',   photo:'/assets/team/kossi-afatsawo.png' },
  { name:'Gilles EKOUME',         role:'Suzuki',                        lieu:'Cameroun',     pole:'Autres marques',   photo:'/assets/team/gilles-ekoume.png' },
  { name:'Jean Luc RANDRIANJAFY', role:'Suzuki & BYD',                  lieu:'Madagascar',   pole:'Autres marques',   photo:'/assets/team/jean-luc-randrianjafy.png' },
  { name:'Emmanuel OWOICHO',      role:'Suzuki',                        lieu:'Nigeria',      pole:'Autres marques',   photo:'/assets/team/emmanuel-owoicho.png' },
  { name:'Benjamin Kwesi Abakah', role:'Suzuki',                        lieu:'Ghana',        pole:'Autres marques',   photo:null, silhouette:true },
  { name:'Thierry KOUGHA',        role:'Forklift · JCB · Lovol',        lieu:'Cameroun',     pole:'Équipement',       photo:'/assets/team/thierry-kougha.png' },
  { name:'Lucien GAGNE',          role:'RT · Hino · Fuso',              lieu:'Cameroun',     pole:'Équipement',       photo:'/assets/team/lucien-gagne.png' },
  { name:'Idris NKOA',            role:'BT · King Long · Sinotruk',     lieu:'Cameroun',     pole:'Équipement',       photo:'/assets/team/idris-nkoa.png' },
  { name:'Roland NENDA',          role:'Formateur opérateur',           lieu:'Cameroun',     pole:'Équipement',       photo:'/assets/team/roland-nenda.png' },
  { name:'Johann GAUDIN',         role:'Technicien Lovol',              lieu:'Cameroun',     pole:'Équipement',       photo:'/assets/team/johann-gaudin.png' },
  { name:'Thierry TAMO YOUDOM',   role:'Carrosserie',                   lieu:'Cameroun',     pole:'Autres activités', photo:'/assets/team/thierry-tamo-youdom.png' },
  { name:'Gérold SADIO',          role:'Process',                       lieu:'Cameroun',     pole:'Autres activités', photo:'/assets/team/gerold-sadio.png' },
  { name:'Gauthier OUEDRAOGO',    role:'Yamaha Moto & Bateaux',         lieu:'Burkina Faso', pole:'Autres activités', photo:'/assets/team/gauthier-ouedraogo.png' },
]

// ── helpers ──────────────────────────────────────────
export function fmtDay(dateStr) {
  const d = new Date(dateStr)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mo: MOIS_SHORT[d.getMonth()],
    year: d.getFullYear(),
  }
}

export function fmtNewsDate(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')} ${MOIS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export const PAYS = [
  { name: 'Cameroun',           code: 'cm', actif: true  },
  { name: 'Côte d\'Ivoire',       code: 'ci', actif: true  },
  { name: 'Sénégal',              code: 'sn', actif: true  },
  { name: 'Nigeria',            code: 'ng', actif: true  },
  { name: 'Togo',               code: 'tg', actif: true  },
  { name: 'RDC',                code: 'cd', actif: true  },
  { name: 'Ghana',              code: 'gh', actif: true  },
  { name: 'Madagascar',         code: 'mg', actif: true  },
  { name: 'Congo',              code: 'cg', actif: true  },
  { name: 'Burkina Faso',       code: 'bf', actif: true  },
  { name: 'Mali',               code: 'ml', actif: true  },
  { name: 'Niger',              code: 'ne', actif: true  },
  { name: 'Bénin',               code: 'bj', actif: true  },
  { name: 'Guinée',              code: 'gn', actif: true  },
  { name: 'Gabon',              code: 'ga', actif: true  },
  { name: 'Angola',             code: 'ao', actif: true  },
  { name: 'Mozambique',         code: 'mz', actif: true  },
  { name: 'Tanzanie',           code: 'tz', actif: true  },
  { name: 'Ouganda',            code: 'ug', actif: true  },
  { name: 'Rwanda',             code: 'rw', actif: true  },
  { name: 'Kenya',              code: 'ke', actif: true  },
  { name: 'Zambie',             code: 'zm', actif: true  },
  { name: 'Zimbabwe',           code: 'zw', actif: true  },
  { name: 'Botswana',           code: 'bw', actif: true  },
  { name: 'Namibie',            code: 'na', actif: true  },
  { name: 'Libéria',             code: 'lr', actif: true  },
  { name: 'Sierra Leone',       code: 'sl', actif: true  },
  { name: 'Guinée équatoriale', code: 'gq', actif: true  },
  { name: 'Éthiopie',             code: 'et', actif: true  },
  { name: 'Mauritanie',         code: 'mr', actif: false },
  { name: 'Maroc',              code: 'ma', actif: false },
  { name: 'Tunisie',            code: 'tn', actif: false },
  { name: 'Soudan',             code: 'sd', actif: false },
]
