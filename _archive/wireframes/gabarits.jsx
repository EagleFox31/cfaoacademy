// Wireframes — gabarits (templates pour fiches)
// Exports: WFFichePublic, WFPageBU, WFFicheFormation, WFFicheMarque, WFFicheSession, WFArticle

function WFFichePublic() {
  return (
    <WFFrame label="GABARIT · Fiche public (×7 : Techniciens · Carrossiers · Parts · Technico-com. · Commerciaux · Process · Clients)">
      <WFNav active="Publics" />
      <WFHero
        eyebrow="Public · Techniciens"
        title={<>Technicien<br/>autonomie atelier.</>}
        sub="Montée en compétences étape par étape, de la maintenance préventive au diagnostic. Cursus propre à chaque marque (G4→G1 Toyota, Bronze→Gold Suzuki…)."
        ctas={["Voir mes formations", "S'inscrire"]}
        chips={["3 paliers", "+1 niveau / certif", "Hybride · BEV"]}
      />
      <WFSection ix="parcours" title="Parcours de progression"
        tabs={["Toyota", "Suzuki", "Stellantis", "Carrosserie"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G4" title="Maintenance" meta="Préventif périodique" />
          <WFCard kicker="G3" title="Réparation" meta="Moteurs & châssis" />
          <WFCard kicker="G2" title="Diagnostic" meta="Systèmes électroniques" />
          <WFCard kicker="G1" title="Expert" meta="Certification finale" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="catalogue" title="Formations recommandées"
        tabs={["Toutes", "Motors", "Carrosserie", "Equipment"]}
        filters={["Marque", "Niveau"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G3 · 5 jours" title="Révision/réparation moteurs essence et diesel" meta="Toyota · Douala" />
          <WFCard kicker="G2 · 5 jours" title="Diagnostic systèmes de motorisation" meta="Toyota · Burkina" />
          <WFCard kicker="BEV · 5 jours" title="Batteries haute-tension BYD" meta="Nouveauté 2026" />
          <WFCard kicker="N1 · 5 jours" title="Redressage éléments plans acier" meta="Carrosserie · RCI" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="agenda" title="Prochaines sessions"
        tabs={["Toutes", "Présentiel", "(en ligne)"]}>
        <WFList>
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · TOYOTA · G3" title="Révision organes électriques véhicules" tag="Motors" lieu="Togo · 5 jours" />
          <WFListItem date="27" meta="JUIL · 2026" code="TS08-G2 · TOYOTA · G2" title="Diagnostic motorisation" tag="Motors" lieu="Burkina · 5 jours" />
          <WFListItem date="31" meta="AOÛT · 2026" code="TS03-G3 · TOYOTA · G3" title="Révision/réparation moteurs" tag="Motors" lieu="RGE · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="bénéfices" title="ROI métier"
        tabs={["Autonomie", "Productivité", "Conformité"]}>
        <WFCardRow n={3}>
          <WFCard h={130} kicker="+1 palier" title="Chaque certif ouvre le niveau suivant" meta="Autonomie atelier" />
          <WFCard h={130} kicker="↑" title="Réparation du premier coup" meta="Diagnostic juste" />
          <WFCard h={130} kicker="100%" title="Couverture compétences" meta="Périmètre poste" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="témoignages" title="Ils en parlent"
        tabs={["Cameroun", "Côte d'Ivoire", "Togo", "Sénégal"]}>
        <WFCardRow n={3}>
          <WFCard h={120} kicker="Eric N." title="« J'interviens en autonomie sur la révision complète. »" meta="Toyota G3 · Douala" />
          <WFCard h={120} kicker="Anonyme" title="« Mon chef n'a plus à repasser derrière moi. »" meta="Technicien · RCI" />
          <WFCard h={120} kicker="Anonyme" title="« Les niveaux donnent un cap clair. »" meta="Technicien · Togo" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFPageBU() {
  return (
    <WFFrame label="GABARIT · Page BU (×5 : Motors · Equipment · Carrosserie · Parts Motors · Parts Eq.)">
      <WFNav active="Formations" />
      <WFHero
        eyebrow="BU · Techniques Motors"
        title="113 formations Motors."
        sub="Maintenance, réparation, diagnostic. Tous constructeurs VL & VU distribués par CFAO Mobility."
        ctas={["Catalogue PDF", "Sessions Motors"]}
      />
      <WFSection ix="catalogue motors" title="Toutes les formations"
        tabs={["Toyota", "Suzuki", "Stellantis", "BYD", "Toutes marques"]}
        filters={["Niveau", "Lieu", "Durée"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G3 · 5 jours" title="Révision/réparation moteurs essence et diesel" meta="Toyota · TS03-G3" />
          <WFCard kicker="G3 · 5 jours" title="Organes électriques (climatisation, alternateur)" meta="Toyota · TS06-G3" />
          <WFCard kicker="G2 · 5 jours" title="Diagnostic motorisation" meta="Toyota · TS08-G2" />
          <WFCard kicker="G3 · 5 jours" title="Certification G3 finale" meta="Toyota · TS07-G3" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="niveaux" title="Niveaux & certifications"
        tabs={["Toyota G4→G1", "Suzuki Bronze→Gold", "Stellantis SID"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G4" title="Maintenance" meta="Préventif périodique" />
          <WFCard kicker="G3" title="Réparation" meta="Moteurs & châssis" />
          <WFCard kicker="G2" title="Diagnostic" meta="Systèmes électroniques" />
          <WFCard kicker="G1" title="Expert" meta="Certification finale" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="agenda motors" title="Prochaines sessions Motors"
        tabs={["Tous lieux", "Cameroun", "Côte d'Ivoire", "Togo", "(en ligne)"]}>
        <WFList>
          <WFListItem date="25" meta="MAI · 2026" code="SID02 · STELLANTIS · NIV 2" title="Révision/réparation moteurs essence et diesel" tag="Motors" lieu="Douala · 5 jours" />
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · TOYOTA · G3" title="Révision organes électriques" tag="Motors" lieu="Togo · 5 jours" />
          <WFListItem date="31" meta="AOÛT · 2026" code="TS03-G3 · TOYOTA · G3" title="Révision/réparation moteurs" tag="Motors" lieu="RGE · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="équipe" title="Formateurs Motors"
        tabs={["Tous", "Toyota", "Suzuki", "Stellantis"]}>
        <WFCardRow n={4}>
          <WFCard h={130} kicker="Toyota G1-G3" title="Eugène EBENE" meta="15 ans" />
          <WFCard h={130} kicker="Toyota multi-pays" title="Damas NGUE LAH" meta="12 ans" />
          <WFCard h={130} kicker="Suzuki / Stellantis" title="Brice NECHI" meta="10 ans" />
          <WFCard h={130} kicker="Toyota / Distanciel" title="Cédric PAKO" meta="8 ans" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFFicheFormation() {
  return (
    <WFFrame label="GABARIT · Fiche formation (~50 prioritaires sur 253)">
      <WFNav active="Formations" />
      <WFHero
        eyebrow="Formation · TS06-G3 · TOYOTA · Niveau G3"
        title={<>Révision/réparation<br/>des organes électriques.</>}
        sub="Climatisation, alternateur, démarreur. Niveau de compétences Toyota palier G3, certifiant."
        ctas={["S'inscrire à une session", "Demander un devis"]}
        chips={["5 jours", "Présentiel", "Code TS06-G3", "12 places"]}
      />
      <WFSection ix="objectifs" title="Objectifs andragogiques"
        tabs={["Compétences", "Indicateurs"]}>
        <WFCardRow n={3}>
          <WFCard h={130} kicker="Compétence 1" title="Diagnostiquer un système électrique véhicule" meta="Mesure · panne · réparation" />
          <WFCard h={130} kicker="Compétence 2" title="Remplacer alternateur, démarreur, batterie" meta="Démontage · remontage" />
          <WFCard h={130} kicker="Compétence 3" title="Réparer un circuit de climatisation" meta="Charge · fuite · diagnostic" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="programme" title="Programme jour par jour"
        tabs={["Jour 1", "Jour 2", "Jour 3", "Jour 4", "Jour 5"]}>
        <WFCardRow n={3}>
          <WFCard kicker="Matin" title="Théorie système électrique" meta="Cours en salle" />
          <WFCard kicker="Après-midi" title="Mesures sur véhicule" meta="Atelier · multimètre" />
          <WFCard kicker="Bilan" title="Quiz jour 1 + validation" meta="20 questions" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="public" title="Prérequis & public visé">
        <WFCardRow n={2}>
          <WFCard h={120} kicker="Prérequis" title="Certification Toyota G4 acquise" meta="Maintenance préventive maîtrisée" />
          <WFCard h={120} kicker="Public" title="Technicien VL/VU en atelier" meta="2+ ans d'expérience" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="agenda" title="Prochaines sessions"
        tabs={["Toutes", "Cameroun", "Togo", "Burkina"]}>
        <WFList>
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · TOYOTA" title="Révision organes électriques" tag="Motors" lieu="Togo · 5 jours" />
          <WFListItem date="14" meta="SEPT · 2026" code="TS06-G3 · TOYOTA" title="Révision organes électriques" tag="Motors" lieu="Burkina · 5 jours" />
          <WFListItem date="23" meta="NOV · 2026" code="TS06-G3 · TOYOTA" title="Révision organes électriques" tag="Motors" lieu="Cameroun · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="aussi" title="Formations liées"
        tabs={["Même niveau", "Niveau supérieur", "Même marque"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G3" title="TS03-G3 · Moteurs essence & diesel" meta="5 jours" />
          <WFCard kicker="G3" title="TS05-G3 · Organes du châssis" meta="5 jours" />
          <WFCard kicker="G2" title="TS08-G2 · Diagnostic" meta="5 jours · niveau sup." />
          <WFCard kicker="G1" title="TS07-G3 · Certification G3 finale" meta="5 jours" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFFicheMarque() {
  return (
    <WFFrame label="GABARIT · Fiche marque (×13 constructeurs)">
      <WFNav active="Marques" />
      <WFHero
        eyebrow="Marque · Toyota"
        title="Toyota — niveau de compétences."
        sub="78 sessions Toyota au catalogue 2026. Niveau de compétences G4 → G1, partenariat constructeur historique."
        ctas={["Sessions Toyota", "Catalogue PDF"]}
        chips={["78 sessions", "G4 → G1", "VL · VU · Forklift"]}
      />
      <WFSection ix="niveau de compétences" title="Niveaux Toyota"
        tabs={["G4 Maintenance", "G3 Réparation", "G2 Diagnostic", "G1 Expert"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G4" title="Maintenance préventive" meta="Périodique & non-périodique" />
          <WFCard kicker="G3" title="Réparation organes" meta="Moteur · châssis · électrique" />
          <WFCard kicker="G2" title="Diagnostic systèmes" meta="Électronique embarquée" />
          <WFCard kicker="G1" title="Certification finale" meta="Expert atelier" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="catalogue toyota" title="Formations Toyota"
        tabs={["Toutes", "Motors", "Parts & Process"]}
        filters={["Niveau", "Lieu"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G3 · 5j" title="Révision/réparation moteurs essence et diesel" meta="TS03-G3" />
          <WFCard kicker="G3 · 5j" title="Organes électriques (clim, alt, démarreur)" meta="TS06-G3" />
          <WFCard kicker="G2 · 5j" title="Diagnostic motorisation" meta="TS08-G2" />
          <WFCard kicker="G3 · 5j" title="Certification G3 finale" meta="TS07-G3" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="agenda toyota" title="Prochaines sessions Toyota"
        tabs={["Tous lieux", "Cameroun", "Togo", "Burkina", "Niger"]}>
        <WFList>
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · G3" title="Révision organes électriques" tag="Motors" lieu="Togo · 5 jours" />
          <WFListItem date="27" meta="JUIL · 2026" code="TS08-G2 · G2" title="Diagnostic motorisation" tag="Motors" lieu="Burkina · 5 jours" />
          <WFListItem date="05" meta="OCT · 2026" code="TS07-G3 · G3" title="Certification G3 finale" tag="Motors" lieu="Niger · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="formateurs toyota" title="Formateurs certifiés Toyota"
        tabs={["Tous niveaux", "G3", "G2", "G1"]}>
        <WFCardRow n={4}>
          <WFCard h={130} kicker="G1-G3" title="Eugène EBENE" meta="15 ans · Douala" />
          <WFCard h={130} kicker="G3" title="Damas NGUE LAH" meta="12 ans · multi-pays" />
          <WFCard h={130} kicker="G2-G3" title="Cédric PAKO" meta="8 ans" />
          <WFCard h={130} kicker="G3" title="BOMBA Coulibaly" meta="7 ans · RCI" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFFicheSession() {
  return (
    <WFFrame label="GABARIT · Fiche session (dynamique, 253/an)">
      <WFNav active="Sessions" />
      <WFHero
        eyebrow="Session · TS06-G3 · 29 juin 2026"
        title={<>Révision organes électriques<br/>· Toyota G3 · Togo.</>}
        sub="Session présentielle de 5 jours, animée par Eugène EBENE. 12 places, prochaine session de cette formation."
        ctas={["S'inscrire maintenant", "Voir la formation"]}
        chips={["29 juin → 3 juillet", "Togo · Lomé", "12 places", "Niveau G3"]}
      />
      <WFSection ix="détails" title="Cette session"
        tabs={["Informations", "Logistique", "Conditions"]}>
        <WFCardRow n={4}>
          <WFCard h={120} kicker="Formateur" title="Eugène EBENE" meta="Toyota G1-G3 · 15 ans" />
          <WFCard h={120} kicker="Lieu" title="Togo · Lomé" meta="Centre de formation" />
          <WFCard h={120} kicker="Public" title="12 places" meta="Techniciens G4 certifiés" />
          <WFCard h={120} kicker="Type" title="Présentiel" meta="5 jours · français" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="programme" title="Programme jour par jour"
        tabs={["J1", "J2", "J3", "J4", "J5"]}>
        <WFCardRow n={3}>
          <WFCard kicker="Matin" title="Théorie système électrique" meta="Salle de cours" />
          <WFCard kicker="Après-midi" title="Mesures sur véhicule" meta="Atelier · pratique" />
          <WFCard kicker="Soir" title="Quiz + validation" meta="20 questions" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="formation" title="Formation parente">
        <WFCardRow n={2}>
          <WFCard h={140} kicker="TS06-G3 · TOYOTA" title="Révision/réparation des organes électriques" meta="Voir la fiche complète →" />
          <WFCard h={140} kicker="Autres sessions" title="Septembre · Novembre" meta="2 autres sessions disponibles" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="inscription" title="S'inscrire à cette session">
        <WFForm fields={[
          "Nom complet",
          "Email",
          "Téléphone",
          "Filiale CFAO / Société",
          "Poste actuel + niveau certifié (G4 requis)",
          "Message",
        ]} cta="Envoyer ma demande d'inscription" />
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFArticle() {
  return (
    <WFFrame label="GABARIT · Article actualité (dynamique)">
      <WFNav active="Actualités" />
      <div style={{ padding: '32px 28px', borderBottom: `1.5px dashed ${WF_LINE_SOFT}` }}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: WF_RED, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
          Terrain · 12 avril 2026 · 2 min
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, lineHeight: 1, fontWeight: 700, maxWidth: 800 }}>
          BYD : retour sur la première session véhicules électriques en Afrique francophone.
        </div>
        <div style={{ fontSize: 14, color: WF_MUTED, marginTop: 14, maxWidth: 700 }}>
          Huit techniciens diplômés au premier cursus BYD, désormais habilités à intervenir sur les batteries haute-tension.
        </div>
        <div style={{
          marginTop: 24, height: 280, background: '#EAE9E2',
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, #DEDDD6 8px, #DEDDD6 9px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#999', fontSize: 12, fontFamily: 'monospace',
          border: `1.5px solid ${WF_LINE_SOFT}`, borderRadius: 6,
        }}>HERO IMAGE · 16:9</div>
      </div>
      <div style={{ padding: '32px 28px', maxWidth: 900, fontSize: 14, lineHeight: 1.7, color: WF_INK, borderBottom: `1.5px dashed ${WF_LINE_SOFT}` }}>
        <p style={{ marginBottom: 16 }}>Corps de l'article — paragraphes, citations, sous-titres, intégration de photos atelier. Le formalisme suit le rythme typographique de l'Academy : Inter Tight pour les titres, Inter pour le corps, accents JetBrains Mono pour les codes formation et niveaux cités.</p>
        <p style={{ marginBottom: 16 }}>« Verbatim formateur ou stagiaire en encart citation, avec attribution sous forme de signature. » <span style={{ color: WF_MUTED }}>— Eric N., technicien G3 Douala</span></p>
        <p>Texte courant · texte courant · texte courant.</p>
      </div>
      <WFSection ix="lié à cet article" title="Sessions liées"
        tabs={["BYD", "BEV", "Nigeria"]}>
        <WFList>
          <WFListItem date="—" meta="2026" code="BYD-BEV · NOUVEAU" title="Batteries haute-tension BYD" tag="Motors" lieu="Cameroun · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="continuer" title="Articles liés"
        tabs={["Motors", "Equipment", "Carrosserie", "Parts"]}>
        <WFCardRow n={3}>
          <WFCard h={150} kicker="Sessions · 23 jan" title="Session inaugurale BEV au Nigeria" meta="Avis d'intervention" />
          <WFCard h={150} kicker="Certifications · 30 mars" title="SUZUKI Z12E démontage moteur" meta="Retour de janvier" />
          <WFCard h={150} kicker="Terrain · 22 jan" title="SINOTRUK WD615 diagnostic Togo" meta="2 min" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

Object.assign(window, {
  WFFichePublic, WFPageBU, WFFicheFormation,
  WFFicheMarque, WFFicheSession, WFArticle,
});
