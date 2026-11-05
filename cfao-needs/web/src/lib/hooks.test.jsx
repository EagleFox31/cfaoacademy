/**
 * Machine à états de l'enregistrement différé.
 *
 * Ces tests existent à cause d'un incident réel : le témoin passait en
 * « Enregistrement… » dès la frappe, donc pendant toute la fenêtre de
 * temporisation — et indéfiniment tant que l'on tapait, puisque chaque frappe
 * relançait le minuteur. Quelqu'un qui actualisait à ce moment perdait sa saisie
 * alors que l'écran affirmait qu'elle partait.
 *
 * Le premier test est celui qui compte : `dirty` ne doit JAMAIS être confondu
 * avec `saving`.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedSave } from './hooks'

const DELAY = 800

function ligne(id, patch = {}) {
  return { catalog_line: id, q1: 0, q2: 0, q3: 0, q4: 0, ...patch }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useDebouncedSave — le témoin ne doit pas mentir', () => {
  it('passe en « dirty » à la frappe, PAS en « saving »', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    expect(result.current.state).toBe('idle')

    act(() => result.current.queue(ligne('a', { q1: 5 })))

    // Le cœur de la régression : rien n'est parti, l'état doit le dire.
    expect(result.current.state).toBe('dirty')
    expect(save).not.toHaveBeenCalled()
  })

  it('reste « dirty » tant que la temporisation n’a pas expiré', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))
    act(() => vi.advanceTimersByTime(DELAY - 1))

    expect(result.current.state).toBe('dirty')
    expect(save).not.toHaveBeenCalled()
  })

  it('reste « dirty » indéfiniment tant que l’on continue à taper', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    // Chaque frappe relance le minuteur : c'est le scénario qui faisait afficher
    // « Enregistrement… » pendant des dizaines de secondes sans un octet envoyé.
    for (let i = 1; i <= 10; i += 1) {
      act(() => result.current.queue(ligne('a', { q1: i })))
      act(() => vi.advanceTimersByTime(DELAY - 100))
    }

    expect(result.current.state).toBe('dirty')
    expect(save).not.toHaveBeenCalled()
  })

  it('passe en « saving » seulement quand la requête part', async () => {
    let resoudre
    const save = vi.fn(() => new Promise((r) => { resoudre = r }))
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))
    await act(async () => { vi.advanceTimersByTime(DELAY) })

    expect(save).toHaveBeenCalledTimes(1)
    expect(result.current.state).toBe('saving')

    await act(async () => { resoudre() })
    expect(result.current.state).toBe('saved')
  })
})

describe('useDebouncedSave — regroupement des envois', () => {
  it('n’envoie qu’une requête pour une salve de frappes', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => {
      result.current.queue(ligne('a', { q1: 1 }))
      result.current.queue(ligne('b', { q1: 2 }))
      result.current.queue(ligne('c', { q1: 3 }))
    })
    await act(async () => { vi.advanceTimersByTime(DELAY) })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0]).toHaveLength(3)
  })

  it('ne garde que la dernière valeur d’une même ligne', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => {
      result.current.queue(ligne('a', { q1: 1 }))
      result.current.queue(ligne('a', { q1: 2 }))
      result.current.queue(ligne('a', { q1: 9 }))
    })
    await act(async () => { vi.advanceTimersByTime(DELAY) })

    const rows = save.mock.calls[0][0]
    expect(rows).toHaveLength(1)
    expect(rows[0].q1).toBe(9)
  })

  it('ne fait rien quand il n’y a rien en attente', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    await act(async () => { await result.current.flush() })

    expect(save).not.toHaveBeenCalled()
    expect(result.current.state).toBe('idle')
  })
})

describe('useDebouncedSave — échec d’envoi', () => {
  it('passe en « error » et rend les lignes à la file', async () => {
    const save = vi.fn().mockRejectedValue(new Error('reseau'))
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))
    await act(async () => { vi.advanceTimersByTime(DELAY) })
    await act(async () => {})   // laisse la promesse rejetee retomber

    expect(result.current.state).toBe('error')

    // La ligne n'est pas perdue : la prochaine frappe la réexpédie.
    save.mockResolvedValueOnce(undefined)
    act(() => result.current.queue(ligne('b', { q1: 3 })))
    await act(async () => { vi.advanceTimersByTime(DELAY) })

    const rows = save.mock.calls[1][0]
    expect(rows.map((r) => r.catalog_line).sort()).toEqual(['a', 'b'])
  })
})

describe('useDebouncedSave — sortie de page', () => {
  it('envoie avec keepalive quand le document devient masqué', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))

    // `keepalive` fait survivre la requête à la destruction du document. Sans
    // lui, le navigateur l'annule au rechargement et le filet ne rattrape rien.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { window.dispatchEvent(new Event('pagehide')) })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][1]).toEqual({ keepalive: true })
  })

  it('n’envoie rien quand le document redevient visible', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))

    // Régression corrigée au passage : `visibilitychange` se déclenche aussi au
    // retour sur l'onglet, et le flush partait pour rien.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

    expect(save).not.toHaveBeenCalled()
    expect(result.current.state).toBe('dirty')
  })

  it('bloque la fermeture et envoie quand il reste des lignes en attente', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))

    const event = new Event('beforeunload', { cancelable: true })
    await act(async () => { window.dispatchEvent(event) })

    expect(event.defaultPrevented).toBe(true)
    expect(save).toHaveBeenCalledWith(expect.any(Array), { keepalive: true })
  })

  it('ne bloque pas la fermeture quand tout est enregistré', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))
    await act(async () => { vi.advanceTimersByTime(DELAY) })
    await act(async () => {})   // laisse la promesse resolue retomber
    expect(result.current.state).toBe('saved')

    const event = new Event('beforeunload', { cancelable: true })
    await act(async () => { window.dispatchEvent(event) })

    // Avertir quelqu'un qui n'a rien à perdre, c'est apprendre à ignorer l'alerte.
    expect(event.defaultPrevented).toBe(false)
  })

  it('n’écoute plus rien après démontage', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useDebouncedSave(save, DELAY))

    act(() => result.current.queue(ligne('a', { q1: 5 })))
    unmount()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { window.dispatchEvent(new Event('pagehide')) })

    expect(save).not.toHaveBeenCalled()
  })
})
