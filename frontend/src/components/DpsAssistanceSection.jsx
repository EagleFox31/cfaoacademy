import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import { useMemo, useState } from 'react'
import { memberInitials } from './CardMemberTitle.jsx'
import ChipFilterBar from './ChipFilterBar.jsx'
import FormateurBadge from './FormateurBadge.jsx'
import DpsContactCardMedia from './DpsContactCardMedia.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard.jsx'
import DpsTicketCardMedia from './DpsTicketCardMedia.jsx'
import { resolveBrandLogo } from './PortalBrandLogo.jsx'
import { resolveBrandFormateurDisplay } from '../utils/catalogFormateur.js'
import { TEAM_BRAND_DEFS } from '../utils/teamBrands.js'
import { flagCdnUrlForCountry } from '../utils/countryFlag.js'

const TAB_ALL = 'all'
const TAB_OPEN = 'open'
const TAB_PROGRESS = 'progress'
const TAB_CLOSED = 'resolved'
const BRAND_ALL = 'all'

const TICKET_STATUS_TABS = [TAB_ALL, TAB_OPEN, TAB_PROGRESS, TAB_CLOSED]

const TICKET_TAB_LABEL_KEY = {
  [TAB_ALL]: 'dps_assistance_filter_all',
  [TAB_OPEN]: 'dps_assistance_filter_open',
  [TAB_PROGRESS]: 'dps_assistance_filter_progress',
  [TAB_CLOSED]: 'dps_assistance_filter_closed',
}

const TICKET_TAB_EMPTY_KEY = {
  dps: {
    [TAB_ALL]: 'dps_assistance_empty_all',
    [TAB_OPEN]: 'dps_assistance_empty_open',
    [TAB_PROGRESS]: 'dps_assistance_empty_progress',
    [TAB_CLOSED]: 'dps_assistance_empty_closed',
  },
  learner: {
    [TAB_ALL]: 'learner_assistance_empty_all',
    [TAB_OPEN]: 'learner_assistance_empty_open',
    [TAB_PROGRESS]: 'learner_assistance_empty_progress',
    [TAB_CLOSED]: 'learner_assistance_empty_closed',
  },
  trainer: {
    [TAB_ALL]: 'trainer_assistance_empty_all',
    [TAB_OPEN]: 'trainer_assistance_empty_open',
    [TAB_PROGRESS]: 'trainer_assistance_empty_progress',
    [TAB_CLOSED]: 'trainer_assistance_empty_closed',
  },
}

/** Une puce par marque présente dans les tickets, logo compris ; rien sous deux marques. */
function brandFilterOptions(tickets, t) {
  const counts = new Map()
  for (const ticket of tickets) counts.set(ticket.brand, (counts.get(ticket.brand) ?? 0) + 1)
  if (counts.size < 2) return null
  return [
    { id: BRAND_ALL, label: t.dps_filter_all_brands, count: tickets.length },
    ...[...counts].map(([id, count]) => {
      const logo = resolveBrandLogo(id)
      return {
        id,
        label: TEAM_BRAND_DEFS[id]?.label ?? id,
        count,
        icon: logo ? <img src={logo} alt="" className="chip-icon-logo" /> : null,
      }
    }),
  ]
}

function ticketTabLabel(tabId, t) {
  const key = TICKET_TAB_LABEL_KEY[tabId]
  return key ? t[key] : tabId
}

function ticketStatusLabel(status, t) {
  if (status === 'resolved') return t.assistance_ticket_resolved
  if (status === 'progress') return t.assistance_ticket_progress
  return t.assistance_ticket_open
}

function ticketStatusClass(status) {
  if (status === 'resolved') return 'done'
  if (status === 'progress') return 'progress'
  return 'open'
}

function ticketAccent(status) {
  if (status === 'resolved') return '#1aab5b'
  if (status === 'progress') return '#e67e00'
  return '#1a56db'
}

function TicketPersonBadge({ label, name, agency, country, className = '' }) {
  const displayName = name?.trim() || '—'
  const flagSrc = country ? flagCdnUrlForCountry(country, 40) : null

  return (
    <span className={`portal-ticket-person-badge ${className}`.trim()}>
      {flagSrc ? (
        <img
          src={flagSrc}
          srcSet={`${flagCdnUrlForCountry(country, 80)} 2x`}
          alt=""
          className="portal-ticket-person-badge-flag"
          width={20}
          height={15}
          loading="lazy"
        />
      ) : null}
      <span
        className="portal-card-member-avatar portal-ticket-person-badge-avatar"
        aria-hidden="true"
      >
        {memberInitials(displayName)}
      </span>
      <span className="portal-ticket-person-badge-text">
        {label} <strong>{displayName}</strong>
        {agency ? (
          <span className="portal-ticket-person-badge-meta"> · {agency}</span>
        ) : null}
      </span>
    </span>
  )
}

