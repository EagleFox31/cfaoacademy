import { useEffect, useState } from 'react'
import { fetchMedacapLearnerPif } from '../utils/medacapEvaluations.js'
import { isMedacapEnabled } from '../utils/medacapConfig.js'
import { isMedacapLearner } from '../utils/medacapLearner.js'

/** PIF live Define pour apprenant MEDACAP. */
export default function useLearnerPif(user) {
  const medacapLinked = isMedacapLearner(user)
  const [pif, setPif] = useState(null)
  const [loading, setLoading] = useState(medacapLinked && isMedacapEnabled())

  useEffect(() => {
    if (!medacapLinked || !isMedacapEnabled() || !user) {
      setPif(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    fetchMedacapLearnerPif(user)
      .then(data => {
        if (!cancelled && data) setPif(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user, medacapLinked])

  return { pif, loading, isMedacapLearner: medacapLinked }
}
