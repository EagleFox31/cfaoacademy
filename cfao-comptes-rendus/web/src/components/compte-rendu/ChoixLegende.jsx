import { modesLegendePour } from '../../data/dispositions_photos'

/**
 * Le choix des legendes, sous celui de la disposition : sans legende,
 * une sous chaque photo, ou une pour l'ensemble. Toute disposition les
 * accepte toutes ; pour une seule photo, « avec » ou « sans ».
 */
export default function ChoixLegende({ nombre, mode, onMode }) {
  if (!nombre || !onMode) return null
  return (
    <>
      <span className="cr-field-label">Légendes</span>
      <div className="cr-legende-modes" role="radiogroup" aria-label="Légendes des photos">
        {modesLegendePour(nombre).map(m => (
          <button key={m.id} type="button" role="radio"
            className={`cr-legende-mode${mode === m.id ? ' cr-legende-mode--on' : ''}`}
            aria-checked={mode === m.id}
            title={m.note}
            onClick={() => onMode(m.id)}>
            <VignetteLegende mode={m.id} />
            {m.nom}
          </button>
        ))}
      </div>
    </>
  )
}

/** Le mode en miniature : deux photos, et ou vont leurs legendes. */
function VignetteLegende({ mode }) {
  return (
    <svg viewBox="0 0 24 18" width="22" height="16" aria-hidden="true" className="cr-legende-vue">
      <rect x="1" y="1" width="10" height={mode === 'aucune' ? 16 : mode === 'chaque' ? 11 : 12}
        rx="1" fill="currentColor" opacity=".35" />
      <rect x="13" y="1" width="10" height={mode === 'aucune' ? 16 : mode === 'chaque' ? 11 : 12}
        rx="1" fill="currentColor" opacity=".35" />
      {mode === 'chaque' && <>
        <rect x="2" y="14" width="8" height="2" rx="1" fill="currentColor" />
        <rect x="14" y="14" width="8" height="2" rx="1" fill="currentColor" />
      </>}
      {mode === 'commune' && <rect x="4" y="15" width="16" height="2" rx="1" fill="currentColor" />}
    </svg>
  )
}
