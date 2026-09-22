import { useMemo, useState, useRef } from 'react'
import { dispositionsPour, partieRetenue } from '../../data/mock_sessions_formateur'
import { SEUIL, calculer, afficher } from '../../utils/baremeCfao'
import { periodeLongue, nombreDeJours } from '../../utils/compteRendu'
import { syntheseSatisfaction, afficherTaux } from '../../utils/satisfactionCfao'
import ApercuReel from './ApercuReel'
import EditeurObjectifs from './EditeurObjectifs'
import EditeurParticipants from './EditeurParticipants'
import EditeurJournee, { MAX_PHOTOS_JOUR } from './EditeurJournee'
import { diapoDe, valeursDrapeaux } from '../../utils/diapositives'

/**
 * Phase 4 — l'edition du rapport.
 *
 * A ce stade tout est connu : le rapport peut etre compose. On le
 * montre donc, page par page, plutot que de demander encore des
 * informations a l'aveugle.
 *
 * Le formateur voit chaque page telle qu'elle sortira, y depose ses
 * photos, choisit la disposition et **corrige les textes en cliquant
 * dessus**. Pas de formulaire separe : le texte qu'on modifie est
 * celui qu'on lit.
 *
 * Les pages sont a l'echelle : une diapositive 16:9 reduite garde ses
 * proportions, ce qui evite la surprise d'un texte qui deborde une fois
 * le fichier produit.
 */
const SEPARATEUR_OBJECTIFS = new RegExp('\r?\n|(?<=\.)\s+(?=[A-Z\u00C0-\u00DE])')
const PUCE_INITIALE = new RegExp('^[-\u2022*\u2013]\s*')

/** Le modele ne prevoit pas de disposition au-dela de cinq images. */
const MAX_PHOTOS = 5

/** Les objectifs d'un brouillon anterieur, repris ligne a ligne.
 *
 *  Les objectifs se saisissaient dans un paragraphe libre. Un brouillon
 *  commence avant ce changement garde ce texte : on le redecoupe en
 *  lignes plutot que de le perdre ou de le laisser invisible.
 */
function objectifsInitiaux(b, page) {
  const texte = b.textes?.['objectifs.objectifs']
    ?? b.textes?.objectifs
    ?? page?.blocs?.[0]?.texte
    ?? ''
  // Une ligne par objectif, ou a defaut une phrase : le paragraphe
  // d'origine tenait souvent les deux formes.
  const lignes = String(texte)
    .split(SEPARATEUR_OBJECTIFS)
    .map(l => l.replace(PUCE_INITIALE, '').trim())
    .filter(Boolean)
  if (!lignes.length) return null
  return [...lignes.map(t => ({ code: '', intitule: '', texte: t })),
    { code: '', intitule: '', texte: '' }]
}

/** Le formateur de la session, prerempli et modifiable.
 *
 *  La session n'en designe qu'un ; une formation peut en compter
 *  plusieurs, que le formateur ajoute lui-meme. On part donc de celui
 *  qui est connu plutot que d'une ligne vide.
 */
function formateursInitiaux(session) {
  const nom = session?.formateur
  return [{ nom: nom || '', fonction: nom ? 'Formateur' : '', portrait: null }]
}

