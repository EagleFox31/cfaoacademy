/**
 * Regles de calcul du compte rendu de formation.
 *
 * Tout ce qui se deduit des notes vit ici, jamais dans les composants :
 * le taux d'acquisition, la progression, le nombre de participants en
 * retrait, l'etat d'avancement de l'assistant.
 *
 * Les seuils viennent des comptes rendus CFAO existants : le seuil de
 * validation est 70 %, et une note se compose a parts egales de la
 * theorie et de la pratique sauf indication contraire de la session.
 */

export const SEUIL_DEFAUT = 70

/** Le taux d'acquisition d'un participant, a partir de ses deux notes.
 *
 * Renvoie `null` si l'une des notes manque : une moyenne calculee sur
 * une seule epreuve serait fausse, et un chiffre faux dans un compte
 * rendu se propage sans que personne puisse le recouper.
 */
export function tauxAcquisition(p) {
  const { theorie, pratique } = p || {}
  if (theorie == null && pratique == null) return null
  if (theorie == null || pratique == null) return null
  return Math.round((Number(theorie) + Number(pratique)) / 2)
}

/** La progression entre le test d'entree et le test de sortie. */
export function progression(p) {
  const { entree, sortie } = p || {}
  if (entree == null || sortie == null) return null
  return Math.round(Number(sortie) - Number(entree))
}

/** Un participant a-t-il valide la formation ? */
export function aValide(p, seuil = SEUIL_DEFAUT) {
  const t = tauxAcquisition(p)
  return t == null ? null : t >= seuil
}

/** Les incoherences d'une saisie, pour affichage a cote du champ.
 *
 * On signale sans bloquer : une note de sortie inferieure a l'entree est
 * inhabituelle mais possible, et c'est au formateur de trancher. Seules
 * les valeurs hors bornes sont des erreurs franches.
 */
export function anomaliesSaisie(p) {
  const out = []
  const bornes = [
    ['entree', 'test d’entrée'],
    ['sortie', 'test de sortie'],
    ['theorie', 'note théorique'],
    ['pratique', 'note pratique'],
  ]
  for (const [cle, libelle] of bornes) {
    const v = p?.[cle]
    if (v == null || v === '') continue
    const n = Number(v)
    if (Number.isNaN(n)) out.push({ champ: cle, niveau: 'erreur', message: `${libelle} : valeur non numérique` })
    else if (n < 0 || n > 100) out.push({ champ: cle, niveau: 'erreur', message: `${libelle} : hors de 0–100` })
  }
  const prog = progression(p)
  if (prog != null && prog < 0) {
    out.push({
      champ: 'sortie',
      niveau: 'avertissement',
      message: 'Le test de sortie est inférieur au test d’entrée',
    })
  }
  return out
}

/** La synthese d'une session : effectifs, moyennes, participants en retrait. */
export function syntheseSession(participants, seuil = SEUIL_DEFAUT) {
  const presents = (participants || []).filter(p => p.present !== false)
  const notes = presents.map(p => tauxAcquisition(p)).filter(n => n != null)
  const entrees = presents.map(p => p.entree).filter(v => v != null && v !== '').map(Number)
  const sorties = presents.map(p => p.sortie).filter(v => v != null && v !== '').map(Number)

  const moyenne = arr => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null)
  const testEntree = moyenne(entrees)
  const testSortie = moyenne(sorties)
  const enRetrait = notes.filter(n => n < seuil).length

  return {
    effectif: presents.length,
    notesSaisies: notes.length,
    complet: presents.length > 0 && notes.length === presents.length,
    moyenneAcquisition: moyenne(notes),
    testEntree,
    testSortie,
    progression: testEntree != null && testSortie != null ? testSortie - testEntree : null,
    enRetrait,
    tauxReussite: notes.length ? Math.round((100 * (notes.length - enRetrait)) / notes.length) : null,
  }
}

/** Le nombre de jours d'une session, bornes comprises. */
export function nombreDeJours(session) {
  if (session?.nbJours) return session.nbJours
  const d = new Date(session?.debut)
  const f = new Date(session?.fin)
  if (Number.isNaN(d) || Number.isNaN(f)) return 1
  return Math.max(1, Math.round((f - d) / 86400000) + 1)
}

