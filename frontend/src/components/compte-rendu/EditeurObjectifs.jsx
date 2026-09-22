import { useState } from 'react'
import { dispositionsPour } from '../../data/mock_sessions_formateur'

/**
 * L'editeur des objectifs de la formation.
 *
 * Deux volets, comme a l'etape des resultats : on remplit les
 * objectifs, puis on integre les images. Un seul est ouvert a la fois —
 * les deux saisies sont independantes, les afficher ensemble ne fait
 * qu'allonger la page.
 *
 * Une seule regle commande le rendu, et elle ne se regle pas : sans
 * photo, les objectifs sont une liste ; des qu'il y en a une, le modele
 * passe au tableau avec la colonne d'images. Le formateur n'a donc pas
 * a choisir une presentation — il depose des photos, ou non.
 *
 * Restent deux vrais choix, chacun dans son volet : le marquage de la
 * liste (rien ne permet de le deviner) et, des qu'il y a plusieurs
 * photos, leur disposition. L'ordre des photos fixe leur place dans
 * cette disposition ; on les reordonne en les faisant glisser.
 */

/** Les trois marquages de liste retenus par le modele. */
export const MARQUAGES = [
  { id: 'puces', nom: 'Puces', apercu: ['•', '•', '•'] },
  { id: 'romain', nom: 'Romain', apercu: ['I.', 'II.', 'III.'] },
  { id: 'mixte', nom: 'Les deux', apercu: ['I.', '•', '•'] },
]

/** Une ligne vierge, pour demarrer ou prolonger la saisie. */
export const LIGNE_VIDE = { code: '', intitule: '', texte: '' }

/** Le modele ne prevoit pas de disposition au-dela de cinq images. */
export const MAX_PHOTOS = 5

