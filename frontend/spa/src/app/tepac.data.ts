// Affectations TEPAC par commune (relais communal de l'URD).
// Source de vérité partagée : utilisée par la fiche URD (KPI + table communes) ET par
// l'onglet Acteurs, pour que les compteurs « TEPAC affectés » soient toujours cohérents.
// `''` = commune connue sans TEPAC (poste vacant). À remplacer par zone_utilisateur
// quand l'affectation TEPAC sera persistée.
export const TEPAC_MAP: Record<string, string> = {
  'Tabarre':            'J.-M. Louis',
  'Léogâne':            'P. Joseph',
  'Pétion-Ville':       'R. Désir',
  'Carrefour':          '',
  'Delmas':             'M. Cadet',
  'Arcahaie':           'S. Louis',
  'Gressier':           'A. Pierre',
  'Croix-des-Bouquets': 'L. Jean',
};
