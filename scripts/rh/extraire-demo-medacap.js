// Jeu de demonstration du portail RH, derive de la base MEDACAP (copie locale).
// Anonymise : aucune identite, seulement filiale, BU et indicateurs.
// Usage (depuis frontend/src) :
//   SORTIE=data/rh/medacap-demo.json mongosh --quiet mongodb://127.0.0.1:27017/academy ../../scripts/rh/extraire-demo-medacap.js
const EXCLUES = ['TEST CAMPAGNE PAR IBRAHIM', 'Test pour recrutement'];

const bu = d => {
  const s = String(d || '');
  return ['Motors', 'Equipment'].filter(x => s.includes(x));
};
// "13-03-2025 08:28:02" | "10-05-24" -> "2025-03-13"
const jour = s => {
  const m = String(s || '').match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (!m) return null;
  const a = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
const pct = r => (r.total ? Math.round((r.score / r.total) * 1000) / 10 : null);

// Noms de pays tels qu'ils s'affichent (la base les porte sans accents).
const PAYS = { sn: 'Sénégal', ci: 'Côte d’Ivoire', cf: 'Centrafrique', cd: 'RD Congo' };
const filiales = {};
db.cfao_subsidiaries.find().forEach(f => {
  filiales[f.subsidiary] = { code: f.countryCode, pays: PAYS[f.countryCode] || f.country, nom: f.subsidiary };
});
// Filiales renommees depuis le referentiel (CFAO MOBILITY CAMEROON...).
const ALIAS = { CAMEROON: 'cm' };
const filiale = s => {
  if (filiales[s]) return filiales[s].code;
  const a = Object.keys(ALIAS).find(k => String(s || '').toUpperCase().includes(k));
  return a ? ALIAS[a] : null;
};

// Resultats factuels par utilisateur (le dernier compte).
const factuels = {};
db.results.find({ type: 'Factuel', active: true }).forEach(r => {
  const u = String(r.user);
  (factuels[u] = factuels[u] || []).push({ p: pct(r), le: jour(r.created) || '' });
});
const dernier = u => {
  const l = (factuels[u] || []).filter(x => x.p != null).sort((a, b) => a.le.localeCompare(b.le));
  return l.length ? l[l.length - 1] : null;
};

// Regle PIFService : Factuel actif + Declaratif valide manager, sur un niveau.
const alloc = {};
// Comme PIFService : une allocation Training suffit, active ou non.
db.allocations.find().forEach(a => {
  const u = String(a.user);
  const e = (alloc[u] = alloc[u] || { f: new Set(), d: new Set(), training: false });
  if (a.type === 'Factuel' && a.active) e.f.add(a.level);
  if (a.type === 'Declaratif' && a.active && a.activeManager) e.d.add(a.level);
  if (a.type === 'Training') e.training = true;
});
const valides = new Set(db.validations.find({ active: true, status: 'Validé' }).toArray().map(v => String(v.user)));

const techniciens = db.users.find({ profile: 'Technicien' }).toArray().map(u => {
  const id = String(u._id);
  const a = alloc[id] || { f: new Set(), d: new Set(), training: false };
  const evalue = [...a.f].some(n => a.d.has(n));
  const d = dernier(id);
  return {
    f: filiale(u.subsidiary), bu: bu(u.department), niveau: u.level || null,
    actif: u.active !== false, evalue, score: evalue && d ? d.p : null,
    pif: a.training, pifValide: valides.has(id),
    incomplet: !bu(u.department).length || !filiale(u.subsidiary) || !u.level,
  };
});

// Campagnes de recrutement : aujourd'hui un simple libelle `role` porte par
// chaque candidat. On en fait des objets, dates deduites de l'activite.
const campagnes = {};
const candidats = [];
db.users.find({ profile: 'Candidat' }).forEach(u => {
  const nom = String(u.role || '').trim();
  if (!nom || EXCLUES.includes(nom)) return;
  const c = (campagnes[nom] = campagnes[nom] || { intitule: nom, dates: [], filiales: {}, bu: new Set() });
  const le = jour(u.created);
  if (le) c.dates.push(le);
  c.filiales[filiale(u.subsidiary)] = (c.filiales[filiale(u.subsidiary)] || 0) + 1;
  bu(u.department).forEach(x => c.bu.add(x));
  const d = dernier(String(u._id));
  if (d && d.le) c.dates.push(d.le);
  candidats.push({ c: nom, f: filiale(u.subsidiary), bu: bu(u.department), actif: u.active !== false, teste: !!d, score: d ? d.p : null });
});
const listeCampagnes = Object.values(campagnes).map((c, i) => {
  c.dates.sort();
  const f = Object.entries(c.filiales).sort((a, b) => b[1] - a[1])[0][0];
  const fin = c.dates[c.dates.length - 1] || null;
  // Pas de statut en base : une campagne active depuis juin 2026 est dite ouverte.
  return { id: `rec-${i + 1}`, intitule: c.intitule, f: f === 'null' ? null : f, bu: [...c.bu],
    debut: c.dates[0] || null, fin, statut: fin && fin >= '2026-06-01' ? 'ouverte' : 'cloturee' };
});
const idCampagne = Object.fromEntries(listeCampagnes.map(c => [c.intitule, c.id]));
candidats.forEach(c => { c.c = idCampagne[c.c]; });

// La mesure des competences n'est pas non plus un objet : une seule
// campagne, bornee par les tests factuels des techniciens.
const datesMesure = db.results.find({ type: 'Factuel', typeR: /Technicien/ }).toArray()
  .map(r => jour(r.created)).filter(Boolean).sort();
require('fs').writeFileSync(process.env.SORTIE, JSON.stringify({
  source: 'MEDACAP (base academy, copie locale) — agregats anonymises',
  extraitLe: new Date().toISOString().slice(0, 10),
  filiales: Object.values(filiales).map(f => ({ code: f.code, pays: f.pays, nom: f.nom })),
  campagnesRecrutement: listeCampagnes,
  campagnesMesure: [{ id: 'mes-1', intitule: 'Mesure des compétences techniciens',
    debut: datesMesure[0], fin: datesMesure[datesMesure.length - 1], statut: 'ouverte' }],
  candidats, techniciens,
}, null, 0), 'utf8');
