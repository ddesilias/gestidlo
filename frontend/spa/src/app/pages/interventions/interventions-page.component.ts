import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { InterventionStateService } from './intervention-state.service';
import { NouvelleInterventionComponent } from './nouvelle-intervention/nouvelle-intervention.component';
import { InterventionDetailDrawerComponent } from './intervention-detail-drawer/intervention-detail-drawer.component';
import { InterventionKanbanComponent } from './intervention-kanban/intervention-kanban.component';
import { InterventionsFiltersDrawerComponent } from './interventions-filters-drawer/interventions-filters-drawer.component';

import {
  Intervention, InterventionStatus, InterventionType, InterventionPriority,
} from '../../intervention.store';
import {
  STATUT_LABELS, TYPE_LABELS, PRIORITE_LABELS,
  statutDot, statutBg, prioriteDot, dateLabel, timeLabel,
  SLA_HEURES_INT, slaElapsedInt,
} from './intervention.types';

export const STEPPER_LABELS = ['Planifiée', 'Acceptée', 'En route', 'Sur site', 'Diagnostic', 'Réparation', 'Test', 'Validée'];

@Component({
  selector: 'app-interventions-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NouvelleInterventionComponent,
    InterventionDetailDrawerComponent,
    InterventionKanbanComponent,
    InterventionsFiltersDrawerComponent,
  ],
  templateUrl: './interventions-page.component.html',
  styleUrls: ['./interventions-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionsPageComponent {

  readonly state = inject(InterventionStateService);

  readonly statutLabels   = STATUT_LABELS;
  readonly typeLabels     = TYPE_LABELS;
  readonly prioriteLabels = PRIORITE_LABELS;
  readonly STEPPER_LABELS = STEPPER_LABELS;
  readonly STEPPER_INDICES = Array.from({ length: STEPPER_LABELS.length }, (_, i) => i);

  readonly STATUTS: InterventionStatus[] = [
    'creee', 'assignee', 'en-cours', 'en-attente', 'terminee', 'validee', 'cloturee', 'annulee',
  ];
  readonly TYPES: InterventionType[] = [
    'verification', 'reparation', 'maintenance', 'installation', 'inspection', 'urgence',
  ];
  readonly PRIORITES: InterventionPriority[] = ['critique', 'haute', 'normale', 'basse'];

  statutDot   = statutDot;
  statutBg    = statutBg;
  prioriteDot = prioriteDot;
  dateLabel   = dateLabel;
  timeLabel   = timeLabel;

  // ── Local UI state ────────────────────────────────────────────────────────
  readonly _userToggledIds = signal<string[]>([]);
  readonly aiBannerVisible = signal(true);

  isExpanded(item: Intervention): boolean {
    const autoExpand = ['en-cours', 'en-attente'].includes(item.status);
    const toggled = this._userToggledIds().includes(item.id);
    return autoExpand ? !toggled : toggled;
  }

  toggleExpand(id: string, e: Event): void {
    e.stopPropagation();
    this._userToggledIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    );
  }

  // ── Workflow stepper ──────────────────────────────────────────────────────
  workflowStep(item: Intervention): number {
    switch (item.status) {
      case 'creee':      return 0;
      case 'assignee':   return 1;
      case 'en-attente': return 3;
      case 'terminee':   return 6;
      case 'validee':    return 7;
      case 'cloturee':   return 8;
      case 'annulee':    return -1;
      case 'en-cours': {
        const done  = item.tasks.filter(t => t.done).length;
        const total = item.tasks.length || 1;
        return 2 + Math.min(3, Math.floor(done / total * 4));
      }
      default: return 0;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  techInitials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }

  durationLabel(isoStart: string): string {
    const ms = Date.now() - new Date(isoStart).getTime();
    const h  = Math.floor(ms / 3_600_000);
    const m  = Math.floor((ms % 3_600_000) / 60_000);
    if (h === 0) return `${m}min`;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }

  durationPct(item: Intervention): number {
    const startIso = item.startedAt ?? item.createdAt;
    const elapsed  = slaElapsedInt(startIso);
    const sla      = SLA_HEURES_INT[item.priority];
    return Math.round(elapsed / sla * 100);
  }

  slaHours(p: InterventionPriority): number { return SLA_HEURES_INT[p]; }

  slaLabel(item: Intervention): string {
    const pct = this.durationPct(item);
    if (pct >= 100) return 'SLA dépassé';
    const h = SLA_HEURES_INT[item.priority];
    const restantH = h * (1 - pct / 100);
    const hh = Math.floor(restantH);
    const mm = Math.round((restantH - hh) * 60);
    return mm > 0 ? `${h}h SLA — ${hh}h${String(mm).padStart(2, '0')} restant` : `${h}h SLA — ${hh}h restant`;
  }

  isActive(s: InterventionStatus): boolean {
    return ['creee', 'assignee', 'en-cours', 'en-attente'].includes(s);
  }

  // ── Card click → detail drawer ────────────────────────────────────────────
  onCardClick(id: string): void {
    const item = this.state.toutesLesInterventions().find(i => i.id === id) ?? null;
    this.state.selectionner(this.state.selection()?.id === id ? null : item);
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  exporter(): void {
    const rows    = this.state.interventionsFiltrees();
    const headers = ['Code', 'Titre', 'Type', 'Priorité', 'Statut', 'Technicien', 'Infrastructure', 'Commune', 'Département', 'Date'];
    const csv = [
      headers.join(','),
      ...rows.map(i => [
        i.code,
        `"${(i.title ?? '').replace(/"/g, '""')}"`,
        i.type, i.priority, i.status, i.technicianName,
        i.infrastructureName ?? '', i.commune ?? '', i.department ?? '',
        i.createdAt.slice(0, 10),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `interventions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      this.state.ouvrirModal();
    }
  }
}
