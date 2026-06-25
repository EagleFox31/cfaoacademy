/* CFAO Academy — données catalogue (source de vérité unique)
   Réconciliées sur le wireframe validé. Chargé en global (window.ACADEMY_DATA). */
(function () {

  // ── CHIFFRES CANONIQUES ────────────────────────────────
  const STATS = {
    sessions: 253,
    jours: 1114,
    bu: 5,
    marques: 22,
    experts: 28,
    ki: 18,
    picMulti: 22,
    picDev: 35,
    paysActifs: 29,
    paysPotentiels: 4,
  };

  // ── NAVIGATION (vrai multi-pages) ───────────────────────
  const NAV = [
    { label: "Accueil",     href: "Accueil.html",     key: "accueil" },
    { label: "Publics",     href: "Publics.html",     key: "publics" },
    { label: "Formations",  href: "Formations.html",  key: "formations" },
    { label: "Marques",     href: "Marques.html",     key: "marques" },
    { label: "Sessions",    href: "Sessions.html",    key: "sessions" },
    { label: "Actualités",  href: "Actualites.html",  key: "actualites" },
    { label: "L'Academy",   href: "Academy.html",     key: "academy" },
  ];

  const MOIS_SHORT = ['JAN','FÉV','MAR','AVR','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];

  // ── BUSINESS UNITS (5) ──────────────────────────────────
  const BU = [
    { id: "Techniques Motors",          short: "Motors",      n: 113, meta: "VL · Moto",                          tag: "motors" },
    { id: "Techniques Equipment",       short: "Equipment",   n: 72,  meta: "Camions · Bus · Engins · Chariots",  tag: "equipment" },
    { id: "Techniques Carrosserie",     short: "Carrosserie", n: 29,  meta: "N1 → N5",                            tag: "carrosserie" },
    { id: "Parts & Process Motors",     short: "Parts Motors",n: 25,  meta: "Audit · Standard",                   tag: "parts-motors" },
    { id: "Parts & Process Equipment",  short: "Parts Eq.",   n: 14,  meta: "Plateformes pièces",                 tag: "parts-eq" },
  ];

  // ── PUBLICS (7) ─────────────────────────────────────────
  const PUBLICS = [
    { name: "Techniciens",          kicker: "Atelier · G4→G1",  meta: "Maintenance · Réparation · Diagnostic",  famille: "Atelier" },
    { name: "Carrossiers",          kicker: "Atelier · N1→N5",  meta: "Débourrage → peinture multicouches",     famille: "Atelier" },
    { name: "Parts",                kicker: "Pièces",           meta: "Référencement · stock · vente",          famille: "Process & SAV" },
    { name: "Technico-commerciaux", kicker: "Vente",            meta: "Argumentaire technique",                 famille: "Vente" },
    { name: "Commerciaux",          kicker: "Vente",            meta: "Réception · prise en charge",            famille: "Vente" },
    { name: "Process SAV & Parts",  kicker: "Process",          meta: "Standards · audit · KPI",                famille: "Process & SAV" },
    { name: "Clients",              kicker: "Client B2B",       meta: "Techniciens & SAV externes",             famille: "Clients" },
  ];

  // ── MARQUES (catégories du wireframe) ───────────────────
  const BRAND_CATS = [
    { id: "all",      label: "Toutes" },
    { id: "vl",       label: "VL" },
    { id: "moto",     label: "Moto & Bateaux" },
    { id: "camions",  label: "Camions" },
    { id: "bus",      label: "Bus" },
    { id: "chariots", label: "Chariots" },
    { id: "engins",   label: "Engins" },
  ];

  const BRANDS = [
    { name: "Toyota",         logo: "assets/logos/toyota.png",          cat: "VL · G4→G1",            group: "vl",       n: 48, niveaux: "Niveau de référence" },
    { name: "Mercedes-Benz",  logo: "assets/logos/mercedes.png",        cat: "VL · BASIC→CERTIFIED",  group: "vl",       n: 12, niveaux: "5 paliers" },
    { name: "Suzuki",         logo: "assets/logos/suzuki.png",          cat: "VL · Bronze→Gold",      group: "vl",       n: 14, niveaux: "3 paliers" },
    { name: "BYD",            logo: "assets/logos/byd.png",             cat: "VL · BEV",              group: "vl",       n: 9,  niveaux: "Électrique" },
    { name: "Mitsubishi",     logo: "assets/logos/mitsubishi.png",      cat: "VL · Step 1→3",         group: "vl",       n: 7,  niveaux: "3 paliers" },
    { name: "Omoda & Jaecoo", logo: "assets/logos/omoda.png",           cat: "VL · Premium",          group: "vl",       n: 5,  niveaux: "Nouvelles arrivées" },
    { name: "Stellantis",     logo: "assets/logos/stellantis.png",      cat: "VL · Citroën·Peugeot·Jeep·Fiat", group: "vl", n: 8, niveaux: "SID" },
    { name: "Citroën",        logo: "assets/logos/citroen.png",         cat: "VL · Stellantis",       group: "vl",       n: 4,  niveaux: "SID" },
    { name: "Yamaha",         logo: null,                                cat: "Moto & Bateaux",        group: "moto",     n: 6,  niveaux: "Burkina Faso" },
    { name: "Renault Trucks", logo: "assets/logos/renault-trucks.png",  cat: "Camions",               group: "camions",  n: 9,  niveaux: "—" },
    { name: "Hino",           logo: "assets/logos/hino.png",            cat: "Camions",               group: "camions",  n: 11, niveaux: "—" },
    { name: "Fuso",           logo: "assets/logos/fuso.png",            cat: "Camions · Utilitaires", group: "camions",  n: 6,  niveaux: "—" },
    { name: "Sinotruk",       logo: "assets/logos/sinotruk.png",        cat: "Camions lourds",        group: "camions",  n: 18, niveaux: "—" },
    { name: "Shacman",        logo: "assets/logos/shacman.png",         cat: "Camions BTP",           group: "camions",  n: 7,  niveaux: "—" },
    { name: "Mercedes Trucks",logo: "assets/logos/mercedes.png",        cat: "Camions premium",       group: "camions",  n: 6,  niveaux: "—" },
    { name: "King Long",      logo: "assets/logos/kinglong.png",        cat: "Bus · Transport",       group: "bus",      n: 4,  niveaux: "—" },
    { name: "Toyota Bus",     logo: "assets/logos/toyota.png",          cat: "Bus",                   group: "bus",      n: 3,  niveaux: "—" },
    { name: "BT",             logo: "assets/logos/bt.png",              cat: "Chariots · Forklift",   group: "chariots", n: 3,  niveaux: "—" },
    { name: "Toyota Material",logo: "assets/logos/toyota-forklift.png", cat: "Chariots · Forklift",   group: "chariots", n: 8,  niveaux: "—" },
    { name: "JCB",            logo: "assets/logos/jcb.png",             cat: "Engins TP",             group: "engins",   n: 8,  niveaux: "—" },
    { name: "Lovol",          logo: "assets/logos/lovol.png",           cat: "Engins · Agri",         group: "engins",   n: 11, niveaux: "—" },
  ];

  // ── SESSIONS (échantillon réel du calendrier 2026) ──────
  const SESSIONS = [
    { date:'2026-05-25', jours:5, niveau:"Niveau 2", formateur:"Brice NECHI",   code:"SID02",   nom:"Révision/réparation des moteurs essence et diesel", marque:"STELLANTIS",      lieu:"Douala",          bu:"Techniques Motors",          tagClass:'motors' },
    { date:'2026-05-25', jours:5, niveau:"Diagnostic",formateur:"Thierry KOUGHA",code:"LVL17",   nom:"Diagnostic des systèmes des tractopelles", marque:"LOVOL",           lieu:"RCI",             bu:"Techniques Equipment",       tagClass:'equipment' },
    { date:'2026-05-25', jours:5, niveau:"N1",        formateur:"Thierry TAMO",  code:"02N1",    nom:"Redressage des éléments plans acier avant peinture", marque:"Carrosserie",     lieu:"Côte d'Ivoire",   bu:"Techniques Carrosserie",     tagClass:'carrosserie' },
    { date:'2026-06-03', jours:2, niveau:"Niveau 1",  formateur:"Thierry KOUGHA",code:"TP01",    nom:"Argumentaire technique de vente des pièces", marque:"TOYOTA FORKLIFT", lieu:"Distanciel",      bu:"Parts & Process Equipment",  tagClass:'parts-eq' },
    { date:'2026-06-08', jours:5, niveau:"N1",        formateur:"Thierry TAMO",  code:"04N1",    nom:"Préparation des éléments de carrosserie avant peinture", marque:"Carrosserie",     lieu:"Côte d'Ivoire",   bu:"Techniques Carrosserie",     tagClass:'carrosserie' },
    { date:'2026-06-29', jours:5, niveau:"G3",        formateur:"Eugène EBENE",  code:"TS06-G3", nom:"Révision/réparation des organes électriques des véhicules", marque:"TOYOTA",          lieu:"Togo",            bu:"Techniques Motors",          tagClass:'motors' },
    { date:'2026-06-29', jours:5, niveau:"Réparation",formateur:"Idris NKOA",    code:"H02",     nom:"Réparation moteur WD615", marque:"SINOTRUK",        lieu:"Bénin",           bu:"Techniques Equipment",       tagClass:'equipment' },
    { date:'2026-07-06', jours:5, niveau:"N1",        formateur:"Thierry TAMO",  code:"05N1",    nom:"Remplacement et extrusion des vitrages collés", marque:"Carrosserie",     lieu:"Côte d'Ivoire",   bu:"Techniques Carrosserie",     tagClass:'carrosserie' },
    { date:'2026-07-07', jours:1, niveau:"Niveau 1",  formateur:"Gérold SADIO",  code:"TM01",    nom:"Standard de l'organisation opérationnelle du département pièces", marque:"TOUTES MARQUES",  lieu:"Distanciel",      bu:"Parts & Process Motors",     tagClass:'parts-motors' },
    { date:'2026-07-27', jours:5, niveau:"G2",        formateur:"Eugène EBENE",  code:"TS08-G2", nom:"Diagnostic des systèmes de motorisation", marque:"TOYOTA",          lieu:"Burkina Faso",    bu:"Techniques Motors",          tagClass:'motors' },
    { date:'2026-08-03', jours:5, niveau:"Diagnostic",formateur:"Lucien GAGNE",  code:"HI16",    nom:"Diagnostic système de freinage conventionnel (ABS)", marque:"HINO",            lieu:"Douala",          bu:"Techniques Equipment",       tagClass:'equipment' },
    { date:'2026-08-10', jours:1, niveau:"FTIR",      formateur:"Gérold SADIO",  code:"FTIR01",  nom:"Rapport d'anomalies techniques constructeur (FTIR)", marque:"SUZUKI",          lieu:"Distanciel",      bu:"Parts & Process Motors",     tagClass:'parts-motors' },
    { date:'2026-08-31', jours:5, niveau:"G3",        formateur:"Eugène EBENE",  code:"TS03-G3", nom:"Révision/réparation des moteurs essence et diesel", marque:"TOYOTA",          lieu:"RGE",             bu:"Techniques Motors",          tagClass:'motors' },
    { date:'2026-09-07', jours:5, niveau:"Réparation",formateur:"Lucien GAGNE",  code:"RT10",    nom:"Réparation/révision de la boîte de vitesses Optidriver", marque:"RENAULT TRUCKS",  lieu:"Douala",          bu:"Techniques Equipment",       tagClass:'equipment' },
    { date:'2026-09-07', jours:3, niveau:"N4",        formateur:"Thierry TAMO",  code:"—",       nom:"Maîtriser les raccords sur les teintes multicouches", marque:"Carrosserie",     lieu:"Côte d'Ivoire",   bu:"Techniques Carrosserie",     tagClass:'carrosserie' },
    { date:'2026-10-05', jours:5, niveau:"G3",        formateur:"Eugène EBENE",  code:"TS07-G3", nom:"Certification G3 : révisions et réparations des organes", marque:"TOYOTA",          lieu:"Niger",           bu:"Techniques Motors",          tagClass:'motors' },
    { date:'2026-10-05', jours:5, niveau:"Diagnostic",formateur:"Idris NKOA",    code:"KL09",    nom:"Diagnostic électrique", marque:"KING LONG",       lieu:"Burkina Faso",    bu:"Techniques Equipment",       tagClass:'equipment' },
    { date:'2026-10-12', jours:5, niveau:"Niveau 1",  formateur:"Gérold SADIO",  code:"TSA01",   nom:"Gestion de la clientèle SAV par le conseiller service", marque:"TOYOTA",          lieu:"Douala",          bu:"Parts & Process Motors",     tagClass:'parts-motors' },
    { date:'2026-11-09', jours:5, niveau:"N2",        formateur:"Thierry TAMO",  code:"02N2",    nom:"Redressage des éléments de carrosserie acier", marque:"Carrosserie",     lieu:"Cameroun",        bu:"Techniques Carrosserie",     tagClass:'carrosserie' },
    { date:'2026-11-16', jours:5, niveau:"Niveau 1",  formateur:"Cédric PAKO",   code:"SID01",   nom:"Maintenance préventive périodique et non-périodique", marque:"STELLANTIS",      lieu:"Togo",            bu:"Techniques Motors",          tagClass:'motors' },
    { date:'2026-11-23', jours:5, niveau:"Réparation",formateur:"Idris NKOA",    code:"H04",     nom:"Réparation système électrique", marque:"SINOTRUK",        lieu:"Madagascar",      bu:"Techniques Equipment",       tagClass:'equipment' },
    { date:'2026-12-07', jours:1, niveau:"Niveau 3",  formateur:"Gérold SADIO",  code:"F003",    nom:"Réception du véhicule avec le client au SAV", marque:"TOUTES MARQUES VL",lieu:"Distanciel",      bu:"Parts & Process Motors",     tagClass:'parts-motors' },
  ];

  // ── ACTUALITÉS ──────────────────────────────────────────
  const NEWS_CATS = [
    { id: "all",            label: "À la une" },
    { id: "Sessions",       label: "Sessions" },
    { id: "Certifications", label: "Certifications" },
    { id: "Terrain",        label: "Terrain" },
  ];

  const NEWS = [
    { cat:"Terrain",        date:"2026-04-12", readtime:"2 min", tone:"t3", brand:"BYD",          h:"BYD : première session véhicules électriques en Afrique francophone.", p:"Huit techniciens diplômés au premier cursus BYD, désormais habilités à intervenir sur les batteries haute-tension." },
    { cat:"Certifications", date:"2026-03-30", tone:"t2", brand:"SUZUKI",       h:"SUZUKI Z12E : démontage / remontage moteur, retour sur la session de janvier." },
    { cat:"Sessions",       date:"2026-04-27", tone:"t1", brand:"MITSUBISHI",   h:"Mitsubishi Step 2 au Nigeria : cycle complet sur cinq jours." },
    { cat:"Terrain",        date:"2026-01-22", readtime:"2 min", tone:"t2", brand:"SINOTRUK",     h:"SINOTRUK WD615 : retour sur la session diagnostic moteur au Togo." },
    { cat:"Sessions",       date:"2026-01-23", tone:"t3", brand:"TOYOTA",       h:"Session inaugurale BEV : avis d'intervention sur véhicule électrique au Nigeria." },
    { cat:"Certifications", date:"2026-02-20", tone:"t1", brand:"TOYOTA",       h:"Certification G3 châssis : 9 nouveaux experts Toyota diplômés à Douala." },
    { cat:"Terrain",        date:"2026-04-30", readtime:"4 min", tone:"t4", brand:null,           h:"Atelier carrosserie Côte d'Ivoire : session « redressage » complète, 12 stagiaires." },
    { cat:"Sessions",       date:"2026-05-10", readtime:"3 min", tone:"t2", brand:"LOVOL",        h:"LOVOL niveleuses : 11 techniciens certifiés à Douala." },
  ];

  // ── L'ACADEMY — aperçu institutionnel ───────────────────
  const ACADEMY_PREVIEW = [
    { kicker:"Andragogie",  title:"Apprentissage par la pratique", meta:"Gestes métiers terrain" },
    { kicker:"28 experts",  title:"5 pôles · multi-marques",       meta:"Cameroun · 9+ pays" },
    { kicker:"Réseau",      title:"18 KI + 22 PIC Multi + 35 PIC Dév.", meta:"Décentralisation" },
    { kicker:"Pays",        title:"29 actifs + 4 potentiels",      meta:"Afrique" },
  ];

  // ── ÉQUIPE (28) & RÉSEAU KI (18) — pour pages futures ───
  const TEAM = [
    { name:"Laurent GONIN",        role:"Directeur formation",          lieu:"",            pole:"Supports",          photo:"assets/team/laurent-gonin.png" },
    { name:"André Yves BOKALLY",   role:"Coordinateur",                 lieu:"Cameroun",    pole:"Supports",          photo:"assets/team/andre-yves-bokally.png" },
    { name:"Claudia EYINGA",       role:"Assistante formation",         lieu:"Cameroun",    pole:"Supports",          photo:"assets/team/claudia-eyinga.png" },
    { name:"Jennifer AKA'A",       role:"Analyste programmeuse",        lieu:"Cameroun",    pole:"Supports",          photo:"assets/team/jennifer-akaa.png" },
    { name:"Eugène EBENE",         role:"Formateur Toyota",             lieu:"Cameroun",    pole:"Toyota",            photo:"assets/team/eugene-ebene.png" },
    { name:"Alassane DIALLO",      role:"Formateur Toyota",             lieu:"Sénégal",     pole:"Toyota",            photo:"assets/team/alassane-diallo.png" },
    { name:"Jacques MAVILA",       role:"Formateur Toyota & Suzuki",    lieu:"RDC",         pole:"Toyota",            photo:"assets/team/jacques-mavila.png" },
    { name:"Brice NECHI",          role:"Formateur Stellantis & Toyota",lieu:"Cameroun",    pole:"Toyota",            photo:"assets/team/brice-nechi.png" },
    { name:"Cédric PAKO",          role:"Suzuki, BYD & Omoda",          lieu:"Cameroun",    pole:"Autres marques",    photo:"assets/team/cedric-pako.png" },
    { name:"Hatem BEN ABID",       role:"Mercedes-Benz",                lieu:"Côte d'Ivoire",pole:"Autres marques",   photo:"assets/team/hatem-ben-abid.png" },
    { name:"Mohammed COLY",        role:"Suzuki",                       lieu:"Sénégal",     pole:"Autres marques",    photo:"assets/team/mohammed-coly.png" },
    { name:"Bomba COULIBALY",      role:"Mitsubishi, Suzuki & BYD",     lieu:"Côte d'Ivoire",pole:"Autres marques",   photo:"assets/team/bomba-coulibaly.png" },
    { name:"Olakunle SUNMONU",     role:"Mitsubishi",                   lieu:"Nigeria",     pole:"Autres marques",    photo:"assets/team/olakunle-sunmonu.png" },
    { name:"Marcia MAVOUALA",      role:"Suzuki",                       lieu:"Congo",       pole:"Autres marques",    photo:"assets/team/marcia-mavouala.png" },
    { name:"Kossi AFATSAWO",       role:"Suzuki",                       lieu:"Togo",        pole:"Autres marques",    photo:"assets/team/kossi-afatsawo.png" },
    { name:"Gilles EKOUME",        role:"Suzuki",                       lieu:"Cameroun",    pole:"Autres marques",    photo:"assets/team/gilles-ekoume.png" },
    { name:"Jean Luc RANDRIANJAFY",role:"Suzuki & BYD",                 lieu:"Madagascar",  pole:"Autres marques",    photo:"assets/team/jean-luc-randrianjafy.png" },
    { name:"Emmanuel OWOICHO",     role:"Suzuki",                       lieu:"Nigeria",     pole:"Autres marques",    photo:"assets/team/emmanuel-owoicho.png" },
    { name:"Benjamin Kwesi Abakah",role:"Suzuki",                       lieu:"Ghana",       pole:"Autres marques",    photo:null, silhouette:true },
    { name:"Thierry KOUGHA",       role:"Forklift · JCB · Lovol",       lieu:"Cameroun",    pole:"Équipement",        photo:"assets/team/thierry-kougha.png" },
    { name:"Lucien GAGNE",         role:"RT · Hino · Fuso",             lieu:"Cameroun",    pole:"Équipement",        photo:"assets/team/lucien-gagne.png" },
    { name:"Idris NKOA",           role:"BT · King Long · Sinotruk",    lieu:"Cameroun",    pole:"Équipement",        photo:"assets/team/idris-nkoa.png" },
    { name:"Roland NENDA",         role:"Formateur opérateur",          lieu:"Cameroun",    pole:"Équipement",        photo:"assets/team/roland-nenda.png" },
    { name:"Johann GAUDIN",        role:"Technicien Lovol",             lieu:"Cameroun",    pole:"Équipement",        photo:"assets/team/johann-gaudin.png" },
    { name:"Thierry TAMO YOUDOM",  role:"Carrosserie",                  lieu:"Cameroun",    pole:"Autres activités",  photo:"assets/team/thierry-tamo-youdom.png" },
    { name:"Gérold SADIO",         role:"Process",                      lieu:"Cameroun",    pole:"Autres activités",  photo:"assets/team/gerold-sadio.png" },
    { name:"Gauthier OUEDRAOGO",   role:"Yamaha Moto & Bateaux",        lieu:"Burkina Faso",pole:"Autres activités",  photo:"assets/team/gauthier-ouedraogo.png" },
  ];

  // ── HELPERS ─────────────────────────────────────────────
  function fmtDay(dateStr) {
    const d = new Date(dateStr);
    return { day: String(d.getDate()).padStart(2, '0'), mo: MOIS_SHORT[d.getMonth()], year: d.getFullYear() };
  }
  function fmtNewsDate(dateStr) {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,'0')} ${MOIS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  window.ACADEMY_DATA = {
    STATS, NAV, MOIS_SHORT, BU, PUBLICS, BRAND_CATS, BRANDS,
    SESSIONS, NEWS_CATS, NEWS, ACADEMY_PREVIEW, TEAM,
    fmtDay, fmtNewsDate,
  };
})();
