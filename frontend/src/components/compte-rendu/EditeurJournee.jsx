/**
 * L'editeur d'une journee de formation.
 *
 * Deux volets, comme aux objectifs et aux resultats : on remplit la
 * journee, puis on integre les images. Un seul est ouvert a la fois.
 *
 * Les trois rubriques ne sont pas un choix de presentation : sur les
 * 71 pages jour des comptes rendus existants, « Thematiques abordees »,
 * « Les points forts » et « Les points d'amelioration » reviennent 68
 * fois, toujours dans cet ordre. On les pose donc en dur plutot que de
 * laisser le formateur les nommer.
 *
 * La saisie se fait au collage, une ligne par puce : c'est le volume
 * constate (5 thematiques, 2 points forts, 3 ameliorations en mediane,
 * des lignes de 43 caracteres) et le formateur a souvent deja ce texte
 * ailleurs.
 *
 * La legende, elle, reste facultative : elle n'est renseignee que sur
 * 12 des 75 pages relevees, et souvent par un texte passe-partout.
 */

import { useState } from 'react'
import ImageCadree, { BoutonRecadrer } from './ImageCadree'
import ChoixLegende from './ChoixLegende'
import { casesDe, dispositionsClassees, dispositionsPour, grilleDe }
  from '../../data/dispositions_photos'

/**
 * Les trois rubriques du modele, dans l'ordre de la diapositive.
 *
 * `exemple` sert de texte d'invite : court, concret, tire des comptes
 * rendus reels — pas une consigne a lire.
 */
export const RUBRIQUES = [
  {
    cle: 'thematiques',
    titre: 'Thématiques abordées',
    exemple: 'Exemple :\nRappel théorique sur le système étudié\n'
      + 'Consultation du manuel de réparation\n'
      + 'Désassemblage et contrôle des composants',
  },
  {
    cle: 'forts',
    titre: 'Les points forts',
    exemple: 'Exemple :\nStagiaires dynamiques et engagés\n'
      + 'Bonne maîtrise des outils de mesure',
  },
  {
    cle: 'ameliorations',
    titre: 'Les points d’amélioration',
    exemple: 'Exemple :\nNiveau hétérogène à renforcer en amont\n'
      + 'Prérequis e-learning à terminer avant la session',
  },
]

/**
 * Le nombre de photos qu'une page jour accepte.
 *
 * Quatre, pas cinq : aucune des 75 pages relevees ne va au-dela, et le
 * cadre du modele est deja bien rempli a quatre.
 */
export const MAX_PHOTOS_JOUR = 4

/** Les lignes d'une rubrique, telles qu'on les colle. */
function texteDeRubrique(lignes) {
  return (lignes || []).join('\n').replace(/\n+$/, '')
}

/** Les lignes retenues : une par ligne saisie, les vides ignorees. */
function lignesDuTexte(texte) {
  return String(texte).split(/\r?\n/)
}

/** Ce qui sera effectivement porte au document. */
function retenues(lignes) {
  return (lignes || []).filter(l => l && l.trim()).length
}

