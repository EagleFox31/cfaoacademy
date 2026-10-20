import { useRef, useState } from 'react'
import { BAREMES, SEUIL, calculer, anomalies, afficher } from '../../utils/baremeCfao'
import {
  MENTIONS,
  CRITERES_FORMATION,
  CRITERES_ACCUEIL,
  syntheseSatisfaction,
  afficherTaux,
} from '../../utils/satisfactionCfao'
import { exporterEvaluation } from '../../utils/exportEvaluation'
import { exporterResultats } from '../../utils/exportResultats'
import { lireEvaluation, lireResultats, appliquerEvaluation } from '../../utils/importEvaluation'
import Consigne from './Consigne'
import MenuExcel from './MenuExcel'
import SaisieCertification from './SaisieCertification'
import { estCertification } from '../../utils/certification'
import {
  exporterCertification, lireCertification, appliquerCertification,
} from '../../utils/classeurCertification'

/** Un tableur, au trait, pour le bouton d'export. */
function IconeTableur() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9h17M3.5 14.5h17M9.5 9v11.5" />
    </svg>
  )
}

/** Une fleche entrant dans un plateau, pour l'import. */
function IconeImport() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
      <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

/** Le brouillon sans notes ni avis : les noms seuls, pour un modele
 *  a remplir. */
function vierge(b) {
  return {
    ...b,
    satisfaction: {},
    participants: (b.participants || []).map(p => ({
      ...p, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '', notesModules: {}, elearning: {},
    })),
  }
}

/**
 * Phase 2 — les notes brutes et la satisfaction des stagiaires.
 *
 * Le formateur saisit ce qu'il a corrige sur copie : 27 sur 30, 14 sur
 * 20. Les pourcentages, la progression et le score final se deduisent,
 * avec les formules des classeurs CFAO :
 *
 *     entree     = brut / 30        sortie theo = brut / 30
 *     pratique   = brut / 20        progression = (sortie - entree) / entree
 *     score      = moyenne(sortie theorique ; pratique)
 *
 * La progression est **relative** : passer de 50 % a 75 % fait +50 %,
 * pas +25. C'est ce qui produit les « 113 % » des comptes rendus, et
 * la colonne le rappelle pour qu'on ne le lise pas comme une erreur.
 *
 * La seconde moitie de l'ecran recueille la satisfaction, reprise du
 * classeur d'evaluation : sept criteres de qualite de formation, six
 * d'accueil, notes par mention et moyennes en taux (cf.
 * `utils/satisfactionCfao.js`).
 */
