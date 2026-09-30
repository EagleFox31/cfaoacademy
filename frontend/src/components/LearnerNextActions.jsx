import { useRef } from 'react'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PvCard from './PvCard'
import EvalCardMedia from './EvalCardMedia.jsx'
import PortalSessionCard from './PortalSessionCard.jsx'
import LearnerEvalCard from './LearnerEvalCard.jsx'
import useLocale from '../hooks/useLocale'
import useAjustementEcran from '../hooks/useAjustementEcran.js'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import {
  evalAccentColor,
  resolveEvalCardMedia,
  resolveEvalFormationMeta,
  resolveEvalTitle,
} from '../utils/learnerTests.js'
import { planningSessionAccent } from '../utils/learnerPlanning.js'
import { scrollToPortalSection } from '../utils/portalScroll.js'

const VISIBLE_LIMIT = 4

function evalStatusLabel(e, t) {
  if (e.status === 'progress') return t.status_progress
  if (e.status === 'upcoming') return t.status_upcoming
  return t.status_todo
}

function evalStatusClass(e) {
  if (e.status === 'upcoming') return 'todo'
  return e.status ?? 'todo'
}

/* ─────────────────────────────────────────────────────────────
   Carte test — rendu HISTORIQUE (mode `mixed`, tous profils
   hors variante PL-MEDACAP). Inchangé.
   ───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   Vue HISTORIQUE — grille mélangée, max 3, aucun lien section.
   ───────────────────────────────────────────────────────────── */
function LegacyNextActions({ user, items, onEval }) {
  const { t } = useLocale('portal')
  const { t: cardsT } = useLocale('cards')

  if (!items?.length) return null

  return (
    <PortalReveal id="next-actions">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_next_actions}</p>
          <h2 className="portal-section-title">{t.title_next_actions}</h2>
        </div>
        <PortalStaggerGrid>
          {items.map(item => (
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

/* ─────────────────────────────────────────────────────────────
   Vue PL-MEDACAP — une seule catégorie, 4 max + lien section.
   ───────────────────────────────────────────────────────────── */
function PlMedacapNextActions({ user, lms, actions, onEval }) {
  const { t } = useLocale('portal')
  const { t: cardsT } = useLocale('cards')

  const category = actions?.category ?? null
  const items = actions?.items ?? []
  const sectionId = actions?.sectionId ?? null

  const isRedirectCategory = category === 'results' || category === 'pif'
  const contenu = useRef(null)
  useAjustementEcran(contenu, [category, items.length])
  if (!category || (!isRedirectCategory && !items.length)) return null

  const titleByCategory = {
    tests: t.next_actions_title_tests ?? t.title_next_actions,
    formations: t.next_actions_title_formations ?? t.title_next_actions,
    results: t.next_actions_title_results ?? t.title_next_actions,
    pif: t.next_actions_title_pif ?? t.title_next_actions,
  }
  const eyebrowByCategory = {
    tests: t.next_actions_eyebrow_tests ?? t.eyebrow_next_actions,
    formations: t.next_actions_eyebrow_formations ?? t.eyebrow_next_actions,
    results: t.next_actions_eyebrow_results ?? t.eyebrow_next_actions,
    pif: t.next_actions_eyebrow_pif ?? t.eyebrow_next_actions,
  }
  const redirectHintByCategory = {
    results: t.next_actions_results_hint,
    pif: t.next_actions_pif_hint,
  }
  const redirectCtaByCategory = {
    results: t.next_actions_see_results,
    pif: t.next_actions_see_pif,
  }

  const visible = items.slice(0, VISIBLE_LIMIT)
  const remaining = items.length - visible.length
  const showMoreLink = !isRedirectCategory && remaining > 0 && sectionId

  return (
    <PortalReveal id="next-actions" className="portal-next-actions-viewport">
      <div ref={contenu} className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head portal-section-head--with-action">
          <div>
            <p className="portal-section-eyebrow">{eyebrowByCategory[category]}</p>
            <h2 className="portal-section-title">{titleByCategory[category]}</h2>
          </div>
          {showMoreLink && (
            <button
              type="button"
              className="portal-next-actions-more"
              onClick={() => scrollToPortalSection(sectionId)}
            >
              {(category === 'tests'
                ? t.next_actions_see_more_tests
                : t.next_actions_see_more
              ).replace('{n}', String(items.length))}
              <span className="portal-next-actions-more-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </div>

        {isRedirectCategory ? (
          <div className="portal-next-actions-redirect">
            <p>{redirectHintByCategory[category]}</p>
            <button
              type="button"
              className="portal-next-actions-more"
              onClick={() => scrollToPortalSection(sectionId)}
            >
              {redirectCtaByCategory[category]} →
            </button>
          </div>
        ) : (
          <PortalStaggerGrid>
            {visible.map(item => (
              item.kind === 'eval' ? (
                <LearnerEvalCard
                  key={item.id}
                  e={item.data}
                  user={user}
                  lms={lms}
                  t={t}
                  onOpen={() => onEval(item.data)}
                />
              ) : (
                <div key={item.id} className="portal-card-anchor">
                  <PortalSessionCard
                    session={item.data}
                    annualStatus={item.data.annualStatus ?? item.badge}
                    t={t}
                    user={user}
                    allowSuggest
                    statusOnImage
                    accentColor={planningSessionAccent(item.data.annualStatus)}
                    hoverHint={cardsT.sessionFicheHint}
                  />
                </div>
              )
            ))}
          </PortalStaggerGrid>
        )}
      </div>
    </PortalReveal>
  )
}

export default function LearnerNextActions({ user, lms, actions, onEval }) {
  // `mixed` = comportement historique ; sinon = chaîne PL-MEDACAP.
  if (!actions || actions.category === 'mixed' || Array.isArray(actions)) {
    const items = Array.isArray(actions) ? actions : (actions?.items ?? [])
    return <LegacyNextActions user={user} items={items} onEval={onEval} />
  }
  return <PlMedacapNextActions user={user} lms={lms} actions={actions} onEval={onEval} />
}
