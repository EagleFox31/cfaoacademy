import { useLayoutEffect } from 'react'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DURATION_MS = 480
const SLIDE_DURATION_MS = 440
const MIN_ORIGIN = 48

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function isValidOriginRect(rect) {
  return Boolean(
    rect
    && rect.width >= MIN_ORIGIN
    && rect.height >= MIN_ORIGIN,
  )
}

function waitForTransition(el, fallbackMs) {
  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = event => {
      if (event.target === el && event.propertyName === 'transform') finish()
    }
    el.addEventListener('transitionend', onEnd)
    window.setTimeout(finish, fallbackMs + 48)
  })
}

function waitForAnimation(el, fallbackMs) {
  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('animationend', onEnd)
      resolve()
    }
    const onEnd = event => {
      if (event.target === el) finish()
    }
    el.addEventListener('animationend', onEnd)
    window.setTimeout(finish, fallbackMs + 48)
  })
}

function morphTransform(shell, originRect) {
  const end = shell.getBoundingClientRect()
  const scaleX = originRect.width / Math.max(end.width, 1)
  const scaleY = originRect.height / Math.max(end.height, 1)
  const dx = (originRect.left + originRect.width / 2) - (end.left + end.width / 2)
  const dy = (originRect.top + originRect.height / 2) - (end.top + end.height / 2)
  return { scaleX, scaleY, dx, dy }
}

/** Animation de sortie — morph inverse vers la carte ou slide-out. */
export function animateBrandDetailExit(shell, originRect) {
  if (!shell) return Promise.resolve()
  if (prefersReducedMotion()) return Promise.resolve()

  shell.classList.remove('portal-brand-detail-shell--slide-in')

  if (!isValidOriginRect(originRect)) {
    shell.classList.add('portal-brand-detail-shell--slide-out')
    return waitForAnimation(shell, SLIDE_DURATION_MS)
  }

  const { scaleX, scaleY, dx, dy } = morphTransform(shell, originRect)

  shell.style.transformOrigin = 'center center'
  shell.style.transition = [
    `transform ${DURATION_MS}ms ${EASE}`,
    `opacity ${DURATION_MS - 60}ms ease`,
    `border-radius ${DURATION_MS}ms ${EASE}`,
  ].join(', ')

  shell.getBoundingClientRect()

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      shell.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`
      shell.style.opacity = '0.88'
      shell.style.borderRadius = '18px'
      waitForTransition(shell, DURATION_MS).then(resolve)
    })
  })
}

/** Animation d'entrée page détail — morph depuis la carte ou slide-in. */
export default function useBrandDetailEntrance(shellRef, originRect, enabled = true) {
  useLayoutEffect(() => {
    if (!enabled) return undefined
    const shell = shellRef.current
    if (!shell) return undefined

    if (prefersReducedMotion() || !isValidOriginRect(originRect)) {
      shell.classList.add('portal-brand-detail-shell--slide-in')
      return undefined
    }

    const end = shell.getBoundingClientRect()
    const scaleX = originRect.width / Math.max(end.width, 1)
    const scaleY = originRect.height / Math.max(end.height, 1)
    const dx = (originRect.left + originRect.width / 2) - (end.left + end.width / 2)
    const dy = (originRect.top + originRect.height / 2) - (end.top + end.height / 2)

    shell.style.transition = 'none'
    shell.style.transformOrigin = 'center center'
    shell.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`
    shell.style.opacity = '0.88'
    shell.style.borderRadius = '18px'

    shell.getBoundingClientRect()

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        shell.style.transition = [
          `transform ${DURATION_MS}ms ${EASE}`,
          `opacity ${DURATION_MS - 60}ms ease`,
          `border-radius ${DURATION_MS}ms ${EASE}`,
        ].join(', ')
        shell.style.transform = 'none'
        shell.style.opacity = '1'
        shell.style.borderRadius = '0px'
      })
    })

    return () => {
      cancelAnimationFrame(frame)
      shell.style.transition = ''
      shell.style.transform = ''
      shell.style.opacity = ''
      shell.style.borderRadius = ''
      shell.style.transformOrigin = ''
    }
  }, [shellRef, originRect, enabled])
}
