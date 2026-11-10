/**
 * Clé de répartition (cfao-planning) — écran applicatif sous la navbar du portail.
 *
 * Menu : 6 entrées au plus, plates, toujours visibles, un mot + une ligne d'aide
 * (publics pressés et peu techniques : pas de sous-menu, pas de menu déroulant,
 * la tâche principale du rôle en premier). Les droits viennent de /access (Cerbos).
 *
 * L'état est dans l'URL (vue, clé, mode, pays) : un lien copié rouvre le même écran.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import useMaintenance from '../../hooks/useMaintenance'
import { isMaintenanceError } from '../../lib/api'
import { makeFormatter } from '../../components/sheet/sheetExport'
import { planningApi } from '../../lib/planningApi'
import { planningMenu } from '../../utils/planningAccess'
import { AbcView, Banner, CountryView, Segmented, SheetSkeleton, TableView, ThemesView, errText, reviewText } from './costKey/costKeyViews'
import PrepareView from './costKey/PrepareView'
import SettingsView from './costKey/SettingsView'

const BASE = '/portail/cle-repartition'
/** Vues qui savent montrer « Tous pôles » d'une année. */
const ALL_VIEWS = new Set(['table', 'country', 'abc'])
/** Anciens liens : « Prévu / Réalisé » vit désormais dans ABC › Réalisé. */
const VIEW_ALIASES = { compare: 'abc' }
const POLES = ['MOTORS', 'EQUIPMENT']
const ALL = 'ALL'

/** Clé par défaut : la plus récente, Motors avant Equipment. */
function pickKey(keys) {
  if (!keys.length) return null
  return [...keys].sort((a, b) => b.year - a.year || a.pole.localeCompare(b.pole))
    .find(k => k.pole === 'MOTORS') ?? keys[0]
}

/**
 * Année et pôle lus dans l'URL (`annee`, `pole` ; `cle` reste compris pour les
 * anciens liens). Pôle par défaut : Tous. `ckey` = la clé concrète (Motors pour
 * « Tous »), utile aux vues qui ne travaillent que sur une clé.
 */
export function resolveScope(keys, search) {
  const fromCle = keys.find(k => String(k.id) === String(search.get('cle')))
  const years = [...new Set(keys.map(k => k.year))].sort((a, b) => b - a)
  const year = Number(search.get('annee')) || fromCle?.year || years[0] || null
  const raw = String(search.get('pole') || fromCle?.pole || ALL).toUpperCase()
  const pole = raw === ALL || POLES.includes(raw) ? raw : ALL
  const yearKeys = keys.filter(k => k.year === year)
  const ckey = pole === ALL ? pickKey(yearKeys) : (yearKeys.find(k => k.pole === pole) ?? null)
  // Une seule clé dans l'année : « Tous » est cette clé (mêmes chiffres).
  const allPoles = pole === ALL && yearKeys.length > 1
  return { years, year, pole, ckey, allPoles }
}

