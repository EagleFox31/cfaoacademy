/** Engrenage bandeau ticket — couleur selon statut, rotation sauf résolu / appui formateur. */
export default function AssistanceMediaIcon({ status }) {
  const isOpen = status === 'open'
  const isProgress = status === 'progress'
  const isResolved = status === 'resolved'
  const spins = Boolean(status) && !isResolved

  const className = [
    'portal-assistance-ticket-icon',
    isOpen ? 'is-open' : '',
    isProgress ? 'is-progress' : '',
    isResolved ? 'is-resolved' : '',
  ].filter(Boolean).join(' ')

  const svgClass = [
    'portal-assistance-tool-svg',
    spins ? 'is-spinning' : '',
    spins && isOpen ? 'is-spinning-fast' : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={className}>
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={svgClass}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.097.078.16.208.173.316.03.245.05.49.06.733a.59.59 0 0 1-.173.316l-.84.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.31.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.675-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.159-.208-.173-.316a7.486 7.486 0 0 0-.06-.733.59.59 0 0 1 .173-.316l.84-.692a1.875 1.875 0 0 0 .432-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
        />
      </svg>
    </span>
  )
}
