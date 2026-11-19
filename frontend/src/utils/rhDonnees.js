/**
 * Donnees du portail RH.
 *
 * Une seule porte d'entree pour les ecrans RH : ils demandent une synthese
 * pour un perimetre (filiale, BU) et ne savent pas d'ou viennent les
 * chiffres. Aujourd'hui, un jeu de demonstration derive de la base MEDACAP
 * (`data/rh/medacap-demo.json`, anonymise : une ligne par technicien ou
 * candidat, sans identite) ; demain le pont MEDACAP, puis `cfao-core` —
 * sans toucher aux ecrans.
 *
 * Le jeu porte des lignes et non des totaux : chaque filtre se calcule sans
 * compter deux fois un technicien rattache aux deux BU.
 */
import DEMO from '../data/rh/medacap-demo.json'

export const BU = ['Motors', 'Equipment']

/** Perimetre par defaut : tout le groupe, toutes les BU. */
export const PERIMETRE_GROUPE = { filiale: null, bu: null }

export function donneesRH() {
  return DEMO
}

/** Les filiales, par pays, dans l'ordre alphabetique. */
export function filiales(d = DEMO) {
  return [...d.filiales].sort((a, b) => a.pays.localeCompare(b.pays, 'fr'))
}

/** Code de la filiale d'un pays (`user.pays`), sans tenir compte des accents
 * ni de la forme de l'apostrophe ; null si le pays n'est pas dans le jeu. */
export function codeFiliale(pays, d = DEMO) {
  const norme = s => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019']/g, "'").toLowerCase().trim()
  if (!norme(pays)) return null
  return d.filiales.find(f => norme(f.pays) === norme(pays))?.code ?? null
}

export function nomFiliale(code, d = DEMO) {
  return d.filiales.find(f => f.code === code)?.pays ?? 'Filiale non renseignée'
}

const dansPerimetre = ({ filiale, bu }) => x =>
  (!filiale || x.f === filiale) && (!bu || (x.bu || []).includes(bu))

export const NIVEAUX = ['Junior', 'Senior', 'Expert']

/** Repartition des scores : au moins 70 %, de 50 a 69 %, sous 50 %. */
export function repartition(scores) {
  const v = scores.filter(x => x != null)
  return {
    fort: v.filter(x => x >= 70).length,
    moyen: v.filter(x => x >= 50 && x < 70).length,
    faible: v.filter(x => x < 50).length,
  }
}

