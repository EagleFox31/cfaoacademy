import { useState } from 'react'
import PortalModal from '../../../../components/PortalModal.jsx'

export default function KIGeminiEscalationModal({ onClose, onCreated }) {
  const [vehicle, setVehicle] = useState('Toyota Hilux GD-6 2.8 D-4D (2024)')
  const [vin, setVin] = useState('AHTFR22G909123456')
  const [dtc, setDtc] = useState('P0087 — Pression rail trop basse')
  const [symptoms, setSymptoms] = useState('Perte de puissance sous forte charge à chaud, claquement injecteur cylindre 3.')
  const [testsDone, setTestsDone] = useState('Filtre à gasoil neuf, contrôle basse pression (4.2 bar OK), retour de fuite injecteurs hors tolérance sur injecteur #3.')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      if (onCreated) {
        onCreated({
          ref: `DIAG-DLA-${Math.floor(1000 + Math.random() * 9000)}`,
          vehicle,
          vin,
          dtc,
          symptoms,
          testsDone,
          date: new Date().toLocaleDateString('fr-FR'),
          status: 'transmis_academy',
        })
      }
      onClose()
    }, 1000)
  }

  return (
    <PortalModal title="Escalade Diagnostic Niveau 2 — Support Flying Doctor" onClose={onClose}>
      <form onSubmit={handleSubmit} className="portal-ki-escalation-form">
        <div className="portal-ki-form-notice">
          ℹ️ Ce dossier normalisé est transmis directement au <strong>Formateur Expert Academy (Eugène EBENE)</strong> et aux équipes d'ingénierie constructeur pour arbitrage technique.
        </div>

        <div className="portal-ki-form-grid">
          <div className="portal-ki-form-field">
            <label>Véhicule & Motorisation :</label>
            <input
              type="text"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              required
            />
          </div>

          <div className="portal-ki-form-field">
            <label>Numéro de Série (VIN) :</label>
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              required
            />
          </div>

          <div className="portal-ki-form-field">
            <label>Codes Défauts Relevés (DTC) :</label>
            <input
              type="text"
              value={dtc}
              onChange={(e) => setDtc(e.target.value)}
              required
            />
          </div>

          <div className="portal-ki-form-field">
            <label>Symptômes Observés en Atelier :</label>
            <textarea
              rows={2}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              required
            />
          </div>

          <div className="portal-ki-form-field portal-ki-form-field--full">
            <label>Mesures & Contrôles déjà effectués (Méthode 5P) :</label>
            <textarea
              rows={3}
              value={testsDone}
              onChange={(e) => setTestsDone(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="portal-ki-form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-submit" disabled={submitted}>
            {submitted ? 'Transmission en cours...' : '🚀 Transmettre le Dossier à l\'Academy'}
          </button>
        </div>
      </form>
    </PortalModal>
  )
}
