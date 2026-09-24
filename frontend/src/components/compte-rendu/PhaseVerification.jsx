import { useEffect, useMemo, useState, useRef } from 'react'
import { dispositionsPour, partieRetenue } from '../../data/mock_sessions_formateur'
import { SEUIL, calculer, afficher } from '../../utils/baremeCfao'
import { periodeLongue, nombreDeJours, titreDeCouverture }
  from '../../utils/compteRendu'
import { syntheseSatisfaction, satisfactionStagiaire, afficherTaux, detailParCritere,
  CRITERES_FORMATION, CRITERES_ACCUEIL } from '../../utils/satisfactionCfao'
import ApercuReel from './ApercuReel'
import EditeurObjectifs from './EditeurObjectifs'
import EditeurParticipants from './EditeurParticipants'
import EditeurJournee, { MAX_PHOTOS_JOUR } from './EditeurJournee'
import EditeurBilan from './EditeurBilan'
import { diapoDe, valeursDrapeaux } from '../../utils/diapositives'
import { useRefsPhotos, ancrerPhotos } from '../../utils/photosService'
import { participantPourMoteur, proposerTexte } from '../../utils/redaction'
import { chiffresSession, constatsParDefaut, donneesSession, redigerRemarque, rubriquesBilan }
  from '../../utils/remarquesSession'
