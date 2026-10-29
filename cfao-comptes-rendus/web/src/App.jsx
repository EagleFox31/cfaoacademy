import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import AppShell from './components/AppShell'
import { AuthProvider, useAuth } from './lib/auth'
import Accueil from './pages/Accueil'
import Connexion from './pages/Connexion'
import JournalErreurs from './pages/JournalErreurs'
import TrainerReportNew from './pages/TrainerReportNew'
import TrainerReportsEnCours from './pages/TrainerReportsEnCours'
import TrainerReportsTermines from './pages/TrainerReportsTermines'

/** Tout sauf la connexion demande un compte ouvert ; on y revient ensuite. */
function Protege({ avecBarre = true }) {
  const { user } = useAuth()
  const lieu = useLocation()
  if (!user) {
    const retour = `${lieu.pathname}${lieu.search}${lieu.hash}`
    return <Navigate to="/connexion" replace state={{ retour }} />
  }
  // L'accueil porte sa propre barre, comme l'accueil formateur du portail.
  if (!avecBarre) return <Outlet />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

// Les chemins sont ceux de l'ancien portail (`/portail/compte-rendu/*`) :
// les anciens liens et favoris redirigés vers ce module restent valables.
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route element={<Protege avecBarre={false} />}>
          <Route path="/" element={<Accueil />} />
        </Route>
        <Route element={<Protege />}>
          <Route path="/portail/compte-rendu/nouveau" element={<TrainerReportNew />} />
          <Route path="/portail/compte-rendu/en-cours" element={<TrainerReportsEnCours />} />
          <Route path="/portail/compte-rendu/a-documenter"
            element={<TrainerReportsEnCours aDocumenterAussi />} />
          <Route path="/portail/compte-rendu/mes-rapports" element={<TrainerReportsTermines />} />
          <Route path="/portail/journal-erreurs" element={<JournalErreurs />} />
          <Route path="/portail/compte-rendu" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
