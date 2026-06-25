/* CFAO Academy — landing page interactions */

// ── BRAND DATA ────────────────────────────────────────
const BRAND_CATS = [
  { id: 'all',         label: 'Toutes' },
  { id: 'vl',          label: 'Véhicules légers' },
  { id: 'camions',     label: 'Camions & Bus' },
  { id: 'engins',      label: 'Engins' },
  { id: 'manutention', label: 'Manutention' },
];

const BRANDS = [
  { name: 'TOYOTA',          logo: 'assets/logos/toyota.png',          cat: 'VL · Pickup · Hybride',   group: 'vl',          n: 48 },
  { name: 'SUZUKI',          logo: 'assets/logos/suzuki.png',          cat: 'VL · Compact',             group: 'vl',          n: 14 },
  { name: 'BYD',             logo: 'assets/logos/byd.png',             cat: 'VL · Électrique',         group: 'vl',          n: 9  },
  { name: 'STELLANTIS',      logo: 'assets/logos/stellantis.png',      cat: 'VL · Multimarque',         group: 'vl',          n: 8  },
  { name: 'MITSUBISHI',      logo: 'assets/logos/mitsubishi.png',      cat: 'VL · 4×4 · Utilitaire',   group: 'vl',          n: 7  },
  { name: 'OMODA & JAECOO',  logo: 'assets/logos/omoda.png',           cat: 'VL · Premium',             group: 'vl',          n: 5  },
  { name: 'HINO',            logo: 'assets/logos/hino.png',            cat: 'Camions',                  group: 'camions',     n: 11 },
  { name: 'FUSO',            logo: 'assets/logos/fuso.png',            cat: 'Camions · Utilitaires',   group: 'camions',     n: 6  },
  { name: 'SINOTRUK',        logo: 'assets/logos/sinotruk.png',        cat: 'Camions lourds',           group: 'camions',     n: 18 },
  { name: 'SHACMAN',         logo: 'assets/logos/shacman.png',         cat: 'Camions BTP',              group: 'camions',     n: 7  },
  { name: 'MERCEDES TRUCKS', logo: 'assets/logos/mercedes.png',        cat: 'Camions premium',          group: 'camions',     n: 6  },
  { name: 'RENAULT TRUCKS',  logo: 'assets/logos/renault-trucks.png',  cat: 'Camions · CSR',            group: 'camions',     n: 9  },
  { name: 'KING LONG',       logo: 'assets/logos/kinglong.png',        cat: 'Bus · Transport',          group: 'camions',     n: 4  },
  { name: 'JCB',             logo: 'assets/logos/jcb.png',             cat: 'Engins TP',                group: 'engins',      n: 8  },
  { name: 'LOVOL',           logo: 'assets/logos/lovol.png',           cat: 'Engins · Agri',            group: 'engins',      n: 11 },
  { name: 'BT',              logo: 'assets/logos/bt.png',              cat: 'Manutention',              group: 'manutention', n: 3  },
  { name: 'TOYOTA MATERIAL', logo: 'assets/logos/toyota-forklift.png', cat: 'Manutention · Forklift',  group: 'manutention', n: 8  },
];

// ── BRAND WALL ────────────────────────────────────────
let currentBrandFilter = 'all';

function renderBrandTabs() {
  const tabsEl = document.getElementById('brand-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = BRAND_CATS.map(c => {
    const count = c.id === 'all' ? BRANDS.length : BRANDS.filter(b => b.group === c.id).length;
    return `<button class="brand-tab ${c.id === currentBrandFilter ? 'active' : ''}" data-brand-cat="${c.id}">${c.label} <span style="opacity:.55; margin-left:6px; font-family:'JetBrains Mono', monospace; font-size:11px">${count}</span></button>`;
  }).join('');
  tabsEl.querySelectorAll('.brand-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentBrandFilter = btn.dataset.brandCat;
      renderBrandTabs();
      renderBrandWall();
    });
  });
}

function renderBrandWall() {
  const brandWall = document.getElementById('brand-wall');
  if (!brandWall) return;
  const visible = currentBrandFilter === 'all'
    ? BRANDS
    : BRANDS.filter(b => b.group === currentBrandFilter);
  brandWall.innerHTML = visible.map(b => `
    <div class="brand-cell">
      <div class="count">${String(b.n).padStart(2,'0')} sessions</div>
      <div class="brand-logo"><img src="${b.logo}" alt="${b.name}" /></div>
      <div>
        <div class="cat">${b.cat}</div>
        <div class="name">${b.name}</div>
      </div>
    </div>
  `).join('');
}
renderBrandTabs();
renderBrandWall();

