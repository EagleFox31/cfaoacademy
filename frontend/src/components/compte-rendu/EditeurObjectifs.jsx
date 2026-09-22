import { dispositionsPour } from '../../data/mock_sessions_formateur'

/**
 * L'editeur des objectifs de la formation.
 *
 * Le modele propose trois rendus pour cette page, et la specification
 * les fait dependre du contenu plutot que d'un reglage : un bloc part
 * en tableau des qu'un code ou un intitule est renseigne, en liste
 * sinon ; la colonne d'images apparait des qu'il y a des photos.
 *
 * On applique cette regle telle quelle, en la montrant. Le formateur
 * voit le rendu deduit et peut le forcer, mais n'a rien a regler pour
 * obtenir le rendu attendu.
 *
 * Le marquage, lui, ne se deduit de rien — romain, puces ou les deux —
 * et reste donc un choix, pose en apercu plutot qu'en liste deroulante :
 * on reconnait une numerotation romaine plus vite qu'on ne lit son nom.
 */

/** Les trois marquages de liste retenus par le modele. */
export const MARQUAGES = [
  { id: 'puces', nom: 'Puces', apercu: ['•', '•', '•'] },
  { id: 'romain', nom: 'Romain', apercu: ['I.', 'II.', 'III.'] },
  { id: 'mixte', nom: 'Les deux', apercu: ['I.', '•', '•'] },
]

/** Une ligne vierge, pour demarrer ou prolonger la saisie. */
export const LIGNE_VIDE = { code: '', intitule: '', texte: '' }

/** Le rendu deduit du contenu, selon la specification du modele. */
export function rendrDeduit(objectifs, photos) {
  const tableau = (objectifs || []).some(
    o => (o.code || '').trim() || (o.intitule || '').trim())
  return {
    forme: tableau ? 'tableau' : 'liste',
    avecImages: (photos || []).length > 0,
  }
}

