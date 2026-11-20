import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supervisionApi } from '../../../lib/supervisionApi'
import {
  REFUSED_PERIODS, absoluteTime, fill, modulePath, relativeTime, sortModules, statusTone, summarize, supervisionPath,
} from '../../../utils/supervisionStatus'

/** L'écran d'ensemble se recharge seul : un arrêt se voit en moins de 30 s. */
export const REFRESH_MS = 15000

/**
 * Charge `load()` puis le relance toutes les `every` ms. Un échec après un
 * premier succès garde les derniers chiffres et lève `failed`.
 */
function useLoad(load, deps, every = 0) {
  const [state, setState] = useState({ status: 'loading', data: null, failed: false, error: null })
  useEffect(() => {
    let live = true
    setState({ status: 'loading', data: null, failed: false, error: null })
    const run = () => load().then(
      data => { if (live) setState({ status: 'ready', data, failed: false, error: null }) },
      error => {
        if (live) setState(s => (s.data ? { ...s, failed: true, error } : { status: 'error', data: null, failed: true, error }))
      },
    )
    run()
    const id = every ? setInterval(run, every) : null
    return () => { live = false; if (id) clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

function When({ iso, locale }) {
  const rel = relativeTime(iso, locale)
  if (!rel) return <span>—</span>
  return <time dateTime={iso} title={absoluteTime(iso, locale) ?? undefined}>{rel}</time>
}

function Status({ status, t }) {
  return <span className={`dlv-status ${statusTone(status)}`}>{t[`status_${status}`] ?? status}</span>
}

function Loading({ state, t }) {
  if (state.status === 'loading') return <p className="dlv-hint">{t.loading}</p>
  if (state.error?.status === 404) return <div className="dlv-awaiting dlv-panel"><p className="dlv-panel-sub">{t.module_unknown}</p></div>
  return <div className="dlv-awaiting dlv-panel"><p className="dlv-panel-sub">{t.load_error}</p></div>
}

function RefreshFailed({ state, t }) {
  if (!state.failed) return null
  return <div className="dlv-readonly">{t.refresh_failed}</div>
}

function userLabel(user, t) {
  return user ?? t.user_unknown
}

const versionText = (version, t) => (version ? version : t.version_unknown)

const portText = p => (p.private && p.private !== p.public ? `${p.public} → ${p.private}` : String(p.public))

// ── État des modules ──

function ModuleCard({ m, t, locale }) {
  const down = m.status === 'down' || m.status === 'crashloop'
  const last = m.last_connection
  return (
    <Link to={modulePath(m.project)} className={`dlv-node dlv-node--link ${down ? 'crit' : ''}`}>
      <div className="dlv-node-head">
        <div>
          <b>{m.name}</b>
          <span className="mod">{m.project}</span>
        </div>
      </div>
      <div className="dlv-node-meta">
        <Status status={m.status} t={t} />
        {m.since && <span className="dlv-chip"><When iso={m.since} locale={locale} /></span>}
      </div>
      <div className="dlv-node-meta">
        <span className="dlv-chip">{versionText(m.version, t)}</span>
        {m.ports.map(p => <span key={p} className="dlv-chip">{fill(t.port, { port: p })}</span>)}
      </div>
      <p className="dlv-node-note">
        {fill(t.containers_count, { n: m.containers })}
        {m.problems > 0 && <> · <b>{fill(t.problems_count, { n: m.problems })}</b></>}
      </p>
      <div className="dlv-node-foot">
        <span>{t.deployed} <b><When iso={m.deployed_at} locale={locale} /></b></span>
        {'last_connection' in m && (
          <span>
            {t.last_connection}{' '}
            <b>{last ? <>{userLabel(last.user, t)}, <When iso={last.last_at} locale={locale} /></> : t.no_connection}</b>
          </span>
        )}
      </div>
    </Link>
  )
}

export function OverviewView({ t, locale }) {
  const state = useLoad(() => supervisionApi.overview(), [], REFRESH_MS)
  if (!state.data) return <Loading state={state} t={t} />
  const d = state.data
  const sums = summarize(d.counts)
  const modules = sortModules(d.modules)
  return (
    <>
      <RefreshFailed state={state} t={t} />
      {d.stale && (
        <div className="dlv-readonly">
          {d.collected_at ? fill(t.stale, { when: relativeTime(d.collected_at, locale) }) : t.never_collected}
        </div>
      )}
      {d.refused?.alerts > 0 && (
        <Link to={supervisionPath('refused')} className="dlv-alert">
          <span className="dlv-status blocked">{fill(t.refused_alert_badge, { n: d.refused.alerts })}</span>
          <span>{t.refused_alert_text}</span>
          <b>{t.refused_alert_link} →</b>
        </Link>
      )}
      <div className="dlv-kpis">
        <div className="dlv-kpi">
          <div className="dlv-kpi-k">{t.kpi_up}</div>
          <div className="dlv-kpi-v">{sums.up}</div>
          <div className="dlv-kpi-m">{t.kpi_up_hint}</div>
        </div>
        <div className="dlv-kpi">
          <div className="dlv-kpi-k">{t.kpi_watch}</div>
          <div className="dlv-kpi-v">{sums.watch}</div>
          <div className="dlv-kpi-m">{t.kpi_watch_hint}</div>
        </div>
        <div className="dlv-kpi">
          <div className="dlv-kpi-k">{t.kpi_down}</div>
          <div className="dlv-kpi-v">{sums.down}</div>
          <div className="dlv-kpi-m">{t.kpi_down_hint}</div>
        </div>
        <div className="dlv-kpi">
          <div className="dlv-kpi-k">{t.kpi_collected}</div>
          <div className="dlv-kpi-v"><small><When iso={d.collected_at} locale={locale} /></small></div>
          <div className="dlv-kpi-m">{t.kpi_collected_hint}</div>
        </div>
      </div>
      <h2 className="dlv-section-title">{t.section_modules}</h2>
      <div className="dlv-nodes-grid">
        {modules.map(m => <ModuleCard key={m.project} m={m} t={t} locale={locale} />)}
      </div>
    </>
  )
}

// ── Un module ──

function contractRows(containers = []) {
  const rows = new Map()
  for (const c of containers) {
    if (!c.counted) continue
    for (const [name, version] of Object.entries(c.provides ?? {})) rows.set(`p:${name}`, { name, way: 'provides', version })
    for (const [name, version] of Object.entries(c.consumes ?? {})) rows.set(`c:${name}`, { name, way: 'consumes', version })
  }
  return [...rows.values()].sort((a, b) => a.way.localeCompare(b.way) || a.name.localeCompare(b.name))
}

// Valeur d'un changement d'état ou de santé, dans les mots de l'écran.
const changeText = (kind, value, t) =>
  (value && (kind === 'state' || kind === 'health') && t[`value_${value}`]) || value || '—'

export function ModuleView({ project, t, locale, onName }) {
  const state = useLoad(() => supervisionApi.module(project), [project], REFRESH_MS)
  const history = useLoad(() => supervisionApi.history(project), [project])
  // Le titre de la page : le nom métier du module, pas son nom technique.
  const name = state.data?.name ?? null
  useEffect(() => { onName?.(name) }, [name, onName])
  const back = <p><Link to={supervisionPath()} className="dlv-aside-back">← {t.back_modules}</Link></p>
  if (!state.data) return <>{back}<Loading state={state} t={t} /></>
  const m = state.data
  const contracts = contractRows(m.container_list)
  const events = history.data?.events ?? []
  return (
    <>
      {back}
      <RefreshFailed state={state} t={t} />
      <div className="dlv-grid-3">
        <div className="dlv-panel">
          <div className="dlv-panel-k">{t.module_status}</div>
          <h4><Status status={m.status} t={t} /></h4>
          <p className="dlv-panel-sub">{m.since ? <When iso={m.since} locale={locale} /> : '—'}</p>
        </div>
        <div className="dlv-panel">
          <div className="dlv-panel-k">{t.module_version}</div>
          <h4>{versionText(m.version, t)}</h4>
          {m.version_detail && <p className="dlv-panel-sub">{fill(t.version_detail, { label: m.version_detail })}</p>}
        </div>
        <div className="dlv-panel">
          <div className="dlv-panel-k">{t.module_deployed}</div>
          <h4><When iso={m.deployed_at} locale={locale} /></h4>
          <p className="dlv-panel-sub">
            {m.ports.length ? fill(t.ports_list, { ports: m.ports.join(', ') }) : t.no_port}
            {m.public_prefix && <> · <code>{m.public_prefix}</code></>}
          </p>
        </div>
      </div>

      <h2 className="dlv-section-title">{t.section_changelog}</h2>
      <div className="dlv-panel">
        {m.changelog
          ? <div className="dlv-panel-sub dlv-changelog">{m.changelog}</div>
          : <p className="dlv-panel-sub">{t.changelog_missing}</p>}
      </div>

      <h2 className="dlv-section-title">{t.section_containers}</h2>
      <table className="dlv-table">
        <thead>
          <tr>
            <th>{t.col_service}</th><th>{t.col_status}</th><th>{t.col_version}</th>
            <th>{t.col_since}</th><th>{t.col_restarts}</th><th>{t.col_ports}</th>
          </tr>
        </thead>
        <tbody>
          {m.container_list.map(c => (
            <tr key={c.name}>
              <td><b>{c.service}</b>{c.number > 1 && ` #${c.number}`}{!c.counted && <div className="dlv-hint">{t.container_ignored}</div>}</td>
              <td><Status status={c.status} t={t} /></td>
              <td>{versionText(c.version, t)}{c.revision && <> <code>{c.revision}</code></>}</td>
              <td><When iso={c.since} locale={locale} /></td>
              <td>{c.restart_count ?? 0}</td>
              <td>{(c.ports ?? []).map(portText).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="dlv-section-title">{t.section_contracts}</h2>
      {contracts.length ? (
        <table className="dlv-table">
          <thead><tr><th>{t.col_contract}</th><th>{t.col_way}</th><th>{t.col_version}</th></tr></thead>
          <tbody>
            {contracts.map(r => (
              <tr key={`${r.way}:${r.name}`}>
                <td><code>{r.name}</code></td>
                <td>{t[`way_${r.way}`]}</td>
                <td>{r.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="dlv-hint">{t.no_contract}</p>}

      {'connections' in m && (
        <>
          <h2 className="dlv-section-title">{t.section_module_connections}</h2>
          <ConnectionsTable rows={m.connections} t={t} locale={locale} withModule={false} />
        </>
      )}

      <h2 className="dlv-section-title">{t.section_history}</h2>
      {events.length ? (
        <table className="dlv-table">
          <thead><tr><th>{t.col_when}</th><th>{t.col_service}</th><th>{t.col_change}</th><th>{t.col_before}</th><th>{t.col_after}</th></tr></thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={`${e.at}-${e.service}-${i}`}>
                <td><When iso={e.at} locale={locale} /></td>
                <td>{e.service}</td>
                <td>{t[`kind_${e.kind}`] ?? e.kind}</td>
                <td>{changeText(e.kind, e.before, t)}</td>
                <td>{changeText(e.kind, e.after, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="dlv-hint">{history.status === 'loading' ? t.loading : t.no_history}</p>}
    </>
  )
}

// ── API entre modules ──

const LINK_TONE = { ok: 'done', incompatible: 'blocked', missing: 'blocked', unknown: 'warn' }

export function DependenciesView({ t, locale }) {
  const state = useLoad(() => supervisionApi.dependencies(), [], REFRESH_MS)
  if (!state.data) return <Loading state={state} t={t} />
  const { links = [], unused = [] } = state.data
  return (
    <>
      <RefreshFailed state={state} t={t} />
      <h2 className="dlv-section-title">{t.section_links}</h2>
      {links.length ? (
        <table className="dlv-table">
          <thead>
            <tr><th>{t.col_contract}</th><th>{t.col_consumer}</th><th>{t.col_expects}</th><th>{t.col_provider}</th><th>{t.col_provides}</th><th>{t.col_status}</th></tr>
          </thead>
          <tbody>
            {links.map(l => (
              <tr key={`${l.contract}:${l.consumer}:${l.provider}`}>
                <td><code>{l.contract}</code></td>
                <td>{l.consumer}</td>
                <td>{l.expects}</td>
                <td>{l.provider ?? '—'}</td>
                <td>{l.provides ?? '—'}</td>
                <td><span className={`dlv-status ${LINK_TONE[l.status] ?? 'todo'}`}>{t[`link_${l.status}`] ?? l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="dlv-hint">{t.no_link}</p>}

      <h2 className="dlv-section-title">{t.section_unused}</h2>
      <p className="dlv-section-sub">{t.section_unused_sub}</p>
      {unused.length ? (
        <table className="dlv-table">
          <thead><tr><th>{t.col_contract}</th><th>{t.col_provider}</th><th>{t.col_provides}</th></tr></thead>
          <tbody>
            {unused.map(u => (
              <tr key={`${u.contract}:${u.provider}`}>
                <td><code>{u.contract}</code></td><td>{u.provider}</td><td>{u.provides}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="dlv-hint">{t.no_unused}</p>}
    </>
  )
}

// ── Dernières connexions ──

function ConnectionsTable({ rows = [], t, locale, withModule = true }) {
  if (!rows.length) return <p className="dlv-hint">{t.no_connection}</p>
  return (
    <table className="dlv-table">
      <thead>
        <tr>
          <th>{t.col_user}</th>{withModule && <th>{t.col_module}</th>}
          <th>{t.col_last_activity}</th><th>{t.col_last_login}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.user}:${r.project}:${i}`}>
            <td>{r.user ? <b>{r.user}</b> : <span className="dlv-hint">{t.user_unknown}</span>}</td>
            {withModule && <td>{r.module}</td>}
            <td><When iso={r.last_activity_at} locale={locale} /></td>
            <td><When iso={r.last_login_at} locale={locale} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ConnectionsView({ t, locale }) {
  const state = useLoad(() => supervisionApi.connections(), [], REFRESH_MS)
  if (!state.data) return <Loading state={state} t={t} />
  return (
    <>
      <RefreshFailed state={state} t={t} />
      <p className="dlv-section-sub">{fill(t.retention, { days: state.data.retention_days })}</p>
      <ConnectionsTable rows={state.data.connections} t={t} locale={locale} />
    </>
  )
}

// ── Connexions refusées par le pare-feu ──

function SourceNotice({ source, t, locale }) {
  if (source === null) return <div className="dlv-readonly">{t.refused_no_source}</div>
  if (source?.ok === false) {
    return (
      <div className="dlv-readonly">
        {source.last_success_at
          ? fill(t.refused_source_failed, { when: relativeTime(source.last_success_at, locale) })
          : t.refused_source_never}
      </div>
    )
  }
  return null
}

export function RefusedView({ t, locale }) {
  const [hours, setHours] = useState(24)
  const state = useLoad(() => supervisionApi.refused(hours), [hours], REFRESH_MS)
  const periods = (
    <div className="dlv-periods" role="group" aria-label={t.refused_period}>
      {REFUSED_PERIODS.map(h => (
        <button key={h} type="button" aria-pressed={h === hours}
          className={`dlv-btn${h === hours ? ' is-active' : ''}`} onClick={() => setHours(h)}>
          {t[`period_${h}`]}
        </button>
      ))}
    </div>
  )
  if (!state.data) return <>{periods}<Loading state={state} t={t} /></>
  const d = state.data
  const networks = d.networks ?? []
  const rule = { threshold: d.threshold, window: d.window_min }
  return (
    <>
      <RefreshFailed state={state} t={t} />
      <SourceNotice source={d.source} t={t} locale={locale} />
      {periods}
      <div className="dlv-kpis three">
        <div className={`dlv-kpi${d.alerts > 0 ? ' crit' : ''}`}>
          <div className="dlv-kpi-k">{t.refused_kpi_alerts}</div>
          <div className="dlv-kpi-v">{d.alerts}</div>
          <div className="dlv-kpi-m">{fill(t.refused_kpi_alerts_hint, rule)}</div>
        </div>
        <div className="dlv-kpi">
          <div className="dlv-kpi-k">{t.refused_kpi_total}</div>
          <div className="dlv-kpi-v">{d.total}</div>
          <div className="dlv-kpi-m">{t[`period_hint_${hours}`]}</div>
        </div>
        <div className="dlv-kpi">
          <div className="dlv-kpi-k">{t.refused_kpi_posts}</div>
          <div className="dlv-kpi-v">{networks.reduce((n, net) => n + net.addresses, 0)}</div>
          <div className="dlv-kpi-m">{fill(t.refused_kpi_posts_hint, { n: networks.length })}</div>
        </div>
      </div>

      <h2 className="dlv-section-title">{t.section_refused}</h2>
      <p className="dlv-section-sub">{fill(t.refused_rule, rule)}</p>
      {networks.length ? (
        <table className="dlv-table">
          <thead>
            <tr>
              <th>{t.col_post}</th><th>{t.col_state}</th><th>{t.col_refused_total}</th>
              <th>{fill(t.col_refused_recent, rule)}</th><th>{t.col_target_ports}</th>
              <th>{t.col_first_refused}</th><th>{t.col_last_refused}</th>
            </tr>
          </thead>
          <tbody>
            {networks.map(net => [
              <tr key={net.network} className="dlv-row-group">
                <td colSpan={7}>
                  <b>{fill(t.refused_network, { network: net.network })}</b>
                  {' · '}{fill(t.refused_network_sum, { n: net.addresses, total: net.total })}
                </td>
              </tr>,
              ...net.ips.map(ip => (
                <tr key={ip.ip}>
                  <td><code>{ip.ip}</code></td>
                  <td>
                    <span className={`dlv-status ${ip.alert ? 'blocked' : 'todo'}`}>
                      {ip.alert ? t.refused_state_alert : t.refused_state_isolated}
                    </span>
                  </td>
                  <td>{ip.total}</td>
                  <td>{ip.recent}</td>
                  <td>{ip.ports.length ? ip.ports.join(', ') : '—'}</td>
                  <td><When iso={ip.first_at} locale={locale} /></td>
                  <td><When iso={ip.last_at} locale={locale} /></td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      ) : <p className="dlv-hint">{d.source === null ? t.refused_none_no_source : t.refused_none}</p>}
      <p className="dlv-section-sub">{fill(t.refused_retention, { days: d.retention_days })}</p>
    </>
  )
}
