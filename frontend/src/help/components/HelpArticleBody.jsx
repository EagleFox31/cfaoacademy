export default function HelpArticleBody({ body }) {
  if (!body) return null
  const paragraphs = body.split(/\n\n+/).filter(Boolean)
  return (
    <div className="help-article-body">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 48)}>{paragraph}</p>
      ))}
    </div>
  )
}
