/**
 * « Préparer » : 3 étapes numérotées, dans l'ordre du métier.
 *   1. Régler la clé (ou la créer s'il n'y en a pas)
 *   2. Importer un fichier : Vérifier (aperçu, rien n'est écrit) puis Enregistrer
 *   3. Geler (coordonnateur / directeur du centre seulement)
 * Seules les étapes autorisées par /access sont affichées.
 */
import { useEffect, useMemo, useState } from 'react'
import DataSheet from '../../../components/sheet/DataSheet'
import { planningApi } from '../../../lib/planningApi'
import { Banner, errText } from './costKeyViews'

const KINDS = ['sessions', 'calendar_grid', 'seat_allocations']
const HAS_TEMPLATE = { sessions: true, calendar_grid: false, seat_allocations: true }
const POLES = ['MOTORS', 'EQUIPMENT']

function Step({ n, title, lead, children }) {
  return (
    <section className="ck-step" aria-labelledby={`ck-step-${n}`}>
      <header className="ck-step-head">
        <span className="ck-step-num" aria-hidden="true">{n}</span>
        <div>
          <h2 id={`ck-step-${n}`}>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </header>
      <div className="ck-step-body">{children}</div>
    </section>
  )
}

const toNum = v => (v === '' || v == null ? null : Number(v))

/* ── 1a. Créer une clé ── */
function CreateKey({ t, onCreated }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [pole, setPole] = useState('MOTORS')
  const [budget, setBudget] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const body = { year: Number(year), pole }
      if (budget !== '') body.budget = Number(budget)
      const key = await planningApi.bootstrap(body)
      onCreated(key)
    } catch (err) {
      setMsg({ tone: 'warn', text: errText(t, err) })
    } finally { setBusy(false) }
  }
  return (
    <form className="ck-form" onSubmit={submit}>
      <p className="ck-lead">{t.create_lead}</p>
      <label className="ck-field"><span>{t.year}</span>
        <input type="number" min="2020" max="2100" value={year} onChange={e => setYear(e.target.value)} required />
      </label>
      <label className="ck-field"><span>{t.pole}</span>
        <select value={pole} onChange={e => setPole(e.target.value)}>
          {POLES.map(p => <option key={p} value={p}>{t[`pole_${p}`]}</option>)}
        </select>
      </label>
      <label className="ck-field"><span>{t.f_budget}</span>
        <input type="number" min="0" step="1" value={budget} onChange={e => setBudget(e.target.value)} />
      </label>
      <div className="ck-form-actions">
        <button type="submit" className="ck-btn ck-btn--primary" disabled={busy}>{t.create}</button>
      </div>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
    </form>
  )
}

/* ── 1b. Régler la clé ── */
function KeySettings({ t, ckey, onSaved }) {
  const frozen = ckey.status === 'FROZEN'
  const initial = useMemo(() => ({
    budget: ckey.budget ?? '',
    trainee_lodging_cost: ckey.trainee_lodging_cost ?? '',
    trainer_lodging_cost: ckey.trainer_lodging_cost ?? '',
    hours_per_session: ckey.hours_per_session ?? '',
  }), [ckey])
  const [form, setForm] = useState(initial)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setForm(initial); setMsg(null) }, [initial])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = async e => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, toNum(v)]))
      onSaved(await planningApi.updateKey(ckey.id, body))
      setMsg({ tone: 'ok', text: t.saved })
    } catch (err) {
      setMsg({ tone: 'warn', text: errText(t, err) })
    } finally { setBusy(false) }
  }
  const fields = [
    ['budget', t.f_budget], ['trainee_lodging_cost', t.f_trainee],
    ['trainer_lodging_cost', t.f_trainer], ['hours_per_session', t.f_hours],
  ]
  return (
    <form className="ck-form" onSubmit={submit}>
      {frozen && <Banner tone="info">{t.locked}</Banner>}
      {fields.map(([k, label]) => (
        <label className="ck-field" key={k}><span>{label}</span>
          <input type="number" min="0" step="1" value={form[k]} onChange={set(k)} disabled={frozen} />
        </label>
      ))}
      {!frozen && (
        <div className="ck-form-actions">
          <button type="submit" className="ck-btn ck-btn--primary" disabled={busy}>{t.save}</button>
        </div>
      )}
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
    </form>
  )
}

