/**
 * La redaction assistee des appreciations.
 *
 * Le moteur vit cote service : il s'appuie sur les tournures relevees
 * dans les comptes rendus existants, et non sur un modele de langue.
 * Il propose, il ne decide pas — le texte revient avec
 * `relecture_requise` et le formateur le signe.
 *
 * Si le service est arrete, la fonction renvoie `null` plutot que de
 * lever : la saisie manuelle reste le chemin normal.
 */

/** Les chiffres d'un stagiaire, dans la forme qu'attend le moteur. */
export function participantPourMoteur(p, calcul) {
  const nombre = v => (v == null || v === '' ? undefined : Number(v))
  return {
    nom: p.nom || '',
    prenom: p.prenom || '',
    genre: p.genre || undefined,
    acquisition: nombre(calcul?.scoreFinal),
    theorie: nombre(calcul?.sortieTheorique),
    pratique: nombre(calcul?.sortiePratique),
    entree: nombre(calcul?.entree),
    sortie: nombre(calcul?.sortieTheorique),
    taux_progression: nombre(calcul?.progression),
  }
}

/**
 * Une proposition d'appreciation.
 *
 * `type` vaut « fiche » pour l'appreciation du formateur, « accueil »
 * pour celle de la formation et de l'accueil (diapositive 27).
 */
export async function proposerTexte(participant, type = 'accueil') {
  try {
    const reponse = await fetch('/apercu/redaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, participant }),
    })
    if (!reponse.ok) return null
    const sortie = await reponse.json()
    return sortie?.texte || null
  } catch {
    return null
  }
}
