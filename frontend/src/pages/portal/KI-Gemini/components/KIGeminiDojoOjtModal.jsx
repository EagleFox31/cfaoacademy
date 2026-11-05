import { useState, useEffect } from 'react'
import PortalModal from '../../../../components/PortalModal.jsx'
import { KI_GEMINI_TWI_CHECKLIST } from '../data/kiGeminiData.js'

export default function KIGeminiDojoOjtModal({ technician, onClose, onValidated }) {
  const [checkedSteps, setCheckedSteps] = useState({})
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [signatureDone, setSignatureDone] = useState(false)
  const [evalDone, setEvalDone] = useState(false)
  const [evaluationTopic, setEvaluationTopic] = useState('TS08-G3 · Freinage ABS, ESP & Contrôle Hydraulique')

  useEffect(() => {
    let interval = null
    if (isTimerRunning && !evalDone) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, evalDone])

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const toggleStep = (id) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const totalSteps = KI_GEMINI_TWI_CHECKLIST.length
  const completedCount = Object.values(checkedSteps).filter(Boolean).length
  const scorePercent = Math.round((completedCount / totalSteps) * 100)

  const hasCriticalFailure = KI_GEMINI_TWI_CHECKLIST.some(
    (step) => step.critical && checkedSteps[step.id] === false
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    setEvalDone(true)
    setIsTimerRunning(false)
    setTimeout(() => {
      if (onValidated) {
        onValidated({
          technicianId: technician.id,
          technicianName: technician.name,
          topic: evaluationTopic,
          score: scorePercent,
          duration: formatTimer(timerSeconds),
          date: new Date().toLocaleDateString('fr-FR'),
        })
      }
      onClose()
    }, 1200)
  }

  return (
    <PortalModal title={`Évaluation Dojo d'Atelier (OJT) — ${technician.name}`} onClose={onClose}>
      <div className="portal-ki-ojt-modal-body">
        {/* Header bar with timer and target */}
        <div className="portal-ki-ojt-header-strip">
          <div className="portal-ki-ojt-tech-info">
            <span className="portal-ki-badge-brand">TOYOTA</span>
            <div>
              <strong>{technician.name}</strong> · Agence de {technician.agency}
              <div className="portal-ki-ojt-sub">{evaluationTopic}</div>
            </div>
          </div>

          <div className="portal-ki-ojt-timer-box">
            <div className="portal-ki-timer-label">Chronomètre Barémé (Max 25:00)</div>
            <div className="portal-ki-timer-display">{formatTimer(timerSeconds)}</div>
            <button
              type="button"
              className="portal-ki-timer-toggle-btn"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
            >
              {isTimerRunning ? '⏸ Pause' : '▶ Reprendre'}
            </button>
          </div>
        </div>

        {/* Evaluation checklist */}
        <div className="portal-ki-ojt-section-title">
          <span>Grille d'Observation Méthodique TWI (Job Instruction)</span>
          <span className="portal-ki-ojt-counter">{completedCount} / {totalSteps} critères validés ({scorePercent}%)</span>
        </div>

        <div className="portal-ki-ojt-checklist">
          {KI_GEMINI_TWI_CHECKLIST.map((item) => {
            const isChecked = Boolean(checkedSteps[item.id])
            return (
              <div
                key={item.id}
                className={`portal-ki-ojt-step-card ${isChecked ? 'completed' : ''} ${item.critical ? 'critical' : ''}`}
                onClick={() => toggleStep(item.id)}
              >
                <div className="portal-ki-ojt-step-checkbox">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by card click
                  />
                </div>
                <div className="portal-ki-ojt-step-text">
                  <div className="portal-ki-step-title">{item.step}</div>
                  {item.critical && (
                    <span className="portal-ki-critical-tag">⚠️ Point d'Arrêt Sécurité Impératif</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Signature & Validation */}
        <div className="portal-ki-ojt-signature-zone">
          <div className="portal-ki-sign-block">
            <label>Visa Technicien ({technician.name})</label>
            <div
              className={`portal-ki-sign-pad ${signatureDone ? 'signed' : ''}`}
              onClick={() => setSignatureDone(true)}
            >
              {signatureDone ? (
                <span className="portal-ki-signature-ink">✍️ {technician.name} (Signé tactile)</span>
              ) : (
                <span className="portal-ki-sign-placeholder">Cliquer / Toucher pour signer</span>
              )}
            </div>
          </div>

          <div className="portal-ki-sign-block">
            <label>Visa Key Instructor (André YOGBA)</label>
            <div className="portal-ki-sign-pad signed">
              <span className="portal-ki-signature-ink">✍️ André YOGBA (KI G2 Certifié)</span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="portal-ki-ojt-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-validate"
            disabled={!signatureDone || completedCount === 0 || evalDone}
            onClick={handleSubmit}
          >
            {evalDone ? '✓ Enregistrement en cours...' : `Valider & Noter l'Épreuve (${scorePercent}%)`}
          </button>
        </div>
      </div>
    </PortalModal>
  )
}
