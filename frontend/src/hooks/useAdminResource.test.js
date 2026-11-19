// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fetchAllUsers, nextCursor } from './useAdminResource.js'

describe('nextCursor', () => {
  it('lit le curseur d\'une URL suivante', () => {
    expect(nextCursor('https://h/api/v1/core/users/?cursor=abc%3D')).toBe('abc=')
    expect(nextCursor('/api/v1/core/users/?cursor=xyz')).toBe('xyz')
  })

  it('renvoie null en fin de liste', () => {
    expect(nextCursor(null)).toBeNull()
    expect(nextCursor('/users/')).toBeNull()
  })
})

describe('fetchAllUsers', () => {
  it('enchaîne les pages jusqu\'à la dernière', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ results: [{ id: 1 }], next: '/users/?cursor=p2' })
      .mockResolvedValueOnce({ results: [{ id: 2 }], next: null })
    expect(await fetchAllUsers(list)).toEqual([{ id: 1 }, { id: 2 }])
    expect(list).toHaveBeenNthCalledWith(2, 'p2')
  })

  it('s\'arrête au plafond de pages', async () => {
    const list = vi.fn().mockResolvedValue({ results: [{ id: 1 }], next: '/users/?cursor=encore' })
    expect(await fetchAllUsers(list, 3)).toHaveLength(3)
  })
})
