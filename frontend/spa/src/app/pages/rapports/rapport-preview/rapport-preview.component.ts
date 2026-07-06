import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportEntry, TYPE_TO_TEMPLATE } from '../rapport.types';
import { InspectionTemplateComponent }    from './templates/inspection-template.component';
import { MensuelTemplateComponent }       from './templates/mensuel-template.component';
import { IncidentGraveTemplateComponent } from './templates/incident-grave-template.component';
import { AuditTemplateComponent }         from './templates/audit-template.component';
import { ToastService }                   from '../../../ui/toast.service';

@Component({
  selector: 'app-rapport-preview',
  standalone: true,
  imports: [
    CommonModule,
    InspectionTemplateComponent,
    MensuelTemplateComponent,
    IncidentGraveTemplateComponent,
    AuditTemplateComponent,
  ],
  templateUrl: './rapport-preview.component.html',
  styleUrls: ['./rapport-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RapportPreviewComponent {
  @Input({ required: true }) rapport!: ReportEntry;
  @Output() fermer = new EventEmitter<void>();

  private readonly toast = inject(ToastService);

  get template() { return TYPE_TO_TEMPLATE[this.rapport.type]; }

  imprimer(): void {
    this.toast.push('info', 'Impression en cours…');
    window.print();
  }
}