// ── LOGO MARQUEE ──────────────────────────────────────
const marqueeWrap = document.getElementById('logo-marquee');
if (marqueeWrap) {
  const logosList = BRANDS.map(b => `
    <div class="logo-pill"><img src="${b.logo}" alt="${b.name}" /></div>
  `).join('');
  marqueeWrap.innerHTML = `
    <div class="marquee">${logosList}${logosList}</div>
  `;
}

// ── SESSIONS CALENDAR ─────────────────────────────────
const SESSIONS = [
  { date:'2026-05-25', jours:5, niveau:"Niveau 2", formateur:"Brice NECHI", code:"SID02", nom:"STELLANTIS Révision/réparation des Moteurs essence et diesel des véhicules", marque:"STELLANTIS", lieu:"Douala", bu:"Techniques Motors", tagClass:'motors' },
  { date:'2026-05-25', jours:5, niveau:"Diagnostic", formateur:"Thierry KOUGHA", code:"LVL17", nom:"Diagnostic des systèmes des Tractopelles LOVOL", marque:"LOVOL", lieu:"RCI", bu:"Techniques Equipment", tagClass:'equipment' },
  { date:'2026-05-25', jours:5, niveau:"N1", formateur:"Thierry TAMO", code:"02N1", nom:"Redressage des éléments plans de la carrosserie acier des véhicules avant peinture", marque:"Carrosserie", lieu:"Côte d'Ivoire", bu:"Techniques Carrosserie", tagClass:'carrosserie' },
  { date:'2026-06-03', jours:2, niveau:"Niveau 1", formateur:"Thierry KOUGHA", code:"TP01", nom:"Argumentaire technique de vente des pièces de maintenance", marque:"TOYOTA FORKLIFT", lieu:"Distanciel", bu:"Parts & Process Equipment", tagClass:'parts-eq' },
  { date:'2026-06-08', jours:5, niveau:"N1", formateur:"Thierry TAMO", code:"04N1", nom:"Préparation des éléments de carrosserie avant l’application de produits de peinture", marque:"Carrosserie", lieu:"Côte d'Ivoire", bu:"Techniques Carrosserie", tagClass:'carrosserie' },
  { date:'2026-06-29', jours:5, niveau:"G3", formateur:"Eugène EBENE", code:"TS06-G3", nom:"Révision/réparation des organes électriques des véhicules (Climatisation, alternateur, démarreur et ", marque:"TOYOTA", lieu:"Togo", bu:"Techniques Motors", tagClass:'motors' },
  { date:'2026-06-29', jours:5, niveau:"Réparation", formateur:"Idris NKOA", code:"H02", nom:"Réparation Moteur WD615", marque:"SINOTRUK", lieu:"Bénin", bu:"Techniques Equipment", tagClass:'equipment' },
  { date:'2026-07-06', jours:5, niveau:"N1", formateur:"Thierry TAMO", code:"05N1", nom:"Remplacement et extrusion des vitrages collés du véhicule", marque:"Carrosserie", lieu:"Côte d'Ivoire", bu:"Techniques Carrosserie", tagClass:'carrosserie' },
  { date:'2026-07-06', jours:1, niveau:"Niveau 2", formateur:"Thierry KOUGHA", code:"TP02", nom:"Use platform SEO parts JCB", marque:"JCB", lieu:"Distanciel", bu:"Parts & Process Equipment", tagClass:'parts-eq' },
  { date:'2026-07-07', jours:1, niveau:"Niveau 1", formateur:"Gerold SADIO", code:"TM01", nom:"Définition du standard de l’organisation opérationnelle du département pièces", marque:"TOUTES MARQUES", lieu:"Distanciel", bu:"Parts & Process Motors", tagClass:'parts-motors' },
  { date:'2026-07-14', jours:1, niveau:"Niveau 5", formateur:"Gerold SADIO", code:"TM05", nom:"Pérennisation des actions d’amélioration opérationnelle d’un département pièces", marque:"TOUTES MARQUES", lieu:"Distanciel", bu:"Parts & Process Motors", tagClass:'parts-motors' },
  { date:'2026-07-27', jours:5, niveau:"G2", formateur:"Eugène EBENE", code:"TS08-G2", nom:"Diagnostic des systèmes de motorisation des véhicules", marque:"TOYOTA", lieu:"Burkina Faso", bu:"Techniques Motors", tagClass:'motors' },
  { date:'2026-08-03', jours:5, niveau:"Diagnostic", formateur:"Lucien GAGNE", code:"HI16", nom:"Diagnostic Système de freinage conventionnel (avec ABS)", marque:"HINO", lieu:"Douala", bu:"Techniques Equipment", tagClass:'equipment' },
  { date:'2026-08-04', jours:1, niveau:"Niveau 2", formateur:"Thierry KOUGHA", code:"TP02", nom:"Utilisation plateforme référencement pièces TOYOTA FORKLIFT", marque:"TOYOTA FORKLIFT", lieu:"Distanciel", bu:"Parts & Process Equipment", tagClass:'parts-eq' },
  { date:'2026-08-10', jours:1, niveau:"FTIR", formateur:"Gerold SADIO", code:"FTIR01", nom:"Élaboration d'un rapport d'anomalies techniques à communiquer au constructeur FTIR", marque:"SUZUKI", lieu:"Distanciel", bu:"Parts & Process Motors", tagClass:'parts-motors' },
  { date:'2026-08-24', jours:1, niveau:"FTR", formateur:"Gerold SADIO", code:"TFT01", nom:"Élaboration d'un rapport d'anomalies techniques à communiquer au constructeur (FTR)", marque:"TOYOTA", lieu:"Distanciel", bu:"Parts & Process Motors", tagClass:'parts-motors' },
  { date:'2026-08-24', jours:1, niveau:"Niveau 2", formateur:"Lucien GAGNE", code:"TP02", nom:"Utilisation plateforme référencement pièces FUSO", marque:"FUSO", lieu:"Distanciel", bu:"Parts & Process Equipment", tagClass:'parts-eq' },
  { date:'2026-08-31', jours:5, niveau:"G3", formateur:"Eugène EBENE", code:"TS03-G3", nom:"Révision/réparation des Moteurs essence et diesel des véhicules", marque:"TOYOTA", lieu:"RGE", bu:"Techniques Motors", tagClass:'motors' },
  { date:'2026-09-07', jours:5, niveau:"Réparation", formateur:"Lucien GAGNE", code:"RT10", nom:"Réparation / Révision de la boîte de vitesses Optidriver", marque:"RENAULT TRUCKS", lieu:"Douala", bu:"Techniques Equipment", tagClass:'equipment' },
  { date:'2026-09-07', jours:3, niveau:"N4", formateur:"Thierry TAMO", code:"—", nom:"Maîtriser les raccords sur les teintes multicouches", marque:"Carrosserie", lieu:"Côte d'Ivoire", bu:"Techniques Carrosserie", tagClass:'carrosserie' },
  { date:'2026-09-18', jours:1, niveau:"Niveau 2", formateur:"Lucien GAGNE", code:"TP02", nom:"Utilisation plateforme référencement pièces HINO", marque:"HINO", lieu:"Distanciel", bu:"Parts & Process Equipment", tagClass:'parts-eq' },
  { date:'2026-10-05', jours:5, niveau:"G3", formateur:"Eugène EBENE", code:"TS07-G3", nom:"Certification G3 : Révisions et réparations des organes et autres systèmes des véhicules (moteurs, c", marque:"TOYOTA", lieu:"Niger", bu:"Techniques Motors", tagClass:'motors' },
  { date:'2026-10-05', jours:5, niveau:"Diagnostic", formateur:"Idris NKOA", code:"KL09", nom:"Diagnostic Electrique", marque:"KING LONG", lieu:"Burkina Faso", bu:"Techniques Equipment", tagClass:'equipment' },
  { date:'2026-10-05', jours:5, niveau:"N1", formateur:"Thierry TAMO", code:"01N1", nom:"Débourrage des éléments plans de la carrosserie acier des véhicules", marque:"Carrosserie", lieu:"Cameroun", bu:"Techniques Carrosserie", tagClass:'carrosserie' },
  { date:'2026-10-12', jours:5, niveau:"Niveau 1", formateur:"Gerold SADIO", code:"TSA01", nom:"Gestion de la clientèle SAV par le conseiller service (TSA)", marque:"TOYOTA", lieu:"Douala", bu:"Parts & Process Motors", tagClass:'parts-motors' },
  { date:'2026-11-09', jours:5, niveau:"N2", formateur:"Thierry TAMO", code:"02N2", nom:"Redressage des éléments de carrosserie acier", marque:"Carrosserie", lieu:"Cameroun", bu:"Techniques Carrosserie", tagClass:'carrosserie' },
  { date:'2026-11-16', jours:5, niveau:"Niveau 1", formateur:"Cédric PAKO", code:"SID01", nom:"Maintenance préventive périodique et non-périodique des véhicules Stellantis", marque:"STELLANTIS", lieu:"Togo", bu:"Techniques Motors", tagClass:'motors' },
  { date:'2026-11-23', jours:5, niveau:"Réparation", formateur:"Idris NKOA", code:"H04", nom:"Réparation Système électrique", marque:"SINOTRUK", lieu:"Madagascar", bu:"Techniques Equipment", tagClass:'equipment' },
  { date:'2026-12-07', jours:1, niveau:"Niveau 3", formateur:"Gerold SADIO", code:"F003", nom:"Réception du véhicule avec le client au SAV", marque:"TOUTES MARQUES VL", lieu:"Distanciel", bu:"Parts & Process Motors", tagClass:'parts-motors' },
];

