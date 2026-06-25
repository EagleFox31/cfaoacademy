import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard'
import EvalCardMedia from './EvalCardMedia.jsx'
import PortalSessionCard from './PortalSessionCard.jsx'
import useLocale from '../hooks/useLocale'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import {
  evalAccentColor,
  resolveEvalCardMedia,
  resolveEvalFormationMeta,
  resolveEvalTitle,
} from '../utils/learnerTests.js'
import { planningSessionAccent } from '../utils/learnerPlanning.js'

function evalStatusLabel(e, t) {
  if (e.status === 'progress') return t.status_progress
  if (e.status === 'upcoming') return t.status_upcoming
  return t.status_todo
}

function evalStatusClass(e) {
  if (e.status === 'upcoming') return 'todo'
  return e.status ?? 'todo'
}

function NextActionEvalCard({ item, t, user, onClick }) {
  const e = item.data
  const fallbackMedia = portalPvCardMedia({
    brand: e.brand,
    modality: e.modality,
    kind: 'eval',
  })
  const evalMedia = resolveEvalCardMedia(e, user)
  const cardImg = evalMedia?.img ?? fallbackMedia.img
  const cardImgFallback = evalMedia?.imgFallback ?? fallbackMedia.imgFallback
  const modalityLabel = e.modality === 'practical'
    ? t.test_modality_practical
    : t.test_modality_theory

  let title = resolveEvalTitle(e, t, user)
  if (item.badge === 'progress') {
    title = `${t.next_action_eval_resume} · ${title}`
  }

  const formationMeta = resolveEvalFormationMeta(e, t)
  let meta = formationMeta
  if (e.status === 'progress' && e.questions != null) {
    const answered = e.questionsAnswered ?? 0
    const progress = `${t.eval_label_questions} · ${answered} / ${e.questions}`
    meta = formationMeta ? `${formationMeta} · ${progress}` : progress
  } else if (e.date && e.date !== '—') {
    const dateLine = e.status === 'upcoming' ? `${t.eval_upcoming_on} ${e.date}` : e.date
    meta = formationMeta ? `${formationMeta} · ${dateLine}` : dateLine
  }

  const cta = e.status === 'progress'
    ? (item.trailing ?? t.eval_finish_test)
    : t.card_view_detail

  return (
    <PvCard
      className="pv-card--eval"
      cardMedia={e.modality ? (
        <EvalCardMedia
          img={cardImg}
          imgFallback={cardImgFallback}
          modality={e.modality}
          label={modalityLabel}
          statusLabel={e.kind ? evalStatusLabel(e, t) : undefined}
          statusClass={e.kind ? evalStatusClass(e) : undefined}
        />
      ) : undefined}
      img={e.modality ? undefined : cardImg}
      imgFallback={cardImgFallback}
      variant={evalMedia ? undefined : fallbackMedia.variant}
      logo={fallbackMedia.logo}
      brandLabel={fallbackMedia.brandLabel}
      kicker={e.kind ? undefined : (
        <span className={`portal-status-chip ${evalStatusClass(e)}`}>{evalStatusLabel(e, t)}</span>
      )}
      title={title}
      meta={meta}
      cta={cta}
      accentColor={evalAccentColor(e)}
      onClick={onClick}
      hoverHint={e.status === 'progress' ? t.eval_finish_test : t.card_view_detail}
      corner
    />
  )
}

export default function LearnerNextActions({ user, actions, onEval }) {
  const { t } = useLocale('portal')
  const { t: cardsT } = useLocale('cards')

  if (!actions?.length) return null

  return (
    <PortalReveal id="next-actions">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_next_actions}</p>
          <h2 className="portal-section-title">{t.title_next_actions}</h2>
        </div>
        <PortalStaggerGrid>
          {actions.map(item => (
            <div key={item.id} className="portal-card-anchor">
              {item.kind === 'eval' ? (
                <NextActionEvalCard
                  item={item}
                  t={t}
                  user={user}
                  onClick={() => onEval(item.data)}
                />
              ) : (
                <PortalSessionCard
                  session={item.data}
                  annualStatus={item.data.annualStatus ?? item.badge}
                  t={t}
                  statusOnImage
                  accentColor={planningSessionAccent(item.data.annualStatus)}
                  hoverHint={cardsT.sessionFicheHint}
                />
              )}
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
