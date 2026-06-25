// Wireframes app — assembles all wireframes inside the DesignCanvas
const { useState } = React;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="cadre" title="Pages-cadre" subtitle="10 pages structurelles · 7 dans la nav principale">
        <DCArtboard id="accueil" label="01 · Accueil" width={1280} height={2800}><WFAccueil /></DCArtboard>
        <DCArtboard id="publics" label="02 · Publics (index)" width={1280} height={1700}><WFPublics /></DCArtboard>
        <DCArtboard id="formations" label="03 · Formations (index)" width={1280} height={1700}><WFFormations /></DCArtboard>
        <DCArtboard id="marques" label="04 · Marques (index)" width={1280} height={1900}><WFMarques /></DCArtboard>
        <DCArtboard id="sessions" label="05 · Sessions" width={1280} height={1700}><WFSessions /></DCArtboard>
        <DCArtboard id="actualites" label="06 · Actualités (index)" width={1280} height={1500}><WFActualites /></DCArtboard>
        <DCArtboard id="academy" label="07 · L'Academy" width={1280} height={3800}><WFAcademy /></DCArtboard>
      </DCSection>

      <DCSection id="gabarits" title="Gabarits" subtitle="4 templates utilisés pour des fiches dynamiques">
        <DCArtboard id="fiche-public" label="Gabarit fiche public" width={1280} height={2200}><WFFichePublic /></DCArtboard>
        <DCArtboard id="page-bu" label="Gabarit page BU" width={1280} height={1800}><WFPageBU /></DCArtboard>
        <DCArtboard id="fiche-formation" label="Gabarit fiche formation" width={1280} height={2100}><WFFicheFormation /></DCArtboard>
        <DCArtboard id="fiche-marque" label="Gabarit fiche marque" width={1280} height={2000}><WFFicheMarque /></DCArtboard>
        <DCArtboard id="fiche-session" label="Gabarit fiche session" width={1280} height={2000}><WFFicheSession /></DCArtboard>
        <DCArtboard id="article" label="Gabarit article actualité" width={1280} height={1900}><WFArticle /></DCArtboard>
      </DCSection>

      <DCSection id="utilitaires" title="Utilitaires" subtitle="Hors de la nav principale (footer + login)">
        <DCArtboard id="contact" label="08 · Contact & demande" width={1280} height={1500}><WFContact /></DCArtboard>
        <DCArtboard id="espace" label="09 · Espace apprenant" width={1280} height={1700}><WFEspaceApprenant /></DCArtboard>
        <DCArtboard id="mentions" label="10 · Mentions légales" width={1280} height={1400}><WFMentions /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
