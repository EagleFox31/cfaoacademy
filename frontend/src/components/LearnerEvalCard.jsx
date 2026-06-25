import PvCard from './PvCard.jsx'
import EvalCardMedia from './EvalCardMedia.jsx'
import { findCatalogTraining } from '../utils/assignedTrainings.js'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import {
  evalAccentColor,
  evalScoreTier,
  evalScoreTierClass,
  isFormationTestLocked,
  resolveEvalCardMedia,
  resolveEvalFormationMeta,
  resolveEvalTitle,
  resolveCompetencyTierLabel,
} from '../utils/learnerTests.js'

function EvalCardScore({ e }) {
  if (e.score == null) return null
  const tier = evalScoreTier(e.score)
  return (
    <span className={`portal-eval-score portal-eval-score--card${evalScoreTierClass(tier)}`}>
      <span className="portal-eval-score-value">{e.score}</span>
      <span className="portal-eval-score-denom">/100</span>
    </span>
  )
}

export function evalCardStatusLabel(e, t, locked = false) {
  if (locked) return t.status_coming_soon
  if (e.status === 'done') return t.status_done
  if (e.status === 'progress') return t.status_progress
  if (e.status === 'upcoming') return t.status_upcoming
  return t.status_todo
}

export function evalCardStatusClass(e, locked = false) {
  if (locked) return 'coming-soon'
  if (e.status === 'upcoming') return 'todo'
  return e.status ?? 'todo'
}

function EvalCardMeta({ e, t }) {
  const showQuestions = e.status === 'progress' && e.questions != null
  const questionsVal = showQuestions && e.questionsAnswered != null
    ? `${e.questionsAnswered} / ${e.questions}`
    : showQuestions
      ? String(e.questions)
      : null

  let dateHint = null
  if (e.status === 'done' && e.date) dateHint = `${t.eval_passed_on} ${e.date}`
  else if (e.status === 'upcoming' && e.date !== '—') dateHint = `${t.eval_upcoming_on} ${e.date}`

  const formationMeta = resolveEvalFormationMeta(e, t)

  return (
    <div className="portal-eval-card-meta">
      {formationMeta && (
        <div className="portal-eval-meta-row portal-eval-meta-row--sub">
          <span className="portal-eval-meta-val">{formationMeta}</span>
        </div>
      )}
      {showQuestions && questionsVal != null && (
        <div className="portal-eval-meta-row">
          <span className="portal-eval-meta-lbl">{t.eval_label_questions}</span>
          <span className="portal-eval-meta-val">{questionsVal}</span>
        </div>
      )}
      {dateHint && (
        <div className="portal-eval-meta-row portal-eval-meta-row--sub">
          <span className="portal-eval-meta-val">{dateHint}</span>
        </div>
      )}
    </div>
  )
}

function EvalCardResult({ e, t, locked = false }) {
  const inProgress = e.status === 'progress'

  return (
    <div className="portal-eval-result-row">
      <span className="portal-eval-result-lbl">{t.eval_label_result}</span>
      <div className="portal-eval-result-val">
        {locked ? (
          <span className="portal-eval-result-pending portal-status-chip coming-soon">
            {t.status_coming_soon}
          </span>
        ) : inProgress ? (
          <span className="portal-eval-finish-cta">{t.eval_finish_test}</span>
        ) : e.score != null ? (
          <EvalCardScore e={e} />
        ) : (
          <span className="portal-eval-result-pending">
            {e.status === 'upcoming' ? t.status_upcoming : t.status_todo}
          </span>
        )}
      </div>
    </div>
  )
}

export function EvalKicker({ e, t, user }) {
  const kindClass = e.kind === 'competency' ? 'kind-competency' : 'kind-formation'
  const tierLabel = e.kind === 'competency' && e.competencyTier
    ? resolveCompetencyTierLabel(e.competencyTier, t, user)
    : e.kind === 'formation' && e.code
      ? e.code
      : e.certLevel

  return (
    <span className="pv-card-kicker-row portal-eval-kicker">
      <span className={`portal-status-chip ${kindClass}`}>
        {e.kind === 'competency' ? t.test_kind_competency : t.test_kind_formation}
      </span>
      {tierLabel && (
        <span className="portal-status-chip tier">{tierLabel}</span>
      )}
    </span>
  )
}

