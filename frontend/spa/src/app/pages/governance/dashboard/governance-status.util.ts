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

// ── Score santé composite (CDC §18) — pur, testable, partagé scope national ↔ par-département ──
export interface SanteInputs {
  alertesCritiques: number;
  /** `null` = aucune intervention résolue → repli sur le nombre en retard. */
  slaRespectePct: number | null;
  interventionsEnRetard: number;
  rapportsEnRetard: number;
  capteursTotal: number;
  capteursEnLigne: number;
}

/** Composite opérationnel 0–100 : 35 % alertes · 30 % interventions · 20 % rapports · 15 % capteurs. */
export function scoreSante(x: SanteInputs): number {
  const sAlertes  = 100 - Math.min(100, x.alertesCritiques * 15);
  const sInterv   = x.slaRespectePct !== null ? x.slaRespectePct : 100 - Math.min(100, x.interventionsEnRetard * 20);
  const sRapports = 100 - Math.min(100, x.rapportsEnRetard * 20);
  const sCapteurs = x.capteursTotal ? Math.round((x.capteursEnLigne / x.capteursTotal) * 100) : 100;
  return Math.round(0.35 * sAlertes + 0.30 * sInterv + 0.20 * sRapports + 0.15 * sCapteurs);
}

/** Bandes CDC §18 : ≥90 Bon · 75–89 À surveiller · 60–74 Dégradé · <60 Critique. */
export function bandeSante(score: number): string {
  return score >= 90 ? 'Bon' : score >= 75 ? 'À surveiller' : score >= 60 ? 'Dégradé' : 'Critique';
}
