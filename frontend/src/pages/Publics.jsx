import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import CardCarousel from '../components/CardCarousel.jsx'
import PvCard from '../components/PvCard.jsx'
import PublicCard from '../components/PublicCard.jsx'
import TestimonialShowcase from '../components/TestimonialShowcase.jsx'
import { TESTIMONIALS } from '../data/testimonials.js'
import { PUBLICS, STATS } from '../data/index.js'
import FlagMarquee from '../components/FlagMarquee.jsx'
import CtaBanner from '../components/CtaBanner.jsx'

const FAMILLE_ORDER = ['Tous', 'Atelier', 'Vente', 'Process & SAV', 'Clients']

const publicTabs = FAMILLE_ORDER.map(f => ({
  id: f,
  label: f,
  count: f === 'Tous' ? PUBLICS.length : PUBLICS.filter(p => p.famille === f).length,
}))

const parcours = [
  { kicker: 'Étape 1', title: 'Maintenance préventive', meta: 'G4 / N1 / Step 1 / BASIC' },
  { kicker: 'Étape 2', title: 'Réparation',             meta: 'G3 / N2-N3 / Step 2 / ADVANCED' },
  { kicker: 'Étape 3', title: 'Diagnostic',             meta: 'G2 / N4 / Step 3 / EXPERT' },
  { kicker: 'Étape 4', title: 'Certification finale',   meta: 'G1 / N5 / Master / CERTIFIED' },
]

export default function Publics() {
  return (
    <SitePageLayout showCursorGlow>
      <PageHeader
        eyebrow="8 publics · 8 parcours"
        title={<>Du technicien atelier au client <em>B2B</em>.</>}
        sub="Chaque public a son cursus, ses niveaux et ses sessions adaptés à son rôle dans l'écosystème mobilité."
      />

      {/* ── CHOISIR SON PUBLIC ── */}
      <PreviewSection
        ix="Par métier"
        title={<>Choisir son <em>public</em>.</>}
        voir={{ label: 'Voir le catalogue', to: '/formations' }}
        tabs={publicTabs}
      >
        {(active) => {
          const items = active === 'Tous' ? PUBLICS : PUBLICS.filter(p => p.famille === active)
          return (
            <CardCarousel>
              {items.map((p, i) => (
                <PublicCard key={p.name + i} public={p} />
              ))}
            </CardCarousel>
          )
        }}
      </PreviewSection>

      {/* ── PROGRESSION ── */}
      <PreviewSection
        ix="Parcours"
        title={<>Progression par <em>niveau</em>.</>}
        bgWord="niveaux"
        bgWordSide="right"
      >
        <CardCarousel>
          {parcours.map((p, i) => (
            <PvCard key={i} kicker={p.kicker} title={p.title} meta={p.meta} />
          ))}
        </CardCarousel>
      </PreviewSection>

      {/* ── TÉMOIGNAGES ── */}
      <PreviewSection
        ix="Témoignages"
        title={<>Ils en <em>parlent</em>.</>}
        bgWord="terrain"
        bgWordSide="left"
      >
        <TestimonialShowcase items={TESTIMONIALS} />
      </PreviewSection>

      <CtaBanner />
      <FlagMarquee />
    </SitePageLayout>
  )
}
