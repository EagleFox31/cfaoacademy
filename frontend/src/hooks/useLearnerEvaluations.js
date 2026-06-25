import { useEffect, useMemo, useState } from 'react'

import {

  fetchMedacapCompetencyEvaluations,

  mergeLearnerEvaluations,

} from '../utils/medacapEvaluations.js'

import { isMedacapEnabled } from '../utils/medacapConfig.js'

import { isMedacapLearner } from '../utils/medacapLearner.js'



/**

 * Évaluations apprenant.

 * Profil MEDACAP (ex. an52ng) : compétences live ; reste du parcours branché progressivement.

 */

export default function useLearnerEvaluations(user, lms) {

  const mockEvaluations = lms?.evaluations ?? []

  const medacapLinked = isMedacapLearner(user)



  const [medacapCompetency, setMedacapCompetency] = useState([])

  const [medacapUserId, setMedacapUserId] = useState(null)

  const [medacapProfile, setMedacapProfile] = useState(null)

  const [loading, setLoading] = useState(medacapLinked && isMedacapEnabled())

  const [error, setError] = useState(null)



  useEffect(() => {

    if (!medacapLinked || !isMedacapEnabled() || !user) {

      setLoading(false)

      setMedacapCompetency([])

      setMedacapProfile(null)

      setError(null)

      return

    }



    let cancelled = false

    setLoading(true)

    setError(null)



    fetchMedacapCompetencyEvaluations(user)

      .then((data) => {

        if (cancelled || !data) return

        setMedacapCompetency(data.evaluations)

        setMedacapUserId(data.userId)

        setMedacapProfile(data.profile ?? null)

      })

      .catch((err) => {

        if (!cancelled) setError(err.message ?? 'MEDACAP unavailable')

      })

      .finally(() => {

        if (!cancelled) setLoading(false)

      })



    return () => { cancelled = true }

  }, [user, medacapLinked])



  const evaluations = useMemo(

    () => mergeLearnerEvaluations(mockEvaluations, medacapCompetency, user),

    [mockEvaluations, medacapCompetency, user],

  )



  const usingMedacapCompetency = medacapLinked && medacapCompetency.length > 0



  return {

    evaluations,

    medacapCompetency,

    medacapUserId,

    medacapProfile,

    loading,

    error,

    medacapEnabled: isMedacapEnabled(),

    usingMedacapCompetency,

    isMedacapLearner: medacapLinked,

  }

}