const FILTERS = [
  { id: 'all', label: 'Tous les programmes', count: 253 },
  { id: 'Techniques Motors', label: 'Techniques Motors', count: 113 },
  { id: 'Techniques Equipment', label: 'Techniques Equipment', count: 72 },
  { id: 'Techniques Carrosserie', label: 'Techniques Carrosserie', count: 29 },
  { id: 'Parts & Process Motors', label: 'Parts & Process Motors', count: 25 },
  { id: 'Parts & Process Equipment', label: 'Parts & Process Equipment', count: 14 },
];

const MOIS_SHORT = ['JAN','FÉV','MAR','AVR','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];

let currentFilter = 'all';

function todayCutoff() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function upcomingCounts() {
  const cutoff = todayCutoff();
  const upcoming = SESSIONS.filter(s => new Date(s.date) >= cutoff);
  const byBu = {};
  for (const s of upcoming) byBu[s.bu] = (byBu[s.bu] || 0) + 1;
  return { total: upcoming.length, byBu };
}

function renderFilters() {
  const bar = document.getElementById('cal-bar');
  const counts = upcomingCounts();
  bar.innerHTML = FILTERS.map(f => {
    const c = f.id === 'all' ? counts.total : (counts.byBu[f.id] || 0);
    return `
    <button class="chip ${f.id === currentFilter ? 'active' : ''}" data-filter="${f.id}">
      ${f.label} <span style="opacity:.55; margin-left:6px; font-family:'JetBrains Mono', monospace; font-size:11px">${c}</span>
    </button>`;
  }).join('');
  bar.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      currentFilter = c.dataset.filter;
      renderFilters();
      renderSessions();
    });
  });
}

