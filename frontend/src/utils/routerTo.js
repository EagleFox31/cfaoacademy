/** Sépare `state` d'un objet `to` React Router pour `<Link to={…} state={…}>`. */
export function splitRouterTo(to) {
  if (!to || typeof to !== 'object' || !('pathname' in to)) {
    return { to, state: undefined }
  }
  const { state, ...path } = to
  return { to: path, state }
}
