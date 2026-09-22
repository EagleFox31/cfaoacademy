import { useMemo, useState, useRef } from 'react'
import { dispositionsPour } from '../../data/mock_sessions_formateur'
import { SEUIL, calculer, afficher } from '../../utils/baremeCfao'
import { periodeLongue, nombreDeJours } from '../../utils/compteRendu'

/**
 * Phase 3 — la revue du rapport.
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
export default function PhaseVerification({
  brouillon, maj, session, synthese, onTerminer,
}) {
  const pages = useMemo(
    () => composerPages(brouillon, session, synthese),
    [brouillon, session, synthese],
  )
  const [active, setActive] = useState(0)
  const [etat, setEtat] = useState('revue')
  const page = pages[active]

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
    maj({ photos: { ...(brouillon.photos || {}), [rubrique]: [...actuelles, ...neuves] } })
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
          <span className="cr-scene-aide">
            Cliquez sur un texte pour le corriger
          </span>
        </div>

        <ApercuPage page={page} textes={brouillon.textes || {}}
          onTexte={majTexte} photos={photos} />

        {page?.rubrique && (
          <PanneauPhotos
            rubrique={page.rubrique}
            photos={photos}
            disposition={brouillon.dispositions?.[page.rubrique]}
            onAjouter={f => ajouterPhotos(page.rubrique, f)}
            onRetirer={id => retirerPhoto(page.rubrique, id)}
            onLegender={(id, t) => legender(page.rubrique, id, t)}
            onDisposition={d => maj({
              dispositions: { ...(brouillon.dispositions || {}), [page.rubrique]: d },
            })}
          />
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
   L'apercu d'une page, a l'echelle d'une diapositive 16:9.
   ───────────────────────────────────────────────────────────── */
function ApercuPage({ page, textes, onTexte, photos }) {
  if (!page) return null
  return (
    <div className="cr-page" role="group" aria-label={`Aperçu — ${page.titre}`}>
      <div className="cr-page-bandeau" />
      <div className="cr-page-corps">
        {page.titrePage && (
          <TexteEditable cle={`${page.cle}.titre`} valeur={textes[`${page.cle}.titre`] ?? page.titrePage}
            onChange={onTexte} className="cr-page-titre" />
        )}
        {page.sousTitre && (
          <TexteEditable cle={`${page.cle}.sousTitre`}
            valeur={textes[`${page.cle}.sousTitre`] ?? page.sousTitre}
            onChange={onTexte} className="cr-page-soustitre" />
        )}

        {page.type === 'tableau' && <TableauPage page={page} />}

        {page.type === 'texte' && (
          <div className="cr-page-blocs">
            {page.blocs.map(b => (
              <div key={b.cle} className="cr-page-bloc">
                <div className="cr-page-bloc-titre">{b.titre}</div>
                <TexteEditable cle={`${page.cle}.${b.cle}`}
                  valeur={textes[`${page.cle}.${b.cle}`] ?? b.texte}
                  onChange={onTexte} className="cr-page-bloc-texte" multi />
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
    </div>
  )
}

/** Un texte qu'on corrige en cliquant dessus.
 *
 * L'edition se fait sur place : passer par un panneau separe couperait
 * le lien entre ce qu'on lit et ce qu'on change.
 */
function TexteEditable({ cle, valeur, onChange, className, multi }) {
  const [edite, setEdite] = useState(false)
  const champ = useRef(null)

  if (edite) {
    const Balise = multi ? 'textarea' : 'input'
    return (
      <Balise
        ref={champ}
        className={`${className} cr-editable cr-editable--actif`}
        value={valeur}
        rows={multi ? 3 : undefined}
        onChange={e => onChange(cle, e.target.value)}
        onBlur={() => setEdite(false)}
        onKeyDown={e => {
          if (e.key === 'Escape' || (e.key === 'Enter' && !multi)) e.target.blur()
        }}
        autoFocus
      />
    )
  }
  return (
    <div className={`${className} cr-editable`} role="button" tabIndex={0}
      onClick={() => setEdite(true)}
      onKeyDown={e => { if (e.key === 'Enter') setEdite(true) }}
      title="Cliquer pour corriger">
      {valeur || <span className="cr-editable-vide">Cliquer pour écrire</span>}
    </div>
  )
}

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
        <span className="cr-drop-hint">ou cliquez — JPG, PNG</span>
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

          {choix.length > 1 && (
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

  pages.push({
    cle: 'couverture', titre: 'Couverture', type: 'texte',
    titrePage: (b.intitule || 'Compte rendu de formation').toUpperCase(),
    sousTitre: [periode, b.lieu].filter(Boolean).join(' — '),
    blocs: [],
  })

  pages.push({
    cle: 'participants', titre: 'Participants', type: 'tableau',
    titrePage: 'LES PARTICIPANTS',
    rubrique: 'participants',
    colonnes: ['Nom et prénom', 'Pays', 'Fonction'],
    lignes: participants.map(p => [`${p.prenom} ${p.nom}`, p.pays, p.fonction]),
  })

  const jours = session ? nombreDeJours(session) : 0
  for (let i = 1; i <= jours; i++) {
    pages.push({
      cle: `jour-${i}`, titre: `Jour ${i}`, type: 'photos',
      titrePage: `${i}ᵉ JOUR DE FORMATION`,
      rubrique: `jour-${i}`,
      sousTitre: '',
    })
  }

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
    ],
  })

  pages.push({
    cle: 'bilan', titre: 'Bilan', type: 'texte',
    titrePage: 'BILAN DE LA FORMATION',
    rubrique: 'bilan',
    blocs: rubriquesBilan(b, s, periode),
  })

  participants.forEach((p, i) => {
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
