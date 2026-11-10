// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PortalNotificationsBell from './PortalNotificationsBell.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const T = { notifications_title: 'Notifications', notifications_aria: 'Notifications', notifications_empty: 'Rien' }

describe('PortalNotificationsBell', () => {
  let host
  let root

  beforeEach(() => {
    host = document.body.appendChild(document.createElement('div'))
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const openBell = async alerts => {
    await act(async () => root.render(<PortalNotificationsBell t={T} alerts={alerts} />))
    await act(async () => host.querySelector('.nav-notif-btn').click())
  }

  it('une alerte avec action referme le menu et lance l’action', async () => {
    const onOpen = vi.fn()
    await openBell([{ id: 'a', label: 'CM', text: 'Texte', cta: 'Voir', onOpen }])
    const link = host.querySelector('button.nav-notif-item--link')
    expect(link.textContent).toContain('Voir')
    await act(async () => link.click())
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(host.querySelector('.nav-notif-dropdown')).toBeNull()
  })

  it('une alerte sans action reste un simple texte', async () => {
    await openBell([{ id: 'a', label: 'CM', text: 'Texte' }])
    expect(host.querySelector('button.nav-notif-item--link')).toBeNull()
    expect(host.querySelector('.nav-notif-item-text').textContent).toBe('Texte')
  })
})
