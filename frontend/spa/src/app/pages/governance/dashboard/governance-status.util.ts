/**
 * Seuils de statut — SOURCE UNIQUE (cahier de charges §7).
 * Trois états seulement : ok / attention / critique. Réutilisé par les tuiles-signal,
 * les barres de couverture et les badges. Un seul endroit à modifier si DINEPA
 * change un seuil. Les couleurs sont des tokens CSS (jamais codées en dur).
 */
export type Statut = 'ok' | 'attention' | 'critique';

/** Orienté « plus haut = mieux » (conformité, SLA, couverture). */
export function statutHaut(v: number, seuilOk: number, seuilAttention: number): Statut {
  if (v >= seuilOk) return 'ok';
  if (v >= seuilAttention) return 'attention';
  return 'critique';
}

/** Orienté « plus bas = mieux » (taux de saturation, files d'attente). */
export function statutBas(v: number, seuilOk: number, seuilAttention: number): Statut {
  if (v <= seuilOk) return 'ok';
  if (v <= seuilAttention) return 'attention';
  return 'critique';
}

export const STATUT_COULEUR: Record<Statut, string> = {
  ok:        'var(--text-success)',
  attention: 'var(--text-warning)',
  critique:  'var(--text-danger)',
};

export const STATUT_FOND: Record<Statut, string> = {
  ok:        'var(--bg-success)',
  attention: 'var(--bg-warning)',
  critique:  'var(--bg-danger)',
};

/** Libellé texte du statut — pour ne pas encoder l'information par la seule couleur (§11, a11y). */
export const STATUT_LIBELLE: Record<Statut, string> = {
  ok:        'ok',
  attention: 'attention',
  critique:  'critique',
};