/** Les dates d'une session, une par jour, au format ISO. */
export function joursDeSession(session) {
  const n = nombreDeJours(session)
  const debut = new Date(session?.debut)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(debut)
    d.setDate(d.getDate() + i)
    return { index: i + 1, date: Number.isNaN(d) ? null : d.toISOString().slice(0, 10) }
  })
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « 14 septembre 2026 » — le format des comptes rendus existants. */
export function dateLongue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d)) return ''
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
}

/** « du 14 au 18 septembre 2026 », en evitant de repeter le mois. */
export function periodeLongue(debut, fin) {
  if (!debut || !fin) return ''
  const d = new Date(debut)
  const f = new Date(fin)
  if (Number.isNaN(d) || Number.isNaN(f)) return ''
  if (d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear()) {
    return `du ${d.getDate()} au ${f.getDate()} ${MOIS[f.getMonth()]} ${f.getFullYear()}`
  }
  return `du ${dateLongue(debut)} au ${dateLongue(fin)}`
}

/** L'etat de completion d'une etape, pour la barre de progression.
 *
 * Une etape est « complete » quand rien n'y manque, « partielle » quand
 * elle est entamee, « vide » sinon. L'assistant n'interdit jamais
 * d'avancer : il montre ce qui reste.
 */
export function etatEtape(id, brouillon, session) {
  const d = brouillon || {}
  switch (id) {
    case 'session':
      return d.sessionId ? 'complet' : 'vide'
    case 'participants': {
      const nb = (d.participants || []).filter(p => p.present !== false).length
      return nb > 0 ? 'complet' : 'vide'
    }
    case 'notes': {
      const s = syntheseSession(d.participants, session?.seuil)
      if (s.complet) return 'complet'
      return s.notesSaisies > 0 ? 'partiel' : 'vide'
    }
    case 'parties':
      return (d.parties || []).length > 0 ? 'complet' : 'vide'
    case 'deroule': {
      const jours = d.jours || {}
      const n = nombreDeJours(session)
      const remplis = Object.values(jours).filter(j => (j.thematiques || []).some(Boolean)).length
      if (remplis >= n) return 'complet'
      return remplis > 0 ? 'partiel' : 'vide'
    }
    case 'photos': {
      const total = Object.values(d.photos || {}).reduce((a, arr) => a + (arr?.length || 0), 0)
      return total > 0 ? 'complet' : 'vide'
    }
    case 'bilan':
      return d.bilanValide ? 'complet' : (d.bilanVu ? 'partiel' : 'vide')
    case 'fiches':
      return d.fichesValidees ? 'complet' : 'vide'
    default:
      return 'vide'
  }
}

/** Le dossier de session, pret a passer au generateur Python.
 *
 * La forme suit ce qu'attend `remplir.py` : une session, des
 * participants, et les champs deduits des notes. Les cles sont celles du
 * moteur, pas celles de l'interface.
 */
export function dossierSession(brouillon, session) {
  const seuil = session?.seuil ?? SEUIL_DEFAUT
  const presents = (brouillon.participants || []).filter(p => p.present !== false)
  const s = syntheseSession(presents, seuil)

  return {
    formation: session?.moduleFormation,
    code_formation: session?.codeFormation,
    code_session: session?.codeSession,
    marque: session?.marque,
    date_debut: session?.debut,
    date_fin: session?.fin,
    pays: session?.paysHote,
    lieu: session?.lieu,
    formateur: session?.formateur,
    seuil,
    effectif: s.effectif,
    test_entree: s.testEntree,
    test_sortie: s.testSortie,
    progression: s.progression,
    nb_en_retrait: s.enRetrait,
    taux_reussite: s.tauxReussite,
    parties: brouillon.parties,
    jours: brouillon.jours,
    photos: brouillon.photos,
    participants: presents.map(p => ({
      nom: p.nom,
      prenom: p.prenom,
      genre: p.genre || null,
      pays: p.pays,
      fonction: p.fonction,
      entree: p.entree === '' ? null : Number(p.entree),
      sortie: p.sortie === '' ? null : Number(p.sortie),
      theorie: p.theorie === '' ? null : Number(p.theorie),
      pratique: p.pratique === '' ? null : Number(p.pratique),
      acquisition: tauxAcquisition(p),
      domaine_fort: p.domaineFort || null,
      domaine_faible: p.domaineFaible || null,
    })),
  }
}
