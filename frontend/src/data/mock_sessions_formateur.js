/**
 * Sessions animees par un formateur, pour le module de compte rendu.
 *
 * Les champs reprennent le modele metier du projet Academy
 * (`types.ts` : Formation, Participant) afin que le branchement sur
 * l'API reelle ne demande pas de traduction :
 *
 *   Formation    codeSession, codeFormation, moduleFormation, marque,
 *                pole, paysHote, lieu, debut, fin, formateur, statut
 *   Participant  nom, prenom, pays, tauxProgression,
 *                tauxAcquisitionCompetences
 *
 * Les notes sont volontairement absentes : c'est le formateur qui les
 * saisit dans l'assistant. Un participant arrive avec son identite et
 * son inscription, rien de plus.
 */

export const SESSION_STATUTS = {
  a_rediger: { label: 'À rédiger', tone: 'warn' },
  en_cours: { label: 'En cours', tone: 'info' },
  termine: { label: 'Terminé', tone: 'ok' },
}

/** Les 9 parties du compte rendu, avec leur caractere obligatoire.
 *
 * Le statut vient de l'analyse des 14 comptes rendus existants : une
 * partie presente dans plus de 90 % des rapports est traitee comme
 * obligatoire, en deca elle est proposee mais peut etre ecartee.
 */
export const PARTIES_RAPPORT = [
  {
    id: 'couverture',
    titre: 'Couverture',
    resume: 'Intitulé, dates, lieu',
    obligatoire: true,
    presence: 100,
    auto: true,
    aide: 'Composée depuis la fiche session. Rien à saisir.',
  },
  {
    id: 'participants',
    titre: 'Participants',
    resume: 'Liste et photo de groupe',
    obligatoire: true,
    presence: 92,
    aide: 'Vérifiez la liste, ajoutez la photo de groupe.',
  },
  {
    id: 'objectifs',
    titre: 'Objectifs',
    resume: 'Ce que la formation visait',
    obligatoire: false,
    presence: 78,
    aide: 'Repris du catalogue si la formation y figure.',
  },
  {
    id: 'deroule',
    titre: 'Déroulé journalier',
    resume: 'Une page par jour',
    obligatoire: true,
    presence: 92,
    aide: 'Thématiques, points forts, points d’amélioration et photos.',
  },
  {
    id: 'resultats',
    titre: 'Résultats globaux',
    resume: 'Progression et acquisition',
    obligatoire: true,
    presence: 92,
    aide: 'Calculés depuis les notes saisies.',
  },
  {
    id: 'qualite',
    titre: 'Qualité et accueil',
    resume: 'Retours des participants',
    obligatoire: false,
    presence: 64,
    aide: 'À inclure si vous avez recueilli les questionnaires.',
  },
  {
    id: 'bilan',
    titre: 'Bilan',
    resume: 'Synthèse en quatre rubriques',
    obligatoire: true,
    presence: 92,
    aide: 'Rédigé automatiquement, relisez avant diffusion.',
  },
  {
    id: 'fiches',
    titre: 'Fiches individuelles',
    resume: 'Une page par participant',
    obligatoire: false,
    presence: 78,
    aide: 'Appréciation nominative pour chaque stagiaire.',
  },
  {
    id: 'cloture',
    titre: 'Clôture',
    resume: 'Page de fin',
    obligatoire: false,
    presence: 21,
    auto: true,
    aide: 'Page de remerciement.',
  },
]

function participant(id, prenom, nom, pays, fonction) {
  return { id, prenom, nom, pays, fonction, present: true }
}

