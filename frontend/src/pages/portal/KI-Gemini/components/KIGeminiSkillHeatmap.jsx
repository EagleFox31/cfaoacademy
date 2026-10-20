import { useState, useMemo } from 'react'
import { KI_GEMINI_TECHNICIANS } from '../data/kiGeminiData.js'
import { dpsCompetencyTierChipClass, dpsCompetencyTierTableBandAccent } from '../../../../utils/dpsCompetencyTierTheme.js'

function getScoreBadgeClass(score) {
  if (score >= 85) return 'score-green'
  if (score >= 60) return 'score-amber'
  if (score > 0) return 'score-red'
  return 'score-muted'
}

export default function KIGeminiSkillHeatmap({ onSelectTechnician, onStartOjt }) {
  const [selectedAgency, setSelectedAgency] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTechnicians = useMemo(() => {
    return KI_GEMINI_TECHNICIANS.filter((tech) => {
      const matchAgency = selectedAgency === 'all' || tech.agency.toLowerCase() === selectedAgency.toLowerCase()
      const matchSearch = tech.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tech.agency.toLowerCase().includes(searchQuery.toLowerCase())
      return matchAgency && matchSearch
    })
  }, [selectedAgency, searchQuery])

  return (
    <div className="portal-ki-heatmap-wrapper">
      <div className="portal-ki-heatmap-controls">
        <div className="portal-ki-heatmap-filter-group">
          <label className="portal-ki-heatmap-filter-lbl">Agence :</label>
          <div className="portal-ki-heatmap-pill-list">
            {['all', 'Douala', 'Yaoundé', 'Bafoussam', 'Garoua'].map((agency) => (
              <button
                key={agency}
                type="button"
                className={`portal-ki-heatmap-pill ${selectedAgency === agency ? 'active' : ''}`}
                onClick={() => setSelectedAgency(agency)}
              >
                {agency === 'all' ? 'Toutes les agences' : agency}
              </button>
            ))}
          </div>
        </div>

        <div className="portal-ki-heatmap-search">
          <input
            type="text"
            placeholder="Rechercher un technicien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="portal-ki-search-input"
          />
        </div>
      </div>

      <div className="portal-ki-table-responsive">
        <table className="portal-ki-heatmap-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Technicien & Agence</th>
              <th style={{ width: '12%' }}>Palier</th>
              <th style={{ width: '12%' }}>Maintenance</th>
              <th style={{ width: '12%' }}>Freinage / Chassis</th>
              <th style={{ width: '12%' }}>Électricité</th>
              <th style={{ width: '12%' }}>Diagnostic</th>
              <th style={{ width: '12%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTechnicians.map((tech) => (
              <tr key={tech.id} className="portal-ki-heatmap-row">
                <td className="portal-ki-tech-cell">
                  <div className="portal-ki-tech-avatar-mini" style={{ borderColor: dpsCompetencyTierTableBandAccent(tech.primaryTier) }}>
                    {tech.name.split(' ').map(p => p[0]).join('')}
                  </div>
                  <div>
                    <div className="portal-ki-tech-name">{tech.name}</div>
                    <div className="portal-ki-tech-agency">{tech.agency} · {tech.pifTotal} formations PIF</div>
                  </div>
                </td>
                <td>
                  <span className={`portal-status-chip ${dpsCompetencyTierChipClass(tech.primaryTier)}`}>
                    {tech.primaryTier === 'junior' ? 'Junior' : tech.primaryTier === 'senior' ? 'Senior' : 'Expert'}
                  </span>
                </td>
                <td>
                  <span className={`portal-ki-score-cell ${getScoreBadgeClass(tech.skills.maintenance)}`}>
                    {tech.skills.maintenance}%
                  </span>
                </td>
                <td>
                  <span className={`portal-ki-score-cell ${getScoreBadgeClass(tech.skills.braking)}`}>
                    {tech.skills.braking}%
                  </span>
                </td>
                <td>
                  <span className={`portal-ki-score-cell ${getScoreBadgeClass(tech.skills.electricity)}`}>
                    {tech.skills.electricity}%
                  </span>
                </td>
                <td>
                  <span className={`portal-ki-score-cell ${getScoreBadgeClass(tech.skills.diagnostic)}`}>
                    {tech.skills.diagnostic > 0 ? `${tech.skills.diagnostic}%` : '—'}
                  </span>
                </td>
                <td>
                  <div className="portal-ki-row-actions">
                    <button
                      type="button"
                      className="portal-ki-action-btn-mini ojt"
                      title="Lancer une évaluation pratique en atelier"
                      onClick={() => onStartOjt && onStartOjt(tech)}
                    >
                      ⚡ Évaluer OJT
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="portal-ki-heatmap-footer">
        <div className="portal-ki-heatmap-legend">
          <span className="legend-item"><span className="legend-dot green"></span> Maîtrise validée (&ge;85%)</span>
          <span className="legend-item"><span className="legend-dot amber"></span> En cours d'acquisition (60-84%)</span>
          <span className="legend-item"><span className="legend-dot red"></span> Action formation requise (&lt;60%)</span>
          <span className="legend-item"><span className="legend-dot muted"></span> Non concerné</span>
        </div>
      </div>
    </div>
  )
}
