import CardMemberTitle from './CardMemberTitle.jsx'
import PvCard from './PvCard.jsx'
import EvalCardMedia from './EvalCardMedia.jsx'
import { EvalKicker, evalCardStatusClass, evalCardStatusLabel } from './LearnerEvalCard.jsx'
import { TeamMemberCardMedia } from './TeamMemberCard.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import useLocale from '../hooks/useLocale'
import { getTeamPendingValidations, resolveTeamMembers } from '../utils/teamManagerMetrics.js'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import {
  evalAccentColor,
  resolveEvalCardMedia,
  resolveEvalTitle,
} from '../utils/learnerTests.js'

export function resolveTeamNextActions(lms) {
  const tests = getTeamPendingValidations(lms).map(item => ({
    id: item.id,
    kind: 'practical_test',
    data: item,
  }))
  const alerts = resolveTeamMembers(lms)
    .filter(m => m.alert)
    .map(m => ({
      id: `alert-${m.id}`,
      kind: 'alert',
      data: m,
    }))
  return [...tests, ...alerts]
}

function pendingItemToEval(item) {
  return { ...item, status: item.status ?? 'todo' }
}

function PracticalTestCard({ item, t }) {
  const e = pendingItemToEval(item)
  const evalMedia = resolveEvalCardMedia(e)
  const fallbackMedia = portalPvCardMedia({ ...e, kind: 'eval' })
  const cardImg = evalMedia?.img ?? fallbackMedia.img
  const cardImgFallback = evalMedia?.imgFallback ?? fallbackMedia.imgFallback
  const modalityLabel = e.modality === 'practical'
    ? t.test_modality_practical
    : t.test_modality_theory

  return (
    <PvCard
      className="pv-card--eval"
      cardMedia={(
        <EvalCardMedia
          img={cardImg}
          imgFallback={cardImgFallback}
          modality={e.modality}
          label={modalityLabel}
          statusLabel={evalCardStatusLabel(e, t)}
          statusClass={evalCardStatusClass(e)}
        />
      )}
      kicker={<EvalKicker e={e} t={t} />}
      title={<CardMemberTitle name={item.memberName} />}
      meta={(
        <div className="portal-eval-card-meta">
          <div className="portal-eval-meta-row portal-eval-meta-row--sub">
            <span className="portal-eval-meta-val">{resolveEvalTitle(e, t)}</span>
          </div>
        </div>
      )}
      cta={t.tm_practical_test_cta}
      accentColor={evalAccentColor(e)}
      hoverHint={t.plan_entry_coming_soon}
      corner
    />
  )
}

function AlertCard({ member, t }) {
  return (
    <PvCard
      className="portal-team-member-card portal-team-member-card--alert"
      cardMedia={<TeamMemberCardMedia member={member} showAvatar={false} />}
      kicker={(
        <span className="pv-card-kicker-row">
          <PortalBrandLogo brand={member.brand} size="chip" />
          <span className="portal-status-chip todo">{t.tm_status_inactive}</span>
        </span>
      )}
      title={<CardMemberTitle name={member.nom} variant="alert" />}
      meta={(
        <div className="portal-eval-card-meta">
          <div className="portal-eval-meta-row portal-eval-meta-row--sub">
            <span className="portal-eval-meta-lbl">{t.th_last_activity}</span>
            <span className="portal-eval-meta-val">{member.lastActivity}</span>
          </div>
        </div>
      )}
      cta={t.tm_member_fiche}
      accentColor="var(--red)"
      hoverHint={t.card_view_detail}
      corner
    />
  )
}

export default function TeamManagerNextActions({ lms }) {
  const { t } = useLocale('portal')
  const actions = resolveTeamNextActions(lms)

  if (!actions.length) return null

  return (
    <section id="next-actions">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_next_actions}</p>
          <h2 className="portal-section-title">{t.title_next_actions}</h2>
        </div>
        <div className="pv-grid cols-4 pv-grid--stretch">
          {actions.map(item => (
            <div key={item.id} className="portal-card-anchor">
              {item.kind === 'alert' ? (
                <AlertCard member={item.data} t={t} />
              ) : (
                <PracticalTestCard item={item.data} t={t} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