const taux = (n, total) => (total ? Math.round((n / total) * 100) : null)
const moyenne = l => {
  const v = l.filter(x => x != null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

/** Campagnes de recrutement du perimetre, ouvertes d'abord, puis les plus recentes. */
export function syntheseRecrutement(p = PERIMETRE_GROUPE, d = DEMO) {
  const campagnes = d.campagnesRecrutement
    .filter(c => (!p.filiale || c.f === p.filiale) && (!p.bu || c.bu.includes(p.bu)))
    .map(c => {
      const candidats = d.candidats.filter(x => x.c === c.id && x.actif)
      const testes = candidats.filter(x => x.teste)
      return {
        ...c,
        candidats: candidats.length,
        testes: testes.length,
        avancement: taux(testes.length, candidats.length),
        moyenne: moyenne(testes.map(x => x.score)),
        repartition: repartition(testes.map(x => x.score)),
      }
    })
    .sort((a, b) => (a.statut === b.statut
      ? String(b.fin).localeCompare(String(a.fin))
      : a.statut === 'ouverte' ? -1 : 1))
  return {
    campagnes,
    ouvertes: campagnes.filter(c => c.statut === 'ouverte').length,
    candidats: campagnes.reduce((n, c) => n + c.candidats, 0),
    testes: campagnes.reduce((n, c) => n + c.testes, 0),
  }
}

/** Mesure des competences : couverture et niveau, au total et par filiale. */
export function syntheseCompetences(p = PERIMETRE_GROUPE, d = DEMO) {
  const actifs = d.techniciens.filter(t => t.actif).filter(dansPerimetre(p))
  const bilan = liste => {
    const evalues = liste.filter(t => t.evalue)
    return {
      techniciens: liste.length,
      evalues: evalues.length,
      couverture: taux(evalues.length, liste.length),
      moyenne: moyenne(evalues.map(t => t.score)),
      repartition: repartition(evalues.map(t => t.score)),
      niveaux: Object.fromEntries(NIVEAUX.map(n => [n, evalues.filter(t => t.niveau === n).length])),
    }
  }
  const parFiliale = filiales(d)
    .map(f => {
      const ici = actifs.filter(t => t.f === f.code)
      return {
        code: f.code,
        pays: f.pays,
        ...bilan(ici),
        parBU: Object.fromEntries(BU.map(b => [b, bilan(ici.filter(t => t.bu.includes(b)))])),
      }
    })
    .filter(l => l.techniciens > 0)
    .sort((a, b) => (a.couverture ?? 0) - (b.couverture ?? 0))
  // Par niveau du technicien (Maintenance, Réparation, Diagnostic).
  const parNiveau = NIVEAUX.map(niveau => {
    const ici = actifs.filter(t => t.niveau === niveau)
    const evalues = ici.filter(t => t.evalue)
    return { niveau, techniciens: ici.length, evalues: evalues.length, moyenne: moyenne(evalues.map(t => t.score)) }
  })
  return { campagne: d.campagnesMesure[0], ...bilan(actifs), parFiliale, parNiveau }
}

/** PIF : techniciens evalues, avec un plan, plan valide — par filiale et BU. */
export function synthesePIF(p = PERIMETRE_GROUPE, d = DEMO) {
  const actifs = d.techniciens.filter(t => t.actif).filter(dansPerimetre(p))
  const bilan = liste => {
    const avecPif = liste.filter(t => t.pif)
    const valides = liste.filter(t => t.pifValide)
    return {
      techniciens: liste.length,
      evalues: liste.filter(t => t.evalue).length,
      avecPif: avecPif.length,
      valides: valides.length,
      couverture: taux(avecPif.length, liste.length),
    }
  }
  const parFiliale = filiales(d)
    .map(f => {
      const ici = actifs.filter(t => t.f === f.code)
      return {
        code: f.code,
        pays: f.pays,
        ...bilan(ici),
        parBU: Object.fromEntries(BU.map(b => [b, bilan(ici.filter(t => t.bu.includes(b)))])),
      }
    })
    .filter(l => l.techniciens > 0)
  return { ...bilan(actifs), parFiliale }
}

/** Techniciens et candidats : effectifs actifs, corbeille (suppression douce), fiches a completer. */
export function synthesePersonnes(p = PERIMETRE_GROUPE, d = DEMO) {
  const techniciens = d.techniciens.filter(dansPerimetre(p))
  const candidats = d.candidats.filter(dansPerimetre(p))
  const bilan = (tech, cand, incomplets) => ({
    techniciens: tech.filter(t => t.actif).length,
    candidats: cand.filter(c => c.actif).length,
    supprimes: tech.filter(t => !t.actif).length + cand.filter(c => !c.actif).length,
    aCompleter: incomplets.length,
  })
  // Une fiche incomplete echappe au filtre BU (c'est ce qui lui manque) ;
  // sans filiale, elle reste visible de la RH groupe.
  const incomplets = d.techniciens.filter(t => t.actif && t.incomplet
    && (!p.filiale || t.f === p.filiale))
  const lignes = [...filiales(d).map(f => ({ code: f.code, pays: f.pays })),
    ...(p.filiale ? [] : [{ code: null, pays: 'Sans filiale' }])]
    .map(f => ({
      ...f,
      ...bilan(techniciens.filter(t => t.f === f.code), candidats.filter(c => c.f === f.code),
        incomplets.filter(t => t.f === f.code)),
    }))
    .filter(l => l.techniciens + l.candidats + l.supprimes + l.aCompleter > 0)
  return { ...bilan(techniciens, candidats, incomplets), parFiliale: lignes }
}

/**
 * Ce qui attend une action RH : au plus une priorite par espace, la plus
 * urgente, dans l'ordre du cycle — l'accueil montre ainsi d'un coup d'oeil
 * ou agir, sans qu'un espace charge n'en cache un autre.
 *
 * Chaque priorite porte un `code` et ses chiffres, sans texte : l'ecran
 * les libelle dans la langue de l'utilisateur.
 */
export function priorites(p = PERIMETRE_GROUPE, d = DEMO) {
  const liste = []

  const rec = syntheseRecrutement(p, d).campagnes
  const ouvertes = rec.filter(c => c.statut === 'ouverte' && c.testes < c.candidats)
  const aExploiter = rec.find(c => c.statut === 'cloturee' && c.testes > 0)
  if (ouvertes.length) {
    liste.push({
      espace: 'recrutement', code: 'rec_open',
      nombre: ouvertes.length,
      sansTest: ouvertes.reduce((n, c) => n + c.candidats - c.testes, 0),
      ...(ouvertes.length === 1 && {
        intitule: ouvertes[0].intitule,
        filiale: nomFiliale(ouvertes[0].f, d),
        avancement: ouvertes[0].avancement,
      }),
    })
  } else if (aExploiter) {
    liste.push({
      espace: 'recrutement', code: 'rec_results',
      intitule: aExploiter.intitule, testes: aExploiter.testes, moyenne: aExploiter.moyenne,
    })
  }

  const enRetard = syntheseCompetences(p, d).parFiliale.filter(f => (f.couverture ?? 0) < 50)
  if (enRetard.length) {
    liste.push({
      espace: 'competences', code: 'measure_late',
      nombre: enRetard.length,
      filiales: enRetard.map(f => ({
        pays: f.pays, couverture: f.couverture ?? 0, evalues: f.evalues, techniciens: f.techniciens,
      })),
    })
  }

  const pif = synthesePIF(p, d)
  if (pif.avecPif > pif.valides) {
    liste.push({
      espace: 'pif', code: 'pif_pending',
      attente: pif.avecPif - pif.valides, valides: pif.valides, proposes: pif.avecPif,
    })
  }

  const pers = synthesePersonnes(p, d)
  if (pers.aCompleter) {
    liste.push({ espace: 'personnes', code: 'records_incomplete', nombre: pers.aCompleter })
  }
  return liste
}
