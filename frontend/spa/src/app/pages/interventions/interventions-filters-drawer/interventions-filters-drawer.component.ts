import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InterventionStateService } from '../intervention-state.service';
import { HaitiGeoService } from '../../../haiti-geo.service';
import { InterventionStatus, InterventionType, InterventionPriority } from '../../../intervention.store';
import { STATUT_LABELS, TYPE_LABELS, PRIORITE_LABELS, statutDot, prioriteDot } from '../intervention.types';

@Component({
  selector: 'app-interventions-filters-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interventions-filters-drawer.component.html',
  styleUrls: ['./interventions-filters-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterventionsFiltersDrawerComponent {
  readonly state = inject(InterventionStateService);
  private readonly geo = inject(HaitiGeoService);

  readonly STATUTS:   InterventionStatus[]  = ['creee', 'assignee', 'en-cours', 'en-attente', 'terminee', 'validee', 'cloturee', 'annulee'];
  readonly TYPES:     InterventionType[]    = ['verification', 'reparation', 'maintenance', 'installation', 'inspection', 'urgence'];
  readonly PRIORITES: InterventionPriority[] = ['critique', 'haute', 'normale', 'basse'];

  readonly statutLabels   = STATUT_LABELS;
  readonly typeLabels     = TYPE_LABELS;
  readonly prioriteLabels = PRIORITE_LABELS;

  statutDot   = statutDot;
  prioriteDot = prioriteDot;

  private _filterDept = '';
  get filterDept(): string { return this._filterDept; }
  set filterDept(v: string) {
    this._filterDept = v;
    this.state.modifierFiltre('departements', v ? [v] : []);
    this.filterCommune = '';
  }
  filterCommune = '';

  get communeOptions(): string[] { return this.geo.communesForDept(this._filterDept); }

  onCommuneChange(v: string): void { this.filterCommune = v; }

  onReset(): void {
    this._filterDept = '';
    this.filterCommune = '';
    this.state.reinitialiserFiltres();
  }
}