function renderSessions() {
  const list = document.getElementById('sessions-list');
  // Show only sessions starting at least 7 days from today (next week onwards)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() + 0 * 24 * 60 * 60 * 1000); // from today
  const filtered = SESSIONS
    .filter(s => new Date(s.date) >= cutoff)
    .filter(s => currentFilter === 'all' ? true : s.bu === currentFilter);
  const shown = filtered.slice(0, 12);
  document.getElementById('sessions-shown').textContent = shown.length;
  const totalForFilter = FILTERS.find(f => f.id === currentFilter)?.count || filtered.length;
  document.getElementById('sessions-total').textContent = totalForFilter;
  if (shown.length === 0) {
    list.innerHTML = `<div style="padding: 48px 8px; color: var(--muted); text-align: center; border-bottom: 1px solid var(--rule);">
      Aucune session à venir pour ce filtre. <a href="#cta" style="color: var(--red); text-decoration: underline;">Demandez le catalogue complet</a>.
    </div>`;
    return;
  }
  list.innerHTML = shown.map(s => {
    const d = new Date(s.date);
    const day = String(d.getDate()).padStart(2,'0');
    const mo = MOIS_SHORT[d.getMonth()];
    const isDistanciel = s.lieu === 'Distanciel';
    const places = isDistanciel ? 'places sur demande' : '12 places';
    return `
      <div class="session">
        <div class="date">
          <div class="day">${day}</div>
          <div class="mo">${mo} · 2026</div>
        </div>
        <div class="title">
          <small>${s.code} · ${s.marque} · <span class="lvl">${s.niveau}</span></small>
          ${s.nom}
          <div class="meta">Formateur <strong>${s.formateur}</strong> · ${places}</div>
        </div>
        <span class="tag ${s.tagClass}">${s.bu}</span>
        <div class="place">${isDistanciel ? '<em>(en ligne)</em>' : s.lieu} <span class="dur">· ${s.jours} ${s.jours > 1 ? 'jours' : 'jour'}</span></div>
        <a href="#" class="open" aria-label="Voir la session">↗</a>
      </div>
    `;
  }).join('');
}

