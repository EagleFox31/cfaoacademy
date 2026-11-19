/**
 * Demandes d'assistance des techniciens, toutes marques (jeu de démo).
 * Le module d'assistance n'existe pas encore : le portail du formateur
 * n'en montre que les marques qu'il couvre (`filterTicketsForBrands`).
 */
export const TICKETS_ASSISTANCE_DEMO = [
  {
    id: 'tk-fmt-2107', collaboratorName: 'Martin FOKOU', agency: 'Douala', country: 'Cameroun',
    brand: 'toyota', ord: 'OR #CM-7814', status: 'open', updated: '16 nov. 2026',
    subject: 'Hilux 2.8 GD-6 : perte de puissance, code P0299 après remplacement du turbo',
  },
  {
    id: 'tk-fmt-2103', collaboratorName: 'Kossi Edem AMEWU', agency: 'Lomé', country: 'Togo',
    brand: 'toyota', ord: 'OR #TG-1290', status: 'open', updated: '14 nov. 2026',
    subject: 'Corolla Cross hybride : batterie HV à 0 % en roulage, procédure d’isolement',
  },
  {
    id: 'tk-fmt-2096', collaboratorName: 'Rodrigue HOUNKPE', agency: 'Cotonou', country: 'Bénin',
    brand: 'toyota', ord: 'OR #BJ-0457', status: 'progress', updated: '10 nov. 2026',
    subject: 'Land Cruiser 300 : étalonnage du radar après pare-brise',
  },
  {
    id: 'tk-fmt-2071', collaboratorName: 'Paul KAMGA TALLA', agency: 'Yaoundé', country: 'Cameroun',
    brand: 'toyota', ord: 'OR #CM-7702', status: 'resolved', updated: '28 oct. 2026',
    subject: 'Fortuner : valeur de couple des écrous de roue en jante alliage',
  },
  {
    id: 'tk-fmt-2102', collaboratorName: 'Oumarou HAMADOU', agency: 'Garoua', country: 'Cameroun',
    brand: 'suzuki', ord: 'OR #CM-7790', status: 'open', updated: '13 nov. 2026',
    subject: 'Swift 1.2 : ralenti instable après nettoyage du papillon',
  },
  {
    id: 'tk-fmt-2088', collaboratorName: 'Thierry ABENA OWONO', agency: 'Douala', country: 'Cameroun',
    brand: 'suzuki', ord: 'OR #CM-7751', status: 'resolved', updated: '5 nov. 2026',
    subject: 'Jimny : réglage du parallélisme après remplacement des rotules',
  },
  {
    id: 'tk-fmt-2099', collaboratorName: 'Samuel NJOYA MFOUAPON', agency: 'Douala', country: 'Cameroun',
    brand: 'byd', ord: 'OR #CM-7766', status: 'progress', updated: '11 nov. 2026',
    subject: 'Atto 3 : recharge AC interrompue à 80 %, lecture des défauts du chargeur embarqué',
  },
  {
    id: 'tk-fmt-2094', collaboratorName: 'Komlan AGBEKO', agency: 'Bamako', country: 'Mali',
    brand: 'hino', ord: 'OR #ML-0318', status: 'open', updated: '9 nov. 2026',
    subject: 'Hino 500 : régénération du DPF qui ne se lance pas',
  },
  {
    id: 'tk-fmt-2081', collaboratorName: 'Oumarou HAMADOU', agency: 'Garoua', country: 'Cameroun',
    brand: 'jcb', ord: 'OR #CM-7733', status: 'progress', updated: '2 nov. 2026',
    subject: 'JCB 3CX : pression hydraulique basse sur le circuit du bras',
  },
]
