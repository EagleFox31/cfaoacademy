/**
 * L'editeur du bilan de la formation.
 *
 * Deux volets, comme aux journees : on redige le bilan, puis on integre
 * les images. Un seul est ouvert a la fois — les deux saisies sont
 * independantes et les afficher ensemble tasse la page.
 *
 * Les quatre rubriques viennent des drapeaux de la diapositive 20 :
 * `{bilan_contexte}`, `{bilan_resultats}`, `{bilan_vigilance}` et
 * `{bilan_suites}`. Elles sont pre-remplies depuis les notes de
 * l'etape 2, a charge pour le formateur de les reecrire.
 */

import { useState } from 'react'
import ImageCadree, { BoutonRecadrer } from './ImageCadree'
import BoutonsRedaction from './BoutonsRedaction'
import { casesDe, dispositionsClassees, dispositionsPour, grilleDe, MAX_PHOTOS }
  from '../../data/dispositions_photos'

export default function EditeurBilan({
  blocs, textes, photos, disposition, legende,
  onTexte, onLegende,
  onAjouter, onRetirer, onReordonner, onDisposition, onLegender, onCadrer,
  redaction,
}) {
  const cliches = photos || []
  const [volet, setVolet] = useState('bilan')

  const valeur = b => textes[`bilan.${b.cle}`] ?? b.texte ?? ''
  const remplies = (blocs || []).filter(b => valeur(b).trim()).length
  const choix = dispositionsPour(cliches.length)
  const dispoActive = disposition || choix[0]?.id
  const dispo = choix.find(d => d.id === dispoActive)
  const parImage = !!dispo?.legendes
  const restantes = MAX_PHOTOS - cliches.length

  return (
    <div className="cr-blocs cr-blocs--journee">
      <Bloc titre="Rédiger le bilan"
        resume={remplies ? `${remplies} sur ${blocs.length}` : 'Quatre rubriques'}
        valeur={remplies || '—'}
        ton={remplies ? 'ok' : null}
        ouvert={volet === 'bilan'}
        onOuvrir={() => setVolet('bilan')}>
        {/* Le moteur redige les quatre rubriques d'un coup, ou une seule :
            chaque rubrique garde son propre tirage. */}
        <div className="cr-redac-bilan">
          <span className="cr-obj-aide">
            Pré-rempli depuis les notes et les journées — à reprendre librement.
          </span>
          <BoutonsRedaction
            aTexte={remplies > 0}
            enCours={redaction?.redigeant === 'bilan'}
            onRediger={() => redaction?.bilan(null)} />
        </div>
        <div className="cr-jour-rubriques cr-jour-rubriques--bilan">
          {(blocs || []).map(b => {
            const cle = `bilan.${b.cle}`
            return (
              <div key={b.cle} className="cr-jour-rubrique">
                <div className="cr-redac-entete">
                  <label className="cr-field-label" htmlFor={`cr-bilan-${b.cle}`}>{b.titre}</label>
                  <BoutonsRedaction
                    aTexte={!!valeur(b).trim()}
                    enCours={redaction?.redigeant === 'bilan'
                      || redaction?.redigeant === cle}
                    onRediger={() => redaction?.bilan(b.cle)}
                    peutAnnuler={cle in (redaction?.avant || {})}
                    onAnnuler={() => redaction?.annuler(cle)} />
                </div>
                <textarea id={`cr-bilan-${b.cle}`} className="cr-textarea cr-jour-texte"
                  value={valeur(b)}
                  placeholder={b.texte || 'Quelques lignes'}
                  onChange={e => onTexte(cle, e.target.value)} />
              </div>
            )
          })}
        </div>
        {redaction?.panne && (
          <p className="cr-redac-panne">
            Le service de rédaction ne répond pas : écrivez le bilan, ou réessayez.
          </p>
        )}
      </Bloc>

      <Bloc titre="Intégrer les images"
        resume={cliches.length
          ? `${restantes} place${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`
          : 'Facultatif'}
        valeur={cliches.length || '—'}
        ton={cliches.length ? 'ok' : null}
        ouvert={volet === 'images'}
        onOuvrir={() => setVolet('images')}>
        <div className="cr-obj-saisie cr-obj-saisie--images">
          <div className="cr-obj-cote cr-obj-cote--gauche">
            <button type="button" className="cr-obj-ajout cr-obj-ajout--haut"
              disabled={cliches.length >= MAX_PHOTOS}
              onClick={() => document.getElementById('cr-bilan-fichier')?.click()}>
              + Ajouter une photo
              <span className="cr-obj-ajout-compte">
                {cliches.length}/{MAX_PHOTOS}
              </span>
            </button>
            <input id="cr-bilan-fichier" type="file"
              accept="image/*" multiple hidden
              onChange={e => { onAjouter?.(e.target.files); e.target.value = '' }} />

            <span className="cr-field-label">Disposition</span>
            <div className="cr-obj-choix cr-obj-choix--colonne cr-obj-choix--defile">
              {dispositionsClassees(cliches.length).map(d => {
                const possible = d.nombre === cliches.length
                return (
                  <button key={d.id} type="button"
                    className={`cr-obj-opt${dispoActive === d.id && possible ? ' cr-obj-opt--on' : ''}`}
                    aria-pressed={dispoActive === d.id && possible}
                    disabled={!possible || d.nombre > MAX_PHOTOS}
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

          <PlanchePhotos photos={cliches} disposition={dispo}
            parImage={parImage} legende={legende}
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
function PlanchePhotos({ photos, disposition, parImage, legende,
  onRetirer, onReordonner, onAjouter, onLegender, onLegende, onCadrer }) {
  const [saisie, setSaisie] = useState(null)
  const [survol, setSurvol] = useState(null)
  const [cadrage, setCadrage] = useState(null)
  const champ = 'cr-bilan-fichier'

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
  // La disposition courante epouse le nombre de photos : la case
  // d'ajout n'y figure pas, on la pose en fin de grille.
  const libre = photos.length < MAX_PHOTOS

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
        {libre && (
          <button type="button" className="cr-case cr-case--libre"
            onClick={() => document.getElementById('cr-bilan-fichier')?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onAjouter?.(e.dataTransfer.files) }}
            aria-label="Ajouter une photo">
            <span aria-hidden="true">+</span>
          </button>
        )}
      </div>
      {!parImage && (
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