export default function CleRepartition() {
  useSiteEffects()
  const { user, status: authStatus } = useAuth()
  const { t, locale } = useLocale('costKey')
  const [revealTick, setRevealTick] = useState(0)
  const fmt = useMemo(() => makeFormatter(locale), [locale])
  const navigate = useNavigate()
  const { view: rawView } = useParams()
  const viewParam = VIEW_ALIASES[rawView] ?? rawView
  const [search, setSearch] = useSearchParams()
  // La clé se lit sur le prévu ; le réalisé se consulte dans ABC › Réalisé.
  const mode = 'PLANNED'

  const [boot, setBoot] = useState({ loading: true })
  const [global, setGlobal] = useState({ loading: false })
  const [reload, setReload] = useState(0)
  // Emplacements de l'en-tête où une vue peut poser ses contrôles (filiale, export).
  const [titleSlot, setTitleSlot] = useState(null)
  const [toolsSlot, setToolsSlot] = useState(null)
  const slots = useMemo(() => ({ title: titleSlot, tools: toolsSlot }), [titleSlot, toolsSlot])
  const maintenance = useMaintenance()

  /* droits + clés */
  useEffect(() => {
    if (!user) return undefined
    let alive = true
    setBoot(b => ({ ...b, loading: true, error: null }))
    Promise.all([planningApi.access(), planningApi.keys()])
      .then(([access, keys]) => alive && setBoot({ loading: false, access, keys }))
      .catch(error => alive && setBoot({ loading: false, error }))
    return () => { alive = false }
  }, [user?.id, reload]) // eslint-disable-line react-hooks/exhaustive-deps

  const keys = boot.keys ?? []
  const { years, year, pole, ckey, allPoles } = resolveScope(keys, search)
  // Portée du Tableau et de la fiche Pays : une clé, ou « tous pôles » de l'année.
  const scope = allPoles ? { id: null, year, pole: ALL, status: null } : ckey
  const scopeId = allPoles ? `year:${year}` : ckey?.id

  /* tableau global : sert au Tableau, à la liste des pays et au périmètre */
  useEffect(() => {
    if (!scopeId) return undefined
    let alive = true
    setGlobal(g => ({ ...g, loading: true, error: null }))
    const load = allPoles ? planningApi.yearGlobal(year, mode) : planningApi.global(ckey.id, mode)
    load
      .then(data => alive && setGlobal({ loading: false, data }))
      .catch(error => alive && setGlobal({ loading: false, error }))
    return () => { alive = false }
  }, [scopeId, mode, reload]) // eslint-disable-line react-hooks/exhaustive-deps

  // Après une saisie : chiffres de l'année et jeton de gel à jour, sans squelette
  // (setReload démonterait le tableau, et la cellule en cours de saisie avec lui).
  const scopeRef = useRef(scopeId)
  scopeRef.current = scopeId
  const silentSeq = useRef(0)
  const ckeyId = ckey?.id
  const refreshSilently = useCallback(() => {
    if (!scopeId) return Promise.resolve()
    silentSeq.current += 1
    const seq = silentSeq.current
    const load = allPoles ? planningApi.yearGlobal(year, mode) : planningApi.global(ckeyId, mode)
    return Promise.all([load, planningApi.keys()]).then(([data, nextKeys]) => {
      if (seq !== silentSeq.current || scopeRef.current !== scopeId) return
      setGlobal(g => ({ ...g, data }))
      setBoot(b => ({ ...b, keys: nextKeys }))
    }).catch(() => undefined)
  }, [scopeId, allPoles, year, ckeyId, mode])

  const menu = planningMenu(boot.access, { scoped: Boolean(global.data?.partial), roles: user?.roles })
  const view = menu.includes(viewParam) ? viewParam : (ckey ? menu[0] : (menu.includes('prepare') ? 'prepare' : menu[0]))

  // Sens du glissement : vers la gauche si l'entrée cible est plus loin dans le menu.
  const lastView = useRef({ view, dir: 'next' })
  if (lastView.current.view !== view) {
    const dir = menu.indexOf(view) < menu.indexOf(lastView.current.view) ? 'prev' : 'next'
    lastView.current = { view, dir }
  }
  const slideDir = lastView.current.dir

  const go = useCallback((nextView, patch = {}) => {
    const next = new URLSearchParams(search)
    Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
    navigate(`${BASE}/${nextView}${next.toString() ? `?${next}` : ''}`)
  }, [navigate, search])

  const setParams = patch => {
    const next = new URLSearchParams(search)
    Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
    setSearch(next, { replace: true })
  }

  const onKeyChange = key => {
    setReload(r => r + 1)
    if (key?.id) setParams({ cle: null, annee: key.year, pole: key.pole })
  }

  if (authStatus !== 'loading' && !user) return <Navigate to="/login" replace />

  // Lecteur (ni préparation, ni import, ni gel) : écran réduit à l'essentiel.
  const simple = !(boot.access?.manage || boot.access?.import || boot.access?.freeze)
  const itemLabel = id => (id === 'country' && global.data?.partial ? t.nav_country_scoped : t[`nav_${id}`])

  let body
  if (boot.loading) body = <SheetSkeleton label={t.loading} kpis />
  else if (boot.error?.status === 403 || (boot.access && !boot.access.view)) body = <Banner tone="warn">{t.no_access}</Banner>
  else if (boot.error) {
    body = (
      <div className="ck-error">
        <Banner tone="warn">{isMaintenanceError(boot.error) ? t.err_maintenance : t.error}</Banner>
        <button type="button" className="ck-btn" onClick={() => setReload(r => r + 1)}>{t.retry}</button>
      </div>
    )
  } else if (view === 'prepare') {
    body = (
      <PrepareView t={t} fmt={fmt} access={boot.access} ckey={ckey}
        onKeyChange={onKeyChange} onDataChanged={() => setReload(r => r + 1)} onRefresh={refreshSilently} />
    )
  } else if (!ckey && keys.length && pole !== ALL) {
    const msg = menu.includes('prepare') ? t.no_key_pole_manage : t.no_key_pole
    body = <Banner tone="info">{msg.replace('{pole}', t[`pole_${pole}`] || pole).replace('{year}', year)}</Banner>
  } else if (!ckey) {
    body = <Banner tone="info">{menu.includes('prepare') ? t.no_key_manage : t.no_key}</Banner>
  } else if (view === 'settings') {
    body = <SettingsView t={t} fmt={fmt} ckey={ckey} onSaved={onKeyChange} />
  } else if (view === 'abc') {
    body = <AbcView t={t} fmt={fmt} scope={allPoles ? scope : ckey} ckey={ckey} />
  } else if (view === 'themes') body = <ThemesView t={t} ckey={ckey} />
  else if (global.error) body = <Banner tone="warn">{errText(t, global.error)}</Banner>
  // Pôle, année, mode : tout rechargement affiche le squelette à la place de l'ancien tableau.
  else if (!global.data || global.loading) body = <SheetSkeleton label={t.loading} kpis />
  else if (view === 'country') {
    body = (
      <CountryView t={t} locale={locale} fmt={fmt} ckey={scope} mode={mode} global={global.data}
        code={search.get('pays')} setCode={c => setParams({ pays: c, session: null })}
        session={search.get('session')} revealTick={revealTick} slots={slots}
        canEdit={Boolean(boot.access?.edit)} onEdited={refreshSilently} />
    )
  } else {
    body = (
      <TableView t={t} locale={locale} fmt={fmt} ckey={scope} mode={mode} global={global.data}
        openCountry={(code, session = null) => go('country', { pays: code, session })} simple={simple}
        canReview={Boolean(boot.access?.review)} />
    )
  }

  // « Tous » n'a de sens que sur les vues qui consolident l'année ; ailleurs, une clé.
  const allHere = allPoles && ALL_VIEWS.has(view)
  const shownPole = pole === ALL && !ALL_VIEWS.has(view) ? ckey?.pole : pole
  const status = allHere ? global.data?.status : ckey?.status
  const frozen = status === 'FROZEN'
  const poleOptions = [...(ALL_VIEWS.has(view) ? [ALL] : []), ...POLES]
    .map(p => ({ value: p, label: t[`pole_${p}`] || p }))
  // Le menu du module vit dans la navbar : la page garde toute la largeur.
  const appNav = {
    activeKey: view,
    items: menu.map(id => ({
      key: id, label: itemLabel(id), hint: t[`hint_${id}`],
      to: `${BASE}/${id}${search.toString() ? `?${search}` : ''}`,
    })),
  }
  // Incohérences à trancher : la cloche remplace le menu Aide dans ce module.
  const notifications = (global.data?.review_items || []).flatMap(i => {
    const text = reviewText(t, locale, i)
    return text
      ? [{ id: i.id, label: `${i.country_label} · ${i.code}`, text, cta: t.review_open,
        onOpen: () => { go('country', { pays: i.country, session: i.code }); setRevealTick(n => n + 1) } }]
      : []
  })
  return (
    <>
      <Nav appNav={menu.length ? appNav : undefined} notifications={notifications} hideHelp />
      <main className="portal-page ck-page">
        <div className="ck-shell">
          <div className="ck-main">
            <header className="ck-topbar">
              <div className="ck-topbar-title">
                {!simple && <p className="ck-eyebrow">{t.eyebrow}</p>}
                <div className="ck-topbar-heading">
                  <h1 id="ck-view-title">{menu.includes(view) ? itemLabel(view) : t.title}</h1>
                  {/* La vue Filiale y pose son choix de filiale (portail) : une seule ligne. */}
                  <div className="ck-topbar-slot" ref={setTitleSlot} />
                </div>
              </div>
              {year && (
                <div className="ck-topbar-tools">
                  <div className="ck-topbar-slot" ref={setToolsSlot} />
                  {/* L'année est un filtre, même quand une seule année existe. */}
                  <label className="ck-pill-select">
                    <span className="ck-sr">{t.key_label}</span>
                    <select value={year} onChange={e => setParams({ cle: null, annee: e.target.value })}>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  <Segmented value={shownPole} options={poleOptions} label={t.pole_label}
                    onChange={p => setParams({ cle: null, pole: p === ALL ? null : p })} />
                  {status && (
                    <span className={`portal-status-chip ${frozen ? 'closed' : 'open'}`}>
                      {t[`status_${status}`] || status}
                    </span>
                  )}
                </div>
              )}
            </header>
            {maintenance && <Banner tone="info">{t.maintenance}</Banner>}
            {global.data?.partial && ALL_VIEWS.has(view) && <Banner tone="info">{t.partial}</Banner>}
            {frozen && !allHere && view === 'table' && ckey?.frozen_at && (
              <Banner tone="info">{t.frozen_banner.replace('{date}', new Date(ckey.frozen_at).toLocaleDateString())}</Banner>
            )}
            <div key={view} className={`ck-view ck-view--${slideDir}`}>{body}</div>
          </div>
        </div>
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
