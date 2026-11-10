/**
 * « Gestion des tarifs » : les réglages communs de l'année.
 * La clé se calcule au tarif horaire (le budget en découle) ou au budget fixe
 * (réparti au prorata des places) : les deux sont exclusifs côté calcul,
 * l'écran ne montre donc que le montant qui compte, avec son effet en direct.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { planningApi } from '../../../lib/planningApi'
import { Banner, errText } from './costKeyViews'

const FIELDS = ['budget', 'hourly_rate', 'hours_per_session', 'seats_offered', 'trainee_lodging_cost', 'trainer_lodging_cost']
const SAVED_MS = 3000

const toNum = v => (v === '' || v == null ? null : Number(v))
const toField = v => (v == null || v === '' ? '' : String(Math.round(Number(v))))
const digits = s => s.replace(/\D/g, '')
const group = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Saisie d'un entier, groupé par milliers, sans que le curseur saute en fin de champ. */
function NumberField({ label, hint, unit, value, onChange, disabled }) {
  const input = useRef(null)
  const caret = useRef(null)
  useLayoutEffect(() => {
    if (caret.current == null || !input.current) return
    const text = input.current.value
    let at = 0
    for (let seen = 0; at < text.length && seen < caret.current; at += 1) {
      if (/\d/.test(text[at])) seen += 1
    }
    input.current.setSelectionRange(at, at)
    caret.current = null
  })
  const change = e => {
    caret.current = digits(e.target.value.slice(0, e.target.selectionStart)).length
    onChange(digits(e.target.value))
  }
  return (
    <label className="ck-field ck-set-field">
      <span>{label}</span>
      <span className="ck-set-input">
        <input ref={input} type="text" inputMode="numeric" autoComplete="off"
          value={group(value)} onChange={change} disabled={disabled} />
        <em>{unit}</em>
      </span>
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Amount({ value, unit }) {
  if (value == null) return '—'
  return <>{group(Math.round(value))} <span className="ck-set-unit">{unit}</span></>
}

function Method({ value, current, title, hint, onPick, disabled }) {
  return (
    <label className={`ck-set-method${current === value ? ' is-on' : ''}`}>
      <input type="radio" name="ck-method" value={value} checked={current === value}
        onChange={() => onPick(value)} disabled={disabled} />
      <span className="ck-set-method-text"><b>{title}</b><small>{hint}</small></span>
    </label>
  )
}

export default function SettingsView({ t, ckey, onSaved }) {
  const frozen = ckey.status === 'FROZEN'
  const initial = useMemo(() => Object.fromEntries(FIELDS.map(k => [k, toField(ckey[k])])), [ckey])
  const initialMethod = ckey.hourly_rate == null ? 'budget' : 'rate'
  const [form, setForm] = useState(initial)
  const [method, setMethod] = useState(initialMethod)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState({ status: 'loading', seats: null })

  useEffect(() => { setForm(initial); setMethod(initialMethod) }, [initial, initialMethod])
  useEffect(() => { setError(null); setSaved(false) }, [ckey.id])
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_MS)
    return () => clearTimeout(timer)
  }, [saved])

  useEffect(() => {
    let alive = true
    setPlan({ status: 'loading', seats: null })
    planningApi.global(ckey.id, 'PLANNED')
      .then(g => alive && setPlan({ status: 'ready', seats: g.total_seats ?? 0 }))
      .catch(() => alive && setPlan({ status: 'failed', seats: null }))
    return () => { alive = false }
  }, [ckey.id])

  const byRate = method === 'rate'
  const set = k => v => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }
  const dirty = method !== initialMethod || FIELDS.some(k => form[k] !== initial[k])
  const missingAmount = byRate ? !toNum(form.hourly_rate) : !toNum(form.budget)
  const missing = missingAmount || !toNum(form.hours_per_session)
  const missingText = missingAmount ? (byRate ? t.set_required_rate : t.set_required_budget) : t.set_required_hours

  const reset = () => { setForm(initial); setMethod(initialMethod); setError(null) }
  const submit = async e => {
    e.preventDefault()
    if (missing || !dirty) return
    setBusy(true); setError(null)
    try {
      // Le budget ne s'efface pas, une accommodation vide vaut 0, seul le tarif peut redevenir nul.
      const body = {
        hours_per_session: toNum(form.hours_per_session),
        trainee_lodging_cost: toNum(form.trainee_lodging_cost) ?? 0,
        trainer_lodging_cost: toNum(form.trainer_lodging_cost) ?? 0,
        hourly_rate: byRate ? toNum(form.hourly_rate) : null,
        seats_offered: toNum(form.seats_offered),
      }
      if (toNum(form.budget) != null) body.budget = toNum(form.budget)
      onSaved(await planningApi.updateKey(ckey.id, body))
      setSaved(true)
    } catch (err) {
      setError(errText(t, err))
    } finally { setBusy(false) }
  }

  const rate = toNum(form.hourly_rate)
  const hours = toNum(form.hours_per_session)
  const budget = toNum(form.budget)
  const seats = plan.seats || null
  const price = rate && hours ? rate * hours : null
  const placeValue = byRate ? price : (budget && seats ? budget / seats : null)
  const secondValue = byRate
    ? (price != null && seats ? price * seats : null)
    : (budget && seats && hours ? budget / (seats * hours) : null)
  const waiting = plan.status === 'loading'
  const ready = plan.status === 'ready'
  const offered = toNum(form.seats_offered)
  const over = ready && offered != null ? plan.seats - offered : 0
  const unassigned = ready && offered != null ? Math.max(-over, 0) : null
  const fullBudget = byRate && price != null && offered ? price * offered : null
  const note = plan.status === 'failed' ? t.set_recap_off
    : over > 0 ? t.set_over.replace('{n}', group(over))
      : ready && !plan.seats ? t.set_no_seats : null
  const pick = v => { setMethod(v); setSaved(false) }

  return (
    <section className="ck-view ck-view--center">
      <p className="ck-lead">{t.settings_lead}</p>
      {frozen && <Banner tone="info">{t.locked}</Banner>}
      <form className="ck-form ck-set" onSubmit={submit}>
        <div className="ck-set-main">
          <fieldset className="ck-set-card" disabled={frozen}>
            <legend>{t.set_method}</legend>
            <div className="ck-set-methods">
              <Method value="rate" current={method} title={t.set_by_rate} hint={t.set_by_rate_hint} onPick={pick} disabled={frozen} />
              <Method value="budget" current={method} title={t.set_by_budget} hint={t.set_by_budget_hint} onPick={pick} disabled={frozen} />
            </div>
            <div className="ck-set-fields">
              <div className="ck-set-swap" key={method}>
                {byRate
                  ? <NumberField label={t.f_hourly_rate} unit={t.unit_fcfa} value={form.hourly_rate} onChange={set('hourly_rate')} disabled={frozen} />
                  : <NumberField label={t.set_budget} unit={t.unit_fcfa} value={form.budget} onChange={set('budget')} disabled={frozen} />}
              </div>
              <NumberField label={t.f_hours} unit={t.unit_hours} value={form.hours_per_session} onChange={set('hours_per_session')} disabled={frozen} />
            </div>
          </fieldset>

          <fieldset className="ck-set-card" disabled={frozen}>
            <legend>{t.set_places}</legend>
            <div className="ck-set-fields">
              <NumberField label={t.f_seats_offered} unit={t.unit_seats} value={form.seats_offered} onChange={set('seats_offered')} disabled={frozen} />
              <p className="ck-set-aside">{t.f_seats_offered_hint}</p>
            </div>
          </fieldset>

          <fieldset className="ck-set-card" disabled={frozen}>
            <legend>{t.set_lodging}</legend>
            <div className="ck-set-fields">
              <NumberField label={t.f_trainee} hint={t.f_trainee_hint} unit={t.unit_fcfa} value={form.trainee_lodging_cost} onChange={set('trainee_lodging_cost')} disabled={frozen} />
              <NumberField label={t.f_trainer} hint={t.f_trainer_hint} unit={t.unit_fcfa} value={form.trainer_lodging_cost} onChange={set('trainer_lodging_cost')} disabled={frozen} />
            </div>
          </fieldset>

          {error && <Banner tone="warn">{error}</Banner>}

          {!frozen && dirty && (
            <div className="ck-set-bar">
              <span>{missing ? missingText : t.set_dirty}</span>
              <div className="ck-form-actions">
                <button type="button" className="ck-btn" onClick={reset} disabled={busy}>{t.set_cancel}</button>
                <button type="submit" className="ck-btn ck-btn--primary" disabled={busy || missing}>{t.save}</button>
              </div>
            </div>
          )}
          {!dirty && saved && <p className="ck-set-saved" role="status">{t.saved}</p>}
        </div>

        <aside className="ck-set-recap">
          <p className="ck-set-recap-title">{t.set_recap}{dirty && <small>{t.set_recap_draft}</small>}</p>
          <p className="ck-set-recap-label">{byRate ? t.set_place_price : t.set_place_avg}</p>
          <p className="ck-set-recap-value">
            {!byRate && waiting ? <i className="ck-set-skel" /> : <Amount value={placeValue} unit={t.unit_fcfa} />}
          </p>
          <p className="ck-set-recap-sub">
            {byRate
              ? (price != null ? `${group(rate)} ${t.unit_fcfa} × ${group(hours)} ${t.unit_hours}` : ' ')
              : t.set_place_avg_sub}
          </p>
          <dl>
            <div><dt>{t.set_seats}</dt><dd>{offered == null ? '—' : group(offered)}</dd></div>
            <div><dt>{t.set_assigned}</dt><dd>{waiting ? <i className="ck-set-skel" /> : (seats == null ? '—' : group(seats))}</dd></div>
            <div><dt>{t.set_unassigned}</dt><dd>{waiting ? <i className="ck-set-skel" /> : (unassigned == null ? '—' : group(unassigned))}</dd></div>
            <div><dt>{byRate ? t.set_budget_out : t.computed_hour}</dt>
              <dd>{waiting ? <i className="ck-set-skel" /> : <Amount value={secondValue} unit={t.unit_fcfa} />}</dd></div>
            {fullBudget != null && <div><dt>{t.set_budget_full}</dt><dd><Amount value={fullBudget} unit={t.unit_fcfa} /></dd></div>}
          </dl>
          {note && <p className="ck-set-recap-note">{note}</p>}
        </aside>
      </form>
    </section>
  )
}
