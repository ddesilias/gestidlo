import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlerteStateService } from '../../alertes/alerte-state.service';

@Component({
  selector: 'app-console-kanban',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './console-kanban.component.html',
  styleUrls: ['./console-kanban.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleKanbanComponent {
  readonly state = inject(AlerteStateService);
}
