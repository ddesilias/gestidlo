import type {
  InterventionStatus, InterventionType, InterventionPriority,
} from '../../intervention.store';

// ── Filter shape ──────────────────────────────────────────────────────────────
export interface FiltresIntervention {
  recherche:       string;
  statuts:         InterventionStatus[];
  types:           InterventionType[];
  priorites:       InterventionPriority[];
  departements:    string[];
  institutions:    string[];
  urgences_seules: boolean;
  aujourd_hui:     boolean;
  sans_assignation:boolean;
  sla_depasse:     boolean;
}

export const FILTRES_VIDES: FiltresIntervention = {
  recherche: '', statuts: [], types: [], priorites: [],
  departements: [], institutions: [],
  urgences_seules: false, aujourd_hui: false, sans_assignation: false, sla_depasse: false,
};

// ── Display labels ────────────────────────────────────────────────────────────
export const STATUT_LABELS: Record<InterventionStatus, string> = {
  creee: 'Créée', envoyee: 'Envoyée', assignee: 'Assignée', acceptee: 'Acceptée', 'en-cours': 'En cours',
  'en-attente': 'En attente', terminee: 'Terminée', rejetee: 'Refusée', validee: 'Validée',
  cloturee: 'Clôturée', annulee: 'Annulée',
};

export const TYPE_LABELS: Record<InterventionType, string> = {
  verification: 'Vérification', reparation: 'Réparation', maintenance: 'Maintenance',
  installation: 'Installation', inspection: 'Inspection', urgence: 'Urgence',
};

export const PRIORITE_LABELS: Record<InterventionPriority, string> = {
  critique: 'Critique', haute: 'Haute', normale: 'Normale', basse: 'Basse',
};

// ── Dark-theme colour maps ────────────────────────────────────────────────────
export const STATUT_DOT: Record<InterventionStatus, string> = {
  creee:        '#94a3b8',
  envoyee:      '#60a5fa',
  assignee:     '#f97316',
  acceptee:     '#3b82f6',
  'en-cours':   '#3b82f6',
  'en-attente': '#eab308',
  terminee:     '#22c55e',
  rejetee:      '#ef4444',
  validee:      '#14b8a6',
  cloturee:     '#64748b',
  annulee:      '#ef4444',
};

export const STATUT_BG: Record<InterventionStatus, string> = {
  creee:        'rgba(100,116,139,.18)',
  envoyee:      'rgba(96,165,250,.18)',
  assignee:     'rgba(249,115,22,.18)',
  acceptee:     'rgba(59,130,246,.18)',
  'en-cours':   'rgba(59,130,246,.18)',
  'en-attente': 'rgba(234,179,8,.18)',
  terminee:     'rgba(34,197,94,.18)',
  rejetee:      'rgba(239,68,68,.18)',
  validee:      'rgba(20,184,166,.18)',
  cloturee:     'rgba(100,116,139,.10)',
  annulee:      'rgba(239,68,68,.18)',
};

export const PRIORITE_DOT: Record<InterventionPriority, string> = {
  critique: '#ef4444',
  haute:    '#f97316',
  normale:  '#3b82f6',
  basse:    '#94a3b8',
};

// ── Kanban columns ────────────────────────────────────────────────────────────
export interface KanbanColonne {
  id:    InterventionStatus;
  label: string;
  color: string;
}

export const KANBAN_COLONNES: KanbanColonne[] = [
  { id: 'creee',      label: 'Créées',     color: '#94a3b8' },
  { id: 'assignee',   label: 'Assignées',  color: '#f97316' },
  { id: 'en-cours',   label: 'En cours',   color: '#3b82f6' },
  { id: 'en-attente', label: 'En attente', color: '#eab308' },
  { id: 'terminee',   label: 'Terminées',  color: '#22c55e' },
  { id: 'validee',    label: 'Validées',   color: '#14b8a6' },
  { id: 'cloturee',   label: 'Clôturées',  color: '#64748b' },
  { id: 'annulee',    label: 'Annulées',   color: '#ef4444' },
];

// ── Transition map ────────────────────────────────────────────────────────────
export const NEXT_STATUSES: Partial<Record<InterventionStatus, InterventionStatus[]>> = {
  creee:       ['assignee', 'annulee'],
  assignee:    ['en-cours', 'annulee'],
  'en-cours':  ['en-attente', 'terminee'],
  'en-attente':['en-cours', 'annulee'],
  terminee:    ['validee'],
  validee:     ['cloturee'],
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
export function statutLabel(s: InterventionStatus):    string { return STATUT_LABELS[s]  ?? s; }
export function typeLabel(t: InterventionType):        string { return TYPE_LABELS[t]     ?? t; }
export function prioriteLabel(p: InterventionPriority):string { return PRIORITE_LABELS[p] ?? p; }
export function statutDot(s: InterventionStatus):      string { return STATUT_DOT[s]      ?? '#94a3b8'; }
export function statutBg(s: InterventionStatus):       string { return STATUT_BG[s]       ?? 'rgba(100,116,139,.18)'; }
export function prioriteDot(p: InterventionPriority):  string { return PRIORITE_DOT[p]    ?? '#94a3b8'; }

export function dateLabel(iso?: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export function timeLabel(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Port-au-Prince' });
}

export const SLA_HEURES_INT: Record<InterventionPriority, number> = {
  critique: 4, haute: 8, normale: 24, basse: 72,
};

export function slaElapsedInt(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
}

// ── Métriques rétrospectives (pures, testables hors Angular) ───────────────────
/** Minimum requis pour calculer une métrique de résolution. */
export interface InterventionResolue { createdAt: string; closedAt: string; priority: InterventionPriority; }

/** Une intervention est « résolue » si elle est terminée/validée/clôturée AVEC dates exploitables. */
export function estResolue(i: { status: InterventionStatus; createdAt?: string; closedAt?: string }): boolean {
  return ['terminee', 'validee', 'cloturee'].includes(i.status) && !!i.closedAt && !!i.createdAt;
}

/** Durée de résolution en heures : closedAt − createdAt. */
export function dureeResolutionH(i: { createdAt: string; closedAt: string }): number {
  return (new Date(i.closedAt).getTime() - new Date(i.createdAt).getTime()) / 3_600_000;
}

/** MTTR = moyenne des durées de résolution (h, arrondi). `null` si aucune résolue. */
export function mttrHeures(resolues: InterventionResolue[]): number | null {
  if (!resolues.length) return null;
  return Math.round(resolues.reduce((s, i) => s + dureeResolutionH(i), 0) / resolues.length);
}

/** Taux SLA respecté = % des résolues bouclées dans le délai de leur priorité. `null` si aucune résolue. */
export function slaRespectePct(resolues: InterventionResolue[]): number | null {
  if (!resolues.length) return null;
  const ok = resolues.filter(i => dureeResolutionH(i) <= SLA_HEURES_INT[i.priority]).length;
  return Math.round((ok / resolues.length) * 100);
}