export function EvalDetail({ e, t, user }) {
  return (
    <>
      {e.kind && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.test_modal_kind}</span>
          <span className="portal-modal-value">
            {e.kind === 'competency' ? t.test_kind_competency : t.test_kind_formation}
          </span>
        </div>
      )}
      {e.modality && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.test_modal_modality}</span>
          <span className="portal-modal-value">
            {e.modality === 'practical' ? t.test_modality_practical : t.test_modality_theory}
          </span>
        </div>
      )}
      {e.competencyTier && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.test_modal_tier}</span>
          <span className="portal-modal-value">
            {resolveCompetencyTierLabel(e.competencyTier, t, user)}
          </span>
        </div>
      )}
      {e.kind === 'formation' && e.code && (() => {
        const catalog = findCatalogTraining(e.brand, e.code)
        return (
          <div className="portal-modal-row">
            <span className="portal-modal-label">{t.modal_formation}</span>
            <span className="portal-modal-value">
              {e.code}
              {catalog?.name && <> — {catalog.name}</>}
            </span>
          </div>
        )
      })()}
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.modal_date}</span>
        <span className="portal-modal-value">{e.date}</span>
      </div>
      {e.status === 'progress' && e.questions != null && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.eval_label_questions}</span>
          <span className="portal-modal-value">
            {e.questionsAnswered != null
              ? `${e.questionsAnswered} / ${e.questions}`
              : e.questions}
          </span>
        </div>
      )}
      {e.status !== 'progress' && e.questions != null && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.modal_questions}</span>
          <span className="portal-modal-value">{e.questions}</span>
        </div>
      )}
      {e.status !== 'progress' && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.modal_pass_mark}</span>
          <span className="portal-modal-value">{e.passMark}/100</span>
        </div>
      )}
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.eval_label_result}</span>
        {e.status === 'progress' ? (
          <span className="portal-modal-value portal-eval-finish-cta">{t.eval_finish_test}</span>
        ) : e.score != null ? (
          <span className={`portal-eval-score${evalScoreTierClass(evalScoreTier(e.score))}`} style={{ fontSize: 18 }}>
            {e.score}/100
          </span>
        ) : (
          <span className="portal-status-chip todo">
            {e.status === 'upcoming' ? t.status_upcoming : t.status_todo}
          </span>
        )}
      </div>
      {e.feedback && (
        <div className="portal-modal-feedback">
          <strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>{t.modal_feedback}</strong>
          {e.feedback}
        </div>
      )}
    </>
  )
}

export function CertDetail({ c, t }) {
  return (
    <>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.modal_brand}</span>
        <span className={`portal-brand-chip ${c.brand}`}>{c.brand}</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.modal_level}</span>
        <span className="portal-modal-value">{c.level}</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.modal_completed}</span>
        <span className="portal-modal-value">{c.date}</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.modal_cert_id}</span>
        <span className="portal-modal-value" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{c.certId}</span>
      </div>
      <a href="#" className="portal-cert-dl" style={{ marginTop: 16, display: 'inline-block' }} onClick={ev => ev.preventDefault()}>
        {t.attestation}
      </a>
    </>
  )
}

export default function LearnerEvalCard({ e, user, lms, t, onOpen }) {
  const locked = isFormationTestLocked(user, lms, e)
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

  let hoverHint = t.card_view_detail
  if (locked) hoverHint = t.status_coming_soon
  else if (e.status === 'progress') hoverHint = e.medacap?.launchUrl ? t.test_launch : t.eval_finish_test
  else if (e.status !== 'done' && e.medacap?.launchUrl) hoverHint = t.test_launch

  return (
    <div id={`portal-card-${e.id}`} className="portal-card-anchor">
      <PvCard
        className={`pv-card--eval${locked ? ' pv-card--eval-locked' : ''}${e.brand ? ` pv-card--brand-${e.brand}` : ''}`}
        cardMedia={e.modality ? (
          <EvalCardMedia
            img={cardImg}
            imgFallback={cardImgFallback}
            modality={e.modality}
            label={modalityLabel}
            statusLabel={e.kind ? evalCardStatusLabel(e, t, locked) : undefined}
            statusClass={e.kind ? evalCardStatusClass(e, locked) : undefined}
            locked={locked}
          />
        ) : undefined}
        img={e.modality ? undefined : cardImg}
        imgFallback={cardImgFallback}
        variant={evalMedia ? undefined : fallbackMedia.variant}
        logo={fallbackMedia.logo}
        brandLabel={fallbackMedia.brandLabel}
        kicker={e.kind ? <EvalKicker e={e} t={t} user={user} /> : (
          e.status === 'upcoming'
            ? <span className="portal-status-chip todo">{t.status_upcoming}</span>
            : <span className="portal-status-chip done">{t.status_done}</span>
        )}
        title={resolveEvalTitle(e, t, user)}
        meta={e.kind ? <EvalCardMeta e={e} t={t} /> : (
          e.status === 'upcoming' && e.date !== '—'
            ? `${t.eval_upcoming_on} ${e.date}`
            : e.status === 'done'
              ? `${t.eval_passed_on} ${e.date}`
              : t.status_todo
        )}
        cta={e.kind ? <EvalCardResult e={e} t={t} locked={locked} /> : undefined}
        accentColor={locked ? 'var(--muted)' : evalAccentColor(e)}
        onClick={locked ? undefined : () => onOpen(e)}
        hoverHint={hoverHint}
        corner
      />
    </div>
  )
}