export const SESSIONS_FORMATEUR = [
  {
    id: 'ses-ts05-g3-0922',
    codeSession: 'TS05-G3/26-09',
    codeFormation: 'TS05-G3',
    moduleFormation: 'Révision et réparation des organes châssis',
    marque: 'TOYOTA',
    pole: 'Motors',
    typeFormation: 'Présentiel',
    paysHote: 'Cameroun',
    lieu: 'Centre CFAO Academy — Douala',
    debut: '2026-09-14',
    fin: '2026-09-18',
    duree: '5 jours',
    nbJours: 5,
    formateur: 'Eugène EBENE',
    statut: 'a_rediger',
    seuil: 70,
    participants: [
      participant('p1', 'Alain', 'MBARGA', 'Cameroun', 'Technicien'),
      participant('p2', 'Claire', 'NGONO', 'Cameroun', 'Technicienne'),
      participant('p3', 'Alpha', 'BALDE', 'Guinée', 'Chef d’atelier'),
      participant('p4', 'Thierno', 'SYLLA', 'Guinée', 'Technicien'),
      participant('p5', 'Bernard', 'TCHOUAKWE', 'Cameroun', 'Technicien'),
      participant('p6', 'Fatou', 'DIALLO', 'Sénégal', 'Technicienne'),
    ],
  },
  {
    id: 'ses-ts03-g3-0904',
    codeSession: 'TS03-G3/26-09',
    codeFormation: 'TS03-G3',
    moduleFormation: 'Diagnostic des systèmes électriques et électroniques',
    marque: 'TOYOTA',
    pole: 'Motors',
    typeFormation: 'Présentiel',
    paysHote: 'Côte d’Ivoire',
    lieu: 'CFAO Mobility — Abidjan',
    debut: '2026-08-31',
    fin: '2026-09-04',
    duree: '5 jours',
    nbJours: 5,
    formateur: 'Eugène EBENE',
    statut: 'a_rediger',
    seuil: 70,
    participants: [
      participant('t1', 'Kouamé', 'ASSI', 'Côte d’Ivoire', 'Technicien'),
      participant('t2', 'Ange', 'KOFFI', 'Côte d’Ivoire', 'Technicien'),
      participant('t3', 'Salif', 'TRAORE', 'Côte d’Ivoire', 'Chef d’atelier'),
      participant('t4', 'Yao', 'KOUADIO', 'Côte d’Ivoire', 'Technicien'),
      participant('t5', 'Adjoua', 'BROU', 'Côte d’Ivoire', 'Technicienne'),
    ],
  },
  {
    id: 'ses-ts01-g4-0821',
    codeSession: 'TS01-G4/26-08',
    codeFormation: 'TS01-G4',
    moduleFormation: 'Maintenance préventive des véhicules',
    marque: 'TOYOTA',
    pole: 'Motors',
    typeFormation: 'Présentiel',
    paysHote: 'Cameroun',
    lieu: 'Centre CFAO Academy — Douala',
    debut: '2026-08-17',
    fin: '2026-08-21',
    duree: '5 jours',
    nbJours: 5,
    formateur: 'Eugène EBENE',
    statut: 'a_rediger',
    seuil: 70,
    participants: [
      participant('u1', 'Serge', 'ATANGANA', 'Cameroun', 'Technicien'),
      participant('u2', 'Pascal', 'NKOLO', 'Cameroun', 'Technicien'),
      participant('u3', 'Aimé', 'BIYA', 'Cameroun', 'Technicien'),
      participant('u4', 'Estelle', 'NGO BELL', 'Cameroun', 'Technicienne'),
    ],
  },
  {
    id: 'ses-ss03-0908',
    codeSession: 'SS03/26-09',
    codeFormation: 'SS03',
    moduleFormation: 'Utilisation de l’outil de diagnostic',
    marque: 'TOYOTA',
    pole: 'Motors',
    typeFormation: 'Présentiel',
    paysHote: 'Cameroun',
    lieu: 'Centre CFAO Academy — Douala',
    debut: '2026-09-07',
    fin: '2026-09-11',
    duree: '5 jours',
    nbJours: 5,
    formateur: 'Eugène EBENE',
    statut: 'en_cours',
    seuil: 70,
    avancement: 4,
    participants: [
      participant('q1', 'Jonas', 'EDJENGUELE', 'Cameroun', 'Magasinier'),
      participant('q2', 'Patrick', 'ESSOMBA', 'Cameroun', 'Technicien'),
      participant('q3', 'Giraud', 'MVONDO', 'Gabon', 'Chef d’atelier'),
      participant('q4', 'Bénédicte', 'AYISSI', 'Cameroun', 'Magasinière'),
    ],
  },
  {
    id: 'ses-g3-cert-0831',
    codeSession: 'TS07-G3/26-08',
    codeFormation: 'TS07-G3',
    moduleFormation: 'Certification pratique G3',
    marque: 'TOYOTA',
    pole: 'Motors',
    typeFormation: 'Présentiel',
    paysHote: 'Guinée',
    lieu: 'CFAO Mobility — Conakry',
    debut: '2026-08-24',
    fin: '2026-08-28',
    duree: '5 jours',
    nbJours: 5,
    formateur: 'Eugène EBENE',
    statut: 'termine',
    seuil: 70,
    rapportGenere: '2026-08-31',
    participants: [
      participant('r1', 'Lansana', 'CONDE', 'Guinée', 'Technicien'),
      participant('r2', 'Sekou', 'TOURE', 'Guinée', 'Technicien'),
      participant('r3', 'Mohamed', 'KEITA', 'Guinée', 'Technicien'),
    ],
  },
  {
    id: 'ses-hev-1005',
    codeSession: 'HEV-01/26-10',
    codeFormation: 'HEV-01',
    moduleFormation: 'Habilitation véhicules électriques et hybrides',
    marque: 'TOYOTA',
    pole: 'Motors',
    typeFormation: 'Hybride',
    paysHote: 'Cameroun',
    lieu: 'Centre CFAO Academy — Douala',
    debut: '2026-10-05',
    fin: '2026-10-09',
    duree: '5 jours',
    nbJours: 5,
    formateur: 'Eugène EBENE',
    statut: 'a_venir',
    seuil: 70,
    participants: [
      participant('s1', 'Léon', 'FOUDA', 'Cameroun', 'Technicien'),
      participant('s2', 'Rachel', 'MANGA', 'Cameroun', 'Technicienne'),
    ],
  },
]

