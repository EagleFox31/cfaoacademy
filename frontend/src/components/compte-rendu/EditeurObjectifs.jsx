import { useRef, useState } from 'react'
import { MAX_PHOTOS, casesDe, dispositionsClassees, dispositionsPour, grilleDe }
  from '../../data/dispositions_photos'

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

const PLACEHOLDER = [
  'Collez vos objectifs, un par ligne.',
  '',
  'Identifier les organes du circuit',
  'Contrôler les pressions au banc',
  'Remplacer un élément défectueux',
].join('\n')

/** Le texte de la zone de saisie, une ligne par objectif. */
function texteDesObjectifs(lignes) {
  return (lignes || []).map(o => o.texte || '').join('\n')
}

/** Les objectifs decoupes depuis la zone de saisie.
 *
 *  Le code et l'intitule deja renseignes suivent leur objectif tant que
 *  son texte ne change pas : retaper une ligne ne doit pas vider les
 *  deux colonnes qu'on vient de remplir a cote.
 */
function objectifsDuTexte(texte, anciens = []) {
  const parLigne = new Map(
    anciens.filter(o => (o.texte || '').trim()).map(o => [o.texte.trim(), o]))
  return String(texte).split(/\r?\n/).map(ligne => {
    const t = ligne.trim()
    const connu = parLigne.get(t)
    return connu ? { ...connu, texte: ligne } : { code: '', intitule: '', texte: ligne }
  })
}

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
  const marge = useRef(null)

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
        <div className="cr-obj-saisie">
          {/* On colle une liste d'objectifs, on ne la saisit pas case
              par case : le formateur les a deja rediges ailleurs. Une
              ligne vaut un objectif. */}
          <label className="cr-obj-zone">
            <span className="cr-field-label">
              Un objectif par ligne
            </span>
            <div className="cr-obj-champ">
              {/* La marge est un miroir de la zone de saisie : meme
                  texte, meme police, meme largeur, pour que ses lignes
                  se replient exactement comme les siennes. Le texte y
                  est rendu invisible ; seule la puce, posee en tete de
                  ligne, se voit. Une marge qui n'afficherait qu'une
                  puce par objectif se decalerait des qu'un objectif
                  tient sur deux lignes. */}
              <div className="cr-obj-marge" aria-hidden="true" ref={marge}>
                {texteDesObjectifs(lignes).split(/\n/).map((l, i, tout) => (
                  <p key={i} className="cr-obj-marge-ligne">
                    {l.trim() && (
                      <span className="cr-obj-marge-puce">
                        {puceDe(marquage || 'puces', tout, i)}
                      </span>
                    )}
                    <span className="cr-obj-marge-ombre">{l || ' '}</span>
                  </p>
                ))}
              </div>
              <textarea className="cr-textarea cr-obj-texte"
                value={texteDesObjectifs(lignes)}
                placeholder={PLACEHOLDER}
                onScroll={e => {
                  if (marge.current) marge.current.scrollTop = e.target.scrollTop
                }}
                onChange={e => onObjectifs(objectifsDuTexte(e.target.value, lignes))} />
            </div>
            <span className="cr-obj-aide">
              {remplies
                ? `${remplies} objectif${remplies > 1 ? 's' : ''}`
                : 'Une ligne, un objectif'}
            </span>
          </label>

          {/* Le marquage ne concerne que la liste : avec des photos, le
              modele numerote lui-meme les lignes du tableau. */}
          <div className="cr-obj-cote">
            <span className="cr-field-label">Disposition</span>
            {avecImages ? (
              <p className="cr-obj-aide">
                Des photos sont intégrées : le modèle passe au tableau et
                numérote lui-même les lignes.
              </p>
            ) : (
              <div className="cr-obj-choix cr-obj-choix--colonne">
                {MARQUAGES.map(m => (
                  <button key={m.id} type="button"
                    className={`cr-obj-opt${(marquage || 'puces') === m.id ? ' cr-obj-opt--on' : ''}`}
                    aria-pressed={(marquage || 'puces') === m.id}
                    onClick={() => onMarquage(m.id)}>
                    <span className="cr-obj-opt-vue" aria-hidden="true">
                      {m.apercu.map((x, j) => <em key={j}>{x}</em>)}
                    </span>
                    <span className="cr-obj-opt-nom">{m.nom}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </Bloc>

      <Bloc titre="Intégrer les images"
        resume={avecImages
          ? `${MAX_PHOTOS - cliches.length} place${MAX_PHOTOS - cliches.length > 1 ? 's' : ''} restante${MAX_PHOTOS - cliches.length > 1 ? 's' : ''}`
          : 'Facultatif — la page reste en liste'}
        valeur={cliches.length || '—'}
        ton={avecImages ? 'ok' : null}
        ouvert={volet === 'images'}
        onOuvrir={() => setVolet('images')}>
        <div className="cr-obj-saisie cr-obj-saisie--images">
          {/* A gauche les dispositions et le bouton d'ajout, a droite
              le rendu : on choisit une mise en page en voyant l'effet
              qu'elle produit sur ses propres photos. */}
          <div className="cr-obj-cote cr-obj-cote--gauche">
            <button type="button" className="cr-obj-ajout cr-obj-ajout--haut"
              disabled={cliches.length >= MAX_PHOTOS}
              onClick={() => document.getElementById('cr-obj-fichier')?.click()}>
              + Ajouter une photo
              <span className="cr-obj-ajout-compte">
                {cliches.length}/{MAX_PHOTOS}
              </span>
            </button>
            <input id="cr-obj-fichier" type="file" accept="image/*" multiple hidden
              onChange={e => { onAjouter?.(e.target.files); e.target.value = '' }} />

            <span className="cr-field-label">Disposition</span>
            <div className="cr-obj-choix cr-obj-choix--colonne cr-obj-choix--defile">
              {dispositionsClassees(cliches.length).map(d => {
                const possible = d.nombre === cliches.length
                return (
                  <button key={d.id} type="button"
                    className={`cr-obj-opt${dispoActive === d.id && possible ? ' cr-obj-opt--on' : ''}`}
                    aria-pressed={dispoActive === d.id && possible}
                    disabled={!possible}
                    title={possible ? d.note : `${d.nombre} photo${d.nombre > 1 ? 's' : ''}`}
                    onClick={() => onDisposition(d.id)}>
                    <span className="cr-obj-opt-vue" aria-hidden="true">
                      <VignetteDisposition disposition={d} />
                    </span>
                    <span className="cr-obj-opt-nom">{d.nom}</span>
                    <span className="cr-obj-opt-nb">{d.nombre}</span>
                  </button>
                )
              })}
            </div>

          </div>

          <PlanchePhotos photos={cliches}
            disposition={choix.find(d => d.id === dispoActive)}
            onRetirer={onRetirer} onReordonner={onReordonner}
            onAjouter={onAjouter} />
        </div>
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

/**
 * Les photos posees selon la disposition retenue.
 *
 * Le formateur voit la planche telle qu'elle sortira : c'est la mise en
 * page du modele, pas une grille de vignettes. Les images se font
 * glisser d'une case a l'autre, leur ordre fixant leur place.
 */
function PlanchePhotos({ photos, disposition, onRetirer, onReordonner, onAjouter }) {
  const [saisie, setSaisie] = useState(null)
  const [survol, setSurvol] = useState(null)

  function deposer(vers) {
    if (saisie == null || saisie === vers) return
    const suite = [...photos]
    const [prise] = suite.splice(saisie, 1)
    suite.splice(Math.min(vers, suite.length), 0, prise)
    onReordonner?.(suite)
    setSaisie(null)
    setSurvol(null)
  }

  if (!photos.length) {
    return (
      <div className="cr-planche cr-planche--vide"
        onClick={() => document.getElementById('cr-obj-fichier')?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onAjouter?.(e.dataTransfer.files) }}
        role="button" tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter') document.getElementById('cr-obj-fichier')?.click()
        }}>
        <span className="cr-drop-title">Déposez vos photos</span>
        <span className="cr-drop-hint">JPG, PNG</span>
      </div>
    )
  }

  // Les cases de la disposition, limitees aux photos posees : une case
  // vide repeterait le bouton d'ajout de la colonne de gauche.
  const toutes = casesDe(disposition)
  const cases = toutes.slice(0, photos.length)
  // Une case reste ouverte tant que la disposition n'est pas remplie :
  // on complete sans repasser par la colonne de gauche.
  // La disposition courante epouse le nombre de photos : la case
  // d'ajout n'y figure pas, on la pose en fin de grille.
  const libre = photos.length < MAX_PHOTOS

  return (
    <div className="cr-planche"
      style={{ ...grilleDe(disposition), '--planche-ratio': disposition?.ratio || 1.17 }}>
      {cases.map((forme, i) => {
        const photo = photos[i]
        return (
          <div key={photo.id}
            className={`cr-case${survol === i ? ' cr-case--cible' : ''}`
              + `${saisie === i ? ' cr-case--prise' : ''}`}
            style={forme}
            draggable
            onDragStart={() => setSaisie(i)}
            onDragOver={e => { e.preventDefault(); setSurvol(i) }}
            onDragLeave={() => setSurvol(null)}
            onDrop={e => {
              e.preventDefault()
              if (saisie != null) deposer(i)
              else onAjouter?.(e.dataTransfer.files)
            }}
            onDragEnd={() => { setSaisie(null); setSurvol(null) }}>
            <img src={photo.apercu} alt="" />
            <span className="cr-case-rang" aria-hidden="true">{i + 1}</span>
            <button type="button" className="cr-case-retirer"
              onClick={() => onRetirer?.(photo.id)}
              aria-label={`Retirer la photo ${i + 1}`}>×</button>
          </div>
        )
      })}
      {libre && (
        <button type="button" className="cr-case cr-case--libre"
          onClick={() => document.getElementById('cr-obj-fichier')?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); onAjouter?.(e.dataTransfer.files) }}
          aria-label="Ajouter une photo">
          <span aria-hidden="true">+</span>
        </button>
      )}
    </div>
  )
}

