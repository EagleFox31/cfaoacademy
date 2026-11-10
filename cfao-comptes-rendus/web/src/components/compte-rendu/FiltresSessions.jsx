import { FILTRES_VIDES } from '../../data/sessionsReferentiel'
import { filtreFormateurVisible, filtresActifs } from '../../utils/filtresSessions'

/**
 * Recherche et filtres de la liste des sessions : texte (code ou
 * intitule), mois, pays, marque et, quand il y a un choix, formateur.
 * La liste est filtree par le service ; ce composant ne fait que
 * tenir les valeurs saisies.
 */
export default function FiltresSessions({ filtres, onChange, options, user }) {
  const maj = patch => onChange({ ...filtres, ...patch })
  const formateur = filtreFormateurVisible(user, options.formateurs)

  return (
    <div className="cr-filtres" role="search" aria-label="Rechercher une session">
      <label className="cr-field cr-filtres-recherche">
        <span className="cr-field-label">Rechercher</span>
        <input className="cr-input" type="search" value={filtres.q}
          placeholder="Code ou intitulé de la formation"
          onChange={e => maj({ q: e.target.value })} />
      </label>
      <label className="cr-field">
        <span className="cr-field-label">Mois</span>
        <input className="cr-input" type="month" value={filtres.mois}
          onChange={e => maj({ mois: e.target.value })} />
      </label>
      <Liste label="Pays" valeur={filtres.pays} choix={options.pays}
        onChange={v => maj({ pays: v })} />
      <Liste label="Marque" valeur={filtres.marque} choix={options.marques}
        onChange={v => maj({ marque: v })} />
      {formateur && (
        <Liste label="Formateur" valeur={filtres.formateur} choix={options.formateurs}
          onChange={v => maj({ formateur: v })} />
      )}
      {filtresActifs(filtres) && (
        <button type="button" className="cr-btn cr-btn--ghost cr-filtres-effacer"
          onClick={() => onChange(FILTRES_VIDES)}>
          Effacer les filtres
        </button>
      )}
    </div>
  )
}

function Liste({ label, valeur, choix, onChange }) {
  return (
    <label className="cr-field">
      <span className="cr-field-label">{label}</span>
      <select className="cr-input" value={valeur} onChange={e => onChange(e.target.value)}>
        <option value="">Tous</option>
        {valeur && !choix.includes(valeur) && <option value={valeur}>{valeur}</option>}
        {choix.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  )
}