import BoutonsRedaction from './BoutonsRedaction'

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
  // Toutes les images a transmettre au service : celles des rubriques,
  // les portraits des formateurs et la photo de groupe.
  const aTransmettre = useMemo(() => ({
    ...(brouillon.photos || {}),
    portraits: (brouillon.formateurs || []).map(f => f.portrait).filter(Boolean),
    groupe: brouillon.photoGroupe ? [brouillon.photoGroupe] : [],
  }), [brouillon.photos, brouillon.formateurs, brouillon.photoGroupe])
  const refsPhotos = useRefsPhotos(aTransmettre)

  // Chaque photo envoyee garde son identifiant serveur dans le brouillon :
  // elle est enregistree avec lui, et se retrouve sur un autre poste.
  useEffect(() => {
    if (!ancrerPhotos(brouillon, refsPhotos)) return
    maj(b => ancrerPhotos(b, refsPhotos) || {})
  // `maj` change a chaque rendu ; seul l'etat des photos compte ici.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refsPhotos, brouillon])
  const valeurs = useMemo(
    () => valeursDrapeaux(brouillon, session, synthese, page, refsPhotos),
    [brouillon, session, synthese, page, refsPhotos],
  )

  function majTexte(cle, valeur) {
    maj({ textes: { ...(brouillon.textes || {}), [cle]: valeur } })
  }

  // La redaction assistee des remarques de session. Chaque proposition
  // garde le texte qu'elle remplace, pour que « Annuler » le rende.
  const [redigeant, setRedigeant] = useState(null)
  const [avant, setAvant] = useState({})
  const [panne, setPanne] = useState(false)

  async function rediger(type, cles, rubrique) {
    setRedigeant(rubrique ? `bilan.${rubrique}` : type)
    setPanne(false)
    const sortie = await redigerRemarque(type, donneesSession(brouillon, session), rubrique)
    setRedigeant(null)
    if (!sortie) { setPanne(true); return }
    const textes = brouillon.textes || {}
    const nouveaux = type === 'bilan'
      ? Object.fromEntries(cles.map(k => [k, sortie[k.slice('bilan.'.length)] ?? textes[k]]))
      : { [cles[0]]: sortie }
    const defauts = {
      ...Object.fromEntries(rubriquesBilan(brouillon).map(r => [`bilan.${r.cle}`, r.texte])),
    }
    setAvant(a => ({
      ...a,
      ...Object.fromEntries(Object.keys(nouveaux).map(k => [k, textes[k] ?? defauts[k] ?? ''])),
    }))
    maj({ textes: { ...textes, ...nouveaux } })
  }

  // Premiere redaction : chaque texte que le moteur sait ecrire recoit
  // une proposition des l'arrivee a l'edition, au lieu d'une phrase de
  // gabarit sans rapport avec les chiffres. Seuls les champs jamais
  // renseignes sont concernes — un texte ecrit, ou vide a dessein,
  // n'est pas touche — et ce qui est saisi pendant la redaction garde
  // la priorite.
  const premiere = useRef(false)
  useEffect(() => {
    if (premiere.current) return
    premiere.current = true
    const t = brouillon.textes || {}
    const absent = k => t[k] === undefined
    const donnees = donneesSession(brouillon, session)
    const travaux = []
    ;(brouillon.participants || []).filter(p => p.present !== false).forEach(p => {
      const k = `fiche-${p.id}.appreciation`
      const c = calculer(p, brouillon.baremes)
      if (!absent(k) || p.appreciation || !chiffresSuffisants(c)) return
      const propre = satisfactionStagiaire(brouillon.satisfaction?.[p.id] || {})
      travaux.push(proposerTexte(participantPourMoteur(p, c, propre?.formation, propre?.accueil),
        'accueil').then(texte => (texte ? { [k]: texte } : {})))
    })
    ;[['resultats.commentaireProgression', 'progression'],
      ['resultats.commentaireAcquisition', 'acquisition']].forEach(([k, type]) => {
      if (absent(k)) {
        travaux.push(redigerRemarque(type, donnees)
          .then(texte => (texte ? { [k]: texte } : {})))
      }
    })
    const rubriques = ['contexte', 'resultats', 'vigilance', 'suites']
    if (rubriques.some(r => absent(`bilan.${r}`))) {
      travaux.push(redigerRemarque('bilan', donnees).then(sortie => Object.fromEntries(
        rubriques.filter(r => absent(`bilan.${r}`) && sortie?.[r])
          .map(r => [`bilan.${r}`, sortie[r]]))))
    }
    if (!travaux.length) return
    Promise.all(travaux).then(parts => {
      const nouveaux = Object.assign({}, ...parts)
      if (!Object.keys(nouveaux).length) return
      maj(b => ({ textes: { ...nouveaux, ...(b.textes || {}) } }))
    })
  // Une seule fois, a l'arrivee dans l'edition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const redaction = {
    redigeant, panne, avant,
    chiffres: chiffresSession(brouillon),
    defauts: constatsParDefaut(brouillon),
    constat: cle => rediger(
      cle === 'commentaireProgression' ? 'progression' : 'acquisition', [`resultats.${cle}`]),
    bilan: rubrique => rediger('bilan', [`bilan.${rubrique}`], rubrique),
    annuler: cle => {
      majTexte(cle, avant[cle])
      setAvant(a => { const suite = { ...a }; delete suite[cle]; return suite })
    },
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

  function majPhoto(rubrique, id, patch) {
    const actuelles = brouillon.photos?.[rubrique] || []
    maj({
      photos: {
        ...(brouillon.photos || {}),
        [rubrique]: actuelles.map(p => (p.id === id ? { ...p, ...patch } : p)),
      },
    })
  }

  function legender(rubrique, id, texte) {
    majPhoto(rubrique, id, { legende: texte })
  }

  // La partie de l'image montree dans sa case, en pourcentages.
  function cadrer(rubrique, id, cadrage) {
    majPhoto(rubrique, id, { cadrage })
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
        <div className="cr-fil">
          {jalonner(pages).map(section => (
            <div key={section.cle} className="cr-fil-section">
              <h3 className="cr-fil-jalon">
                <span className="cr-fil-point" aria-hidden="true" />
                {section.titre}
              </h3>
              <ol className="cr-fil-pages">
                {section.pages.map(({ page: p, index: i }) => (
                  <li key={p.cle}>
                    <button type="button"
                      className={`cr-fil-page${i === active ? ' cr-fil-page--on' : ''}`}
                      aria-current={i === active ? 'page' : undefined}
                      onClick={() => setActive(i)}>
                      <span className="cr-fil-num">{i + 1}</span>
                      <span className="cr-fil-nom">{p.titre}</span>
                      {p.rubrique && (brouillon.photos?.[p.rubrique]?.length > 0) && (
                        <span className="cr-sommaire-pastille" aria-label="photos ajoutées">
                          {brouillon.photos[p.rubrique].length}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
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
            objectifs={brouillon.objectifs ?? objectifsInitiaux(brouillon, page)}
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
            redaction={redaction}
            onProposer={async (pg, cle) => {
              const k = `${pg.cle}.${cle}`
              const reponses = brouillon.satisfaction?.[pg.participant.id]
              const propre = satisfactionStagiaire(reponses || {})
              setRedigeant(k)
              setPanne(false)
              const texte = await proposerTexte(
                participantPourMoteur(pg.participant, pg.calcul,
                  propre?.formation, propre?.accueil), 'accueil')
              setRedigeant(null)
              if (!texte) { setPanne(true); return }
              const textes = brouillon.textes || {}
              setAvant(a => ({ ...a, [k]: textes[k] ?? '' }))
              majTexte(k, texte)
            }}
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
            onCadrer={(id, c) => page?.rubrique && cadrer(page.rubrique, id, c)}
            onDisposition={d => page?.rubrique && maj({
              dispositions: { ...(brouillon.dispositions || {}), [page.rubrique]: d },
            })}
          />
        ) : (
          <ApercuReel
            diapo={diapoDe(page, brouillon)}
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
/**
 * Les deux commentaires libres de la page des resultats.
 *
 * Le modele les pose sous chaque graphique de la diapositive 17 :
 * `Rectangle 21` sous le taux de progression, `Rectangle 30` sous le
 * taux d'acquisition. Les textes d'invite reprennent les tournures du
 * modele, que le formateur adapte.
 */
const COMMENTAIRES_RESULTATS = [
  {
    cle: 'commentaireProgression',
    titre: 'Remarque sur la progression',
    exemple: 'Votre constat sur la progression du groupe',
  },
  {
    cle: 'commentaireAcquisition',
    titre: 'Remarque sur l’acquisition des compétences',
    exemple: 'Votre constat sur les compétences acquises',
  },
]

/**
 * Le moteur a-t-il de quoi rediger ?
 *
 * Il n'invente rien : chaque champ absent retire simplement le
 * mouvement de phrase qui en depend. Sans note, il ne resterait qu'une
 * formule d'accueil, et la proposition serait plus pauvre qu'une
 * saisie. On exige donc le score final et la progression.
 */
function chiffresSuffisants(calcul) {
  return calcul?.scoreFinal != null && calcul?.progression != null
}

/** Les tableaux de chiffres d'une page, tels que le modele les pose. */
/**
 * Les pages regroupees par grande partie du document.
 *
 * Le rapport a ses diapositives de titre — « Detail journalier »,
 * « Resultat individuel » — qui ouvrent chaque partie. Le sommaire les
 * reprend comme jalons pour qu'on se repere autrement qu'en comptant.
 */
function jalonner(pages) {
  const partie = p => {
    const cle = p.cle || ''
    if (cle.startsWith('jour-')) return ['deroule', 'Déroulé journalier']
    if (cle.startsWith('fiche-')) return ['fiches', 'Résultats individuels']
    if (cle === 'resultats' || cle === 'satisfaction' || cle === 'bilan') {
      return ['bilan', 'Résultats et bilan']
    }
    if (cle === 'cloture') return ['cloture', 'Clôture']
    return ['ouverture', 'Présentation']
  }
  const sections = []
  pages.forEach((page, index) => {
    const [cle, titre] = partie(page)
    const derniere = sections[sections.length - 1]
    if (derniere && derniere.cle === cle) derniere.pages.push({ page, index })
    else sections.push({ cle, titre, pages: [{ page, index }] })
  })
  return sections
}

function TableauxResultats({ tableaux, compact }) {
  if (!tableaux?.length) return null
  return (
    <div className={`cr-res-tableaux${compact ? ' cr-fiche-tableaux' : ''}`}>
      {tableaux.map(t => (
        <table key={t.titre} className="cr-res-tableau">
          <caption>{t.titre}</caption>
          <tbody>
            {t.lignes.map(l => (
              <tr key={l.libelle}
                className={l.total ? 'cr-res-total' : undefined}>
                <th scope="row">{l.libelle}</th>
                <td>{l.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

function FormulairePage({
  page, textes, onTexte, photos, disposition,
  onAjouter, onRetirer, onLegender, onCadrer, onDisposition,
  objectifs, marquage, onObjectifs, onMarquage, onReordonner,
  formateurs, stagiaires, photoGroupe, onFormateurs, onPhotoGroupe,
  jours, onJournee, legendes, onLegende, onProposer, redaction,
}) {
  // Une page jour porte son numero : « jour-3 » edite la 3e journee.
  const numeroJour = /^jour-(\d+)$/.exec(page?.cle || '')?.[1]
  if (!page) return null
  const valeur = (cle, defaut) => textes[`${page.cle}.${cle}`] ?? defaut

  return (
    <div className="cr-edition">
      <div className="cr-edition-champs">
        {page.titreLibre && (
          <label className="cr-field">
            <span className="cr-field-label">Titre de la page</span>
            <input className="cr-input" value={valeur('titre', page.titrePage || '')}
              onChange={e => onTexte(`${page.cle}.titre`, e.target.value)} />
          </label>
        )}

        {/* La couverture est pre-remplie depuis l'etape 1, mais rien
            n'y est fige : le titre porte le code, et le formateur
            reecrit ce qu'il veut sans revenir en arriere. */}
        {page.type === 'couverture' && (page.periode || page.lieu) && (
          <div className="cr-couv-saisie cr-edition-large">
            {/* Le code et l'intitule restent deux champs, comme a
                l'etape 1 : le titre de couverture les assemble, mais
                les fondre ici ferait perdre le code au reste du
                document, qui s'en sert pour nommer la session. */}
            <div className="cr-form cr-form--couv">
              <div className="cr-form-ligne cr-form-ligne--code-intitule">
                <label className="cr-field">
                  <span className="cr-field-label">Code</span>
                  <input className="cr-input"
                    value={valeur('code', page.code || '')}
                    placeholder="TS05-G3"
                    onChange={e => onTexte(`${page.cle}.code`, e.target.value)} />
                </label>
                <label className="cr-field">
                  <span className="cr-field-label">Intitulé de la formation</span>
                  <input className="cr-input"
                    value={valeur('intitule', page.intitule || '')}
                    placeholder="Révision et réparation des organes châssis"
                    onChange={e => onTexte(`${page.cle}.intitule`, e.target.value)} />
                </label>
              </div>

              <div className="cr-form-ligne cr-form-ligne--trois">
                <label className="cr-field">
                  <span className="cr-field-label">Période</span>
                  <input className="cr-input"
                    value={valeur('periode', page.periode || '')}
                    placeholder="du 14 au 18 septembre 2026"
                    onChange={e => onTexte(`${page.cle}.periode`, e.target.value)} />
                </label>
                <label className="cr-field">
                  <span className="cr-field-label">Lieu</span>
                  <input className="cr-input"
                    value={valeur('lieu', page.lieu || '')}
                    placeholder="Centre CFAO Academy — Douala"
                    onChange={e => onTexte(`${page.cle}.lieu`, e.target.value)} />
                </label>
                <label className="cr-field">
                  <span className="cr-field-label">
                    Sous-titre{' '}
                    <span className="cr-obj-facultatif">facultatif</span>
                  </span>
                  <input className="cr-input"
                    value={valeur('sousTitre', page.sousTitre || '')}
                    placeholder="Rien à préciser"
                    onChange={e => onTexte(`${page.cle}.sousTitre`, e.target.value)} />
                </label>
              </div>
            </div>

            {/* Le titre ne se saisit pas : on le montre tel qu'il
                sortira, pour que le lien entre les deux champs et la
                couverture soit visible. */}
            <div className="cr-couv-rendu">
              <span className="cr-field-label">Titre de la couverture</span>
              <p className="cr-couv-apercu">
                {titreDeCouverture(
                  valeur('code', page.code || ''),
                  valeur('intitule', page.intitule || ''),
                ).toUpperCase() || (
                  <span className="cr-couv-apercu--vide">
                    Renseignez le code et l’intitulé
                  </span>
                )}
              </p>
            </div>

            <span className="cr-obj-aide">
              Pré-rempli depuis l’étape 1 — à reprendre librement.
            </span>
          </div>
        )}

        {page.type === 'couverture' && !page.periode && !page.lieu && (
          <p className="cr-vide-texte">
            Cette page est fixe : elle clôt le document et n’a rien à
            remplir.
          </p>
        )}

        {page.titreLibre && (page.sousTitre != null || page.type === 'photos') && (
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
              onLegender={onLegender}
              onCadrer={onCadrer} />
          </div>
        )}

        {page.cle === 'bilan' && (
          <div className="cr-edition-large">
            <EditeurBilan
              blocs={page.blocs}
              textes={textes}
              photos={photos || []}
              disposition={disposition}
              legende={legendes?.[page.cle]}
              onTexte={onTexte}
              onLegende={v => onLegende(page.cle, v)}
              onAjouter={onAjouter}
              onRetirer={onRetirer}
              onReordonner={onReordonner}
              onDisposition={onDisposition}
              onLegender={onLegender}
              onCadrer={onCadrer}
              redaction={redaction} />
          </div>
        )}

        {page.type === 'texte' && page.cle !== 'objectifs'
          && page.cle !== 'bilan' && (
          <div className="cr-edition-large cr-res-saisie">
            <TableauxResultats tableaux={page.tableaux} compact />
            {page.blocs.map(b => (
              <label key={b.cle} className="cr-fiche-appreciation">
                <span className="cr-field-label">
                  {b.titre} <span>facultatif</span>
                  {page.participant && (
                    <BoutonsRedaction
                      aTexte={!!String(valeur(b.cle, b.texte) || '').trim()}
                      enCours={redaction?.redigeant === `${page.cle}.${b.cle}`}
                      desactive={!chiffresSuffisants(page.calcul)}
                      raison="Renseignez les notes à l’étape 2"
                      onRediger={() => onProposer?.(page, b.cle)}
                      peutAnnuler={`${page.cle}.${b.cle}` in (redaction?.avant || {})}
                      onAnnuler={() => redaction?.annuler(`${page.cle}.${b.cle}`)} />
                  )}
                </span>
                <textarea className="cr-textarea cr-res-texte"
                  value={valeur(b.cle, b.texte)}
                  onChange={e => onTexte(`${page.cle}.${b.cle}`, e.target.value)} />
              </label>
            ))}
            {page.participant && redaction?.panne && (
              <p className="cr-redac-panne">
                Le service de rédaction ne répond pas : écrivez l’appréciation, ou réessayez.
              </p>
            )}
          </div>
        )}

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
              onCadrer={onCadrer}
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

        {page.type === 'chiffres' && page.sansCommentaires && (
          <div className="cr-edition-large cr-res-saisie">
            <TableauxResultats tableaux={page.tableaux} />
            <p className="cr-obj-aide">Taux calculés à l’étape 2.</p>
          </div>
        )}

        {page.type === 'chiffres' && !page.sansCommentaires && (
          <div className="cr-edition-large cr-res-saisie">
            <TableauxResultats tableaux={page.tableaux} />
            <p className="cr-obj-aide">Taux calculés à l’étape 2.</p>
            <div className="cr-res-commentaires">
              {COMMENTAIRES_RESULTATS.map(c => {
                const cle = `${page.cle}.${c.cle}`
                const ch = redaction?.chiffres
                const possible = c.cle === 'commentaireProgression'
                  ? ch?.progression != null
                  : ch?.scoreFinal != null && ch?.saisis > 0
                const type = c.cle === 'commentaireProgression' ? 'progression' : 'acquisition'
                return (
                  <div key={c.cle} className="cr-res-commentaire">
                    <div className="cr-redac-entete">
                      <label className="cr-field-label" htmlFor={`cr-${c.cle}`}>{c.titre}</label>
                      <BoutonsRedaction
                        aTexte={!!valeur(c.cle, '').trim()}
                        enCours={redaction?.redigeant === type}
                        desactive={!possible}
                        raison="Renseignez les notes à l’étape 2"
                        onRediger={() => redaction?.constat(c.cle)}
                        peutAnnuler={cle in (redaction?.avant || {})}
                        onAnnuler={() => redaction?.annuler(cle)} />
                    </div>
                    <textarea id={`cr-${c.cle}`} className="cr-textarea cr-res-texte"
                      value={valeur(c.cle, '')}
                      placeholder={redaction?.defauts?.[c.cle] || c.exemple}
                      onChange={e => onTexte(cle, e.target.value)} />
                  </div>
                )
              })}
              {redaction?.panne && (
                <p className="cr-redac-panne">
                  Le service de rédaction ne répond pas : écrivez la remarque, ou réessayez.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {page.rubrique && page.cle !== 'objectifs' && page.cle !== 'bilan'
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
          {/* Le titre suit le code et l'intitule corriges sur la page,
              comme le fait le document. */}
          {(() => {
            const t = titreDeCouverture(
              textes[`${page.cle}.code`] ?? page.code,
              textes[`${page.cle}.intitule`] ?? page.intitule,
            ).toUpperCase() || page.titrePage
            return t ? <div className="cr-couv-titre">{t}</div> : null
          })()}
          {(textes[`${page.cle}.sousTitre`] ?? page.sousTitre) && (
            <div className="cr-couv-soustitre">
              {textes[`${page.cle}.sousTitre`] ?? page.sousTitre}
            </div>
          )}
          {(textes[`${page.cle}.periode`] ?? page.periode) && (
            <div className="cr-couv-ligne">
              {textes[`${page.cle}.periode`] ?? page.periode}
            </div>
          )}
          {(textes[`${page.cle}.lieu`] ?? page.lieu) && (
            <div className="cr-couv-ligne">
              {textes[`${page.cle}.lieu`] ?? page.lieu}
            </div>
          )}
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
      titrePage: titreDeCouverture(b.codeFormation, b.intitule).toUpperCase(),
      // Le titre de couverture assemble ces deux champs ; ils restent
      // separes a la saisie, comme a l'etape 1.
      code: b.codeFormation || '',
      intitule: b.intitule || '',
      // Le code est passe dans le titre : le sous-titre est libre.
      sousTitre: '',
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
        texte: b.textes?.objectifs || '',
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
    // Le modele consacre deux diapositives distinctes aux resultats :
    // la 17 pour la progression et l'acquisition, la 19 pour les taux
    // de satisfaction. On compose donc deux pages, pas une.
    const sat = syntheseSatisfaction(b.satisfaction)
    // Les deux tableaux de la diapositive 17, lignes comprises : ils
    // se lisent mieux ainsi que sous forme de compteurs isoles.
    const pc = v => (v == null ? '—' : `${Math.round(v)} %`)
    pages.push({
      cle: 'resultats', titre: 'Résultats', type: 'chiffres',
      titrePage: 'RÉSULTAT GLOBAL DE LA SESSION',
      tableaux: [
        {
          titre: 'Taux de progression',
          lignes: [
            { libelle: 'Test théorique d’entrée', valeur: pc(s.entree) },
            { libelle: 'Test théorique de sortie', valeur: pc(s.sortieTheorique) },
            {
              libelle: 'Taux de progression des stagiaires',
              valeur: s.progression == null ? '—'
                : `${s.progression > 0 ? '+' : ''}${Math.round(s.progression)} %`,
              total: true,
            },
          ],
        },
        {
          titre: 'Acquisition des compétences',
          lignes: [
            { libelle: 'Test théorique durant la formation', valeur: pc(s.sortieTheorique) },
            { libelle: 'Test pratique durant la formation', valeur: pc(s.sortiePratique) },
            {
              libelle: 'Taux d’acquisition des compétences',
              valeur: pc(s.scoreFinal), total: true,
            },
          ],
        },
      ],
    })
    // La satisfaction ne se saisit pas : elle sort des questionnaires
    // de l'etape 2 et la diapositive n'a aucune zone libre.
    const critere = (criteres, titre, total, valeur) => ({
      titre,
      lignes: [
        ...detailParCritere(b.satisfaction, criteres).map(c => ({
          libelle: c.libelle,
          valeur: c.moyenne == null ? '—' : `${Math.round(c.moyenne)} %`,
        })),
        { libelle: total, valeur: afficherTaux(valeur), total: true },
      ],
    })
    pages.push({
      cle: 'satisfaction', titre: 'Satisfaction', type: 'chiffres',
      titrePage: 'RÉSULTAT GLOBAL DE LA SESSION',
      sansCommentaires: true,
      tableaux: [
        critere(CRITERES_FORMATION, 'Qualité de la formation',
          'Qualité de la formation', sat.formation),
        critere(CRITERES_ACCUEIL, 'Qualité de l’accueil',
          'Qualité de l’accueil', sat.accueil),
      ],
    })
  }

  if (retenue('bilan')) {
    pages.push({
      cle: 'bilan', titre: 'Bilan', type: 'texte',
      titrePage: 'BILAN DE LA FORMATION',
      rubrique: 'bilan',
      blocs: rubriquesBilan(b),
    })
  }

  if (retenue('fiches')) {
    const pourcent = v => (v == null ? '—' : `${Math.round(v)} %`)
    const critere = (reponses, criteres, titre, total, valeur) => ({
      titre,
      lignes: [
        // Sur la fiche, on reprend l'intitule exact du classeur de la
        // diapositive 27 : c'est ce que le lecteur compare.
        ...detailParCritere(reponses, criteres).map(cr => ({
          libelle: cr.modele || cr.libelle,
          valeur: cr.moyenne == null ? '—' : `${Math.round(cr.moyenne)} %`,
        })),
        { libelle: total, valeur: afficherTaux(valeur), total: true },
      ],
    })
    participants.forEach(p => {
      const c = calculer(p, b.baremes)
      // Les reponses du seul stagiaire : la fiche est la sienne.
      const siennes = b.satisfaction?.[p.id] ? { [p.id]: b.satisfaction[p.id] } : {}
      const satPropre = syntheseSatisfaction(siennes)
      pages.push({
        cle: `fiche-${p.id}`, titre: `${p.prenom} ${p.nom}`, type: 'texte',
        participant: p, calcul: c,
        titrePage: `RÉSULTAT INDIVIDUEL — ${p.prenom} ${p.nom}`.toUpperCase(),
        sousTitre: `Score final ${afficher(c.scoreFinal)} · progression `
          + (c.progression == null ? '—' : `${c.progression > 0 ? '+' : ''}${c.progression} %`),
        blocs: [{
          cle: 'appreciation',
          titre: 'Appréciation de la formation et de l’accueil',
          texte: p.appreciation || '',
        }],
        tableaux: [
          critere(siennes, CRITERES_FORMATION, 'Qualité de la formation',
            'Qualité de la formation', satPropre.formation),
          critere(siennes, CRITERES_ACCUEIL, 'Qualité de l’accueil',
            'Qualité de l’accueil', satPropre.accueil),
          {
            titre: 'Acquisition des compétences',
            lignes: [
              { libelle: 'Test théorique durant la formation', valeur: pourcent(c.sortieTheorique) },
              { libelle: 'Test pratique durant la formation', valeur: pourcent(c.sortiePratique) },
              {
                libelle: 'Niveau d’acquisition des compétences',
                valeur: pourcent(c.scoreFinal), total: true,
              },
            ],
          },
          {
            titre: 'Taux de progression',
            lignes: [
              { libelle: 'Test théorique d’entrée', valeur: pourcent(c.entree) },
              { libelle: 'Test théorique de sortie', valeur: pourcent(c.sortieTheorique) },
              {
                libelle: 'Taux de progression',
                valeur: c.progression == null ? '—'
                  : `${c.progression > 0 ? '+' : ''}${Math.round(c.progression)} %`,
                total: true,
              },
            ],
          },
        ],
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