renderFilters();
renderSessions();

// ── ROI TABS ──────────────────────────────────────────
document.querySelectorAll('.roi-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.roi;
    document.querySelectorAll('.roi-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.roi-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === target));
  });
});

// ── NEWS DATA ─────────────────────────────────────────
const NEWS_CATS = [
  { id: 'all', label: 'Toutes' },
  { id: 'Techniques Motors', label: 'Techniques Motors' },
  { id: 'Techniques Equipment', label: 'Techniques Equipment' },
  { id: 'Techniques Carrosserie', label: 'Techniques Carrosserie' },
  { id: 'Parts & Process Motors', label: 'Parts & Process Motors' },
  { id: 'Parts & Process Equipment', label: 'Parts & Process Equipment' },
  { id: 'Événement', label: 'Événement' },
];

const NEWS_ITEMS = [
  // ───── TECHNIQUES MOTORS ─────
  {
    cat: 'Techniques Motors', date: '2026-05-14', readtime: '4 min',
    tone: 't2', brand: 'TOYOTA', featured: true,
    h: 'Cursus BEV : la première promotion de l\'année a obtenu sa certification.',
    p: 'Sept techniciens diplômés sur le premier module BEV de 2026 — diagnostic batteries haute-tension et procédures de sécurité. Le retour des stagiaires est unanime : approche très concrète.'
  },
  {
    cat: 'Techniques Motors', date: '2026-04-12', readtime: '2 min',
    tone: 't3', brand: 'BYD',
    h: 'BYD : retour sur la première session véhicules électriques en Afrique francophone.',
    p: 'Huit techniciens diplômés au premier cursus BYD, désormais habilités à intervenir sur les batteries haute-tension.'
  },
  {
    cat: 'Techniques Motors', date: '2026-03-30',
    tone: 't2', brand: 'SUZUKI',
    h: 'SUZUKI Z12E : démontage / remontage moteur, retour sur la session de janvier.',
  },
  {
    cat: 'Techniques Motors', date: '2026-02-20',
    tone: 't1', brand: 'TOYOTA',
    h: 'Certification G3 châssis : 9 nouveaux experts Toyota diplômés à Douala.',
  },
  {
    cat: 'Techniques Motors', date: '2026-01-23',
    tone: 't3', brand: 'TOYOTA',
    h: 'Session inaugurale BEV : avis d\'intervention sur véhicule électrique au Nigeria.',
  },

  // ───── TECHNIQUES EQUIPMENT ─────
  {
    cat: 'Techniques Equipment', date: '2026-05-10', readtime: '3 min',
    tone: 't2', brand: 'LOVOL', featured: true,
    h: 'LOVOL niveleuses : 11 techniciens certifiés à Douala.',
    p: 'Le cursus LOVOL Construction démarre en force : 11 techniciens diplômés sur la maintenance et le diagnostic des niveleuses. Retours très positifs sur la qualité de l\'atelier.'
  },
  {
    cat: 'Techniques Equipment', date: '2026-01-22', readtime: '2 min',
    tone: 't3', brand: 'SINOTRUK',
    h: 'SINOTRUK WD615 : retour sur la session diagnostic moteur au Togo.',
    p: 'Diagnostic électronique des camions lourds, lecture des trames, outils constructeur. Cinq jours intenses à Lomé.'
  },
  {
    cat: 'Techniques Equipment', date: '2026-01-15', readtime: '2 min',
    tone: 't1', brand: 'RENAULT TRUCKS',
    h: 'CSR Fundamentals Training : première promotion RENAULT TRUCKS de 2026.',
  },
  {
    cat: 'Techniques Equipment', date: '2026-03-09',
    tone: 't3', brand: 'HINO',
    h: 'HINO : 6 techniciens formés sur le freinage conventionnel ABS à Douala.',
  },
  {
    cat: 'Techniques Equipment', date: '2026-04-27',
    tone: 't2', brand: 'SINOTRUK',
    h: 'Réparation système électrique SINOTRUK : session de mars complète au Togo.',
  },

  // ───── TECHNIQUES CARROSSERIE ─────
  {
    cat: 'Techniques Carrosserie', date: '2026-04-30', readtime: '4 min',
    tone: 't4', brand: null, featured: true,
    h: 'Atelier carrosserie Côte d\'Ivoire : session "redressage" complète, 12 stagiaires.',
    p: 'Le cursus N1 a affiché complet en moins de 10 jours. Thierry TAMO, formateur dédié, a accompagné 12 stagiaires sur 5 jours de pratique intensive.'
  },
  {
    cat: 'Techniques Carrosserie', date: '2026-04-24', readtime: '2 min',
    tone: 't2', brand: null,
    h: 'Débourrage N1 : la première session de l\'année s\'est tenue en avril.',
    p: 'Cinq jours pour maîtriser le débourrage des éléments plans en acier. Bilan : 10 carrossiers diplômés.'
  },
  {
    cat: 'Techniques Carrosserie', date: '2026-02-15',
    tone: 't3', brand: null,
    h: 'Refonte complète du cursus carrosserie : 5 niveaux N1 à N5, présentation détaillée.',
  },
  {
    cat: 'Techniques Carrosserie', date: '2026-03-22',
    tone: 't4', brand: null,
    h: 'Retour d\'expérience : trois carrossiers Abidjan racontent leur parcours N1 à N3.',
  },

  // ───── PARTS & PROCESS MOTORS ─────
  {
    cat: 'Parts & Process Motors', date: '2026-04-08', readtime: '5 min',
    tone: 't4', brand: 'TOYOTA', featured: true,
    h: 'Nouvelle plateforme distancielle pièces : 40+ modules désormais disponibles.',
    p: 'Connectez-vous depuis votre poste pour suivre les modules Parts & Process : organisation du département, audit conformité, plan d\'amélioration. Plateforme officiellement ouverte en avril.'
  },
  {
    cat: 'Parts & Process Motors', date: '2026-03-15',
    tone: 't2', brand: null,
    h: 'Filiale Sénégal : retour d\'expérience sur l\'audit Parts & Process.',
  },
  {
    cat: 'Parts & Process Motors', date: '2026-02-28',
    tone: 't1', brand: 'TOYOTA',
    h: 'TSA Toyota : formation pilote sur la gestion client SAV par le conseiller service.',
  },
  {
    cat: 'Parts & Process Motors', date: '2026-04-30',
    tone: 't3', brand: 'TOYOTA',
    h: 'Élaboration des rapports d\'anomalies techniques : session pilote en avril.',
  },

  // ───── PARTS & PROCESS EQUIPMENT ─────
  {
    cat: 'Parts & Process Equipment', date: '2026-04-22', readtime: '3 min',
    tone: 't1', brand: 'TOYOTA MATERIAL', featured: true,
    h: 'Plateforme référencement pièces : démarrage avril pour les chariots élévateurs.',
    p: 'Le module TP02 ouvre la voie : référencer ses pièces sur la plateforme constructeur, gérer ses commandes et son stock atelier.'
  },
  {
    cat: 'Parts & Process Equipment', date: '2026-04-29',
    tone: 't4', brand: null,
    h: 'Formation pièces distanciel : seconde session conduite par Idris NKOA.',
  },
  {
    cat: 'Parts & Process Equipment', date: '2026-05-07',
    tone: 't3', brand: null,
    h: 'Plateforme pièces : Thierry KOUGHA anime la session distanciel de mai.',
  },

  // ───── ÉVÉNEMENT ─────
  {
    cat: 'Événement', date: '2026-03-25', readtime: '5 min',
    tone: 't2', brand: null, featured: true,
    h: 'Rencontres formateurs 2026 : trois jours d\'échange à Douala.',
    p: 'Tous les formateurs de l\'Academy réunis à Douala pour trois jours d\'échange sur les nouveautés constructeurs et le partage des bonnes pratiques pédagogiques.'
  },
  {
    cat: 'Événement', date: '2026-02-10', readtime: '2 min',
    tone: 't3', brand: 'TOYOTA',
    h: 'Visite usine Toyota : 6 formateurs sélectionnés pour le voyage Aichi.',
  },
  {
    cat: 'Événement', date: '2026-04-18',
    tone: 't1', brand: null,
    h: 'Open Day Academy Douala : 200+ visiteurs pour les portes ouvertes d\'avril.',
  },
  {
    cat: 'Événement', date: '2026-01-12',
    tone: 't4', brand: null,
    h: 'Coup d\'envoi de l\'année 2026 : présentation du plan de formation aux directeurs.',
  },
];

