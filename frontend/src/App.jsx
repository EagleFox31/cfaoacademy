import { Routes, Route } from 'react-router-dom'
import { LocaleProvider } from './context/LocaleProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import Portal from './pages/portal/Portal.jsx'
import Assistance from './pages/portal/Assistance.jsx'
import CleRepartition from './pages/portal/CleRepartition.jsx'
import CompetencyBulletin from './pages/portal/CompetencyBulletin.jsx'
import DpsBrandCompetencyDetail from './pages/portal/DpsBrandCompetencyDetail.jsx'
import DpsTierCompetencyDetail from './pages/portal/DpsTierCompetencyDetail.jsx'
import DpsTechnicianPifDetail from './pages/portal/DpsTechnicianPifDetail.jsx'
import KiTeamgpDetail from './pages/portal/KiTeamgpDetail.jsx'
import Delivery from './pages/portal/Delivery.jsx'
import MedacapLaunch from './pages/portal/MedacapLaunch.jsx'
import KIGeminiDashboard from './pages/portal/KI-Gemini/KIGeminiDashboard.jsx'
import SuperAdminBuilderDashboard from './pages/portal/SuperAdminBuilderDashboard.jsx'
import MedacapProfilePreview from './pages/portal/MedacapProfilePreview.jsx'
import HelpCenterPreview from './help/pages/HelpCenterPreview.jsx'
import PortalHelpShell from './help/PortalHelpShell.jsx'
import TrainerHome from './pages/portal/TrainerHome.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import { SiteBackToTopFab } from './components/BackToTopFab.jsx'
import RedirectionExterne from './components/RedirectionExterne.jsx'
import RouteMotion from './components/RouteMotion.jsx'
import AnnonceMaintenance from './components/AnnonceMaintenance.jsx'
import useAuth from './hooks/useAuth.js'
import Accueil from './pages/Accueil.jsx'
import Formations from './pages/Formations.jsx'
import Publics from './pages/Publics.jsx'
import PublicFiche from './pages/PublicFiche.jsx'
import Actualites from './pages/Actualites.jsx'
import Article from './pages/Article.jsx'
import FormationFiche from './pages/FormationFiche.jsx'
import Login from './pages/Login.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import { OIDC_ACTIF } from './lib/auth.js'
import Contact from './pages/Contact.jsx'
import MentionsLegales from './pages/MentionsLegales.jsx'
import Confidentialite from './pages/Confidentialite.jsx'
import APropos from './pages/APropos.jsx'

// Chacun ne voit, dans l'annonce, que les changements qui le concernent.
function AnnonceSelonRole() {
  const { user } = useAuth()
  return <AnnonceMaintenance roles={user?.roles} />
}

export default function App() {
  return (
    <AuthProvider>
    <LocaleProvider>
      <PortalHelpShell>
      <ScrollToTop />
      <SiteBackToTopFab />
      <AnnonceSelonRole />
      {/* Loader + transition morph sur chaque changement de route */}
      <RouteMotion>
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/formations" element={<Formations />} />
          <Route path="/formations/fiche/:code" element={<FormationFiche />} />
          <Route path="/publics" element={<Publics />} />
          <Route path="/publics/:slug/:brandSlug" element={<PublicFiche />} />
          <Route path="/publics/:slug" element={<PublicFiche />} />
          <Route path="/actualites" element={<Actualites />} />
          <Route path="/actualites/:slug" element={<Article />} />
          <Route path="/login" element={<Login />} />
          {/* Retour de Keycloak, seulement si VITE_OIDC_ISSUER est définie. */}
          {OIDC_ACTIF && <Route path="/callback" element={<AuthCallback />} />}
          <Route path="/contact" element={<Contact />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/portail/competences/:brandId" element={<DpsBrandCompetencyDetail />} />
          <Route path="/portail/niveaux/:tierId" element={<DpsTierCompetencyDetail />} />
          <Route path="/portail/teamgp" element={<KiTeamgpDetail />} />
          <Route path="/portail/technicien/:technicianId/pif" element={<DpsTechnicianPifDetail />} />
          <Route path="/portail/assistance" element={<Assistance />} />
          <Route path="/portail/cle-repartition" element={<CleRepartition />} />
          <Route path="/portail/cle-repartition/:view" element={<CleRepartition />} />
          <Route path="/portail/resultats" element={<CompetencyBulletin />} />
          <Route path="/portail/resultats/:evalId" element={<CompetencyBulletin />} />
          <Route path="/portail/delivery" element={<Delivery />} />
          <Route path="/portail/medacap-launch" element={<MedacapLaunch />} />
          <Route path="/portail/ki-gemini" element={<KIGeminiDashboard />} />
          <Route path="/portail/admin/builder" element={<SuperAdminBuilderDashboard />} />
          <Route path="/portail/preview/:profileKey" element={<MedacapProfilePreview />} />
          <Route path="/portail/aide" element={<HelpCenterPreview />} />
          <Route path="/portail/formateur" element={<TrainerHome />} />
          {/* Le module des comptes rendus est servi à part (VITE_CR_URL). */}
          <Route path="/portail/compte-rendu/*" element={<RedirectionExterne />} />
          <Route path="/portail/journal-erreurs" element={<RedirectionExterne />} />
          <Route path="/portail" element={<Portal />} />
        </Routes>
      </RouteMotion>
      </PortalHelpShell>
    </LocaleProvider>
    </AuthProvider>
  )
}
