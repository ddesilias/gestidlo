import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsoleStateService } from './console-state.service';
import { Timeline24hComponent } from './timeline-24h.component';
import { ConsoleDetailDrawerComponent } from './console-detail-drawer/console-detail-drawer.component';
import { ConsoleFiltersDrawerComponent } from './console-filters-drawer/console-filters-drawer.component';
import { ConsoleKanbanComponent } from './console-kanban/console-kanban.component';

@Component({
  selector: 'app-console-page',
  standalone: true,
  imports: [
    CommonModule,
    Timeline24hComponent,
    ConsoleDetailDrawerComponent,
    ConsoleFiltersDrawerComponent,
    ConsoleKanbanComponent,
  ],
  templateUrl: './console-page.component.html',
  styleUrls: ['./console-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsolePageComponent {
  readonly state = inject(ConsoleStateService);
}
