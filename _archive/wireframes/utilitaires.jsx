// Wireframes — utilitaires
// Exports: WFContact, WFEspaceApprenant, WFMentions

function WFContact() {
  return (
    <WFFrame label="08 · Contact & demande">
      <WFNav />
      <WFHero
        eyebrow="Parlons formation"
        title="Contact & demande."
        sub="Inscription, audit, partenariat, demande de catalogue : un formulaire unique, des contacts par pays."
        ctas={["Catalogue PDF"]}
      />
      <WFSection ix="formulaire" title="Faire une demande"
        tabs={["Inscription", "Catalogue", "Audit", "Partenariat"]}>
        <WFForm fields={[
          "Nom complet",
          "Email professionnel",
          "Téléphone",
          "Filiale CFAO / Société",
          "Pays",
          "Type de demande (selon onglet)",
          "Message",
        ]} cta="Envoyer ma demande" />
      </WFSection>
      <WFSection ix="13 pays" title="Coordonnées par pays"
        tabs={["Afrique Ouest", "Afrique Centrale", "Afrique Australe", "Océan Indien"]}>
        <WFCardRow n={4}>
          <WFCard h={140} kicker="Cameroun" title="CFAO Mobility CM" meta="responsable@... · +237 ..." />
          <WFCard h={140} kicker="Côte d'Ivoire" title="CFAO Mobility CI" meta="responsable@... · +225 ..." />
          <WFCard h={140} kicker="Sénégal" title="CFAO Mobility SN" meta="responsable@... · +221 ..." />
          <WFCard h={140} kicker="Togo" title="CFAO Mobility TG" meta="responsable@... · +228 ..." />
        </WFCardRow>
      </WFSection>
      <WFSection ix="questions fréquentes" title="FAQ"
        tabs={["Inscription", "Logistique", "Tarifs", "Certifications"]}>
        <WFCardRow n={3}>
          <WFCard h={130} kicker="Q." title="Comment s'inscrire à une session ?" meta="Voir la réponse →" />
          <WFCard h={130} kicker="Q." title="Le transport est-il pris en charge ?" meta="Voir la réponse →" />
          <WFCard h={130} kicker="Q." title="Comment obtenir mon attestation ?" meta="Voir la réponse →" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFEspaceApprenant() {
  return (
    <WFFrame label="09 · Espace apprenant (authentifié)">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', borderBottom: `1.5px solid ${WF_LINE_SOFT}`,
      }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>
          <span style={{ color: WF_RED }}>CFAO</span> Academy <span style={{ color: WF_MUTED, fontSize: 16 }}>· Espace apprenant</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#EAE9E2', border: `1.5px solid ${WF_LINE_SOFT}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Space Grotesk', sans-serif", fontSize: 16,
          }}>EN</div>
          <div style={{ fontSize: 13 }}>Eric N. <span style={{ color: WF_MUTED }}>· Tech. Toyota G3</span></div>
        </div>
      </div>
      <WFHero
        eyebrow="Bonjour Eric"
        title={<>Votre parcours,<br/>vos certifications.</>}
        sub="Vous êtes certifié G3. Votre prochaine certification G2 : 3 modules restants."
        ctas={["S'inscrire à une session", "Télécharger mes attestations"]}
        chips={["1 session à venir", "3 certifications", "G3 acquis"]}
      />
      <WFSection ix="mon parcours" title="Mes formations"
        tabs={["En cours", "Terminé", "À venir"]}>
        <WFCardRow n={4}>
          <WFCard kicker="EN COURS" title="TS06-G3 Organes électriques" meta="29 juin → 3 juillet" />
          <WFCard kicker="TERMINÉ" title="TS03-G3 Moteurs essence/diesel" meta="Mars 2026" />
          <WFCard kicker="TERMINÉ" title="TS05-G4 Maintenance" meta="Janvier 2026" />
          <WFCard kicker="À VENIR" title="TS08-G2 Diagnostic" meta="Juillet 2026" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="certifications" title="Mes certifications"
        tabs={["Toyota", "Suzuki", "Toutes"]}>
        <WFCardRow n={3}>
          <WFCard h={150} kicker="TOYOTA · G4" title="Maintenance préventive" meta="Acquis · Jan 2026 · Télécharger PDF" />
          <WFCard h={150} kicker="TOYOTA · G3" title="Réparation organes" meta="Acquis · Avr 2026 · Télécharger PDF" />
          <WFCard h={150} kicker="TOYOTA · G2" title="Diagnostic systèmes" meta="3 modules restants" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="mes sessions" title="Prochaines sessions inscrites">
        <WFList>
          <WFListItem date="29" meta="JUIN · 2026" code="TS06-G3 · TOYOTA · G3" title="Révision organes électriques" tag="Motors" lieu="Togo · 5 jours" />
        </WFList>
      </WFSection>
      <WFSection ix="suggestions" title="Catalogue recommandé"
        tabs={["Niveau supérieur (G2)", "Hybride · BEV", "Diagnostic"]}>
        <WFCardRow n={4}>
          <WFCard kicker="G2 · 5j" title="Diagnostic motorisation" meta="Toyota · TS08-G2" />
          <WFCard kicker="BEV · 5j" title="Batteries haute-tension BYD" meta="Nouveauté 2026" />
          <WFCard kicker="G1 · 5j" title="Certification G3 finale" meta="Toyota · TS07-G3" />
          <WFCard kicker="G2 · 5j" title="Diagnostic châssis" meta="Toyota" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

function WFMentions() {
  return (
    <WFFrame label="10 · Mentions légales">
      <WFNav />
      <WFHero
        eyebrow="Informations légales"
        title="Mentions légales."
        sub="Éditeur, hébergeur, conditions d'inscription, données personnelles."
      />
      <WFSection ix="éditeur" title="Éditeur du site"
        tabs={["Société", "Hébergeur", "Directeur publication"]}>
        <WFCardRow n={3}>
          <WFCard h={130} kicker="Société" title="CFAO Mobility" meta="SIRET · adresse · capital" />
          <WFCard h={130} kicker="Hébergeur" title="Hébergeur" meta="Nom · adresse" />
          <WFCard h={130} kicker="Directeur" title="Directeur de la publication" meta="Nom · fonction" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="rgpd" title="Données personnelles"
        tabs={["RGPD", "Cookies", "Contact DPO"]}>
        <WFCardRow n={3}>
          <WFCard h={140} kicker="RGPD" title="Vos droits sur vos données" meta="Accès · rectification · suppression" />
          <WFCard h={140} kicker="Cookies" title="Politique cookies" meta="Liste · finalités · durées" />
          <WFCard h={140} kicker="DPO" title="Contacter le DPO" meta="email@... · courrier postal" />
        </WFCardRow>
      </WFSection>
      <WFSection ix="conditions" title="Conditions d'inscription"
        tabs={["Inscription", "Annulation", "Tarifs"]}>
        <WFCardRow n={3}>
          <WFCard h={130} kicker="CGV" title="Conditions d'inscription" meta="Délais · prérequis · validation" />
          <WFCard h={130} kicker="Annulation" title="Politique d'annulation" meta="Délai · frais · report" />
          <WFCard h={130} kicker="Tarifs" title="Modalités tarifaires" meta="Inter-filiales / externe" />
        </WFCardRow>
      </WFSection>
      <WFFooter />
    </WFFrame>
  );
}

Object.assign(window, { WFContact, WFEspaceApprenant, WFMentions });
