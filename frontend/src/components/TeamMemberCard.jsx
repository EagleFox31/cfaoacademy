import CardMemberTitle, { memberInitials } from './CardMemberTitle.jsx'
import PvCard from './PvCard.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import TechnicianMediaIcon from './TechnicianMediaIcon.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'
import { resolveProfileIcon } from '../utils/resolveProfileIcon.js'

function memberStatusChip(member, t) {
  if (member.certified) return { label: t.status_certified, className: 'done' }
  if (member.alert) return { label: t.tm_status_inactive, className: 'todo' }
  return { label: t.status_progress, className: 'progress' }
}

/** Bordure, barre de progression et avatar — une couleur par statut. */
function memberCardTheme(member) {
  if (member.alert) {
    return { accent: 'var(--red)', fill: 'var(--red)', avatarVariant: 'alert' }
  }
  if (member.certified) {
    return { accent: '#1aab5b', fill: '#1aab5b', avatarVariant: 'certified' }
  }
  return { accent: '#e67e00', fill: '#e67e00', avatarVariant: 'progress' }
}

export function TeamMemberCardMedia({ member, showAvatar = true }) {
  const brandMod = member.brand ?? 'default'
  const iconSrc = resolveProfileIcon(member)
  return (
    <div
      className={[
        'portal-team-member-card-media',
        `portal-team-member-card-media--${brandMod}`,
        member.alert ? 'portal-team-member-card-media--alert' : '',
        member.certified ? 'portal-team-member-card-media--certified' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="portal-team-member-card-media-pattern" aria-hidden="true" />
      {showAvatar && (
        iconSrc ? (
          <ProfileAvatar
            person={member}
            name={member.nom}
            className="portal-mini-avatar portal-mini-avatar--lg portal-team-member-avatar"
          />
        ) : (
          <div className="portal-mini-avatar portal-mini-avatar--lg portal-team-member-avatar">
            {memberInitials(member.nom)}
          </div>
        )
      )}
      {!showAvatar && (
        iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className="portal-dps-collab-tech-icon"
            width={72}
            height={72}
            decoding="async"
          />
        ) : (
          <TechnicianMediaIcon alert={Boolean(member.alert)} />
        )
      )}
      <PortalBrandLogo brand={member.brand} size="media" className="portal-team-member-card-brand" />
    </div>
  )
}

function MemberSubcards({ member, t, fillColor }) {
  const modulesDone = member.modulesDone ?? 0
  const modulesTotal = member.modulesTotal ?? 0
  const levelLine = `${member.certLevel ?? '—'} → ${member.targetLevel ?? '—'}`
  const progress = member.progress ?? 0

  return (
    <div className="portal-team-member-subcards">
      <div className="portal-team-member-subcards-row">
        <div className="portal-team-member-subcard">
          <span className="portal-team-member-subcard-lbl">{t.tm_card_objective}</span>
          <span className="portal-team-member-subcard-val">{levelLine}</span>
        </div>
        <div className={`portal-team-member-subcard${member.alert ? ' portal-team-member-subcard--warn' : ''}`}>
          <span className="portal-team-member-subcard-lbl">{t.th_last_activity}</span>
          <span className="portal-team-member-subcard-val">{member.lastActivity ?? '—'}</span>
        </div>
      </div>
      <div className="portal-team-member-subcard portal-team-member-subcard--wide">
        <span className="portal-team-member-subcard-lbl">{t.tm_card_progress}</span>
        <span className="portal-team-member-subcard-val">
          {t.tm_card_modules
            .replace('{done}', String(modulesDone))
            .replace('{total}', String(modulesTotal))}
        </span>
        <div className="portal-team-member-subcard-bar">
          <div className="portal-inline-track">
            <div
              className="portal-inline-fill"
              style={{ width: `${progress}%`, background: fillColor }}
            />
          </div>
          <span className="portal-inline-pct">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

export default function TeamMemberCard({ member, t, onFiche, onManage }) {
  const status = memberStatusChip(member, t)
  const theme = memberCardTheme(member)

  return (
    <PvCard
      className={member.alert ? 'portal-team-member-card portal-team-member-card--alert' : 'portal-team-member-card'}
      cardMedia={<TeamMemberCardMedia member={member} showAvatar={false} />}
      kicker={(
        <span className="pv-card-kicker-row">
          <PortalBrandLogo brand={member.brand} size="chip" />
          <span className={`portal-status-chip ${status.className}`}>{status.label}</span>
        </span>
      )}
      title={(
        <CardMemberTitle
          name={member.nom}
          variant={theme.avatarVariant}
          person={member}
        />
      )}
      meta={<MemberSubcards member={member} t={t} fillColor={theme.fill} />}
      cta={(
        <span className="portal-team-member-actions">
          <button type="button" className="portal-team-member-btn" onClick={e => { e.stopPropagation(); onFiche() }}>
            {t.tm_member_fiche}
          </button>
          <button type="button" className="portal-team-member-btn portal-team-member-btn--ghost" onClick={e => { e.stopPropagation(); onManage() }}>
            {t.tm_member_manage}
          </button>
        </span>
      )}
      accentColor={theme.accent}
      corner
    />
  )
}
