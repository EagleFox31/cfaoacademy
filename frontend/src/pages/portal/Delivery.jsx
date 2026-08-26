import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import LocaleSwitch from '../../components/LocaleSwitch'
import PortalDemoBar from '../../components/PortalDemoBar'
import CockpitSkeleton from '../../components/delivery/CockpitSkeleton'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import useLocale from '../../hooks/useLocale'
import useDeliveryState from '../../hooks/useDeliveryState'
import { pickLocale } from '../../utils/localizeDelivery'
import {
  canAccessDelivery,
  canEditDelivery,
  computeDeliveryKpis,
  computeGateProgress,
  computeProgress,
} from '../../utils/deliveryAccess'
import {
  CRITICAL_TE_TOTAL,
  CRITICAL_TE_TOTAL_EN,
  DELIVERY_EPICS,
  DELIVERY_EVENTS,
  DELIVERY_PHASES,
  DIGEST_HISTORY,
  DIGEST_RECIPIENTS,
  DIGEST_SCHEDULE,
  GANTT_BARS,
  GANTT_SCALE,
  GIT_CONFIG,
  PERT_CRITICAL_PATH,
  PERT_NODES,
  RECENT_COMMITS,
  WEEKLY_STATUS_DRAFT,
} from '../../data/mock_delivery'

// `.filter(Boolean)` : ces tableaux sont maintenus a la main. Une virgule en trop
// cree un trou (element undefined) qui faisait planter toute la page au chargement.
const NODE_BY_ID = Object.fromEntries(PERT_NODES.filter(Boolean).map(n => [n.id, n]))
const EPIC_BY_ID = Object.fromEntries(DELIVERY_EPICS.filter(Boolean).map(e => [e.id, e]))
const TEST_KEYS = ['tu', 'ti', 'contract', 'e2e']
const TEST_CYCLE = { pending: 'done', done: 'na', na: 'pending' }

const NAV = [
  { group: 'nav_group_pilotage', items: [
    { id: 'overview', ico: '◰' },
    { id: 'roadmap', ico: '⌗' },
    { id: 'phases', ico: '▤' },
  ] },
  { group: 'nav_group_delivery', items: [
    { id: 'backlog', ico: '☰' },
    { id: 'gate', ico: '⚑' },
    { id: 'events', ico: '⇄' },
    { id: 'reporting', ico: '✉' },
    { id: 'git', ico: '⎇' },
  ] },
]

/* ── petits composants ───────────────────────────── */
function Bar({ pct, tone = '' }) {
  return <div className={`dlv-bar ${tone}`}><i style={{ width: `${pct}%` }} /></div>
}

function TestDots({ story, editable, onTestChange, t }) {
  return (
    <div className="dlv-story-tests">
      {TEST_KEYS.map(k => {
        const val = story.tests?.[k] ?? 'na'
        const title = `${t[`test_${k}`]} · ${val === 'done' ? t.test_done : val === 'na' ? t.test_na : t.test_pending}`
        const cls = `dlv-tdot ${val}`
        if (editable) {
          return (
            <button key={k} type="button" className={cls} title={title}
              onClick={() => onTestChange(story.id, k, TEST_CYCLE[val])}>
              {t[`test_${k}`]}
            </button>
          )
        }
        return <span key={k} className={cls} title={title}>{t[`test_${k}`]}</span>
      })}
    </div>
  )
}

