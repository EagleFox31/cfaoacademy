import PvCard from './PvCard.jsx'
import EvalCardMedia from './EvalCardMedia.jsx'
import { IconQuestions, IconDuration, IconTarget, IconModality } from './EvalCardIcons.jsx'
import { findCatalogTraining } from '../utils/assignedTrainings.js'
import { isPlMedacapVariant } from '../utils/portalVariant.js'
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

/* ── Rendu HISTORIQUE (tous profils hors variante PL-MEDACAP) ─────── */
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

function EvalCardResultMeta({ e, t }) {
  if (!e.date || e.date === 'â€”') return null

  return (
    <div className="portal-eval-card-meta portal-eval-card-meta--result">
      <div className="portal-eval-meta-row portal-eval-meta-row--sub">
        <span className="portal-eval-meta-val">{t.eval_passed_on} {e.date}</span>
      </div>
    </div>
  )
}

/* ── Rendu VARIANTE PL-MEDACAP ───────────────────────────────────── */
/** Une info compacte (icône trait fin + libellé court) de la grille de faits. */
function EvalFact({ icon: Icon, children }) {
  return (
    <span className="portal-eval-fact">
      <Icon className="portal-eval-fact-ico" />
      <span className="portal-eval-fact-txt">{children}</span>
    </span>
  )
}

function EvalCardMetaPl({ e, t }) {
  const total = e.questions ?? null
  const questionsTxt = total != null
    ? `${total} ${t.eval_questions_short ?? 'questions'}`
    : null

  const durationTxt = e.status === 'progress'
    ? (e.durationRemaining ? `${e.durationRemaining} ${t.eval_time_left_suffix ?? 'restant'}` : (e.estimatedDuration ?? null))
    : (e.estimatedDuration ?? null)

  const passTxt = e.passMark != null
    ? `${t.eval_passmark_short ?? 'Seuil'} ${e.passMark}/100`
    : null

  const formatTxt = e.modality
    ? (e.modality === 'practical' ? t.test_modality_practical : t.test_modality_theory)
    : null

  let dateHint = null
  if (e.status === 'done' && e.date && e.date !== '—') dateHint = `${t.eval_passed_on} ${e.date}`
  else if (e.status === 'upcoming' && e.date && e.date !== '—') dateHint = `${t.eval_upcoming_on} ${e.date}`

  const formationMeta = resolveEvalFormationMeta(e, t)

  return (
    <div className="portal-eval-card-meta">
      {formationMeta && (
        <div className="portal-eval-meta-row portal-eval-meta-row--sub">
          <span className="portal-eval-meta-val">{formationMeta}</span>
        </div>
      )}
      <div className="portal-eval-facts">
        {questionsTxt && <EvalFact icon={IconQuestions}>{questionsTxt}</EvalFact>}
        {durationTxt && <EvalFact icon={IconDuration}>{durationTxt}</EvalFact>}
        {passTxt && <EvalFact icon={IconTarget}>{passTxt}</EvalFact>}
        {formatTxt && <EvalFact icon={IconModality}>{formatTxt}</EvalFact>}
      </div>
      {e.status === 'progress' && total != null && (
        <div className="portal-eval-meta-row portal-eval-meta-row--sub portal-eval-meta-row--progress">
          <span className="portal-eval-meta-val">
            {e.questionsAnswered ?? 0}/{total} {t.eval_answered_suffix}
          </span>
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

/** Libellé d'action : Commencer / Continuer selon l'état. */
export function evalCardActionLabel(e, t, locked = false) {
  if (locked) return t.status_coming_soon
  if (e.status === 'progress') return t.eval_btn_resume ?? t.eval_finish_test
  if (e.status === 'done') return null
  return t.eval_btn_start ?? t.test_launch
}

function EvalCardResultPl({ e, t, locked = false }) {
  const isDone = e.status === 'done'

  if (isDone) {
    return (
      <div className="portal-eval-result-row">
        <span className="portal-eval-result-lbl">{t.eval_label_result}</span>
        <div className="portal-eval-result-val">
          {e.score != null
            ? <EvalCardScore e={e} />
            : <span className="portal-eval-result-pending">{t.status_done}</span>}
        </div>
      </div>
    )
  }

  const label = evalCardActionLabel(e, t, locked)
  const inProgress = e.status === 'progress'
  const answered = e.questionsAnswered ?? 0
  const total = e.questions ?? null
  const progressTxt = inProgress && total != null
    ? `${answered}/${total} ${t.eval_answered_suffix ?? 'terminé'}`
    : null

  return (
    <div className={`portal-eval-action${locked ? ' is-locked' : ''}${inProgress ? ' is-resume' : ''}`}>
      <span className="portal-eval-action-label">
        {label}
      </span>
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

export default function LearnerEvalCard({ e, user, lms, t, onOpen, onViewResults, resultOnly = false }) {
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

  const plVariant = isPlMedacapVariant(lms)
  const linksToResults = e.status === 'done' && typeof onViewResults === 'function'

  let hoverHint = linksToResults ? t.eval_btn_view_results : t.card_view_detail
  if (locked) hoverHint = t.status_coming_soon
  else if (plVariant && e.status === 'progress') hoverHint = t.eval_hover_resume ?? t.eval_btn_resume ?? t.eval_finish_test
  else if (plVariant && e.status !== 'done') hoverHint = t.eval_hover_start ?? t.eval_btn_start ?? t.test_launch
  else if (e.status === 'progress') hoverHint = e.medacap?.launchUrl ? t.test_launch : t.eval_finish_test
  else if (e.status !== 'done' && e.medacap?.launchUrl) hoverHint = t.test_launch

  const MetaComp = plVariant ? EvalCardMetaPl : EvalCardMeta
  const ResultComp = plVariant ? EvalCardResultPl : EvalCardResult

  return (
    <div id={`portal-card-${e.id}`} className="portal-card-anchor">
      <PvCard
        className={`pv-card--eval${resultOnly ? ' pv-card--eval-result' : ''}${locked ? ' pv-card--eval-locked' : ''}${e.brand ? ` pv-card--brand-${e.brand}` : ''}`}
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
        meta={e.kind ? (resultOnly ? <EvalCardResultMeta e={e} t={t} /> : <MetaComp e={e} t={t} />) : (
          e.status === 'upcoming' && e.date !== '—'
            ? `${t.eval_upcoming_on} ${e.date}`
            : e.status === 'done'
              ? `${t.eval_passed_on} ${e.date}`
              : t.status_todo
        )}
        cta={e.kind ? (
          linksToResults ? (
            <div className="portal-eval-action is-results">
              <span className="portal-eval-action-label">
                {t.eval_btn_view_results}
              </span>
            </div>
          ) : <ResultComp e={e} t={t} locked={locked} />
        ) : undefined}
        accentColor={locked ? 'var(--muted)' : evalAccentColor(e)}
        onClick={locked ? undefined : (linksToResults ? onViewResults : () => onOpen(e))}
        hoverHint={hoverHint}
        corner
      />
    </div>
  )
}