/** Les dispositions de photos, proposees selon leur nombre.
 *
 * Chaque disposition correspond a une mise en page eprouvee du modele
 * PowerPoint. Au-dela de cinq photos, la grille est la seule option qui
 * garde des images lisibles sur une diapositive 16:9.
 */
export const DISPOSITIONS = [
  {
    id: 'pleine',
    nom: 'Pleine largeur',
    pour: [1],
    schema: [[1]],
    note: 'Une image, toute la largeur',
  },
  {
    id: 'duo',
    nom: 'Côte à côte',
    pour: [2],
    schema: [[1, 1]],
    note: 'Deux images de même taille',
  },
  {
    id: 'duo-vertical',
    nom: 'Superposées',
    pour: [2],
    schema: [[1], [1]],
    note: 'L’une au-dessus de l’autre',
  },
  {
    id: 'une-plus-deux',
    nom: 'Une grande, deux petites',
    pour: [3],
    // `colonnes` decrit une mise en page ou une image occupe toute la
    // hauteur a cote d'une pile : `schema` ne savait dire que des
    // lignes, et dessinait quatre cases pour trois photos.
    colonnes: [[1], [1, 1]],
    poids: [2, 1],
    note: 'Met en avant la première image',
  },
  {
    id: 'trio',
    nom: 'Trois colonnes',
    pour: [3],
    schema: [[1, 1, 1]],
    note: 'Trois images alignées',
  },
  {
    id: 'quatre',
    nom: 'Quadrillage',
    pour: [4],
    schema: [[1, 1], [1, 1]],
    note: 'Quatre images en carré',
  },
  {
    id: 'mosaique',
    nom: 'Mosaïque',
    pour: [5],
    colonnes: [[1], [1, 1], [1, 1]],
    poids: [2, 1, 1],
    note: 'Une dominante, les autres autour',
  },
  {
    id: 'grille',
    nom: 'Grille',
    pour: [5, 6, 7, 8],
    schema: [[1, 1, 1], [1, 1, 1]],
    note: 'Toutes les images à taille égale',
  },
]

/** Les dispositions possibles pour un nombre de photos donne. */
export function dispositionsPour(nb) {
  if (!nb) return []
  const exactes = DISPOSITIONS.filter(d => d.pour.includes(nb))
  if (exactes.length) return exactes
  // Au-dela du catalogue, la grille absorbe n'importe quel nombre.
  return DISPOSITIONS.filter(d => d.id === 'grille')
}

/** Les parties retenues par defaut : les obligatoires, plus les
 *  recommandees au-dela de 70 % de presence dans les rapports. */
export function partiesParDefaut() {
  return PARTIES_RAPPORT.filter(p => p.obligatoire || p.presence >= 70)
    .map(p => p.id)
}