/* ── 2. Importer ── */
function ImportStep({ t, fmt, ckey, onApplied }) {
  const [kind, setKind] = useState('sessions')
  const [file, setFile] = useState(null)
  const [year, setYear] = useState(ckey?.year ?? new Date().getFullYear())
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(null)
  const [report, setReport] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [inputKey, setInputKey] = useState(0)

  const loadHistory = () => planningApi.imports().then(setHistory).catch(() => setHistory([]))
  useEffect(() => { loadHistory() }, [])

  const reset = () => { setReport(null); setOutcome(null); setError(null) }
  const params = () => {
    if (kind === 'calendar_grid') return { year }
    if (kind === 'seat_allocations') return replace ? { replace: 'true' } : {}
    return {}
  }

  const run = async which => {
    if (!file) { setError(t.err_FILE_REQUIRED); return }
    setBusy(which); setError(null); setOutcome(null)
    try {
      if (which === 'check') {
        setReport(await planningApi.preview(kind, file, params()))
      } else {
        const log = await planningApi.apply(kind, file, params())
        setReport(log.report ?? null)
        setOutcome({ tone: 'ok', text: `${t.r_applied} ${t.r_written} : ${fmt(log.rows_written, 'int')}` })
        setFile(null); setInputKey(k => k + 1)
        loadHistory(); onApplied()
      }
    } catch (err) {
      // 422 : le journal complet (avec les erreurs ligne par ligne) est dans payload
      if (err?.payload?.report) setReport(err.payload.report)
      else if (err?.payload?.errors) setReport(err.payload)
      setError(errText(t, err))
    } finally { setBusy(null) }
  }

  const errCols = useMemo(() => [
    { id: 'sheet', header: t.col_sheet, type: 'text', width: 110, value: e => e.sheet ?? '' },
    { id: 'row', header: t.col_row, type: 'int', width: 70, value: e => e.row },
    { id: 'column', header: t.col_column, type: 'text', width: 150, value: e => e.column },
    { id: 'value', header: t.col_value, type: 'text', width: 150, value: e => (e.value == null ? '' : String(e.value)) },
    { id: 'message', header: t.col_message, type: 'text', width: 380, value: e => e.message },
  ], [t])

  const histCols = useMemo(() => [
    { id: 'date', header: t.col_date, type: 'text', width: 150,
      value: h => (h.created_at ? new Date(h.created_at).toLocaleString() : '') },
    { id: 'kind', header: t.col_kind, type: 'text', width: 150, value: h => t[`kind_${h.kind}`] || h.kind },
    { id: 'status', header: t.col_status, type: 'text', width: 120,
      value: h => t[`st_${h.status}`] || h.status,
      render: (v, h) => <span className={`portal-status-chip ${h.status === 'APPLIED' ? 'done' : 'progress'}`}>{v}</span> },
    { id: 'written', header: t.col_written, type: 'int', value: h => h.rows_written },
    { id: 'rejected', header: t.col_rejected, type: 'int', value: h => h.rows_rejected ?? h.report?.rows_rejected },
    { id: 'by', header: t.col_by, type: 'text', width: 160, value: h => h.actor },
  ], [t])

  const ok = report?.status === 'OK'
  return (
    <div className="ck-import">
      <div className="ck-kinds" role="radiogroup" aria-label={t.col_kind}>
        {KINDS.map(k => (
          <button key={k} type="button" role="radio" aria-checked={kind === k}
            className={`ck-kind${kind === k ? ' is-on' : ''}`}
            onClick={() => { setKind(k); reset() }}>
            <strong>{t[`kind_${k}`]}</strong>
            <span>{t[`kind_${k}_hint`]}</span>
          </button>
        ))}
      </div>

      <div className="ck-form ck-form--row">
        {HAS_TEMPLATE[kind]
          ? <button type="button" className="ck-btn" onClick={() => planningApi.downloadTemplate(kind).catch(e => setError(errText(t, e)))}>
              {t.template}
            </button>
          : <span className="ck-muted">{t.no_template}</span>}
        <label className="ck-field"><span>{t.file}</span>
          <input key={inputKey} type="file" accept=".xlsx"
            onChange={e => { setFile(e.target.files?.[0] ?? null); reset() }} />
        </label>
        {kind === 'calendar_grid' && (
          <label className="ck-field"><span>{t.year}</span>
            <input type="number" min="2020" max="2100" value={year}
              onChange={e => { setYear(e.target.value); reset() }} />
          </label>
        )}
        {kind === 'seat_allocations' && (
          <label className="ck-check">
            <input type="checkbox" checked={replace} onChange={e => { setReplace(e.target.checked); reset() }} />
            <span>{t.replace}</span>
          </label>
        )}
        <div className="ck-form-actions">
          <button type="button" className="ck-btn" disabled={!!busy} onClick={() => run('check')}>
            {busy === 'check' ? t.checking : t.check}
          </button>
          <button type="button" className="ck-btn ck-btn--primary" disabled={!!busy || !ok}
            title={ok ? undefined : t.check_first} onClick={() => run('apply')}>
            {busy === 'apply' ? t.applying : t.apply}
          </button>
        </div>
      </div>

      {error && <Banner tone="warn">{error}</Banner>}
      {outcome && <Banner tone={outcome.tone}>{outcome.text}</Banner>}
      {report && !outcome && <Banner tone={ok ? 'ok' : 'warn'}>{ok ? t.r_ok : t.r_ko}</Banner>}
      {report && (
        <dl className="ck-kpis ck-kpis--small">
          <div className="ck-kpi"><dt>{t.r_read}</dt><dd>{fmt(report.rows_read, 'int')}</dd></div>
          <div className="ck-kpi"><dt>{t.r_valid}</dt><dd>{fmt(report.rows_valid, 'int')}</dd></div>
          <div className="ck-kpi"><dt>{t.r_rejected}</dt><dd>{fmt(report.rows_rejected, 'int')}</dd></div>
        </dl>
      )}
      {report?.errors?.length > 0 && (
        <DataSheet id="ck-import-errors" columns={errCols} rows={report.errors} frozen={2}
          exportName={`erreurs-${kind}`} />
      )}

      <h3 className="ck-subtitle">{t.history}</h3>
      <DataSheet id="ck-import-history" columns={histCols} rows={history} rowKey={h => h.id}
        exportName="imports" emptyText={t.empty} />
    </div>
  )
}