export default function PhaseVerification({
  brouillon, maj, session, synthese, onTerminer,
}) {
  const pages = useMemo(
    () => composerPages(brouillon, session, synthese),
    [brouillon, session, synthese],
  )
  const [active, setActive] = useState(0)
  const [etat, setEtat] = useState('revue')
  // Deux modes plutot qu'une page a moitie editable : on remplit, ou
  // on regarde le resultat. Un texte cliquable dans un apercu ne dit
  // pas qu'il l'est, et un apercu qu'on modifie n'est plus un apercu.
  const [mode, setMode] = useState('edition')
  const page = pages[active]

  // Les drapeaux transmis au service d'apercu. Memorises : une nouvelle
  // reference relancerait une conversion a chaque rendu.
  const valeurs = useMemo(
    () => valeursDrapeaux(brouillon, session, synthese),
    [brouillon, session, synthese],
  )

  function majTexte(cle, valeur) {
    maj({ textes: { ...(brouillon.textes || {}), [cle]: valeur } })
  }

  function ajouterPhotos(rubrique, fichiers) {
    const neuves = Array.from(fichiers)
      .filter(f => f.type.startsWith('image/'))
      .map((f, i) => ({
        id: `${Date.now()}-${i}`,
        nom: f.name,
        apercu: URL.createObjectURL(f),
        legende: '',
      }))
    if (!neuves.length) return
    const actuelles = brouillon.photos?.[rubrique] || []
    // Le plafond suit la rubrique : cinq sur les objectifs, quatre sur
    // une journee — au-dela le modele n'a plus de disposition et les
    // images se tasseraient hors de leur cadre.
    const plafond = /^jour-\d+$/.test(rubrique) ? MAX_PHOTOS_JOUR : MAX_PHOTOS
    const retenues = [...actuelles, ...neuves].slice(0, plafond)
    maj({ photos: { ...(brouillon.photos || {}), [rubrique]: retenues } })
  }

  function retirerPhoto(rubrique, id) {
    const actuelles = brouillon.photos?.[rubrique] || []
    const cible = actuelles.find(p => p.id === id)
    if (cible?.apercu) URL.revokeObjectURL(cible.apercu)
    maj({
      photos: {
        ...(brouillon.photos || {}),
        [rubrique]: actuelles.filter(p => p.id !== id),
      },
    })
  }

  function legender(rubrique, id, texte) {
    const actuelles = brouillon.photos?.[rubrique] || []
    maj({
      photos: {
        ...(brouillon.photos || {}),
        [rubrique]: actuelles.map(p => (p.id === id ? { ...p, legende: texte } : p)),
      },
    })
  }

  function produire() {
    setEtat('production')
    const donnees = dossier(brouillon, session, synthese)
    const blob = new Blob([JSON.stringify(donnees, null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compte-rendu-${(session?.codeFormation || 'session')
      .replace(/\W+/g, '-').toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setTimeout(() => setEtat('fait'), 500)
  }

  if (etat === 'fait') {
    return (
      <div className="cr-panel">
        <div className="cr-empty">
          <div style={{ fontSize: 38, color: '#1aab5b' }} aria-hidden="true">✓</div>
          <div className="cr-empty-title">Compte rendu produit</div>
          <p className="cr-empty-text">
            Le document est dans vos téléchargements.
          </p>
        </div>
        <div className="cr-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="cr-btn cr-btn--ghost" onClick={onTerminer}>
            Retour à mes comptes rendus
          </button>
        </div>
      </div>
    )
  }

  const photos = page?.rubrique ? (brouillon.photos?.[page.rubrique] || []) : []

  return (
    <div className="cr-revue">
      {/* ── Sommaire des pages ────────────────────────────── */}
      <aside className="cr-sommaire" aria-label="Pages du rapport">
        <div className="cr-sommaire-titre">{pages.length} pages</div>
        <ol className="cr-sommaire-liste">
          {pages.map((p, i) => (
            <li key={p.cle}>
              <button type="button"
                className={`cr-sommaire-item${i === active ? ' cr-sommaire-item--on' : ''}`}
                onClick={() => setActive(i)}>
                <span className="cr-sommaire-num">{i + 1}</span>
                <span className="cr-sommaire-nom">{p.titre}</span>
                {p.rubrique && (brouillon.photos?.[p.rubrique]?.length > 0) && (
                  <span className="cr-sommaire-pastille" aria-label="photos ajoutées">
                    {brouillon.photos[p.rubrique].length}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* ── La page, telle qu'elle sortira ────────────────── */}
      <div className="cr-scene">
        <div className="cr-scene-tete">
          <span className="cr-scene-nom">{page?.titre}</span>
          <div className="cr-modes" role="tablist" aria-label="Mode d’affichage">
            {[
              ['edition', 'Édition', '✎'],
              ['apercu', 'Aperçu', '▢'],
            ].map(([cle, libelle, signe]) => (
              <button key={cle} type="button" role="tab"
                aria-selected={mode === cle}
                className={`cr-mode${mode === cle ? ' cr-mode--on' : ''}`}
                onClick={() => setMode(cle)}>
                <span aria-hidden="true">{signe}</span> {libelle}
              </button>
            ))}
          </div>
        </div>

        {mode === 'edition' ? (
          <FormulairePage
            page={page}
            textes={brouillon.textes || {}}
            onTexte={majTexte}
            objectifs={brouillon.objectifs
              || objectifsInitiaux(brouillon, page)}
            marquage={brouillon.marquageObjectifs}
            onObjectifs={v => maj({ objectifs: v })}
            onMarquage={v => maj({ marquageObjectifs: v })}
            onReordonner={v => page?.rubrique && maj({
              photos: { ...(brouillon.photos || {}), [page.rubrique]: v },
            })}
            formateurs={brouillon.formateurs || formateursInitiaux(session)}
            stagiaires={(brouillon.participants || []).filter(p => p.present !== false)}
            photoGroupe={brouillon.photoGroupe}
            onFormateurs={v => maj({ formateurs: v })}
            onPhotoGroupe={v => maj({ photoGroupe: v })}
            jours={brouillon.jours || {}}
            onJournee={(n, v) => maj({
              jours: { ...(brouillon.jours || {}), [n]: v },
            })}
            legendes={brouillon.legendes || {}}
            onLegende={(cle, v) => maj({
              legendes: { ...(brouillon.legendes || {}), [cle]: v },
            })}
            photos={photos}
            disposition={page?.rubrique
              ? brouillon.dispositions?.[page.rubrique] : null}
            onAjouter={f => page?.rubrique && ajouterPhotos(page.rubrique, f)}
            onRetirer={id => page?.rubrique && retirerPhoto(page.rubrique, id)}
            onLegender={(id, t) => page?.rubrique && legender(page.rubrique, id, t)}
            onDisposition={d => page?.rubrique && maj({
              dispositions: { ...(brouillon.dispositions || {}), [page.rubrique]: d },
            })}
          />
        ) : (
          <ApercuReel
            diapo={diapoDe(page)}
            valeurs={valeurs}
            secours={<ApercuPage page={page} textes={brouillon.textes || {}}
              photos={photos} />} />
        )}

        <div className="cr-actions">
          <button type="button" className="cr-btn cr-btn--ghost"
            onClick={() => setActive(Math.max(0, active - 1))}
            disabled={active === 0}>
            ← Page précédente
          </button>
          <div className="cr-actions-right">
            {active < pages.length - 1 ? (
              <button type="button" className="cr-btn cr-btn--ghost"
                onClick={() => setActive(active + 1)}>
                Page suivante →
              </button>
            ) : null}
            <button type="button" className="cr-btn cr-btn--primary"
              onClick={produire} disabled={etat === 'production'}>
              {etat === 'production' ? 'Production…' : 'Produire le compte rendu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Le formulaire d'une page : ce qu'elle contient, en clair.
   ───────────────────────────────────────────────────────────── */

/** Les champs de la page courante, preremplis et modifiables.
 *
 *  Chaque page du rapport a sa propre matiere : un titre partout, des
 *  paragraphes sur les pages de texte, des photos sur les pages de
 *  journee. Le formulaire n'affiche que ce que la page accepte —
 *  proposer un champ « legende » sur la couverture n'aurait pas de
 *  sens.
 *
 *  Les valeurs calculees (tableau des participants, chiffres des
 *  resultats) ne sont pas editables ici : elles viennent des etapes
 *  precedentes, et les corriger a deux endroits ferait diverger le
 *  document de ses donnees.
 */
function FormulairePage({
  page, textes, onTexte, photos, disposition,
  onAjouter, onRetirer, onLegender, onDisposition,
  objectifs, marquage, onObjectifs, onMarquage, onReordonner,
  formateurs, stagiaires, photoGroupe, onFormateurs, onPhotoGroupe,
  jours, onJournee, legendes, onLegende,
}) {
  // Une page jour porte son numero : « jour-3 » edite la 3e journee.
  const numeroJour = /^jour-(\d+)$/.exec(page?.cle || '')?.[1]
  if (!page) return null
  const valeur = (cle, defaut) => textes[`${page.cle}.${cle}`] ?? defaut

  return (
    <div className="cr-edition">
      <div className="cr-edition-champs">
        {page.cle !== 'objectifs' && page.cle !== 'participants'
          && !numeroJour && (
          <label className="cr-field">
            <span className="cr-field-label">Titre de la page</span>
            <input className="cr-input" value={valeur('titre', page.titrePage || '')}
              onChange={e => onTexte(`${page.cle}.titre`, e.target.value)} />
          </label>
        )}

        {page.type === 'couverture' && (page.periode || page.lieu) && (
          <p className="cr-vide-texte">
            La période et le lieu viennent de l’étape 1.
          </p>
        )}

        {(page.sousTitre != null || page.type === 'photos') && !numeroJour && (
          <label className="cr-field">
            <span className="cr-field-label">
              Sous-titre <span>facultatif</span>
            </span>
            <input className="cr-input" value={valeur('sousTitre', page.sousTitre || '')}
              placeholder="Une ligne de contexte sous le titre"
              onChange={e => onTexte(`${page.cle}.sousTitre`, e.target.value)} />
          </label>
        )}

        {page.cle === 'objectifs' && (
          <div className="cr-edition-large">
            <EditeurObjectifs
              objectifs={objectifs}
              marquage={marquage}
              photos={photos || []}
              disposition={disposition}
              onObjectifs={onObjectifs}
              onMarquage={onMarquage}
              onReordonner={onReordonner}
              onDisposition={onDisposition}
              onAjouter={onAjouter}
              onRetirer={onRetirer}
              onLegender={onLegender} />
          </div>
        )}

        {page.type === 'texte' && page.cle !== 'objectifs' && page.blocs.map(b => (
          <label key={b.cle} className="cr-field">
            <span className="cr-field-label">{b.titre}</span>
            <textarea className="cr-textarea" rows={3}
              value={valeur(b.cle, b.texte)}
              onChange={e => onTexte(`${page.cle}.${b.cle}`, e.target.value)} />
          </label>
        ))}

        {page.cle === 'participants' && (
          <div className="cr-edition-large">
            <EditeurParticipants
              formateurs={formateurs}
              stagiaires={stagiaires}
              photoGroupe={photoGroupe}
              onFormateurs={onFormateurs}
              onPhotoGroupe={onPhotoGroupe} />
          </div>
        )}

        {numeroJour && (
          <div className="cr-edition-large">
            <EditeurJournee
              jour={Number(numeroJour)}
              journee={jours?.[numeroJour]}
              photos={photos || []}
              disposition={disposition}
              legende={legendes?.[page.cle]}
              onJournee={v => onJournee(numeroJour, v)}
              onLegende={v => onLegende(page.cle, v)}
              onAjouter={onAjouter}
              onRetirer={onRetirer}
              onReordonner={onReordonner}
              onDisposition={onDisposition}
              onLegender={onLegender}
              jourPrecedent={Number(numeroJour) > 1
                ? jours?.[Number(numeroJour) - 1] : null}
              onCopierVeille={() => onJournee(numeroJour,
                { ...jours[Number(numeroJour) - 1] })} />
          </div>
        )}

        {page.type === 'tableau' && page.cle !== 'participants' && (
          <p className="cr-vide-texte">
            Le tableau reprend les participants de l’étape 1.
            Modifiez-les là-bas pour que le document suive.
          </p>
        )}

        {page.type === 'chiffres' && (
          <p className="cr-vide-texte">
            Ces chiffres sont calculés depuis les notes et les
            questionnaires de l’étape 2.
          </p>
        )}
      </div>

      {page.rubrique && page.cle !== 'objectifs'
        && page.cle !== 'participants' && !numeroJour && (
        <PanneauPhotos
          rubrique={page.rubrique}
          photos={photos}
          disposition={disposition}
          onAjouter={onAjouter}
          onRetirer={onRetirer}
          onLegender={onLegender}
          onDisposition={page.cle === 'objectifs' ? null : onDisposition}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   L'apercu d'une page, a l'echelle d'une diapositive 16:9.
   ───────────────────────────────────────────────────────────── */
function ApercuPage({ page, textes, photos }) {
  if (!page) return null
  // La couverture et la cloture sont centrees, sans bandeau : elles
  // encadrent le document plutot qu'elles n'en portent une rubrique.
  if (page.type === 'couverture') {
    return (
      <div className="cr-page cr-page--couverture" role="group"
        aria-label={`Aperçu — ${page.titre}`}>
        <div className="cr-couv">
          <div className="cr-couv-mention">{page.mention}</div>
          {(textes[`${page.cle}.titre`] ?? page.titrePage) && (
            <div className="cr-couv-titre">
              {textes[`${page.cle}.titre`] ?? page.titrePage}
            </div>
          )}
          {(textes[`${page.cle}.sousTitre`] ?? page.sousTitre) && (
            <div className="cr-couv-soustitre">
              {textes[`${page.cle}.sousTitre`] ?? page.sousTitre}
            </div>
          )}
          {page.periode && <div className="cr-couv-ligne">{page.periode}</div>}
          {page.lieu && <div className="cr-couv-ligne">{page.lieu}</div>}
        </div>
        <div className="cr-page-pied">CFAO ACADEMY</div>
      </div>
    )
  }

  return (
    <div className="cr-page" role="group" aria-label={`Aperçu — ${page.titre}`}>
      <div className="cr-page-bandeau" />
      <div className="cr-page-corps">
        {page.titrePage && (
          <div className="cr-page-titre">
            {textes[`${page.cle}.titre`] ?? page.titrePage}
          </div>
        )}
        {page.sousTitre && (
          <div className="cr-page-soustitre">
            {textes[`${page.cle}.sousTitre`] ?? page.sousTitre}
          </div>
        )}

        {page.type === 'tableau' && <TableauPage page={page} />}

        {page.type === 'texte' && (
          <div className="cr-page-blocs">
            {page.blocs.map(b => (
              <div key={b.cle} className="cr-page-bloc">
                <div className="cr-page-bloc-titre">{b.titre}</div>
                <div className="cr-page-bloc-texte">
                  {textes[`${page.cle}.${b.cle}`] ?? b.texte}
                </div>
              </div>
            ))}
          </div>
        )}

        {page.type === 'photos' && (
          <div className="cr-page-photos">
            {photos.length === 0 ? (
              <div className="cr-page-photos-vide">
                Aucune photo — la page restera sans illustration
              </div>
            ) : (
              photos.slice(0, 6).map(p => (
                <figure key={p.id} className="cr-page-photo">
                  <img src={p.apercu} alt={p.legende || p.nom} />
                  {p.legende && <figcaption>{p.legende}</figcaption>}
                </figure>
              ))
            )}
          </div>
        )}

        {page.type === 'chiffres' && (
          <div className="cr-page-chiffres">
            {page.chiffres.map(c => (
              <div key={c.libelle} className="cr-page-chiffre">
                <div className="cr-page-chiffre-val">{c.valeur}</div>
                <div className="cr-page-chiffre-lab">{c.libelle}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="cr-page-pied">CFAO ACADEMY</div>
    </div>
  )
}

/** Le tableau des participants, tel qu'il paraitra sur la page. */
function TableauPage({ page }) {
  return (
    <table className="cr-page-tableau">
      <thead>
        <tr>{page.colonnes.map(c => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {page.lignes.slice(0, 9).map((l, i) => (
          <tr key={i}>
            {l.map((c, j) => (
              <td key={j} className={typeof c === 'object' ? `cr-cell--${c.ton}` : undefined}>
                {typeof c === 'object' ? c.valeur : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ─────────────────────────────────────────────────────────────
   Photos et disposition, sous l'apercu de la page concernee.
   ───────────────────────────────────────────────────────────── */
function PanneauPhotos({
  rubrique, photos, disposition, onAjouter, onRetirer, onLegender, onDisposition,
}) {
  // La page des objectifs porte son propre choix de disposition, au
  // plus pres des lignes qu'il met en forme : on ne le repete pas ici.
  const reglable = Boolean(onDisposition)
  const champ = useRef(null)
  const [survol, setSurvol] = useState(false)
  const choix = dispositionsPour(photos.length)

  return (
    <div className="cr-outils">
      <div className="cr-outils-tete">Photos de cette page</div>

      <div className={`cr-drop cr-drop--compact${survol ? ' cr-drop--over' : ''}`}
        onClick={() => champ.current?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); onAjouter(e.dataTransfer.files) }}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') champ.current?.click() }}>
        <span className="cr-drop-title">Déposez vos photos</span>
        <span className="cr-drop-hint">
          {photos.length >= 5
            ? '5 photos au maximum'
            : `ou cliquez — JPG, PNG · ${5 - photos.length} restante${5 - photos.length > 1 ? 's' : ''}`}
        </span>
        <input ref={champ} type="file" accept="image/*" multiple hidden
          onChange={e => { onAjouter(e.target.files); e.target.value = '' }} />
      </div>

      {photos.length > 0 && (
        <>
          <div className="cr-vignettes">
            {photos.map((p, i) => (
              <div key={p.id} className="cr-vignette">
                <img src={p.apercu} alt="" />
                <input className="cr-photo-legend" value={p.legende}
                  placeholder="Libellé (facultatif)"
                  onChange={e => onLegender(p.id, e.target.value)}
                  aria-label={`Libellé de la photo ${i + 1}`} />
                <button type="button" className="cr-photo-del"
                  onClick={() => onRetirer(p.id)}>Retirer</button>
              </div>
            ))}
          </div>

          {reglable && choix.length > 1 && (
            <>
              <div className="cr-outils-tete" style={{ marginTop: 16 }}>
                Disposition — {photos.length} photo{photos.length > 1 ? 's' : ''}
              </div>
              <div className="cr-layouts">
                {choix.map(d => (
                  <button key={d.id} type="button"
                    className={`cr-layout${disposition === d.id ? ' cr-layout--on' : ''}`}
                    onClick={() => onDisposition(d.id)}>
                    <Vignette disposition={d} />
                    <div className="cr-layout-name">{d.nom}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Vignette({ disposition: d }) {
  if (d.colonnes) {
    return (
      <div className="cr-layout-preview cr-layout-preview--cols" aria-hidden="true">
        {d.colonnes.map((pile, ci) => (
          <div key={ci} className="cr-layout-col" style={{ flex: d.poids?.[ci] ?? 1 }}>
            {pile.map((_, li) => <div key={li} className="cr-layout-cell" />)}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="cr-layout-preview" aria-hidden="true">
      {(d.schema || []).map((ligne, li) => (
        <div key={li} className="cr-layout-row">
          {ligne.map((p, ci) => (
            <div key={ci} className="cr-layout-cell" style={{ flex: p }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Composition des pages depuis les donnees saisies.
   ───────────────────────────────────────────────────────────── */
function composerPages(b, session, s) {
  const periode = periodeLongue(b.debut, b.fin)
  const participants = (b.participants || []).filter(p => p.present !== false)
  const pages = []

  // La phase « structure » a dit ce que le document contient. Une
  // partie ecartee ne doit pas reapparaitre ici : composer puis laisser
  // retirer page a page reviendrait a ignorer ce choix.
  const retenue = id => partieRetenue(b.parties, id)

  if (retenue('couverture')) {
    // La couverture du modele : mention centree, intitule, puis periode
    // et lieu sur deux lignes, le tout au centre de la diapositive.
    pages.push({
      cle: 'couverture', titre: 'Couverture', type: 'couverture',
      mention: 'COMPTE RENDU DE FORMATION',
      titrePage: (b.intitule || '').toUpperCase(),
      sousTitre: b.codeFormation || '',
      periode,
      lieu: b.lieu || '',
    })
  }

  if (retenue('objectifs')) {
    pages.push({
      cle: 'objectifs', titre: 'Objectifs', type: 'texte',
      titrePage: 'OBJECTIFS DE LA FORMATION',
      rubrique: 'objectifs',
      blocs: [{
        cle: 'objectifs',
        titre: 'À l’issue de la formation',
        texte: b.textes?.objectifs
          || 'Les participants maîtrisent les gestes et procédures '
            + 'couverts par le module, dans le respect des standards '
            + 'du constructeur.',
      }],
    })
  }

  if (retenue('participants')) {
    pages.push({
      cle: 'participants', titre: 'Participants', type: 'tableau',
      titrePage: 'LES PARTICIPANTS',
      rubrique: 'participants',
      colonnes: ['Nom et prénom', 'Pays', 'Fonction'],
      lignes: participants.map(p => [`${p.prenom} ${p.nom}`, p.pays, p.fonction]),
    })
  }

  const jours = session ? nombreDeJours(session) : 0
  if (retenue('deroule')) {
    for (let i = 1; i <= Math.max(jours, 1); i++) {
      pages.push({
        cle: `jour-${i}`, titre: `Jour ${i}`, type: 'photos',
        titrePage: `${i}ᵉ JOUR DE FORMATION`,
        rubrique: `jour-${i}`,
        sousTitre: '',
      })
    }
  }

  if (retenue('resultats')) {
    // Les taux de satisfaction sortent des memes questionnaires que le
    // reste des resultats : ils tiennent sur la meme page, comme dans
    // le classeur ou tout figure sur une seule feuille.
    const sat = syntheseSatisfaction(b.satisfaction)
    pages.push({
      cle: 'resultats', titre: 'Résultats', type: 'chiffres',
      titrePage: 'RÉSULTAT GLOBAL DE LA SESSION',
      chiffres: [
        { libelle: 'Score moyen', valeur: afficher(s.scoreFinal) },
        {
          libelle: 'Progression',
          valeur: s.progression == null ? '—'
            : `${s.progression > 0 ? '+' : ''}${s.progression} %`,
        },
        { libelle: 'Participants', valeur: s.effectif },
        { libelle: `Sous ${SEUIL} %`, valeur: s.enRetrait },
        { libelle: 'Qualité de la formation', valeur: afficherTaux(sat.formation) },
        { libelle: 'Qualité de l’accueil', valeur: afficherTaux(sat.accueil) },
      ],
    })
  }

  if (retenue('bilan')) {
    pages.push({
      cle: 'bilan', titre: 'Bilan', type: 'texte',
      titrePage: 'BILAN DE LA FORMATION',
      rubrique: 'bilan',
      blocs: rubriquesBilan(b, s, periode),
    })
  }

  if (retenue('fiches')) {
    participants.forEach(p => {
      const c = calculer(p, b.baremes)
      pages.push({
        cle: `fiche-${p.id}`, titre: `${p.prenom} ${p.nom}`, type: 'texte',
        titrePage: `RÉSULTAT INDIVIDUEL — ${p.prenom} ${p.nom}`.toUpperCase(),
        sousTitre: `Score final ${afficher(c.scoreFinal)} · progression `
          + (c.progression == null ? '—' : `${c.progression > 0 ? '+' : ''}${c.progression} %`),
        blocs: [{
          cle: 'appreciation',
          titre: 'Appréciation du formateur',
          texte: p.appreciation || appreciationAuto(p, c),
        }],
      })
    })
  }

  if (retenue('cloture')) {
    pages.push({
      cle: 'cloture', titre: 'Clôture', type: 'couverture',
      mention: 'MERCI DE VOTRE ATTENTION',
      titrePage: '',
      sousTitre: '',
      periode: '',
      lieu: '',
    })
  }

  return pages
}

/** Les quatre rubriques du bilan, redigees depuis les chiffres. */
function rubriquesBilan(b, s, periode) {
  const lieu = b.pays ? ` au Centre CFAO ${b.pays}` : ''
  const contexte = s.effectif
    ? `La formation ${b.intitule || ''} s'est tenue ${periode}${lieu}, `
      + `avec ${s.effectif} participant${s.effectif > 1 ? 's' : ''}.`
    : ''
  const resultats = s.scoreFinal != null
    ? `Le score moyen du groupe s'établit à ${s.scoreFinal} %`
      + (s.progression != null
        ? `, pour une progression de ${s.progression > 0 ? '+' : ''}${s.progression} %.`
        : '.')
    : ''
  const vigilance = s.saisis > 0
    ? (s.enRetrait === 0
      ? 'L’ensemble des participants atteint le seuil de validation.'
      : `${s.enRetrait} participant${s.enRetrait > 1 ? 's' : ''} sur ${s.effectif} `
        + `rest${s.enRetrait > 1 ? 'ent' : 'e'} sous le seuil de ${SEUIL} %.`)
    : ''
  const suites = s.enRetrait > 0
    ? 'La reprise des modules e-learning est recommandée pour les participants en retrait.'
    : 'La mise en pratique en atelier consolidera ces acquis.'

  return [
    { cle: 'contexte', titre: 'Contexte', texte: contexte },
    { cle: 'resultats', titre: 'Résultats et acquis', texte: resultats },
    { cle: 'vigilance', titre: 'Points de vigilance', texte: vigilance },
    { cle: 'suites', titre: 'Suites à donner', texte: s.saisis > 0 ? suites : '' },
  ]
}

/** Une appreciation de depart, quand le formateur n'en a pas ecrit. */
function appreciationAuto(p, c) {
  if (c.scoreFinal == null) return ''
  const nom = p.prenom || 'Le participant'
  if (c.scoreFinal >= 90) {
    return `${nom} termine cette formation avec des résultats de premier plan `
      + `(${c.scoreFinal} %).`
  }
  if (c.scoreFinal >= SEUIL) {
    return `${nom} valide cette formation avec un score de ${c.scoreFinal} %.`
  }
  return `${nom} n'atteint pas le seuil de validation : ${c.scoreFinal} % `
    + `pour un seuil fixé à ${SEUIL} %.`
}

/** Le dossier remis au generateur. */
function dossier(b, session, s) {
  return {
    formation: b.intitule,
    code_formation: b.codeFormation,
    marque: b.marque,
    date_debut: b.debut,
    date_fin: b.fin,
    lieu: b.lieu,
    pays: b.pays,
    seuil: SEUIL,
    effectif: s.effectif,
    score_moyen: s.scoreFinal,
    progression: s.progression,
    nb_en_retrait: s.enRetrait,
    taux_reussite: s.tauxReussite,
    textes: b.textes,
    dispositions: b.dispositions,
    photos: Object.fromEntries(
      Object.entries(b.photos || {}).map(([k, v]) => [
        k, v.map(p => ({ nom: p.nom, legende: p.legende })),
      ])),
    participants: (b.participants || [])
      .filter(p => p.present !== false)
      .map(p => {
        const c = calculer(p, b.baremes)
        return {
          nom: p.nom, prenom: p.prenom, pays: p.pays, fonction: p.fonction,
          entree_brut: p.entreeBrut, sortie_theo_brut: p.sortieTheoBrut,
          sortie_prat_brut: p.sortiePratBrut,
          entree: c.entree, sortie_theorique: c.sortieTheorique,
          sortie_pratique: c.sortiePratique,
          progression: c.progression, score_final: c.scoreFinal,
          appreciation: p.appreciation || null,
        }
      }),
  }
}
