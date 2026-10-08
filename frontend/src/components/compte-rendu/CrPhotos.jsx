import { useState, useRef } from 'react'
import { dispositionsPour } from '../../data/mock_sessions_formateur'
import { joursDeSession } from '../../utils/compteRendu'
import { relancerPhoto, srcPhoto } from '../../utils/photosService'

/**
 * Photos et dispositions, rubrique par rubrique.
 *
 * Deux principes tirees des comptes rendus existants :
 *
 *   * **le libelle est facultatif.** Beaucoup de photos parlent d'elles
 *     memes ; en exiger un ferait saisir « photo 3 » douze fois.
 *   * **la disposition depend du nombre de photos.** On ne propose que
 *     les mises en page qui rendent ce nombre lisible sur une
 *     diapositive 16:9 — proposer une grille de six pour une seule
 *     image n'aide personne.
 *
 * Les images restent dans le navigateur : elles ne partent nulle part
 * tant que le formateur ne lance pas la generation. Les URL d'apercu
 * sont liberees au demontage, sans quoi la memoire enfle a chaque
 * changement de rubrique.
 */
export default function CrPhotos({ brouillon, maj, session, parties }) {
  const rubriques = construireRubriques(brouillon, session, parties)
  const [actif, setActif] = useState(rubriques[0]?.id || null)
  const [survol, setSurvol] = useState(false)
  const champRef = useRef(null)

  const photos = brouillon.photos?.[actif] || []
  const choix = dispositionsPour(photos.length)
  const dispoActive = brouillon.dispositions?.[actif]

  // Pas de liberation des URL d'objet au demontage : les photos restent
  // dans le brouillon et sont reaffichees par les autres ecrans (apercu,
  // verification). Les liberer ici les laissait en blanc tant que le
  // service ne les avait pas ancrees. Elles sont liberees au retrait.

  function ajouter(fichiers) {
    const nouvelles = Array.from(fichiers)
      .filter(f => f.type.startsWith('image/'))
      .map((f, i) => ({
        id: `${Date.now()}-${i}`,
        nom: f.name,
        apercu: URL.createObjectURL(f),
        legende: '',
      }))
    if (!nouvelles.length) return
    maj({
      photos: { ...(brouillon.photos || {}), [actif]: [...photos, ...nouvelles] },
    })
  }

  function retirer(id) {
    const cible = photos.find(p => p.id === id)
    if (cible?.apercu) URL.revokeObjectURL(cible.apercu)
    maj({
      photos: { ...(brouillon.photos || {}), [actif]: photos.filter(p => p.id !== id) },
    })
  }

  function legender(id, texte) {
    maj({
      photos: {
        ...(brouillon.photos || {}),
        [actif]: photos.map(p => (p.id === id ? { ...p, legende: texte } : p)),
      },
    })
  }

  function choisirDisposition(id) {
    maj({ dispositions: { ...(brouillon.dispositions || {}), [actif]: id } })
  }

  if (!rubriques.length) {
    return (
      <div className="cr-panel">
        <div className="cr-empty">
          <div className="cr-empty-title">Aucune rubrique à illustrer</div>
          <p className="cr-empty-text">
            Les parties retenues ne comportent pas de photos.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Les photos du rapport</h2>
        <p className="cr-panel-hint">
          Ajoutez les photos de chaque partie. Le libellé est facultatif — ne le
          remplissez que s’il apporte quelque chose.
        </p>
      </div>

      <div className="cr-days">
        {rubriques.map(r => {
          const n = (brouillon.photos?.[r.id] || []).length
          return (
            <button key={r.id} type="button"
              className={`cr-day${actif === r.id ? ' cr-day--on' : ''}`}
              onClick={() => setActif(r.id)}>
              {r.titre}
              {n > 0 && <span className="cr-day-mark">{n}</span>}
            </button>
          )
        })}
      </div>

      <div
        className={`cr-drop${survol ? ' cr-drop--over' : ''}`}
        onClick={() => champRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => {
          e.preventDefault(); setSurvol(false)
          ajouter(e.dataTransfer.files)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') champRef.current?.click() }}
      >
        <div style={{ fontSize: 26, color: 'var(--muted-2)' }} aria-hidden="true">+</div>
        <div className="cr-drop-title">Déposez vos photos ici</div>
        <div className="cr-drop-hint">ou cliquez pour les choisir — JPG, PNG</div>
        <input ref={champRef} type="file" accept="image/*" multiple hidden
          onChange={e => { ajouter(e.target.files); e.target.value = '' }} />
      </div>

      {photos.length > 0 && (
        <>
          <div className="cr-photos">
            {photos.map((p, i) => (
              <figure key={p.id} className="cr-photo" style={{ margin: 0 }}>
                <img className="cr-photo-img" src={srcPhoto(p)} alt={p.legende || p.nom}
                  onError={relancerPhoto} />
                <figcaption className="cr-photo-body">
                  <input
                    className="cr-photo-legend"
                    value={p.legende}
                    placeholder={`Libellé (facultatif)`}
                    onChange={e => legender(p.id, e.target.value)}
                    aria-label={`Libellé de la photo ${i + 1}`}
                  />
                  <div className="cr-photo-actions">
                    <span style={{
                      fontSize: 11, color: 'var(--muted-2)',
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}>
                      {i + 1}
                    </span>
                    <button type="button" className="cr-photo-del"
                      onClick={() => retirer(p.id)}>Retirer</button>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>

          <div style={{ marginTop: 30 }}>
            <div className="cr-field-label" style={{ marginBottom: 4 }}>
              Disposition sur la page
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>
              {choix.length > 1
                ? `${choix.length} mises en page conviennent à ${photos.length} photo${photos.length > 1 ? 's' : ''}.`
                : `Une mise en page convient à ${photos.length} photo${photos.length > 1 ? 's' : ''}.`}
            </p>
            <div className="cr-layouts">
              {choix.map(d => (
                <button key={d.id} type="button"
                  className={`cr-layout${dispoActive === d.id ? ' cr-layout--on' : ''}`}
                  onClick={() => choisirDisposition(d.id)}>
                  <ApercuDisposition disposition={d} />
                  <div className="cr-layout-name">{d.nom}</div>
                  <div className="cr-layout-note">{d.note}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** L'apercu schematique d'une mise en page.
 *
 * Deux descriptions cohabitent, parce que deux familles de mises en
 * page existent :
 *
 *   `lignes`   des rangees d'images de meme hauteur ;
 *   `colonnes` une image haute a cote d'une pile — la forme que
 *              `lignes` ne savait pas decrire sans dessiner une case
 *              de trop.
 *
 * Le nombre de cases dessinees doit toujours egaler le nombre de
 * photos : c'est ce que le formateur compte du regard.
 */
function ApercuDisposition({ disposition: d }) {
  if (d.colonnes) {
    return (
      <div className="cr-layout-preview cr-layout-preview--cols" aria-hidden="true">
        {d.colonnes.map((pile, ci) => (
          <div key={ci} className="cr-layout-col" style={{ flex: d.poids?.[ci] ?? 1 }}>
            {pile.map((_, li) => (
              <div key={li} className="cr-layout-cell" />
            ))}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="cr-layout-preview" aria-hidden="true">
      {(d.schema || []).map((ligne, li) => (
        <div key={li} className="cr-layout-row">
          {ligne.map((poids, ci) => (
            <div key={ci} className="cr-layout-cell" style={{ flex: poids }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Les rubriques qui acceptent des photos, selon les parties retenues. */
function construireRubriques(brouillon, session, parties) {
  const choisies = brouillon.parties || []
  const out = []
  if (choisies.includes('participants')) {
    out.push({ id: 'participants', titre: 'Photo de groupe' })
  }
  if (choisies.includes('deroule')) {
    joursDeSession(session).forEach(j => {
      out.push({ id: `jour-${j.index}`, titre: `Jour ${j.index}` })
    })
  }
  if (choisies.includes('bilan')) {
    out.push({ id: 'bilan', titre: 'Bilan' })
  }
  return out
}
