import AssistanceMediaIcon from './AssistanceMediaIcon.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import { TEAM_BRAND_DEFS } from '../utils/teamBrands.js'

function ticketMediaClasses(ticket) {
  const brandMod = ticket.brand ?? 'default'
  const isOpen = ticket.status === 'open'
  const isResolved = ticket.status === 'resolved'

  return [
    'portal-team-member-card-media',
    'portal-dps-ticket-card-media',
    `portal-team-member-card-media--${brandMod}`,
    isOpen ? 'portal-dps-ticket-card-media--open' : '',
    isResolved ? 'portal-team-member-card-media--certified' : '',
  ].filter(Boolean).join(' ')
}

export default function DpsTicketCardMedia({ ticket }) {
  const logo = TEAM_BRAND_DEFS[ticket.brand]?.logo

  return (
    <div className={ticketMediaClasses(ticket)}>
      <div className="portal-team-member-card-media-pattern" aria-hidden="true" />
      {logo ? (
        <img
          src={logo}
          alt=""
          className="portal-dps-ticket-brand-logo"
          loading="lazy"
        />
      ) : (
        <PortalBrandLogo brand={ticket.brand} className="portal-dps-ticket-brand-fallback" />
      )}
      <AssistanceMediaIcon status={ticket.status} />
    </div>
  )
}
