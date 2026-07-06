import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertStatus } from '../../../alert.store';
import { ConsoleStateService } from '../console-state.service';

@Component({
  selector: 'app-console-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './console-detail-drawer.component.html',
  styleUrls: ['./console-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleDetailDrawerComponent {
  readonly state = inject(ConsoleStateService);

  setStatus(id: string, s: AlertStatus): void {
    this.state.setStatus(id, s);
  }
}
