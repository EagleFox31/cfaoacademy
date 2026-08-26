import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import AppShell from './components/AppShell'
import { AsyncBoundary, Banner } from './components/ui'
import { LocaleProvider, useLocale } from './i18n'
import { api } from './lib/api'
import { handleCallback, isReviewer, login, readSession } from './lib/auth'
import { useAsync } from './lib/hooks'
import Campaign from './pages/Campaign'
import Entry from './pages/Entry'
import Inbox from './pages/Inbox'
import Outbox from './pages/Outbox'
import Recap from './pages/Recap'
import Review from './pages/Review'
import Tracking from './pages/Tracking'

/** Campagne courante + ma déclaration — chargées une fois, partagées. */
const CampaignContext = createContext(null)
export const useCampaign = () => useContext(CampaignContext)

function CampaignProvider({ children }) {
  const state = useAsync(async () => {
    const campaigns = await api.campaigns()
    const list = campaigns?.results ?? campaigns ?? []
    const campaign = list.find((c) => c.status === 'OPEN') ?? list[0] ?? null
    if (!campaign) return { campaign: null, submission: null, families: [] }

    const [families, submissions] = await Promise.all([
      api.families(campaign.id),
      api.submissions({ campaign: campaign.id }),
    ])
    const mine = (submissions?.results ?? submissions ?? [])[0] ?? null
    return { campaign, families: families?.results ?? families ?? [], submission: mine }
  }, [])

  return (
    <AsyncBoundary state={state}>
      {(data) => (
        <CampaignContext.Provider value={{ ...data, reload: state.reload, setData: state.setData }}>
          {children}
        </CampaignContext.Provider>
      )}
    </AsyncBoundary>
  )
}

function Callback({ onSession }) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    handleCallback()
      .then((session) => {
        onSession(session)
        navigate('/', { replace: true })
      })
      .catch(() => setError('auth'))
  }, [navigate, onSession])

  if (error) {
    return (
      <div style={{ padding: 32, maxWidth: 460 }}>
        <Banner tone="crit" title={t('auth.failed')}>
          <button type="button" className="btn" onClick={login} style={{ marginTop: 10 }}>
            {t('auth.signIn')}
          </button>
        </Banner>
      </div>
    )
  }
  return <div style={{ padding: 32 }}>{t('auth.signingIn')}</div>
}

function SignIn() {
  const { t } = useLocale()
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <div className="card" style={{ maxWidth: 380, width: '100%' }}>
        <div className="card__body stack">
          <div>
            <p className="eyebrow">{t('app.subtitle')}</p>
            <h1 style={{ fontSize: 20, margin: 0 }}>{t('app.name')}</h1>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t('auth.required')}
          </p>
          <button type="button" className="btn btn--primary" onClick={login}>
            {t('auth.signIn')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Authenticated({ session }) {
  const [pendingCount, setPendingCount] = useState(0)

  // Compteur de la file d'envoi — visible en permanence dans la navigation :
  // le circuit de relecture ne doit pas devenir un goulot silencieux.
  useEffect(() => {
    if (!isReviewer(session)) return undefined
    let alive = true
    const refresh = () =>
      api
        .outbound({ status: 'PENDING_REVIEW' })
        .then((data) => {
          if (!alive) return
          const rows = data?.results ?? data ?? []
          setPendingCount(rows.length)
        })
        .catch(() => {})
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [session])

  return (
    <CampaignProvider>
      <AppShell session={session} pendingCount={pendingCount}>
        <Routes>
          <Route path="/" element={<Campaign />} />
          <Route path="/saisie" element={<Entry />} />
          <Route path="/recapitulatif" element={<Recap />} />
          <Route path="/suivi" element={<Tracking />} />
          <Route path="/relecture" element={<Inbox />} />
          <Route path="/relecture/:id" element={<Review />} />
          <Route path="/a-envoyer" element={<Outbox onCountChange={setPendingCount} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </CampaignProvider>
  )
}

export default function App() {
  const [session, setSession] = useState(() => readSession())
  const isCallback = window.location.pathname === '/callback'

  return (
    <LocaleProvider profileLocale={session?.claims?.locale}>
      {isCallback ? (
        <Routes>
          <Route path="/callback" element={<Callback onSession={setSession} />} />
        </Routes>
      ) : session ? (
        <Authenticated session={session} />
      ) : (
        <SignIn />
      )}
    </LocaleProvider>
  )
}
