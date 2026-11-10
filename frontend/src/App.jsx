import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LocaleProvider } from './context/LocaleProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import PortalHelpShell from './help/PortalHelpShell.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import { SiteBackToTopFab } from './components/BackToTopFab.jsx'
import RedirectionExterne from './components/RedirectionExterne.jsx'
import RouteMotion from './components/RouteMotion.jsx'
import GardeCleSeule from './components/GardeCleSeule.jsx'
import AnnonceMaintenance from './components/AnnonceMaintenance.jsx'
import useAuth from './hooks/useAuth.js'
import Login from './pages/Login.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import { OIDC_ACTIF } from './lib/auth.js'
// Importées ici et non par leur seule page : tout le style reste chargé d'office, dans le même ordre.
import './pages/portal/KI-Gemini/styles/kiGemini.css'
import './styles/player.css'

// Une page n'est chargée qu'à l'ouverture de sa route. Le retour de connexion et
// la page de connexion restent dans le socle : ils doivent répondre tout de suite.
const Portal = lazy(() => import('./pages/portal/Portal.jsx'))
const Assistance = lazy(() => import('./pages/portal/Assistance.jsx'))
const CleRepartition = lazy(() => import('./pages/portal/CleRepartition.jsx'))
const CompetencyBulletin = lazy(() => import('./pages/portal/CompetencyBulletin.jsx'))
const DpsBrandCompetencyDetail = lazy(() => import('./pages/portal/DpsBrandCompetencyDetail.jsx'))
const DpsTierCompetencyDetail = lazy(() => import('./pages/portal/DpsTierCompetencyDetail.jsx'))
const DpsTechnicianPifDetail = lazy(() => import('./pages/portal/DpsTechnicianPifDetail.jsx'))
const KiTeamgpDetail = lazy(() => import('./pages/portal/KiTeamgpDetail.jsx'))
const Delivery = lazy(() => import('./pages/portal/Delivery.jsx'))
const MedacapLaunch = lazy(() => import('./pages/portal/MedacapLaunch.jsx'))
const KIGeminiDashboard = lazy(() => import('./pages/portal/KI-Gemini/KIGeminiDashboard.jsx'))
const SuperAdminBuilderDashboard = lazy(() => import('./pages/portal/SuperAdminBuilderDashboard.jsx'))
const MedacapProfilePreview = lazy(() => import('./pages/portal/MedacapProfilePreview.jsx'))
const HelpCenterPreview = lazy(() => import('./help/pages/HelpCenterPreview.jsx'))
const TrainerHome = lazy(() => import('./pages/portal/TrainerHome.jsx'))
const Accueil = lazy(() => import('./pages/Accueil.jsx'))
const Formations = lazy(() => import('./pages/Formations.jsx'))
const Publics = lazy(() => import('./pages/Publics.jsx'))
const PublicFiche = lazy(() => import('./pages/PublicFiche.jsx'))
const Actualites = lazy(() => import('./pages/Actualites.jsx'))
const Article = lazy(() => import('./pages/Article.jsx'))
const FormationFiche = lazy(() => import('./pages/FormationFiche.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales.jsx'))
const Confidentialite = lazy(() => import('./pages/Confidentialite.jsx'))
const APropos = lazy(() => import('./pages/APropos.jsx'))

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
        <GardeCleSeule>
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
        </GardeCleSeule>
      </RouteMotion>
      </PortalHelpShell>
    </LocaleProvider>
    </AuthProvider>
  )
}
