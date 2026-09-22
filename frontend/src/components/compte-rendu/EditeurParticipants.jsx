/**
 * L'editeur de la page des participants.
 *
 * La page du modele tient en deux temps : les formateurs d'abord, les
 * stagiaires ensuite. On reprend ce decoupage plutot que d'inventer
 * une autre organisation.
 *
 * Chaque formateur occupe une ligne — portrait carre, nom, fonction —
 * parce que c'est ainsi que le modele le pose : un cadre 1:1 de 7,3 %
 * de la largeur, le nom et la fonction a cote. Une formation peut en
 * compter plusieurs, d'ou une liste plutot qu'un couple de champs.
 *
 * Les stagiaires ne se saisissent pas ici : le tableau vient de
 * l'etape 1, et le corriger a deux endroits ferait diverger le document
 * de ses donnees. Seule la photo de groupe s'ajoute, dans le cadre que
 * le modele lui reserve a droite du tableau.
 */

import { useState } from 'react'

/** Le portrait du modele est carre ; la photo de groupe est en 1,38. */
export const RATIO_PORTRAIT = 1
export const RATIO_GROUPE = 1.38

/** Un formateur vierge, pour demarrer ou prolonger la liste. */
export const FORMATEUR_VIDE = { nom: '', fonction: '', portrait: null }

export default function EditeurParticipants({
  formateurs, stagiaires, photoGroupe,
  onFormateurs, onPhotoGroupe,
}) {
  const liste = formateurs?.length ? formateurs : [FORMATEUR_VIDE]

  function majChamp(i, champ, valeur) {
    const suite = liste.map((f, j) => (j === i ? { ...f, [champ]: valeur } : f))
    onFormateurs(suite)
  }

  function ajouter() {
    onFormateurs([...liste, { ...FORMATEUR_VIDE }])
  }

  function retirer(i) {
    const cible = liste[i]
    if (cible?.portrait?.apercu) URL.revokeObjectURL(cible.portrait.apercu)
    const suite = liste.filter((_, j) => j !== i)
    onFormateurs(suite.length ? suite : [{ ...FORMATEUR_VIDE }])
  }

  function poserPortrait(i, fichiers) {
    const image = Array.from(fichiers).find(f => f.type.startsWith('image/'))
    if (!image) return
    const ancien = liste[i]?.portrait
    if (ancien?.apercu) URL.revokeObjectURL(ancien.apercu)
    majChamp(i, 'portrait', {
      nom: image.name,
      apercu: URL.createObjectURL(image),
    })
  }

  return (
    <div className="cr-part">
      <div className="cr-part-bloc">
        <div className="cr-part-tete">
          <span className="cr-field-label">Formateur</span>
          <button type="button" className="cr-part-ajout" onClick={ajouter}>
            + Ajouter un formateur
          </button>
        </div>

        <div className="cr-part-formateurs">
          {liste.map((f, i) => (
            <LigneFormateur key={i} formateur={f} rang={i}
              seul={liste.length === 1}
              onChamp={(champ, v) => majChamp(i, champ, v)}
              onPortrait={fichiers => poserPortrait(i, fichiers)}
              onRetirer={() => retirer(i)} />
          ))}
        </div>
      </div>

      <div className="cr-part-bloc cr-part-bloc--stagiaires">
        <span className="cr-field-label">Stagiaires</span>
        <div className="cr-part-saisie">
          <TableauStagiaires stagiaires={stagiaires} />
          <CadreGroupe photo={photoGroupe} onPhoto={onPhotoGroupe} />
        </div>
      </div>
    </div>
  )
}

