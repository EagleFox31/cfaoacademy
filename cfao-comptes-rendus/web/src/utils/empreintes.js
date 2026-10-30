/**
 * L'empreinte des chiffres d'ou un texte redige est parti.
 *
 * Chaque texte ecrit par le moteur est range avec l'empreinte des donnees
 * qu'il a recues et le texte tel qu'il l'a rendu
 * (`brouillon.empreintes[cle] = { chiffres, texte }`). Si les notes
 * changent ensuite, l'empreinte ne correspond plus : un texte jamais
 * retouche peut etre reecrit sans rien perdre ; un texte retouche ne
 * l'est pas, le formateur est seulement prevenu.
 */

/** Une empreinte courte et stable d'une valeur serialisable. */
export function empreinte(donnees) {
  const s = JSON.stringify(donnees ?? null)
  let h = 5381
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/**
 * Ou en est le texte `cle` face aux chiffres actuels :
 * - `inconnu` : pas ecrit par le moteur (ou avant les empreintes) ;
 * - `a-jour` : ecrit avec les chiffres actuels ;
 * - `a-reecrire` : chiffres changes, texte jamais retouche ;
 * - `perime` : chiffres changes, texte retouche depuis.
 */
export function etatTexte(b, cle, chiffres) {
  const e = b?.empreintes?.[cle]
  if (!e) return 'inconnu'
  if (e.chiffres === chiffres) return 'a-jour'
  return (b?.textes?.[cle] ?? '') === e.texte ? 'a-reecrire' : 'perime'
}

/**
 * Les textes rediges, poses dans le brouillon avec leur empreinte.
 * `nouveaux` : `{ cle: { texte, chiffres } }`. Un texte retouche entre
 * la demande et la reponse garde la priorite.
 */
export function poserRediges(b, nouveaux) {
  const textes = { ...(b?.textes || {}) }
  const empreintes = { ...(b?.empreintes || {}) }
  Object.entries(nouveaux).forEach(([k, { texte, chiffres }]) => {
    const e = empreintes[k]
    if (textes[k] !== undefined && !(e && textes[k] === e.texte)) return
    textes[k] = texte
    empreintes[k] = { chiffres, texte }
  })
  return { textes, empreintes }
}