const BRAND_LOGO_MAP = Object.fromEntries(BRANDS.map(b => [b.name, b.logo]));

let currentNewsCat = 'all';

function newsCardHTML(item, opts = {}) {
  const d = new Date(item.date);
  const day = String(d.getDate()).padStart(2,'0');
  const moList = ['JAN','FÉV','MAR','AVR','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];
  const dateStr = `${day} ${moList[d.getMonth()]} ${d.getFullYear()}`;
  const meta = item.readtime ? `${dateStr} · ${item.readtime} LECTURE` : dateStr;
  const showFeatured = opts.allowFeatured && item.featured;
  const tagLabel = showFeatured ? 'À la une' : item.cat;
  const logoSrc = item.brand && BRAND_LOGO_MAP[item.brand];
  const logoChip = logoSrc ? `<div class="brand-logo-chip"><img src="${logoSrc}" alt="${item.brand}" /></div>` : '';
  const featuredClass = showFeatured ? ' featured' : '';
  const para = item.p ? `<p>${item.p}</p>` : '';
  return `
    <a href="#" class="news-card${featuredClass}" data-cat="${item.cat}">
      <div class="news-thumb ${item.tone}">
        <span class="news-tag">${tagLabel}</span>
        ${logoChip}
        <svg viewBox="0 0 400 250">
          <circle cx="80" cy="60" r="60" fill="white" opacity="0.10"/>
          <circle cx="340" cy="200" r="80" fill="white" opacity="0.08"/>
          <rect x="120" y="120" width="180" height="40" fill="white" opacity="0.10" rx="6"/>
        </svg>
      </div>
      <div class="news-body">
        <div class="meta">${meta}</div>
        <h3>${item.h}</h3>
        ${para}
      </div>
    </a>
  `;
}

function renderNewsTabs() {
  const el = document.getElementById('news-tabs');
  if (!el) return;
  el.innerHTML = NEWS_CATS.map(c => {
    const count = c.id === 'all' ? NEWS_ITEMS.length : NEWS_ITEMS.filter(n => n.cat === c.id).length;
    return `<button class="news-tab ${c.id === currentNewsCat ? 'active' : ''}" data-news-cat="${c.id}">${c.label}<span class="tab-count">${count}</span></button>`;
  }).join('');
  el.querySelectorAll('.news-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentNewsCat = btn.dataset.newsCat;
      renderNewsTabs();
      renderNews();
    });
  });
}

