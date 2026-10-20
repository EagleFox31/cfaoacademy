import PvCard from './PvCard.jsx'
import EvalCardMedia from './EvalCardMedia.jsx'
import { findCatalogTraining } from '../utils/assignedTrainings.js'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import {
  evalAccentColor,
  evalScoreTier,
  evalScoreTierClass,
  formatEvalDate,
  isEvalTestLocked,
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
    <span className={`portal-eval-score portal-eval-score--card${evalScoreTierClass(tier)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      <span className="portal-eval-score-value">{e.score}</span>
      <span className="portal-eval-score-denom">%</span>
      {e.minReason && (
        <span
          className="portal-info-tooltip-badge"
          tabIndex="0"
          role="button"
          aria-label={e.minReason}
          style={{ cursor: 'help' }}
          onClick={(ev) => ev.stopPropagation()}
        >
          i
          <span className="portal-badge-tooltip" role="tooltip">
            {e.minReason}
          </span>
        </span>
      )}
    </span>
  )
}

export function evalCardStatusLabel(e, t, locked = false) {
  if (locked) return t.status_locked ?? t.status_coming_soon ?? 'Verrouillé'
  if (e.status === 'done') return t.status_done
  if (e.status === 'progress') return t.status_progress
  if (e.status === 'upcoming') return t.status_upcoming
  return t.status_todo
}

export function evalCardStatusClass(e, locked = false) {
  if (locked) return 'locked'
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
  if (e.status === 'done' && e.date) {
    dateHint = e.date.startsWith('Passé') || e.date.startsWith('Transposé')
      ? e.date
      : `${t.eval_passed_on} ${formatEvalDate(e.date)}`
  } else if (e.status === 'upcoming' && e.date !== '—') {
    dateHint = `${t.eval_upcoming_on} ${formatEvalDate(e.date)}`
  }

  const formationMeta = resolveEvalFormationMeta(e, t)

  return (
    <div className="portal-eval-card-meta">
      {formationMeta && (
        <div className="portal-eval-meta-row portal-eval-meta-row--sub">
          <span className="portal-eval-meta-val">{formationMeta}</span>
        </div>
      )}
      {e.subDetail && (
        <div className="portal-eval-meta-row portal-eval-meta-row--sub" style={{ fontWeight: 600, color: 'var(--ink, #0e1126)' }}>
          <span className="portal-eval-meta-val">{e.subDetail}</span>
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

const BRAND_LOGOS = {
  toyota:          '/assets/logos/toyota.png',
  mercedes:        '/assets/logos/mercedes.png',
  'mercedes-benz': '/assets/logos/mercedes.png',
  suzuki:          '/assets/logos/suzuki.png',
  mitsubishi:      '/assets/logos/mitsubishi.png',
  fuso:            '/assets/logos/fuso.png',
  hino:            '/assets/logos/hino.png',
  byd:             '/assets/logos/byd.png',
  citroen:         '/assets/logos/citroen.png',
  yamaha:          '/assets/logos/yamaha.png',
  'renault-trucks':'/assets/logos/renault-trucks.png',
  sinotruk:        '/assets/logos/sinotruk.png',
  shacman:         '/assets/logos/shacman.png',
  'king-long':     '/assets/logos/kinglong.png',
  kinglong:        '/assets/logos/kinglong.png',
  bt:              '/assets/logos/bt.png',
  jcb:             '/assets/logos/jcb.png',
  lovol:           '/assets/logos/lovol.png',
}

function EvalCardResult({ e, t, locked = false, statusOnly = false }) {
  const inProgress = e.status === 'progress'

  return (
    <div className="portal-eval-result-row">
      <span className="portal-eval-result-lbl">{statusOnly ? (t.eval_label_status ?? 'Statut') : t.eval_label_result}</span>
      <div className="portal-eval-result-val">
        {locked ? (
          <span className="portal-eval-result-pending portal-status-chip locked">
            {t.status_locked ?? t.status_coming_soon ?? 'Verrouillé'}
          </span>
        ) : inProgress ? (
          <span className="portal-eval-finish-cta">{t.eval_finish_test}</span>
        ) : statusOnly ? (
          <span className={`portal-status-chip ${evalCardStatusClass(e, locked)}`}>
            {evalCardStatusLabel(e, t, locked)}
          </span>
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

export function EvalKicker({ e, t, user, showBrandLogo = false }) {
  const isCompetency = e.kind === 'competency'
  const modalityLabel = e.modality === 'practical' ? t.test_modality_practical : t.test_modality_theory
  const modalityClass = e.modality === 'practical' ? 'kind-practical' : 'kind-theory'
  const tierLabel = isCompetency && e.competencyTier
    ? resolveCompetencyTierLabel(e.competencyTier, t, user)
    : e.kind === 'formation' && e.code
      ? e.code
      : e.certLevel

  const brand = e.brand
  const brandLogo = brand ? (BRAND_LOGOS[brand] ?? `/assets/logos/${brand}.png`) : null

  return (
    <span className="pv-card-kicker-row portal-eval-kicker">
      {showBrandLogo && brandLogo && (
        <span className="portal-kicker-brand-logo-wrap" title={brand}>
          <img src={brandLogo} alt={brand} className="portal-kicker-brand-logo" />
        </span>
      )}
      {e.modality && (
        <span className={`portal-status-chip ${modalityClass}`}>
          {modalityLabel}
        </span>
      )}
      {tierLabel && (
        <span className={`portal-status-chip tier tier--${(e.competencyTier ?? '').toLowerCase()}`}>
          {tierLabel}
        </span>
      )}
      {!isCompetency && e.certLevel && e.certLevel !== tierLabel && (
        <span className="portal-status-chip level-cert">{e.certLevel}</span>
      )}
    </span>
  )
}

export function EvalDetail({ e, t, user }) {
  const isCompetency = e.kind === 'competency'
  return (
    <>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.test_modal_kind}</span>
        <span className="portal-modal-value">
          {isCompetency
            ? (t.test_kind_competency_multibrand ?? 'Mesure de compétences (Multimarque)')
            : (t.test_kind_formation ?? 'Formation')}
        </span>
      </div>
      {e.competencyTier && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.test_modal_tier}</span>
          <span className="portal-modal-value">
            {resolveCompetencyTierLabel(e.competencyTier, t, user)}
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
      {!isCompetency && e.kind === 'formation' && e.code && (() => {
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
      {!isCompetency && e.brand && (
        <div className="portal-modal-row">
          <span className="portal-modal-label">{t.modal_brand}</span>
          <span className={`portal-brand-chip ${e.brand}`}>{e.brand}</span>
        </div>
      )}
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.modal_date}</span>
        <span className="portal-modal-value">{formatEvalDate(e.date)}</span>
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
          <span className="portal-modal-value">{e.passMark}%</span>
        </div>
      )}
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.eval_label_result}</span>
        {e.status === 'progress' ? (
          <span className="portal-modal-value portal-eval-finish-cta">{t.eval_finish_test}</span>
        ) : e.score != null ? (
          <span className={`portal-eval-score${evalScoreTierClass(evalScoreTier(e.score))}`} style={{ fontSize: 18 }}>
            {e.score}%
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

export default function LearnerEvalCard({
  e,
  user,
  lms,
  t,
  onOpen,
  statusOnly = false,
  showBrandLogo = false,
  titleOverride = null,
}) {
  const isCompetency = e.kind === 'competency'
  const locked = isEvalTestLocked(user, lms, e)
  const fallbackMedia = portalPvCardMedia({
    brand: isCompetency ? undefined : e.brand,
    modality: e.modality,
    kind: isCompetency ? 'eval' : 'formation',
  })
  const evalMedia = resolveEvalCardMedia(e, user)
  const cardImg = e.img ?? evalMedia?.img ?? fallbackMedia.img
  const cardImgFallback = e.imgFallback ?? evalMedia?.imgFallback ?? fallbackMedia.imgFallback
  const modalityLabel = e.modality === 'practical'
    ? t.test_modality_practical
    : t.test_modality_theory

  let hoverHint = t.card_view_detail
  if (locked) hoverHint = `🔒 ${t.status_locked ?? t.status_coming_soon ?? 'Verrouillé'}`
  else if (e.status === 'progress') hoverHint = e.medacap?.launchUrl ? t.test_launch : t.eval_finish_test
  else if (e.status !== 'done' && e.medacap?.launchUrl) hoverHint = t.test_launch
  if (statusOnly && !locked && e.status !== 'done') hoverHint = t.tests_hover_launch ?? hoverHint

  const tierClass = isCompetency && e.competencyTier ? ` pv-card--tier-${e.competencyTier.toLowerCase()}` : ''
  const brandClass = !isCompetency && e.brand ? ` pv-card--brand-${e.brand}` : ''

  return (
    <div id={`portal-card-${e.id}`} className="portal-card-anchor">
      <PvCard
        className={`pv-card--eval${locked ? ' pv-card--eval-locked' : ''}${brandClass}${tierClass}${isCompetency ? ' pv-card--competency' : ''}`}
        cardMedia={e.modality ? (
          <EvalCardMedia
            img={cardImg}
            imgFallback={cardImgFallback}
            modality={e.modality}
            statusLabel={!statusOnly && e.kind ? evalCardStatusLabel(e, t, locked) : undefined}
            statusClass={!statusOnly && e.kind ? evalCardStatusClass(e, locked) : undefined}
            locked={locked}
          />
        ) : undefined}
        img={e.modality ? undefined : cardImg}
        imgFallback={cardImgFallback}
        variant={evalMedia ? undefined : fallbackMedia.variant}
        logo={isCompetency ? undefined : fallbackMedia.logo}
        brandLabel={isCompetency ? undefined : fallbackMedia.brandLabel}
        kicker={statusOnly ? undefined : (e.kind ? <EvalKicker e={e} t={t} user={user} showBrandLogo={showBrandLogo} /> : (
          e.status === 'upcoming'
            ? <span className="portal-status-chip todo">{t.status_upcoming}</span>
            : <span className="portal-status-chip done">{t.status_done}</span>
        ))}
        title={titleOverride ?? resolveEvalTitle(e, t, user)}
        meta={e.kind ? <EvalCardMeta e={e} t={t} /> : (
          e.status === 'upcoming' && e.date !== '—'
            ? `${t.eval_upcoming_on} ${formatEvalDate(e.date)}`
            : e.status === 'done'
              ? `${t.eval_passed_on} ${formatEvalDate(e.date)}`
              : t.status_todo
        )}
        cta={e.kind ? <EvalCardResult e={e} t={t} locked={locked} statusOnly={statusOnly} /> : undefined}
        accentColor={locked ? 'var(--muted)' : isCompetency ? (e.competencyTier === 'expert' ? '#047857' : e.competencyTier === 'senior' ? '#d97706' : '#0284c7') : evalAccentColor(e)}
        onClick={locked ? undefined : () => onOpen(e)}
        hoverHint={hoverHint}
        corner={locked ? false : true}
      />
    </div>
  )
}
