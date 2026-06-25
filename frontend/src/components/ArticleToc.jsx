import { useEffect, useState } from 'react'

export default function ArticleToc({ sections }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? null)

  useEffect(() => {
    if (!sections.length) return undefined

    const observed = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean)

    if (!observed.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (!visible.length) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: 0 },
    )

    observed.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  if (sections.length < 2) return null

  const scrollTo = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  return (
    <nav className="article-toc" aria-label="Dans cet article">
      <p className="article-toc-heading">Dans cet article</p>
      <ol className="article-toc-list">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={activeId === s.id ? 'is-active' : ''}
              aria-current={activeId === s.id ? 'true' : undefined}
              onClick={(e) => scrollTo(e, s.id)}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
