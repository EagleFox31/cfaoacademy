/** Titre de section avec mot en emphase (<em>). */
export function sectionTitle(before, em, after) {
  return (
    <>
      {before}
      <em>{em}</em>
      {after}
    </>
  )
}
