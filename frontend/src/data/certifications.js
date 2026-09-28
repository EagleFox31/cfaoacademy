/**
 * Les certifications pratiques et leurs modules.
 *
 * Une certification ne s'evalue pas par un test d'entree et un test de
 * sortie : chaque candidat passe une serie de modules pratiques, notes
 * chacun sur 100. Les modules viennent du classeur « Résultats de la
 * certification Team GP » du niveau ; ils pre-remplissent la saisie, que
 * le formateur complete ou corrige session par session.
 *
 * La cle est le code de formation : c'est lui, et non l'intitule, qui
 * distingue une certification d'une formation du meme niveau (TS05-G3
 * est une formation, TS07-G3 la certification pratique G3).
 */
export const CERTIFICATIONS = {
  'TS07-G3': {
    niveau: 'G3',
    intitule: 'Certification pratique G3',
    modules: [
      ['G38001', 'Décharge de la pression du système d’alimentation en carburant'],
      ['G38002', 'Dépose et pose du piston'],
      ['G38003', 'Dépose et pose de l’arbre à cames'],
      ['G38004', 'Travaux de mesure 1 (jeu de lubrification du piston)'],
      ['G38005', 'Travaux de mesure 2 (contrôle du faux rond)'],
      ['G38006', 'Révision de l’étrier de frein à disque'],
      ['G38007', 'Remplacement de la durite de frein'],
      ['G38008', 'Inspection du servofrein sur véhicule'],
      ['G38009', 'Dépose et pose des composants intérieurs et extérieurs de la carrosserie'],
      ['G38010', 'Réglage de l’axe optique des phares'],
      ['G38011', 'Dépose et pose des composants à l’aide d’une presse'],
      ['G38012', 'Dépose des composants à l’aide d’un extracteur'],
      ['G38013', 'Dépose et pose des composants à l’aide d’un compresseur de ressort hélicoïdal'],
    ],
  },
}

/** La certification d'un code de formation, ou `null`. */
export function certificationDe(code) {
  return CERTIFICATIONS[String(code || '').trim().toUpperCase()] || null
}
