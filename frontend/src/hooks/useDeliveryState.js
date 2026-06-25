import { useCallback, useMemo, useState } from 'react'
import {
  DELIVERY_STORAGE_KEY,
  NORMALIZED_STORIES,
  GATE_CHECKLIST,
  mergeDeliveryState,
  mergeGateState,
} from '../data/mock_delivery.js'

function readStorage() {
  try {
    const raw = localStorage.getItem(DELIVERY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStorage(patch) {
  const prev = readStorage()
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() }
  localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(next))
  return next
}

export default function useDeliveryState() {
  const [revision, setRevision] = useState(0)

  const stored = useMemo(() => readStorage(), [revision])

  const stories = useMemo(
    () => mergeDeliveryState(NORMALIZED_STORIES, stored),
    [stored],
  )

  const gate = useMemo(
    () => mergeGateState(GATE_CHECKLIST, stored),
    [stored],
  )

  const bump = useCallback(() => setRevision(r => r + 1), [])

  const updateStoryStatus = useCallback((storyId, status) => {
    const prev = readStorage()
    writeStorage({
      stories: {
        ...prev.stories,
        [storyId]: { ...prev.stories?.[storyId], status },
      },
    })
    bump()
  }, [bump])

  const updateStoryTest = useCallback((storyId, gateKey, value) => {
    const prev = readStorage()
    const storyPatch = prev.stories?.[storyId] ?? {}
    writeStorage({
      stories: {
        ...prev.stories,
        [storyId]: {
          ...storyPatch,
          tests: { ...storyPatch.tests, [gateKey]: value },
        },
      },
    })
    bump()
  }, [bump])

  const toggleGateItem = useCallback((itemId) => {
    const prev = readStorage()
    const current = prev.gate?.[itemId] ?? GATE_CHECKLIST.find(g => g.id === itemId)?.done
    writeStorage({
      gate: { ...prev.gate, [itemId]: !current },
    })
    bump()
  }, [bump])

  return {
    stories,
    gate,
    updateStoryStatus,
    updateStoryTest,
    toggleGateItem,
  }
}
