import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useCampaign } from '../App'
import BrandLogo from '../components/BrandLogo'
import { IconArrowLeft, IconBook, IconInfo, IconUsers } from '../components/icons'
import PageCloseButton from '../components/PageCloseButton'
import PlaceSelect from '../components/PlaceSelect'
import { useReportSaveStatus } from '../components/SaveStatus'
import { AsyncBoundary, Banner, Counter, Empty } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { brandTheme } from '../lib/brandColors'
import { openFicheWindow } from '../lib/fichePaths'
import { useAsync, useDebouncedSave, useElementVisible } from '../lib/hooks'
import { formatGroupHeading, groupRank, groupTitleI18nKey, isProcessFamily, lineGroupKey } from '../lib/levels'
import { resolvePlace } from '../lib/placeRules'

const QUARTERS = ['q1', 'q2', 'q3', 'q4']
const TRANSVERSE = '__transverse__'

/** Le pôle porte son propre logo groupe — Equipment n'est pas Mobility. */
const POLE_LOGO = {
  EQUIPMENT: { src: '/assets/logo_cfao_equipment.png', alt: 'CFAO Equipment' },
  DEFAULT: { src: '/assets/logo-cfao-mobility.jpg', alt: 'CFAO Mobility' },
}

/**
 * Saisie des besoins d'une marque — troisième et dernière page du parcours.
 *
 * Maille 2027 : une formation × quatre trimestres × (effectif + lieu). Academix
 * ne demandait qu'un trimestre et un effectif ; le fichier de travail 2027 demande
 * les quatre, chacun avec son lieu souhaité.
 *
 * On ne charge que le catalogue de la marque ouverte, pas les 261 lignes de la
 * campagne : c'est tout l'intérêt d'entrer par la marque plutôt que par une
 * grille unique à filtrer.
 */
export default function BrandEntry() {
  const { t } = useLocale()
  const { code } = useParams()
  const [params] = useSearchParams()
  const pole = params.get('pole') || ''
  // La section vient de la carte cliquée : une marque porte des formations
  // techniques ET des formations process, et l'écran n'ouvre que les unes ou les
  // autres — sinon les compteurs annoncés sur la carte ne tomberaient pas juste.
  const section = params.get('section') || ''
  const { campaign, submission, ensureSubmission } = useCampaign()

  const state = useAsync(async () => {
    if (!campaign) return null
    // La fiche s'ouvre au premier accès à une marque, pas à la connexion.
    const target = submission ?? (await ensureSubmission())
    const query = { brand: code }
    if (section) query.section = section
    if (code === TRANSVERSE && pole) query.pole = pole
    const [catalog, lines] = await Promise.all([
      api.catalog(campaign.id, query),
      api.lines(target.id),
    ])
    return {
      submission: target,
      catalog: catalog?.results ?? catalog ?? [],
      lines: lines?.results ?? lines ?? [],
    }
  }, [campaign?.id, submission?.id, code, pole, section])

  if (!campaign) return <Empty>{t('app.loading')}</Empty>

  return (
    <AsyncBoundary state={state}>
      {(data) => (
        <BrandGrid campaign={campaign} code={code} pole={pole} section={section} {...data} />
      )}
    </AsyncBoundary>
  )
}