export default function EditeurJournee({
  jour, journee, photos, disposition, legende, modeLegende, onModeLegende,
  onJournee, onLegende,
  onAjouter, onRetirer, onReordonner, onDisposition, onLegender, onCadrer,
  jourPrecedent, onCopierVeille,
}) {
  const contenu = journee || {}
  const cliches = photos || []
  const [volet, setVolet] = useState('journee')

  const total = RUBRIQUES.reduce(
    (n, r) => n + retenues(contenu[r.cle]), 0)
  const choix = dispositionsPour(cliches.length)
    .filter(d => d.nombre <= MAX_PHOTOS_JOUR)
  const dispoActive = disposition || choix[0]?.id
  const dispo = choix.find(d => d.id === dispoActive)
  // Les legendes se choisissent a part de la disposition : une par
  // image, une pour le cadre entier, ou aucune.
  const parImage = modeLegende === 'chaque'
  const commune = modeLegende === 'commune'
  const restantes = MAX_PHOTOS_JOUR - cliches.length

  function majRubrique(cle, texte) {
    onJournee({ ...contenu, [cle]: lignesDuTexte(texte) })
  }

  return (
    <div className="cr-blocs cr-blocs--journee">
      <Bloc titre={`Le texte du jour ${jour}`}
        resume={total ? `${total} ligne${total > 1 ? 's' : ''}` : '3 cases à remplir'}
        valeur={total || '—'}
        ton={total ? 'ok' : null}
        ouvert={volet === 'journee'}
        onOuvrir={() => setVolet('journee')}>

        {/* Reprendre la veille evite de resaisir ce qui se repete d'un
            jour a l'autre — la salle, l'engagement du groupe. On copie,
            on ne fusionne pas : le formateur garde la main. */}
        {jourPrecedent && (
          <div className="cr-jour-veille">
            <button type="button" className="cr-part-ajout"
              onClick={onCopierVeille}>
              Reprendre le jour {jour - 1}
            </button>

          </div>
        )}

        <div className="cr-jour-rubriques">
          {RUBRIQUES.map(r => {
            const n = retenues(contenu[r.cle])
            return (
              <label key={r.cle} className="cr-jour-rubrique">
                <span className="cr-field-label">
                  {r.titre}
                  <span className="cr-jour-compte">{n || ''}</span>
                </span>
                <textarea className="cr-textarea cr-jour-texte"
                  value={texteDeRubrique(contenu[r.cle])}
                  placeholder={r.exemple}
                  onChange={e => majRubrique(r.cle, e.target.value)} />
              </label>
            )
          })}
        </div>

      </Bloc>

      <Bloc titre="Ajouter des photos"
        resume={cliches.length
          ? `${restantes} place${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`
          // Sans photo, la page garderait les emplacements du modele.
          : 'À ajouter'}
        valeur={cliches.length || '—'}
        ton={cliches.length ? 'ok' : null}
        ouvert={volet === 'images'}
        onOuvrir={() => setVolet('images')}>
        <div className="cr-obj-saisie cr-obj-saisie--images">
          {/* A gauche les dispositions et l'ajout, a droite le rendu :
              on choisit une mise en page en voyant son effet. */}
          <div className="cr-obj-cote cr-obj-cote--gauche">
            <button type="button" className="cr-obj-ajout cr-obj-ajout--haut"
              disabled={cliches.length >= MAX_PHOTOS_JOUR}
              onClick={() => document.getElementById(`cr-jour-fichier-${jour}`)?.click()}>
              + Ajouter une photo
              <span className="cr-obj-ajout-compte">
                {cliches.length}/{MAX_PHOTOS_JOUR}
              </span>
            </button>
            <input id={`cr-jour-fichier-${jour}`} type="file"
              accept="image/*" multiple hidden
              onChange={e => { onAjouter?.(e.target.files); e.target.value = '' }} />

            <span className="cr-field-label">Présentation des photos</span>
            <div className="cr-obj-choix cr-obj-choix--colonne cr-obj-choix--defile">
              {dispositionsClassees(cliches.length).map(d => {
                const possible = d.nombre === cliches.length
                return (
                  <button key={d.id} type="button"
                    className={`cr-obj-opt${dispoActive === d.id && possible ? ' cr-obj-opt--on' : ''}`}
                    aria-pressed={dispoActive === d.id && possible}
                    disabled={!possible || d.nombre > MAX_PHOTOS_JOUR}
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
            <ChoixLegende nombre={cliches.length} mode={modeLegende} onMode={onModeLegende} />
          </div>

          {/* La legende, par image ou commune, se saisit dans le cadre,
              a la place qu'elle occupera sur la diapositive. */}
          <PlanchePhotos photos={cliches} jour={jour}
            disposition={dispo}
            parImage={parImage}
            commune={commune}
            legende={legende}
            onRetirer={onRetirer} onReordonner={onReordonner}
            onAjouter={onAjouter} onLegender={onLegender} onCadrer={onCadrer}
            onLegende={onLegende} />
        </div>
      </Bloc>
    </div>
  )
}

/** Un volet depliable, ouvert ou non selon le parent. */
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

/** Les photos posees selon la disposition retenue. */
function PlanchePhotos({ photos, disposition, jour, parImage, commune, legende,
  onRetirer, onReordonner, onAjouter, onLegender, onLegende, onCadrer }) {
  const [saisie, setSaisie] = useState(null)
  const [survol, setSurvol] = useState(null)
  const [cadrage, setCadrage] = useState(null)
  const champ = `cr-jour-fichier-${jour}`

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
        onClick={() => document.getElementById(champ)?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onAjouter?.(e.dataTransfer.files) }}
        role="button" tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter') document.getElementById(champ)?.click()
        }}>
        <span className="cr-drop-title">Déposez vos photos</span>
        <span className="cr-drop-hint">JPG, PNG</span>
      </div>
    )
  }

  const toutes = casesDe(disposition)
  const cases = toutes.slice(0, photos.length)

  return (
    <div className="cr-planche-cadre"
      style={{ '--planche-ratio': disposition?.ratio || 1.17 }}>
      <div className="cr-planche" style={grilleDe(disposition)}>
      {cases.map((forme, i) => {
        const photo = photos[i]
        const recadre = cadrage === photo.id
        return (
          <div key={photo.id}
            className={`cr-case${survol === i ? ' cr-case--cible' : ''}`
              + `${saisie === i ? ' cr-case--prise' : ''}`
              + `${parImage ? ' cr-case--legendee' : ''}`
              + `${recadre ? ' cr-case--cadrage' : ''}`}
            style={forme}
            draggable={!recadre}
            onDragStart={e => {
              // Ctrl + glisser recadre l'image au lieu de deplacer la case.
              if (e.ctrlKey) { e.preventDefault(); return }
              setSaisie(i)
            }}
            onDragOver={e => { e.preventDefault(); setSurvol(i) }}
            onDragLeave={() => setSurvol(null)}
            onDrop={e => {
              e.preventDefault()
              if (saisie != null) deposer(i)
              else onAjouter?.(e.dataTransfer.files)
            }}
            onDragEnd={() => { setSaisie(null); setSurvol(null) }}>
            <div className="cr-case-image">
              <ImageCadree src={photo.apercu} cadrage={photo.cadrage}
                actif={recadre}
                onCadrer={onCadrer && (c => onCadrer(photo.id, c))} />
              <span className="cr-case-rang" aria-hidden="true">{i + 1}</span>
              {onCadrer && (
                <BoutonRecadrer actif={recadre} rang={i + 1}
                  onBasculer={() => setCadrage(recadre ? null : photo.id)} />
              )}
              <button type="button" className="cr-case-retirer"
                onClick={() => onRetirer?.(photo.id)}
                aria-label={`Retirer la photo ${i + 1}`}>×</button>
            </div>
            {parImage && (
              <input className="cr-case-legende"
                value={photo.legende || ''}
                placeholder={`Légende ${i + 1}`}
                aria-label={`Légende de la photo ${i + 1}`}
                draggable={false}
                onDragStart={e => e.stopPropagation()}
                onChange={e => onLegender?.(photo.id, e.target.value)} />
            )}
          </div>
        )
      })}
      </div>
      {/* Une seule legende pour le cadre : elle se pose sous les images,
          la ou elle figurera sur la diapositive. */}
      {commune && (
        <input className="cr-case-legende cr-planche-legende"
          value={legende || ''}
          placeholder="Légende de l’ensemble"
          aria-label="Légende de l’ensemble des photos"
          onChange={e => onLegende?.(e.target.value)} />
      )}
    </div>
  )
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
