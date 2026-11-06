/**
 * « Saisie » : les constantes communes de l'année, saisies (pas calculées).
 * Budget, taux horaire d'une formation, heures par session, hébergements.
 * Le taux saisi s'affiche à côté du coût horaire calculé ; il n'entre pas dans la part.
 */
import { useEffect, useMemo, useState } from 'react'
import { planningApi } from '../../../lib/planningApi'
import { Banner, errText } from './costKeyViews'

const FIELDS = [
  ['budget', 'f_budget'],
  ['hourly_rate', 'f_hourly_rate'],
  ['hours_per_session', 'f_hours'],
  ['trainee_lodging_cost', 'f_trainee'],
  ['trainer_lodging_cost', 'f_trainer'],
]
const toNum = v => (v === '' || v == null ? null : Number(v))

export default function SettingsView({ t, fmt, ckey, onSaved }) {
  const frozen = ckey.status === 'FROZEN'
  const initial = useMemo(
    () => Object.fromEntries(FIELDS.map(([k]) => [k, ckey[k] ?? ''])), [ckey])
  const [form, setForm] = useState(initial)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [computed, setComputed] = useState(null)
  useEffect(() => { setForm(initial); setMsg(null) }, [initial])

  useEffect(() => {
    let alive = true
    planningApi.global(ckey.id, 'PLANNED')
      .then(g => alive && setComputed(g.hourly_cost ?? null))
      .catch(() => alive && setComputed(null))
    return () => { alive = false }
  }, [ckey.id, ckey.budget, ckey.hours_per_session])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = async e => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, toNum(v)]))
      if (body.budget == null) delete body.budget  // le budget ne s'efface pas
      onSaved(await planningApi.updateKey(ckey.id, body))
      setMsg({ tone: 'ok', text: t.saved })
    } catch (err) {
      setMsg({ tone: 'warn', text: errText(t, err) })
    } finally { setBusy(false) }
  }

  const rate = toNum(form.hourly_rate)
  const gap = rate != null && computed != null ? rate - computed : null
  return (
    <section className="ck-view">
      <p className="ck-lead">{t.settings_lead}</p>
      <form className="ck-form" onSubmit={submit}>
        {frozen && <Banner tone="info">{t.locked}</Banner>}
        {FIELDS.map(([k, label]) => (
          <label className="ck-field" key={k}><span>{t[label]}</span>
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
      <dl className="ck-kpis ck-kpis--small">
        <div className="ck-kpi"><dt>{t.computed_hour}</dt>
          <dd>{computed == null ? '—' : fmt(computed, 'money')}</dd></div>
        <div className="ck-kpi"><dt>{t.hour_gap}</dt>
          <dd>{gap == null ? '—' : fmt(gap, 'money')}</dd></div>
      </dl>
    </section>
  )
}
