import AssistanceMediaIcon from './AssistanceMediaIcon.jsx'

const ACADEMY_LOGO = '/assets/logo-cfao-mobility.jpg'

export default function DpsContactCardMedia() {
  return (
    <div className="portal-team-member-card-media portal-dps-ticket-card-media portal-dps-contact-card-media">
      <div className="portal-team-member-card-media-pattern" aria-hidden="true" />
      <img
        src={ACADEMY_LOGO}
        alt=""
        className="portal-dps-contact-card-logo"
        loading="lazy"
      />
      <AssistanceMediaIcon />
    </div>
  )
}
