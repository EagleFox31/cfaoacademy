/**
 * La satisfaction des stagiaires, reprise du classeur d'evaluation.
 *
 * Source : `Evaluation … .xlsx`, feuille « Satisfaction Stagiaires ».
 * Chaque stagiaire note treize criteres par une mention, convertie en
 * score sur 100 par la table de ponderation du classeur (Q7:R11) :
 *
 *     Tres satisfaisant  100        Peu satisfaisant   25
 *     Satisfaisant        75        Insatisfaisant      0
 *     Moyen               50
 *
 * Deux indicateurs en sortent, tous deux des moyennes simples :
 *
 *     Qualite de la formation = moyenne(7 criteres) / 100   (B21)
 *     Qualite de l'accueil    = moyenne(6 criteres) / 100   (B29)
 *
 * Verifie contre les valeurs stockees par Excel : la qualite de
 * formation concorde sur les cinq colonnes du classeur temoin.
 *
 * **Un defaut du classeur n'est pas reproduit ici.** Dans la feuille,
 * les lignes 23 et 28 pointent toutes deux vers `B25` : « Repas au
 * CFR » est compte deux fois et « Accueil a l'aeroport » jamais. Cela
 * fausse la moyenne d'accueil de deux colonnes sur cinq dans le
 * classeur temoin. Les six criteres sont ici comptes une fois chacun.
 */

/** Les mentions, de la meilleure a la moins bonne, avec leur score. */
export const MENTIONS = [
  { cle: 'tres_satisfaisant', libelle: 'Très satisfaisant', score: 100, signe: '★' },
  { cle: 'satisfaisant', libelle: 'Satisfaisant', score: 75, signe: '👍' },
  { cle: 'moyen', libelle: 'Moyen', score: 50, signe: '😐' },
  { cle: 'peu_satisfaisant', libelle: 'Peu satisfaisant', score: 25, signe: '👎' },
  { cle: 'insatisfaisant', libelle: 'Insatisfaisant', score: 0, signe: '✕' },
]

const SCORE_PAR_CLE = Object.fromEntries(MENTIONS.map(m => [m.cle, m.score]))

/** Les sept criteres de la qualite de la formation (lignes 13 a 19). */
export const CRITERES_FORMATION = [
  { cle: 'themes', libelle: 'Thèmes abordés' },
  { cle: 'documents', libelle: 'Qualité des documents de formation' },
  { cle: 'planning', libelle: 'Planning, horaires et durée' },
  { cle: 'formateur', libelle: 'Prestation du formateur' },
  { cle: 'composition', libelle: 'Composition du groupe' },
  { cle: 'ambiance', libelle: 'Ambiance du groupe' },
  { cle: 'salle', libelle: 'Salle de formation (équipement, confort)' },
]

/** Les six criteres de la qualite de l'accueil (lignes 20 a 25). */
export const CRITERES_ACCUEIL = [
  { cle: 'aeroport', libelle: 'Accueil à l’aéroport' },
  { cle: 'transport', libelle: 'Transport de l’aéroport à l’hôtel' },
  { cle: 'hebergement', libelle: 'Qualité de l’hébergement' },
  { cle: 'repas_hotel', libelle: 'Repas et boissons à l’hôtel' },
  { cle: 'accueil_centre', libelle: 'Accueil au centre de formation' },
  { cle: 'repas_cfr', libelle: 'Repas au centre' },
]

/** Moyenne des mentions saisies pour un ensemble de criteres.
 *
 *  Les criteres laisses vides sont ignores, comme `AVERAGE` ignore les
 *  cellules vides : une moyenne sur cinq reponses reste juste.
 */
function moyenneCriteres(reponses, criteres) {
  const scores = criteres
    .map(c => SCORE_PAR_CLE[reponses?.[c.cle]])
    .filter(s => s != null)
  if (scores.length === 0) return null
  return scores.reduce((t, s) => t + s, 0) / scores.length
}

/** Les deux indicateurs pour un stagiaire. */
export function satisfactionStagiaire(reponses) {
  return {
    formation: moyenneCriteres(reponses, CRITERES_FORMATION),
    accueil: moyenneCriteres(reponses, CRITERES_ACCUEIL),
  }
}

/** La synthese du groupe : moyenne des stagiaires ayant repondu.
 *
 *  @param {Record<string, object>} parStagiaire  reponses indexees par
 *         identifiant de participant
 */
export function syntheseSatisfaction(parStagiaire = {}) {
  const valeurs = Object.values(parStagiaire).map(satisfactionStagiaire)
  const moyenne = champ => {
    const v = valeurs.map(s => s[champ]).filter(x => x != null)
    if (v.length === 0) return null
    return Math.round((v.reduce((t, x) => t + x, 0) / v.length) * 10) / 10
  }
  const repondants = valeurs.filter(s => s.formation != null || s.accueil != null)
  return {
    formation: moyenne('formation'),
    accueil: moyenne('accueil'),
    repondants: repondants.length,
  }
}

/** Le detail par critere, pour la page « Qualité et accueil ». */
export function detailParCritere(parStagiaire = {}, criteres) {
  const reponses = Object.values(parStagiaire)
  return criteres.map(c => {
    const scores = reponses
      .map(r => SCORE_PAR_CLE[r?.[c.cle]])
      .filter(s => s != null)
    const moyenne = scores.length
      ? Math.round((scores.reduce((t, s) => t + s, 0) / scores.length) * 10) / 10
      : null
    return { ...c, moyenne, reponses: scores.length }
  })
}

/** Un pourcentage affichable, ou un tiret quand rien n'est saisi. */
export function afficherTaux(valeur) {
  return valeur == null ? '—' : `${Math.round(valeur * 10) / 10} %`
}
