import { useState } from 'react'
import { KI_GEMINI_TSB_FLASH } from '../data/kiGeminiData.js'

export default function KIGeminiFlashBriefingCard() {
  const [attendedCount, setAttendedCount] = useState(KI_GEMINI_TSB_FLASH.readCount)
  const [isSigned, setIsSigned] = useState(false)
  const tsb = KI_GEMINI_TSB_FLASH

  const handleEmargement = () => {
    setAttendedCount(10)
    setIsSigned(true)
  }

  return (
    <div className="portal-ki-tsb-card">
      <div className="portal-ki-tsb-header">
        <div className="portal-ki-tsb-tag">
          <span className="portal-ki-tsb-pill">📢 {tsb.duration}</span>
          <span className="portal-ki-tsb-ref">{tsb.reference}</span>
        </div>
        <span className="portal-ki-tsb-severity">{tsb.severity}</span>
      </div>

      <h3 className="portal-ki-tsb-title">{tsb.title}</h3>

      <ul className="portal-ki-tsb-points">
        {tsb.keyPoints.map((point, index) => (
          <li key={index}>
            <span className="bullet">⚡</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <div className="portal-ki-tsb-footer">
        <div className="portal-ki-tsb-progress">
          <span className="portal-ki-tsb-count">
            {attendedCount} / {tsb.totalToRead} techniciens émargés
          </span>
          <div className="portal-ki-tsb-bar">
            <div
              className="portal-ki-tsb-fill"
              style={{ width: `${(attendedCount / tsb.totalToRead) * 100}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          className={`portal-ki-tsb-btn ${isSigned ? 'done' : ''}`}
          onClick={handleEmargement}
          disabled={isSigned}
        >
          {isSigned ? '✓ Émargement Atelier Validé' : '📝 Valider l\'émargement de l\'équipe (10 min)'}
        </button>
      </div>
    </div>
  )
}
