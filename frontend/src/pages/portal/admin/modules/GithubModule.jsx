const REPO_URL = import.meta.env.VITE_GITHUB_REPO_URL || 'https://github.com/EagleFox31/cfaoacademy'

const BLOCKS = ['github_commits', 'github_pulls', 'github_issues', 'github_ci']

export default function GithubModule({ t }) {
  return (
    <>
      <div className="dlv-toolbar">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="dlv-btn primary">{t.github_open_repo}</a>
      </div>
      <div className="dlv-grid-2">
        {BLOCKS.map(key => (
          <div key={key} className="dlv-panel dlv-awaiting">
            <div className="dlv-panel-k">{t.under_construction}</div>
            <h4>{t[key]}</h4>
            <p className="dlv-panel-sub">{t.github_wait}</p>
          </div>
        ))}
      </div>
    </>
  )
}
