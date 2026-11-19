import DpsAssistanceSection from '../../../../components/DpsAssistanceSection.jsx'

/** Les demandes des techniciens sur les marques du formateur. Le module
 * d'assistance n'existe pas encore : cartes sans lien, chantier au survol. */
export default function TrainerAssistanceSection({ section, t, tPortal, texte, values }) {
  return (
    <DpsAssistanceSection
      t={tPortal}
      tickets={values.assistance}
      variant="trainer"
      eyebrow={texte(section.head.eyebrow)}
      title={texte(section.head.title)}
      enConstruction={t.under_construction}
    />
  )
}
