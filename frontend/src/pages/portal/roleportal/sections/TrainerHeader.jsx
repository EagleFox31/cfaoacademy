import PortalHeader from '../../../../components/PortalHeader'

/**
 * Haut de page du formateur, même phrase chiffrée que le directeur du centre :
 * « vous formez les techniciens CFAO sur N marques », avec les logos de ses
 * marques affichés d'office sous la phrase (rangée de logos de `PortalHeader`).
 * Sans marque connue, l'en-tête reste celui par défaut.
 */
export default function TrainerHeader({ ctx, values }) {
  const marques = values.marques ?? []
  if (marques.length === 0) return <PortalHeader user={ctx.user} />
  return (
    <PortalHeader
      user={{ ...ctx.user, brands: marques }}
      centerHero={{ mode: 'trainer', brands: marques.length }}
    />
  )
}