function DpsTicketCard({ ticket, t, showDemandeur = true, showIntervenant = true, enConstruction = null }) {
  const expert = showIntervenant ? resolveBrandFormateurDisplay(ticket.brand) : null
  const expertName = expert?.kind === 'single' ? expert.name : expert?.primary

  return (
    <PvCard
      className="portal-team-member-card portal-dps-ticket-card"
      to={enConstruction ? undefined : '/portail/assistance'}
      enConstruction={enConstruction ?? undefined}
      cardMedia={<DpsTicketCardMedia ticket={ticket} />}
      kicker={(
        <span className={`portal-status-chip ${ticketStatusClass(ticket.status)}`}>
          {ticketStatusLabel(ticket.status, t)}
        </span>
      )}
      title={ticket.subject}
      meta={(
        <div className="portal-dps-ticket-meta">
          {showDemandeur ? (
            <TicketPersonBadge
              label={t.dps_ticket_demandeur}
              name={ticket.collaboratorName}
              agency={ticket.agency}
              country={ticket.country ?? 'Cameroun'}
              className="portal-dps-ticket-demandeur"
            />
          ) : null}

          {expertName ? (
            <FormateurBadge
              name={expertName}
              label={t.dps_ticket_intervenant}
              variant="card"
              className="pv-card-meta-formateur portal-dps-ticket-intervenant"
            />
          ) : null}

          <div className="portal-team-member-subcards">
            <div className="portal-team-member-subcards-row">
              <div className="portal-team-member-subcard">
                <span className="portal-team-member-subcard-lbl">{t.assistance_ticket_ord}</span>
                <span className="portal-team-member-subcard-val">{ticket.ord}</span>
              </div>
              <div className="portal-team-member-subcard">
                <span className="portal-team-member-subcard-lbl">{t.assistance_ticket_updated}</span>
                <span className="portal-team-member-subcard-val">{ticket.updated}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      cta={t.dps_ticket_cta}
      hoverHint={t.dps_ticket_cta}
      accentColor={ticketAccent(ticket.status)}
      corner
    />
  )
}

function DpsAssistanceContactCard({ t, variant = 'dps' }) {
  const desc = variant === 'learner' ? t.assistance_desc : t.dps_assistance_contact_desc

  return (
    <PvCard
      className="portal-team-member-card portal-dps-ticket-card portal-dps-contact-card"
      to="/portail/assistance"
      cardMedia={<DpsContactCardMedia />}
      kicker={(
        <span className="portal-dps-contact-kicker">{t.dps_assistance_eyebrow}</span>
      )}
      title={t.dps_assistance_contact_title}
      meta={(
        <div className="portal-dps-contact-card-meta">
          <p>{desc}</p>
          <p className="portal-dps-contact-card-hint">{t.assistance_cta_hint}</p>
        </div>
      )}
      cta={t.assistance_cta}
      hoverHint={t.assistance_cta}
      accentColor="var(--ink)"
      corner
    />
  )
}

export default function DpsAssistanceSection({
  t,
  tickets = [],
  variant = 'dps',
  title = null,
  eyebrow = null,
  enConstruction = null,
}) {
  const isLearner = variant === 'learner'
  const isTrainer = variant === 'trainer'
  const [tab, setTab] = useState(TAB_ALL)
  const [brand, setBrand] = useState(BRAND_ALL)

  // Filtre par marque : formateur seulement, il couvre parfois plusieurs marques.
  const brandOptions = useMemo(
    () => (isTrainer ? brandFilterOptions(tickets, t) : null),
    [isTrainer, tickets, t],
  )
  const brandTickets = useMemo(
    () => (brandOptions && brand !== BRAND_ALL ? tickets.filter(ticket => ticket.brand === brand) : tickets),
    [brandOptions, brand, tickets],
  )

  const statusCounts = useMemo(() => {
    const counts = { [TAB_OPEN]: 0, [TAB_PROGRESS]: 0, [TAB_CLOSED]: 0 }
    for (const ticket of brandTickets) {
      if (counts[ticket.status] != null) counts[ticket.status] += 1
    }
    return counts
  }, [brandTickets])

  const visibleTickets = useMemo(
    () => (tab === TAB_ALL ? brandTickets : brandTickets.filter(ticket => ticket.status === tab)),
    [brandTickets, tab],
  )

  const filterOptions = useMemo(
    () => TICKET_STATUS_TABS.map(id => ({
      id,
      label: ticketTabLabel(id, t),
      count: id === TAB_ALL ? brandTickets.length : (statusCounts[id] ?? 0),
    })),
    [t, statusCounts, brandTickets.length],
  )

  const emptyKeys = TICKET_TAB_EMPTY_KEY[isLearner || isTrainer ? variant : 'dps']

  return (
    <PortalReveal id="assistance">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="lifebuoy" label={eyebrow ?? t.dps_assistance_eyebrow} />
          <h2 className="portal-section-title">
            {title ?? (isLearner ? t.nav_sec_assistance : t.nav_sec_dps_assistance)}
          </h2>
        </div>

        {brandOptions ? (
          <ChipFilterBar
            portal
            label={t.dps_filter_brand}
            ariaLabel={t.dps_filter_brand}
            value={brand}
            onChange={setBrand}
            options={brandOptions}
          />
        ) : null}

        <ChipFilterBar
          portal
          label={t.dps_assistance_filter_lbl}
          ariaLabel={t.dps_assistance_filter_aria}
          value={tab}
          onChange={setTab}
          options={filterOptions}
        />

        {visibleTickets.length === 0 ? (
          <div className="portal-plan-filter-empty" role="status">
            {t[emptyKeys[tab]]}
          </div>
        ) : null}

        <PortalStaggerGrid className="cols-4 pv-grid--stretch portal-dps-assistance-tickets">
          {visibleTickets.map(ticket => (
            <div key={ticket.id} className="portal-card-anchor">
              <DpsTicketCard ticket={ticket} t={t} showDemandeur={!isLearner} showIntervenant={!isTrainer} enConstruction={enConstruction} />
            </div>
          ))}
          {/* Le formateur est l'expert : pas de carte « Contacter un expert ». */}
          {isTrainer ? null : (
            <div key="dps-assistance-contact" className="portal-card-anchor" data-portal-support>
              <DpsAssistanceContactCard t={t} variant={variant} />
            </div>
          )}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
