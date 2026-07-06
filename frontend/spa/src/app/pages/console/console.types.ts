import type { AlertSeverity, AlertStatus } from '../../alert.store';

export type VueConsole = 'tableau' | 'kanban' | 'salle';

export interface TimelineHour {
  hour:     number;
  label:    string;
  critique: number;
  haute:    number;
  moyenne:  number;
  basse:    number;
  total:    number;
}

export interface KanbanColonne {
  id:    AlertStatus;
  label: string;
  color: string;
  bg:    string;
}

export const KANBAN_COLONNES_ALERTES: KanbanColonne[] = [
  { id: 'ouverte',    label: 'Ouvertes',  color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
  { id: 'assignee',   label: 'Assignées', color: '#f97316', bg: 'rgba(249,115,22,.12)' },
  { id: 'en-cours',   label: 'En cours',  color: '#3b82f6', bg: 'rgba(59,130,246,.12)' },
  { id: 'resolue',    label: 'Résolues',  color: '#22c55e', bg: 'rgba(34,197,94,.12)' },
  { id: 'ignoree',    label: 'Ignorées',  color: '#64748b', bg: 'rgba(100,116,139,.1)' },
  { id: 'archivee',   label: 'Archivées', color: '#475569', bg: 'rgba(71,85,105,.08)' },
];

export const SEV_COLOR: Record<AlertSeverity, string> = {
  critique: '#ef4444', haute: '#f97316', moyenne: '#eab308', basse: '#22c55e',
};
