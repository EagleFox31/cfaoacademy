/**
 * Le bareme des evaluations CFAO, repris des classeurs de resultats.
 *
 * Le formateur saisit des notes brutes — ce qu'il a corrige sur copie.
 * Tous les pourcentages se deduisent, exactement comme le classeur les
 * calcule. Les formules ci-dessous sont celles lues dans
 * `Résultats … .xlsx`, verifiees sur plusieurs lignes :
 *
 *     F = SI(E="-"; 0; E/30)        entree theorique, sur 30
 *     H = SI(G="-"; 0; G/30)        sortie theorique, sur 30
 *     J = SI(I="-"; 0; I/20)        sortie pratique, sur 20
 *     K = (H - F) / F               progression, RELATIVE a l'entree
 *     L = moyenne(H; J)             score final
 *
 * Deux points qui se trompent facilement :
 *
 *   * **la progression est relative**, pas un ecart de points. Passer
 *     de 50 % a 75 % donne +50 % de progression, pas +25. C'est ce qui
 *     explique les « 113 % » des comptes rendus : partir de tres bas
 *     produit mecaniquement un grand pourcentage.
 *   * **le score final ignore le test d'entree.** Il ne mesure pas le
 *     chemin parcouru mais le niveau atteint.
 */

/** Les baremes par defaut, tels que les classeurs les appliquent. */
export const BAREMES = {
  entreeTheorique: 30,
  sortieTheorique: 30,
  sortiePratique: 20,
}

/** Le seuil de validation CFAO, present dans tous les comptes rendus. */
export const SEUIL = 70

/** Une note saisie lue comme nombre, virgule comprise ; `null` si vide
 * ou illisible.
 */
export function lireNote(brut) {
  if (brut == null) return null
  const s = String(brut).trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** La saisie d'une note, filtree a la frappe : des chiffres, un seul
 * separateur (virgule ou point) et une decimale. Le texte garde la
 * virgule du formateur ; seule la lecture la convertit.
 */
export function nettoyerNote(valeur) {
  const s = String(valeur ?? '').replace(/[^\d.,]/g, '')
  const i = s.search(/[.,]/)
  if (i < 0) return s.slice(0, 3)
  const entier = s.slice(0, i).slice(0, 3)
  const decimale = s.slice(i + 1).replace(/[.,]/g, '').slice(0, 1)
  return `${entier}${s[i]}${decimale}`
}

/** Une note brute ramenee en pourcentage, ou `null` si absente.
 *
 * Le classeur traite « - » comme zero ; ici un champ vide reste `null`,
 * pour distinguer « pas encore saisi » de « a eu zero ». Une note
 * negative ou au-dessus du bareme est aussi `null` : elle est signalee
 * par `anomalies` et n'entre dans aucun calcul.
 */
export function enPourcentage(brut, bareme) {
  const n = lireNote(brut)
  if (n == null || !bareme || n < 0 || n > bareme) return null
  return (n / bareme) * 100
}

/** Les resultats calcules d'un participant, depuis ses notes brutes. */
export function calculer(p, baremes = BAREMES) {
  const entree = enPourcentage(p?.entreeBrut, baremes.entreeTheorique)
  const sortieTh = enPourcentage(p?.sortieTheoBrut, baremes.sortieTheorique)
  const sortiePr = enPourcentage(p?.sortiePratBrut, baremes.sortiePratique)

  // `(sortie - entree) / entree` : une entree a zero rendrait le calcul
  // infini, le classeur lui-meme ne le prevoit pas.
  let progression = null
  if (entree != null && sortieTh != null && entree > 0) {
    progression = ((sortieTh - entree) / entree) * 100
  }

  // Le score final est la moyenne des deux epreuves de sortie ; si une
  // seule est connue, on ne moyenne pas sur du vide.
  let scoreFinal = null
  if (sortieTh != null && sortiePr != null) {
    scoreFinal = (sortieTh + sortiePr) / 2
  } else if (sortieTh != null || sortiePr != null) {
    scoreFinal = sortieTh ?? sortiePr
  }

  return {
    entree: arrondi(entree),
    sortieTheorique: arrondi(sortieTh),
    sortiePratique: arrondi(sortiePr),
    progression: arrondi(progression),
    scoreFinal: arrondi(scoreFinal),
    valide: scoreFinal == null ? null : scoreFinal >= SEUIL,
    // Ce qui manque encore, pour l'afficher sans le deviner.
    complet: sortieTh != null && sortiePr != null,
  }
}

function arrondi(v) {
  return v == null ? null : Math.round(v * 10) / 10
}

/** La synthese d'une session : moyennes du groupe et effectifs. */
export function syntheseGroupe(participants, baremes = BAREMES) {
  const presents = (participants || []).filter(p => p.present !== false)
  const calculs = presents.map(p => calculer(p, baremes))
  const moy = liste => {
    const v = liste.filter(x => x != null)
    return v.length ? arrondi(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  const scores = calculs.map(c => c.scoreFinal).filter(v => v != null)
  const enRetrait = scores.filter(v => v < SEUIL).length

  return {
    effectif: presents.length,
    saisis: scores.length,
    complet: presents.length > 0 && calculs.every(c => c.complet),
    entree: moy(calculs.map(c => c.entree)),
    sortieTheorique: moy(calculs.map(c => c.sortieTheorique)),
    sortiePratique: moy(calculs.map(c => c.sortiePratique)),
    progression: moy(calculs.map(c => c.progression)),
    scoreFinal: moy(scores),
    enRetrait,
    tauxReussite: scores.length
      ? Math.round((100 * (scores.length - enRetrait)) / scores.length)
      : null,
  }
}

/** Les anomalies d'une saisie, signalees sans bloquer.
 *
 * Une note au-dessus du bareme est une erreur franche — 32/30 n'existe
 * pas. Une regression entre l'entree et la sortie est inhabituelle mais
 * possible, et c'est au formateur de trancher.
 */
export function anomalies(p, baremes = BAREMES) {
  const out = []
  const champs = [
    ['entreeBrut', baremes.entreeTheorique, 'test d’entrée'],
    ['sortieTheoBrut', baremes.sortieTheorique, 'sortie théorique'],
    ['sortiePratBrut', baremes.sortiePratique, 'sortie pratique'],
  ]
  for (const [cle, max, libelle] of champs) {
    const v = p?.[cle]
    if (String(v ?? '').trim() === '') continue
    const n = lireNote(v)
    if (n == null) {
      out.push({ champ: cle, niveau: 'erreur', message: `${libelle} : valeur non numérique` })
    } else if (n < 0) {
      out.push({ champ: cle, niveau: 'erreur', message: `${libelle} : valeur négative` })
    } else if (n > max) {
      out.push({ champ: cle, niveau: 'erreur', message: `${libelle} : maximum ${max}` })
    }
  }
  const c = calculer(p, baremes)
  if (c.progression != null && c.progression < 0) {
    out.push({
      champ: 'sortieTheoBrut',
      niveau: 'avertissement',
      message: 'La note de sortie est inférieure à celle d’entrée',
    })
  }
  return out
}

/** Le libelle d'une valeur, avec son unite — « — » quand elle manque. */
export function afficher(v, unite = '%') {
  return v == null ? '—' : `${v}${unite ? ' ' + unite : ''}`
}