function BrandGrid({ campaign, code, pole, section, submission, catalog, lines }) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { number } = useFormatters()
  const isCampaignClosed = campaign?.status === 'CLOSED'
  const isEditable = submission?.is_editable ?? (submission.status !== 'VALIDATED')
  const locked = isCampaignClosed || !isEditable

  const [values, setValues] = useState(() => {
    const map = {}
    lines.forEach((line) => {
      map[line.catalog_line_id] = {
        q1: line.q1, q2: line.q2, q3: line.q3, q4: line.q4,
        place_q1: line.place_q1, place_q2: line.place_q2,
        place_q3: line.place_q3, place_q4: line.place_q4,
      }
    })
    return map
  })

  const { queue, flush, state: saveState } = useDebouncedSave((rows, options) =>
    api.writeLines(submission.id, rows, options),
  )
  // Le témoin s'affiche dans le bandeau : sur une grille longue, un témoin en
  // pied de page n'est plus visible quand on remplit le haut du tableau.
  useReportSaveStatus(saveState)

  const isCarrosserie = pole === 'CARROSSERIE' || section === 'CARROSSERIE'
  const brandLabel =
    code === TRANSVERSE
      ? (isCarrosserie ? 'Carrosserie' : t('poles.transverse'))
      : catalog.find((line) => line.brand_label)?.brand_label || code

  // Technique / carrosserie : un groupe par palier (G4, Junior…).
  // Process SAV & Parts : un groupe par public cible (Front office…).
  const processMode = useMemo(
    () => catalog.some((line) => isProcessFamily(line.family_key)),
    [catalog],
  )

  const groups = useMemo(() => {
    const buckets = new Map()
    catalog.forEach((line) => {
      const key = lineGroupKey(line)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(line)
    })
    return [...buckets.entries()].sort(
      (a, b) => groupRank(a[0], { process: processMode }) - groupRank(b[0], { process: processMode }),
    )
  }, [catalog, processMode])

  const total = useMemo(
    () =>
      catalog.reduce((sum, line) => sum + totalOf(values[line.id]), 0),
    [catalog, values],
  )

  // « Sélectionnée » = au moins une place demandée. Une case à cocher séparée
  // dirait la même chose deux fois, et les deux finiraient par diverger.
  const selected = useMemo(
    () => catalog.filter((line) => totalOf(values[line.id]) > 0).length,
    [catalog, values],
  )

  // `immediate` : quitter une case ou choisir un lieu est un acte délibéré, pas
  // une frappe en cours. On envoie tout de suite au lieu d'attendre la
  // temporisation. Conséquence voulue : la fenêtre « non enregistré » se réduit
  // au temps passé DANS une case, et l'alerte du navigateur au rechargement
  // devient rare — donc crédible quand elle apparaît.
  function update(line, patch, { immediate = false } = {}) {
    const current = values[line.id] ?? blank()
    const next = { ...current, ...patch }
    // Cameroun : le lieu suit l'effectif du trimestre (≤6 Douala, ≥7 agence).
    for (const q of QUARTERS) {
      next[`place_${q}`] = resolvePlace(submission.country, next[q], next[`place_${q}`])
    }
    setValues((prev) => ({ ...prev, [line.id]: next }))
    queue({ catalog_line: line.id, ...next })
    if (immediate) flush()
  }

  // Sortie de case sans modification : rien en attente, `flush` ne fait rien.
  function commit() {
    flush()
  }

  async function back() {
    await flush()
    navigate('/', { state: { fromBrand: true } })
  }

  async function save() {
    await flush()
  }

  const logo = POLE_LOGO[pole] ?? POLE_LOGO.DEFAULT
  const theme = brandTheme(code === TRANSVERSE ? '' : code)
  // Un seul « Retour » visible : celui du bandeau tant qu'il est à l'écran,
  // celui de la barre sticky dès que le bandeau a disparu au scroll.
  const headRef = useRef(null)
  const headVisible = useElementVisible(headRef, { threshold: 0.15 })

  return (
    <div className="stack brand-entry" style={theme.css}>
      <div className="card entry-head" ref={headRef}>
        <PageCloseButton ariaLabel={t('brand.closeAria')} onClick={back} />
        <div className="entry-head__side">
          <img src={logo.src} alt={logo.alt} className="entry-head__group" />
        </div>
        <div className="entry-head__center">
          <h1 className="entry-head__title">
            {t('brand.listTitle', { brand: brandLabel, year: campaign.year })}
          </h1>
          <p className="entry-head__subtitle">
            <span className="entry-head__subtitle-label">
              <IconInfo />
              {t('brand.helpTitle')}
            </span>{' '}
            {t('brand.help', { year: campaign.year })}
          </p>
        </div>
        <div className="entry-head__side entry-head__side--end">
          <BrandLogo
            code={code}
            label={brandLabel}
            variant={isCarrosserie ? 'carrosserie' : undefined}
            transverse={code === TRANSVERSE}
            size={80}
          />
        </div>
      </div>

      <div className="counter-grid">
        <Counter
          tone="red"
          icon={<IconUsers />}
          label={t('dashboard.kpiPlaces')}
          value={number(total)}
        />
        <Counter
          tone="ok"
          icon={<IconBook />}
          label={t('dashboard.kpiThemes')}
          value={number(selected)}
        />
      </div>

      {locked ? (
        <Banner tone="info">{t('grid.locked')}</Banner>
      ) : submission.status === 'SUBMITTED' ? (
        <Banner tone="ok">
          Vos besoins ont été transmis à CFAO Academy. Vous pouvez continuer à les modifier tant que la campagne est ouverte.
        </Banner>
      ) : null}

      {catalog.length === 0 ? (
        <Empty>{t('grid.noResult')}</Empty>
      ) : (
        groups.map(([level, rows]) => (
          <TierCard
            key={level || 'none'}
            level={level}
            processMode={processMode}
            rows={rows}
            year={campaign.year}
            values={values}
            locked={locked}
            country={submission.country}
            orgUnitLabel={submission.org_unit_label}
            onChange={update}
            onCommit={commit}
          />
        ))
      )}

      <div className="card entry-actions">
        {!headVisible && (
          <Link
            to="/"
            className="btn"
            onClick={(event) => {
              event.preventDefault()
              back()
            }}
          >
            <IconArrowLeft />
            {t('brand.back')}
          </Link>
        )}
        <button type="button" className="btn btn--primary" onClick={save}>
          {t('brand.save')}
        </button>
      </div>
    </div>
  )
}

