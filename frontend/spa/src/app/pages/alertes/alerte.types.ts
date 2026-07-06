import type { AlertSeverity, AlertStatus, AlertSource } from '../../alert.store';
import type { InterventionType, InterventionPriority } from '../../intervention.store';

// ── Filter shape ──────────────────────────────────────────────────────────────
export interface FiltresAlerte {
  recherche:        string;
  severites:        AlertSeverity[];
  statuts:          AlertStatus[];
  sources:          AlertSource[];
  departements:     string[];
  sansIntervention: boolean;
  dernieres24h:     boolean;
  slaDepasse:       boolean;
}

export const FILTRES_VIDES_ALERTE: FiltresAlerte = {
  recherche: '', severites: [], statuts: [], sources: [],
  departements: [], sansIntervention: false, dernieres24h: false, slaDepasse: false,
};

// ── Labels ────────────────────────────────────────────────────────────────────
export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critique: 'Critique', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse',
};

export const STATUS_LABELS: Record<AlertStatus, string> = {
  ouverte:  'Ouverte',
  assignee: 'Assignée',
  'en-cours': 'En cours',
  resolue:  'Résolue',
  ignoree:  'Ignorée',
  archivee: 'Archivée',
};

export const SOURCE_LABELS: Record<AlertSource, string> = {
  iot:         'Capteur IoT',
  technicien:  'Technicien',
  citoyen:     'Citoyen',
  supervision: 'Supervision',
  systeme:     'Système',
};

// ── Dark-theme colours ────────────────────────────────────────────────────────
export const SEVERITY_DOT: Record<AlertSeverity, string> = {
  critique: '#ef4444', haute: '#f97316', moyenne: '#eab308', basse: '#22c55e',
};

export const SEVERITY_BG: Record<AlertSeverity, string> = {
  critique: 'rgba(239,68,68,.18)',
  haute:    'rgba(249,115,22,.18)',
  moyenne:  'rgba(234,179,8,.18)',
  basse:    'rgba(34,197,94,.18)',
};

export const STATUS_DOT: Record<AlertStatus, string> = {
  ouverte:    '#ef4444',
  assignee:   '#f97316',
  'en-cours': '#3b82f6',
  resolue:    '#22c55e',
  ignoree:    '#64748b',
  archivee:   '#475569',
};

export const STATUS_BG: Record<AlertStatus, string> = {
  ouverte:    'rgba(239,68,68,.18)',
  assignee:   'rgba(249,115,22,.18)',
  'en-cours': 'rgba(59,130,246,.18)',
  resolue:    'rgba(34,197,94,.18)',
  ignoree:    'rgba(100,116,139,.15)',
  archivee:   'rgba(71,85,105,.12)',
};

export const SOURCE_DOT: Record<AlertSource, string> = {
  iot:         '#14b8a6',
  technicien:  '#8b5cf6',
  citoyen:     '#f59e0b',
  supervision: '#3b82f6',
  systeme:     '#64748b',
};

// ── Transitions de statut ─────────────────────────────────────────────────────
export const NEXT_STATUSES_ALERTE: Partial<Record<AlertStatus, AlertStatus[]>> = {
  ouverte:    ['assignee', 'ignoree'],
  assignee:   ['en-cours', 'ignoree'],
  'en-cours': ['resolue'],
};

// ── Suggestion Intervention ───────────────────────────────────────────────────
export interface SuggestionIntervention {
  type:    InterventionType;
  priorite: InterventionPriority;
}

export const SUGGESTION_PAR_SEVERITE: Record<AlertSeverity, SuggestionIntervention> = {
  critique: { type: 'urgence',      priorite: 'critique' },
  haute:    { type: 'reparation',   priorite: 'haute'    },
  moyenne:  { type: 'verification', priorite: 'normale'  },
  basse:    { type: 'inspection',   priorite: 'basse'    },
};

// ── SLA ───────────────────────────────────────────────────────────────────────
export const SLA_HEURES: Record<AlertSeverity, number> = {
  critique: 4, haute: 8, moyenne: 24, basse: 72,
};

export type SlaStatus = 'ok' | 'warn' | 'over';

export function slaElapsed(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
}

export function slaLabel(createdAt: string): string {
  const h  = slaElapsed(createdAt);
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
}

export function slaStatus(severity: AlertSeverity, createdAt: string): SlaStatus {
  const elapsed = slaElapsed(createdAt);
  const limit   = SLA_HEURES[severity];
  if (elapsed >= limit) return 'over';
  if (elapsed >= limit * 0.75) return 'warn';
  return 'ok';
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
export function severityLabel(s: AlertSeverity): string { return SEVERITY_LABELS[s] ?? s; }
export function statusLabel(s: AlertStatus):     string { return STATUS_LABELS[s]    ?? s; }
export function sourceLabel(s: AlertSource):     string { return SOURCE_LABELS[s]    ?? s; }
export function severityDot(s: AlertSeverity):   string { return SEVERITY_DOT[s]     ?? '#94a3b8'; }
export function severityBg(s: AlertSeverity):    string { return SEVERITY_BG[s]      ?? 'rgba(100,116,139,.15)'; }
export function statusDot(s: AlertStatus):       string { return STATUS_DOT[s]       ?? '#94a3b8'; }
export function statusBg(s: AlertStatus):        string { return STATUS_BG[s]        ?? 'rgba(100,116,139,.15)'; }
export function sourceDot(s: AlertSource):       string { return SOURCE_DOT[s]       ?? '#94a3b8'; }

export function dateLabel(iso?: string): string {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export function timeLabel(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Port-au-Prince' });
}

export function isActive(s: AlertStatus): boolean {
  return ['ouverte', 'assignee', 'en-cours'].includes(s);
}
