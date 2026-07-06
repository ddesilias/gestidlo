/**
 * GestiDlo · Gouvernance — SOURCE UNIQUE des 8 modules.
 * Alimente : (1) la sous-navigation à onglets (governance-shell), (2) le strip groupé de la
 * vue d'ensemble, (3) les badges d'attention. Ajouter/retirer un module = éditer CE tableau.
 * Les routes elles-mêmes restent déclarées dans app.routes.ts (paths alignés sur `path` ci-dessous).
 */
export type GovGroup = 'organisation' | 'cadre' | 'systeme';

export interface GovModuleDef {
  id: string;
  label: string;
  path: string;                 // segment relatif à /admin/governance
  icon: string;                 // nom Tabler SANS préfixe (rendu via `ti ti-{{icon}}`)
  desc: string;                 // sous-texte descriptif (PAS une métrique)
  group: GovGroup;
  badgeKey?: 'regles' | 'conformite';
}

export const GOVERNANCE_MODULES: GovModuleDef[] = [
  { id: 'territoire',   label: 'Territoire & zones',  path: 'territoire',   icon: 'map-2',         desc: 'sections',       group: 'organisation' },
  { id: 'institutions', label: 'Institutions',         path: 'institutions', icon: 'building-bank', desc: 'URD · acteurs',  group: 'organisation' },
  { id: 'utilisateurs', label: 'Utilisateurs & accès', path: 'utilisateurs', icon: 'users',         desc: 'rôles',          group: 'organisation' },
  { id: 'regles',       label: 'Règles & SLA',         path: 'regles',       icon: 'shield',        desc: 'seuils & délais', group: 'cadre', badgeKey: 'regles' },
  { id: 'conformite',   label: 'Conformité',           path: 'conformite',   icon: 'circle-check',  desc: 'audits & scores', group: 'cadre', badgeKey: 'conformite' },
  { id: 'politiques',   label: 'Politiques & données', path: 'politiques',   icon: 'file-text',     desc: 'référentiels',   group: 'cadre' },
  { id: 'audit',        label: 'Audit & journaux',     path: 'audit',        icon: 'activity',      desc: '30 jours',       group: 'systeme' },
  { id: 'config',       label: 'Configuration',        path: 'config',       icon: 'settings',      desc: 'système',        group: 'systeme' },
];

export const GOV_GROUP_LABELS: Record<GovGroup, string> = {
  organisation: 'Organisation',
  cadre: 'Cadre réglementaire',
  systeme: 'Système',
};