/**
 * Une carte de regroupement : palier de compétence, ou public cible (Process).
 *
 * Les groupes structurent la page à la place des filtres. Chaque carte
 * réaffiche ses en-têtes de colonnes — sur une page longue, une ligne de titres
 * restée en haut ne dit plus à quoi correspond la colonne qu'on remplit.
 */
function TierCard({
  level,
  processMode = false,
  rows,
  year,
  values,
  locked,
  country,
  orgUnitLabel,
  onChange,
  onCommit,
}) {
  const { t, tField } = useLocale()
  const heading = formatGroupHeading(level, t, { process: processMode })

  return (
    <div className="card brand-entry__tier">
      <div className="card__head">
        <h2>{t(groupTitleI18nKey(processMode), { level: heading, audience: heading })}</h2>
        <span className="muted">
          {t(rows.length === 1 ? 'poles.theme' : 'poles.themes', { count: rows.length })}
        </span>
      </div>

      {/* Vue tableau pour Desktop (masquée sur mobile <= 768px via CSS) */}
      <div className="table-wrap brand-entry__desktop-table">
        <table className="grid-table grid-table--brand">
          {/* Largeurs fixes : chaque palier a son propre <table>, sinon la
              1ʳᵉ colonne s'étire selon les titres et les filets ne s'alignent plus. */}
          <colgroup>
            <col className="grid-col--title" />
            <col className="grid-col--qty" span={4} />
            <col className="grid-col--place" span={4} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>{t('grid.colTraining')}</th>
              <th colSpan={4} className="num grid-col--split">
                {t('grid.colHeadcount', { year })}
              </th>
              <th colSpan={4} className="num grid-col--split">
                {t('grid.colPlace')}
              </th>
            </tr>
            <tr>
              {QUARTERS.map((q, index) => (
                <th
                  key={`h-${q}`}
                  className={`num${index === 0 ? ' grid-col--split' : ''}`}
                >
                  {t(`quarter.${q}`)}
                </th>
              ))}
              {QUARTERS.map((q, index) => (
                <th
                  key={`p-${q}`}
                  className={`num${index === 0 ? ' grid-col--split' : ''}`}
                >
                  {t(`quarter.${q}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => {
              const row = values[line.id] ?? blank()
              const filled = totalOf(row) > 0
              const disabled = locked || line.family_status !== 'READY'
              return (
                <tr key={line.id} data-filled={filled} data-locked={disabled}>
                  <td className="cell-title">
                    <button
                      type="button"
                      className="cell-title__open"
                      onClick={() =>
                        openFicheWindow(line, { title: tField(line, 'title') })
                      }
                      aria-label={t('fiche.openAria', { code: line.code })}
                    >
                      <span className="cell-code">{line.code}</span>
                      <span className="cell-title__label">{tField(line, 'title')}</span>
                    </button>
                    {line.family_status !== 'READY' && (
                      <div className="muted" style={{ fontSize: 11.5 }}>
                        {t('grid.pendingRow')}
                      </div>
                    )}
                  </td>
                  {QUARTERS.map((q, index) => (
                    <td
                      key={`${line.id}-${q}`}
                      className={index === 0 ? 'grid-col--split' : undefined}
                      style={{ textAlign: 'center' }}
                    >
                      <input
                        className="qty"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        disabled={disabled}
                        data-positive={row[q] > 0}
                        value={row[q] || ''}
                        aria-label={`${line.code} ${t(`quarter.${q}`)}`}
                        onChange={(event) => onChange(line, { [q]: clamp(event.target.value) })}
                        onBlur={onCommit}
                      />
                    </td>
                  ))}
                  {QUARTERS.map((q, index) => (
                    <td
                      key={`${line.id}-p-${q}`}
                      className={index === 0 ? 'grid-col--split' : undefined}
                    >
                      <PlaceSelect
                        value={row[`place_${q}`]}
                        country={country}
                        orgUnitLabel={orgUnitLabel}
                        headcount={row[q]}
                        disabled={disabled || !row[q]}
                        aria-label={`${line.code} ${t('grid.colPlace')} ${t(`quarter.${q}`)}`}
                        onChange={(place) => onChange(line, { [`place_${q}`]: place }, { immediate: true })}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Vue cartes pour Mobile (masquée sur desktop > 768px via CSS) */}
      <div className="brand-entry__mobile-cards">
        {rows.map((line) => {
          const row = values[line.id] ?? blank()
          const total = totalOf(row)
          const filled = total > 0
          const disabled = locked || line.family_status !== 'READY'
          return (
            <div
              key={`mob-${line.id}`}
              className="brand-theme-card"
              data-filled={filled}
              data-locked={disabled}
            >
              <div className="brand-theme-card__head">
                <div className="brand-theme-card__badges">
                  <span className="cell-code">{line.code}</span>
                  {filled && (
                    <span className="brand-theme-card__total-pill">
                      Σ {total} {t(total === 1 ? 'poles.theme' : 'poles.themes', { count: total })}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="brand-theme-card__title-btn"
                  onClick={() =>
                    openFicheWindow(line, { title: tField(line, 'title') })
                  }
                  aria-label={t('fiche.openAria', { code: line.code })}
                >
                  <span className="brand-theme-card__title">
                    {tField(line, 'title')}
                  </span>
                  <span className="brand-theme-card__fiche-link">
                    Fiche ↗
                  </span>
                </button>
                {line.family_status !== 'READY' && (
                  <div className="muted brand-theme-card__pending">
                    {t('grid.pendingRow')}
                  </div>
                )}
              </div>

              <div className="brand-theme-card__quarters">
                {QUARTERS.map((q) => {
                  const qty = row[q] || ''
                  const hasQty = row[q] > 0
                  return (
                    <div
                      key={`mob-${line.id}-${q}`}
                      className="brand-quarter-tile"
                      data-active={hasQty}
                    >
                      <div className="brand-quarter-tile__header">
                        <span className="brand-quarter-tile__name">
                          {t(`quarter.${q}`)}
                        </span>
                        <span className="brand-quarter-tile__year">
                          {year}
                        </span>
                      </div>

                      <div className="brand-quarter-tile__controls">
                        <div className="brand-quarter-tile__field">
                          <label
                            className="brand-quarter-tile__label"
                            htmlFor={`qty-mob-${line.id}-${q}`}
                          >
                            Effectif
                          </label>
                          <input
                            id={`qty-mob-${line.id}-${q}`}
                            className="qty brand-quarter-tile__qty"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            disabled={disabled}
                            data-positive={hasQty}
                            value={qty}
                            placeholder="0"
                            aria-label={`${line.code} ${t(`quarter.${q}`)}`}
                            onChange={(event) =>
                              onChange(line, { [q]: clamp(event.target.value) })
                            }
                            onBlur={onCommit}
                          />
                        </div>

                        <div className="brand-quarter-tile__field brand-quarter-tile__field--place">
                          <label className="brand-quarter-tile__label">
                            {t('grid.colPlace')}
                          </label>
                          <PlaceSelect
                            value={row[`place_${q}`]}
                            country={country}
                            orgUnitLabel={orgUnitLabel}
                            headcount={row[q]}
                            disabled={disabled || !row[q]}
                            aria-label={`${line.code} ${t('grid.colPlace')} ${t(`quarter.${q}`)}`}
                            onChange={(place) =>
                              onChange(line, { [`place_${q}`]: place }, { immediate: true })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function blank() {
  return {
    q1: 0, q2: 0, q3: 0, q4: 0,
    place_q1: 'CFR', place_q2: 'CFR', place_q3: 'CFR', place_q4: 'CFR',
  }
}

function totalOf(row) {
  if (!row) return 0
  return QUARTERS.reduce((sum, q) => sum + (Number(row[q]) || 0), 0)
}

function clamp(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) return 0
  return Math.min(parsed, 9999)
}
