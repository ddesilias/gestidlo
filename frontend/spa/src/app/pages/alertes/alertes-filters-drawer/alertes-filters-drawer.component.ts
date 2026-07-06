import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlerteStateService } from '../alerte-state.service';
import { AlertSeverity, AlertStatus, AlertSource } from '../../../alert.store';
import { SEVERITY_LABELS, STATUS_LABELS, SOURCE_LABELS, severityDot, statusDot, sourceDot } from '../alerte.types';

@Component({
  selector: 'app-alertes-filters-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alertes-filters-drawer.component.html',
  styleUrls: ['./alertes-filters-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertesFiltersDrawerComponent {
  readonly state = inject(AlerteStateService);

  readonly SEVERITES: AlertSeverity[] = ['critique', 'haute', 'moyenne', 'basse'];
  readonly STATUTS:   AlertStatus[]   = ['ouverte', 'assignee', 'en-cours', 'resolue', 'ignoree', 'archivee'];
  readonly SOURCES:   AlertSource[]   = ['iot', 'technicien', 'citoyen', 'supervision', 'systeme'];

  readonly severiteLabels = SEVERITY_LABELS;
  readonly statusLabels   = STATUS_LABELS;
  readonly sourceLabels   = SOURCE_LABELS;

  severityDot = severityDot;
  statusDot   = statusDot;
  sourceDot   = sourceDot;
}