/** Un formateur : portrait carre, nom, fonction, sur une seule ligne. */
function LigneFormateur({ formateur, rang, seul, onChamp, onPortrait, onRetirer }) {
  const champ = `cr-portrait-${rang}`
  const [survol, setSurvol] = useState(false)

  return (
    <div className="cr-part-formateur">
      <div className={`cr-portrait${survol ? ' cr-portrait--over' : ''}`
        + `${formateur.portrait ? ' cr-portrait--pose' : ''}`}
        onClick={() => document.getElementById(champ)?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => {
          e.preventDefault()
          setSurvol(false)
          onPortrait(e.dataTransfer.files)
        }}
        role="button" tabIndex={0}
        aria-label={`Portrait du formateur ${rang + 1}`}
        onKeyDown={e => {
          if (e.key === 'Enter') document.getElementById(champ)?.click()
        }}>
        {formateur.portrait
          ? <img src={formateur.portrait.apercu} alt="" />
          : <span className="cr-portrait-vide">photo</span>}
        <input id={champ} type="file" accept="image/*" hidden
          onChange={e => { onPortrait(e.target.files); e.target.value = '' }} />
      </div>

      <div className="cr-part-identite">
        <input className="cr-input" value={formateur.nom || ''}
          placeholder="Nom et prénom"
          aria-label={`Nom du formateur ${rang + 1}`}
          onChange={e => onChamp('nom', e.target.value)} />
        <input className="cr-input cr-input--discret" value={formateur.fonction || ''}
          placeholder="Fonction"
          aria-label={`Fonction du formateur ${rang + 1}`}
          onChange={e => onChamp('fonction', e.target.value)} />
      </div>

      <button type="button" className="cr-obj-retirer"
        onClick={onRetirer} disabled={seul}
        aria-label={`Retirer le formateur ${rang + 1}`}>×</button>
    </div>
  )
}

/** Le tableau des stagiaires, en lecture : il vient de l'etape 1. */
function TableauStagiaires({ stagiaires }) {
  const lignes = stagiaires || []

  if (!lignes.length) {
    return (
      <div className="cr-part-liste cr-part-liste--vide">
        <p className="cr-obj-aide">
          Aucun stagiaire. Ils se saisissent à l’étape 1.
        </p>
      </div>
    )
  }

  return (
    <div className="cr-part-liste">
      <div className="cr-part-entete" aria-hidden="true">
        <span>Nom complet</span><span>Pays</span>
      </div>
      <ol className="cr-part-noms">
        {lignes.map((p, i) => (
          <li key={p.id || i} className="cr-part-nom">
            <span className="cr-part-rang" aria-hidden="true">{i + 1}</span>
            <span className="cr-part-complet">
              {[p.prenom, p.nom].filter(Boolean).join(' ') || '—'}
            </span>
            <span className="cr-part-pays">{p.pays || '—'}</span>
          </li>
        ))}
      </ol>
      <p className="cr-obj-aide">
        {lignes.length} stagiaire{lignes.length > 1 ? 's' : ''} — modifiables à l’étape 1.
      </p>
    </div>
  )
}

/** La photo de groupe, dans le cadre que le modele lui reserve. */
function CadreGroupe({ photo, onPhoto }) {
  const [survol, setSurvol] = useState(false)

  function poser(fichiers) {
    const image = Array.from(fichiers).find(f => f.type.startsWith('image/'))
    if (!image) return
    if (photo?.apercu) URL.revokeObjectURL(photo.apercu)
    onPhoto({ nom: image.name, apercu: URL.createObjectURL(image) })
  }

  return (
    <div className="cr-part-cote">
      <span className="cr-field-label">Photo de groupe</span>
      <div className={`cr-groupe${survol ? ' cr-groupe--over' : ''}`
        + `${photo ? ' cr-groupe--pose' : ''}`}
        onClick={() => document.getElementById('cr-photo-groupe')?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); poser(e.dataTransfer.files) }}
        role="button" tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter') document.getElementById('cr-photo-groupe')?.click()
        }}>
        {photo ? (
          <>
            <img src={photo.apercu} alt="" />
            <button type="button" className="cr-case-retirer"
              onClick={e => {
                e.stopPropagation()
                URL.revokeObjectURL(photo.apercu)
                onPhoto(null)
              }}
              aria-label="Retirer la photo de groupe">×</button>
          </>
        ) : (
          <>
            <span className="cr-drop-title">Déposez la photo</span>
            <span className="cr-drop-hint">JPG, PNG</span>
          </>
        )}
        <input id="cr-photo-groupe" type="file" accept="image/*" hidden
          onChange={e => { poser(e.target.files); e.target.value = '' }} />
      </div>
    </div>
  )
}