function renderNews() {
  const shell = document.querySelector('.news-shell');
  const track = document.getElementById('news-track');
  const isAll = currentNewsCat === 'all';
  // Always carousel mode — homogeneous small cards across all tabs
  shell.classList.add('mode-carousel');
  const items = isAll
    ? NEWS_ITEMS.slice().sort((a, b) => b.date.localeCompare(a.date))
    : NEWS_ITEMS.filter(n => n.cat === currentNewsCat).sort((a, b) => b.date.localeCompare(a.date));
  track.innerHTML = items.map(i => newsCardHTML(i, { allowFeatured: false })).join('');
  // reset scroll
  track.scrollLeft = 0;
  updateNewsArrows();
}

function updateNewsArrows() {
  const track = document.getElementById('news-track');
  const prev = document.getElementById('news-prev');
  const next = document.getElementById('news-next');
  if (!track) return;
  prev.disabled = track.scrollLeft <= 4;
  next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
}

document.getElementById('news-prev')?.addEventListener('click', () => {
  const track = document.getElementById('news-track');
  track.scrollBy({ left: -380, behavior: 'smooth' });
});
document.getElementById('news-next')?.addEventListener('click', () => {
  const track = document.getElementById('news-track');
  track.scrollBy({ left: 380, behavior: 'smooth' });
});
document.getElementById('news-track')?.addEventListener('scroll', () => {
  requestAnimationFrame(updateNewsArrows);
});

renderNewsTabs();
renderNews();