export default function EditeurObjectifs({
  objectifs, marquage, forme, photos, disposition,
  onObjectifs, onMarquage, onForme, onDisposition,
}) {
  const lignes = objectifs?.length ? objectifs : [LIGNE_VIDE]
  const cliches = photos || []
  const deduit = rendrDeduit(lignes, cliches)
  const formeActive = forme || deduit.forme
  const forcee = Boolean(forme) && forme !== deduit.forme

  function majLigne(i, champ, valeur) {
    const suite = lignes.map((o, j) => (j === i ? { ...o, [champ]: valeur } : o))
    // Garder une ligne libre en fin de liste : on saisit d'affilee sans
    // reclamer une ligne de plus a chaque fois.
    const fin = suite[suite.length - 1]
    if (fin && (fin.texte || fin.code || fin.intitule)) suite.push({ ...LIGNE_VIDE })
    onObjectifs(suite)
  }

  function retirer(i) {
    const suite = lignes.filter((_, j) => j !== i)
    onObjectifs(suite.length ? suite : [{ ...LIGNE_VIDE }])
  }

  const remplies = lignes.filter(o => (o.texte || '').trim()).length
  const choix = dispositionsPour(cliches.length)
  const dispoActive = disposition || choix[0]?.id

  return (
    <div className="cr-obj">
      <div className="cr-obj-tete">
        <div>
          <span className="cr-field-label">Objectifs de la formation</span>
          <p className="cr-obj-aide">
            {formeActive === 'tableau'
              ? 'Rendu en tableau : un code ou un intitulé est renseigné.'
              : 'Rendu en liste. Renseignez un code pour passer au tableau.'}
            {deduit.avecImages && ' Les photos tiendront la colonne de droite.'}
          </p>
        </div>
        <span className="cr-obj-compte">
          {remplies || 'Aucun'} objectif{remplies > 1 ? 's' : ''}
        </span>
      </div>

      <div className={`cr-obj-lignes cr-obj-lignes--${formeActive}`}>
        {formeActive === 'tableau' && (
          <div className="cr-obj-entete" aria-hidden="true">
            <span /><span>Code</span><span>Intitulé</span><span>Objectif</span><span />
          </div>
        )}
        {lignes.map((o, i) => (
          <div key={i} className="cr-obj-ligne">
            <span className="cr-obj-puce" aria-hidden="true">
              {formeActive === 'tableau' ? i + 1 : puceDe(marquage, i)}
            </span>
            {formeActive === 'tableau' && (
              <>
                <input className="cr-input" value={o.code || ''}
                  placeholder="TS05"
                  aria-label={`Code de l’objectif ${i + 1}`}
                  onChange={e => majLigne(i, 'code', e.target.value)} />
                <input className="cr-input" value={o.intitule || ''}
                  placeholder="Intitulé"
                  aria-label={`Intitulé de l’objectif ${i + 1}`}
                  onChange={e => majLigne(i, 'intitule', e.target.value)} />
              </>
            )}
            <input className="cr-input" value={o.texte || ''}
              placeholder={i === 0 ? 'Ce que le participant saura faire' : ''}
              aria-label={`Objectif ${i + 1}`}
              onChange={e => majLigne(i, 'texte', e.target.value)} />
            <button type="button" className="cr-obj-retirer"
              onClick={() => retirer(i)} disabled={lignes.length === 1}
              aria-label={`Retirer l’objectif ${i + 1}`}>×</button>
          </div>
        ))}
      </div>

      <div className="cr-obj-reglages">
        {formeActive === 'liste' && (
          <fieldset className="cr-obj-bloc">
            <legend className="cr-field-label">Marquage</legend>
            <div className="cr-obj-choix">
              {MARQUAGES.map(m => (
                <button key={m.id} type="button"
                  className={`cr-obj-opt${(marquage || 'puces') === m.id ? ' cr-obj-opt--on' : ''}`}
                  aria-pressed={(marquage || 'puces') === m.id}
                  onClick={() => onMarquage(m.id)}>
                  <span className="cr-obj-opt-vue" aria-hidden="true">
                    {m.apercu.map((p, j) => <em key={j}>{p}</em>)}
                  </span>
                  <span className="cr-obj-opt-nom">{m.nom}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="cr-obj-bloc">
          <legend className="cr-field-label">Présentation</legend>
          <div className="cr-obj-choix">
            {['liste', 'tableau'].map(f => (
              <button key={f} type="button"
                className={`cr-obj-opt${formeActive === f ? ' cr-obj-opt--on' : ''}`}
                aria-pressed={formeActive === f}
                onClick={() => onForme(f === deduit.forme ? null : f)}>
                <span className="cr-obj-opt-vue" aria-hidden="true">
                  {f === 'liste'
                    ? <><em>•</em><em>•</em><em>•</em></>
                    : <span className="cr-obj-mini-tab" />}
                </span>
                <span className="cr-obj-opt-nom">
                  {f === 'liste' ? 'Liste' : 'Tableau'}
                  {f === deduit.forme && <small> déduit</small>}
                </span>
              </button>
            ))}
          </div>
          {forcee && (
            <p className="cr-obj-aide">
              Présentation forcée.{' '}
              <button type="button" className="cr-lien-discret"
                onClick={() => onForme(null)}>
                Revenir au rendu déduit
              </button>
            </p>
          )}
        </fieldset>

        {cliches.length > 0 && choix.length > 1 && (
          <fieldset className="cr-obj-bloc">
            <legend className="cr-field-label">
              Disposition des {cliches.length} photos
            </legend>
            <div className="cr-obj-choix">
              {choix.map(d => (
                <button key={d.id} type="button"
                  className={`cr-obj-opt${dispoActive === d.id ? ' cr-obj-opt--on' : ''}`}
                  aria-pressed={dispoActive === d.id} title={d.note}
                  onClick={() => onDisposition(d.id)}>
                  <span className="cr-obj-opt-vue" aria-hidden="true">
                    <VignetteDisposition disposition={d} />
                  </span>
                  <span className="cr-obj-opt-nom">{d.nom}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </div>
  )
}

/** La puce affichee devant une ligne, selon le marquage retenu. */
function puceDe(marquage, i) {
  const romains = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
  if (marquage === 'romain') return `${romains[i] || i + 1}.`
  if (marquage === 'mixte') return i === 0 ? 'I.' : '•'
  return '•'
}

/** Le schema d'une disposition, en miniature. */
function VignetteDisposition({ disposition: d }) {
  if (d.colonnes) {
    return (
      <span className="cr-obj-vignette" style={{
        gridTemplateColumns: d.poids.map(p => `${p}fr`).join(' '),
      }}>
        {d.colonnes.map((col, i) => (
          <span key={i} className="cr-obj-vignette-col">
            {col.map((_, j) => <span key={j} className="cr-obj-vignette-case" />)}
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className="cr-obj-vignette cr-obj-vignette--lignes">
      {d.schema.map((ligne, i) => (
        <span key={i} className="cr-obj-vignette-ligne">
          {ligne.map((_, j) => <span key={j} className="cr-obj-vignette-case" />)}
        </span>
      ))}
    </span>
  )
}
