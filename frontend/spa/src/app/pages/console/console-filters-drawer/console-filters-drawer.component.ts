import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertSeverity, AlertSource, AlertStatus } from '../../../alert.store';
import { ConsoleStateService } from '../console-state.service';

@Component({
  selector: 'app-console-filters-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './console-filters-drawer.component.html',
  styleUrls: ['./console-filters-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleFiltersDrawerComponent {
  readonly state = inject(ConsoleStateService);

  readonly SEVERITES: AlertSeverity[] = ['critique', 'haute', 'moyenne', 'basse'];
  readonly STATUTS: AlertStatus[]     = ['ouverte', 'assignee', 'en-cours', 'resolue', 'ignoree', 'archivee'];
  readonly SOURCES: AlertSource[]     = ['iot', 'technicien', 'citoyen', 'supervision', 'systeme'];

  toggleDep(d: string): void {
    const cur = this.state.filtres().departements;
    this.state.modifierFiltre('departements',
      cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]);
  }
}
