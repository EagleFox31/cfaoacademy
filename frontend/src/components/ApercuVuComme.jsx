import { useMemo, useState } from 'react'
import { comptesApercu, ouvrirApercu } from '../utils/apercuPortail.js'

/**
 * « Vu comme » : le super admin choisit un compte réel et ouvre son portail en
 * lecture seule. La liste vient de core (comptes qu'il a le droit de voir),
 * chargée une fois par le portail qui l'affiche (`data`, `status`) ; c'est
 * core qui décide ensuite de l'aperçu, ici on ne fait que désigner.
 */
export default function ApercuVuComme({ t, data, status }) {
  const comptes = useMemo(() => comptesApercu(data), [data])
  const [choix, setChoix] = useState('')

  if (status === 'offline' || status === 'loading') return null
  if (status !== 'ready') return <p className="portal-apercu-vu-comme-note">{t.sa_vu_comme_indispo}</p>
  if (!comptes.length) return <p className="portal-apercu-vu-comme-note">{t.sa_vu_comme_vide}</p>

  const compte = comptes.find(c => c.id === choix)
  return (
    <form
      className="portal-apercu-vu-comme"
      onSubmit={e => {
        e.preventDefault()
        if (compte) ouvrirApercu(compte.role, window, compte.id, compte.nom)
      }}
    >
      <label htmlFor="apercu-vu-comme">{t.sa_vu_comme_label}</label>
      <select id="apercu-vu-comme" className="dlv-field" value={choix} onChange={e => setChoix(e.target.value)}>
        <option value="">{t.sa_vu_comme_choisir}</option>
        {comptes.map(c => (
          <option key={c.id} value={c.id}>{c.nom} · {t[`role_${c.role}`] ?? c.role}</option>
        ))}
      </select>
      <button type="submit" className="portal-btn portal-btn-primary" disabled={!compte}>
        {t.sa_vu_comme_cta}
      </button>
    </form>
  )
}
