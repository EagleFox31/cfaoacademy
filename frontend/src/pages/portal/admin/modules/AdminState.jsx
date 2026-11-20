/**
 * Message d'état d'une ressource (chargement, accès refusé, hors ligne,
 * erreur, vide). Rien d'inventé : sans donnée, on le dit.
 */
export default function AdminState({ status, t, empty = false }) {
  const key = empty && status === 'ready' ? 'state_empty' : `state_${status}`
  if (status === 'ready' && !empty) return null
  return (
    <div className="dlv-panel dlv-awaiting" role={status === 'loading' ? 'status' : undefined}>
      <p className="dlv-panel-sub">{t[key]}</p>
    </div>
  )
}

/** Bouton d'action pas encore branché : visible, désactivé, avec la mention « En construction ». */
export function PendingAction({ label, t }) {
  return (
    <span className="adm-tags">
      <button type="button" className="dlv-btn" disabled title={t.under_construction}>{label}</button>
      <span className="dlv-chip">{t.under_construction}</span>
    </span>
  )
}
