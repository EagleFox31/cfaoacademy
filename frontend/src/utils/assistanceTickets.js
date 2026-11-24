/** Nom affiché — filtre tickets assistance (demandeur = technicien connecté). */
export function resolveUserDisplayName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
}

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase()
}

/** Tickets visibles par un technicien : uniquement ceux qu'il a créés. */
export function filterTicketsForUser(tickets = [], user) {
  if (!user) return []

  const userId = user.sub
  const displayName = normalizeName(resolveUserDisplayName(user))

  return (tickets ?? []).filter(ticket => {
    if (ticket.userId && userId) return ticket.userId === userId
    if (ticket.createdBy && userId) return ticket.createdBy === userId
    if (displayName && ticket.collaboratorName) {
      return normalizeName(ticket.collaboratorName) === displayName
    }
    return false
  })
}

/** Tickets visibles par un formateur : ceux des marques qu'il couvre. */
export function filterTicketsForBrands(tickets = [], brands = []) {
  const marques = new Set(brands)
  return (tickets ?? []).filter(ticket => marques.has(ticket.brand))
}

/** Pool mock/API puis filtre technicien. */
export function resolveLearnerAssistanceTickets(lms, user) {
  const pool = lms?.myTickets ?? lms?.filialeTickets ?? []
  return filterTicketsForUser(pool, user)
}