export default function PhaseResultats({
  brouillon, maj, session, synthese, onEnregistrer,
}) {
  const participants = (brouillon.participants || []).filter(p => p.present !== false)
  const baremes = brouillon.baremes || BAREMES
  // Une certification se note module par module : seul le premier volet
  // change, les deux questionnaires restent les memes.
  const certif = estCertification(brouillon)

  // Un seul volet ouvert a la fois : les trois saisies sont
  // independantes, et trois tableaux deplies obligeaient a chercher
  // celui qu'on remplit.
  const [volet, setVolet] = useState('tests')

  // Le brouillon n'est plus ecrit a chaque frappe mais au changement de
  // volet : saisir douze notes declenchait autant d'ecritures.
  function ouvrir(cle) {
    if (cle === volet) return
    onEnregistrer?.()
    setVolet(cle)
  }

  function modifier(id, champ, valeur) {
    // On garde la chaine vide : un champ vide et un zero ne disent pas
    // la meme chose dans un compte rendu.
    const v = valeur === '' ? '' : valeur.replace(/[^\d]/g, '').slice(0, 3)
    maj({
      participants: brouillon.participants.map(p =>
        p.id === id ? { ...p, [champ]: v } : p),
    })
  }

  const reponses = brouillon.satisfaction || {}
  const satisfaction = syntheseSatisfaction(reponses)
  const complets = criteres => participants
    .filter(p => criteres.every(c => reponses[p.id]?.[c.cle])).length
  const SECTIONS_AVIS = [
    { titre: 'Sur la formation', criteres: CRITERES_FORMATION },
    { titre: 'Sur l’accueil', criteres: CRITERES_ACCUEIL },
  ]
  const CRITERES_AVIS = [...CRITERES_FORMATION, ...CRITERES_ACCUEIL]

  function repondre(idParticipant, critere, mention) {
    maj({
      satisfaction: {
        ...reponses,
        [idParticipant]: { ...reponses[idParticipant], [critere]: mention },
      },
    })
  }

  // En certification, deux classeurs, comme dans les dossiers G3 : les
  // resultats (notes et e-learning) et l'evaluation post-certification
  // (les avis). On enregistre l'un, l'autre ou les deux ; vierges, ce
  // sont les modeles a remplir a la main puis a reprendre ici.
  const [exportEnCours, setExportEnCours] = useState(false)
  async function exporter({ resultats = false, evaluation = false, modele = false }) {
    // Ce qui est a l'ecran part au classeur : on enregistre d'abord.
    onEnregistrer?.()
    setExportEnCours(true)
    const b = modele ? vierge(brouillon) : brouillon
    try {
      if (resultats) {
        await (certif ? exporterCertification : exporterResultats)(b, session, { modele })
      }
      if (evaluation) await exporterEvaluation(b, session, { modele })
    } finally {
      setExportEnCours(false)
    }
  }
  const menuClasseurs = modele => (certif
    ? [
      { libelle: modele ? 'Modèle des résultats' : 'Résultats',
        detail: modele ? 'Notes des modules et e-learning, à remplir' : 'Notes, e-learning et fiche de chaque candidat',
        action: () => exporter({ resultats: true, modele }) },
      { libelle: modele ? 'Modèle d’évaluation' : 'Évaluation',
        detail: modele ? 'Avis des stagiaires, à remplir' : 'Avis des stagiaires sur la formation',
        action: () => exporter({ evaluation: true, modele }) },
      { libelle: modele ? 'Les deux modèles' : 'Tout télécharger',
        detail: 'Résultats et évaluation, en deux fichiers',
        action: () => exporter({ resultats: true, evaluation: true, modele }) },
    ]
    : [
      { libelle: modele ? 'Modèle des résultats' : 'Résultats',
        detail: modele ? 'Notes des tests, à remplir' : 'Notes des tests, pourcentages et progression',
        action: () => exporter({ resultats: true, modele }) },
      { libelle: modele ? 'Modèle d’évaluation' : 'Évaluation',
        detail: modele ? 'Notes des tests et avis des stagiaires, à remplir'
          : 'Notes des tests et avis des stagiaires',
        action: () => exporter({ evaluation: true, modele }) },
      { libelle: modele ? 'Les deux modèles' : 'Tout télécharger',
        detail: 'Résultats et évaluation, en deux fichiers',
        action: () => exporter({ resultats: true, evaluation: true, modele }) },
    ])

  // L'import relit un classeur d'evaluation du meme modele — celui de
  // l'export, ou celui d'un formateur — et en reprend notes et
  // satisfaction. Il demande confirmation avant d'ecraser une note.
  const fichierImport = useRef(null)
  const [importInfo, setImportInfo] = useState(null)
  async function importer(fichier) {
    if (!fichier) return
    // En certification, le classeur des resultats ou celui de
    // l'evaluation post-certification : on reconnait le second a sa
    // feuille « Données Stagiaires ».
    let lus
    try {
      ;({ stagiaires: lus } = await lireEvaluation(fichier))
    } catch (e) {
      if (certif) return importerCertification(fichier)
      // Hors certification : le classeur « Résultats » des formateurs.
      try {
        ;({ stagiaires: lus } = await lireResultats(fichier))
      } catch {
        setImportInfo({ ok: false, texte: `Classeur non reconnu : ${e.message}` })
        return
      }
    }
    try {
      const r = appliquerEvaluation(brouillon, lus)
      if (r.remplaces && !window.confirm(
        `Le classeur remplace des notes déjà saisies pour ${r.remplaces} stagiaire`
        + `${r.remplaces > 1 ? 's' : ''}. Continuer ?`)) return
      maj({ participants: r.participants, satisfaction: r.satisfaction })
      onEnregistrer?.()
      setImportInfo({
        ok: true,
        texte: `${certif ? 'Avis de ' : ''}${lus.length} stagiaire${lus.length > 1 ? 's' : ''} repris du classeur`
          + (r.ajoutes ? ` (${r.ajoutes} ajouté${r.ajoutes > 1 ? 's' : ''} à la liste)` : ''),
      })
    } catch (e) {
      setImportInfo({ ok: false, texte: `Classeur non reconnu : ${e.message}` })
    }
  }

  async function importerCertification(fichier) {
    try {
      const lu = await lireCertification(fichier)
      const r = appliquerCertification(brouillon, lu)
      if (r.remplaces && !window.confirm(
        `Le classeur remplace des notes déjà saisies pour ${r.remplaces} candidat`
        + `${r.remplaces > 1 ? 's' : ''}. Continuer ?`)) return
      maj({ modules: r.modules, participants: r.participants })
      onEnregistrer?.()
      setImportInfo({
        ok: true,
        texte: `${lu.candidats.length} candidat${lu.candidats.length > 1 ? 's' : ''} et `
          + `${lu.modules.length} modules repris du classeur`
          + (r.ajoutes ? ` (${r.ajoutes} ajouté${r.ajoutes > 1 ? 's' : ''} à la liste)` : ''),
      })
    } catch (e) {
      setImportInfo({ ok: false, texte: `Classeur non reconnu : ${e.message}` })
    }
  }

  // Effacer des notes ou des reponses, pour un stagiaire ou pour tous.
  // Chaque effacement se rattrape : le bandeau garde l'etat d'avant et
  // son bouton « Annuler » le remet. L'effacement de tout le groupe
  // demande en plus confirmation — c'est le seul qui coute cher.
  // `reinitialiseLe` fait enregistrer le brouillon meme devenu vide :
  // sans lui, un brouillon vide n'est pas ecrit, et les anciennes notes
  // reviendraient au prochain chargement.
  const [annulable, setAnnulable] = useState(null)
  function effacer(texte, transformer) {
    setAnnulable({
      texte,
      avant: { participants: brouillon.participants, satisfaction: brouillon.satisfaction },
    })
    maj(b => ({ ...transformer(b), reinitialiseLe: new Date().toISOString() }))
  }
  function annulerEffacement() {
    if (!annulable) return
    maj(annulable.avant)
    setAnnulable(null)
  }
  const nom = p => `${p.prenom || ''} ${p.nom || ''}`.trim()
  const sansNotes = p => (certif
    ? { ...p, notesModules: {}, elearning: {} }
    : { ...p, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '' })

  /** Les notes d'un stagiaire, ou de tous (`p` absent). */
  function effacerNotes(p) {
    if (!p && !window.confirm(
      `Effacer les notes des ${participants.length} stagiaires ? `
      + 'Les questionnaires ne sont pas touchés, et vous pourrez annuler juste après.')) return
    effacer(p ? `Notes de ${nom(p)} effacées.` : 'Toutes les notes sont effacées.',
      b => ({
        participants: b.participants.map(x =>
          (p ? x.id === p.id : x.present !== false) ? sansNotes(x) : x),
      }))
  }

  /** Les reponses aux deux questionnaires, d'un stagiaire ou de tous. */
  function effacerReponses(p) {
    if (!p && !window.confirm(
      'Effacer toutes les réponses aux questionnaires sur la formation et sur l’accueil ? '
      + 'Vous pourrez annuler juste après.')) return
    const cles = new Set(CRITERES_AVIS.map(c => c.cle))
    effacer(p ? `Réponses de ${nom(p)} effacées.`
      : 'Toutes les réponses aux questionnaires effacées.',
    b => ({
      satisfaction: Object.fromEntries(Object.entries(b.satisfaction || {}).map(([id, r]) => [
        id,
        !p || String(id) === String(p.id)
          ? Object.fromEntries(Object.entries(r || {}).filter(([k]) => !cles.has(k)))
          : r,
      ])),
    }))
  }

  const aDesNotes = certif
    ? participants.some(p => Object.values(p.notesModules || {}).some(v => String(v ?? '').trim())
      || Object.values(p.elearning || {}).some(v => String(v ?? '').trim()))
    : participants.some(p => [p.entreeBrut, p.sortieTheoBrut, p.sortiePratBrut]
      .some(v => String(v ?? '').trim()))
  const aDesReponses = criteres => participants.some(p =>
    criteres.some(c => reponses[p.id]?.[c.cle]))

  function majBareme(cle, valeur) {
    const n = Number(valeur)
    maj({ baremes: { ...baremes, [cle]: Number.isNaN(n) || n <= 0 ? 1 : n } })
  }

  return (
    <div className="cr-panel cr-panel--resultats">
      {/* L'en-tete reste en haut pendant qu'on remplit : deux lignes, et
          l'export a droite, la ou l'on cherche une action de la page. */}
      <Consigne className="cr-panel-head cr-panel-head--fige"
        faire={volet === 'tests'
          ? (certif ? 'Saisissez la note de chaque module, pour chaque candidat.'
            : 'Saisissez les notes de chaque stagiaire.')
          : 'Cliquez sur la réponse de chaque stagiaire, question par question.'}
        ensuite={volet === 'tests'
          ? (certif
            ? 'Puis : l’e-learning, sous les notes, et les avis des stagiaires. Ensuite : le choix des pages.'
            : 'Puis : les avis des stagiaires, juste en dessous. Ensuite : le choix des pages.')
          : 'La formation puis l’accueil, dans le même tableau. Ensuite : le choix des pages.'}>
        <div className="cr-export-groupe">
          <MenuExcel className="cr-import" icone={<IconeImport />} libelle="Reprendre d’un fichier Excel"
            disabled={exportEnCours}
            choix={[
              { libelle: 'Importer un fichier Excel',
                detail: 'Résultats ou évaluation, reconnu automatiquement',
                action: () => fichierImport.current?.click() },
              // Le modele porte deja les noms : il faut une liste.
              ...(participants.length
                ? [{ groupe: 'Télécharger un modèle vide' }, ...menuClasseurs(true)] : []),
            ]} />
          <input ref={fichierImport} type="file" hidden
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={e => { importer(e.target.files?.[0]); e.target.value = '' }} />
          <MenuExcel icone={<IconeTableur />}
            libelle={exportEnCours ? 'Enregistrement…' : 'Enregistrer en Excel'}
            disabled={!participants.length || exportEnCours}
            choix={menuClasseurs(false)} />
        </div>
      </Consigne>
      {annulable && (
        <p className="cr-import-info cr-annulable" role="status">
          {annulable.texte}
          <button type="button" className="cr-annuler" onClick={annulerEffacement}>Annuler</button>
          <button type="button" className="cr-import-fermer" aria-label="Masquer"
            onClick={() => setAnnulable(null)}>×</button>
        </p>
      )}
      {importInfo && (
        <p className={`cr-import-info${importInfo.ok ? '' : ' cr-import-info--ko'}`} role="status">
          {importInfo.texte}
          <button type="button" className="cr-import-fermer" aria-label="Masquer"
            onClick={() => setImportInfo(null)}>×</button>
        </p>
      )}

      <div className="cr-blocs">
        {certif ? (
          <Bloc titre="1. Notes des modules"
            resume={`${synthese.saisis}/${synthese.effectif} candidats`}
            valeur={afficher(synthese.scoreFinal)}
            ton={synthese.scoreFinal == null ? null
              : synthese.scoreFinal >= SEUIL ? 'ok' : 'ko'}
            ouvert={volet === 'tests'} onOuvrir={() => ouvrir('tests')}>
            <OutilsVolet>
              <BoutonEffacer disabled={!aDesNotes} onClick={() => effacerNotes(null)}>
                Effacer toutes les notes
              </BoutonEffacer>
            </OutilsVolet>
            <SaisieCertification brouillon={brouillon} maj={maj} onEffacer={effacerNotes} />
            {synthese.saisis > 0 && (
              <div className="cr-kpis" style={{ marginTop: 20 }}>
                <Indicateur valeur={afficher(synthese.scoreFinal)} legende="Moyenne du groupe" />
                <Indicateur valeur={`${synthese.reussis}/${synthese.saisis}`}
                  legende={`Pratique validée (${SEUIL} %)`}
                  ton={synthese.enRetrait === 0 ? 'ok' : 'ko'} />
                <Indicateur valeur={synthese.certifies} legende="Certifiés" />
                <Indicateur valeur={`${synthese.saisis}/${synthese.effectif}`}
                  legende="Notes complètes" />
              </div>
            )}
            <SuiteVolet onClick={() => ouvrir('avis')}>
              Passer aux avis des stagiaires
            </SuiteVolet>
          </Bloc>
        ) : (
        <Bloc titre="1. Notes des tests"
          resume={`${synthese.saisis}/${synthese.effectif} stagiaires`}
          valeur={afficher(synthese.scoreFinal)}
          ton={synthese.scoreFinal == null ? null
            : synthese.scoreFinal >= SEUIL ? 'ok' : 'ko'}
          ouvert={volet === 'tests'} onOuvrir={() => ouvrir('tests')}>
          <div className="cr-baremes">
            <span className="cr-baremes-label">Notés sur</span>
            {[
              ['entreeTheorique', 'Test d’entrée'],
              ['sortieTheorique', 'Théorie finale'],
              ['sortiePratique', 'Pratique'],
            ].map(([cle, libelle]) => (
              <label key={cle} className="cr-bareme">
                {libelle}
                <input className="cr-num cr-num--court" type="number"
                  min="1" max="200" inputMode="numeric"
                  value={baremes[cle]} onChange={e => majBareme(cle, e.target.value)}
                  aria-label={`Barème ${libelle}`} />
              </label>
            ))}
            <BoutonEffacer disabled={!aDesNotes} onClick={() => effacerNotes(null)}>
              Effacer toutes les notes
            </BoutonEffacer>
          </div>

          {/* L'en-tete reste visible pendant qu'on descend dans la liste :
              au huitieme stagiaire, on ne sait plus quelle colonne est la
              theorie. Les largeurs sont fixes pour que les notes restent
              alignees quelle que soit la longueur des noms. */}
          <div className="cr-table-wrap cr-table-wrap--fige">
            <table className="cr-table cr-table--notes">
              <colgroup>
                <col />
                <col style={{ width: 104 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 104 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 44 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Stagiaire</th>
                  <th>Test d’entrée<small>sur {baremes.entreeTheorique}</small></th>
                  <th>Théorie finale<small>sur {baremes.sortieTheorique}</small></th>
                  <th>Pratique<small>sur {baremes.sortiePratique}</small></th>
                  <th>Progrès<small>calculé</small></th>
                  <th>Note finale<small>calculée</small></th>
                  <th aria-label="Effacer" />
                </tr>
              </thead>
              <tbody>
                {participants.map(p => {
                  const c = calculer(p, baremes)
                  const faits = anomalies(p, baremes)
                  const erreurs = new Set(faits.filter(f => f.niveau === 'erreur').map(f => f.champ))
                  // La couleur signale deja l'ecart ; le motif reste au survol.
                  const avertis = faits.filter(f => f.niveau === 'avertissement')
                    .map(f => f.message).join(' ')

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cr-name">
                          {p.prenom} {p.nom}
                          <small>{p.pays}</small>
                        </div>
                      </td>
                      {[
                        ['entreeBrut', 'entrée', 'entreeTheorique'],
                        ['sortieTheoBrut', 'théorie', 'sortieTheorique'],
                        ['sortiePratBrut', 'pratique', 'sortiePratique'],
                      ].map(([champ, nom, bareme]) => (
                        <td key={champ}>
                          <input
                            className={`cr-num${erreurs.has(champ) ? ' cr-num--erreur' : ''}`}
                            type="number" min="0" max={baremes[bareme]}
                            inputMode="numeric" value={p[champ] ?? ''}
                            onChange={e => modifier(p.id, champ, e.target.value)}
                            placeholder="—"
                            aria-label={`Note ${nom} de ${p.prenom} ${p.nom}`} />
                        </td>
                      ))}
                      <td>
                        <span className={`cr-calc${c.progression == null ? ' cr-calc--vide'
                          : c.progression > 0 ? ' cr-calc--ok'
                            : c.progression < 0 ? ' cr-calc--ko' : ''}`}>
                          {c.progression == null ? '—'
                            : `${c.progression > 0 ? '+' : ''}${c.progression} %`}
                        </span>
                      </td>
                      <td>
                        <span className={`cr-calc${c.scoreFinal == null ? ' cr-calc--vide'
                          : c.scoreFinal >= SEUIL ? ' cr-calc--ok' : ' cr-calc--ko'}`}
                          title={avertis || undefined}>
                          {afficher(c.scoreFinal)}
                        </span>
                      </td>
                      <td>
                        {[p.entreeBrut, p.sortieTheoBrut, p.sortiePratBrut].some(v => String(v ?? '').trim()) && (
                          <button type="button" className="cr-effacer-un"
                            onClick={() => effacerNotes(p)}
                            title={`Effacer les notes de ${nom(p)}`}
                            aria-label={`Effacer les notes de ${nom(p)}`}>↺</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {synthese.saisis > 0 && (
            <div className="cr-kpis" style={{ marginTop: 20 }}>
              <Indicateur valeur={afficher(synthese.scoreFinal)} legende="Note finale moyenne" />
              <Indicateur
                valeur={synthese.progression == null ? '—'
                  : `${synthese.progression > 0 ? '+' : ''}${synthese.progression} %`}
                legende="Progrès moyen" />
              <Indicateur valeur={synthese.enRetrait}
                legende={`Sous le seuil de ${SEUIL} %`}
                ton={synthese.enRetrait === 0 ? 'ok' : 'ko'} />
              <Indicateur valeur={`${synthese.saisis}/${synthese.effectif}`}
                legende="Notes saisies" />
            </div>
          )}
          <SuiteVolet onClick={() => ouvrir('avis')}>
            Passer aux avis des stagiaires
          </SuiteVolet>
        </Bloc>
        )}

        <Bloc titre="2. Avis des stagiaires"
          resume={`${complets(CRITERES_AVIS)}/${participants.length} stagiaires`}
          valeurs={[
            ['Formation', satisfaction.formation],
            ['Accueil', satisfaction.accueil],
          ].map(([libelle, taux]) => ({
            libelle,
            valeur: afficherTaux(taux),
            ton: taux == null ? null : taux >= 75 ? 'ok' : null,
          }))}
          ouvert={volet === 'avis'} onOuvrir={() => ouvrir('avis')}>
          <GrilleCriteres sections={SECTIONS_AVIS}
            participants={participants} reponses={reponses}
            onRepondre={repondre}
            actions={(
              <BoutonEffacer disabled={!aDesReponses(CRITERES_AVIS)}
                onClick={() => effacerReponses(null)}>
                Effacer toutes les réponses
              </BoutonEffacer>
            )} />
        </Bloc>
      </div>
    </div>
  )
}

/** Le passage au volet suivant, la ou l'on arrive en finissant celui-ci. */
function SuiteVolet({ onClick, children }) {
  return (
    <div className="cr-suite-volet">
      <button type="button" className="cr-btn cr-btn--ghost" onClick={onClick}>
        {children} ↓
      </button>
    </div>
  )
}

/** Les actions d'un volet, alignees a droite au-dessus de son tableau. */
function OutilsVolet({ children }) {
  return <div className="cr-volet-outils">{children}</div>
}

function BoutonEffacer({ disabled, onClick, children }) {
  return (
    <button type="button" className="cr-btn cr-btn--ghost cr-btn--petit cr-effacer"
      disabled={disabled} onClick={onClick}
      title={disabled ? 'Rien à effacer' : undefined}>
      ↺ {children}
    </button>
  )
}

function Indicateur({ valeur, legende, ton }) {
  return (
    <div className="cr-kpi">
      <div className={`cr-kpi-val${ton ? ` cr-kpi-val--${ton}` : ''}`}>{valeur}</div>
      <div className="cr-kpi-lab">{legende}</div>
    </div>
  )
}

/** Un volet depliable, ouvert ou non selon le parent.
 *
 *  L'en-tete porte l'indicateur du volet : replie, il dit deja ou en
 *  est la saisie. Un seul volet est ouvert a la fois — les trois
 *  chiffres restent lisibles en permanence dans les en-tetes.
 */
function Bloc({ titre, resume, valeur, ton, valeurs, ouvert, onOuvrir, children }) {
  return (
    <div className={`cr-bloc${ouvert ? ' cr-bloc--ouvert' : ''}`}>
      <h3 className="cr-bloc-titre">
        <button type="button" className="cr-bloc-bouton"
          aria-expanded={ouvert} onClick={onOuvrir}>
          <span className="cr-bloc-fleche" aria-hidden="true">▸</span>
          <span className="cr-bloc-nom">{titre}</span>
          <span className="cr-bloc-resume">{resume}</span>
          {(valeurs || [{ valeur, ton }]).map((v, i) => (
            <span key={i} className={`cr-calc${v.ton ? ` cr-calc--${v.ton}` : ' cr-calc--vide'}`}>
              {v.libelle && <small className="cr-calc-libelle">{v.libelle}</small>}
              {v.valeur}
            </span>
          ))}
        </button>
      </h3>
      {ouvert && <div className="cr-bloc-corps">{children}</div>}
    </div>
  )
}

/** Le trace de chaque mention, au trait.
 *
 *  Des formes nettement differentes plutot qu'une gradation de visages :
 *  cinq sourires voisins se confondent au clic, une etoile et une croix
 *  jamais. Pas d'emoji, dont le rendu change d'un poste a l'autre. Au
 *  repos les icones sont au trait et sans couleur ; la mention retenue
 *  prend la sienne, du vert au rouge, pour lire la grille d'un coup.
 */
const TRACES = {
  tres_satisfaisant: (
    <path d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.72l-5.12 2.69.98-5.72L3.7 9.64l5.75-.84z" />
  ),
  satisfaisant: (
    <>
      <path d="M7.5 10.5V20" />
      <path d="M14.6 6.2 14 10.5h4.9a1.8 1.8 0 0 1 1.75 2.2l-1.45 6A1.8 1.8 0 0 1 17.45 20H5.3a1.3 1.3 0 0 1-1.3-1.3v-6.9a1.3 1.3 0 0 1 1.3-1.3h2.2L10.9 4a1.9 1.9 0 0 1 3.7 2.2z" />
    </>
  ),
  moyen: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.2 12h7.6" />
    </>
  ),
  peu_satisfaisant: (
    <>
      <path d="M16.5 13.5V4" />
      <path d="M9.4 17.8 10 13.5H5.1a1.8 1.8 0 0 1-1.75-2.2l1.45-6A1.8 1.8 0 0 1 6.55 4H18.7a1.3 1.3 0 0 1 1.3 1.3v6.9a1.3 1.3 0 0 1-1.3 1.3h-2.2L13.1 20a1.9 1.9 0 0 1-3.7-2.2z" />
    </>
  ),
  insatisfaisant: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
}

function IconeMention({ cle }) {
  return (
    <svg className="cr-mention-icone" viewBox="0 0 24 24" width="18" height="18"
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRACES[cle]}
    </svg>
  )
}

/** Une grille de criteres : une ligne par critere, une colonne par
 *  stagiaire, les criteres groupes par questionnaire.
 *
 *  Les deux questionnaires tiennent dans un seul tableau : les noms ne
 *  se relisent qu'une fois, et un bandeau sur toute la largeur marque
 *  le passage de la formation a l'accueil.
 *
 *  Les criteres restent figes a gauche et les noms en tete : on fait
 *  defiler les stagiaires sans perdre de vue ni la question ni la
 *  personne. Chaque case offre les cinq mentions en icones ; un second
 *  clic sur la mention retenue l'efface.
 */
function GrilleCriteres({ sections, participants, reponses, onRepondre, actions }) {
  return (
    <div className="cr-satisfaction">
      <div className="cr-satis-barre">
        <ul className="cr-mentions-legende" aria-label="Mentions">
          {MENTIONS.map(m => (
            <li key={m.cle} className={`cr-mention--${m.cle}`}>
              <IconeMention cle={m.cle} />
              {m.libelle}
            </li>
          ))}
        </ul>
        {actions}
      </div>

      <div className="cr-satis-wrap">
        <table className="cr-satis-table">
          <colgroup>
            <col className="cr-satis-col-critere" />
            {participants.map(p => <col key={p.id} className="cr-satis-col" />)}
          </colgroup>
          <thead>
            <tr>
              <th className="cr-satis-coin" scope="col">Question</th>
              {/* Le nom seul : l'avancement se lit dans les bandeaux. */}
              {participants.map(p => (
                <th key={p.id} scope="col" className="cr-satis-nom"
                  title={`${p.prenom} ${p.nom}`}>
                  <span className="cr-satis-nom-texte">{p.prenom} {p.nom}</span>
                </th>
              ))}
            </tr>
          </thead>
          {/* La premiere section suit directement les noms : seul le
              bandeau des suivantes la separe de la precedente. */}
          {sections.map((s, k) => (
          <tbody key={s.titre} className="cr-satis-groupe">
            {k > 0 && <tr className="cr-satis-section">
              <th scope="rowgroup" className="cr-satis-section-titre">
                {s.titre}
                <small>{s.criteres.length} questions</small>
              </th>
              {participants.map(p => {
                const faites = s.criteres.filter(c => reponses[p.id]?.[c.cle]).length
                return (
                  <td key={p.id} className="cr-satis-section-compte">
                    <small className={faites === s.criteres.length ? 'cr-satis-complet' : undefined}>
                      {faites}/{s.criteres.length}
                    </small>
                  </td>
                )
              })}
            </tr>}
            {s.criteres.map(c => (
              <tr key={c.cle}>
                <th scope="row" className="cr-satis-critere" title={c.libelle}>
                  {c.libelle}
                </th>
                {participants.map(p => {
                  const choisie = reponses[p.id]?.[c.cle] || ''
                  return (
                    <td key={p.id}>
                      <div className={`cr-mentions${choisie ? ' cr-mentions--rempli' : ''}`}
                        role="radiogroup"
                        aria-label={`${c.libelle} — ${p.prenom} ${p.nom}`}>
                        {MENTIONS.map(m => {
                          const on = choisie === m.cle
                          return (
                            <button key={m.cle} type="button" role="radio"
                              aria-checked={on}
                              className={`cr-mention cr-mention--${m.cle}${on ? ' cr-mention--on' : ''}`}
                              title={m.libelle}
                              aria-label={m.libelle}
                              onClick={() => onRepondre(p.id, c.cle, on ? '' : m.cle)}>
                              <IconeMention cle={m.cle} />
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}