/** Le rang d'une ligne parmi les seules lignes remplies. */
function rang(textes, i) {
  return textes.slice(0, i).filter(t => t.trim()).length
}

/** Une ligne remplie qui suit une ligne vide, ou ouvre la liste. */
function ouvreGroupe(textes, j) {
  return Boolean(textes[j].trim()) && (j === 0 || !textes[j - 1].trim())
}

/** La puce affichee devant une ligne, selon le marquage retenu.
 *
 *  En marquage mixte, une ligne vide separe deux groupes : la premiere
 *  ligne de chaque groupe en porte le titre et prend le chiffre romain,
 *  les suivantes sont ses sous-objectifs et prennent la puce.
 */
function puceDe(marquage, textes, i) {
  const romains = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
  const romain = n => `${romains[n] || n + 1}.`
  if (marquage === 'romain') return romain(rang(textes, i))
  if (marquage === 'mixte') {
    if (!ouvreGroupe(textes, i)) return '•'
    return romain(textes.slice(0, i).filter((_, j) => ouvreGroupe(textes, j)).length)
  }
  return '•'
}

/** Le schema d'une disposition, en miniature. */
function VignetteDisposition({ disposition: d }) {
  return (
    <span className="cr-obj-vignette" style={grilleDe(d)}>
      {casesDe(d).map((forme, i) => (
        <span key={i} className="cr-obj-vignette-case" style={forme} />
      ))}
    </span>
  )
}