/* ── 3. Geler ── */
function FreezeStep({ t, ckey, canFreeze, onFrozen }) {
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  if (ckey.status === 'FROZEN') {
    const date = ckey.frozen_at ? new Date(ckey.frozen_at).toLocaleDateString() : ''
    return <Banner tone="info">{t.already_frozen.replace('{date}', date).replace('{by}', ckey.frozen_by || '')}</Banner>
  }
  if (!canFreeze) return <p className="ck-muted">{t.freeze_only_pilot}</p>
  const click = async () => {
    if (!window.confirm(t.freeze_confirm.replace('{year}', ckey.year))) return
    setBusy(true); setMsg(null)
    try {
      onFrozen(await planningApi.freeze(ckey.id))
      setMsg({ tone: 'ok', text: t.freeze_done })
    } catch (err) {
      setMsg({ tone: 'warn', text: errText(t, err) })
    } finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" className="ck-btn ck-btn--danger" onClick={click} disabled={busy}>{t.freeze}</button>
      {msg && <Banner tone={msg.tone}>{msg.text}</Banner>}
    </>
  )
}

export default function PrepareView({ t, fmt, access, ckey, onKeyChange, onDataChanged }) {
  return (
    <div className="ck-view ck-steps">
      {access.manage && (
        <Step n={1} title={ckey ? t.step1 : t.create_title} lead={ckey ? t.step1_lead : null}>
          {ckey
            ? <KeySettings t={t} ckey={ckey} onSaved={onKeyChange} />
            : <CreateKey t={t} onCreated={onKeyChange} />}
        </Step>
      )}
      {access.import && (
        <Step n={access.manage ? 2 : 1} title={t.step2} lead={t.step2_lead}>
          <ImportStep t={t} fmt={fmt} ckey={ckey} onApplied={onDataChanged} />
        </Step>
      )}
      {ckey && (access.freeze || access.manage) && (
        <Step n={[access.manage, access.import].filter(Boolean).length + 1} title={t.step3} lead={t.step3_lead}>
          <FreezeStep t={t} ckey={ckey} canFreeze={access.freeze} onFrozen={onKeyChange} />
        </Step>
      )}
    </div>
  )
}