export default function EditeurObjectifs({
  objectifs, marquage, photos, disposition,
  onObjectifs, onMarquage, onDisposition, onReordonner,
  onAjouter, onRetirer, onLegender,
}) {
  const lignes = objectifs?.length ? objectifs : [LIGNE_VIDE]
  const cliches = photos || []
  // La forme suit les photos, sans reglage : c'est la regle du modele.
  const avecImages = cliches.length > 0
  const [volet, setVolet] = useState('objectifs')

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
    <div className="cr-blocs cr-blocs--objectifs">
      <Bloc titre="Remplir les objectifs"
        resume={avecImages ? 'En tableau' : 'En liste'}
        valeur={remplies || '—'}
        ton={remplies ? 'ok' : null}
        ouvert={volet === 'objectifs'}
        onOuvrir={() => setVolet('objectifs')}>
        <div className={`cr-obj-lignes cr-obj-lignes--${avecImages ? 'tableau' : 'liste'}`}>
          {avecImages && (
            <div className="cr-obj-entete" aria-hidden="true">
              <span /><span>Code</span><span>Intitulé</span><span>Objectif</span><span />
            </div>
          )}
          {lignes.map((o, i) => (
            <div key={i} className="cr-obj-ligne">
              <span className="cr-obj-puce" aria-hidden="true">
                {avecImages ? i + 1 : puceDe(marquage, i)}
              </span>
              {avecImages && (
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

        {/* Le marquage ne concerne que la liste : avec des photos, le
            modele numerote lui-meme les lignes du tableau. */}
        {!avecImages && (
          <div className="cr-obj-reglage">
            <span className="cr-field-label">Marquage</span>
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
          </div>
        )}
      </Bloc>

      <Bloc titre="Intégrer les images"
        resume={avecImages
          ? `${MAX_PHOTOS - cliches.length} place${MAX_PHOTOS - cliches.length > 1 ? 's' : ''} restante${MAX_PHOTOS - cliches.length > 1 ? 's' : ''}`
          : 'Facultatif — la page reste en liste'}
        valeur={cliches.length || '—'}
        ton={avecImages ? 'ok' : null}
        ouvert={volet === 'images'}
        onOuvrir={() => setVolet('images')}>
        <DepotImages photos={cliches} onAjouter={onAjouter}
          onRetirer={onRetirer} onLegender={onLegender} />

        {choix.length > 1 && (
          <div className="cr-obj-reglage">
            <span className="cr-field-label">
              Disposition des {cliches.length} photos
            </span>
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
          </div>
        )}

        {cliches.length > 1 && (
          <OrdreDesPhotos photos={cliches} onReordonner={onReordonner} />
        )}
      </Bloc>
    </div>
  )
}

/** Un volet depliable, ouvert ou non selon le parent.
 *
 *  L'en-tete porte l'etat du volet : replie, il dit deja ou en est la
 *  saisie. Meme structure qu'a l'etape des resultats, pour que les deux
 *  etapes se manipulent pareil.
 */
function Bloc({ titre, resume, valeur, ton, ouvert, onOuvrir, children }) {
  return (
    <div className={`cr-bloc${ouvert ? ' cr-bloc--ouvert' : ''}`}>
      <h3 className="cr-bloc-titre">
        <button type="button" className="cr-bloc-bouton"
          aria-expanded={ouvert} onClick={onOuvrir}>
          <span className="cr-bloc-fleche" aria-hidden="true">▸</span>
          <span className="cr-bloc-nom">{titre}</span>
          <span className="cr-bloc-resume">{resume}</span>
          <span className={`cr-calc${ton ? ` cr-calc--${ton}` : ' cr-calc--vide'}`}>
            {valeur}
          </span>
        </button>
      </h3>
      {ouvert && <div className="cr-bloc-corps">{children}</div>}
    </div>
  )
}

/** Le depot des photos et leurs legendes. */
function DepotImages({ photos, onAjouter, onRetirer, onLegender }) {
  const [survol, setSurvol] = useState(false)
  const reste = MAX_PHOTOS - photos.length
  const complet = reste <= 0

  return (
    <>
      <div className={`cr-drop cr-drop--compact${survol ? ' cr-drop--over' : ''}`
        + `${complet ? ' cr-drop--plein' : ''}`}
        onClick={() => !complet && document.getElementById('cr-obj-fichier')?.click()}
        onDragOver={e => { e.preventDefault(); if (!complet) setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => {
          e.preventDefault()
          setSurvol(false)
          if (!complet) onAjouter?.(e.dataTransfer.files)
        }}
        role="button" tabIndex={complet ? -1 : 0}
        aria-disabled={complet}
        onKeyDown={e => {
          if (e.key === 'Enter' && !complet) {
            document.getElementById('cr-obj-fichier')?.click()
          }
        }}>
        <span className="cr-drop-title">
          {complet ? 'Cinq photos, le maximum' : 'Déposez vos photos'}
        </span>
        <span className="cr-drop-hint">
          {complet
            ? 'Retirez-en une pour en ajouter une autre'
            : `ou cliquez — JPG, PNG · ${reste} restante${reste > 1 ? 's' : ''}`}
        </span>
        <input id="cr-obj-fichier" type="file" accept="image/*" multiple hidden
          onChange={e => { onAjouter?.(e.target.files); e.target.value = '' }} />
      </div>

      {photos.length > 0 && (
        <div className="cr-vignettes">
          {photos.map((p, i) => (
            <div key={p.id} className="cr-vignette">
              <img src={p.apercu} alt="" />
              <input className="cr-photo-legend" value={p.legende}
                placeholder="Libellé (facultatif)"
                onChange={e => onLegender?.(p.id, e.target.value)}
                aria-label={`Libellé de la photo ${i + 1}`} />
              <button type="button" className="cr-photo-del"
                onClick={() => onRetirer?.(p.id)}>Retirer</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * L'ordre des photos, qui fixe leur place dans la disposition.
 *
 * On les fait glisser plutot que de saisir un rang : la position se
 * decide en regardant les images, pas en lisant des numeros.
 */
function OrdreDesPhotos({ photos, onReordonner }) {
  const [saisie, setSaisie] = useState(null)
  const [survol, setSurvol] = useState(null)

  function deposer(vers) {
    if (saisie == null || saisie === vers) return
    const suite = [...photos]
    const [prise] = suite.splice(saisie, 1)
    suite.splice(vers, 0, prise)
    onReordonner?.(suite)
    setSaisie(null)
    setSurvol(null)
  }

  /** Deplacer au clavier : glisser n'est pas accessible a tous. */
  function decaler(i, pas) {
    const vers = i + pas
    if (vers < 0 || vers >= photos.length) return
    const suite = [...photos]
    const [prise] = suite.splice(i, 1)
    suite.splice(vers, 0, prise)
    onReordonner?.(suite)
  }

  return (
    <div className="cr-obj-reglage">
      <span className="cr-field-label">Ordre des photos</span>
      <p className="cr-obj-aide">
        La première occupe la place principale de la disposition.
        Faites glisser pour réordonner.
      </p>
      <ol className="cr-obj-ordre">
        {photos.map((p, i) => (
          <li key={p.id}
            className={`cr-obj-photo${survol === i ? ' cr-obj-photo--cible' : ''}`
              + `${saisie === i ? ' cr-obj-photo--prise' : ''}`}
            draggable
            onDragStart={() => setSaisie(i)}
            onDragOver={e => { e.preventDefault(); setSurvol(i) }}
            onDragLeave={() => setSurvol(null)}
            onDrop={e => { e.preventDefault(); deposer(i) }}
            onDragEnd={() => { setSaisie(null); setSurvol(null) }}>
            <span className="cr-obj-photo-rang" aria-hidden="true">{i + 1}</span>
            <img src={p.apercu} alt={p.legende || `Photo ${i + 1}`} />
            <span className="cr-obj-photo-fleches">
              <button type="button" onClick={() => decaler(i, -1)}
                disabled={i === 0} aria-label={`Avancer la photo ${i + 1}`}>↑</button>
              <button type="button" onClick={() => decaler(i, 1)}
                disabled={i === photos.length - 1}
                aria-label={`Reculer la photo ${i + 1}`}>↓</button>
            </span>
          </li>
        ))}
      </ol>
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