export default function Delivery() {
  useSiteEffects()
  const { user } = useAuth()
  usePortalBackground(user)
  const { t, locale, setLocale } = useLocale('delivery')
  const { t: commonT } = useLocale('common')
  const L = obj => pickLocale(obj, locale)
  const PHASE_BY_KEY = Object.fromEntries(DELIVERY_PHASES.map(p => [p.key, p]))

  const [view, setView] = useState('overview')
  const [epicFilter, setEpicFilter] = useState('all')
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [digestApproved, setDigestApproved] = useState(false)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setBooting(false), 550)
    return () => clearTimeout(id)
  }, [])

  const editable = canEditDelivery(user?.roles)
  const { stories, gate, updateStoryStatus, updateStoryTest, toggleGateItem } = useDeliveryState()

  const kpis = useMemo(() => computeDeliveryKpis(stories), [stories])
  const gateProgress = useMemo(() => computeGateProgress(gate), [gate])
  const storiesByEpic = useMemo(() => {
    const m = {}
    for (const s of stories) (m[s.epic] ??= []).push(s)
    return m
  }, [stories])

  const teTotal = locale === 'fr' || locale === 'pt' ? CRITICAL_TE_TOTAL : CRITICAL_TE_TOTAL_EN

  const storiesForNode = node => (node.epics || []).flatMap(eid => storiesByEpic[eid] || [])
  const nodeState = node => {
    const list = storiesForNode(node)
    const prog = computeProgress(list)
    if (prog.total === 0) {
      // Nœud sans stories backlog (ex. infra A) : statut porté par le nœud.
      return node.status === 'done' ? 'done' : node.status === 'in_progress' ? 'progress' : 'todo'
    }
    if (prog.pct === 100) return 'done'
    // « En cours » dès qu'au moins une story est terminée OU en cours (pas seulement in_progress).
    if (prog.done > 0 || list.some(s => s.status === 'in_progress')) return 'progress'
    return 'todo'
  }
  const storiesForPhase = phase => {
    const seen = new Set()
    const out = []
    for (const nid of phase.nodes) {
      for (const s of storiesForNode(NODE_BY_ID[nid] || {})) {
        if (!seen.has(s.id)) { seen.add(s.id); out.push(s) }
      }
    }
    return out
  }

  const filteredStories = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stories.filter(s => {
      if (epicFilter !== 'all' && s.epic !== epicFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (phaseFilter !== 'all' && EPIC_BY_ID[s.epic]?.phase !== phaseFilter) return false
      if (q && !(`${s.id} ${L(s.label)}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [stories, epicFilter, statusFilter, phaseFilter, search, locale])

  if (!user) return <Navigate to="/login" replace />
  if (!canAccessDelivery(user.roles)) return <Navigate to="/portail" replace />

  const navCount = {
    roadmap: PERT_NODES.length,
    phases: DELIVERY_PHASES.length,
    backlog: stories.length,
    gate: gate.length,
    events: DELIVERY_EVENTS.length,
  }

  return (
    <>
      <main className="dlv-page">
        <div className="dlv-app">
          {/* ── Sidebar ── */}
          <aside className="dlv-aside">
            <div className="dlv-brand">
              <div className="dlv-brand-badge">15</div>
              <div className="dlv-brand-txt">
                <b>CFAO Academy</b>
                <span>{t.project_label}</span>
              </div>
            </div>
            <nav className="dlv-nav">
              {NAV.map(grp => (
                <div key={grp.group}>
                  <div className="dlv-nav-group">{t[grp.group]}</div>
                  {grp.items.map(it => (
                    <button key={it.id} type="button"
                      className={`dlv-nav-item ${view === it.id ? 'is-active' : ''}`}
                      onClick={() => setView(it.id)}>
                      <span className="dlv-nav-ico">{it.ico}</span>
                      {t[`nav_${it.id}`]}
                      {navCount[it.id] != null && <span className="dlv-nav-count">{navCount[it.id]}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
            <div className="dlv-aside-foot">
              <Link to="/portail" className="dlv-aside-back">← {t.back_portal}</Link>
            </div>
          </aside>

          {/* ── Main ── */}
          <div className="dlv-main">
            <header className="dlv-topbar">
              <div className="dlv-topbar-l">
                <div className="dlv-eyebrow">{t.page_eyebrow}</div>
                <h1>{t.page_title}</h1>
                <p className="dlv-lead">{t.page_lead}</p>
              </div>
              <div className="dlv-topbar-r">
                <div className="dlv-topbar-actions">
                  <LocaleSwitch
                    locale={locale}
                    onChange={setLocale}
                    ariaLabel={commonT.langSwitchAria}
                    className="locale-switch--dlv"
                  />
                  <Link to="/" className="dlv-topbar-back">{t.back_to_site} →</Link>
                </div>
                <div className="dlv-topbar-chips">
                  {WEEKLY_STATUS_DRAFT && (
                    <span className="dlv-week-chip">{t.week_label} {WEEKLY_STATUS_DRAFT.week}</span>
                  )}
                  <span className={`dlv-role-chip ${editable ? '' : 'ro'}`}>
                    {user.firstName} {user.lastName} · {editable ? 'build' : 'MOA'}
                  </span>
                </div>
              </div>
            </header>

            {!editable && <div className="dlv-readonly">{t.read_only_banner}</div>}

            <div className="dlv-view">
              {booting ? (
                <CockpitSkeleton />
              ) : (
                <>
                  {view === 'overview' && renderOverview()}
                  {view === 'roadmap' && renderRoadmap()}
                  {view === 'phases' && renderPhases()}
                  {view === 'backlog' && renderBacklog()}
                  {view === 'gate' && renderGate()}
                  {view === 'events' && renderEvents()}
                  {view === 'reporting' && renderReporting()}
                  {view === 'git' && renderGit()}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <PortalDemoBar />
    </>
  )

  /* ───────────────────── VUES ───────────────────── */

  function renderOverview() {
    const blocking = PERT_NODES.filter(n => n.blocks === 'yes').length
    return (
      <>
        <div className="dlv-kpis">
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-green)' }}>
            <div className="dlv-kpi-k">{t.kpi_stories_done}</div>
            <div className="dlv-kpi-v">{kpis.pct}<small>%</small></div>
            <div className="dlv-kpi-m">{kpis.done} / {kpis.total} stories</div>
            <Bar pct={kpis.pct} />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-navy)' }}>
            <div className="dlv-kpi-k">{t.kpi_in_progress}</div>
            <div className="dlv-kpi-v">{kpis.inProgress}</div>
            <div className="dlv-kpi-m">{t.kpi_in_progress_meta}</div>
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': gateProgress.pct === 100 ? 'var(--dlv-green)' : 'var(--dlv-red)' }}>
            <div className="dlv-kpi-k">{t.kpi_gate}</div>
            <div className="dlv-kpi-v">{gateProgress.pct}<small>%</small></div>
            <div className="dlv-kpi-m">{gateProgress.done} / {gateProgress.total}</div>
            <Bar pct={gateProgress.pct} tone="red" />
          </div>
          <div className="dlv-kpi" style={{ '--dlv-accent': 'var(--dlv-red)' }}>
            <div className="dlv-kpi-k">{t.kpi_critical_te}</div>
            <div className="dlv-kpi-v">{teTotal}<small> {t.te_unit}</small></div>
            <div className="dlv-kpi-m">{t.kpi_blocking}: {blocking}</div>
          </div>
        </div>

        <div className="dlv-section-title">{t.overview_projects_title}</div>
        <p className="dlv-section-sub">{t.overview_projects_sub}</p>
        <div className="dlv-rows">
          {PERT_NODES.map(n => {
            const prog = computeProgress(storiesForNode(n))
            const state = nodeState(n)
            // Nœud sans stories (infra) : % piloté par le statut du nœud.
            const pct = prog.total ? prog.pct : (state === 'done' ? 100 : state === 'progress' ? 50 : 0)
            const phase = PHASE_BY_KEY[n.phase]
            const crit = PERT_CRITICAL_PATH.includes(n.id)
            return (
              <div key={n.id} className="dlv-proj">
                <span className={`dlv-proj-id ${crit ? 'crit' : ''}`}>{n.id}</span>
                <div className="dlv-proj-main">
                  <div className="dlv-proj-top">
                    <b>{L(n.label)}</b>
                    <span className="dlv-proj-mod">{L(n.module)}</span>
                    <span className="dlv-chip phase">{phase ? L(phase.title) : `Phase ${n.phase}`}</span>
                    <span className="dlv-chip te">{t.node_te} {String(n.te).replace('.', ',')} {t.te_unit}</span>
                    {crit && <span className="dlv-chip node crit">{t.critical_chip}</span>}
                    <span className={`dlv-proj-state ${state}`}>{t[`proj_state_${state}`]}</span>
                  </div>
                  <Bar pct={pct} tone={state === 'done' ? '' : 'navy'} />
                </div>
                <span className="dlv-proj-pct">
                  {pct}<small>%</small>
                  {prog.total > 0 && <em>{prog.done}/{prog.total}</em>}
                </span>
              </div>
            )
          })}
        </div>

        <div className="dlv-section-title">{t.overview_critical_title}</div>
        <p className="dlv-section-sub">{t.overview_critical_intro}</p>
        <div className="dlv-panel">
          <div className="dlv-crit-flow">
            {PERT_CRITICAL_PATH.map((id, i) => {
              const n = NODE_BY_ID[id]
              return (
                <div key={id} style={{ display: 'contents' }}>
                  <div className="dlv-crit-node">
                    <span className="id">{id}</span>
                    <b>{L(n.label)}</b>
                    <span className="te">TE {String(n.te).replace('.', ',')}</span>
                  </div>
                  {i < PERT_CRITICAL_PATH.length - 1 && <span className="dlv-crit-arrow">→</span>}
                </div>
              )
            })}
          </div>
          <p className="dlv-crit-foot">{t.overview_critical_sub.replace('{te}', teTotal)}</p>
        </div>
      </>
    )
  }

  function renderRoadmap() {
    const critical = PERT_NODES.filter(n => n.critical)
    const parallel = PERT_NODES.filter(n => !n.critical)
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.roadmap_title}</h2>
          <p>{t.roadmap_sub}</p>
        </div>
        <div className="dlv-section-title">{t.roadmap_critical_group}</div>
        <div className="dlv-nodes-grid">{critical.map(renderNode)}</div>
        <div className="dlv-section-title">{t.roadmap_parallel_group}</div>
        <div className="dlv-nodes-grid">{parallel.map(renderNode)}</div>
      </>
    )
  }

  function renderNode(n) {
    const deps = n.deps.map(id => ({ id, node: NODE_BY_ID[id], state: nodeState(NODE_BY_ID[id]) }))
    const readyCount = deps.filter(d => d.state === 'done').length
    const readiness = deps.length ? Math.round((readyCount / deps.length) * 100) : 100
    const unblocked = deps.length === 0 || readyCount === deps.length
    const stateIcon = { done: '✓', progress: '●', todo: '' }
    return (
      <div key={n.id} className={`dlv-node ${n.critical ? 'crit' : ''}`}>
        <div className="dlv-node-head">
          <span className="dlv-node-id">{n.id}</span>
          <span>
            <b>{L(n.label)}</b>
            <span className="mod">{L(n.module)}</span>
          </span>
        </div>
        <div className="dlv-node-meta">
          <span className="dlv-chip te">{t.node_te} {String(n.te).replace('.', ',')} {t.te_unit}</span>
          <span className="dlv-chip phase">{t.node_phase} {n.phase}</span>
          <span className={`dlv-chip ${n.critical ? 'node crit' : 'node'}`}>{n.critical ? t.critical_chip : t.parallel_chip}</span>
        </div>
        {n.note && <div className="dlv-node-note">{L(n.note)}</div>}

        <div className="dlv-deps">
          <div className="dlv-deps-head">
            <span>{t.node_deps}</span>
            <span className={`dlv-deps-state ${unblocked ? 'ok' : ''}`}>
              {deps.length === 0
                ? t.deps_ready_start
                : unblocked
                  ? t.deps_unblocked
                  : `${readyCount}/${deps.length} ${t.deps_ready}`}
            </span>
          </div>
          {deps.length > 0 && (
            <div className="dlv-deps-list">
              {deps.map(d => (
                <span key={d.id} className={`dlv-dep ${d.state}`} title={L(d.node?.module)}>
                  <i className="box">{stateIcon[d.state]}</i>
                  {d.id} · {L(d.node?.label)}
                </span>
              ))}
            </div>
          )}
          <div className="dlv-bar"><i className={readiness === 100 ? 'full' : ''} style={{ width: `${readiness}%` }} /></div>
        </div>

        <div className="dlv-node-foot">
          <span><b>{t.node_estimate}</b> {n.omp.o} / {n.omp.m} / {n.omp.p}</span>
          {n.epics?.length > 0 && <span><b>{t.node_epics}</b> {n.epics.join(' · ')}</span>}
          <span>
            <b>{t.blocks_label}</b>{' '}
            <span className={`dlv-blk ${n.blocks}`}>{t[`blocks_${n.blocks}`]}</span>
          </span>
        </div>
      </div>
    )
  }

  function renderPhases() {
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.phases_title}</h2>
          <p>{t.phases_sub}</p>
        </div>
        <div className="dlv-rows">
          {DELIVERY_PHASES.map(ph => {
            const p = computeProgress(storiesForPhase(ph))
            return (
              <div key={ph.key} className="dlv-prow">
                <div className="dlv-prow-top">
                  <b>{L(ph.title)}</b>
                  <span className="dlv-chip">{t.phase_calendar}: {ph.calendar}</span>
                  <span className="dlv-prow-pct">{p.pct}%</span>
                </div>
                <Bar pct={p.pct} tone="navy" />
                <div className="dlv-prow-obj"><b>{t.phase_objective} :</b> {L(ph.objective)}</div>
                <div className="dlv-prow-nodes">
                  {ph.nodes.map(nid => (
                    <span key={nid} className={`dlv-chip node ${PERT_CRITICAL_PATH.includes(nid) ? 'crit' : ''}`}>
                      {nid} · {L(NODE_BY_ID[nid]?.label)}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="dlv-section-title">{t.gantt_title}</div>
        <div className="dlv-panel">
          <div className="dlv-gantt">
            {GANTT_BARS.map(bar => (
              <div key={bar.key} className="dlv-gantt-row">
                <div className="dlv-gantt-lbl">{L(bar.label)}{bar.optional ? ` (${t.gantt_optional})` : ''}</div>
                <div className="dlv-gantt-track">
                  <div className={`dlv-gantt-fill ${bar.critical ? 'crit' : ''} ${bar.optional ? 'optional' : ''}`}
                    style={{ left: `${(bar.start / GANTT_SCALE) * 100}%`, width: `${((bar.end - bar.start) / GANTT_SCALE) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="dlv-gantt-scale">
            <div />
            <div className="dlv-gantt-ticks">
              {[0, 5, 10, 15, 20, 25].map(w => <span key={w}>S{w}</span>)}
            </div>
          </div>
        </div>
      </>
    )
  }

  function renderBacklog() {
    const visibleEpics = DELIVERY_EPICS.filter(e => filteredStories.some(s => s.epic === e.id))
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.backlog_title}</h2>
          <p>{t.backlog_sub}</p>
        </div>
        <div className="dlv-toolbar">
          <input className="dlv-field dlv-field--search" placeholder={t.search_placeholder}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="dlv-field" value={epicFilter} onChange={e => setEpicFilter(e.target.value)}>
            <option value="all">{t.filter_all_epics}</option>
            {DELIVERY_EPICS.map(e => <option key={e.id} value={e.id}>{e.id} — {L(e.title)}</option>)}
          </select>
          <select className="dlv-field" value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
            <option value="all">{t.filter_all_phases}</option>
            {DELIVERY_PHASES.filter(p => p.key !== 'release' && p.key !== '2post').map(p => (
              <option key={p.key} value={p.key}>{L(p.title)}</option>
            ))}
          </select>
          <select className="dlv-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">{t.filter_all_status}</option>
            {['todo', 'in_progress', 'done', 'blocked'].map(st => <option key={st} value={st}>{t[`status_${st}`]}</option>)}
          </select>
        </div>

        {visibleEpics.length === 0 && <div className="dlv-panel dlv-panel-sub">{t.backlog_empty}</div>}

        {visibleEpics.map(epic => {
          const list = filteredStories.filter(s => s.epic === epic.id)
          const prog = computeProgress(storiesByEpic[epic.id] || [])
          return (
            <div key={epic.id} className="dlv-epic">
              <div className="dlv-epic-head">
                <span className="dlv-epic-id">{epic.id}</span>
                <span className="dlv-epic-title">{L(epic.title)}</span>
                <span className={`dlv-chip node ${PERT_CRITICAL_PATH.includes(epic.node) ? 'crit' : ''}`}>
                  {epic.node} · {L(NODE_BY_ID[epic.node]?.label)}
                </span>
                <span className="dlv-chip phase">{t.node_phase} {epic.phase}</span>
                <div className="dlv-epic-prog">
                  <Bar pct={prog.pct} />
                  <small>{prog.done}/{prog.total} · {prog.pct}%</small>
                </div>
              </div>
              {list.map(s => (
                <div key={s.id} className="dlv-story">
                  <span className="dlv-story-id">{s.id}</span>
                  <span className="dlv-story-lbl">{L(s.label)}</span>
                  <TestDots story={s} editable={editable} onTestChange={updateStoryTest} t={t} />
                  {editable ? (
                    <select className="dlv-field dlv-field--xs" value={s.status}
                      onChange={e => updateStoryStatus(s.id, e.target.value)}>
                      {['todo', 'in_progress', 'done', 'blocked'].map(st => (
                        <option key={st} value={st}>{t[`status_${st}`]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`dlv-status ${s.status}`}>{t[`status_${s.status}`]}</span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
        <p className="dlv-hint">{t.test_sequence_hint}</p>
      </>
    )
  }

  function renderGate() {
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.gate_title}</h2>
          <p>{t.gate_sub}</p>
        </div>
        <div className="dlv-gate-grid">
          {gate.map(item => {
            const Tag = editable ? 'button' : 'div'
            return (
              <Tag key={item.id} type={editable ? 'button' : undefined}
                className={`dlv-gate-item ${item.done ? 'done' : ''}`}
                onClick={editable ? () => toggleGateItem(item.id) : undefined}
                title={editable ? t.gate_toggle_hint : undefined}>
                <span className="dlv-gate-check">✓</span>
                <span>
                  <span className="dlv-gate-lbl">{L(item.label)}</span>
                  <span className={`dlv-gate-state ${item.done ? 'done' : 'pending'}`}>
                    {item.done ? t.gate_done : t.gate_pending}
                  </span>
                </span>
              </Tag>
            )
          })}
        </div>

        <div className="dlv-section-title">{t.blocks_matrix_title}</div>
        <table className="dlv-table">
          <thead>
            <tr><th>{t.col_node}</th><th>{t.node_module}</th><th>{t.col_blocks}</th></tr>
          </thead>
          <tbody>
            {PERT_NODES.map(n => (
              <tr key={n.id}>
                <td><b>{n.id}</b> · {L(n.label)}</td>
                <td>{L(n.module)}</td>
                <td>
                  <span className={`dlv-blk ${n.blocks}`}>{t[`blocks_${n.blocks}`]}</span>
                  {n.blockNote && <div className="dlv-panel-sub" style={{ marginTop: 4 }}>{L(n.blockNote)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }

  function renderEvents() {
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.events_title}</h2>
          <p>{t.events_sub}</p>
        </div>
        <table className="dlv-table">
          <thead>
            <tr>
              <th>{t.col_event}</th><th>{t.col_flow}</th><th>{t.col_kind}</th><th>{t.col_effect}</th>
            </tr>
          </thead>
          <tbody>
            {DELIVERY_EVENTS.map(ev => (
              <tr key={ev.event + ev.arrow}>
                <td><code>{ev.event}</code></td>
                <td><span className="dlv-flow">{ev.arrow}</span><div className="dlv-panel-sub">{ev.from} → {ev.to}</div></td>
                <td>{t[`kind_${ev.kind}`]}</td>
                <td>{L(ev.effect)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }

  function renderReporting() {
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.reporting_title}</h2>
        </div>
        <div className="dlv-grid-2">
          <div className="dlv-panel">
            <div className="dlv-panel-k">{t.reporting_schedule}</div>
            <h4>{t.reporting_moa} · {t.day_friday} {DIGEST_SCHEDULE.moaReportTime}</h4>
            <p className="dlv-panel-sub">{t.reporting_reminder} · {t.day_thursday} {DIGEST_SCHEDULE.devReminderTime} ({DIGEST_SCHEDULE.timezone})</p>
          </div>
          <div className="dlv-panel">
            <div className="dlv-panel-k">{t.recipients}</div>
            <ul>
              {DIGEST_RECIPIENTS.map(r => <li key={r.id}><b>{r.name}</b> — {r.email}</li>)}
            </ul>
          </div>
        </div>

        <div className="dlv-section-title">{t.digest_preview}</div>
        {!GIT_CONFIG.connected && awaitingGit()}
        <div className="dlv-panel" hidden={!GIT_CONFIG.connected}>
          <div className="dlv-moa">{t.digest_preview_w22}</div>
          {editable && (
            <div className="dlv-actions">
              <button type="button" className="dlv-btn" onClick={() => setDigestApproved(true)}>{t.digest_validate}</button>
              <button type="button" className="dlv-btn primary">{t.digest_send} →</button>
            </div>
          )}
          {digestApproved && <p className="dlv-ok">{t.digest_validated}</p>}
        </div>

        <div className="dlv-section-title">{t.digest_history}</div>
        {DIGEST_HISTORY.length === 0 && awaitingGit()}
        <div className="dlv-grid-3">
          {DIGEST_HISTORY.map(d => (
            <div key={d.id} className="dlv-panel">
              <div className="dlv-panel-k">{d.week}</div>
              <h4>{d.sentAt}</h4>
              <p className="dlv-pill-status">
                <span className={`dlv-dot ${d.status === 'sent' ? 'green' : 'red'}`} />
                {d.status === 'sent' ? t.digest_status_sent : t.digest_status_draft}
              </p>
            </div>
          ))}
        </div>
      </>
    )
  }

  /** Bandeau d'attente — utilisé partout où la donnée vient du webhook Git. */
  function awaitingGit() {
    return (
      <div className="dlv-panel dlv-awaiting">
        <div className="dlv-panel-k">{t.awaiting_git_title}</div>
        <p className="dlv-panel-sub">{t.awaiting_git_body}</p>
      </div>
    )
  }

  function renderGit() {
    // Le voyant rouge gouverne le bloc : tant que le dépôt n'est pas connecté,
    // on n'affiche AUCUN statut hebdo plutôt qu'un statut périmé présenté comme
    // « en cours ». Un cockpit n'invente pas un contenu qu'il n'a pas.
    const connected = GIT_CONFIG.connected
    const blocks = connected
      ? [
          { key: 'weekly_avancements', lines: WEEKLY_STATUS_DRAFT.avancements },
          { key: 'weekly_objectifs', lines: WEEKLY_STATUS_DRAFT.objectifsEnCours },
          { key: 'weekly_next', lines: WEEKLY_STATUS_DRAFT.objectifsSemaineProchaine },
          { key: 'weekly_goulots', lines: WEEKLY_STATUS_DRAFT.goulots },
        ]
      : []
    return (
      <>
        <div className="dlv-view-head">
          <h2>{t.git_title}</h2>
        </div>
        <div className="dlv-panel">
          <div className="dlv-panel-k">{t.git_config}</div>
          <h4>{GIT_CONFIG.repoUrl.replace('https://github.com/', '')}</h4>
          <p className="dlv-pill-status">
            <span className={`dlv-dot ${GIT_CONFIG.connected ? 'green' : 'red'}`} />
            {t.git_webhook} · {GIT_CONFIG.connected ? t.git_connected : t.git_disconnected}
          </p>
          {editable && <div className="dlv-actions"><button type="button" className="dlv-btn">{t.git_connect}</button></div>}
        </div>

        <div className="dlv-section-title">
          {t.weekly_status}{connected && WEEKLY_STATUS_DRAFT ? ` · ${WEEKLY_STATUS_DRAFT.week}` : ''}
        </div>
        {connected ? (
          <div className="dlv-grid-2">
            {blocks.map(b => (
              <div key={b.key} className="dlv-panel">
                <div className="dlv-panel-k">{t[b.key]}</div>
                <ul>{b.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
              </div>
            ))}
          </div>
        ) : (
          awaitingGit()
        )}

        <div className="dlv-section-title">{t.commits_week}</div>
        {!connected && awaitingGit()}
        <div className="dlv-grid-2">
          {RECENT_COMMITS.map(c => (
            <div key={c.id} className="dlv-commit">
              <div className="dlv-commit-top">
                <span className="dlv-commit-sha">{c.sha}</span>
                <span>{c.author}</span>
                <span>· {c.date}</span>
              </div>
              <h4>{c.subject}</h4>
              <p>{c.avancement}</p>
            </div>
          ))}
        </div>
        <p className="dlv-hint">{t.contributing_hint}</p>
      </>
    )
  }
}