// ── REVEAL ON SCROLL ──────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
document.querySelectorAll('.reveal, .stagger').forEach(el => io.observe(el));

// hero h1 reveal
requestAnimationFrame(() => {
  document.querySelector('.hero-h1')?.classList.add('shown');
});

// ── PARALLAX (scroll-linked transforms) ───────────────
const parallaxEls = [...document.querySelectorAll('.parallax')];
const parallaxXEls = [...document.querySelectorAll('.parallax-x')];

function getElementCenterY(el) {
  const r = el.getBoundingClientRect();
  return r.top + r.height / 2;
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const vh = window.innerHeight;
    const sy = window.scrollY;

    parallaxEls.forEach(el => {
      const speed = parseFloat(el.dataset.speed || '0.1');
      const rect = el.getBoundingClientRect();
      // Distance from viewport center
      const center = rect.top + rect.height / 2;
      const offset = (center - vh / 2) * speed;
      el.style.transform = `translate3d(0, ${(-offset).toFixed(2)}px, 0)`;
    });

    // X-axis parallax for the running text
    parallaxXEls.forEach(el => {
      const speed = parseFloat(el.dataset.speed || '0.3');
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const offset = (center - vh / 2) * speed;
      el.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
    });

    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ── ANIMATED COUNTERS ─────────────────────────────────
function pulseOnView(selector) {
  const els = document.querySelectorAll(selector);
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.animate(
        [
          { transform: 'translateY(8px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ],
        { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }
      );
      obs.unobserve(e.target);
    });
  }, { threshold: 0.4 });
  els.forEach(el => obs.observe(el));
}
pulseOnView('.kpi .num');
pulseOnView('.sig-stat .num');

// ── CURSOR GLOW ───────────────────────────────────────
const glow = document.getElementById('cursor-glow');
if (glow && matchMedia('(pointer:fine)').matches) {
  let x = 0, y = 0, tx = 0, ty = 0;
  window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; glow.style.opacity = '1'; });
  function loop() {
    x += (tx - x) * 0.12;
    y += (ty - y) * 0.12;
    glow.style.left = x + 'px';
    glow.style.top = y + 'px';
    requestAnimationFrame(loop);
  }
  loop();
}

// ── SCROLL PROGRESS BAR ───────────────────────────────
const progressBar = document.createElement('div');
progressBar.className = 'scroll-progress';
document.body.appendChild(progressBar);
function updateProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = Math.max(0, Math.min(100, (window.scrollY / max) * 100));
  progressBar.style.width = pct + '%';
}
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

// ── TESTIMONIAL FLOAT-UP (middle card lifts when in view) ─
const tObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      document.querySelectorAll('.testimonial').forEach((t, i) => {
        if (i === 1) t.classList.add('float-up');
      });
      tObs.disconnect();
    }
  });
}, { threshold: 0.3 });
const firstTesti = document.querySelector('.testimonial');
if (firstTesti) tObs.observe(firstTesti);

// ── MAGNETIC BUTTONS (subtle pull) ────────────────────
document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const r = btn.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.18;
    const y = (e.clientY - r.top - r.height / 2) * 0.25;
    btn.style.transform = `translate(${x}px, ${y}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});

// ── NUMERIC COUNTERS (kpi) ────────────────────────────
const kpiNums = document.querySelectorAll('.kpi .num, .sig-stat .num, .hero-floating-card .num');
const numObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    if (el.dataset.done) return;
    el.dataset.done = '1';
    // Cache original html
    const original = el.innerHTML;
    // Find the raw target digits anywhere in textContent
    const text = el.textContent.replace(/\u00A0/g, ' ');
    const m = text.match(/(\d[\d\s]*)/);
    if (!m) return;
    const target = parseInt(m[1].replace(/\s/g, ''), 10);
    if (isNaN(target) || target < 5) return;
    const dur = 1400;
    const start = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function format(n) {
      if (n >= 1000) return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
      return String(n);
    }
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(target * ease(t));
      const replaced = original.replace(m[1].replace(/\s/g, '\u00A0'), format(v))
                               .replace(m[1], format(v));
      el.innerHTML = replaced;
      if (t < 1) requestAnimationFrame(frame);
      else el.innerHTML = original;
    }
    requestAnimationFrame(frame);
    numObs.unobserve(el);
  });
}, { threshold: 0.5 });
kpiNums.forEach(el => numObs.observe(el));
