function IconBase({ size = 14, strokeWidth = 2.5, style, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {children}
    </svg>
  )
}

export function MilestoneIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 13v8" />
      <path d="M12 3v3" />
      <path d="M4 6h1" />
      <path d="M4 10h1" />
      <path d="M4 14h1" />
      <path d="M20 6h-1" />
      <path d="M20 10h-1" />
      <path d="M20 14h-1" />
      <rect x="2" y="6" width="20" height="8" rx="1" />
    </IconBase>
  )
}

export function AwardIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
      <circle cx="12" cy="8" r="6" />
    </IconBase>
  )
}

export function GlobeIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </IconBase>
  )
}

function UsersIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  )
}

function ListTodoIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </IconBase>
  )
}

export function GraduationCapIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </IconBase>
  )
}

function PresentationIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M2 3h20" />
      <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </IconBase>
  )
}

export function LifeBuoyIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 4.24 4.24" />
      <path d="m14.83 9.17 4.24-4.24" />
      <path d="m14.83 14.83 4.24 4.24" />
      <path d="m9.17 14.83-4.24 4.24" />
      <circle cx="12" cy="12" r="4" />
    </IconBase>
  )
}

/** Livre / guides — entrée centre d'aide. */
export function HelpBookIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 7v14" />
      <path d="M5.5 5.5A02 2 0 0 1 7 5h11v16H7a2 2 0 0 0-2 2" />
      <path d="M5.5 19.5A2.5 2.5 0 0 1 3 17V5a2 2 0 0 1 2-2h11" />
    </IconBase>
  )
}

/** Icône aide standard — cercle + point d'interrogation (convention UX universelle). */
export function HelpCircleIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2.25-3 3.75" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

function SlidersIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M21 4h-7" />
      <path d="M10 4H3" />
      <path d="M21 12h-9" />
      <path d="M8 12H3" />
      <path d="M21 20h-5" />
      <path d="M12 20H3" />
      <path d="M14 2v4" />
      <path d="M8 10v4" />
      <path d="M16 18v4" />
    </IconBase>
  )
}

function MapIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </IconBase>
  )
}

function StarIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </IconBase>
  )
}

function BuildingIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10 12h4" />
      <path d="M10 8h4" />
      <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
      <path d="M6 10H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    </IconBase>
  )
}

function ClipboardIcon(props) {
  return (
    <IconBase {...props}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </IconBase>
  )
}

function SparklesIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </IconBase>
  )
}

export function BellIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </IconBase>
  )
}

/** Technicien atelier — casque / outil. */
export function TechnicianIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </IconBase>
  )
}

/** Parcours guidé — repères reliés (icône bouton Guide navbar). */
export function GuideTourIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="6" r="2.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="10" r="2.25" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="2.25" fill="currentColor" stroke="none" />
      <path d="M8.2 7.2h5.2c1.5 0 2.6 1.1 2.6 2.6V9.8" />
      <path d="M15.8 12.2V15c0 1.5-1.1 2.6-2.6 2.6H10.2" />
    </IconBase>
  )
}

export const PORTAL_SECTION_ICON_MAP = {
  milestone: MilestoneIcon,
  award: AwardIcon,
  users: UsersIcon,
  listtodo: ListTodoIcon,
  graduationcap: GraduationCapIcon,
  graduation: GraduationCapIcon,
  presentation: PresentationIcon,
  lifebuoy: LifeBuoyIcon,
  sliders: SlidersIcon,
  map: MapIcon,
  star: StarIcon,
  building: BuildingIcon,
  clipboard: ClipboardIcon,
  sparkles: SparklesIcon,
}

/** Icônes navbar portail — clé section (`PORTAL_NAV_SECTIONS[].key`). */
export const PORTAL_NAV_ICON_BY_KEY = {
  priorities: 'listtodo',
  pif: 'milestone',
  pifs: 'milestone',
  resultats: 'sliders',
  tests: 'clipboard',
  formations: 'graduationcap',
  'formations-annuelles': 'graduationcap',
  certifs: 'award',
  certifications: 'award',
  assistance: 'lifebuoy',
  bilan: 'building',
  fad: 'presentation',
  apprenants: 'users',
  parcours: 'map',
  equipe: 'users',
  plans: 'milestone',
  equipes: 'users',
  collaborateurs: 'users',
  directory: 'clipboard',
  branches: 'map',
  competences: 'award',
  logs: 'listtodo',
  profiles: 'users',
}

/** Chevron des menus de nav — pivote a l'ouverture (cf. .nav-chevron). */
export function ChevronIcon({ open = false, size = 12, className }) {
  return (
    <svg
      className={['nav-chevron', className].filter(Boolean).join(' ')}
      data-open={open ? 'true' : 'false'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function LogOutIcon({ size = 16, strokeWidth = 2, className, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function LayoutDashboardIcon({ size = 16, strokeWidth = 2, className, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}

export function PortalNavSectionIcon({ sectionKey, iconKey, size = 18, strokeWidth = 2, className }) {
  /* iconKey explicite prioritaire : les sections préfixées par une marque
     (ki: toyota-resultats…) n'ont pas de clé dans la table par sectionKey. */
  const resolvedKey = iconKey ?? PORTAL_NAV_ICON_BY_KEY[sectionKey]
  const Icon = resolvedKey ? PORTAL_SECTION_ICON_MAP[resolvedKey] : null
  if (!Icon) return null
  return (
    <span className={className} aria-hidden="true">
      <Icon size={size} strokeWidth={strokeWidth} />
    </span>
  )
}
