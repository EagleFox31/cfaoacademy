// Wireframes — pages-cadre (Accueil + index)
// Exports: WFAccueil, WFPublics, WFFormations, WFMarques, WFSessions, WFActualites, WFAcademy

function WFAccueil() {
  return (
    <WFFrame label="01 · Accueil — vitrine, chaque section = aperçu d'une page">
      <WFNav active="Accueil" />
      <WFHero
        eyebrow="Academy CFAO · Excellence technique mobilité"
        title={<>Le réseau forme<br/>ses talents <em style={{color:WF_RED,fontStyle:'italic'}}>en Afrique</em>.</>}
        sub="22 marques, 35 pays, 28 experts, 253 sessions au catalogue 2026. Formation andragogique terrain."
        ctas={["Calendrier 2026", "Télécharger le catalogue"]}
        chips={["22 marques", "35 pays", "28 experts", "253 sessions"]}
      />
      <WFSection ix="à la une" title="Actualités" voirPlus="Toutes les actualités"
        tabs={["À la une", "Sessions", "Certifications", "Terrain"]}
        filters={["Marque", "Pays"]}>
        <WFCardRow n={4}>
          <WFCard kicker="Terrain" title="BYD : première session VE en Afrique francophone" meta="12 avril · 2 min" />
          <WFCard kicker="Certifications" title="SUZUKI Z12E démontage moteur" meta="30 mars" />
          <WFCard kicker="Sessions" title="Mitsubishi Step 2 Nigeria" meta="2 avril" />
          <WFCard kicker="Terrain" title="SINOTRUK WD615 diagnostic Togo" meta="22 jan · 2 min" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="par public" title="Publics ciblés" voirPlus="Explorer les publics"
        tabs={["Techniciens", "Carrossiers", "Parts", "Technico-com.", "Commerciaux", "Process", "Clients"]}>
        <WFCardRow n={5}>
          <WFCard kicker="Atelier" title="Techniciens" meta="G4→G1 · 18 KI" />
          <WFCard kicker="Atelier" title="Carrossiers" meta="N1→N5" />
          <WFCard kicker="Pièces" title="Parts" meta="Référencement · stock" />
          <WFCard kicker="Vente" title="Technico-com." meta="Argumentaire technique" />
          <WFCard kicker="Vente" title="Commerciaux" meta="Réception · SAV" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="par bu" title="Formations" voirPlus="Voir le catalogue"
        tabs={["Motors", "Equipment", "Carrosserie", "Parts Motors", "Parts Equipment"]}>
        <WFCardRow n={4}>
          <WFCard kicker="113 sessions" title="Techniques Motors" meta="VL · Moto" />
          <WFCard kicker="72 sessions" title="Techniques Equipment" meta="Camions · Bus · Engins · Chariots" />
          <WFCard kicker="29 sessions" title="Techniques Carrosserie" meta="N1 → N5" />
          <WFCard kicker="25 sessions" title="Parts & Process Motors" meta="Audit · Standard" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="22 constructeurs" title="Marques" voirPlus="Toutes les marques"
        tabs={["VL", "Moto & Bateaux", "Camions", "Bus", "Chariots", "Engins"]}>
        <WFCardRow n={6}>
          <WFCard kicker="VL · G4→G1" title="Toyota" meta="Niveau de référence" />
          <WFCard kicker="VL · Bronze→Gold" title="Suzuki" meta="3 paliers" />
          <WFCard kicker="VL · BASIC→CERTIFIED" title="Mercedes-Benz" meta="5 paliers" />
          <WFCard kicker="VL · Step 1→3" title="Mitsubishi" meta="3 paliers" />
          <WFCard kicker="VL · BEV" title="BYD" meta="Électrique" />
          <WFCard kicker="Moto & Bateaux" title="Yamaha" meta="Burkina" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="calendrier 2026" title="Sessions à venir" voirPlus="Voir le calendrier complet"
        tabs={["Tous", "Motors", "Equipment", "Carrosserie", "Parts Motors", "Parts Eq."]}>
        <WFList>
          <WFListItem date="25" meta="MAI · 2026" code="SID02 · STELLANTIS · NIV 2" title="Révision/réparation moteurs essence et diesel" tag="Motors" lieu="Douala · 5 jours" />
          <WFListItem date="03" meta="JUIN · 2026" code="TP01 · TOYOTA FORKLIFT · NIV 1" title="Argumentaire technique de vente pièces" tag="Parts Eq." lieu="(en ligne) · 2 jours" />
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · TOYOTA · G3" title="Révision organes électriques véhicules" tag="Motors" lieu="Togo · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="institutionnel" title="L'Academy" voirPlus="Découvrir l'Academy"
        tabs={["Mission", "Équipe (28)", "Réseau KI/PIC", "35 pays"]}>
        <WFCardRow n={4}>
          <WFCard kicker="Andragogie" title="Apprentissage par la pratique" meta="Gestes métiers terrain" />
          <WFCard kicker="28 experts" title="5 pôles · multi-marques" meta="Cameroun · 9+ pays" />
          <WFCard kicker="Réseau" title="18 KI + 22 PIC Multi + 35 PIC Dév." meta="Décentralisation" />
          <WFCard kicker="Pays" title="29 actifs + 4 potentiels" meta="Afrique" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFPublics() {
  return (
    <WFFrame label="02 · Publics (index) — 7 publics ciblés par formations & communications">
      <WFNav active="Publics" />
      <WFHero
        eyebrow="Vos publics, vos parcours"
        title="7 publics, 7 parcours."
        sub="Du technicien atelier au public B2B externe. Chaque public a son cursus, ses niveaux et ses sessions adaptés à son rôle dans l'écosystème mobilité."
        ctas={["Voir les sessions", "Catalogue PDF"]}
      />
      <WFSection ix="par public" title="Choisir son public"
        tabs={["Tous", "Atelier", "Vente", "Process & SAV", "Clients"]}>
        <WFCardRow n={4}>
          <WFCard kicker="Atelier · G4→G1" title="Techniciens" meta="Maintenance · Réparation · Diagnostic" />
          <WFCard kicker="Atelier · N1→N5" title="Carrossiers" meta="Débourrage → peinture multicouches" />
          <WFCard kicker="Pièces" title="Parts" meta="Référencement · stock · vente" />
          <WFCard kicker="Vente" title="Technico-commerciaux" meta="Argumentaire technique" />
        </WFCardRow>
        <div style={{height: 12}} />
        <WFCardRow n={4}>
          <WFCard kicker="Vente" title="Commerciaux" meta="Réception · prise en charge" />
          <WFCard kicker="Process" title="Process SAV & Parts" meta="Standards · audit · KPI" />
          <WFCard kicker="Client B2B" title="Clients" meta="Techniciens & SAV externes de nos entreprises clientes" />
          <WFCard h={100} kicker="ROI" title="Cartographie publics × BU" meta="Voir matrice →" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="parcours" title="Progression par public"
        tabs={["Débutant", "Confirmé", "Expert"]}>
        <WFCardRow n={4}>
          <WFCard kicker="Étape 1" title="Maintenance préventive" meta="G4 / N1 / Step 1 / BASIC" />
          <WFCard kicker="Étape 2" title="Réparation" meta="G3 / N2-N3 / Step 2 / ADVANCED" />
          <WFCard kicker="Étape 3" title="Diagnostic" meta="G2 / N4 / Step 3 / EXPERT" />
          <WFCard kicker="Étape 4" title="Certification finale" meta="G1 / N5 / Master / CERTIFIED" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="témoignages" title="Ils en parlent"
        tabs={["Technicien", "Carrossier", "Parts", "Process", "Client"]}>
        <WFCardRow n={3}>
          <WFCard h={130} kicker="Eric N." title="« Après G3, j'interviens en autonomie sur la révision complète. »" meta="Technicien · Douala" />
          <WFCard h={130} kicker="Anonyme" title="« Sur les raccords multicouches, la formation change tout. »" meta="Carrossier · Abidjan" />
          <WFCard h={130} kicker="Anonyme" title="« L'audit Parts a remis à plat notre stock atelier. »" meta="Manager Parts · Sénégal" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFFormations() {
  return (
    <WFFrame label="03 · Formations (index)">
      <WFNav active="Formations" />
      <WFHero
        eyebrow="Catalogue 2026"
        title="253 sessions, 5 Business Units."
        sub="Le catalogue officiel CFAO Academy. Filtrez par BU, marque, public ou niveau."
        ctas={["Catalogue PDF", "Calendrier"]}
      />
      <WFSection ix="par bu" title="Catalogue par BU"
        tabs={["Toutes", "Motors", "Equipment", "Carrosserie", "Parts Motors", "Parts Eq."]}
        filters={["Marque", "Public", "Niveau", "Lieu"]}>
        <WFCardRow n={5}>
          <WFCard kicker="113" title="Techniques Motors" meta="VL · Moto" />
          <WFCard kicker="72" title="Techniques Equipment" meta="Camions · Bus · Engins · Chariots" />
          <WFCard kicker="29" title="Techniques Carrosserie" meta="N1 → N5" />
          <WFCard kicker="25" title="Parts & Process Motors" meta="Audit · Standard" />
          <WFCard kicker="14" title="Parts & Process Eq." meta="Plateformes pièces" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="2026" title="Nouveautés"
        tabs={["Toutes les BU", "Motors", "Equipment", "Carrosserie", "Parts"]}>
        <WFCardRow n={4}>
          <WFCard kicker="NOUVEAU" title="BYD Batteries haute-tension" meta="BEV · 5 jours" />
          <WFCard kicker="NOUVEAU" title="Mercedes-Benz CERTIFIED Diagnostic" meta="Expert · 5 jours" />
          <WFCard kicker="NOUVEAU" title="Mitsubishi Step 3 Diagnostic" meta="Master · 5 jours" />
          <WFCard kicker="NOUVEAU" title="Yamaha Moto entretien" meta="Burkina · 3 jours" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="niveaux de compétences" title="Certifications"
        tabs={["Toyota G4→G1", "Suzuki Bronze→Gold", "Mitsubishi Step 1→3", "Mercedes-Benz BASIC→CERTIFIED", "Carrosserie N1→N5"]}>
        <WFCardRow n={4}>
          <WFCard kicker="Niveau 1" title="Maintenance" meta="Entretien base" />
          <WFCard kicker="Niveau 2" title="Réparation" meta="Composants" />
          <WFCard kicker="Niveau 3" title="Diagnostic" meta="Pannes avancées" />
          <WFCard kicker="Niveau 4" title="Expert / Certifié" meta="Selon marque" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFMarques() {
  return (
    <WFFrame label="04 · Marques (index) — 22 constructeurs en 6 catégories">
      <WFNav active="Marques" />
      <WFHero
        eyebrow="22 constructeurs · 1 academy"
        title="22 marques, 6 catégories véhicules."
        sub="Toyota, Mercedes-Benz, Suzuki, BYD, Mitsubishi, Yamaha, Renault Trucks, Hino, Fuso, JCB, BT… Chaque niveau de compétences suit le cahier des charges officiel constructeur."
        ctas={["Catalogue", "Sessions par marque"]}
      />
      <WFSection ix="vl · 11 marques" title="Véhicules légers">
        <WFCardRow n={6}>
          <WFCard kicker="G4 → G1" title="Toyota" meta="Niveau de référence" />
          <WFCard kicker="BASIC → CERTIFIED" title="Mercedes-Benz" meta="5 paliers" />
          <WFCard kicker="Bronze → Gold" title="Suzuki" meta="3 paliers" />
          <WFCard kicker="BEV" title="BYD" meta="Électrique" />
          <WFCard kicker="Premium" title="Omoda · Jinco" meta="Nouvelles arrivées" />
          <WFCard kicker="Step 1 → 3" title="Mitsubishi" meta="3 paliers" />
        </WFCardRow>
        <div style={{height: 12}} />
        <WFCardRow n={5}>
          <WFCard kicker="Stellantis" title="Citroën" meta="SID" />
          <WFCard kicker="Stellantis" title="Peugeot" meta="SID" />
          <WFCard kicker="Stellantis" title="Jeep" meta="SID" />
          <WFCard kicker="Stellantis" title="Fiat" meta="SID" />
          <WFCard h={100} kicker="11/11" title="Voir toutes les VL →" meta="—" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="moto & bateaux · 1 marque" title="Moto & Bateaux">
        <WFCardRow n={4}>
          <WFCard kicker="Moto & Bateaux" title="Yamaha" meta="Burkina Faso · Gauthier OUEDRAOGO" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="camions · 6 marques" title="Camions">
        <WFCardRow n={6}>
          <WFCard kicker="Trucks" title="Renault Trucks" meta="—" />
          <WFCard kicker="Trucks" title="Fuso" meta="—" />
          <WFCard kicker="Trucks" title="Hino" meta="—" />
          <WFCard kicker="Trucks" title="Sinotruk" meta="—" />
          <WFCard kicker="Trucks" title="Shacman" meta="—" />
          <WFCard kicker="Trucks" title="Mercedes Trucks" meta="—" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="bus · 2" title="Bus">
        <WFCardRow n={4}>
          <WFCard kicker="Bus" title="King Long" meta="—" />
          <WFCard kicker="Bus" title="Toyota Bus" meta="—" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="chariots · 2" title="Chariots élévateurs">
        <WFCardRow n={4}>
          <WFCard kicker="Forklift" title="BT" meta="—" />
          <WFCard kicker="Forklift" title="Toyota Material Handling" meta="—" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="engins · 2" title="Engins TP">
        <WFCardRow n={4}>
          <WFCard kicker="TP" title="JCB" meta="—" />
          <WFCard kicker="TP" title="Lovol" meta="—" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFSessions() {
  return (
    <WFFrame label="05 · Sessions (calendrier)">
      <WFNav active="Sessions" />
      <WFHero
        eyebrow="Calendrier 2026"
        title="253 sessions au planning."
        sub="Recherche, filtres et inscription en quelques clics."
        ctas={["Demander un audit", "Catalogue PDF"]}
      />
      <WFSection ix="calendrier" title="Toutes les sessions"
        tabs={["Tous", "Motors", "Equipment", "Carrosserie", "Parts Motors", "Parts Eq."]}
        filters={["Marque (22)", "Public (7)", "Pays (29)", "Mois", "Niveau", "Type (Présentiel · Distanciel)"]}>
        <WFList>
          <WFListItem date="25" meta="MAI · 2026" code="SID02 · STELLANTIS · NIV 2" title="Révision/réparation moteurs essence et diesel" tag="Motors" lieu="Douala · 5 jours" />
          <WFListItem date="25" meta="MAI · 2026" code="LVL17 · LOVOL · DIAG" title="Diagnostic systèmes Tractopelles" tag="Equipment" lieu="RCI · 5 jours" />
          <WFListItem date="25" meta="MAI · 2026" code="02N1 · CARROSSERIE · N1" title="Redressage éléments plans acier" tag="Carrosserie" lieu="Côte d'Ivoire · 5 jours" />
          <WFListItem date="03" meta="JUIN · 2026" code="TP01 · TOYOTA FORKLIFT" title="Argumentaire technique pièces" tag="Parts Eq." lieu="(en ligne) · 2 jours" />
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · TOYOTA · G3" title="Révision organes électriques" tag="Motors" lieu="Togo · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="distanciel" title="Sessions en ligne"
        tabs={["Toutes", "Parts Motors", "Parts Eq."]}>
        <WFCardRow n={4}>
          <WFCard kicker="(en ligne)" title="Plateforme pièces TOYOTA" meta="1 jour · Thierry K." />
          <WFCard kicker="(en ligne)" title="FTR Toyota" meta="1 jour · Gérold S." />
          <WFCard kicker="(en ligne)" title="FTIR Suzuki" meta="1 jour · Gérold S." />
          <WFCard kicker="(en ligne)" title="Réception véhicule SAV" meta="1 jour · Gérold S." />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFActualites() {
  return (
    <WFFrame label="06 · Actualités (index)">
      <WFNav active="Actualités" />
      <WFHero
        eyebrow="Le réseau, en mouvement"
        title="Sessions, certifications et retours terrain."
        sub="L'actualité de l'Academy et du réseau CFAO Mobility, par BU, marque et pays."
        ctas={["S'inscrire à la newsletter"]}
      />
      <WFSection ix="à la une" title="Les derniers articles"
        tabs={["À la une", "Sessions", "Certifications", "Terrain"]}
        filters={["Marque (22)", "Pays (29)", "Public (7)"]}>
        <WFCardRow n={3}>
          <WFCard h={180} kicker="Terrain · 12 avril" title="BYD : première session VE en Afrique francophone" meta="2 min · Huit techniciens diplômés" />
          <WFCard h={180} kicker="Certifications · 30 mars" title="SUZUKI Z12E démontage moteur" meta="Retour de janvier" />
          <WFCard h={180} kicker="Sessions · 27 avril" title="Mitsubishi Step 2 Nigeria" meta="Cycle complet" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="par bu" title="Récents par BU"
        tabs={["Motors", "Equipment", "Carrosserie", "Parts Motors", "Parts Eq."]}>
        <WFCardRow n={4}>
          <WFCard kicker="Motors" title="Session inaugurale BEV Nigeria" meta="23 jan" />
          <WFCard kicker="Equipment" title="SINOTRUK WD615 Togo" meta="22 jan" />
          <WFCard kicker="Carrosserie" title="Atelier RCI : 12 stagiaires" meta="30 avr" />
          <WFCard kicker="Parts & Process" title="Rapports d'anomalies pilote" meta="30 avr" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFAcademy() {
  const supports = [
    { name: "Laurent GONIN", role: "Directeur formation", lieu: "", photo: "assets/team/laurent-gonin.png" },
    { name: "André Yves BOKALLY", role: "Coordinateur", lieu: "Cameroun", photo: "assets/team/andre-yves-bokally.png" },
    { name: "Claudia EYINGA", role: "Assistante formation", lieu: "Cameroun", photo: "assets/team/claudia-eyinga.png" },
    { name: "Jennifer AKA'A", role: "Analyste programmeuse", lieu: "Cameroun", photo: "assets/team/jennifer-akaa.png" },
  ];
  const toyota = [
    { name: "Eugène EBENE", role: "Formateur Toyota", lieu: "Cameroun", photo: "assets/team/eugene-ebene.png" },
    { name: "Alassane DIALLO", role: "Formateur Toyota", lieu: "Sénégal", photo: "assets/team/alassane-diallo.png" },
    { name: "Jacques MAVILA", role: "Formateur Toyota & Suzuki", lieu: "RDC", photo: "assets/team/jacques-mavila.png" },
    { name: "Brice NECHI", role: "Formateur Stellantis & Toyota", lieu: "Cameroun", photo: "assets/team/brice-nechi.png" },
  ];
  const autres = [
    { name: "Cédric PAKO", role: "Suzuki, BYD & Omoda", lieu: "Cameroun", photo: "assets/team/cedric-pako.png" },
    { name: "Hatem BEN ABID", role: "Mercedes-Benz", lieu: "RCI", photo: "assets/team/hatem-ben-abid.png" },
    { name: "Mohammed COLY", role: "Suzuki", lieu: "Sénégal", photo: "assets/team/mohammed-coly.png" },
    { name: "Bomba COULIBALY", role: "Mitsubishi, Suzuki & BYD", lieu: "RCI", photo: "assets/team/bomba-coulibaly.png" },
    { name: "Olakunle SUNMONU", role: "Mitsubishi", lieu: "Nigeria", photo: "assets/team/olakunle-sunmonu.png" },
    { name: "Marcia MAVOUALA", role: "Suzuki", lieu: "Congo", photo: "assets/team/marcia-mavouala.png" },
    { name: "Kossi AFATSAWO", role: "Suzuki", lieu: "Togo", photo: "assets/team/kossi-afatsawo.png" },
    { name: "Gilles EKOUME", role: "Suzuki", lieu: "Cameroun", photo: "assets/team/gilles-ekoume.png" },
    { name: "Jean Luc RANDRIANJAFY", role: "Suzuki & BYD", lieu: "Madagascar", photo: "assets/team/jean-luc-randrianjafy.png" },
    { name: "Emmanuel OWOICHO", role: "Suzuki", lieu: "Nigeria", photo: "assets/team/emmanuel-owoicho.png" },
    { name: "Benjamin Kwesi Abakah", role: "Suzuki", lieu: "Ghana", silhouette: true },
  ];
  const equipement = [
    { name: "Thierry KOUGHA", role: "Forklift · JCB · Lovol", lieu: "Cameroun", photo: "assets/team/thierry-kougha.png" },
    { name: "Lucien GAGNE", role: "RT · Hino · Fuso", lieu: "Cameroun", photo: "assets/team/lucien-gagne.png" },
    { name: "Idris NKOA", role: "BT · KL · Sinotruk", lieu: "Cameroun", photo: "assets/team/idris-nkoa.png" },
    { name: "Roland NENDA", role: "Formateur opérateur", lieu: "Cameroun", photo: "assets/team/roland-nenda.png" },
    { name: "Johann GAUDIN", role: "Technicien Lovol", lieu: "Cameroun", photo: "assets/team/johann-gaudin.png" },
  ];
  const autresAct = [
    { name: "Thierry TAMO YOUDOM", role: "Carrosserie", lieu: "Cameroun", photo: "assets/team/thierry-tamo-youdom.png" },
    { name: "Gérold SADIO", role: "Process", lieu: "Cameroun", photo: "assets/team/gerold-sadio.png" },
    { name: "Gauthier OUEDRAOGO", role: "Yamaha Moto & Bateaux", lieu: "Burkina Faso", photo: "assets/team/gauthier-ouedraogo.png" },
  ];
  const paysOuest = [
    "Mauritanie", "Sénégal", "Gambie", "Guinée-Bissau", "Guinée", "Sierra Leone",
    "Libéria", "Côte d'Ivoire", "Mali", "Burkina Faso", "Ghana", "Togo",
    "Bénin", "Niger", "Nigéria",
  ];
  const paysCentre = ["Tchad", "Cameroun", "RCA", "RDC", "Congo", "Gabon"];
  const paysEst = ["Kenya", "Tanzanie", "Ouganda", "Rwanda", "Burundi", "Zambie", "Zimbabwe", "Madagascar"];
  const potentiels = ["Angola", "Éthiopie", "Mozambique", "Malawi"];

  return (
    <WFFrame label="07 · L'Academy">
      <WFNav active="L'Academy" />
      <WFHero
        eyebrow="À propos · Qui sommes-nous"
        title="L'Academy CFAO Mobility."
        sub="Le partenaire formation officiel des 22 constructeurs distribués par CFAO Mobility. 28 experts, 18 KI, 22 PIC Multi-marques, 35 PIC Développement, déployés dans 29 pays."
        ctas={["Catalogue PDF", "Contact"]}
        chips={["28 experts", "18 KI", "22 PIC Multi", "35 PIC Dév.", "29 pays"]}
      />

      <WFSection ix="notre mission" title="Mission"
        tabs={["Andragogie", "Décentralisation", "Africanisation"]}>
        <WFCardRow n={3}>
          <WFCard h={160} kicker="Pilier 1 · Andragogie" title="Apprentissage par la pratique" meta="Gestes métiers · diagnostic · mentoring au poste" />
          <WFCard h={160} kicker="Pilier 2 · Décentralisation" title="Formations près du terrain" meta="Réseau KI/PIC dans 9+ pays" />
          <WFCard h={160} kicker="Pilier 3 · Africanisation" title="Talents africains" meta="35 PIC en développement" />
        </WFCardRow>
      </WFSection>

      <WFSection ix="méthodologie" title="Cycle MEDACAP">
        <div style={{
          display: 'grid', gridTemplateColumns: '420px 1fr', gap: 28, alignItems: 'flex-start',
          marginTop: 8,
        }}>
          <div style={{
            border: `1.5px solid ${WF_LINE_SOFT}`, borderRadius: 6,
            background: 'white', padding: 14,
          }}>
            <img src="assets/medacap-cycle.png" alt="Cycle MEDACAP" style={{ width: '100%', display: 'block' }} />
          </div>
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: WF_RED, letterSpacing: 1.5, textTransform: 'uppercase',
              marginBottom: 10,
            }}>Développer l'expertise professionnelle des techniciens</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: WF_INK, marginBottom: 16 }}>
              MEDACAP est la méthodologie en 7 étapes qui structure le développement des compétences techniques sur l'ensemble du réseau CFAO Mobility.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['1', 'Mesurer', 'les compétences'],
                ['2', 'Exploiter', 'les données de mesure'],
                ['3', 'Définir', 'les plans Individuel & Collectifs'],
                ['4', 'Acquérir', 'savoirs & savoir-faire (CFR / filiales)'],
                ['5', 'Certifier', 'savoirs & savoir-faire'],
                ['6', 'Appliquer', 'le savoir-faire en filiales'],
                ['7', 'Performer', 'en milieu professionnel'],
              ].map(([num, verb, desc], i) => (
                <div key={i} style={{
                  border: `1px solid ${WF_LINE_SOFT}`,
                  borderLeft: `3px solid ${WF_RED}`,
                  borderRadius: 4, background: 'white',
                  padding: '8px 12px',
                  display: 'flex', alignItems: 'baseline', gap: 8,
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12, fontWeight: 600, color: WF_RED,
                  }}>{num}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: WF_INK }}>{verb}</div>
                    <div style={{ fontSize: 11, color: WF_MUTED, lineHeight: 1.3 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WFSection>

      <WFSection ix="équipe centrale · 28 experts" title="L'équipe"
        tabs={["Tous les pôles", "Supports (4)", "Toyota (4)", "Autres marques (12)", "Équipement (5)", "Autres (3)"]}>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Pôle Supports · 4</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {supports.map((p, i) => <WFPerson key={i} {...p} />)}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Pôle Toyota · 4</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {toyota.map((p, i) => <WFPerson key={i} {...p} />)}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Pôle Autres Marques · 12</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {autres.map((p, i) => <WFPerson key={i} {...p} />)}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Pôle Équipement · 5</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {equipement.map((p, i) => <WFPerson key={i} {...p} />)}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Pôle Autres Activités · 3</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {autresAct.map((p, i) => <WFPerson key={i} {...p} />)}
          </div>
        </div>
      </WFSection>

      <WFSection ix="réseau terrain · décentralisation" title="Le réseau KI · PIC"
        tabs={["Vue d'ensemble", "KI (Toyota)", "PIC Multi (Motors)", "PIC Dév. (Equipment)"]}>
        <WFCardRow n={3}>
          <WFNetwork count={18} label="KI · Toyota" scope="Key Instructors Toyota — niveau G2/Diagnostic. Animent les formations Maintenance & Réparation Toyota dans 10+ pays." />
          <WFNetwork count={22} label="PIC Multi-marques · Motors" scope="Techniciens intermédiaires Motors hors Toyota — niveau Silver/Réparation. Relais multi-marques sur le terrain." />
          <WFNetwork count={35} label="PIC Développement · Equipment" scope="Talents Equipment en montée — coachés par les KI pour atteindre Silver/Réparation." />
        </WFCardRow>

        <div style={{ marginTop: 24 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase',
            marginBottom: 12,
          }}>Key Instructors connus · 17 / 18</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { name: "André YOGBA", lieu: "Douala, Cameroun" },
              { name: "Marcia MAVOUALA", lieu: "Congo" },
              { name: "Jacques MAVILA", lieu: "RDC" },
              { name: "Moïse ABLEFONLIN", lieu: "Bénin" },
              { name: "Cheikh NDIAYE", lieu: "Sénégal · Guinée-Bissau · Gambie" },
              { name: "Joël RAMIARANTSOA", lieu: "Madagascar" },
              { name: "Stanislas IDO", lieu: "Burkina Faso" },
              { name: "MAHAMAT ELHADJ", lieu: "Tchad" },
              { name: "Fall ABDELLAHI", lieu: "Mauritanie" },
              { name: "David NDONG", lieu: "Guinée-Équatoriale" },
              { name: "Kossi AFATSAWO", lieu: "Togo" },
              { name: "Ibrahim ALTINE", lieu: "Niger" },
              { name: "Roland BAMBA", lieu: "Côte d'Ivoire" },
              { name: "Sow OUSMANE", lieu: "Guinée-Conakry" },
              { name: "Josaphat BONDRAVODE", lieu: "RCA" },
              { name: "Mamadou KEITA", lieu: "Mali" },
              { name: "Valentin RAMBENA", lieu: "Guinée-Équatoriale" },
            ].map((p, i) => <WFPerson key={i} {...p} role="Key Instructor" silhouette />)}
          </div>
        </div>
      </WFSection>

      <WFSection ix="cartographie · 29 + 4" title="Nos pays"
        tabs={["Tous", "Ouest (15)", "Centrale (6)", "Est (8)", "Potentiels (4)"]}>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Afrique de l'Ouest · 15</div>
          <WFCountries items={paysOuest} />
          <div style={{ height: 14 }} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Afrique Centrale · 6</div>
          <WFCountries items={paysCentre} />
          <div style={{ height: 14 }} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WF_MUTED, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Afrique de l'Est · 8</div>
          <WFCountries items={paysEst} potentiels={potentiels} />
        </div>
      </WFSection>

      <WFSection ix="centres" title="Centres de formation"
        tabs={["Douala", "Abidjan", "Distanciel"]}>
        <WFCardRow n={4}>
          <WFCard kicker="Centre principal" title="Douala · Cameroun" meta="Multi-marques · multi-BU" />
          <WFCard kicker="Carrosserie" title="Abidjan · Côte d'Ivoire" meta="Cabine peinture · marbres" />
          <WFCard kicker="Délocalisé" title="Sites filiales" meta="Via réseau KI/PIC" />
          <WFCard kicker="Distanciel" title="Plateforme (en ligne)" meta="Parts · Process · FTR/FTIR" />
        </WFCardRow>
      </WFSection>

      <WFFooter />
    </WFFrame>
  );
}

Object.assign(window, {
  WFAccueil, WFPublics, WFFormations, WFMarques,
  WFSessions, WFActualites, WFAcademy,
});
