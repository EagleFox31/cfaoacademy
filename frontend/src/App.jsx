import { Routes, Route } from 'react-router-dom'
import { LocaleProvider } from './context/LocaleProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import Portal from './pages/portal/Portal.jsx'
import Assistance from './pages/portal/Assistance.jsx'
import Delivery from './pages/portal/Delivery.jsx'
import TrainerHome from './pages/portal/TrainerHome.jsx'
import TrainerReportNew from './pages/portal/TrainerReportNew.jsx'
import TrainerReportsEnCours from './pages/portal/TrainerReportsEnCours.jsx'
import TrainerReportsTermines from './pages/portal/TrainerReportsTermines.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import RouteMotion from './components/RouteMotion.jsx'
import AnnonceMaintenance from './components/AnnonceMaintenance.jsx'
import Accueil from './pages/Accueil.jsx'
import Formations from './pages/Formations.jsx'
import Publics from './pages/Publics.jsx'
import PublicFiche from './pages/PublicFiche.jsx'
import Actualites from './pages/Actualites.jsx'
import Article from './pages/Article.jsx'
import FormationFiche from './pages/FormationFiche.jsx'
import Login from './pages/Login.jsx'
import Contact from './pages/Contact.jsx'
import MentionsLegales from './pages/MentionsLegales.jsx'
import Confidentialite from './pages/Confidentialite.jsx'
import APropos from './pages/APropos.jsx'

export default function App() {
  return (
    <AuthProvider>
    <LocaleProvider>
      <ScrollToTop />
      <AnnonceMaintenance />
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
          <Route path="/contact" element={<Contact />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/confidentialite" element={<Confidentialite />} />
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/portail" element={<Portal />} />
          <Route path="/portail/assistance" element={<Assistance />} />
          <Route path="/portail/delivery" element={<Delivery />} />
          <Route path="/portail/formateur" element={<TrainerHome />} />
          <Route path="/portail/compte-rendu/nouveau" element={<TrainerReportNew />} />
          <Route path="/portail/compte-rendu/en-cours" element={<TrainerReportsEnCours />} />
          <Route path="/portail/compte-rendu/mes-rapports" element={<TrainerReportsTermines />} />
        </Routes>
      </RouteMotion>
    </LocaleProvider>
    </AuthProvider>
  )
}
