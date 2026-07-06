import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RapportStateService } from '../rapport-state.service';
import { ReportStatus, ReportType } from '../rapport.types';

@Component({
  selector: 'app-rapports-filters-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rapports-filters-drawer.component.html',
  styleUrls: ['./rapports-filters-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RapportsFiltersDrawerComponent {
  readonly state = inject(RapportStateService);

  readonly STATUTS: ReportStatus[] = ['brouillon', 'genere', 'valide', 'transmis', 'archive', 'echec'];
  readonly TYPES: ReportType[]     = ['service', 'alertes', 'interventions', 'infrastructures', 'iot', 'qualite', 'traceabilite', 'executif'];
  readonly FORMATS = ['pdf', 'docx', 'xlsx'];

  readonly STATUT_LABELS: Record<ReportStatus, string> = {
    brouillon: 'Brouillon', genere: 'Généré', valide: 'Validé',
    transmis: 'Transmis', archive: 'Archivé', echec: 'Échec',
  };

  readonly TYPE_LABELS: Record<ReportType, string> = {
    service: 'Service', alertes: 'Alertes', interventions: 'Interventions',
    infrastructures: 'Infrastructures', iot: 'IoT', qualite: 'Qualité',
    traceabilite: 'Traçabilité', executif: 'Exécutif',
  };
}
