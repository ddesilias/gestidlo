import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Intervention, InterventionStatus } from '../../../intervention.store';
import { InterventionStateService } from '../intervention-state.service';
import {
  KANBAN_COLONNES, KanbanColonne, NEXT_STATUSES,
  statutLabel, typeLabel, prioriteLabel, prioriteDot,
} from '../intervention.types';

@Component({
  selector: 'app-intervention-kanban',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './intervention-kanban.component.html',
  styleUrls: ['./intervention-kanban.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionKanbanComponent {

  readonly state   = inject(InterventionStateService);
  readonly colonnes: KanbanColonne[] = KANBAN_COLONNES;

  cartesPourColonne(colId: InterventionStatus): Intervention[] {
    return this.state.interventionsFiltrees().filter(i => i.status === colId);
  }

  isSelected(id: string): boolean { return this.state.selection()?.id === id; }

  onCardClick(i: Intervention): void {
    this.state.selectionner(this.isSelected(i.id) ? null : i);
  }

  nextStatut(status: InterventionStatus): InterventionStatus | null {
    return NEXT_STATUSES[status]?.find(s => s !== 'annulee') ?? null;
  }

  canMoveForward(status: InterventionStatus): boolean { return !!this.nextStatut(status); }
  canCancel(status: InterventionStatus): boolean {
    return ['creee', 'assignee', 'en-cours', 'en-attente'].includes(status);
  }

  moveForward(i: Intervention): void {
    const next = this.nextStatut(i.status);
    if (next) this.state.setStatus(i.id, next);
  }

  cancelIntervention(i: Intervention): void {
    this.state.setStatus(i.id, 'annulee');
  }

  tasksDone(i: Intervention): number { return i.tasks.filter(t => t.done).length; }
  tasksPct(i: Intervention):  number {
    return i.tasks.length ? (this.tasksDone(i) / i.tasks.length) * 100 : 0;
  }

  prioriteLabel  = prioriteLabel;
  prioriteDot    = prioriteDot;
  typeLabel      = typeLabel;
  statutLabel    = statutLabel;

  initiales(nom: string): string {
    return nom.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }
}
